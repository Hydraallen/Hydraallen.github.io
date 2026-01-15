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
            # 修改点 1: 增加排除 'backup.json'
            if filename.endswith('.json') and filename not in ['index.json', 'backup.json']:
                files.append(filename.replace('.json', ''))
        
        # 修改点 2: 针对 movies 文件夹进行倒序排列 (年份从大到小)
        if folder == './movies':
            files.sort(reverse=True)
        else:
            # 其他文件夹通常保持默认升序 (a-z)
            files.sort()
        
        output_file = os.path.join(folder, 'index.json')
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(files, f, indent=2, ensure_ascii=False) # 建议加上 ensure_ascii=False 防止中文乱码
            
        print(f"Success! Updated {output_file} with {len(files)} files.")

if __name__ == "__main__":
    generate_indexes()
