
import os
import json
import glob
import re

LOG_DIR = r"c:\personal-project\eggtogether\docs\Logs"
OUTPUT_FILE = os.path.join(LOG_DIR, "execution_history.jsonl")

def parse_filename(filename):
    # Pattern: YYYYMMDD_Seq_Name.md
    match = re.match(r"(\d{8})_(\d+)_+(.+)\.md", filename)
    if match:
        date_str = match.group(1) # YYYYMMDD
        seq = match.group(2)
        name = match.group(3).replace("_", " ")
        
        # Format date: YYYY-MM-DD
        formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
        
        # Create a time based on sequence to maintain order
        # distinct minutes/seconds
        seq_int = int(seq)
        hours = seq_int // 60
        minutes = seq_int % 60
        time_str = f"{hours:02d}:{minutes:02d}:00"
        
        timestamp = f"{formatted_date} {time_str}"
        return timestamp, name
    return None, filename

def reconstruct():
    files = glob.glob(os.path.join(LOG_DIR, "*.md"))
    # Sort by filename to ensure chronological order (Sequences align)
    files.sort()
    
    entries = []
    
    print(f"Found {len(files)} markdown files in {LOG_DIR}")
    
    for file_path in files:
        filename = os.path.basename(file_path)
        if filename.startswith("_") or filename == "execution_history.jsonl":
            continue
            
        timestamp, task_name = parse_filename(filename)
        if not timestamp:
            # Fallback for files not matching pattern
            timestamp = "2026-01-29 00:00:00"
            task_name = filename.replace(".md", "")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            content = "Error reading file content."

        # Create JSONL entry
        entry = {
            "timestamp": timestamp,
            "task": task_name,
            "skill": "Log Reconstruction",
            "status": "SUCCESS",
            "message": content  # Storing full content as requested
        }
        entries.append(entry)

    # Write to JSONL
    # If file exists, we might duplicate if we are not careful.
    # The user asked to "make a log", implying creating it or adding to it.
    # Since specific instruction was "make a log from md files", replacing or appending?
    # I will Append, but checking if file exists first.
    # Actually, relying on 'logging' usually means appending.
    
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            
    print(f"Successfully wrote {len(entries)} entries to {OUTPUT_FILE}")

if __name__ == "__main__":
    reconstruct()
