"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { JSDOM } = require("jsdom");

// Require BEFORE any global.document is set so the browser bootstrap is skipped.
const i18n = require("../js/i18n.js");

// ---------------------------------------------------------------------------
// Language resolution
// ---------------------------------------------------------------------------
test("normalizeLang maps tags to supported languages", () => {
  assert.strictEqual(i18n.normalizeLang("en"), "en");
  assert.strictEqual(i18n.normalizeLang("EN-us"), "en");
  assert.strictEqual(i18n.normalizeLang("zh"), "zh");
  assert.strictEqual(i18n.normalizeLang("zh-CN"), "zh");
  assert.strictEqual(i18n.normalizeLang("zh-Hans"), "zh");
  assert.strictEqual(i18n.normalizeLang("zh_TW"), "zh");
  assert.strictEqual(i18n.normalizeLang("fr"), null);
  assert.strictEqual(i18n.normalizeLang(""), null);
  assert.strictEqual(i18n.normalizeLang(null), null);
  assert.deepStrictEqual(i18n.SUPPORTED_LANGS, ["en", "zh"]);
});

test("resolveLang precedence: URL > stored > navigator > en", () => {
  assert.strictEqual(
    i18n.resolveLang({ search: "?lang=zh", stored: "en", languages: ["en"] }),
    "zh"
  );
  assert.strictEqual(
    i18n.resolveLang({ search: "?place=nyc", stored: "zh", languages: ["en"] }),
    "zh"
  );
  assert.strictEqual(
    i18n.resolveLang({ search: "", stored: null, languages: ["zh-CN", "en"] }),
    "zh"
  );
  assert.strictEqual(
    i18n.resolveLang({ search: "", stored: null, languages: ["fr-FR", "zh-TW"] }),
    "zh"
  );
  assert.strictEqual(
    i18n.resolveLang({ search: "", stored: null, languages: ["en-US", "zh-CN"] }),
    "en"
  );
  assert.strictEqual(i18n.resolveLang({}), "en");
  assert.strictEqual(i18n.resolveLang(), "en");
});

test("resolveLang ignores invalid URL and stored values", () => {
  assert.strictEqual(
    i18n.resolveLang({ search: "?lang=de", stored: "xx", languages: ["zh"] }),
    "zh"
  );
});

test("htmlLangFor returns BCP-47 tags", () => {
  assert.strictEqual(i18n.htmlLangFor("en"), "en");
  assert.strictEqual(i18n.htmlLangFor("zh"), "zh-Hans");
  assert.strictEqual(i18n.htmlLangFor("xx"), "en");
});

// ---------------------------------------------------------------------------
// pick / t
// ---------------------------------------------------------------------------
test("pick passes plain strings through and selects localized text", () => {
  assert.strictEqual(i18n.pick("Python", "zh"), "Python");
  assert.strictEqual(i18n.pick({ en: "Intern", zh: "实习生" }, "zh"), "实习生");
  assert.strictEqual(i18n.pick({ en: "Intern", zh: "实习生" }, "en"), "Intern");
  assert.strictEqual(i18n.pick({ en: "Intern", zh: "实习生" }), "Intern");
  assert.strictEqual(i18n.pick(null, "en"), "");
  assert.strictEqual(i18n.pick(undefined, "zh"), "");
  assert.strictEqual(i18n.pick(42, "en"), "42");
});

test("pick falls back to English and warns when a language is missing", () => {
  const original = console.warn;
  const calls = [];
  console.warn = (...args) => calls.push(args);
  try {
    assert.strictEqual(i18n.pick({ en: "Only English" }, "zh"), "Only English");
  } finally {
    console.warn = original;
  }
  assert.strictEqual(calls.length, 1);
});

test("t translates registered keys with {param} interpolation", () => {
  i18n.registerStrings("__test__", {
    "__test__.hello": { en: "Hello {name}", zh: "你好 {name}" },
    "__test__.count": { en: "{n} movies, {n} total", zh: "{n} 部" },
  });
  assert.strictEqual(i18n.t("__test__.hello", "en", { name: "Ann" }), "Hello Ann");
  assert.strictEqual(i18n.t("__test__.hello", "zh", { name: "安" }), "你好 安");
  assert.strictEqual(i18n.t("__test__.count", "en", { n: 3 }), "3 movies, 3 total");
  assert.strictEqual(i18n.t("__test__.hello", "en"), "Hello {name}");
  assert.strictEqual(i18n.t("__test__.hello"), "Hello {name}");
});

test("t returns the key for missing keys and English for unknown langs", () => {
  assert.strictEqual(i18n.t("no.such.key", "zh"), "no.such.key");
  i18n.registerStrings("__test2__", { "__test2__.x": { en: "X", zh: "叉" } });
  assert.strictEqual(i18n.t("__test2__.x", "fr"), "X");
});

test("registerStrings replaces a namespace and getStrings returns a copy", () => {
  i18n.registerStrings("__ns__", { "__ns__.a": { en: "A", zh: "甲" } });
  i18n.registerStrings("__ns__", { "__ns__.b": { en: "B", zh: "乙" } });
  assert.strictEqual(i18n.t("__ns__.a", "en"), "__ns__.a");
  assert.strictEqual(i18n.t("__ns__.b", "zh"), "乙");
  const copy = i18n.getStrings();
  copy["__ns__.b"] = { en: "mutated", zh: "mutated" };
  assert.strictEqual(i18n.t("__ns__.b", "en"), "B");
});

test("all four strings files are auto-registered in Node", () => {
  assert.strictEqual(i18n.t("nav.about", "en"), "About");
  assert.strictEqual(i18n.t("nav.about", "zh"), "关于我");
  assert.notStrictEqual(i18n.t("index.section.experience", "zh"), "index.section.experience");
  assert.notStrictEqual(i18n.t("travel.section.visited", "zh"), "travel.section.visited");
  assert.notStrictEqual(i18n.t("movies.heading", "zh"), "movies.heading");
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
test("formatMonth renders YYYY-MM per language", () => {
  assert.strictEqual(i18n.formatMonth("2025-08", "en"), "Aug 2025");
  assert.strictEqual(i18n.formatMonth("2025-08", "zh"), "2025.08");
  assert.strictEqual(i18n.formatMonth("2025-08"), "Aug 2025");
  assert.strictEqual(i18n.formatMonth("bad", "en"), "");
});

test("formatMonthRange renders ranges and open-ended ranges", () => {
  assert.strictEqual(i18n.formatMonthRange("2025-08", "2025-12", "en"), "Aug 2025 – Dec 2025");
  assert.strictEqual(i18n.formatMonthRange("2025-08", "2025-12", "zh"), "2025.08 – 2025.12");
  assert.strictEqual(i18n.formatMonthRange("2025-08", null, "en"), "Aug 2025 – Present");
  assert.strictEqual(i18n.formatMonthRange("2025-08", null, "zh"), "2025.08 – 至今");
  assert.strictEqual(i18n.formatMonthRange("2024-01", "2024-01", "en"), "Jan 2024");
});

test("formatDay renders ISO days per language", () => {
  assert.strictEqual(i18n.formatDay("2025-01-10", "en"), "Jan 10, 2025");
  assert.strictEqual(i18n.formatDay("2025-01-10", "zh"), "2025.01.10");
  assert.strictEqual(i18n.formatDay("2025-13-40", "en"), "");
  assert.strictEqual(i18n.formatDay(null, "en"), "");
});

test("formatDayRange collapses shared month/year", () => {
  assert.strictEqual(i18n.formatDayRange("2025-01-10", "2025-01-14", "en"), "Jan 10–14, 2025");
  assert.strictEqual(i18n.formatDayRange("2025-01-10", "2025-01-14", "zh"), "2025.01.10 – 01.14");
  assert.strictEqual(
    i18n.formatDayRange("2025-01-15", "2025-05-17", "en"),
    "Jan 15 – May 17, 2025"
  );
  assert.strictEqual(i18n.formatDayRange("2025-01-15", "2025-05-17", "zh"), "2025.01.15 – 05.17");
  assert.strictEqual(
    i18n.formatDayRange("2024-12-30", "2025-01-02", "en"),
    "Dec 30, 2024 – Jan 2, 2025"
  );
  assert.strictEqual(
    i18n.formatDayRange("2024-12-30", "2025-01-02", "zh"),
    "2024.12.30 – 2025.01.02"
  );
  assert.strictEqual(i18n.formatDayRange("2025-05-09", null, "en"), "May 9, 2025");
  assert.strictEqual(i18n.formatDayRange("2025-05-09", "2025-05-09", "zh"), "2025.05.09");
});

test("parseMovieDate converts 'Mon D, YYYY' to ISO", () => {
  assert.strictEqual(i18n.parseMovieDate("Jan 12, 2024"), "2024-01-12");
  assert.strictEqual(i18n.parseMovieDate("Sep 5, 2023"), "2023-09-05");
  assert.strictEqual(i18n.parseMovieDate("2023-09-05"), "2023-09-05");
  assert.strictEqual(i18n.parseMovieDate("Foo 5, 2023"), null);
  assert.strictEqual(i18n.parseMovieDate(""), null);
  assert.strictEqual(i18n.parseMovieDate(undefined), null);
});

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------
test("withLangParam adds/replaces lang and keeps other params and hash", () => {
  assert.strictEqual(i18n.withLangParam("index.html#about", "zh"), "index.html?lang=zh#about");
  assert.strictEqual(
    i18n.withLangParam("trip.html?place=nyc", "zh"),
    "trip.html?place=nyc&lang=zh"
  );
  assert.strictEqual(
    i18n.withLangParam("trip.html?lang=zh&place=nyc#x", "en"),
    "trip.html?lang=en&place=nyc#x"
  );
  assert.strictEqual(i18n.withLangParam("", "zh"), "?lang=zh");
  assert.strictEqual(i18n.withLangParam("?place=a%20b", "en"), "?place=a+b&lang=en");
});

test("withLangParam leaves external and special links untouched", () => {
  assert.strictEqual(i18n.withLangParam("https://github.com/x", "zh"), "https://github.com/x");
  assert.strictEqual(i18n.withLangParam("//cdn.example/x", "zh"), "//cdn.example/x");
  assert.strictEqual(i18n.withLangParam("mailto:a@b.c", "zh"), "mailto:a@b.c");
  assert.strictEqual(i18n.withLangParam("#top", "zh"), "#top");
});

// ---------------------------------------------------------------------------
// DOM application
// ---------------------------------------------------------------------------
function makeDoc(html, attrs) {
  return new JSDOM(
    `<!DOCTYPE html><html lang="en" ${attrs || ""}><head><title>Home | Hydraallen</title>` +
      `<meta name="description" content="EN desc" data-i18n-attr="content:meta.description.index">` +
      `</head><body>${html}</body></html>`,
    { url: "https://example.test/index.html" }
  ).window;
}

test("applyTranslations sets text, attributes, title and html lang", () => {
  const win = makeDoc(
    '<p data-i18n="nav.about">About</p>' +
      '<button data-i18n-attr="aria-label:nav.toggle;title:nav.toggle">x</button>',
    'data-i18n-title="meta.title.index"'
  );
  const doc = win.document;
  i18n.applyTranslations(doc, "zh");
  assert.strictEqual(doc.querySelector("p").textContent, "关于我");
  assert.strictEqual(doc.querySelector("button").getAttribute("aria-label"), i18n.t("nav.toggle", "zh"));
  assert.strictEqual(doc.querySelector("button").getAttribute("title"), i18n.t("nav.toggle", "zh"));
  assert.strictEqual(doc.title, i18n.t("meta.title.index", "zh"));
  assert.strictEqual(
    doc.querySelector('meta[name="description"]').getAttribute("content"),
    i18n.t("meta.description.index", "zh")
  );
  assert.strictEqual(doc.documentElement.getAttribute("lang"), "zh-Hans");
});

test("applyTranslations never interprets translations as HTML", () => {
  i18n.registerStrings("__xss__", { "__xss__.k": { en: "<b>x</b>", zh: "<img src=x>" } });
  const win = makeDoc('<p data-i18n="__xss__.k">x</p>');
  i18n.applyTranslations(win.document, "zh");
  assert.strictEqual(win.document.querySelector("p img"), null);
  assert.strictEqual(win.document.querySelector("p").textContent, "<img src=x>");
});

test("initI18n resolves, persists URL lang, and removes the pending class", () => {
  const win = makeDoc('<p data-i18n="nav.about">About</p>');
  // jsdom URL with ?lang=zh; document already parsed -> apply immediately.
  win.history.replaceState(null, "", "/index.html?lang=zh");
  Object.defineProperty(win.document, "readyState", { value: "complete", configurable: true });
  const lang = i18n.initI18n(win);
  assert.strictEqual(lang, "zh");
  assert.strictEqual(i18n.getLang(), "zh");
  assert.strictEqual(win.localStorage.getItem("site.lang"), "zh");
  assert.strictEqual(win.document.documentElement.getAttribute("lang"), "zh-Hans");
  // document is already loaded in jsdom -> translations applied immediately
  assert.strictEqual(win.document.querySelector("p").textContent, "关于我");
  assert.ok(!win.document.documentElement.classList.contains("i18n-pending"));
});

test("initI18n survives a throwing localStorage", () => {
  const win = makeDoc("");
  Object.defineProperty(win, "localStorage", {
    get() {
      throw new Error("blocked");
    },
  });
  Object.defineProperty(win.navigator, "languages", { value: ["zh-CN"] });
  assert.strictEqual(i18n.initI18n(win), "zh");
});

test("initI18n adds i18n-pending until DOMContentLoaded for non-English", () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html lang="en"><head></head><body><p data-i18n="nav.travel">Travel</p></body></html>',
    { url: "https://example.test/travel.html?lang=zh" }
  );
  const win = dom.window;
  Object.defineProperty(win.document, "readyState", { value: "loading", configurable: true });
  i18n.initI18n(win);
  assert.ok(win.document.documentElement.classList.contains("i18n-pending"));
  win.document.dispatchEvent(new win.Event("DOMContentLoaded"));
  assert.ok(!win.document.documentElement.classList.contains("i18n-pending"));
  assert.strictEqual(win.document.querySelector("p").textContent, "旅行");
});

test("initI18n does not add i18n-pending for English", () => {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: "https://example.test/?lang=en",
  });
  Object.defineProperty(dom.window.document, "readyState", { value: "loading", configurable: true });
  i18n.initI18n(dom.window);
  assert.ok(!dom.window.document.documentElement.classList.contains("i18n-pending"));
});

test("setLang persists and navigates with the lang param", () => {
  const assigned = [];
  const fakeWin = {
    location: {
      pathname: "/trip.html",
      search: "?place=nyc",
      hash: "#day-2",
      assign: (url) => assigned.push(url),
    },
    localStorage: {
      store: {},
      setItem(k, v) {
        this.store[k] = v;
      },
      getItem(k) {
        return this.store[k] || null;
      },
    },
  };
  i18n.setLang("zh", fakeWin);
  assert.strictEqual(fakeWin.localStorage.store["site.lang"], "zh");
  assert.deepStrictEqual(assigned, ["/trip.html?place=nyc&lang=zh#day-2"]);
});
