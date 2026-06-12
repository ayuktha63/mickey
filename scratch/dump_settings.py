import sqlite3
import os

db_dir = "data"
print("DATABASE_DIR:", db_dir)

for mode in ["work", "personal"]:
    db_path = f"{db_dir}/workspace_{mode}.db"
    print(f"\n--- Database: {db_path} ---")
    if not os.path.exists(db_path):
        print("File does not exist")
        continue
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT key, value FROM settings WHERE key IN ('ollama_url', 'selected_model')")
        rows = cursor.fetchall()
        for row in rows:
            print(f"{row[0]}: {row[1]}")
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()
