// ==========================================
// js/i18n.js
// Runtime i18n core (English / 简体中文). One HTML file per page; switching the
// language is a full reload with ?lang=.
// 运行时国际化核心：每页一个 HTML，切换语言 = 带 ?lang= 整页刷新。
//
// Dual-environment:
//   - Browser: loaded synchronously in <head> BEFORE js/i18n/strings.*.js.
//     Function declarations become globals (t, pick, getLang, ...). The bootstrap
//     at the bottom resolves the language immediately (sets <html lang>, hides
//     the body via .i18n-pending for non-English to avoid a flash of English),
//     and applies data-i18n translations on DOMContentLoaded.
//   - Node (tests): exports the API and auto-registers all four strings files.
// ==========================================

"use strict";

var I18N_SUPPORTED_LANGS = ["en", "zh"];
var I18N_DEFAULT_LANG = "en";
var I18N_STORAGE_KEY = "site.lang";
var I18N_PENDING_CLASS = "i18n-pending";
var I18N_PENDING_TIMEOUT_MS = 1500;
var I18N_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var I18N_RANGE_SEP = " – ";

// Registry: namespace -> dict; I18N_TABLE is the merged lookup table.
// 词典注册表：按命名空间保存，查找时使用合并后的表（每次注册都生成新对象）。
var I18N_NAMESPACES = {};
var I18N_TABLE = {};
var i18nCurrentLang = I18N_DEFAULT_LANG;
var i18nWarned = {};

// ---------------------------------------------------------------------------
// Language resolution / 语言解析
// ---------------------------------------------------------------------------

// "zh", "zh-CN", "zh_Hans" -> "zh"; "en-US" -> "en"; anything else -> null.
function normalizeLang(value) {
  if (typeof value !== "string" || value === "") return null;
  var base = value.toLowerCase().split(/[-_]/)[0];
  return I18N_SUPPORTED_LANGS.indexOf(base) !== -1 ? base : null;
}

function langFromSearch(search) {
  if (typeof search !== "string" || search === "") return null;
  try {
    return normalizeLang(new URLSearchParams(search).get("lang"));
  } catch (err) {
    return null;
  }
}

// Precedence: URL ?lang= > stored choice > first supported navigator language > en.
// 优先级：URL 参数 > localStorage > 浏览器语言（按偏好顺序取第一个支持的）> 英文。
function resolveLang(opts) {
  var o = opts || {};
  var fromUrl = langFromSearch(o.search);
  if (fromUrl) return fromUrl;
  var fromStore = normalizeLang(o.stored);
  if (fromStore) return fromStore;
  var langs = Array.isArray(o.languages) ? o.languages : [];
  for (var i = 0; i < langs.length; i++) {
    var lang = normalizeLang(langs[i]);
    if (lang) return lang;
  }
  return I18N_DEFAULT_LANG;
}

function htmlLangFor(lang) {
  return normalizeLang(lang) === "zh" ? "zh-Hans" : "en";
}

function getLang() {
  return i18nCurrentLang;
}

// ---------------------------------------------------------------------------
// Lookup / 取值
// ---------------------------------------------------------------------------

// LocalizedText {en, zh} -> string for `lang`; plain strings (proper nouns)
// pass through unchanged. Missing language falls back to English with a warning.
// 本地化字段取值：纯字符串原样返回；缺失语言时回退英文并告警一次。
function pick(field, lang) {
  if (field === null || field === undefined) return "";
  if (typeof field !== "object") return String(field);
  var l = normalizeLang(lang) || I18N_DEFAULT_LANG;
  if (typeof field[l] === "string" && field[l] !== "") return field[l];
  var fallback = typeof field.en === "string" ? field.en : "";
  var warnKey = l + "|" + fallback;
  if (!i18nWarned[warnKey] && typeof console !== "undefined") {
    i18nWarned[warnKey] = true;
    console.warn('i18n: missing "' + l + '" text, falling back to English:', fallback);
  }
  return fallback;
}

function rebuildTable(namespaces) {
  var table = {};
  Object.keys(namespaces).forEach(function (ns) {
    Object.keys(namespaces[ns]).forEach(function (key) {
      table[key] = namespaces[ns][key];
    });
  });
  return table;
}

// Register (or replace) one namespace of {key: {en, zh}} entries.
function registerStrings(ns, dict) {
  var next = Object.assign({}, I18N_NAMESPACES);
  next[ns] = Object.assign({}, dict || {});
  I18N_NAMESPACES = next;
  I18N_TABLE = rebuildTable(next);
}

// Shallow copy of the merged table (tests / debugging).
function getStrings() {
  return Object.assign({}, I18N_TABLE);
}

// Translate `key`; {name} placeholders are replaced from `params`.
// A missing key returns the key itself so gaps are visible, never blank.
// 缺失的 key 原样返回，便于发现遗漏。
function t(key, lang, params) {
  var entry = Object.prototype.hasOwnProperty.call(I18N_TABLE, key) ? I18N_TABLE[key] : null;
  if (!entry) return key;
  var l = normalizeLang(lang) || I18N_DEFAULT_LANG;
  var text = typeof entry[l] === "string" ? entry[l] : entry.en;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, function (match, name) {
    return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
  });
}

// ---------------------------------------------------------------------------
// Dates / 日期格式化
// ---------------------------------------------------------------------------

function parseYearMonth(value) {
  var m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
  return m ? { y: m[1], m: m[2] } : null;
}

function parseIsoDay(value) {
  var m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(String(value || ""));
  return m ? { y: m[1], m: m[2], d: m[3] } : null;
}

// "2025-08" -> en "Aug 2025" / zh "2025.08".
function formatMonth(value, lang) {
  var p = parseYearMonth(value);
  if (!p) return "";
  return normalizeLang(lang) === "zh" ? p.y + "." + p.m : I18N_MONTHS[Number(p.m) - 1] + " " + p.y;
}

// end === null means ongoing: "Aug 2025 – Present" / "2025.08 – 至今".
function formatMonthRange(start, end, lang) {
  var from = formatMonth(start, lang);
  if (end === null || end === undefined) return from + I18N_RANGE_SEP + t("common.present", lang);
  if (end === start) return from;
  return from + I18N_RANGE_SEP + formatMonth(end, lang);
}

// "2025-01-10" -> en "Jan 10, 2025" / zh "2025.01.10".
function formatDay(value, lang) {
  var p = parseIsoDay(value);
  if (!p) return "";
  if (normalizeLang(lang) === "zh") return p.y + "." + p.m + "." + p.d;
  return I18N_MONTHS[Number(p.m) - 1] + " " + Number(p.d) + ", " + p.y;
}

// en: "Jan 10–14, 2025" | "Jan 15 – May 17, 2025" | "Dec 30, 2024 – Jan 2, 2025"
// zh: "2025.01.10 – 01.14" | "2025.01.15 – 05.17" | "2024.12.30 – 2025.01.02"
function formatDayRange(start, end, lang) {
  var a = parseIsoDay(start);
  var b = parseIsoDay(end);
  if (!a) return "";
  if (!b || end === start) return formatDay(start, lang);
  var sameYear = a.y === b.y;
  if (normalizeLang(lang) === "zh") {
    return formatDay(start, "zh") + I18N_RANGE_SEP + (sameYear ? b.m + "." + b.d : formatDay(end, "zh"));
  }
  var monA = I18N_MONTHS[Number(a.m) - 1];
  var monB = I18N_MONTHS[Number(b.m) - 1];
  if (sameYear && a.m === b.m) return monA + " " + Number(a.d) + "–" + Number(b.d) + ", " + a.y;
  if (sameYear) return monA + " " + Number(a.d) + I18N_RANGE_SEP + monB + " " + Number(b.d) + ", " + a.y;
  return formatDay(start, "en") + I18N_RANGE_SEP + formatDay(end, "en");
}

// Movie data dates look like "Jan 12, 2024"; returns ISO "2024-01-12" or null.
function parseMovieDate(value) {
  if (typeof value !== "string") return null;
  if (parseIsoDay(value)) return value;
  var m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(value.trim());
  if (!m) return null;
  var monthIdx = I18N_MONTHS.indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase());
  if (monthIdx === -1) return null;
  var iso = m[3] + "-" + ("0" + (monthIdx + 1)).slice(-2) + "-" + ("0" + m[2]).slice(-2);
  return parseIsoDay(iso) ? iso : null;
}

// ---------------------------------------------------------------------------
// URLs / 链接
// ---------------------------------------------------------------------------

// Add or replace ?lang= on a same-site relative href, keeping other params
// (e.g. ?place=) and the #hash. External, protocol-relative, mailto: and
// pure-hash links are returned unchanged.
// 仅改写站内相对链接；外链、mailto、纯锚点保持不变。
function withLangParam(href, lang) {
  var h = typeof href === "string" ? href : "";
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h)) return h;
  var hashIdx = h.indexOf("#");
  var hash = hashIdx === -1 ? "" : h.slice(hashIdx);
  var rest = hashIdx === -1 ? h : h.slice(0, hashIdx);
  var qIdx = rest.indexOf("?");
  var pathPart = qIdx === -1 ? rest : rest.slice(0, qIdx);
  var params = new URLSearchParams(qIdx === -1 ? "" : rest.slice(qIdx + 1));
  params.set("lang", normalizeLang(lang) || I18N_DEFAULT_LANG);
  return pathPart + "?" + params.toString() + hash;
}

// ---------------------------------------------------------------------------
// DOM / 页面应用
// ---------------------------------------------------------------------------

// "placeholder:k1;aria-label:k2" -> [{attr, key}]
function parseI18nAttrSpec(spec) {
  return String(spec || "")
    .split(";")
    .map(function (pair) {
      var idx = pair.indexOf(":");
      return idx === -1 ? null : { attr: pair.slice(0, idx).trim(), key: pair.slice(idx + 1).trim() };
    })
    .filter(function (item) {
      return item && item.attr && item.key;
    });
}

// Translate static markup. textContent only (never innerHTML), so a
// translation can never inject markup.
// 只写 textContent / 属性，杜绝把译文当 HTML 解析。
function applyTranslations(doc, lang) {
  var root = doc.documentElement;
  root.setAttribute("lang", htmlLangFor(lang));
  doc.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"), lang);
  });
  doc.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
    parseI18nAttrSpec(el.getAttribute("data-i18n-attr")).forEach(function (item) {
      el.setAttribute(item.attr, t(item.key, lang));
    });
  });
  var titleKey = root.getAttribute("data-i18n-title");
  if (titleKey) doc.title = t(titleKey, lang);
}

function safeStorageGet(win) {
  try {
    return win.localStorage ? win.localStorage.getItem(I18N_STORAGE_KEY) : null;
  } catch (err) {
    return null;
  }
}

function safeStorageSet(win, lang) {
  try {
    if (win.localStorage) win.localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch (err) {
    // Storage blocked (private mode etc.): the ?lang= param still carries the choice.
  }
}

// Persist the choice and reload the current page in `lang` (keeps ?place= / #hash).
function setLang(lang, win) {
  var w = win || (typeof window !== "undefined" ? window : null);
  var l = normalizeLang(lang) || I18N_DEFAULT_LANG;
  if (!w) return l;
  safeStorageSet(w, l);
  var loc = w.location;
  var target = (loc.pathname || "") + withLangParam((loc.search || "") + (loc.hash || ""), l);
  if (typeof loc.assign === "function") loc.assign(target);
  else loc.href = target;
  return l;
}

// Resolve + apply. Called automatically in the browser (see bottom).
// Returns the resolved language.
function initI18n(win) {
  var doc = win.document;
  var search = win.location ? win.location.search : "";
  var nav = win.navigator || {};
  var languages = nav.languages && nav.languages.length ? nav.languages : [nav.language];
  var lang = resolveLang({ search: search, stored: safeStorageGet(win), languages: languages });
  i18nCurrentLang = lang;
  if (langFromSearch(search)) safeStorageSet(win, lang);

  var root = doc.documentElement;
  root.setAttribute("lang", htmlLangFor(lang));

  function reveal() {
    root.classList.remove(I18N_PENDING_CLASS);
  }
  function apply() {
    applyTranslations(doc, lang);
    reveal();
  }

  if (doc.readyState === "loading") {
    if (lang !== I18N_DEFAULT_LANG) {
      root.classList.add(I18N_PENDING_CLASS);
      // Never leave the page hidden if something below throws.
      // 兜底：即使后续脚本出错，也会在超时后显示页面。
      win.setTimeout(reveal, I18N_PENDING_TIMEOUT_MS);
    }
    doc.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
  return lang;
}

// --- Node export guard + auto-registration of all strings files ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SUPPORTED_LANGS: I18N_SUPPORTED_LANGS,
    DEFAULT_LANG: I18N_DEFAULT_LANG,
    STORAGE_KEY: I18N_STORAGE_KEY,
    normalizeLang: normalizeLang,
    resolveLang: resolveLang,
    htmlLangFor: htmlLangFor,
    getLang: getLang,
    pick: pick,
    registerStrings: registerStrings,
    getStrings: getStrings,
    t: t,
    formatMonth: formatMonth,
    formatMonthRange: formatMonthRange,
    formatDay: formatDay,
    formatDayRange: formatDayRange,
    parseMovieDate: parseMovieDate,
    withLangParam: withLangParam,
    applyTranslations: applyTranslations,
    setLang: setLang,
    initI18n: initI18n,
  };
  ["common", "index", "travel", "misc"].forEach(function (ns) {
    registerStrings(ns, require("./i18n/strings." + ns + ".js"));
  });
} else if (typeof window !== "undefined" && typeof document !== "undefined") {
  // --- Browser bootstrap (runs in <head>, before the strings files register) ---
  initI18n(window);
}
