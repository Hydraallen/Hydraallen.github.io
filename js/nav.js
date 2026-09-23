// ==========================================
// js/nav.js
// Single source of truth for the primary navigation sidebar.
//
// Dual-environment:
//   - Browser: registers a DOMContentLoaded listener that SYNCHRONOUSLY injects
//     the <nav id="primary-nav"> into the `#nav-placeholder` element on each
//     page. This file MUST be loaded AFTER js/lib.js and BEFORE js/scripts.js so
//     that its DOMContentLoaded listener runs first and the nav already exists
//     in the DOM when scripts.js's setupHamburgerMenu() queries for it.
//   - Node (tests): the module.exports guard at the bottom exports the pure
//     buildNavHtml()/getCurrentPage() helpers; no DOM side effects on require.
//   - i18n: labels come from js/i18n.js (loaded in <head>); links carry ?lang=
//     and a language switch is appended below the list.
//     导航文案来自 i18n 词典；链接携带 ?lang=；列表下方附语言切换。
// ==========================================

"use strict";

// --- Resolve i18n + escaping helpers (Node require vs browser globals) ---
var _navI18n =
  typeof module !== "undefined" && module.exports
    ? require("./i18n.js")
    : { t: t, withLangParam: withLangParam, htmlLangFor: htmlLangFor, getLang: getLang };
var _navEscape =
  typeof module !== "undefined" && module.exports
    ? require("./lib.js").escapeHtml
    : escapeHtml;

// Icon base (icons8 outlined black icons, matching the previous inline nav).
var ICON = {
  about: "https://img.icons8.com/ios-filled/50/000000/user.png",
  experience: "https://img.icons8.com/ios-filled/50/000000/briefcase.png",
  research: "https://img.icons8.com/ios-filled/50/000000/microscope.png",
  projects: "https://img.icons8.com/ios-filled/50/000000/task.png",
  skills: "https://img.icons8.com/ios-filled/50/000000/combo-chart.png",
  education: "https://img.icons8.com/ios-filled/50/000000/graduation-cap.png",
  awards: "https://img.icons8.com/ios-filled/50/000000/trophy.png",
  movies: "https://img.icons8.com/ios-filled/50/000000/film-reel.png",
  travel: "https://img.icons8.com/ios-filled/50/000000/camera.png",
  contact: "https://img.icons8.com/ios-filled/50/000000/new-post.png",
};

// Normalize a location.pathname into one of the known page keys.
// trip.html is a detail view under Travel in the information architecture, so it
// maps to the same key and keeps the Travel entry highlighted (no extra item).
function getCurrentPage(pathname) {
  var path = pathname || "";
  if (/movies\.html$/.test(path)) return "movies.html";
  if (/travel\.html$/.test(path)) return "travel.html";
  if (/trip\.html$/.test(path)) return "travel.html";
  if (/404\.html$/.test(path)) return "404";
  return "index.html";
}

// Nav entries in display order: [page key or null, href, icon key, label].
// Labels are literal t("nav.…") calls so the unused-key guardrail can see them.
// 导航条目（按显示顺序）；文案使用字面量 t() 调用，便于词典未用 key 校验。
function navItems(lang) {
  var t = _navI18n.t;
  return [
    [null, "index.html#about", "about", t("nav.about", lang)],
    [null, "index.html#experience", "experience", t("nav.experience", lang)],
    [null, "index.html#research", "research", t("nav.research", lang)],
    [null, "index.html#projects", "projects", t("nav.projects", lang)],
    [null, "index.html#skills", "skills", t("nav.skills", lang)],
    [null, "index.html#education", "education", t("nav.education", lang)],
    [null, "index.html#awards", "awards", t("nav.awards", lang)],
    ["movies.html", "movies.html", "movies", t("nav.movies", lang)],
    ["travel.html", "travel.html", "travel", t("nav.travel", lang)],
    [null, "index.html#contact", "contact", t("nav.contact", lang)],
  ];
}

// Build a single <li> nav entry. Icons are decorative (alt=""/aria-hidden).
function navLink(href, iconSrc, label, isCurrent) {
  var attrs = isCurrent
    ? ' class="active-nav-item" aria-current="page"'
    : "";
  return (
    "      <li>\n" +
    '        <a href="' +
    _navEscape(href) +
    '"' +
    attrs +
    ">\n" +
    '          <img src="' +
    iconSrc +
    '" alt="" aria-hidden="true">\n' +
    "          " +
    _navEscape(label) +
    "\n" +
    "        </a>\n" +
    "      </li>"
  );
}

// Language switch: plain links (full reload) that keep the current query/hash,
// e.g. "?place=nyc" -> "?place=nyc&lang=zh". Each name is shown in its own
// language and tagged with lang/hreflang; the active one has aria-current.
// 语言切换：普通链接整页刷新，保留当前查询参数与锚点。
function buildLangSwitchHtml(lang, currentHref) {
  var links = ["en", "zh"].map(function (code) {
    var name = _navI18n.t("lang.name." + code, lang);
    var tag = _navI18n.htmlLangFor(code);
    return (
      '<a href="' +
      _navEscape(_navI18n.withLangParam(currentHref || "", code)) +
      '" hreflang="' +
      tag +
      '" lang="' +
      tag +
      '"' +
      (code === lang ? ' aria-current="true"' : "") +
      ' aria-label="' +
      _navEscape(_navI18n.t("lang.switch_to", lang, { name: name })) +
      '">' +
      _navEscape(name) +
      "</a>"
    );
  });
  return (
    '    <div class="lang-switch" role="group" aria-label="' +
    _navEscape(_navI18n.t("lang.label", lang)) +
    '">\n      ' +
    links.join('\n      <span class="lang-sep" aria-hidden="true">/</span>\n      ') +
    "\n    </div>\n"
  );
}

// Pure function: returns the full <nav> markup string for the given page.
// Anchor links use the absolute `index.html#section` form so they work from
// every page (index and sub-pages). The current page's own link carries
// aria-current="page" and points at itself (never the href="#" anti-pattern).
// `lang` (default "en"): label language; when passed explicitly, every link
// carries ?lang=<lang>. `currentHref` ("?query#hash" of the current page) is
// what the language switch rewrites.
function buildNavHtml(currentPage, lang, currentHref) {
  var page = currentPage || "index.html";
  var activeLang = lang || "en";
  var linkFor = function (href) {
    return lang ? _navI18n.withLangParam(href, lang) : href;
  };

  var items = navItems(activeLang).map(function (item) {
    return navLink(
      linkFor(item[1]),
      ICON[item[2]],
      item[3],
      item[0] !== null && item[0] === page
    );
  });

  return (
    '<nav id="primary-nav" class="hidden-nav" aria-label="' +
    _navEscape(_navI18n.t("nav.label", activeLang)) +
    '">\n' +
    '    <div class="profile-picture">\n' +
    '      <img src="./img/avatar.jpg" alt="' +
    _navEscape(_navI18n.t("nav.avatar_alt", activeLang)) +
    '">\n' +
    "    </div>\n" +
    // Right under the avatar so short desktop viewports see it without scrolling.
    // 放在头像下方：矮屏桌面无需滚动即可看到。
    buildLangSwitchHtml(activeLang, currentHref) +
    '    <ul class="navigation">\n' +
    items.join("\n") +
    "\n" +
    "    </ul>\n" +
    "  </nav>"
  );
}

// Synchronously replace the placeholder element with the built nav markup.
function injectNav(doc, pathname, lang, currentHref) {
  var placeholder = doc.getElementById("nav-placeholder");
  if (!placeholder) return null;
  placeholder.outerHTML = buildNavHtml(getCurrentPage(pathname), lang, currentHref);
  return doc.getElementById("primary-nav");
}

// --- Browser bootstrap (guarded so Node `require` never touches the DOM) ---
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var loc = typeof window !== "undefined" && window.location ? window.location : null;
    var pathname = loc ? loc.pathname : "";
    var currentHref = loc ? loc.search + loc.hash : "";
    injectNav(document, pathname, _navI18n.getLang(), currentHref);
  });
}

// --- Node export guard ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getCurrentPage: getCurrentPage,
    buildNavHtml: buildNavHtml,
    buildLangSwitchHtml: buildLangSwitchHtml,
    injectNav: injectNav,
  };
}
