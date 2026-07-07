"""修复 HTML/JS 文件中 void 标签的自闭合写法(例如 <br/> -> <br>)。"""
import logging
import os
import re
import sys
from typing import Tuple

logger = logging.getLogger(__name__)

# HTML void 元素:不需要(也不应)自闭合
VOID_TAGS = [
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
]

# 扫描时需要排除的目录
EXCLUDED_DIRS = {".git", "node_modules", "dist"}


def fix_content(content: str) -> Tuple[str, int]:
    """把 void 标签的自闭合 `<tag/>` 修正为 `<tag>`。

    返回 (新内容, 修复次数)。
    """
    tags_pattern = "|".join(VOID_TAGS)
    # 注意:`(?:...)` 是非捕获组;之前误写成 `(?::...)` 导致只有 area 分支
    # 需要前置冒号,从而永远匹配不到 <area/>。
    pattern = rf"(<(?:{tags_pattern})\b[^>]*?)\s*/>"
    return re.subn(pattern, r"\1>", content, flags=re.IGNORECASE | re.DOTALL)


def process_directory(root_dir: str) -> Tuple[int, int]:
    """遍历目录并修复所有 .html/.js 文件。

    返回 (修复的文件数, 修复的标签总数)。
    """
    total_fixed_files = 0
    total_fixed_tags = 0

    logger.info("Scanning directory: %s", os.path.abspath(root_dir))

    for root, dirs, files in os.walk(root_dir):
        # 原地过滤掉需要排除的目录,阻止 os.walk 继续深入
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]

        for file in files:
            if not file.lower().endswith((".html", ".js")):
                continue

            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                new_content, count = fix_content(content)

                if count > 0:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    logger.info("Fixed %d tags in: %s", count, file_path)
                    total_fixed_files += 1
                    total_fixed_tags += count
            except OSError:
                logger.exception("Error processing %s", file_path)

    logger.info("-" * 30)
    logger.info(
        "Completed. Fixed %d tags across %d files.",
        total_fixed_tags,
        total_fixed_files,
    )
    return total_fixed_files, total_fixed_tags


def main() -> int:
    """命令行入口:成功返回 0,遇到 I/O 错误返回 1。"""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        process_directory(".")
    except OSError:
        logger.exception("Fatal error while processing directory")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
