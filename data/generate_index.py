"""为指定文件夹生成 index.json,收录其中的年份/条目 JSON 文件名(去扩展名)。"""
import json
import logging
import os
import sys
from typing import List

logger = logging.getLogger(__name__)

TARGET_FOLDERS = ["./movies", "./travel"]
EXCLUDED_FILES = {"index.json", "backup.json"}
_JSON_SUFFIX = ".json"


def generate_index(folder: str, reverse: bool = False) -> None:
    """扫描 `folder` 下的 .json 文件并写出 index.json。

    - 只收录常规文件(排除子目录),排除 index.json / backup.json。
    - 仅去掉末尾一个 .json 扩展名(`2020.json.json` -> `2020.json`)。
    - reverse=True 时降序(年份从大到小),否则升序。
    """
    if not os.path.isdir(folder):
        logger.warning("Folder '%s' not found.", folder)
        return

    files: List[str] = []
    for filename in os.listdir(folder):
        full_path = os.path.join(folder, filename)
        if not os.path.isfile(full_path):
            continue  # 跳过子目录(即使名为 sub.json)
        if not filename.endswith(_JSON_SUFFIX):
            continue
        if filename in EXCLUDED_FILES:
            continue
        # 仅去掉末尾的 .json,避免 str.replace 误删中间出现的 '.json'
        files.append(filename[: -len(_JSON_SUFFIX)])

    files.sort(reverse=reverse)

    output_file = os.path.join(folder, "index.json")
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(files, f, indent=2, ensure_ascii=False)
    except OSError:
        logger.exception("Failed to write %s", output_file)
        return

    logger.info("Success! Updated %s with %d files.", output_file, len(files))


def generate_indexes() -> None:
    """对默认目录批量生成索引:movies 降序,其它升序。"""
    for folder in TARGET_FOLDERS:
        generate_index(folder, reverse=(folder == "./movies"))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    generate_indexes()
    sys.exit(0)
