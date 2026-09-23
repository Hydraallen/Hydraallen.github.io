// ==========================================
// js/scripts_profile.js
// Index page renderer: every CV section is rendered from data/profile/*.json.
// 首页渲染器：所有简历内容均来自 data/profile/*.json，HTML 中只保留容器。
//
// Dual-environment:
//   - Browser: loaded at the end of <body> AFTER js/lib.js (escapeHtml),
//     js/i18n.js (t, pick, formatMonth, ...) and js/scripts.js (setupToggle).
//   - Node (tests): requires ./lib.js and ./i18n.js and exports the builders;
//     the DOMContentLoaded bootstrap is guarded by `typeof document`.
//
// Data contract (each list file is {"schema":1,"items":[...]}):
//   profile.json is a single object (a {"items":[obj]} wrapper is also accepted).
//   Every item: id, visible (false = not rendered), featured (false = collapsed
//   under "Show More"). Field names per file: see the build*Html functions.
// ==========================================

// --- Shared helpers (Node require vs browser globals) / 共享函数 ---
var _profileLib =
  typeof module !== "undefined" && module.exports
    ? require("./lib.js")
    : { escapeHtml: escapeHtml };
var _profileI18n =
  typeof module !== "undefined" && module.exports
    ? require("./i18n.js")
    : { t: t, pick: pick, getLang: getLang, formatMonth: formatMonth, formatMonthRange: formatMonthRange };

// Files under data/profile/ (tests assert the directory matches this list).
var PROFILE_FILES = [
  "profile",
  "experience",
  "research",
  "publications",
  "education",
  "awards",
  "skills",
  "projects",
  "activities",
];
var PROFILE_DATA_DIR = "../data/profile/";

var PROFILE_COLLAPSED_CLASS = "profile-collapsed";
var PROFILE_ICON_GITHUB = "https://cdn-icons-png.flaticon.com/512/25/25231.png";
var PROFILE_ICON_SITE = "https://cdn-icons-png.flaticon.com/128/2406/2406849.png";
var PROFILE_TYPING_SVG_BASE =
  "https://readme-typing-svg.herokuapp.com?color=%23FFFF00&center=false&vCenter=true&width=400";
var PROFILE_PUB_STATUSES = ["preprint", "published"];
var PROFILE_AWARD_KINDS = ["award", "honor", "scholarship", "software-copyright", "certification"];
var PROFILE_AWARD_LEVELS = ["international", "national", "regional", "university", "college"];
var PROFILE_META_SEP = " · ";

// Numbers worth bolding: 35%, 1,200, 3.5, 2,000+, 10x, 5倍 ... but not the
// digits inside identifiers such as SAM2 / Mind2Web / 3D.
// 需要加粗的数字（不含 SAM2、Mind2Web、3D 这类标识符中的数字）。
var PROFILE_METRIC_RE = /(?<![A-Za-z0-9_.])\d+(?:[.,]\d+)*(?:%|\+|×|倍|万|亿|[xXkKMB])?(?![A-Za-z0-9])/g;
// Bare years / year.month ("2024", "2023.09") are dates, not metrics.
// 年份与“年.月”是日期而非指标，不加粗。
var PROFILE_YEAR_RE = /^(19|20)\d{2}(\.(0[1-9]|1[0-2]))?$/;

// ==========================================
// 1. Small helpers / 小工具
// ==========================================

function esc(value) {
  return _profileLib.escapeHtml(value);
}

function pickEsc(field, lang) {
  return esc(_profileI18n.pick(field, lang));
}

function visibleItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item && item.visible !== false);
}

function itemClass(base, item, collapsedClass) {
  return item && item.featured === false ? base + " " + collapsedClass : base;
}

function listSep(lang) {
  return _profileI18n.t("index.edu.list_sep", lang);
}

// Only http(s), mailto and same-site relative URLs survive; everything else
// (javascript:, data:, protocol-relative //host) becomes "".
// 只允许 http(s)、mailto 与站内相对路径。
function safeUrl(url) {
  if (typeof url !== "string") return "";
  var trimmed = url.trim();
  if (trimmed === "" || /[\u0000-\u001F\u007F]/.test(trimmed)) return "";
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "";
  return trimmed;
}

// Escape `text` and wrap metric-like numbers in <strong>. Works on the RAW
// text so entity digits (&#39;) can never be matched.
// 先切分再逐段转义，避免匹配到 &#39; 这类实体中的数字。
function highlightMetrics(text) {
  if (text === null || text === undefined) return "";
  var raw = String(text);
  var out = "";
  var last = 0;
  raw.replace(PROFILE_METRIC_RE, function (match, offset) {
    if (PROFILE_YEAR_RE.test(match)) return match;
    out += esc(raw.slice(last, offset)) + "<strong>" + esc(match) + "</strong>";
    last = offset + match.length;
    return match;
  });
  return out + esc(raw.slice(last));
}

// readme-typing-svg URL; spaces become "+", ";" separates lines so a ";"
// inside a line is percent-encoded.
function buildTypingSvgUrl(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  var encoded = lines.map((line) => encodeURIComponent(String(line)).replace(/%20/g, "+"));
  return PROFILE_TYPING_SVG_BASE + "&lines=" + encoded.join(";");
}

// Button / link label for a link kind. Literal t() calls keep the keys
// discoverable by the unused-key guardrail.
function linkLabel(kind, lang) {
  switch (kind) {
    case "github":
      return _profileI18n.t("index.project.github", lang);
    case "site":
      return _profileI18n.t("index.project.live_site", lang);
    case "arxiv":
    case "doi":
      return _profileI18n.t("index.pub.link." + kind, lang);
    default:
      return "";
  }
}

function safeLinks(links) {
  return (Array.isArray(links) ? links : []).filter(
    (link) => link && safeUrl(link.url) && linkLabel(link.kind, "en")
  );
}

function externalAnchor(url, cls, innerHtml) {
  return (
    '<a href="' + esc(safeUrl(url)) + '" class="' + cls + '" target="_blank" rel="noopener noreferrer">' +
    innerHtml + "</a>"
  );
}

// Plain text links for cards / publications.
function buildInlineLinksHtml(links, lang) {
  var html = safeLinks(links)
    .map((link) => externalAnchor(link.url, "inline-link", esc(linkLabel(link.kind, lang))))
    .join(" ");
  return html ? '<p class="profile-links">' + html + "</p>" : "";
}

// Gallery buttons with icons (existing .project-links .btn styling).
function buildButtonLinksHtml(links, lang) {
  return safeLinks(links)
    .map((link) => {
      var isSite = link.kind !== "github";
      var icon = isSite ? PROFILE_ICON_SITE : PROFILE_ICON_GITHUB;
      var inner = '<img src="' + icon + '" alt="" class="btn-icon">' + esc(linkLabel(link.kind, lang));
      return externalAnchor(link.url, isSite ? "btn live-site-btn" : "btn", inner);
    })
    .join("");
}

function buildTechTagsHtml(tech, lang) {
  if (!Array.isArray(tech) || tech.length === 0) return "";
  var label = esc(_profileI18n.t("index.exp.tech", lang));
  var tags = tech.map((name) => '<li class="tech-tag">' + esc(name) + "</li>").join("");
  return '<ul class="tech-tags" aria-label="' + label + '">' + tags + "</ul>";
}

function buildBulletsHtml(bullets, lang) {
  if (!Array.isArray(bullets) || bullets.length === 0) return "";
  var items = bullets.map((b) => "<li>" + highlightMetrics(_profileI18n.pick(b, lang)) + "</li>").join("");
  return '<ul class="experience-bullets">' + items + "</ul>";
}

// Shared .education-card shell (timeline dot + header + details).
function buildCardShellHtml(cls, heading, dateText, detailsHtml) {
  return (
    '<div class="' + cls + '">' +
    '<div class="edu-header"><h3>' + heading + '</h3><span class="edu-date">' + esc(dateText) + "</span></div>" +
    '<div class="edu-details">' + detailsHtml + "</div>" +
    "</div>"
  );
}

// ==========================================
// 2. Section builders / 各区块构建
// ==========================================

// profile.json: {intro, typing_lines:[LT], about:[LT], languages:[str], tools:[str], social:[…]}
function buildAboutHtml(profile, lang) {
  var p = profile || {};
  var t = _profileI18n.t;
  var paragraphs = (Array.isArray(p.about) ? p.about : []).map((para) => "<p>" + pickEsc(para, lang) + "</p>");
  var rows = [
    [t("index.about.languages", lang), p.languages],
    [t("index.about.tools", lang), p.tools],
  ]
    .filter((row) => Array.isArray(row[1]) && row[1].length > 0)
    .map((row) => "<li><strong>" + esc(row[0]) + "</strong> " + esc(row[1].join(listSep(lang))) + "</li>");
  var skills = rows.length
    ? '<div class="about-skills"><h3>' + esc(t("index.about.languages_tools", lang)) + "</h3><ul>" + rows.join("") + "</ul></div>"
    : "";
  return paragraphs.join("") + skills;
}

function locationText(item, lang) {
  var parts = [];
  if (item.location) parts.push(_profileI18n.pick(item.location, lang));
  if (item.remote === true) parts.push(_profileI18n.t("index.exp.remote", lang));
  return parts.filter(Boolean).join(PROFILE_META_SEP);
}

// experience.json / activities.json item:
// {org, role, location|null, remote?, start, end|null, tech?, summary?, bullets, links?}
function buildExperienceCardHtml(item, lang) {
  var loc = locationText(item, lang);
  var details =
    '<h4 class="edu-degree">' + pickEsc(item.role, lang) + "</h4>" +
    (loc ? '<p class="edu-major">' + esc(loc) + "</p>" : "") +
    (item.summary ? '<p class="exp-summary">' + highlightMetrics(_profileI18n.pick(item.summary, lang)) + "</p>" : "") +
    buildBulletsHtml(item.bullets, lang) +
    buildTechTagsHtml(item.tech, lang) +
    buildInlineLinksHtml(item.links, lang);
  return buildCardShellHtml(
    itemClass("education-card", item, PROFILE_COLLAPSED_CLASS),
    pickEsc(item.org, lang),
    _profileI18n.formatMonthRange(item.start, item.end, lang),
    details
  );
}

function buildActivityHtml(item, lang) {
  return buildExperienceCardHtml(item, lang);
}

// research.json item: {title, org|null, role|null, start, end|null, tech?, summary?, bullets, links?}
function buildResearchCardHtml(item, lang) {
  var sub = [item.role, item.org]
    .filter(Boolean)
    .map((f) => _profileI18n.pick(f, lang))
    .join(PROFILE_META_SEP);
  var details =
    (sub ? '<h4 class="edu-degree">' + esc(sub) + "</h4>" : "") +
    (item.summary ? '<p class="exp-summary">' + highlightMetrics(_profileI18n.pick(item.summary, lang)) + "</p>" : "") +
    buildBulletsHtml(item.bullets, lang) +
    buildTechTagsHtml(item.tech, lang) +
    buildInlineLinksHtml(item.links, lang);
  return buildCardShellHtml(
    itemClass("education-card", item, PROFILE_COLLAPSED_CLASS),
    pickEsc(item.title, lang),
    _profileI18n.formatMonthRange(item.start, item.end, lang),
    details
  );
}

// publications.json item: {title:str, authors?, authorship:"co-author",
// status:"preprint"|"published", venue:LT, date:"YYYY-MM", doi?, links}
function buildPublicationHtml(item, lang) {
  var t = _profileI18n.t;
  var badges =
    (item.authorship === "co-author" ? '<span class="pub-badge">' + esc(t("index.pub.co_author", lang)) + "</span>" : "") +
    (PROFILE_PUB_STATUSES.includes(item.status)
      ? '<span class="pub-status pub-status-' + item.status + '">' + esc(t("index.pub.status." + item.status, lang)) + "</span>"
      : "");
  var meta = [_profileI18n.pick(item.venue, lang), _profileI18n.formatMonth(item.date, lang)]
    .filter(Boolean)
    .join(PROFILE_META_SEP);
  return (
    '<li class="' + itemClass("publication", item, PROFILE_COLLAPSED_CLASS) + '">' +
    '<p class="pub-title">' + pickEsc(item.title, lang) + "</p>" +
    (item.authors ? '<p class="pub-authors">' + esc(item.authors) + "</p>" : "") +
    '<p class="pub-meta">' + badges + '<span class="pub-venue">' + esc(meta) + "</span></p>" +
    buildInlineLinksHtml(item.links, lang) +
    "</li>"
  );
}

// projects.json item (gallery): {title:str|LT, description:LT, image, links:[{kind:"github"|"site", url}]}
function buildProjectPanelHtml(item, lang) {
  var title = _profileI18n.pick(item.title, lang);
  var src = safeUrl(item.image);
  var alt = _profileI18n.t("index.project.image_alt", lang, { name: title });
  return (
    '<div class="' + itemClass("project-panel", item, "hidden_project") + '">' +
    (src ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" class="project-image" loading="lazy">' : "") +
    "<h3>" + esc(title) + "</h3>" +
    "<p>" + pickEsc(item.description, lang) + "</p>" +
    '<div class="project-links">' + buildButtonLinksHtml(item.links, lang) + "</div>" +
    "</div>"
  );
}

// One skill tile; the icon is decorative (the name is in the <span>).
function buildSkillCardHtml(skill, category, hidden) {
  var src = safeUrl(skill && skill.icon);
  return (
    '<div class="skill-card' + (hidden ? " hidden-skill" : "") + '" data-category="' + esc(category) + '">' +
    (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : "") +
    "<span>" + esc(skill && skill.name) + "</span>" +
    "</div>"
  );
}

// skills.json items = tab groups {id, skills:[{name, icon}]}; the first group
// is the active tab, every other group's cards start hidden.
// Returns {tabs, cards} HTML strings.
function buildSkillGroupsHtml(groups, lang) {
  var list = visibleItems(groups).filter((g) => typeof g.id === "string" && g.id);
  var tabs = list.map((g, i) => {
    var active = i === 0;
    return (
      '<button class="tab-btn' + (active ? " active" : "") + '" type="button" role="tab" aria-selected="' +
      (active ? "true" : "false") + '" data-target="' + esc(g.id) + '">' +
      esc(_profileI18n.t("index.skills.tab." + g.id, lang)) + "</button>"
    );
  });
  var cards = list.map((g, i) =>
    (Array.isArray(g.skills) ? g.skills : []).map((s) => buildSkillCardHtml(s, g.id, i !== 0)).join("")
  );
  return { tabs: tabs.join(""), cards: cards.join("") };
}

function buildEducationLinesHtml(item, lang) {
  var t = _profileI18n.t;
  var join = (arr) => arr.map((x) => _profileI18n.pick(x, lang)).join(listSep(lang));
  var minors = Array.isArray(item.minors) ? item.minors : [];
  var courses = Array.isArray(item.coursework) ? item.coursework : [];
  return (
    (item.major ? '<p class="edu-major">' + pickEsc(item.major, lang) + "</p>" : "") +
    (item.location ? '<p class="edu-location">' + pickEsc(item.location, lang) + "</p>" : "") +
    (item.gpa ? '<p class="edu-gpa">' + esc(t("index.edu.gpa", lang, { gpa: item.gpa })) + "</p>" : "") +
    (minors.length ? '<p class="edu-minor">' + esc(t("index.edu.minors", lang, { list: join(minors) })) + "</p>" : "") +
    (courses.length
      ? '<p class="edu-coursework">' + esc(t("index.edu.coursework", lang, { list: join(courses) })) + "</p>"
      : "")
  );
}

// education.json item: {school, degree, major|null, location|null, start, end|null,
// gpa:str|null, minors:[LT], coursework:[LT]}
function buildEducationCardHtml(item, lang) {
  return buildCardShellHtml(
    itemClass("education-card", item, "hidden-edu"),
    pickEsc(item.school, lang),
    _profileI18n.formatMonthRange(item.start, item.end, lang),
    '<h4 class="edu-degree">' + pickEsc(item.degree, lang) + "</h4>" + buildEducationLinesHtml(item, lang)
  );
}

// awards.json item: {title, kind, level|null, issuer|null, date:"YYYY-MM"|null, holder? (software-copyright)}
function buildAwardHtml(item, lang) {
  var t = _profileI18n.t;
  var tags =
    (PROFILE_AWARD_KINDS.includes(item.kind)
      ? '<span class="award-tag">' + esc(t("index.award.kind." + item.kind, lang)) + "</span>"
      : "") +
    (PROFILE_AWARD_LEVELS.includes(item.level)
      ? '<span class="award-tag award-level">' + esc(t("index.award.level." + item.level, lang)) + "</span>"
      : "");
  var date = item.date ? _profileI18n.formatMonth(item.date, lang) : "";
  var issuer = item.issuer ? '<span class="award-issuer">' + pickEsc(item.issuer, lang) + "</span>" : "";
  var holder = item.holder
    ? '<p class="award-holder">' + esc(t("index.award.holder", lang, { holder: _profileI18n.pick(item.holder, lang) })) + "</p>"
    : "";
  return (
    '<li class="' + itemClass("award-item", item, PROFILE_COLLAPSED_CLASS) + '">' +
    '<div class="award-head"><span class="award-title">' + pickEsc(item.title, lang) + "</span>" +
    (date ? '<span class="award-date">' + esc(date) + "</span>" : "") + "</div>" +
    '<p class="award-meta">' + tags + issuer + "</p>" +
    holder +
    "</li>"
  );
}

// ==========================================
// 3. Data loading / 数据加载
// ==========================================

// profile.json: bare object or {"items":[obj]}; other files: {"items":[...]}.
function normalizeProfileFile(name, json) {
  if (!json || typeof json !== "object") throw new Error(name + ".json: not an object");
  if (name === "profile") {
    var obj = Array.isArray(json.items) ? json.items[0] : json;
    if (!obj || typeof obj !== "object") throw new Error("profile.json: empty");
    return obj;
  }
  if (!Array.isArray(json.items)) throw new Error(name + ".json: items must be an array");
  return json.items;
}

async function loadProfileFile(name, fetchFn) {
  var res = await fetchFn(PROFILE_DATA_DIR + name + ".json");
  if (!res || !res.ok) throw new Error("Could not load " + name + ".json (" + (res && res.status) + ")");
  return normalizeProfileFile(name, await res.json());
}

// Loads every file in parallel. A failing file becomes null (listed in
// `errors`) so the rest of the page still renders.
// 单个文件失败只影响对应区块。
async function loadProfile(fetchFn) {
  var results = await Promise.all(
    PROFILE_FILES.map((name) =>
      loadProfileFile(name, fetchFn).catch((err) => {
        console.warn("Profile data unavailable:", name, err && err.message);
        return null;
      })
    )
  );
  return PROFILE_FILES.reduce(
    (acc, name, i) =>
      Object.assign({}, acc, {
        [name]: results[i],
        errors: results[i] === null ? acc.errors.concat(name) : acc.errors,
      }),
    { errors: [] }
  );
}

// ==========================================
// 4. Rendering / 渲染
// ==========================================

// List sections: data key -> container, builder, "Show More" button, collapsed class.
var PROFILE_LIST_SECTIONS = [
  { key: "experience", section: "experience", container: "experience-list", build: buildExperienceCardHtml, toggle: "toggleExperienceBtn", collapsed: PROFILE_COLLAPSED_CLASS },
  { key: "research", section: "research", container: "research-list", build: buildResearchCardHtml, toggle: "toggleResearchBtn", collapsed: PROFILE_COLLAPSED_CLASS },
  { key: "publications", section: "publications", container: "publications-list", build: buildPublicationHtml, toggle: "togglePublicationsBtn", collapsed: PROFILE_COLLAPSED_CLASS },
  { key: "projects", section: "projects", container: "projects-grid", build: buildProjectPanelHtml, toggle: "toggleProjectsBtn", collapsed: "hidden_project" },
  { key: "education", section: "education", container: "education-list", build: buildEducationCardHtml, toggle: "toggleEduBtn", collapsed: "hidden-edu" },
  { key: "awards", section: "awards", container: "awards-list", build: buildAwardHtml, toggle: "toggleAwardsBtn", collapsed: PROFILE_COLLAPSED_CLASS },
  { key: "activities", section: "activities", container: "activities-list", build: buildActivityHtml, toggle: "toggleActivitiesBtn", collapsed: PROFILE_COLLAPSED_CLASS },
];

function buildLoadErrorHtml(container, lang) {
  var tag = container.tagName === "UL" || container.tagName === "OL" ? "li" : "p";
  return "<" + tag + ' class="profile-error" role="alert">' + esc(_profileI18n.t("index.error.load", lang)) + "</" + tag + ">";
}

function renderListSection(doc, cfg, items, lang) {
  var container = doc.getElementById(cfg.container);
  if (!container) return;
  var btn = doc.getElementById(cfg.toggle);
  if (items === null || items === undefined) {
    container.innerHTML = buildLoadErrorHtml(container, lang);
    if (btn) btn.hidden = true;
    return;
  }
  container.innerHTML = visibleItems(items).map((item) => cfg.build(item, lang)).join("");
  if (btn) btn.hidden = !container.querySelector("." + cfg.collapsed);
}

function renderProfileHero(doc, profile, lang) {
  if (!profile) return;
  var intro = doc.getElementById("hero-intro");
  if (intro && profile.intro) intro.textContent = _profileI18n.pick(profile.intro, lang);
  var img = doc.querySelector(".typing-svg img");
  var lines = (Array.isArray(profile.typing_lines) ? profile.typing_lines : []).map((l) => _profileI18n.pick(l, lang));
  var url = buildTypingSvgUrl(lines);
  if (img && url) img.setAttribute("src", url);
}

function renderAbout(doc, profile, lang) {
  var root = doc.getElementById("about-content");
  if (!root) return;
  root.innerHTML = profile ? buildAboutHtml(profile, lang) : buildLoadErrorHtml(root, lang);
}

function renderSkills(doc, groups, lang) {
  var tabs = doc.querySelector("#skills .skills-tabs");
  var grid = doc.getElementById("skills-grid");
  if (!grid) return;
  if (!groups) {
    grid.innerHTML = buildLoadErrorHtml(grid, lang);
    if (tabs) tabs.innerHTML = "";
    return;
  }
  var html = buildSkillGroupsHtml(groups, lang);
  if (tabs) tabs.innerHTML = html.tabs;
  grid.innerHTML = html.cards;
}

// profile.json social: [{id, name, url, icon}]. External links open in a new
// tab; the single mailto entry does not. Icons are decorative (the link has
// an aria-label), unsafe URLs are dropped.
// 社交链接由 profile.json 渲染；外链新标签页打开，mailto 不开新页。
function buildSocialLinkHtml(item, lang) {
  var url = safeUrl(item && item.url);
  if (!url || !/^(https:|mailto:)/i.test(url)) return "";
  var isMail = /^mailto:/i.test(url);
  var label = isMail
    ? _profileI18n.t("index.social.email", lang)
    : _profileI18n.t("index.social.profile", lang, { name: item.name });
  return (
    '<a href="' + esc(url) + '"' +
    (isMail ? "" : ' target="_blank" rel="noopener noreferrer"') +
    ' data-social="' + esc(item.name) + '" aria-label="' + esc(label) + '">' +
    '<img src="' + esc(safeUrl(item.icon)) + '" alt="" class="icon"></a>'
  );
}

function renderSocialLinks(doc, profile, lang) {
  var box = doc.querySelector("header .social-icons");
  if (!box) return;
  var items = profile && Array.isArray(profile.social) ? profile.social : [];
  box.innerHTML = items.map((item) => buildSocialLinkHtml(item, lang)).join("");
}

function renderProfile(doc, data, lang = "en") {
  var d = data || {};
  renderProfileHero(doc, d.profile, lang);
  renderAbout(doc, d.profile, lang);
  PROFILE_LIST_SECTIONS.forEach((cfg) => renderListSection(doc, cfg, d[cfg.key], lang));
  renderSkills(doc, d.skills, lang);
  renderSocialLinks(doc, d.profile, lang);
}

// "Show More" for sections that scripts.js does not wire (projects and
// education toggles are set up by the scripts.js bootstrap).
function wireProfileToggles(doc, setupToggleFn, lang = "en") {
  if (typeof setupToggleFn !== "function") return;
  PROFILE_LIST_SECTIONS.filter((cfg) => cfg.collapsed === PROFILE_COLLAPSED_CLASS).forEach((cfg) => {
    setupToggleFn(doc, cfg.toggle, "#" + cfg.section + " ." + PROFILE_COLLAPSED_CLASS, PROFILE_COLLAPSED_CLASS, lang);
  });
}

async function initProfilePage(doc, fetchFn, lang = "en", setupToggleFn) {
  if (!doc.getElementById("experience-list")) return null;
  wireProfileToggles(doc, setupToggleFn, lang);
  var data = await loadProfile(fetchFn);
  renderProfile(doc, data, lang);
  return data;
}

// --- Browser bootstrap (guarded so Node `require` never touches the DOM) ---
if (typeof document !== "undefined" && !(typeof module !== "undefined" && module.exports)) {
  document.addEventListener("DOMContentLoaded", function () {
    initProfilePage(
      document,
      fetch,
      _profileI18n.getLang(),
      typeof setupToggle === "function" ? setupToggle : null
    );
  });
}

// --- Node export guard ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROFILE_FILES,
    safeUrl,
    highlightMetrics,
    buildTypingSvgUrl,
    buildAboutHtml,
    buildSocialLinkHtml,
    buildExperienceCardHtml,
    buildResearchCardHtml,
    buildPublicationHtml,
    buildProjectPanelHtml,
    buildSkillGroupsHtml,
    buildSkillCardHtml,
    buildEducationCardHtml,
    buildAwardHtml,
    buildActivityHtml,
    loadProfile,
    renderProfile,
    wireProfileToggles,
    initProfilePage,
  };
}
