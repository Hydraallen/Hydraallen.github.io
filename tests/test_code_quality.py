"""code_quality.py 的测试:正则修复 void 标签的自闭合。"""
import os

import pytest

from code_quality import fix_content, process_directory

VOID_TAGS = [
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
]


def test_area_tag_is_fixed():
    # 核心 bug:<area/> 之前因正则里多余的冒号而永不被修复
    assert fix_content("<area/>") == ("<area>", 1)


@pytest.mark.parametrize("tag", VOID_TAGS)
def test_all_void_tags_fixed(tag):
    content = f"<{tag}/>"
    new_content, count = fix_content(content)
    assert count == 1
    assert new_content == f"<{tag}>"


def test_non_void_tag_untouched():
    assert fix_content("<div/>") == ("<div/>", 0)


def test_colon_area_not_matched():
    # <:area/> 不应被当作 area 匹配
    new_content, count = fix_content("<:area/>")
    assert count == 0
    assert new_content == "<:area/>"


def test_tag_with_attributes_and_spaces():
    new_content, count = fix_content('<img src="a.png" />')
    assert count == 1
    assert new_content == '<img src="a.png">'


def test_process_directory_excludes_git(tmp_path):
    # .git / node_modules / dist 目录应被跳过
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "bad.html").write_text("<br/>", encoding="utf-8")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "x.html").write_text("<br/>", encoding="utf-8")
    (tmp_path / "good.html").write_text("<br/>", encoding="utf-8")

    fixed_files, fixed_tags = process_directory(str(tmp_path))

    assert fixed_files == 1
    assert fixed_tags == 1
    # 被排除目录内容未改动
    assert (tmp_path / ".git" / "bad.html").read_text(encoding="utf-8") == "<br/>"
    assert (tmp_path / "good.html").read_text(encoding="utf-8") == "<br>"


def test_multiline_html_tag_still_fixed():
    # HTML 里合法的跨行属性列表仍应被修正
    content = '<img\n  src="a.png"\n  alt="x"\n/>'
    new_content, count = fix_content(content)
    assert count == 1
    assert new_content == '<img\n  src="a.png"\n  alt="x">'


def test_js_string_literal_not_swallowed_across_lines():
    # A `<img` inside a JS string literal must not be joined to an unrelated `/>`
    # several lines below: the attribute grammar stops at the closing quote.
    content = (
        "assert.ok(html.includes('<img class=\"stop-photo\" src=\"p.jpg\"'));\n"
        "assert.ok(html.includes('data-photo-index=\"3\"'));\n"
        "assert.ok(html.includes('loading=\"lazy\"'));\n"
        'assert.ok(!html.includes("/>"));\n'
    )
    new_content, count = fix_content(content)
    assert count == 0
    # 中间几行不能被吞掉
    assert new_content == content


def test_fix_content_is_idempotent():
    # 跑第二遍不应再产生任何改动
    once, first_count = fix_content('<p>a<br/>b</p><img src="x.png" />')
    twice, second_count = fix_content(once)
    assert first_count == 2
    assert second_count == 0
    assert twice == once
