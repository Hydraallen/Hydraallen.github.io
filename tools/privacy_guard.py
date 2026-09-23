"""隐私守卫:扫描站点发布文件,拦截电话/证件号/邮箱/敏感关键词/PDF 等隐私泄露。

Privacy guard for the published site. GitHub Pages serves the whole repo root,
so every text file listed by `git ls-files -co --exclude-standard` is scanned:
top-level files plus `js/`, `css/`, `data/`, `tools/` and `tests/` (fixtures
included). The two files that define the rules and their fictional samples are
exempt. Structural checks: no tracked PDF, no `CV/` directory.

Usage:
    python tools/privacy_guard.py [repo_root]   # exit 1 when anything is found
"""
from __future__ import annotations

import logging
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

logger = logging.getLogger(__name__)

# The only e-mail address allowed to appear on the public site.
ALLOWED_EMAILS = frozenset({"wangruiallen@gmail.com"})

# RFC 2606 / 6761 保留域名永远不是真实地址,测试 fixture 用它们做虚构邮箱。
RESERVED_EMAIL_DOMAIN = re.compile(r"@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net)|example|invalid|test)$")

# "user@2x.png" 之类的文件名不是邮箱:TLD 是常见文件扩展名时忽略。
FILE_EXTENSION_TLDS = frozenset(
    {"png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "css", "js", "json", "html", "ico"}
)

SENSITIVE_KEYWORDS = (
    "学号",
    "证书编号",
    "准考证",
    "身份证",
    "户籍",
    "民族",
    "政治面貌",
    "证明人",
    "家庭成员",
    "软著登字",
    "SICCX",
)

# (rule name, compiled pattern). Every pattern has false-positive unit tests.
PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("cn_mobile", re.compile(r"(?<![\d.])1[3-9]\d{9}(?!\d)")),
    ("us_phone", re.compile(r"\(?\+1\)?[\s.-]*\d{3}[\s.-]?\d{3}[\s.-]?\d{4}")),
    ("long_digits", re.compile(r"(?<![\d.])\d{15,18}(?!\d)")),
    ("long_digits", re.compile(r"(?<![\d.])\d{4}(?:\s\d{4}){3,}(?!\d)")),
    ("pdf_link", re.compile(r"\.pdf(?![A-Za-z0-9])", re.IGNORECASE)),
    ("keyword", re.compile("|".join(re.escape(k) for k in SENSITIVE_KEYWORDS))),
)

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+([A-Za-z]{2,})(?![A-Za-z0-9])")

SCANNED_DIRS = ("js/", "css/", "data/", "tools/", "tests/")
SCANNED_SUFFIXES = (".html", ".js", ".css", ".json", ".md", ".txt", ".py", ".ipynb", ".tex")
# The keyword list and its unit tests necessarily contain every pattern they catch.
EXEMPT_FILES = frozenset({"tools/privacy_guard.py", "tests/test_privacy_guard.py"})


@dataclass(frozen=True)
class Finding:
    """One privacy violation."""

    path: str
    line: int
    rule: str
    excerpt: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _email_findings(text: str, path: str) -> list[Finding]:
    findings = []
    for match in EMAIL_PATTERN.finditer(text):
        address = match.group(0).lower()
        tld = match.group(1).lower()
        if address in ALLOWED_EMAILS or tld in FILE_EXTENSION_TLDS:
            continue
        if RESERVED_EMAIL_DOMAIN.search(address):
            continue
        findings.append(Finding(path, _line_of(text, match.start()), "email", match.group(0)))
    return findings


def scan_text(text: str, path: str) -> list[Finding]:
    """Return every privacy finding in `text`, sorted by line number."""
    findings = [
        Finding(path, _line_of(text, match.start()), rule, match.group(0))
        for rule, pattern in PATTERNS
        for match in pattern.finditer(text)
    ]
    findings.extend(_email_findings(text, path))
    return sorted(findings, key=lambda f: (f.line, f.rule))


def is_scanned_path(rel_path: str) -> bool:
    """True for text files GitHub Pages publishes (minus the rule definitions)."""
    path = rel_path.replace("\\", "/")
    if path in EXEMPT_FILES or not path.endswith(SCANNED_SUFFIXES):
        return False
    return "/" not in path or path.startswith(SCANNED_DIRS)


def check_structure(root: Path, files: Iterable[str]) -> list[Finding]:
    """Repo-level rules: no PDF is tracked/untracked-unignored, no CV/ directory."""
    findings = [
        Finding(f, 0, "tracked_pdf", f) for f in files if f.lower().endswith(".pdf")
    ]
    if (Path(root) / "CV").exists():
        findings.append(Finding("CV/", 0, "cv_dir", "CV/ directory must not exist"))
    return findings


def list_repo_files(root: Path) -> list[str]:
    """Tracked + untracked-but-not-ignored files (what a `git add -A` would publish)."""
    result = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard"],
        cwd=str(root),
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def scan_repo(root: Path, files: Sequence[str] | None = None) -> list[Finding]:
    """Scan the repository rooted at `root`; returns all findings."""
    root = Path(root)
    all_files = list(files) if files is not None else list_repo_files(root)
    findings = check_structure(root, all_files)
    for rel in all_files:
        full = root / rel
        if not is_scanned_path(rel) or not full.is_file():
            continue
        try:
            text = full.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            logger.warning("Skipping non-UTF-8 file: %s", rel)
            continue
        findings.extend(scan_text(text, rel))
    return findings


def format_finding(finding: Finding) -> str:
    return f"{finding.path}:{finding.line}: [{finding.rule}] {finding.excerpt}"


def main(argv: Sequence[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    root = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent
    findings = scan_repo(root)
    for finding in findings:
        logger.error(format_finding(finding))
    if findings:
        logger.error("privacy_guard: %d finding(s)", len(findings))
        return 1
    logger.info("privacy_guard: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
