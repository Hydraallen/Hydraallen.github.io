"""privacy_guard 的单元测试。所有样例数据均为虚构 (fictional fixtures only)。"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

import privacy_guard as pg

_ROOT = Path(__file__).resolve().parent.parent


def _rules(text: str) -> list[str]:
    return [f.rule for f in pg.scan_text(text, "fixture.html")]


# ---------------------------------------------------------------------------
# CN mobile numbers
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_cn_mobile_detected() -> None:
    assert "cn_mobile" in _rules("联系电话 13800001111 欢迎")


@pytest.mark.unit
def test_cn_mobile_not_matched_inside_decimals() -> None:
    # 坐标小数部分恰好含 11 位数字,不应被当成手机号
    assert "cn_mobile" not in _rules('"coordinates": [40.13912345678, -73.98]')
    assert "cn_mobile" not in _rules("lat 0.15012345678")


@pytest.mark.unit
def test_cn_mobile_not_matched_in_longer_digit_run() -> None:
    assert "cn_mobile" not in _rules("ts=1700000000000")


# ---------------------------------------------------------------------------
# US phone numbers (+1 prefix)
# ---------------------------------------------------------------------------
@pytest.mark.unit
@pytest.mark.parametrize(
    "text",
    ["+1 555 010 0199", "+1-555-010-0199", "(+1) 555.010.0199"],
)
def test_us_phone_detected(text: str) -> None:
    assert "us_phone" in _rules(text)


@pytest.mark.unit
def test_us_phone_ignores_coordinates_and_versions() -> None:
    assert "us_phone" not in _rules("[42.2808, -83.7430] leaflet@1.9.4")


# ---------------------------------------------------------------------------
# Long digit runs (ID / certificate numbers)
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_long_digit_run_detected() -> None:
    assert "long_digits" in _rules("ID 110101199001011234 end")
    assert "long_digits" in _rules("card 1234 5678 9012 3456")


@pytest.mark.unit
def test_long_digit_run_ignores_decimal_fraction() -> None:
    assert "long_digits" not in _rules("x = 3.1415926535897932")


@pytest.mark.unit
def test_imdb_poster_url_is_clean() -> None:
    url = (
        "https://m.media-amazon.com/images/M/"
        "MV5BMTc5MDE2ODcwNV5BMl5BanBnXkFtZTgwMzI2NzQ2NzM@._V1_SX300.jpg"
    )
    assert _rules(url) == []


# ---------------------------------------------------------------------------
# Emails
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_whitelisted_email_allowed() -> None:
    assert _rules("mailto:wangruiallen@gmail.com") == []


@pytest.mark.unit
def test_other_email_flagged() -> None:
    assert "email" in _rules("reach me at someone.fake@fakemail.cn")


@pytest.mark.unit
@pytest.mark.parametrize(
    "text", ["fixture@example.com", "a@example.org", "nobody@example.invalid", "x@site.test"]
)
def test_reserved_example_domains_allowed(text: str) -> None:
    # RFC 2606 / 6761 保留域名永远不是真实邮箱 (test fixtures use them)
    assert "email" not in _rules(text)


@pytest.mark.unit
def test_lookalike_of_reserved_domain_still_flagged() -> None:
    assert "email" in _rules("me@notexample.com")
    assert "email" in _rules("me@example.com.cn")


@pytest.mark.unit
@pytest.mark.parametrize(
    "text", ["leaflet@1.9.4/dist/leaflet.css", "jsdom@25.0.1", "icon@2x.png", "a@b.c"]
)
def test_non_email_at_signs_ignored(text: str) -> None:
    assert "email" not in _rules(text)


# ---------------------------------------------------------------------------
# Keywords / PDF links
# ---------------------------------------------------------------------------
@pytest.mark.unit
@pytest.mark.parametrize("word", ["学号", "证书编号", "身份证", "政治面貌", "证明人", "软著登字", "SICCX"])
def test_sensitive_keywords_flagged(word: str) -> None:
    assert "keyword" in _rules(f"xx {word} yy")


# ---------------------------------------------------------------------------
# Real name: the site uses the handle only. Samples are built from escapes so
# this file never contains the name literally (it is published and in history).
# 真实姓名：站点只用 Hydraallen；样例用转义拼出，文件本身不含字面姓名。
# ---------------------------------------------------------------------------
_ZH_NAME = "\u6c6a\u777f"
_EN_GIVEN, _EN_FAMILY = "R" + "ui", "W" + "ang"


@pytest.mark.unit
@pytest.mark.parametrize(
    "text",
    [
        f"你好，我是{_ZH_NAME}",
        f"{_EN_GIVEN} {_EN_FAMILY} is a student",
        f"by {_EN_FAMILY.upper()}  {_EN_GIVEN}",
        f"({_EN_GIVEN.lower()}\n{_EN_FAMILY.lower()})",
    ],
)
def test_real_name_flagged(text: str) -> None:
    assert "real_name" in _rules(text)


@pytest.mark.unit
@pytest.mark.parametrize(
    "text",
    [
        "Hi, I'm Hydraallen",
        "wangruiallen@gmail.com",
        "https://www.linkedin.com/in/rui-wang-546099392/",
        f"{_EN_GIVEN}z {_EN_FAMILY}er",
    ],
)
def test_handle_email_and_linkedin_slug_are_not_real_name(text: str) -> None:
    assert "real_name" not in _rules(text)


@pytest.mark.unit
def test_pdf_link_flagged() -> None:
    assert "pdf_link" in _rules('<a href="CV/CV.pdf">Resume</a>')
    assert "pdf_link" in _rules('"url": "https://x.org/paper.PDF"')


@pytest.mark.unit
def test_pdf_word_without_extension_ok() -> None:
    assert "pdf_link" not in _rules("export to pdf or pdfs")


@pytest.mark.unit
def test_finding_reports_line_number() -> None:
    findings = pg.scan_text("ok\nok\n13800001111\n", "f.js")
    assert findings[0].line == 3
    assert findings[0].path == "f.js"


# ---------------------------------------------------------------------------
# File selection + repo-level checks
# ---------------------------------------------------------------------------
@pytest.mark.unit
def test_is_scanned_path() -> None:
    assert pg.is_scanned_path("index.html")
    assert pg.is_scanned_path("js/i18n.js")
    assert pg.is_scanned_path("css/styles.css")
    assert pg.is_scanned_path("data/travel/nyc.json")
    assert not pg.is_scanned_path("img/avatar.jpg")


@pytest.mark.unit
@pytest.mark.parametrize(
    "path",
    [
        "README.md",
        "CHANGELOG.md",
        "code_quality.py",
        "package.json",
        "package-lock.json",
        "tools/cv_sync_check.py",
        "tests/test_cv_sync.py",
        "tests/profile.test.js",
        "tests/helpers/content_rules.js",
        "tests/fixtures/profile/profile.json",
        "tests/fixtures/cv/experience.md",
    ],
)
def test_published_tooling_and_docs_are_scanned(path: str) -> None:
    # GitHub Pages 发布整个仓库根目录,工具/测试/文档同样对外可见
    assert pg.is_scanned_path(path)


@pytest.mark.unit
@pytest.mark.parametrize(
    "path",
    ["tools/privacy_guard.py", "tests/test_privacy_guard.py", "node_modules/x/index.js", ".gitignore"],
)
def test_rule_definitions_and_non_text_are_not_scanned(path: str) -> None:
    assert not pg.is_scanned_path(path)


@pytest.mark.unit
def test_structural_findings_for_pdf_and_cv_dir(tmp_path: Path) -> None:
    (tmp_path / "CV").mkdir()
    findings = pg.check_structure(tmp_path, ["index.html", "docs/resume.pdf"])
    rules = {f.rule for f in findings}
    assert rules == {"tracked_pdf", "cv_dir"}


@pytest.mark.unit
def test_structural_clean(tmp_path: Path) -> None:
    assert pg.check_structure(tmp_path, ["index.html"]) == []


# ---------------------------------------------------------------------------
# The real guardrail: the working tree must be clean
# ---------------------------------------------------------------------------
@pytest.mark.integration
def test_repository_passes_privacy_guard() -> None:
    findings = pg.scan_repo(_ROOT)
    assert findings == [], "\n".join(pg.format_finding(f) for f in findings)


@pytest.mark.integration
def test_cli_exit_code_zero_on_clean_repo() -> None:
    script = _ROOT / "tools" / "privacy_guard.py"
    result = subprocess.run(
        [sys.executable, str(script), str(_ROOT)],
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    assert result.returncode == 0, result.stdout + result.stderr
