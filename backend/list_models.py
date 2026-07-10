import os
import sys
import google.generativeai as genai

# Add parent directory to path so we can import 'database.connection'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.connection import get_db_connection

def list_available_models():
    print("--- FETCHING ALLOWED GEMINI MODELS ---")

    # 1. Fetch key
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM settings WHERE key = 'gemini_keys'").fetchone()
    conn.close()

    if not row:
        print("❌ Error: No keys found in SQLite.")
        return

    keys = [k.strip() for k in row["value"].split(",") if k.strip()]
    api_key = keys[0]

    # 2. Configure SDK
    try:
        genai.configure(api_key=api_key)
        
        # 3. List models
        print("Models supported by this API key:")
        models = genai.list_models()
        count = 0
        for m in models:
            # Check if the model supports content generation
            if 'generateContent' in m.supported_generation_methods:
                print(f"  - {m.name} (Supported methods: {m.supported_generation_methods})")
                count += 1
                
        if count == 0:
            print("⚠️ Warning: No models found that support generateContent!")
            
    except Exception as e:
        print(f"❌ Failed to list models: {str(e)}")

if __name__ == "__main__":
    list_available_models()
