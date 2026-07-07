"""movie_cleaner.py 的纯逻辑测试(GUI 部分不自动化)。"""
import json
import os

import pytest

import movie_cleaner
from movie_cleaner import (
    MovieCleanerApp,
    build_imdb_url,
    get_title,
    parse_year_files,
    atomic_write_json,
)


def test_build_imdb_url_encodes_spaces():
    url = build_imdb_url("The Matrix")
    assert "q=The%20Matrix" in url
    assert url.startswith("https://www.imdb.com/find?")


def test_build_imdb_url_encodes_special_chars():
    url = build_imdb_url("Amélie & Co")
    assert " " not in url
    assert "&" not in url.split("q=")[1]  # & 应被编码


def test_get_title_present():
    assert get_title({"title": "Inception"}) == "Inception"


def test_get_title_missing():
    assert get_title({}) == "Unknown"


def test_parse_year_files_extracts_years():
    files = ["1996.json", "2000.json", "index.json", "backup.json", "notes.txt"]
    result = parse_year_files(files)
    assert result == {1996: "1996.json", 2000: "2000.json"}


def test_parse_year_files_excludes_non_year():
    result = parse_year_files(["index.json", "backup.json", "abc.json"])
    assert result == {}


def test_atomic_write_json_produces_valid_json(tmp_path):
    target = tmp_path / "out.json"
    data = {"a": 1, "movies": [{"title": "X"}]}
    atomic_write_json(str(target), data)
    loaded = json.loads(target.read_text(encoding="utf-8"))
    assert loaded == data


def test_atomic_write_json_uses_os_replace(tmp_path, monkeypatch):
    target = tmp_path / "out.json"
    called = {}
    real_replace = os.replace

    def fake_replace(src, dst):
        called["src"] = src
        called["dst"] = dst
        real_replace(src, dst)

    monkeypatch.setattr(os, "replace", fake_replace)
    atomic_write_json(str(target), {"k": "v"})
    assert called["dst"] == str(target)
    assert called["src"].endswith(".tmp")


def test_save_data_atomic(tmp_path, monkeypatch):
    # 用 __new__ 造壳对象,不实例化 tk.Tk()
    app = MovieCleanerApp.__new__(MovieCleanerApp)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(movie_cleaner, "BACKUP_FILE", str(tmp_path / "backup.json"))

    app.current_filename = str(tmp_path / "1996.json")
    app.current_data = {"movies": [{"title": "A"}]}
    app.current_movies = [{"title": "A"}]
    app.backup_data = []

    app.save_data()

    saved = json.loads((tmp_path / "1996.json").read_text(encoding="utf-8"))
    assert saved["total_count"] == 1
    assert saved["saved_count"] == 1
    assert saved["movies"] == [{"title": "A"}]
