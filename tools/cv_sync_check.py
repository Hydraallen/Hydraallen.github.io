"""CV 同步检查:校验 data/profile/*.json 与简历源文件 (experience.md / .tex) 一致。

Checks the site's profile data against the owner's CV sources, which live
outside the repository and are never committed:

* ``experience.md`` is the single source (headings ``## 分区`` / ``### 条目``);
  every English text on the site is a translation of its Chinese text.
* the English LaTeX CV is optional and only feeds an advisory terminology report
  (normalized: ``\\textbf{x}`` -> ``x``, ``$\\sim$`` -> ``~``, ``---`` -> ``—`` ...;
  ``\\address`` / ``\\contacts`` skipped). Advisories never fail the check.

Per entry (matched by ``cv_ref`` = ``"分区"`` or ``"分区/条目"``):

* start/end vs ``起止时间``; education GPA vs ``GPA x/y``
* zh of role/title/summary/bullets/coursework/minors is a substring of the md
  section (after stripping ``N. 小标题：`` prefixes)
* every numbered md bullet appears as a site bullet (nothing silently dropped)
* publications: title, arXiv id, DOI and ``发布时间``; awards: title and ``YYYY年MM月``
* advisory (with tex): an experience/research/activities role whose org is named
  in the tex should use the tex role title

Sources (first match wins): ``--md [--tex]`` > env ``CV_EXPERIENCE_MD`` [``CV_TEX``]
> ``tools/cv_sources.local.json`` (gitignored: ``{"experience_md": ..., "tex"?: ...}``).

Usage:
    python tools/cv_sync_check.py [--md PATH [--tex PATH]] [--profile-dir DIR]
Exit codes: 0 in sync, 1 issues found, 2 sources missing/unreadable (advisories never change it).
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, Mapping, Sequence

_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = Path(__file__).resolve().parent / "cv_sources.local.json"
DEFAULT_PROFILE_DIR = _ROOT / "data" / "profile"

ENTRY_FILES = ("experience.json", "research.json", "activities.json")
DATED_FILES = (*ENTRY_FILES, "education.json")
ZH_FIELDS = ("role", "title", "summary", "bullets", "coursework", "minors")

_MD_PREFIX = re.compile(r"^\s*(?:[-*]\s+)?\d+\.\s*(?:[^：:\n，。；,;]{1,20}：)?")
_MD_NUMBERED = re.compile(r"^\s*\d+\.\s+")
_URL = re.compile(r"\s*https?://\S+")
_RANGE = re.compile(
    r"起止时间：\s*(\d{4})\.(\d{2})(?:\s*-\s*(?:(\d{4})\.(\d{2})|(至今)))?"
)
_GPA = re.compile(r"GPA\s*(\d\.\d{2,3}/\d\.\d{2,3})")
_PUB_DATE = re.compile(r"发布时间：\s*(\d{4}-\d{2})")
_WS = re.compile(r"\s+")

# (pattern, replacement) applied in order after comments/contact lines are gone.
_TEX_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\{,\}"), ","),
    (re.compile(r"\$\\sim\$"), "~"),
    (re.compile(r"\$\\times\$"), "×"),
    (re.compile(r"\\href\{[^{}]*\}\{([^{}]*)\}"), r"\1"),
    (re.compile(r"\\(?:textbf|texttt|textit|emph|textnormal)\{([^{}]*)\}"), r"\1"),
    (re.compile(r"\\%"), "%"),
    (re.compile(r"\\&"), "&"),
    (re.compile(r"\\_"), "_"),
    (re.compile(r"\\LaTeX\b"), "LaTeX"),
    (re.compile(r"---"), "—"),
    (re.compile(r"--"), "–"),
)
_TEX_SKIP_LINE = re.compile(r"^\s*\\(?:address|contacts)\{")
_TEX_COMMENT = re.compile(r"(?<!\\)%.*$")
_TEX_ROLE = re.compile(
    r"\\begin\{cvsubsection\}\{([^{}\n]*?)\s*\\textnormal\{---\s*([^{}\n]*)\}\}"
)


class ConfigError(Exception):
    """tools/cv_sources.local.json exists but cannot be used."""


@dataclass(frozen=True)
class Sources:
    experience_md: Path
    tex: Path | None = None


@dataclass(frozen=True)
class Issue:
    """One mismatch between site data and the CV sources."""

    file: str
    entry_id: str
    field: str
    message: str
    site: str | None = None
    source: str | None = None


# ---------------------------------------------------------------------------
# Normalization / 规范化
# ---------------------------------------------------------------------------
def collapse_ws(text: str) -> str:
    return _WS.sub(" ", text).strip()


def normalize_tex(text: str) -> str:
    """Flatten LaTeX into plain text comparable with the site's English."""
    lines = [
        _TEX_COMMENT.sub("", line)
        for line in text.splitlines()
        if not _TEX_SKIP_LINE.match(line)
    ]
    flat = "\n".join(lines)
    for _ in range(3):  # unwrap nested commands, e.g. \textbf{\texttt{x}}
        for pattern, repl in _TEX_RULES:
            flat = pattern.sub(repl, flat)
    return collapse_ws(flat)


def strip_md_prefix(line: str) -> str:
    """Drop a leading "N. 小标题：" (or bare "N. ") from one md line."""
    if not _MD_NUMBERED.match(line):
        return line.strip()
    return _MD_PREFIX.sub("", line, count=1).strip()


def normalize_md_section(section: str) -> str:
    return collapse_ws(
        "\n".join(strip_md_prefix(line) for line in section.splitlines())
    )


def md_bullets(section: str) -> list[str]:
    """Numbered md lines, prefix-stripped, trailing URLs removed."""
    return [
        _URL.sub("", strip_md_prefix(line)).strip()
        for line in section.splitlines()
        if _MD_NUMBERED.match(line)
    ]


def parse_md_sections(text: str) -> dict[str, str]:
    """Map "H2" and "H2/H3" headings to their body text (H2 bodies include H3s)."""
    sections: dict[str, list[str]] = {}
    h2: str | None = None
    h3: str | None = None
    for line in text.splitlines():
        if line.startswith("## "):
            h2, h3 = line[3:].strip(), None
            sections[h2] = []
            continue
        if line.startswith("### ") and h2 is not None:
            h3 = f"{h2}/{line[4:].strip()}"
            sections[h3] = []
            sections[h2].append(line)
            continue
        if h2 is not None:
            sections[h2].append(line)
        if h3 is not None:
            sections[h3].append(line)
    return {key: "\n".join(body) for key, body in sections.items()}


def parse_md_range(section: str) -> tuple[str, str | None] | None:
    """Return (start, end) as YYYY-MM from "起止时间：YYYY.MM-YYYY.MM" (end None = 至今)."""
    match = _RANGE.search(section)
    if not match:
        return None
    start = f"{match.group(1)}-{match.group(2)}"
    if match.group(5):
        return start, None
    if match.group(3):
        return start, f"{match.group(3)}-{match.group(4)}"
    return start, start


def inline_diff(site: str, source: str) -> str:
    """Character diff turning `source` into `site`: [-removed-]{+added+}."""
    out: list[str] = []
    matcher = difflib.SequenceMatcher(None, source, site, autojunk=False)
    for op, a1, a2, b1, b2 in matcher.get_opcodes():
        if op == "equal":
            out.append(source[a1:a2])
            continue
        if a2 > a1:
            out.append(f"[-{source[a1:a2]}-]")
        if b2 > b1:
            out.append(f"{{+{site[b1:b2]}+}}")
    return "".join(out)


def closest_line(text: str, candidates: Sequence[str]) -> str | None:
    best = max(
        candidates,
        key=lambda c: difflib.SequenceMatcher(None, text, c).ratio(),
        default=None,
    )
    return best


# ---------------------------------------------------------------------------
# Checks / 校验
# ---------------------------------------------------------------------------
def _is_localized(value: Any) -> bool:
    return isinstance(value, dict) and "en" in value and "zh" in value


def _walk_localized(value: Any, path: str) -> Iterator[tuple[str, dict[str, Any]]]:
    if _is_localized(value):
        yield path, value
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from _walk_localized(item, f"{path}[{i}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from _walk_localized(item, f"{path}.{key}" if path else key)


def _check_zh(
    file: str, entry_id: str, item: Mapping[str, Any], section: str
) -> list[Issue]:
    norm = normalize_md_section(section)
    lines = [strip_md_prefix(line) for line in section.splitlines() if line.strip()]
    issues = []
    for field in ZH_FIELDS:
        if field not in item or item[field] is None:
            continue
        value = item[field]
        if isinstance(value, str):  # plain proper-noun title (publications)
            pairs = [(field, value)]
        else:
            pairs = [
                (f"{path}.zh", str(lt["zh"]))
                for path, lt in _walk_localized(value, field)
            ]
        for path, text in pairs:
            if collapse_ws(text) not in norm:
                message = "text not found in experience.md section"
                issues.append(
                    Issue(
                        file, entry_id, path, message, text, closest_line(text, lines)
                    )
                )
    return issues


def _check_md_bullets(
    file: str, entry_id: str, item: Mapping[str, Any], section: str
) -> list[Issue]:
    site = {collapse_ws(str(b.get("zh", ""))) for b in item.get("bullets") or []}
    return [
        Issue(
            file,
            entry_id,
            "bullets(md)",
            "md bullet has no matching site bullet",
            None,
            bullet,
        )
        for bullet in md_bullets(section)
        if collapse_ws(bullet) not in site
    ]


def _check_dates(
    file: str, entry_id: str, item: Mapping[str, Any], section: str
) -> list[Issue]:
    parsed = parse_md_range(section)
    if parsed is None:
        return [Issue(file, entry_id, "start", "no 起止时间 in experience.md section")]
    issues = []
    for field, expected in zip(("start", "end"), parsed):
        if item.get(field) != expected:
            issues.append(
                Issue(
                    file,
                    entry_id,
                    field,
                    "date differs from experience.md",
                    str(item.get(field)),
                    str(expected),
                )
            )
    return issues


def _check_gpa(
    file: str, entry_id: str, item: Mapping[str, Any], section: str
) -> list[Issue]:
    gpa = item.get("gpa")
    if gpa is None:  # owner may choose not to publish a GPA
        return []
    match = _GPA.search(section)
    expected = match.group(1) if match else None
    if gpa != expected:
        return [
            Issue(
                file,
                entry_id,
                "gpa",
                "GPA differs from experience.md",
                str(gpa),
                str(expected),
            )
        ]
    return []


def _check_publication(
    file: str, entry_id: str, item: Mapping[str, Any], section: str
) -> list[Issue]:
    issues = []
    arxiv = item.get("arxiv")
    if (
        arxiv
        and f"arXiv:{arxiv}" not in section
        and f"arxiv.org/abs/{arxiv}" not in section
    ):
        issues.append(
            Issue(
                file,
                entry_id,
                "arxiv",
                "arXiv id not in experience.md section",
                item["arxiv"],
            )
        )
    if item.get("doi") and item["doi"] not in section:
        issues.append(
            Issue(
                file, entry_id, "doi", "DOI not in experience.md section", item["doi"]
            )
        )
    match = _PUB_DATE.search(section)
    expected = match.group(1) if match else None
    if item.get("date") != expected:
        issues.append(
            Issue(
                file,
                entry_id,
                "date",
                "date differs from 发布时间",
                str(item.get("date")),
                str(expected),
            )
        )
    return issues


def _check_award(
    file: str, entry_id: str, item: Mapping[str, Any], section: str
) -> list[Issue]:
    date = item.get("date")
    if date is None:
        return []
    year, month = date.split("-")
    if f"{year}年{month}月" not in section:
        return [
            Issue(
                file,
                entry_id,
                "date",
                f"{year}年{month}月 not in experience.md section",
                date,
            )
        ]
    return []


def check_entry(
    file: str, item: Mapping[str, Any], sections: Mapping[str, str]
) -> list[Issue]:
    """All md-side checks for one item that carries a cv_ref."""
    entry_id = str(item.get("id", "?"))
    section = sections.get(str(item["cv_ref"]))
    if section is None:
        return [
            Issue(
                file,
                entry_id,
                "cv_ref",
                "section not found in experience.md",
                str(item["cv_ref"]),
            )
        ]
    issues = _check_zh(file, entry_id, item, section)
    if file in DATED_FILES:
        issues += _check_dates(file, entry_id, item, section)
    if file in ENTRY_FILES:
        issues += _check_md_bullets(file, entry_id, item, section)
    if file == "education.json":
        issues += _check_gpa(file, entry_id, item, section)
    if file == "publications.json":
        issues += _check_publication(file, entry_id, item, section)
    if file == "awards.json":
        issues += _check_award(file, entry_id, item, section)
    return issues


def _load_items(profile_dir: Path) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield (file name, item) for every item of every list file in `profile_dir`."""
    for path in sorted(Path(profile_dir).glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        items = doc.get("items") if isinstance(doc, dict) else None
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    yield path.name, item


def check_profile(profile_dir: Path, md_text: str) -> list[Issue]:
    """Check every item with a cv_ref against experience.md; returns all issues."""
    sections = parse_md_sections(md_text)
    issues: list[Issue] = []
    for name, item in _load_items(profile_dir):
        if "cv_ref" in item:
            issues += check_entry(name, item, sections)
    return issues


def tex_roles(tex_text: str) -> dict[str, str]:
    """Map org -> role from tex headers ``{Org \\textnormal{--- Role}}``."""
    return {
        collapse_ws(normalize_tex(org)): collapse_ws(normalize_tex(role))
        for org, role in _TEX_ROLE.findall(tex_text)
    }


def tex_advisories(profile_dir: Path, tex_text: str) -> list[Issue]:
    """Terminology hints only: role titles that differ from the tex CV's headers."""
    roles = tex_roles(tex_text)
    advisories: list[Issue] = []
    for name, item in _load_items(profile_dir):
        org, role = item.get("org"), item.get("role")
        if name not in ENTRY_FILES or not (
            isinstance(org, dict) and isinstance(role, dict)
        ):
            continue
        expected = roles.get(collapse_ws(str(org.get("en", ""))))
        role_en = collapse_ws(str(role.get("en", "")))
        if expected is not None and role_en != expected:
            message = "role title differs from the tex CV (advisory)"
            item_id = str(item.get("id", "?"))
            advisories.append(
                Issue(name, item_id, "role.en", message, role_en, expected)
            )
    return advisories


# ---------------------------------------------------------------------------
# Sources & CLI / 数据源与命令行
# ---------------------------------------------------------------------------
def resolve_sources(env: Mapping[str, str], config_path: Path) -> Sources | None:
    """env CV_EXPERIENCE_MD (+ optional CV_TEX), else the local JSON config, else None."""
    md = env.get("CV_EXPERIENCE_MD")
    if md:
        tex = env.get("CV_TEX")
        return Sources(Path(md), Path(tex) if tex else None)
    if not config_path.is_file():
        return None
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"{config_path}: {exc}") from exc
    if not isinstance(config, dict) or not config.get("experience_md"):
        raise ConfigError(f"{config_path}: needs key experience_md (tex is optional)")
    tex = config.get("tex")
    return Sources(Path(config["experience_md"]), Path(tex) if tex else None)


def format_issue(issue: Issue) -> str:
    lines = [f"{issue.file}#{issue.entry_id} {issue.field}: {issue.message}"]
    if issue.site is not None:
        lines.append(f"    site:   {issue.site}")
    if issue.source is not None:
        lines.append(f"    source: {issue.source}")
    if issue.site is not None and issue.source is not None:
        lines.append(f"    diff:   {inline_diff(issue.site, issue.source)}")
    return "\n".join(lines)


def _emit(text: str) -> None:
    sys.stdout.write(text + "\n")


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check data/profile against the CV sources."
    )
    parser.add_argument("--md", type=Path, help="experience.md (zh canonical)")
    parser.add_argument(
        "--tex", type=Path, help="English LaTeX CV (optional, advisory only)"
    )
    parser.add_argument("--profile-dir", type=Path, default=DEFAULT_PROFILE_DIR)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    return parser.parse_args(list(argv))


def _read_sources(sources: Sources) -> tuple[str, str | None]:
    md_text = sources.experience_md.read_text(encoding="utf-8")
    tex_text = sources.tex.read_text(encoding="utf-8") if sources.tex else None
    return md_text, tex_text


def main(argv: Sequence[str]) -> int:
    args = _parse_args(argv)
    try:
        sources = (
            Sources(args.md, args.tex)
            if args.md
            else resolve_sources(os.environ, args.config)
        )
    except ConfigError as exc:
        _emit(f"cv_sync_check: {exc}")
        return 2
    if sources is None:
        _emit(
            "cv_sync_check: CV sources not configured (use --md, CV_EXPERIENCE_MD, "
            "or tools/cv_sources.local.json)"
        )
        return 2
    try:
        md_text, tex_text = _read_sources(sources)
    except OSError as exc:
        _emit(f"cv_sync_check: cannot read source: {exc}")
        return 2
    if tex_text is not None:
        for advisory in tex_advisories(args.profile_dir, tex_text):
            _emit("advisory: " + format_issue(advisory))
    issues = check_profile(args.profile_dir, md_text)
    for issue in issues:
        _emit(format_issue(issue))
    if issues:
        _emit(f"cv_sync_check: {len(issues)} issue(s)")
        return 1
    _emit("cv_sync_check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
