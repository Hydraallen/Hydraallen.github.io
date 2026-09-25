"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const lib = require("../js/lib.js");

test("escapeHtml escapes all five special characters", () => {
  assert.strictEqual(lib.escapeHtml("&"), "&amp;");
  assert.strictEqual(lib.escapeHtml("<"), "&lt;");
  assert.strictEqual(lib.escapeHtml(">"), "&gt;");
  assert.strictEqual(lib.escapeHtml('"'), "&quot;");
  assert.strictEqual(lib.escapeHtml("'"), "&#39;");
});

test("escapeHtml neutralizes an XSS img payload", () => {
  const payload = '<img src=x onerror=alert(1)>';
  const out = lib.escapeHtml(payload);
  assert.ok(!out.includes("<img"), "raw <img must not survive");
  assert.strictEqual(
    out,
    "&lt;img src=x onerror=alert(1)&gt;"
  );
});

test("escapeHtml handles null/undefined as empty string", () => {
  assert.strictEqual(lib.escapeHtml(null), "");
  assert.strictEqual(lib.escapeHtml(undefined), "");
});

test("getPosterSrc returns poster when present, placeholder otherwise", () => {
  assert.strictEqual(lib.getPosterSrc({ poster: "p.jpg" }), "p.jpg");
  assert.strictEqual(lib.getPosterSrc({ poster: "" }), lib.NO_POSTER_SRC);
  assert.strictEqual(lib.getPosterSrc({}), lib.NO_POSTER_SRC);
});

test("buildMovieCardHtml escapes title and date, includes poster", () => {
  const html = lib.buildMovieCardHtml({
    poster: "http://x/p.jpg",
    title: '<b>Evil</b>',
    date: "2024-01-01",
  });
  assert.ok(html.includes("http://x/p.jpg"));
  assert.ok(html.includes("&lt;b&gt;Evil&lt;/b&gt;"));
  assert.ok(!html.includes("<b>Evil</b>"), "raw title tag must not survive");
  assert.ok(html.includes("2024-01-01"));
});

test("buildMovieCardHtml uses placeholder when no poster", () => {
  const html = lib.buildMovieCardHtml({ title: "T", date: "D" });
  assert.ok(html.includes(lib.NO_POSTER_SRC));
});

test("NO_POSTER_SRC placeholder carries no language-specific text", () => {
  assert.ok(lib.NO_POSTER_SRC.startsWith("data:image/svg+xml"));
  assert.ok(!/No Poster|%3Ctext/.test(lib.NO_POSTER_SRC), "no baked-in English label");
});

// ---------------------------------------------------------------------------
// Travel: country / display name (bilingual schema: name {en,zh}, country_code)
// ---------------------------------------------------------------------------
const NYC = { name: { en: "New York City", zh: "纽约" }, country_code: "US", state: "NY" };
const SEATTLE = { name: { en: "Seattle", zh: "西雅图" }, country_code: "US", state: "WA" };

test("flagEmoji maps an ISO alpha-2 code to its regional-indicator flag", () => {
  assert.strictEqual(lib.flagEmoji("US"), "\u{1F1FA}\u{1F1F8}");
  assert.strictEqual(lib.flagEmoji("jp"), "\u{1F1EF}\u{1F1F5}", "case-insensitive");
  assert.strictEqual(lib.flagEmoji("USA"), "");
  assert.strictEqual(lib.flagEmoji(undefined), "");
});

test("getCountryLabel combines the flag with the localized country name", () => {
  assert.strictEqual(lib.getCountryLabel({ country_code: "US" }), "\u{1F1FA}\u{1F1F8} USA");
  assert.strictEqual(lib.getCountryLabel({ country_code: "US" }, "zh"), "\u{1F1FA}\u{1F1F8} 美国");
  assert.strictEqual(lib.getCountryLabel({ country_code: "CZ" }, "zh"), "\u{1F1E8}\u{1F1FF} 捷克");
  assert.strictEqual(lib.getCountryLabel({}), "", "no code -> empty, never undefined");
});

test("getDisplayName appends the US state (postal code in en, full name in zh)", () => {
  assert.strictEqual(lib.getDisplayName(SEATTLE), "Seattle, WA", "defaults to English");
  assert.strictEqual(lib.getDisplayName(SEATTLE, "en"), "Seattle, WA");
  assert.strictEqual(lib.getDisplayName(SEATTLE, "zh"), "西雅图，华盛顿州");
});

test("getDisplayName (zh) drops a state that merely repeats the place name", () => {
  assert.strictEqual(lib.getDisplayName(NYC, "en"), "New York City, NY");
  assert.strictEqual(lib.getDisplayName(NYC, "zh"), "纽约", "not 纽约，纽约州");
  const dc = { name: { en: "Washington DC", zh: "华盛顿特区" }, country_code: "US", state: "DC" };
  assert.strictEqual(lib.getDisplayName(dc, "zh"), "华盛顿特区");
});

test("getDisplayName ignores a state outside the USA and never dangles a comma", () => {
  assert.strictEqual(
    lib.getDisplayName({ name: { en: "Paris", zh: "巴黎" }, country_code: "FR", state: "X" }, "zh"),
    "巴黎"
  );
  assert.strictEqual(lib.getDisplayName({ name: { en: "Honolulu", zh: "檀香山" }, country_code: "US" }), "Honolulu");
  assert.strictEqual(lib.getDisplayName({ name: "Kyoto" }), "Kyoto", "plain-string names pass through");
  assert.ok(!lib.getDisplayName({}).includes("undefined"));
});

test("formatPlaceDates renders a localized range, or the idea label", () => {
  const ithaca = { status: "visited", date: "2025-01-15", date_end: "2025-05-17" };
  assert.strictEqual(lib.formatPlaceDates(ithaca), "Jan 15 – May 17, 2025");
  assert.strictEqual(lib.formatPlaceDates(ithaca, "zh"), "2025.01.15 – 05.17");
  assert.strictEqual(
    lib.formatPlaceDates({ status: "visited", date: "2025-05-09", date_end: "2025-05-09" }, "en"),
    "May 9, 2025"
  );
  const idea = { status: "idea", date: null, date_end: null };
  assert.strictEqual(lib.formatPlaceDates(idea, "en"), "TODO List");
  assert.strictEqual(lib.formatPlaceDates(idea, "zh"), "待出发");
});

test("getLightboxSrc / getLightboxCaption handle string and object photos", () => {
  assert.strictEqual(lib.getLightboxSrc("a.jpg"), "a.jpg");
  assert.strictEqual(lib.getLightboxSrc({ src: "b.jpg" }), "b.jpg");
  assert.strictEqual(lib.getLightboxCaption("a.jpg"), "");
  assert.strictEqual(lib.getLightboxCaption({ src: "b.jpg" }), "");
  assert.strictEqual(lib.getLightboxCaption({ src: "b.jpg", location: "Rome" }), "Rome");
  const loc = { src: "b.jpg", location: { en: "Central Park", zh: "中央公园" } };
  assert.strictEqual(lib.getLightboxCaption(loc), "Central Park");
  assert.strictEqual(lib.getLightboxCaption(loc, "zh"), "中央公园");
});

// ---------------------------------------------------------------------------
// Travel: comparators (ISO dates, idea = null; names via Intl.Collator)
// ---------------------------------------------------------------------------
test("compareVisited: an undated place sorts first for newest, last for oldest", () => {
  const undated = { name: "T", date: null };
  const dated = { name: "D", date: "2020-01-01" };
  assert.ok(lib.compareVisited("newest")(undated, dated) < 0);
  assert.ok(lib.compareVisited("newest")(dated, undated) > 0);
  assert.ok(lib.compareVisited("oldest")(undated, dated) > 0);
  assert.ok(lib.compareVisited("oldest")(dated, undated) < 0);
});

test("compareVisited: newest/oldest order dated items correctly", () => {
  const older = { name: "O", date: "2019-01-01" };
  const newer = { name: "N", date: "2023-01-01" };
  assert.ok(lib.compareVisited("newest")(newer, older) < 0);
  assert.ok(lib.compareVisited("oldest")(older, newer) < 0);
});

test("compareVisited: az / za and equal-name fallback", () => {
  const a = { name: { en: "Alpha", zh: "阿" }, date: "x" };
  const b = { name: { en: "Beta", zh: "贝" }, date: "x" };
  assert.ok(lib.compareVisited("az")(a, b) < 0);
  assert.ok(lib.compareVisited("za")(a, b) > 0);
  const same = { name: "Same", date: "x" };
  assert.strictEqual(lib.compareVisited("unknown")(same, same), 0);
});

test("compareVisited / compareIdea sort by the name in the page language", () => {
  // en: Seattle < Tokyo; zh (pinyin): 东京 dong < 西雅图 xi
  const seattle = { name: { en: "Seattle", zh: "西雅图" }, date: "2025-01-01" };
  const tokyo = { name: { en: "Tokyo", zh: "东京" }, date: "2025-01-01" };
  assert.ok(lib.compareVisited("az", "en")(seattle, tokyo) < 0);
  assert.ok(lib.compareVisited("az", "zh")(seattle, tokyo) > 0);
  assert.ok(lib.compareIdea("az", "en")(seattle, tokyo) < 0);
  assert.ok(lib.compareIdea("az", "zh")(seattle, tokyo) > 0);
  assert.ok(lib.compareIdea("za", "zh")(seattle, tokyo) < 0);
});

test("compareIdea: default asc, za desc", () => {
  const a = { name: "Alpha" };
  const b = { name: "Beta" };
  assert.ok(lib.compareIdea("az")(a, b) < 0);
  assert.ok(lib.compareIdea("newest")(a, b) < 0);
  assert.ok(lib.compareIdea("za")(a, b) > 0);
});

test("nextIndex / prevIndex wrap around", () => {
  assert.strictEqual(lib.nextIndex(0, 3), 1);
  assert.strictEqual(lib.nextIndex(2, 3), 0);
  assert.strictEqual(lib.prevIndex(0, 3), 2);
  assert.strictEqual(lib.prevIndex(1, 3), 0);
});
