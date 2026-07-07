"""pytest 配置:把被测脚本所在目录加入 sys.path,便于直接 import。"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# code_quality.py 在仓库根;generate_index.py 在 data/;movie_cleaner.py 在 data/movies/
for _p in (_ROOT, os.path.join(_ROOT, "data"), os.path.join(_ROOT, "data", "movies")):
    if _p not in sys.path:
        sys.path.insert(0, _p)
