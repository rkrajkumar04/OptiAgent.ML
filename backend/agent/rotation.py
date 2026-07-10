# backend/agent/rotation.py

import time
import os
import google.api_core.exceptions
import google.generativeai as genai
from database.connection import get_db_connection

class ApiKeyRotator:
    """
    Manages a pool of Gemini API keys retrieved from SQLite settings database.
    Handles automatic key rotation and backoff retries when encountering rate limits (HTTP 429).
    """
    def __init__(self):
        self.keys = []
        self.current_index = 0
        self.load_keys()
        
    def load_keys(self):
        """Loads keys from GEMINI_API_KEYS env variable, falling back to SQLite database."""
        # 1. Try reading from environment variable first (.env file or system env)
        env_keys = os.getenv("GEMINI_API_KEYS")
        if env_keys and env_keys.strip():
            # Filter out default placeholder values if any
            parsed_keys = [k.strip() for k in env_keys.split(",") if k.strip() and not k.strip().startswith("AIzaSyPlaceholder")]
            if parsed_keys:
                self.keys = parsed_keys
                self.current_index = 0
                print(f"🔑 ApiKeyRotator: Loaded {len(self.keys)} keys from environment variable (GEMINI_API_KEYS).")
                return

        # 2. Fallback to settings database table
        conn = get_db_connection()
        cursor = conn.cursor()
        row = cursor.execute("SELECT value FROM settings WHERE key = 'gemini_keys'").fetchone()
        conn.close()
        
        if not row or not row["value"].strip():
            raise ValueError("No Gemini API keys found. Please configure GEMINI_API_KEYS in .env or via the Settings dashboard.")
            
        self.keys = [k.strip() for k in row["value"].split(",") if k.strip()]
        if not self.keys:
            raise ValueError("Gemini API key list is empty after splitting.")
            
        self.current_index = 0
        print(f"🔑 ApiKeyRotator: Loaded {len(self.keys)} keys from database.")
        
    def get_current_key(self) -> str:
        """Returns the currently active key."""
        if not self.keys:
            self.load_keys()
        return self.keys[self.current_index]
        
    def rotate(self) -> str:
        """Cycles to the next key index in the pool."""
        if not self.keys:
            self.load_keys()
        self.current_index = (self.current_index + 1) % len(self.keys)
        next_key = self.keys[self.current_index]
        print(f"🔄 Rotator: Rate limit hit. Cycling to key index {self.current_index} (first 8 chars: {next_key[:8]}...)")
        return next_key
        
    def execute_with_rotation(self, func, *args, **kwargs):
        """
        Runs the model call function and automatically rotates keys if 
        encountering a ResourceExhausted (HTTP 429) rate limit exception.
        """
        max_attempts = len(self.keys) * 2  # Cycle through pool twice before giving up
        attempts = 0
        
        while attempts < max_attempts:
            try:
                active_key = self.get_current_key()
                # Apply the current key to the SDK client
                genai.configure(api_key=active_key)
                
                # Execute the SDK call (e.g. chat.send_message)
                return func(*args, **kwargs)
                
            except google.api_core.exceptions.ResourceExhausted as re_err:
                attempts += 1
                print(f"⚠️ Key index {self.current_index} rate-limited (HTTP 429). Exception: {str(re_err)}")
                self.rotate()
                
                # Sleep if we have cycled through all keys once to allow the window to clear
                if attempts % len(self.keys) == 0:
                    print("⏳ All keys exhausted in pool. Sleeping 15s for cooldown backoff...")
                    time.sleep(15)
                    
            except Exception as e:
                # If it's a general API exception (e.g., model name invalid or syntax error), raise immediately
                raise e
                
        raise RuntimeError("Rotator failed: All API keys in rotation pool are exhausted and rate-limited.")
