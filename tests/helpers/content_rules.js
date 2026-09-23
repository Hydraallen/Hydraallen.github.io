"use strict";

// ==========================================
// tests/helpers/content_rules.js
// Shared, pure guardrail rules used by the i18n / content tests.
// 共享的内容校验规则：词典、HTML data-i18n、本地化文本、日期、数字一致性、术语表。
// Every rule returns an array of human-readable error strings ([] = OK) so a
// test can assert `deepStrictEqual(errors, [])` and print every problem at once.
// ==========================================

const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..", "..");
const LANGS = ["en", "zh"];
const EN_SOURCES = ["tex", "translated", "official"];

// Strings files and the key prefixes each one may own.
// 每个词典文件只能包含自己命名空间前缀的 key。
const STRINGS_FILES = {
  common: { file: "js/i18n/strings.common.js", prefixes: ["nav.", "footer.", "lang.", "meta.", "common."] },
  index: { file: "js/i18n/strings.index.js", prefixes: ["index."] },
  travel: { file: "js/i18n/strings.travel.js", prefixes: ["travel.", "trip.", "country.", "state."] },
  misc: { file: "js/i18n/strings.misc.js", prefixes: ["movies.", "notfound."] },
};

const HTML_PAGES = ["index.html", "movies.html", "travel.html", "trip.html", "404.html"];

// Keys built at runtime (e.g. t("country." + code)) cannot be found by a
// literal scan; the unused-key rule treats these prefixes as used. Keep this
// list minimal: every entry must be concatenated in js/** (enforced by
// tests/i18n_strings.test.js). Keys also covered elsewhere are noted.
// 运行时拼接的 key 前缀（字面量扫描无法发现）；保持最小，且每项须在 js/** 中真实拼接。
const DYNAMIC_KEY_PREFIXES = [
  "country.", // lib.js countryLabel: place.country_code (data completeness tested in i18n_strings)
  "state.", // lib.js placeDisplayName: place.state (data completeness tested in i18n_strings)
  "lang.name.", // nav.js language switch: one per SUPPORTED_LANGS entry
  "trip.stop_type.", // lib.js stopTypeMeta: stops[].type from data/trips
  "index.skills.tab.", // scripts_profile.js skills tabs: skills.json group id
  "index.award.kind.", // scripts_profile.js awards: awards.json kind enum
  "index.award.level.", // scripts_profile.js awards: awards.json level enum
  "index.pub.status.", // scripts_profile.js publications: status enum
  "index.pub.link.", // scripts_profile.js publications: links[].kind enum
];

// ---------------------------------------------------------------------------
// Dictionary rules
// ---------------------------------------------------------------------------
function loadStringsFile(name) {
  return require(path.join(ROOT, STRINGS_FILES[name].file));
}

// Merge all strings files; duplicates across files are reported, not merged.
function loadAllStrings() {
  const dict = {};
  const duplicates = [];
  Object.keys(STRINGS_FILES).forEach((name) => {
    const part = loadStringsFile(name);
    Object.keys(part).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(dict, key)) duplicates.push(key);
      dict[key] = part[key];
    });
  });
  return { dict, duplicates };
}

function paramsOf(str) {
  const names = new Set();
  String(str).replace(/\{(\w+)\}/g, (_, name) => names.add(name));
  return [...names].sort();
}

// Every key: exactly {en, zh}, both non-empty strings, identical {param} sets.
function checkDict(dict) {
  const errors = [];
  Object.keys(dict).forEach((key) => {
    const entry = dict[key];
    if (!entry || typeof entry !== "object") {
      errors.push(`${key}: entry must be an object {en, zh}`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !LANGS.includes(k));
    if (extra.length) errors.push(`${key}: unexpected fields ${extra.join(",")}`);
    LANGS.forEach((lang) => {
      if (typeof entry[lang] !== "string" || entry[lang].trim() === "") {
        errors.push(`${key}: missing/empty "${lang}"`);
      }
    });
    if (typeof entry.en === "string" && typeof entry.zh === "string") {
      const en = paramsOf(entry.en).join(",");
      const zh = paramsOf(entry.zh).join(",");
      if (en !== zh) errors.push(`${key}: param mismatch en{${en}} zh{${zh}}`);
    }
  });
  return errors;
}

function checkNamespacePrefixes(name, dict) {
  const prefixes = STRINGS_FILES[name].prefixes;
  return Object.keys(dict)
    .filter((key) => !prefixes.some((p) => key.startsWith(p)))
    .map((key) => `${STRINGS_FILES[name].file}: key "${key}" outside ${prefixes.join("|")}`);
}

function findUnusedKeys(dict, usedKeys, dynamicPrefixes) {
  const used = new Set(usedKeys);
  const prefixes = dynamicPrefixes || DYNAMIC_KEY_PREFIXES;
  return Object.keys(dict).filter(
    (key) => !used.has(key) && !prefixes.some((p) => key.startsWith(p))
  );
}

// ---------------------------------------------------------------------------
// HTML / JS key extraction
// ---------------------------------------------------------------------------
const normalizeWs = (s) => String(s).replace(/\s+/g, " ").trim();

function parseAttrSpec(spec) {
  return String(spec)
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      return { attr: pair.slice(0, idx).trim(), key: pair.slice(idx + 1).trim() };
    });
}

// Returns every translatable slot of a page with its static English fallback.
function extractHtmlI18n(html) {
  const doc = new JSDOM(html).window.document;
  const slots = [];
  const childViolations = [];
  doc.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (el.children.length > 0) childViolations.push(key);
    slots.push({ key, kind: "text", fallback: normalizeWs(el.textContent) });
  });
  doc.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    parseAttrSpec(el.getAttribute("data-i18n-attr")).forEach(({ attr, key }) => {
      slots.push({ key, kind: "attr", attr, fallback: normalizeWs(el.getAttribute(attr) || "") });
    });
  });
  const titleKey = doc.documentElement.getAttribute("data-i18n-title");
  if (titleKey) {
    const titleEl = doc.querySelector("title");
    slots.push({ key: titleKey, kind: "title", fallback: normalizeWs(titleEl ? titleEl.textContent : "") });
  }
  const headScripts = [...doc.head.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
  const allScripts = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
  const stringsFiles = allScripts.filter((src) => /^js\/i18n\/strings\.\w+\.js$/.test(src));
  return { doc, slots, childViolations, headScripts, allScripts, stringsFiles, titleKey };
}

// Literal keys passed to t("...") / t('...') anywhere in a JS source.
// Concatenated keys (t("country." + code)) are dynamic and skipped here; they
// must use a prefix listed in DYNAMIC_KEY_PREFIXES.
function extractJsTKeys(source) {
  const keys = [];
  const re = /\bt\(\s*["']([A-Za-z0-9_.-]+)["']\s*[,)]/g;
  let m;
  while ((m = re.exec(source)) !== null) keys.push(m[1]);
  return keys;
}

function listFiles(dir, predicate) {
  const out = [];
  const walk = (d) => {
    fs.readdirSync(d, { withFileTypes: true }).forEach((ent) => {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (!predicate || predicate(full)) out.push(full);
    });
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------------------
// Localized data rules (LocalizedText = {en, zh, en_source?})
// ---------------------------------------------------------------------------
function isLocalizedText(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && "en" in value && "zh" in value;
}

function checkLocalizedText(value, where) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [`${where}: expected LocalizedText {en, zh}`];
  }
  const errors = [];
  const extra = Object.keys(value).filter((k) => !["en", "zh", "en_source"].includes(k));
  if (extra.length) errors.push(`${where}: unexpected keys ${extra.join(",")}`);
  LANGS.forEach((lang) => {
    if (typeof value[lang] !== "string" || value[lang].trim() === "") {
      errors.push(`${where}: missing/empty "${lang}"`);
    }
  });
  if ("en_source" in value && !EN_SOURCES.includes(value.en_source)) {
    errors.push(`${where}: en_source must be one of ${EN_SOURCES.join("|")}`);
  }
  return errors;
}

// `localized`: fields that MUST be LocalizedText (or an array of them).
// `plainAllowed`: proper-noun fields that may be a plain string OR LocalizedText.
function checkLocalizedFields(obj, spec, where) {
  const errors = [];
  (spec.localized || []).forEach((field) => {
    if (!(field in obj) || obj[field] === null) return;
    const value = obj[field];
    if (Array.isArray(value)) {
      value.forEach((item, i) => errors.push(...checkLocalizedText(item, `${where}.${field}[${i}]`)));
    } else {
      errors.push(...checkLocalizedText(value, `${where}.${field}`));
    }
  });
  (spec.plainAllowed || []).forEach((field) => {
    const value = obj[field];
    if (value === undefined || value === null || typeof value === "string") return;
    errors.push(...checkLocalizedText(value, `${where}.${field}`));
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const isYearMonth = (s) => typeof s === "string" && YEAR_MONTH_RE.test(s);
const isIsoDay = (s) => typeof s === "string" && ISO_DAY_RE.test(s);

// kind: "month" (CV, YYYY-MM) or "day" (travel/trip/movies, YYYY-MM-DD).
// `end` must be present as a key; null means "present"/open-ended.
function checkDateRange(obj, where, kind) {
  const valid = kind === "day" ? isIsoDay : isYearMonth;
  const errors = [];
  if (!valid(obj.start)) errors.push(`${where}.start: invalid ${kind} "${obj.start}"`);
  if (!("end" in obj)) errors.push(`${where}.end: must be explicit (use null for present)`);
  else if (obj.end !== null && !valid(obj.end)) errors.push(`${where}.end: invalid ${kind} "${obj.end}"`);
  else if (obj.end !== null && valid(obj.start) && obj.start > obj.end) {
    errors.push(`${where}: start ${obj.start} after end ${obj.end}`);
  }
  return errors;
}

// Items must be sorted by start descending (newest first).
function checkSortedByStartDesc(items, where) {
  const errors = [];
  for (let i = 1; i < items.length; i++) {
    if (String(items[i - 1].start) < String(items[i].start)) {
      errors.push(`${where}: "${items[i].id}" (${items[i].start}) should come before "${items[i - 1].id}"`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Number parity between en and zh
// ---------------------------------------------------------------------------
function numberMultiset(text) {
  const stripped = String(text).replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  const nums = stripped.match(/\d+(?:\.\d+)?/g) || [];
  return nums.map((n) => String(Number(n))).sort();
}

function checkNumberParity(value, where) {
  const en = numberMultiset(value.en).join(",");
  const zh = numberMultiset(value.zh).join(",");
  return en === zh ? [] : [`${where}: numbers differ en[${en}] zh[${zh}]`];
}

// An entry may opt out with num_check:false, but only with a reason.
function checkNumCheckFlag(entry, where) {
  if (entry.num_check === false && !(typeof entry.num_check_reason === "string" && entry.num_check_reason.trim())) {
    return [`${where}: num_check:false requires num_check_reason`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Glossary: {terms:[{en, zh}], forbidden:[{pattern, flags?, reason}]}
// ---------------------------------------------------------------------------
function checkGlossary(glossary, value, where) {
  const errors = [];
  const en = String(value.en || "");
  const zh = String(value.zh || "");
  (glossary.terms || []).forEach((term) => {
    const hasEn = en.toLowerCase().includes(String(term.en).toLowerCase());
    const hasZh = zh.includes(term.zh);
    if (hasEn !== hasZh) {
      errors.push(`${where}: glossary "${term.en}" ↔ "${term.zh}" appears on one side only`);
    }
  });
  (glossary.forbidden || []).forEach((rule) => {
    const re = new RegExp(rule.pattern, rule.flags || "");
    if (re.test(en) || re.test(zh)) errors.push(`${where}: forbidden /${rule.pattern}/ (${rule.reason})`);
  });
  return errors;
}

module.exports = {
  ROOT,
  LANGS,
  EN_SOURCES,
  STRINGS_FILES,
  HTML_PAGES,
  DYNAMIC_KEY_PREFIXES,
  loadStringsFile,
  loadAllStrings,
  paramsOf,
  checkDict,
  checkNamespacePrefixes,
  findUnusedKeys,
  normalizeWs,
  parseAttrSpec,
  extractHtmlI18n,
  extractJsTKeys,
  listFiles,
  isLocalizedText,
  checkLocalizedText,
  checkLocalizedFields,
  isYearMonth,
  isIsoDay,
  checkDateRange,
  checkSortedByStartDesc,
  numberMultiset,
  checkNumberParity,
  checkNumCheckFlag,
  checkGlossary,
};
