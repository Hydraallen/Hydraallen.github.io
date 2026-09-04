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

test("getDisplayName appends state only for USA", () => {
  assert.strictEqual(
    lib.getDisplayName({ name: "Seattle", country: "USA", state: "WA" }),
    "Seattle, WA"
  );
  assert.strictEqual(
    lib.getDisplayName({ name: "Seattle", country: "usa", state: "WA" }),
    "Seattle, WA"
  );
  assert.strictEqual(
    lib.getDisplayName({ name: "Paris", country: "France", state: "X" }),
    "Paris"
  );
  assert.strictEqual(
    lib.getDisplayName({ name: "Austin", country: "USA" }),
    "Austin"
  );
});

test("getDisplayName handles the flag-emoji country shape used in data/travel", () => {
  // 真实数据形态:country 带国旗 emoji
  assert.strictEqual(
    lib.getDisplayName({ name: "Boston", country: "\u{1F1FA}\u{1F1F8} USA", state: "MA" }),
    "Boston, MA"
  );
  assert.strictEqual(
    lib.getDisplayName({ name: "New York City", country: "\u{1F1FA}\u{1F1F8} USA", state: "NY" }),
    "New York City, NY"
  );
  assert.strictEqual(
    lib.getDisplayName({ name: "Reykjavik", country: "\u{1F1EE}\u{1F1F8} Iceland" }),
    "Reykjavik"
  );
  // A country merely containing "usa" must not be treated as the USA
  assert.strictEqual(
    lib.getDisplayName({ name: "Somewhere", country: "Usaland", state: "ZZ" }),
    "Somewhere"
  );
});

test("getDisplayName never emits a dangling comma or undefined", () => {
  assert.strictEqual(
    lib.getDisplayName({ name: "Honolulu", country: "\u{1F1FA}\u{1F1F8} USA" }),
    "Honolulu"
  );
  assert.strictEqual(lib.getDisplayName({ name: "Kyoto" }), "Kyoto");
});

test("getLightboxSrc / getLightboxCaption handle string and object photos", () => {
  assert.strictEqual(lib.getLightboxSrc("a.jpg"), "a.jpg");
  assert.strictEqual(lib.getLightboxSrc({ src: "b.jpg" }), "b.jpg");
  assert.strictEqual(lib.getLightboxCaption("a.jpg"), "");
  assert.strictEqual(lib.getLightboxCaption({ src: "b.jpg" }), "");
  assert.strictEqual(
    lib.getLightboxCaption({ src: "b.jpg", location: "Rome" }),
    "Rome"
  );
});

test("compareVisited: TBD sorts first for newest, last for oldest", () => {
  const tbd = { name: "T", date: "TBD" };
  const dated = { name: "D", date: "2020-01-01" };
  assert.ok(lib.compareVisited("newest")(tbd, dated) < 0);
  assert.ok(lib.compareVisited("newest")(dated, tbd) > 0);
  assert.ok(lib.compareVisited("oldest")(tbd, dated) > 0);
  assert.ok(lib.compareVisited("oldest")(dated, tbd) < 0);
});

test("compareVisited: newest/oldest order dated items correctly", () => {
  const older = { name: "O", date: "2019-01-01" };
  const newer = { name: "N", date: "2023-01-01" };
  assert.ok(lib.compareVisited("newest")(newer, older) < 0);
  assert.ok(lib.compareVisited("oldest")(older, newer) < 0);
});

test("compareVisited: az / za and equal-name fallback", () => {
  const a = { name: "Alpha", date: "x" };
  const b = { name: "Beta", date: "x" };
  assert.ok(lib.compareVisited("az")(a, b) < 0);
  assert.ok(lib.compareVisited("za")(a, b) > 0);
  const same = { name: "Same", date: "x" };
  assert.strictEqual(lib.compareVisited("unknown")(same, same), 0);
});

test("comparePlanned: default asc, za desc", () => {
  const a = { name: "Alpha" };
  const b = { name: "Beta" };
  assert.ok(lib.comparePlanned("az")(a, b) < 0);
  assert.ok(lib.comparePlanned("newest")(a, b) < 0);
  assert.ok(lib.comparePlanned("za")(a, b) > 0);
});

test("nextIndex / prevIndex wrap around", () => {
  assert.strictEqual(lib.nextIndex(0, 3), 1);
  assert.strictEqual(lib.nextIndex(2, 3), 0);
  assert.strictEqual(lib.prevIndex(0, 3), 2);
  assert.strictEqual(lib.prevIndex(1, 3), 0);
});
