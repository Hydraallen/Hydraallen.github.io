import os
import re

def fix_content(content):
    void_tags = [
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]
    
    tags_pattern = '|'.join(void_tags)
    pattern = rf'(<(?::{tags_pattern})\b[^>]*?)\s*/>'
    
    return re.subn(pattern, r'\1>', content, flags=re.IGNORECASE | re.DOTALL)

def process_directory(root_dir):
    total_fixed_files = 0
    total_fixed_tags = 0

    print(f"Scanning directory: {os.path.abspath(root_dir)}")

    for root, _, files in os.walk(root_dir):
        for file in files:
            if file.lower().endswith(('.html', '.js')):
                file_path = os.path.join(root, file)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content, count = fix_content(content)
                    
                    if count > 0:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Fixed {count} tags in: {file_path}")
                        total_fixed_files += 1
                        total_fixed_tags += count
                        
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

    print("-" * 30)
    print(f"Completed. Fixed {total_fixed_tags} tags across {total_fixed_files} files.")

if __name__ == "__main__":
    process_directory('.')
