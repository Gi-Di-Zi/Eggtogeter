import json
import re
import sys

def parse_markdown_to_blocks(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    blocks = []
    current_code_block = None

    for line in lines:
        line = line.rstrip()

        # Code Block Handling
        if line.startswith("```"):
            if current_code_block is None:
                lang = line[3:].strip() or "plain text"
                current_code_block = {"type": "code", "code": {"rich_text": [], "language": lang}}
            else:
                blocks.append(current_code_block)
                current_code_block = None
            continue

        if current_code_block:
            current_code_block["code"]["rich_text"].append({"type": "text", "text": {"content": line + "\n"}})
            continue

        # Headers
        if line.startswith("# "):
            blocks.append({
                "type": "heading_1",
                "heading_1": {"rich_text": [{"type": "text", "text": {"content": line[2:]}}]}
            })
        elif line.startswith("## "):
            blocks.append({
                "type": "heading_2",
                "heading_2": {"rich_text": [{"type": "text", "text": {"content": line[3:]}}]}
            })
        elif line.startswith("### "):
            blocks.append({
                "type": "heading_3",
                "heading_3": {"rich_text": [{"type": "text", "text": {"content": line[4:]}}]}
            })
        
        # Lists
        elif line.strip().startswith("- ") or line.strip().startswith("* "):
            content = re.sub(r"^(\s*)[-*]\s+", "", line)
            blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": content}}]}
            })
        
        # Quote/Callout (Generic mapping to callout)
        elif line.startswith("> "):
            content = line[2:].strip()
            # Simple heuristic for alerts
            icon = "💡"
            if "[!TIP]" in content: icon = "💡"; content = content.replace("[!TIP]", "").strip()
            elif "[!NOTE]" in content: icon = "ℹ️"; content = content.replace("[!NOTE]", "").strip()
            elif "[!IMPORTANT]" in content: icon = "❗"; content = content.replace("[!IMPORTANT]", "").strip()
            elif "[!WARNING]" in content: icon = "⚠️"; content = content.replace("[!WARNING]", "").strip()
            
            blocks.append({
                "type": "callout",
                "callout": {
                    "rich_text": [{"type": "text", "text": {"content": content}}],
                    "icon": {"emoji": icon}
                }
            })

        # Paragraph (non-empty)
        elif line.strip():
            blocks.append({
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": line}}]}
            })
            
    return blocks

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_dashboard_json.py <input_md> <output_json>")
        sys.exit(1)
        
    input_md = sys.argv[1]
    output_json = sys.argv[2]
    
    blocks = parse_markdown_to_blocks(input_md)
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(blocks, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully generated {output_json}")
