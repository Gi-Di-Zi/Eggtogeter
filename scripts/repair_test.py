import os

# Target file for test: The Log file with '媛쒖슂'
TARGET_FILE = r'c:\personal-project\eggtogether\docs\Logs\20260117_01_UnifiedPicker_Log.md'

def try_repair(path):
    try:
        # Open with utf-8-sig to handle BOM if present
        with open(path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            
        print(f"Original Content Preview:\n{content[:100]}")
        
        # Repair Strategy: Reverse the [UTF-8 Bytes -> Read as CP949 -> Save as UTF-8] chain
        # 1. We have the "Saved as UTF-8" characters (e.g., '媛')
        # 2. Encode them to CP949 (Restores original UTF-8 bytes, e.g., 0xEA 0xB0)
        # 3. Decode those bytes as UTF-8 (Restores original character '개')
        
        try:
            # We use errors='ignore' in case there are legitimate chars that fail encoding, 
            # though in this specific Mojibake scenario, almost everything maps back.
            # But non-mojibake characters (like English) encode fine to CP949 usually.
            
            repaired = content.encode('cp949').decode('utf-8')
            print(f"\n[SUCCESS Repaired Content Preview]:\n{repaired[:200]}")
            return repaired
        except Exception as e:
            print(f"\n[Repair Failed]: {e}")
            
    except Exception as e:
        print(f"Error reading file: {e}")

if __name__ == "__main__":
    if os.path.exists(TARGET_FILE):
        result = try_repair(TARGET_FILE)
        if result:
            # Save to a new file to verify
            test_out = path = r'c:\personal-project\eggtogether\docs\Logs\REPAIR_TEST_RESULT.md'
            with open(test_out, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"Saved to {test_out}")
    else:
        print(f"File not found: {TARGET_FILE}")
