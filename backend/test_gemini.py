import os
import sys
import json
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

# Add parent directory to path so we can import 'database.connection'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.connection import get_db_connection

def test_gemini_connection():
    print("--- TESTING GEMINI API CONNECTION ---")

    # 1. Fetch the saved API key from our SQLite database
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM settings WHERE key = 'gemini_keys'").fetchone()
    conn.close()

    if not row:
        print("❌ Error: No Gemini API keys found in the database settings.")
        print("Please save an API key in the database first.")
        return

    # Split key string (supports multiple keys separated by commas)
    keys = [k.strip() for k in row["value"].split(",") if k.strip()]
    if not keys:
        print("❌ Error: Saved API key string is empty.")
        return

    api_key = keys[0]
    print(f"🔑 Found API Key (first 8 chars): {api_key[:8]}...")

    # 2. Configure the Google Generative AI Client
    try:
        genai.configure(api_key=api_key)
        
        # Initialize Gemini 2.5 Flash in strict JSON mode
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        # 3. Test prompt demanding JSON output
        test_prompt = "Say hello and return a JSON object with a single key 'reply' containing the value 'success'."
        print(f"🤖 Sending test prompt to Gemini: '{test_prompt}'")
        
        response = model.generate_content(test_prompt)
        
        print("\n✨ Response received from Gemini:")
        print(response.text)
        
        # Verify it parsed as valid JSON
        parsed_json = json.loads(response.text)
        assert parsed_json.get("reply") == "success", "Failed: Incorrect JSON content"
        print("\n✅ SUCCESS: Gemini connected and returned valid JSON!")
        
    except Exception as e:
        print(f"\n❌ FAILED to connect to Gemini: {str(e)}")

if __name__ == "__main__":
    test_gemini_connection()
