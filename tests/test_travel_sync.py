"""travel_sync_check 的单元测试。fixtures 全部为虚构数据 (fictional fixtures only).

The LifeChecklist snapshot owns name/country/state/continent/status/dates/
coordinates; this repo owns cover/photos/trip/video. The real-source test runs
only when LIFECHECKLIST_TRAVEL_SNAPSHOT or tools/travel_sources.local.json is
configured; otherwise it skips.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Callable

import pytest

import travel_sync_check as ts

_ROOT = Path(__file__).resolve().parent.parent
_FIXTURES = _ROOT / "tests" / "fixtures" / "travel"
_SNAPSHOT = _FIXTURES / "snapshot.json"


def _copy_places(tmp_path: Path) -> Path:
    dest = tmp_path / "travel"
    shutil.copytree(_FIXTURES / "places", dest)
    return dest


def _snapshot_places() -> list[dict[str, Any]]:
    return ts.load_snapshot(_SNAPSHOT)


def _mutate(
    travel_dir: Path, place_id: str, fn: Callable[[dict[str, Any]], None]
) -> None:
    path = travel_dir / f"{place_id}.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    fn(doc)
    path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")


def _write_snapshot(tmp_path: Path, places: list[dict[str, Any]]) -> Path:
    path = tmp_path / "snapshot.json"
    path.write_text(
        json.dumps({"schema": 1, "places": places}, ensure_ascii=False),
        encoding="utf-8",
    )
    return path


# ---------------------------------------------------------------------------
# Snapshot loading / 快照读取
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_load_snapshot_reads_places() -> None:
    places = _snapshot_places()
    assert [p["id"] for p in places] == ["cloud_harbor", "mirror_lake"]


@pytest.mark.unit
@pytest.mark.parametrize(
    "doc, needle",
    [
        ({"schema": 2, "places": []}, "schema"),
        ({"schema": 1}, "places"),
        ({"schema": 1, "places": [{"id": "x", "cover": "a.jpg"}]}, "unexpected keys"),
        ({"schema": 1, "places": [{"name": {"en": "A", "zh": "甲"}}]}, "id"),
        ({"schema": 1, "places": [{"id": "a"}, {"id": "a"}]}, "duplicate"),
    ],
)
def test_load_snapshot_rejects_bad_documents(
    tmp_path: Path, doc: dict[str, Any], needle: str
) -> None:
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ts.SnapshotError, match=needle):
        ts.load_snapshot(path)


@pytest.mark.unit
def test_load_snapshot_rejects_invalid_json(tmp_path: Path) -> None:
    path = tmp_path / "bad.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(ts.SnapshotError):
        ts.load_snapshot(path)


# ---------------------------------------------------------------------------
# Comparison / 比对
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_clean_fixture_is_in_sync(tmp_path: Path) -> None:
    report = ts.check_travel(_snapshot_places(), _copy_places(tmp_path))
    assert report.mismatches == []
    assert report.missing == []
    assert report.orphans == []
    assert report.ok


@pytest.mark.unit
@pytest.mark.parametrize(
    "field, fn",
    [
        ("name", lambda d: d["name"].update(zh="云湾")),
        ("country_code", lambda d: d.update(country_code="CA")),
        ("state", lambda d: d.update(state="OR")),
        ("continent", lambda d: d.update(continent="asia")),
        ("status", lambda d: d.update(status="idea")),
        ("date", lambda d: d.update(date="2031-05-31")),
        ("date_end", lambda d: d.update(date_end=None)),
        ("coordinates", lambda d: d.update(coordinates=[47.1236, -122.5678])),
    ],
)
def test_detects_owned_field_drift(
    tmp_path: Path, field: str, fn: Callable[[dict[str, Any]], None]
) -> None:
    travel = _copy_places(tmp_path)
    _mutate(travel, "cloud_harbor", fn)
    report = ts.check_travel(_snapshot_places(), travel)
    assert [(m.place_id, m.field) for m in report.mismatches] == [
        ("cloud_harbor", field)
    ]
    assert not report.ok


@pytest.mark.unit
def test_state_present_only_on_one_side_is_a_mismatch(tmp_path: Path) -> None:
    travel = _copy_places(tmp_path)
    _mutate(travel, "mirror_lake", lambda d: d.update(state="WA"))
    report = ts.check_travel(_snapshot_places(), travel)
    assert [(m.place_id, m.field) for m in report.mismatches] == [
        ("mirror_lake", "state")
    ]


@pytest.mark.unit
def test_public_owned_fields_are_ignored(tmp_path: Path) -> None:
    travel = _copy_places(tmp_path)
    _mutate(
        travel,
        "cloud_harbor",
        lambda d: d.update(
            cover="other.jpg", video="https://example.com/v", trip="t", photos=["p.jpg"]
        ),
    )
    assert ts.check_travel(_snapshot_places(), travel).ok


@pytest.mark.unit
@pytest.mark.parametrize(
    "public, snapshot, same",
    [
        (47.12341234, 47.1234, True),
        (47.12345, 47.1235, True),
        (47.1234, 47.1235, False),
        (-122.56779999, -122.5678, True),
    ],
)
def test_coordinates_compare_at_4dp(public: float, snapshot: float, same: bool) -> None:
    assert ts.coords_match([public, 0.0], [snapshot, 0.0]) is same


@pytest.mark.unit
def test_coordinates_must_be_pairs() -> None:
    assert ts.coords_match([1.0], [1.0, 2.0]) is False
    assert ts.coords_match(None, [1.0, 2.0]) is False


@pytest.mark.unit
def test_missing_public_place_is_reported(tmp_path: Path) -> None:
    travel = _copy_places(tmp_path)
    (travel / "mirror_lake.json").unlink()
    report = ts.check_travel(_snapshot_places(), travel)
    assert report.missing == ["mirror_lake"]
    assert not report.ok


@pytest.mark.unit
def test_orphans_are_warnings_only(tmp_path: Path) -> None:
    travel = _copy_places(tmp_path)
    shutil.copy(travel / "mirror_lake.json", travel / "quiet_valley.json")
    _mutate(travel, "quiet_valley", lambda d: d.update(id="quiet_valley"))
    report = ts.check_travel(_snapshot_places(), travel)
    assert report.orphans == ["quiet_valley"]
    assert report.ok


@pytest.mark.unit
def test_manifest_files_are_not_places(tmp_path: Path) -> None:
    travel = _copy_places(tmp_path)
    (travel / "backup.json").write_text("[]", encoding="utf-8")
    report = ts.check_travel(_snapshot_places(), travel)
    assert report.orphans == []


# ---------------------------------------------------------------------------
# Source resolution & CLI / 数据源解析与命令行
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_resolve_snapshot_prefers_env_then_config(tmp_path: Path) -> None:
    config = tmp_path / "travel_sources.local.json"
    config.write_text(json.dumps({"snapshot": "/cfg/s.json"}), encoding="utf-8")
    env = {"LIFECHECKLIST_TRAVEL_SNAPSHOT": "/env/s.json"}
    assert ts.resolve_snapshot(env, config) == Path("/env/s.json")
    assert ts.resolve_snapshot({}, config) == Path("/cfg/s.json")
    assert ts.resolve_snapshot({}, tmp_path / "missing.json") is None


@pytest.mark.unit
@pytest.mark.parametrize("content", ["{not json", json.dumps({"other": 1})])
def test_resolve_snapshot_rejects_malformed_config(
    tmp_path: Path, content: str
) -> None:
    config = tmp_path / "travel_sources.local.json"
    config.write_text(content, encoding="utf-8")
    with pytest.raises(ts.ConfigError):
        ts.resolve_snapshot({}, config)


@pytest.mark.unit
def test_cli_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    travel = _copy_places(tmp_path)
    args = ["--snapshot", str(_SNAPSHOT), "--travel-dir", str(travel)]
    assert ts.main(args) == 0
    assert "travel_sync_check: OK" in capsys.readouterr().out

    _mutate(travel, "cloud_harbor", lambda d: d.update(date="2031-05-31"))
    assert ts.main(args) == 1
    out = capsys.readouterr().out
    assert "cloud_harbor date" in out
    assert "2031-05-31" in out and "2031-06-01" in out
    assert "1 issue(s)" in out

    missing = ["--snapshot", str(tmp_path / "nope.json"), "--travel-dir", str(travel)]
    assert ts.main(missing) == 2


@pytest.mark.unit
def test_cli_reports_missing_and_warns_on_orphans(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    travel = _copy_places(tmp_path)
    places = _snapshot_places()
    snapshot = _write_snapshot(tmp_path, [places[0]])
    assert ts.main(["--snapshot", str(snapshot), "--travel-dir", str(travel)]) == 0
    out = capsys.readouterr().out
    assert "warning: mirror_lake.json is not in the snapshot" in out

    extra = {**places[1], "id": "quiet_valley"}
    snapshot = _write_snapshot(tmp_path, [*places, extra])
    assert ts.main(["--snapshot", str(snapshot), "--travel-dir", str(travel)]) == 1
    assert (
        "quiet_valley: in the snapshot but data/travel/quiet_valley.json is missing"
        in (capsys.readouterr().out)
    )


@pytest.mark.unit
def test_cli_invalid_snapshot_exits_2(tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"schema": 9, "places": []}), encoding="utf-8")
    assert ts.main(["--snapshot", str(bad), "--travel-dir", str(tmp_path)]) == 2


@pytest.mark.unit
def test_cli_without_sources_exits_2(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("LIFECHECKLIST_TRAVEL_SNAPSHOT", raising=False)
    assert ts.main(["--config", str(tmp_path / "missing.json")]) == 2


# ---------------------------------------------------------------------------
# Real source (local only) / 真实数据源（仅本地）
# ---------------------------------------------------------------------------
@pytest.mark.integration
def test_site_travel_matches_real_snapshot() -> None:
    import os

    try:
        snapshot = ts.resolve_snapshot(os.environ, ts.DEFAULT_CONFIG)
    except ts.ConfigError as exc:
        pytest.fail(f"bad local config: {exc}")
    if snapshot is None or not snapshot.is_file():
        pytest.skip(
            "travel snapshot not configured (set LIFECHECKLIST_TRAVEL_SNAPSHOT "
            "or tools/travel_sources.local.json)"
        )
    report = ts.check_travel(ts.load_snapshot(snapshot), ts.DEFAULT_TRAVEL_DIR)
    assert [ts.format_mismatch(m) for m in report.mismatches] == []
    assert report.missing == []
