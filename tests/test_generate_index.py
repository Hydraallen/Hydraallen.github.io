"""generate_index.py 的测试:生成 index.json。"""
import json
import os

from generate_index import generate_index


def _write(folder, name, data=None):
    with open(os.path.join(folder, name), "w", encoding="utf-8") as f:
        json.dump(data if data is not None else {}, f)


def test_double_extension_stem(tmp_path):
    # '2020.json.json' 的 stem 应是 '2020.json' 而不是 '2020'
    _write(str(tmp_path), "2020.json.json")
    generate_index(str(tmp_path))
    result = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert "2020.json" in result
    assert "2020" not in result


def test_subdirectory_excluded(tmp_path):
    # 子目录 sub.json 不应被收录
    (tmp_path / "sub.json").mkdir()
    _write(str(tmp_path), "1996.json")
    generate_index(str(tmp_path))
    result = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert "sub" not in result
    assert "1996" in result


def test_index_and_backup_excluded(tmp_path):
    _write(str(tmp_path), "index.json", [])
    _write(str(tmp_path), "backup.json")
    _write(str(tmp_path), "2001.json")
    generate_index(str(tmp_path))
    result = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert "index" not in result
    assert "backup" not in result
    assert result == ["2001"]


def test_descending_sort(tmp_path):
    for y in ("1996", "2000", "1998"):
        _write(str(tmp_path), f"{y}.json")
    generate_index(str(tmp_path), reverse=True)
    result = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert result == ["2000", "1998", "1996"]


def test_ascending_sort(tmp_path):
    for name in ("paris", "amsterdam", "tokyo"):
        _write(str(tmp_path), f"{name}.json")
    generate_index(str(tmp_path), reverse=False)
    result = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert result == ["amsterdam", "paris", "tokyo"]
