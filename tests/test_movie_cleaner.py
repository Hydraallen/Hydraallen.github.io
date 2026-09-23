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


# --------------------------------------------------------------------------- #
# title_zh: Wikidata lookup (HTTP 全部 mock,测试不联网)
# --------------------------------------------------------------------------- #
import requests

from movie_cleaner import (
    fill_missing_title_zh,
    lookup_title_zh,
    pick_zh_label,
    strip_disambiguation,
)


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """任何未显式 mock 的 HTTP 调用都视为连接失败。"""

    def refuse(url, params):
        raise requests.ConnectionError("network disabled in tests")

    monkeypatch.setattr(movie_cleaner, "_http_get", refuse)


def fake_http(routes):
    """routes: [(predicate(url, params), payload)];按顺序匹配第一个。"""
    calls = []

    def get(url, params):
        calls.append((url, dict(params)))
        for pred, payload in routes:
            if pred(url, params):
                return payload
        raise AssertionError(f"unexpected request {url} {params}")

    get.calls = calls
    return get


def is_action(action, host="www.wikidata.org"):
    return lambda url, params: host in url and params.get("action") == action


def entity(qid, imdb="tt0000001", date="+2021-09-15T00:00:00Z", labels=None, zhwiki=None):
    claims = {}
    if imdb:
        claims["P345"] = [{"mainsnak": {"datavalue": {"value": imdb}}}]
    if date:
        claims["P577"] = [{"mainsnak": {"datavalue": {"value": {"time": date}}}}]
    ent = {
        "id": qid,
        "labels": {k: {"language": k, "value": v} for k, v in (labels or {}).items()},
        "claims": claims,
        "sitelinks": {},
    }
    if zhwiki:
        ent["sitelinks"]["zhwiki"] = {"site": "zhwiki", "title": zhwiki}
    return ent


def test_pick_zh_label_prefers_mainland_and_skips_latin():
    assert pick_zh_label({"zh": "甲乙", "zh-hans": "丙丁", "zh-cn": "戊己"}) == "戊己"
    assert pick_zh_label({"zh": "甲乙", "zh-hans": "丙丁"}) == "丙丁"
    assert pick_zh_label({"zh-cn": "Latin Only", "zh-hans": "丙丁"}) == "丙丁"
    assert pick_zh_label({"en": "Nope"}) is None


def test_pick_zh_label_uses_traditional_only_when_convertible(monkeypatch):
    monkeypatch.setattr(movie_cleaner, "_to_simplified", lambda s: None)
    assert pick_zh_label({"zh-tw": "電影"}) is None
    monkeypatch.setattr(movie_cleaner, "_to_simplified", lambda s: s.replace("電", "电"))
    assert pick_zh_label({"zh-tw": "電影"}) == "电影"


def test_strip_disambiguation():
    assert strip_disambiguation("沙丘 (2021年电影)") == "沙丘"
    assert strip_disambiguation("虚构片名（电影）") == "虚构片名"
    assert strip_disambiguation("第一滴血（1982）") == "第一滴血（1982）"
    assert strip_disambiguation("速度与激情9") == "速度与激情9"


def test_lookup_prefers_zhwiki_mainland_display_title(monkeypatch):
    http = fake_http([
        (is_action("wbsearchentities"), {"search": [{"id": "Q1"}, {"id": "Q2"}]}),
        (is_action("wbgetentities"), {"entities": {
            "Q1": entity("Q1", date="+1990-01-01T00:00:00Z", labels={"zh-cn": "旧片"}),
            "Q2": entity("Q2", labels={"zh": "虛構電影"}, zhwiki="虛構電影 (2021年電影)"),
        }}),
        (is_action("parse", "zh.wikipedia.org"),
         {"parse": {"displaytitle": "<span>虚构电影 (2021年电影)</span>"}}),
    ])
    monkeypatch.setattr(movie_cleaner, "_http_get", http)
    assert lookup_title_zh("Fictional Film", 2021) == "虚构电影"
    parse_params = [p for u, p in http.calls if p.get("action") == "parse"][0]
    assert parse_params["variant"] == "zh-cn"


def test_lookup_falls_back_to_labels_without_zhwiki(monkeypatch):
    http = fake_http([
        (is_action("wbsearchentities"), {"search": [{"id": "Q3"}]}),
        (is_action("wbgetentities"), {"entities": {
            "Q3": entity("Q3", date="+2020-02-01T00:00:00Z", labels={"zh-hans": "虚构片"}),
        }}),
    ])
    monkeypatch.setattr(movie_cleaner, "_http_get", http)
    assert lookup_title_zh("Fictional", 2021) == "虚构片"  # ±1 year tolerated


def test_lookup_rejects_items_without_imdb_or_wrong_year(monkeypatch):
    http = fake_http([
        (is_action("wbsearchentities"), {"search": [{"id": "Q4"}, {"id": "Q5"}]}),
        (is_action("wbgetentities"), {"entities": {
            "Q4": entity("Q4", imdb=None, labels={"zh-cn": "不是电影"}),
            "Q5": entity("Q5", date="+2010-01-01T00:00:00Z", labels={"zh-cn": "年份不对"}),
        }}),
    ])
    monkeypatch.setattr(movie_cleaner, "_http_get", http)
    assert lookup_title_zh("Fictional", 2021) is None


def test_lookup_returns_none_on_network_error():
    # autouse fixture makes every request fail
    assert lookup_title_zh("Fictional", 2021) is None


def test_lookup_returns_none_on_malformed_payload(monkeypatch):
    monkeypatch.setattr(movie_cleaner, "_http_get", lambda url, params: {"unexpected": True})
    assert lookup_title_zh("Fictional", 2021) is None


def test_fill_missing_title_zh_is_immutable_and_keeps_existing():
    movies = [
        {"title": "A", "title_zh": "已有"},
        {"title": "B"},
        {"title": "C"},
    ]
    seen = []

    def lookup(title, year):
        seen.append((title, year))
        return "乙" if title == "B" else None

    result = fill_missing_title_zh(movies, 2021, lookup)
    assert seen == [("B", 2021), ("C", 2021)]
    assert result == [
        {"title": "A", "title_zh": "已有"},
        {"title": "B", "title_zh": "乙"},
        {"title": "C"},  # 查不到则留空,等待手动补
    ]
    assert movies[1] == {"title": "B"}  # 输入未被修改


def test_save_data_fills_title_zh(tmp_path, monkeypatch):
    app = MovieCleanerApp.__new__(MovieCleanerApp)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(movie_cleaner, "BACKUP_FILE", str(tmp_path / "backup.json"))
    monkeypatch.setattr(movie_cleaner, "lookup_title_zh", lambda title, year: "虚构")

    app.current_filename = str(tmp_path / "2021.json")
    app.current_data = {"year": 2021, "movies": [{"title": "A"}]}
    app.current_movies = app.current_data["movies"]
    app.selected_year = 2021
    app.backup_data = []

    app.save_data()

    saved = json.loads((tmp_path / "2021.json").read_text(encoding="utf-8"))
    assert saved["movies"] == [{"title": "A", "title_zh": "虚构"}]
    assert app.current_movies == saved["movies"]
