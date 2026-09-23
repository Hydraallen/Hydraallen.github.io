"""cv_sync_check 的单元测试。fixtures 全部为虚构数据 (fictional fixtures only).

experience.md is the single source; the tex CV only feeds advisories. The
real-source test runs only when CV_EXPERIENCE_MD or tools/cv_sources.local.json
is configured; otherwise it skips.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Callable

import pytest

import cv_sync_check as cs

_ROOT = Path(__file__).resolve().parent.parent
_FIXTURES = _ROOT / "tests" / "fixtures" / "cv"
_MD = (_FIXTURES / "experience.md").read_text(encoding="utf-8")
_TEX = (_FIXTURES / "cv.tex").read_text(encoding="utf-8")


def _copy_profile(tmp_path: Path) -> Path:
    dest = tmp_path / "profile"
    shutil.copytree(_FIXTURES / "profile", dest)
    return dest


def _mutate(profile_dir: Path, name: str, fn: Callable[[dict[str, Any]], None]) -> None:
    path = profile_dir / name
    doc = json.loads(path.read_text(encoding="utf-8"))
    fn(doc)
    path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")


def _issues(profile_dir: Path, md: str = _MD) -> list[cs.Issue]:
    return cs.check_profile(profile_dir, md)


# ---------------------------------------------------------------------------
# Normalization / 规范化
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_normalize_tex_unwraps_markup_and_symbols() -> None:
    text = cs.normalize_tex(_TEX)
    assert "Cut latency by 35% across 1,200 runs — reaching ~60% cache hits" in text
    assert "select_tools on 8×GPU; see Imaginary Gym, arXiv:0000.00001." in text
    assert "Zyxcorp — Imaginary Agent Intern" in text
    assert "Jun 2031 – Sep 2031" in text
    assert "Languages & Tools: Python, Go, LaTeX" in text


@pytest.mark.unit
def test_normalize_tex_skips_contact_lines_and_comments() -> None:
    text = cs.normalize_tex(_TEX)
    assert "Nowhere Street" not in text
    assert "nobody@example.invalid" not in text
    assert "trailing comment" not in text
    assert "Fictional fixture" not in text


@pytest.mark.unit
def test_normalize_tex_keeps_escaped_percent() -> None:
    assert cs.normalize_tex(r"cut \textbf{20\%} % note") == "cut 20%"


@pytest.mark.unit
def test_strip_md_prefix() -> None:
    assert cs.strip_md_prefix("1. 延迟优化：在 1,200 次运行中") == "在 1,200 次运行中"
    assert (
        cs.strip_md_prefix("2. 参与组织 Git、Bash 分享会。")
        == "参与组织 Git、Bash 分享会。"
    )
    # A colon far into the sentence is content, not a label. 句中冒号不是小标题。
    assert (
        cs.strip_md_prefix("3. 负责课程，协助老师：答疑") == "负责课程，协助老师：答疑"
    )
    assert cs.strip_md_prefix("普通一行：不变") == "普通一行：不变"


@pytest.mark.unit
def test_parse_md_sections_h2_includes_h3() -> None:
    sections = cs.parse_md_sections(_MD)
    assert "起止时间：2031.06-2031.09" in sections["实习经历/Zyxcorp"]
    assert "测试杯 H 奖" in sections["荣誉奖项与证书"]
    assert "测试杯荣誉奖" in sections["荣誉奖项与证书"]
    assert "测试杯 H 奖" not in sections["荣誉奖项与证书/奖项与荣誉"]


@pytest.mark.unit
@pytest.mark.parametrize(
    ("section", "expected"),
    [
        ("起止时间：2030.08-2032.05", ("2030-08", "2032-05")),
        ("起止时间：2029.01", ("2029-01", "2029-01")),
        ("起止时间：2024.01-至今", ("2024-01", None)),
        ("没有日期", None),
    ],
)
def test_parse_md_range(section: str, expected: tuple[str, str | None] | None) -> None:
    assert cs.parse_md_range(section) == expected


@pytest.mark.unit
def test_inline_diff_marks_changes() -> None:
    assert cs.inline_diff("abc", "abd") == "ab[-d-]{+c+}"


# ---------------------------------------------------------------------------
# check_profile on fixtures / 在虚构 fixture 上校验
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_clean_fixture_has_no_issues(tmp_path: Path) -> None:
    assert _issues(_copy_profile(tmp_path)) == []


@pytest.mark.unit
def test_detects_date_drift(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)
    _mutate(profile, "experience.json", lambda d: d["items"][0].update(end="2031-10"))
    issues = _issues(profile)
    assert [(i.entry_id, i.field) for i in issues] == [("zyxcorp", "end")]


@pytest.mark.unit
def test_detects_zh_text_drift_with_diff(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)
    _mutate(
        profile,
        "experience.json",
        lambda d: d["items"][0]["bullets"][0].update(
            zh="在 1,200 次运行中将延迟降低 36%。"
        ),
    )
    issues = _issues(profile)
    fields = {i.field for i in issues}
    assert "bullets[0].zh" in fields
    # The md bullet no longer has a site counterpart either. md 条目也找不到对应。
    assert "bullets(md)" in fields
    drift = next(i for i in issues if i.field == "bullets[0].zh")
    assert drift.source == "在 1,200 次运行中将延迟降低 35%。"


@pytest.mark.unit
def test_english_text_is_never_compared_with_tex(tmp_path: Path) -> None:
    # en is a translation of zh; only the zh side is checked. 英文只是译文，不校验。
    profile = _copy_profile(tmp_path)

    def change(doc: dict[str, Any]) -> None:
        doc["items"][0]["summary"]["en"] = "Anything goes here."
        doc["items"][0]["bullets"][0]["en"] = "Nowhere Street"

    _mutate(profile, "experience.json", change)
    assert _issues(profile) == []


@pytest.mark.unit
def test_detects_gpa_and_coursework_drift(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)

    def change(doc: dict[str, Any]) -> None:
        doc["items"][0]["gpa"] = "3.98/4.00"
        doc["items"][0]["coursework"][1]["zh"] = "真视觉"

    _mutate(profile, "education.json", change)
    assert sorted(i.field for i in _issues(profile)) == ["coursework[1].zh", "gpa"]


@pytest.mark.unit
def test_missing_md_bullet_is_reported(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)
    _mutate(profile, "experience.json", lambda d: d["items"][0]["bullets"].pop(1))
    issues = _issues(profile)
    assert [(i.field, i.source) for i in issues] == [
        ("bullets(md)", "命中率达到 60%，并公开了示例")
    ]


@pytest.mark.unit
def test_unknown_cv_ref_is_reported(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)
    _mutate(
        profile,
        "experience.json",
        lambda d: d["items"][0].update(cv_ref="实习经历/Nope"),
    )
    issues = _issues(profile)
    assert [(i.field, i.message) for i in issues] == [
        ("cv_ref", "section not found in experience.md")
    ]


@pytest.mark.unit
def test_publication_identifiers_checked(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)

    def change(doc: dict[str, Any]) -> None:
        pub = doc["items"][0]
        pub.update(
            doi="10.0000/fixture-2",
            arxiv="0000.00002",
            date="2031-12",
            title="Imaginary Gym 2",
        )

    _mutate(profile, "publications.json", change)
    assert sorted(i.field for i in _issues(profile)) == [
        "arxiv",
        "date",
        "doi",
        "title",
    ]


@pytest.mark.unit
def test_arxiv_id_may_appear_as_url(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)
    md = _MD.replace("arXiv:0000.00001", "链接：https://arxiv.org/abs/0000.00001")
    assert _issues(profile, md=md) == []


@pytest.mark.unit
def test_award_title_and_date_checked(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)

    def change(doc: dict[str, Any]) -> None:
        doc["items"][0]["date"] = "2030-06"
        doc["items"][1]["title"]["zh"] = "测试杯 A 奖"

    _mutate(profile, "awards.json", change)
    assert sorted((i.entry_id, i.field) for i in _issues(profile)) == [
        ("fixture-cup", "date"),
        ("fixture-cup-short", "title.zh"),
    ]


@pytest.mark.unit
def test_tex_roles_reads_subsection_headers_only() -> None:
    tex = _TEX + "\n\\begin{cvsubsection}{Nowhere University}{}{2030}\n"
    assert cs.tex_roles(tex) == {"Zyxcorp": "Imaginary Agent Intern"}


@pytest.mark.unit
def test_tex_advisories_flag_role_titles_only(tmp_path: Path) -> None:
    profile = _copy_profile(tmp_path)
    assert cs.tex_advisories(profile, _TEX) == []
    _mutate(
        profile,
        "experience.json",
        lambda d: d["items"][0]["role"].update(en="Pretend Agent Intern"),
    )
    advisories = cs.tex_advisories(profile, _TEX)
    assert [(a.entry_id, a.field) for a in advisories] == [("zyxcorp", "role.en")]
    # An org the tex does not mention is never flagged. tex 未提及的单位不提示。
    _mutate(profile, "experience.json", lambda d: d["items"][0]["org"].update(en="Qux"))
    assert cs.tex_advisories(profile, _TEX) == []


# ---------------------------------------------------------------------------
# Source resolution & CLI / 数据源解析与命令行
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_resolve_sources_prefers_env_and_tex_is_optional(tmp_path: Path) -> None:
    config = tmp_path / "cv_sources.local.json"
    config.write_text(
        json.dumps({"experience_md": "/cfg/a.md", "tex": "/cfg/a.tex"}),
        encoding="utf-8",
    )
    env = {"CV_EXPERIENCE_MD": "/env/b.md", "CV_TEX": "/env/b.tex"}
    assert cs.resolve_sources(env, config) == cs.Sources(
        Path("/env/b.md"), Path("/env/b.tex")
    )
    assert cs.resolve_sources({"CV_EXPERIENCE_MD": "/env/b.md"}, config) == cs.Sources(
        Path("/env/b.md"), None
    )
    assert cs.resolve_sources({}, config) == cs.Sources(
        Path("/cfg/a.md"), Path("/cfg/a.tex")
    )
    config.write_text(json.dumps({"experience_md": "/cfg/a.md"}), encoding="utf-8")
    assert cs.resolve_sources({}, config) == cs.Sources(Path("/cfg/a.md"), None)
    assert cs.resolve_sources({}, tmp_path / "missing.json") is None
    assert (
        cs.resolve_sources({"CV_TEX": "/env/b.tex"}, tmp_path / "missing.json") is None
    )


@pytest.mark.unit
def test_resolve_sources_rejects_malformed_config(tmp_path: Path) -> None:
    config = tmp_path / "cv_sources.local.json"
    config.write_text("{not json", encoding="utf-8")
    with pytest.raises(cs.ConfigError):
        cs.resolve_sources({}, config)


@pytest.mark.unit
def test_cli_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    profile = _copy_profile(tmp_path)
    md = str(_FIXTURES / "experience.md")
    assert cs.main(["--md", md, "--profile-dir", str(profile)]) == 0
    assert "cv_sync_check: OK" in capsys.readouterr().out

    _mutate(profile, "experience.json", lambda d: d["items"][0].update(start="2031-05"))
    assert cs.main(["--md", md, "--profile-dir", str(profile)]) == 1
    out = capsys.readouterr().out
    assert "experience.json#zyxcorp start" in out
    assert "1 issue(s)" in out

    missing = str(tmp_path / "nope.md")
    assert cs.main(["--md", missing, "--profile-dir", str(profile)]) == 2


@pytest.mark.unit
def test_cli_advisories_never_fail(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    profile = _copy_profile(tmp_path)
    md, tex = str(_FIXTURES / "experience.md"), str(_FIXTURES / "cv.tex")
    _mutate(
        profile,
        "experience.json",
        lambda d: d["items"][0]["role"].update(en="Pretend Agent Intern"),
    )
    assert cs.main(["--md", md, "--tex", tex, "--profile-dir", str(profile)]) == 0
    out = capsys.readouterr().out
    assert "advisory: experience.json#zyxcorp role.en" in out
    assert "cv_sync_check: OK" in out


@pytest.mark.unit
def test_cli_without_sources_exits_2(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CV_EXPERIENCE_MD", raising=False)
    monkeypatch.delenv("CV_TEX", raising=False)
    assert cs.main(["--config", str(tmp_path / "missing.json")]) == 2


# ---------------------------------------------------------------------------
# Real sources (local only) / 真实数据源（仅本地）
# ---------------------------------------------------------------------------
@pytest.mark.integration
def test_site_profile_matches_real_cv_sources() -> None:
    import os

    try:
        sources = cs.resolve_sources(os.environ, cs.DEFAULT_CONFIG)
    except cs.ConfigError as exc:
        pytest.fail(f"bad local config: {exc}")
    if sources is None or not sources.experience_md.is_file():
        pytest.skip(
            "CV sources not configured (set CV_EXPERIENCE_MD or tools/cv_sources.local.json)"
        )
    md = sources.experience_md.read_text(encoding="utf-8")
    issues = cs.check_profile(_ROOT / "data" / "profile", md)
    assert [cs.format_issue(i) for i in issues] == []
