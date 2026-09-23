"""pytest 配置:把被测脚本所在目录加入 sys.path,便于直接 import。"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# code_quality.py 在仓库根;generate_index.py 在 data/;movie_cleaner.py 在 data/movies/;
# privacy_guard.py / cv_sync_check.py 在 tools/
for _p in (
    _ROOT,
    os.path.join(_ROOT, "data"),
    os.path.join(_ROOT, "data", "movies"),
    os.path.join(_ROOT, "tools"),
):
    if _p not in sys.path:
        sys.path.insert(0, _p)


def pytest_configure(config):  # type: ignore[no-untyped-def]
    """注册自定义 marker,避免 PytestUnknownMarkWarning。"""
    config.addinivalue_line("markers", "unit: fast, isolated unit tests")
    config.addinivalue_line("markers", "integration: tests touching the real repo/files")
