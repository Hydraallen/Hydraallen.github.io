"use strict";

// Unit tests for tests/helpers/content_rules.js (fictional fixtures only).
const { test } = require("node:test");
const assert = require("node:assert");
const rules = require("./helpers/content_rules.js");

test("checkDict flags empty values, extra fields and param mismatches", () => {
  const errors = rules.checkDict({
    "a.ok": { en: "Hi {name}", zh: "你好 {name}" },
    "a.empty": { en: "x", zh: " " },
    "a.extra": { en: "x", zh: "叉", fr: "x" },
    "a.params": { en: "{n} items", zh: "{count} 项" },
  });
  assert.strictEqual(errors.length, 3);
  assert.ok(errors.some((e) => e.startsWith("a.empty")));
  assert.ok(errors.some((e) => e.startsWith("a.extra")));
  assert.ok(errors.some((e) => e.startsWith("a.params")));
});

test("findUnusedKeys honours literal usage and dynamic prefixes", () => {
  const dict = { "x.used": {}, "x.unused": {}, "country.ZZ": {} };
  assert.deepStrictEqual(rules.findUnusedKeys(dict, ["x.used"], ["country."]), ["x.unused"]);
});

test("extractJsTKeys finds literal keys in several call shapes", () => {
  const src = `t("a.b", lang); i18n.t('c.d'); _i18n.t( "e.f" , l); t(dynamicKey); sett("no.no"); t("country." + code)`;
  assert.deepStrictEqual(rules.extractJsTKeys(src), ["a.b", "c.d", "e.f"]);
});

test("extractHtmlI18n returns slots, attrs, title and child violations", () => {
  const html =
    '<html data-i18n-title="meta.title.x"><head><title> T </title>' +
    '<script src="js/i18n.js"></script><script src="js/i18n/strings.common.js"></script></head>' +
    '<body><p data-i18n="a.b">  Hello\n world </p>' +
    '<p data-i18n="bad.mixed">Hi <b>x</b></p>' +
    '<input data-i18n-attr="placeholder:a.ph;aria-label:a.al" placeholder="Name" aria-label="Your name"></body></html>';
  const info = rules.extractHtmlI18n(html);
  assert.deepStrictEqual(info.childViolations, ["bad.mixed"]);
  assert.deepStrictEqual(info.stringsFiles, ["js/i18n/strings.common.js"]);
  assert.deepStrictEqual(info.headScripts, ["js/i18n.js", "js/i18n/strings.common.js"]);
  const byKey = Object.fromEntries(info.slots.map((s) => [s.key, s]));
  assert.strictEqual(byKey["a.b"].fallback, "Hello world");
  assert.strictEqual(byKey["a.ph"].fallback, "Name");
  assert.strictEqual(byKey["a.al"].attr, "aria-label");
  assert.strictEqual(byKey["meta.title.x"].fallback, "T");
});

test("checkLocalizedText enforces shape and en_source enum", () => {
  assert.deepStrictEqual(rules.checkLocalizedText({ en: "A", zh: "甲", en_source: "tex" }, "w"), []);
  assert.strictEqual(rules.checkLocalizedText("plain", "w").length, 1);
  assert.strictEqual(rules.checkLocalizedText({ en: "A", zh: "" }, "w").length, 1);
  assert.strictEqual(rules.checkLocalizedText({ en: "A", zh: "甲", note: 1 }, "w").length, 1);
  assert.strictEqual(rules.checkLocalizedText({ en: "A", zh: "甲", en_source: "guess" }, "w").length, 1);
});

test("checkLocalizedFields separates required-localized and plain-allowed fields", () => {
  const spec = { localized: ["role", "bullets"], plainAllowed: ["name"] };
  const ok = { role: { en: "Dev", zh: "开发" }, bullets: [{ en: "A", zh: "甲" }], name: "Acme" };
  assert.deepStrictEqual(rules.checkLocalizedFields(ok, spec, "e"), []);
  const bad = { role: "Dev", bullets: [{ en: "A" }], name: { en: "X" } };
  assert.strictEqual(rules.checkLocalizedFields(bad, spec, "e").length, 3);
});

test("date helpers validate formats, explicit end and ordering", () => {
  assert.ok(rules.isYearMonth("2025-08"));
  assert.ok(!rules.isYearMonth("2025-13"));
  assert.ok(rules.isIsoDay("2025-01-31"));
  assert.ok(!rules.isIsoDay("2025-1-3"));
  assert.deepStrictEqual(rules.checkDateRange({ start: "2025-01", end: null }, "e", "month"), []);
  assert.strictEqual(rules.checkDateRange({ start: "2025-01" }, "e", "month").length, 1);
  assert.strictEqual(rules.checkDateRange({ start: "2025-05", end: "2025-01" }, "e", "month").length, 1);
  assert.strictEqual(rules.checkDateRange({ start: "2025-01-10", end: "2025-01" }, "e", "day").length, 1);
  assert.deepStrictEqual(
    rules.checkSortedByStartDesc([{ id: "a", start: "2025-08" }, { id: "b", start: "2024-01" }], "x"),
    []
  );
  assert.strictEqual(
    rules.checkSortedByStartDesc([{ id: "a", start: "2023-08" }, { id: "b", start: "2024-01" }], "x").length,
    1
  );
});

test("number parity strips thousands separators and normalizes decimals", () => {
  assert.deepStrictEqual(rules.numberMultiset("Cut 1,200 ms by 30% (4.00)"), ["1200", "30", "4"]);
  assert.deepStrictEqual(
    rules.checkNumberParity({ en: "Reduced latency by 30% for 1,200 users", zh: "为 1200 名用户降低 30% 延迟" }, "b"),
    []
  );
  assert.strictEqual(rules.checkNumberParity({ en: "86% accuracy", zh: "准确率 85%" }, "b").length, 1);
  assert.strictEqual(rules.checkNumCheckFlag({ num_check: false }, "e").length, 1);
  assert.deepStrictEqual(rules.checkNumCheckFlag({ num_check: false, num_check_reason: "zh uses 万" }, "e"), []);
});

test("checkGlossary enforces paired terms and forbidden patterns", () => {
  const glossary = {
    terms: [{ en: "Agent Harness", zh: "Agent Harness" }, { en: "Online Judge", zh: "在线评测" }],
    forbidden: [{ pattern: "first[- ]author|第一作者|一作", flags: "i", reason: "co-author only" }],
  };
  assert.deepStrictEqual(
    rules.checkGlossary(glossary, { en: "Built an Online Judge", zh: "搭建在线评测系统" }, "x"),
    []
  );
  assert.strictEqual(rules.checkGlossary(glossary, { en: "Built an Online Judge", zh: "搭建 OJ" }, "x").length, 1);
  assert.strictEqual(rules.checkGlossary(glossary, { en: "First author", zh: "作者" }, "x").length, 1);
  assert.strictEqual(rules.checkGlossary(glossary, { en: "Author", zh: "一作" }, "x").length, 1);
});
