"use strict";

// Dictionary + HTML wiring guardrails for js/i18n/strings.*.js.
// 词典完整性与 HTML data-i18n 接线校验。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("./helpers/content_rules.js");

const { dict } = rules.loadAllStrings();
const read = (rel) => fs.readFileSync(path.join(rules.ROOT, rel), "utf8");

// Keys that pages / Phase 3 renderers rely on. The skeleton must be complete
// before Phase 3 so workstreams only wire keys, never invent them.
const REQUIRED_KEYS = [
  "nav.about", "nav.experience", "nav.research", "nav.projects", "nav.skills",
  "nav.education", "nav.awards", "nav.movies", "nav.travel", "nav.contact",
  "nav.toggle", "nav.label", "nav.avatar_alt",
  "lang.label", "lang.name.en", "lang.name.zh", "lang.switch_to",
  "footer.copyright_prefix", "footer.copyright_suffix",
  "common.skip", "common.back_home", "common.show_more", "common.show_less",
  "common.present", "common.close",
  "meta.title.index", "meta.title.movies", "meta.title.travel", "meta.title.trip", "meta.title.404",
  "meta.description.index", "meta.description.movies", "meta.description.travel",
  "meta.description.trip", "meta.description.404",
  "index.section.about", "index.section.experience", "index.section.research",
  "index.section.publications", "index.section.projects", "index.section.skills",
  "index.section.education", "index.section.awards", "index.section.activities",
  "index.section.contact",
  "index.contact.intro", "index.contact.name_label", "index.contact.name_placeholder",
  "index.contact.email_label", "index.contact.email_placeholder",
  "index.contact.message_label", "index.contact.message_placeholder",
  "index.contact.submit", "index.contact.sending", "index.contact.success", "index.contact.error",
  "travel.section.visited", "travel.section.planned", "travel.empty", "travel.error",
  "travel.coming_soon", "travel.play_video", "travel.loading",
  "trip.day", "trip.photos", "trip.watch_video", "trip.back",
  "trip.error.no_place", "trip.error.load", "trip.error.not_found", "trip.error.back",
  "trip.stop_type.sight", "trip.stop_type.food", "trip.stop_type.hotel",
  "trip.stop_type.transport", "trip.stop_type.default", "trip.photo_fallback",
  "movies.heading", "movies.loading", "movies.error", "movies.error_hint",
  "movies.expand", "movies.watched", "movies.best_of", "movies.list_label", "movies.empty",
  "notfound.title", "notfound.body_1", "notfound.body_2",
];

// "🇺🇸 USA" (pre-migration) or country_code (post-migration) -> ISO alpha-2.
const COUNTRY_NAME_TO_CODE = {
  usa: "US", antarctica: "AQ", australia: "AU", germany: "DE", uae: "AE",
  ethiopia: "ET", france: "FR", iceland: "IS", china: "CN", turkey: "TR",
  japan: "JP", "czech republic": "CZ", "south korea": "KR", "new zealand": "NZ",
  norway: "NO", peru: "PE", singapore: "SG", spain: "ES", "united kingdom": "GB",
};

function travelPlaces() {
  const dir = path.join(rules.ROOT, "data", "travel");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

function countryCodeOf(place) {
  if (place.country_code) return place.country_code;
  const name = String(place.country || "").replace(/[^A-Za-z ]/g, "").trim().toLowerCase();
  return COUNTRY_NAME_TO_CODE[name] || `UNKNOWN(${place.country})`;
}

// ---------------------------------------------------------------------------
// Dictionary integrity
// ---------------------------------------------------------------------------
test("strings files: every key has non-empty en/zh with identical params", () => {
  assert.deepStrictEqual(rules.checkDict(dict), []);
});

test("strings files: no key is defined twice and namespaces own their prefixes", () => {
  assert.deepStrictEqual(rules.loadAllStrings().duplicates, []);
  Object.keys(rules.STRINGS_FILES).forEach((name) => {
    assert.deepStrictEqual(rules.checkNamespacePrefixes(name, rules.loadStringsFile(name)), []);
  });
});

test("strings files: the full key skeleton exists", () => {
  const missing = REQUIRED_KEYS.filter((k) => !(k in dict));
  assert.deepStrictEqual(missing, []);
});

test("strings files: every continent tab and sort option has a key", () => {
  const travelHtml = read("travel.html");
  const continents = [...travelHtml.matchAll(/data-continent="(\w+)"/g)].map((m) => m[1]);
  assert.ok(continents.length >= 8);
  continents.forEach((c) => assert.ok(`travel.continent.${c}` in dict, c));
  ["newest", "oldest", "az", "za"].forEach((s) => assert.ok(`travel.sort.${s}` in dict, s));
  ["en", "cn", "local"].forEach((s) => assert.ok(`travel.map_lang.${s}` in dict, s));
});

test("strings files: every travel country and US state has a name", () => {
  const places = travelPlaces();
  const missingCountries = [...new Set(places.map(countryCodeOf))].filter(
    (code) => !(`country.${code}` in dict)
  );
  assert.deepStrictEqual(missingCountries, []);
  const missingStates = [...new Set(places.filter((p) => p.state).map((p) => p.state))].filter(
    (st) => !(`state.${st}` in dict)
  );
  assert.deepStrictEqual(missingStates, []);
});

// ---------------------------------------------------------------------------
// HTML wiring
// ---------------------------------------------------------------------------
rules.HTML_PAGES.forEach((page) => {
  const info = rules.extractHtmlI18n(read(page));

  test(`${page}: i18n runtime + strings load synchronously in <head>`, () => {
    assert.strictEqual(info.headScripts[0], "js/i18n.js");
    assert.strictEqual(info.headScripts[1], "js/i18n/strings.common.js");
    info.stringsFiles.forEach((src) => assert.ok(info.headScripts.includes(src), `${src} in <head>`));
    assert.ok(info.doc.querySelector('link[href="css/styles_i18n.css"]'), "styles_i18n.css linked");
    assert.ok(info.titleKey, "html[data-i18n-title] present");
  });

  test(`${page}: every data-i18n key exists in the strings files the page loads`, () => {
    const loaded = {};
    info.stringsFiles.forEach((src) => Object.assign(loaded, require(path.join(rules.ROOT, src))));
    const missing = info.slots.map((s) => s.key).filter((k) => !(k in loaded));
    assert.deepStrictEqual(missing, []);
  });

  test(`${page}: data-i18n elements contain no child elements`, () => {
    assert.deepStrictEqual(info.childViolations, []);
  });

  test(`${page}: static English fallback equals the dictionary en value`, () => {
    const mismatches = info.slots
      .filter((s) => s.key in dict && s.fallback !== rules.normalizeWs(dict[s.key].en))
      .map((s) => `${s.key} (${s.kind}${s.attr ? ":" + s.attr : ""}): "${s.fallback}" != "${dict[s.key].en}"`);
    assert.deepStrictEqual(mismatches, []);
  });

  test(`${page}: head carries a localizable meta description`, () => {
    const meta = info.doc.querySelector('meta[name="description"]');
    assert.ok(meta && /content:meta\.description\./.test(meta.getAttribute("data-i18n-attr") || ""));
  });
});

// ---------------------------------------------------------------------------
// JS wiring
// ---------------------------------------------------------------------------
const jsFiles = rules.listFiles(path.join(rules.ROOT, "js"), (f) => f.endsWith(".js"));

test("js/**: every literal t(\"…\") key exists", () => {
  const missing = [];
  jsFiles.forEach((file) => {
    rules.extractJsTKeys(fs.readFileSync(file, "utf8")).forEach((key) => {
      if (!(key in dict)) missing.push(`${path.relative(rules.ROOT, file)}: ${key}`);
    });
  });
  assert.deepStrictEqual(missing, []);
});

test("strings files: no unused keys", () => {
  const used = [];
  jsFiles.forEach((file) => used.push(...rules.extractJsTKeys(fs.readFileSync(file, "utf8"))));
  rules.HTML_PAGES.forEach((page) => used.push(...rules.extractHtmlI18n(read(page)).slots.map((s) => s.key)));
  assert.deepStrictEqual(rules.findUnusedKeys(dict, used), []);
});

// A dynamic prefix is an exemption from the unused-key scan, so each one must
// really be concatenated at runtime (t("prefix." + x)) somewhere in js/**.
// 每个动态前缀都必须在 js/** 中真实地以字符串拼接方式使用，否则不得豁免。
test("strings files: every DYNAMIC_KEY_PREFIX is built by concatenation in js/**", () => {
  const sources = jsFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const unjustified = rules.DYNAMIC_KEY_PREFIXES.filter((prefix) => {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`\\bt\\(\\s*["']${escaped}["']\\s*\\+`).test(sources);
  });
  assert.deepStrictEqual(unjustified, []);
});

// ---------------------------------------------------------------------------
// Owner name: en UI uses the handle "Hydraallen", zh UI uses the Chinese name.
// index.hero.name is the single source; meta titles must agree with it.
// 站主姓名：英文用 Hydraallen，中文用Hydraallen；以 index.hero.name 为唯一来源。
// ---------------------------------------------------------------------------
test("owner name: zh UI strings use the Chinese name from index.hero.name", () => {
  const zhName = dict["index.hero.name"].zh;
  const enHandle = dict["index.hero.name"].en.replace(/\.$/, "");
  const ownerKeys = Object.keys(dict).filter(
    (k) => k.startsWith("meta.") || k === "nav.avatar_alt" || k === "footer.copyright_suffix"
  );
  const problems = [];
  ownerKeys.forEach((k) => {
    if (!dict[k].zh.includes(zhName)) problems.push(`${k}: zh lacks ${zhName}`);
    if (dict[k].en.includes(zhName)) problems.push(`${k}: en contains ${zhName}`);
    if (!dict[k].en.includes(enHandle)) problems.push(`${k}: en lacks ${enHandle}`);
  });
  Object.keys(dict)
    .filter((k) => k.startsWith("meta.title."))
    .forEach((k) => {
      if (!dict[k].en.endsWith(`| ${enHandle}`)) problems.push(`${k}: en must end with "| ${enHandle}"`);
      if (!dict[k].zh.endsWith(`| ${zhName}`)) problems.push(`${k}: zh must end with "| ${zhName}"`);
    });
  assert.deepStrictEqual(problems, []);
});
