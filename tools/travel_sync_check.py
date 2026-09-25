"""旅行同步检查:校验 data/travel/*.json 与 LifeChecklist 导出的快照一致。

LifeChecklist (private) is the source of truth for the travel fields it owns;
this repo owns everything else (cover, photos, trip, video). The exporter there
writes a snapshot already in this site's vocabulary:

    {"schema": 1, "places": [{"id", "name": {"en", "zh"}, "country_code",
     "state"? (US only), "continent", "status": "idea"|"visited",
     "date", "date_end", "coordinates": [lat, lon]}]}

Per snapshot place, ``data/travel/<id>.json`` must exist and match every owned
field (coordinates within 4 decimal places). Public places absent from the
snapshot are orphans: reported as warnings, never a failure.

Sources (first match wins): ``--snapshot`` > env ``LIFECHECKLIST_TRAVEL_SNAPSHOT``
> ``tools/travel_sources.local.json`` (gitignored: ``{"snapshot": ...}``).

Usage:
    python tools/travel_sync_check.py [--snapshot PATH] [--travel-dir DIR]
Exit codes: 0 in sync (orphan warnings allowed), 1 mismatches or missing places,
2 snapshot missing/unreadable/invalid.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = Path(__file__).resolve().parent / "travel_sources.local.json"
DEFAULT_TRAVEL_DIR = _ROOT / "data" / "travel"
ENV_VAR = "LIFECHECKLIST_TRAVEL_SNAPSHOT"

SCHEMA_VERSION = 1
# Fields LifeChecklist owns, in the order they are reported.
OWNED_FIELDS = (
    "name",
    "country_code",
    "state",
    "continent",
    "status",
    "date",
    "date_end",
    "coordinates",
)
SNAPSHOT_KEYS = frozenset(("id", *OWNED_FIELDS))
MANIFEST_FILES = frozenset(("index.json", "backup.json"))
# Snapshot coordinates are rounded to 4 dp; allow half a unit plus float noise.
COORD_TOLERANCE = 0.5e-4 + 1e-9


class ConfigError(Exception):
    """tools/travel_sources.local.json exists but cannot be used."""


class SnapshotError(Exception):
    """The snapshot file cannot be read or breaks the schema contract."""


@dataclass(frozen=True)
class Mismatch:
    """One owned field that differs between the site and the snapshot."""

    place_id: str
    field: str
    site: Any
    snapshot: Any


@dataclass(frozen=True)
class Report:
    mismatches: list[Mismatch]
    missing: list[str]  # in the snapshot, no public file
    orphans: list[str]  # public file, not in the snapshot (warning only)

    @property
    def ok(self) -> bool:
        return not self.mismatches and not self.missing


# ---------------------------------------------------------------------------
# Loading / 读取
# ---------------------------------------------------------------------------
def _validate_place(place: Any, index: int) -> str:
    """Return the place id, or raise SnapshotError describing the problem."""
    where = f"places[{index}]"
    if not isinstance(place, dict):
        raise SnapshotError(f"{where}: expected an object")
    place_id = place.get("id")
    if not isinstance(place_id, str) or not place_id:
        raise SnapshotError(f"{where}: missing id")
    extra = sorted(set(place) - SNAPSHOT_KEYS)
    if extra:
        raise SnapshotError(f"{where} ({place_id}): unexpected keys {', '.join(extra)}")
    return place_id


def load_snapshot(path: Path) -> list[dict[str, Any]]:
    """Read and validate a snapshot; returns its places."""
    try:
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SnapshotError(f"{path}: {exc}") from exc
    if not isinstance(doc, dict) or doc.get("schema") != SCHEMA_VERSION:
        raise SnapshotError(f"{path}: expected schema {SCHEMA_VERSION}")
    places = doc.get("places")
    if not isinstance(places, list):
        raise SnapshotError(f"{path}: places must be a list")
    seen: set[str] = set()
    for index, place in enumerate(places):
        place_id = _validate_place(place, index)
        if place_id in seen:
            raise SnapshotError(f"{path}: duplicate id {place_id}")
        seen.add(place_id)
    return places


def load_public(travel_dir: Path) -> dict[str, dict[str, Any]]:
    """Map file stem -> place for every place file in `travel_dir`."""
    return {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(Path(travel_dir).glob("*.json"))
        if path.name not in MANIFEST_FILES
    }


# ---------------------------------------------------------------------------
# Comparison / 比对
# ---------------------------------------------------------------------------
def coords_match(site: Any, snapshot: Any) -> bool:
    """True when both are [lat, lon] pairs equal within 4 decimal places."""
    pairs = (site, snapshot)
    if not all(isinstance(p, (list, tuple)) and len(p) == 2 for p in pairs):
        return False
    return all(
        abs(float(a) - float(b)) <= COORD_TOLERANCE for a, b in zip(site, snapshot)
    )


def compare_place(
    snapshot: Mapping[str, Any], site: Mapping[str, Any]
) -> list[Mismatch]:
    """Owned-field differences for one place; `state` absent on both sides is equal."""
    mismatches = []
    for field in OWNED_FIELDS:
        want, have = snapshot.get(field), site.get(field)
        same = coords_match(have, want) if field == "coordinates" else have == want
        if not same:
            mismatches.append(Mismatch(str(snapshot["id"]), field, have, want))
    return mismatches


def check_travel(
    snapshot_places: Sequence[Mapping[str, Any]], travel_dir: Path
) -> Report:
    public = load_public(travel_dir)
    snapshot_ids = {str(p["id"]) for p in snapshot_places}
    mismatches: list[Mismatch] = []
    missing: list[str] = []
    for place in snapshot_places:
        site = public.get(str(place["id"]))
        if site is None:
            missing.append(str(place["id"]))
        else:
            mismatches += compare_place(place, site)
    orphans = sorted(set(public) - snapshot_ids)
    return Report(mismatches, missing, orphans)


# ---------------------------------------------------------------------------
# Sources & CLI / 数据源与命令行
# ---------------------------------------------------------------------------
def resolve_snapshot(env: Mapping[str, str], config_path: Path) -> Path | None:
    """env LIFECHECKLIST_TRAVEL_SNAPSHOT, else the local JSON config, else None."""
    from_env = env.get(ENV_VAR)
    if from_env:
        return Path(from_env)
    if not config_path.is_file():
        return None
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"{config_path}: {exc}") from exc
    if not isinstance(config, dict) or not config.get("snapshot"):
        raise ConfigError(f"{config_path}: needs key snapshot")
    return Path(config["snapshot"])


def _show(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def format_mismatch(m: Mismatch) -> str:
    return "\n".join(
        (
            f"{m.place_id} {m.field}: differs from LifeChecklist",
            f"    site:     {_show(m.site)}",
            f"    snapshot: {_show(m.snapshot)}",
        )
    )


def _emit(text: str) -> None:
    sys.stdout.write(text + "\n")


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check data/travel against a LifeChecklist travel snapshot."
    )
    parser.add_argument("--snapshot", type=Path, help="snapshot JSON (schema 1)")
    parser.add_argument("--travel-dir", type=Path, default=DEFAULT_TRAVEL_DIR)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    return parser.parse_args(list(argv))


def _load(args: argparse.Namespace) -> list[dict[str, Any]] | str:
    """Snapshot places, or an error message for exit code 2."""
    try:
        path = args.snapshot or resolve_snapshot(os.environ, args.config)
    except ConfigError as exc:
        return str(exc)
    if path is None:
        return (
            f"snapshot not configured (use --snapshot, {ENV_VAR}, "
            "or tools/travel_sources.local.json)"
        )
    try:
        return load_snapshot(path)
    except SnapshotError as exc:
        return str(exc)


def main(argv: Sequence[str]) -> int:
    args = _parse_args(argv)
    loaded = _load(args)
    if isinstance(loaded, str):
        _emit(f"travel_sync_check: {loaded}")
        return 2
    report = check_travel(loaded, args.travel_dir)
    for orphan in report.orphans:
        _emit(f"warning: {orphan}.json is not in the snapshot")
    for place_id in report.missing:
        _emit(f"{place_id}: in the snapshot but data/travel/{place_id}.json is missing")
    for mismatch in report.mismatches:
        _emit(format_mismatch(mismatch))
    if not report.ok:
        count = len(report.mismatches) + len(report.missing)
        _emit(f"travel_sync_check: {count} issue(s)")
        return 1
    _emit("travel_sync_check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
