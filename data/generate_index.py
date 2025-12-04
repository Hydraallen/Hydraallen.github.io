import os
import json

target_folders = ['./movies', './travel']

def generate_indexes():
    for folder in target_folders:
        if not os.path.exists(folder):
            print(f"Warning: Folder '{folder}' not found.")
            continue

        files = []
        for filename in os.listdir(folder):
            if filename.endswith('.json') and filename != 'index.json':
                files.append(filename.replace('.json', ''))
        
        output_file = os.path.join(folder, 'index.json')
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(files, f, indent=2)
            
        print(f"Success! Updated {output_file} with {len(files)} files.")

if __name__ == "__main__":
    generate_indexes()
