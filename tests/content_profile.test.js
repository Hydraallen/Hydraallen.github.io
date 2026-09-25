"use strict";

// ==========================================
// tests/content_profile.test.js
// Guardrails for the CV-synced profile data in data/profile/*.json.
// 个人资料数据校验：结构、本地化完整性、日期、排序、数字一致性、术语表、隐私。
// Text-level sync with the CV sources lives in tools/cv_sync_check.py.
// ==========================================

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("./helpers/content_rules.js");

const PROFILE_DIR = path.join(rules.ROOT, "data", "profile");
const GLOSSARY_PATH = path.join(rules.ROOT, "data", "i18n", "glossary.json");

// Must stay in sync with PROFILE_FILES in js/scripts_profile.js.
// 与 js/scripts_profile.js 中的 PROFILE_FILES 保持一致。
const EXPECTED_FILES = [
  "activities.json",
  "awards.json",
  "education.json",
  "experience.json",
  "profile.json",
  "projects.json",
  "publications.json",
  "research.json",
  "skills.json",
];

const PUBLIC_EMAIL = "wangruiallen@gmail.com";
const OWNER_NAME_RE = /Hydraallen/i;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CV_REF_RE = /^[^/\s][^/]*(?:\/[^/]+)?$/;
const LINK_KINDS = ["github", "site", "arxiv", "doi"];
const AWARD_KINDS = ["award", "honor", "scholarship", "software-copyright", "certification"];
const AWARD_LEVELS = ["international", "national", "regional", "university", "college"];
const PUB_STATUSES = ["preprint", "published"];
const RESEARCH_KINDS = ["research", "project"];
const SKILL_TABS = ["ai", "backend", "frontend", "devops", "tools"];
const UMICH_COURSEWORK = [
  "Data Mining",
  "Natural Language Processing",
  "Applied Machine Learning",
  "Information Visualization",
];

// ---------------------------------------------------------------------------
// Per-file item schemas. `localized` = LocalizedText (or array of them),
// `nullableLocalized` = LocalizedText or null, `plain` = string fields,
// `other` = non-string fields validated elsewhere, `provenance` = fields whose
// LocalizedText must carry en_source. Any key outside these sets is an error.
// 每个文件的字段白名单；不在白名单中的 key 视为错误（防止拼写错误或内联 markup）。
// ---------------------------------------------------------------------------
const ENTRY_SPEC = {
  required: ["id", "cv_ref", "visible", "featured", "org", "role", "location", "start", "end", "bullets"],
  localized: ["org", "role", "summary", "bullets"],
  nullableLocalized: ["location", "summary"],
  plain: ["id", "cv_ref", "start", "num_check_reason"],
  other: ["visible", "featured", "end", "remote", "tech", "links", "num_check"],
  provenance: ["role", "summary", "bullets"],
};

const SPECS = {
  "experience.json": ENTRY_SPEC,
  "activities.json": ENTRY_SPEC,
  "research.json": {
    required: [...ENTRY_SPEC.required, "title", "kind"],
    localized: [...ENTRY_SPEC.localized, "title"],
    nullableLocalized: ["location", "summary", "org"],
    plain: [...ENTRY_SPEC.plain, "kind"],
    other: ENTRY_SPEC.other,
    provenance: [...ENTRY_SPEC.provenance, "title"],
  },
  "education.json": {
    required: ["id", "cv_ref", "visible", "featured", "school", "degree", "major", "location", "start", "end", "gpa", "minors", "coursework"],
    localized: ["school", "degree", "minors", "coursework"],
    nullableLocalized: ["major", "location"],
    plain: ["id", "cv_ref", "start"],
    other: ["visible", "featured", "end", "gpa"],
    provenance: ["degree", "major", "minors", "coursework"],
  },
  "publications.json": {
    required: ["id", "cv_ref", "visible", "featured", "title", "authorship", "status", "venue", "date", "doi", "arxiv", "links"],
    localized: ["venue"],
    nullableLocalized: [],
    plain: ["id", "cv_ref", "title", "authorship", "status", "date"],
    other: ["visible", "featured", "doi", "arxiv", "links"],
    provenance: [],
  },
  "awards.json": {
    required: ["id", "cv_ref", "visible", "featured", "title", "kind", "level", "issuer", "date"],
    localized: ["title"],
    nullableLocalized: ["issuer", "holder"],
    plain: ["id", "cv_ref", "kind", "num_check_reason"],
    other: ["visible", "featured", "level", "date", "num_check"],
    provenance: ["title"],
  },
  "projects.json": {
    required: ["id", "visible", "featured", "title", "description", "image", "links"],
    localized: ["description"],
    nullableLocalized: [],
    plain: ["id", "image"],
    other: ["visible", "featured", "title", "links"],
    provenance: [],
  },
};

const CV_FILES = ["experience.json", "research.json", "activities.json", "education.json", "awards.json", "publications.json"];
const START_SORTED_FILES = ["experience.json", "research.json", "activities.json", "education.json"];

// ---------------------------------------------------------------------------
// Helpers / 辅助函数
// ---------------------------------------------------------------------------
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadProfileData() {
  const data = {};
  EXPECTED_FILES.forEach((name) => {
    const full = path.join(PROFILE_DIR, name);
    if (fs.existsSync(full)) data[name] = readJson(full);
  });
  return data;
}

const DATA = loadProfileData();
const GLOSSARY = fs.existsSync(GLOSSARY_PATH) ? readJson(GLOSSARY_PATH) : { terms: [], forbidden: [] };

// Yield every LocalizedText reachable from `value` with a readable path.
// 递归遍历，产出所有 LocalizedText 及其路径。
function collectLocalized(value, where, out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectLocalized(v, `${where}[${i}]`, out));
  } else if (rules.isLocalizedText(value)) {
    out.push({ value, where });
  } else if (value && typeof value === "object") {
    Object.keys(value).forEach((k) => collectLocalized(value[k], `${where}.${k}`, out));
  }
  return out;
}

function itemsOf(name) {
  return (DATA[name] && DATA[name].items) || [];
}

function checkLinks(links, where) {
  if (links === undefined) return [];
  if (!Array.isArray(links)) return [`${where}.links: must be an array`];
  const errors = [];
  links.forEach((link, i) => {
    if (!LINK_KINDS.includes(link.kind)) errors.push(`${where}.links[${i}]: bad kind "${link.kind}"`);
    if (typeof link.url !== "string" || !/^https:\/\/[^\s"<>]+$/.test(link.url)) {
      errors.push(`${where}.links[${i}]: url must be https`);
    }
    const extra = Object.keys(link).filter((k) => !["kind", "url"].includes(k));
    if (extra.length) errors.push(`${where}.links[${i}]: unexpected keys ${extra.join(",")}`);
  });
  return errors;
}

function checkStringArray(value, where) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${where}: must be an array of strings`];
  return value
    .map((s, i) => (typeof s === "string" && s.trim() ? null : `${where}[${i}]: must be a non-empty string`))
    .filter(Boolean);
}

// Validate one item against its spec: allowed keys, required keys, types.
function checkItemShape(item, spec, where) {
  const errors = [];
  const allowed = new Set([...spec.localized, ...spec.nullableLocalized, ...spec.plain, ...spec.other]);
  Object.keys(item).forEach((k) => {
    if (!allowed.has(k)) errors.push(`${where}: unexpected field "${k}"`);
  });
  spec.required.forEach((k) => {
    if (!(k in item)) errors.push(`${where}: missing field "${k}"`);
  });
  spec.plain.forEach((k) => {
    if (k in item && (typeof item[k] !== "string" || !item[k].trim())) {
      errors.push(`${where}.${k}: must be a non-empty string`);
    }
  });
  ["visible", "featured", "remote", "num_check"].forEach((k) => {
    if (k in item && typeof item[k] !== "boolean") errors.push(`${where}.${k}: must be boolean`);
  });
  const mustBeLocalized = spec.localized.filter((k) => !spec.nullableLocalized.includes(k));
  errors.push(...rules.checkLocalizedFields(item, { localized: mustBeLocalized }, where));
  spec.nullableLocalized.forEach((k) => {
    if (k in item && item[k] !== null) {
      const value = item[k];
      if (Array.isArray(value)) value.forEach((v, i) => errors.push(...rules.checkLocalizedText(v, `${where}.${k}[${i}]`)));
      else errors.push(...rules.checkLocalizedText(value, `${where}.${k}`));
    }
  });
  mustBeLocalized.forEach((k) => {
    if (k in item && item[k] === null) errors.push(`${where}.${k}: must not be null`);
  });
  errors.push(...checkLinks(item.links, where));
  errors.push(...checkStringArray(item.tech, `${where}.tech`));
  errors.push(...rules.checkNumCheckFlag(item, where));
  return errors;
}

function checkProvenance(item, spec, where) {
  const errors = [];
  spec.provenance.forEach((k) => {
    const value = item[k];
    if (value === undefined || value === null) return;
    const list = Array.isArray(value) ? value : [value];
    list.forEach((lt, i) => {
      if (!lt || !rules.EN_SOURCES.includes(lt.en_source)) {
        errors.push(`${where}.${k}${Array.isArray(value) ? `[${i}]` : ""}: en_source required (tex|translated|official)`);
      }
    });
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Directory & file envelope / 目录与文件外壳
// ---------------------------------------------------------------------------
test("data/profile contains exactly the expected files", () => {
  const actual = fs.readdirSync(PROFILE_DIR).filter((f) => !f.startsWith(".")).sort();
  assert.deepStrictEqual(actual, [...EXPECTED_FILES].sort());
});

const scriptsProfilePath = path.join(rules.ROOT, "js", "scripts_profile.js");
test(
  "PROFILE_FILES in js/scripts_profile.js matches the data directory",
  { skip: !fs.existsSync(scriptsProfilePath) && "js/scripts_profile.js not present yet" },
  () => {
    const mod = require(scriptsProfilePath);
    assert.ok(Array.isArray(mod.PROFILE_FILES), "scripts_profile.js must export PROFILE_FILES");
    const names = mod.PROFILE_FILES.map((f) => String(f).replace(/^.*\//, "").replace(/(\.json)?$/, ".json"));
    assert.deepStrictEqual([...names].sort(), [...EXPECTED_FILES].sort());
  }
);

test("every list file has {schema:1, items:[...]} with unique kebab-case ids", () => {
  const errors = [];
  EXPECTED_FILES.filter((f) => f !== "profile.json").forEach((name) => {
    const doc = DATA[name];
    if (!doc) return errors.push(`${name}: missing`);
    if (doc.schema !== 1) errors.push(`${name}: schema must be 1`);
    if (!Array.isArray(doc.items) || doc.items.length === 0) return errors.push(`${name}: items must be a non-empty array`);
    const seen = new Set();
    doc.items.forEach((item, i) => {
      if (!KEBAB_RE.test(String(item.id))) errors.push(`${name}[${i}]: id "${item.id}" is not kebab-case`);
      if (seen.has(item.id)) errors.push(`${name}: duplicate id "${item.id}"`);
      seen.add(item.id);
    });
  });
  assert.deepStrictEqual(errors, []);
});

// ---------------------------------------------------------------------------
// Item schemas / 条目结构
// ---------------------------------------------------------------------------
test("items match their per-file field whitelist and LocalizedText rules", () => {
  const errors = [];
  Object.keys(SPECS).forEach((name) => {
    itemsOf(name).forEach((item) => {
      errors.push(...checkItemShape(item, SPECS[name], `${name}#${item.id}`));
    });
  });
  assert.deepStrictEqual(errors, []);
});

test("CV texts record their English provenance (en_source)", () => {
  const errors = [];
  Object.keys(SPECS).forEach((name) => {
    itemsOf(name).forEach((item) => errors.push(...checkProvenance(item, SPECS[name], `${name}#${item.id}`)));
  });
  assert.deepStrictEqual(errors, []);
});

// Owner rule: experience.md (zh) is the single source; all English is a
// translation of it ("translated"), except official course names ("official").
// 所有英文均译自中文，不再逐字搬运 tex。
test('no text uses en_source "tex" (English is translated from zh)', () => {
  const errors = [];
  Object.keys(DATA).forEach((name) => {
    collectLocalized(DATA[name], name).forEach(({ value, where }) => {
      if (value.en_source === "tex") errors.push(`${where}: en_source "tex" is no longer allowed`);
    });
  });
  assert.deepStrictEqual(errors, []);
});

test("CV entries carry a well-formed cv_ref", () => {
  const errors = [];
  CV_FILES.forEach((name) => {
    itemsOf(name).forEach((item) => {
      if (!CV_REF_RE.test(String(item.cv_ref))) errors.push(`${name}#${item.id}: bad cv_ref "${item.cv_ref}"`);
    });
  });
  assert.deepStrictEqual(errors, []);
});

test("no inline markup in any localized text", () => {
  const errors = [];
  Object.keys(DATA).forEach((name) => {
    collectLocalized(DATA[name], name).forEach(({ value, where }) => {
      ["en", "zh"].forEach((lang) => {
        if (/[<>]|\*\*|\\textbf/.test(value[lang])) errors.push(`${where}.${lang}: contains markup`);
      });
    });
  });
  assert.deepStrictEqual(errors, []);
});

// ---------------------------------------------------------------------------
// Dates & ordering / 日期与排序
// ---------------------------------------------------------------------------
test("CV date ranges are YYYY-MM with explicit end", () => {
  const errors = [];
  START_SORTED_FILES.forEach((name) => {
    itemsOf(name).forEach((item) => errors.push(...rules.checkDateRange(item, `${name}#${item.id}`, "month")));
  });
  itemsOf("publications.json").forEach((p) => {
    if (!rules.isYearMonth(p.date)) errors.push(`publications#${p.id}: bad date "${p.date}"`);
  });
  itemsOf("awards.json").forEach((a) => {
    if (a.date !== null && !rules.isYearMonth(a.date)) errors.push(`awards#${a.id}: bad date "${a.date}"`);
  });
  assert.deepStrictEqual(errors, []);
});

test("experience / research / activities / education are sorted by start desc", () => {
  const errors = [];
  START_SORTED_FILES.forEach((name) => errors.push(...rules.checkSortedByStartDesc(itemsOf(name), name)));
  const pubs = itemsOf("publications.json").map((p) => ({ id: p.id, start: p.date }));
  errors.push(...rules.checkSortedByStartDesc(pubs, "publications.json"));
  assert.deepStrictEqual(errors, []);
});

// ---------------------------------------------------------------------------
// Numbers & glossary / 数字一致性与术语表
// ---------------------------------------------------------------------------
test("en and zh texts contain the same numbers (unless exempted with a reason)", () => {
  const errors = [];
  Object.keys(DATA).forEach((name) => {
    const doc = DATA[name];
    const entries = Array.isArray(doc.items) ? doc.items : [doc];
    entries.forEach((entry, i) => {
      const where = `${name}#${entry.id || i}`;
      errors.push(...rules.checkNumCheckFlag(entry, where));
      if (entry.num_check === false) return;
      collectLocalized(entry, where).forEach(({ value, where: w }) => errors.push(...rules.checkNumberParity(value, w)));
    });
  });
  assert.deepStrictEqual(errors, []);
});

test("glossary file is well-formed", () => {
  assert.ok(fs.existsSync(GLOSSARY_PATH), "data/i18n/glossary.json must exist");
  const errors = [];
  assert.ok(Array.isArray(GLOSSARY.terms) && GLOSSARY.terms.length > 0, "terms must be non-empty");
  assert.ok(Array.isArray(GLOSSARY.forbidden) && GLOSSARY.forbidden.length > 0, "forbidden must be non-empty");
  const extraTop = Object.keys(GLOSSARY).filter((k) => !["terms", "forbidden"].includes(k));
  if (extraTop.length) errors.push(`unexpected top-level keys ${extraTop.join(",")}`);
  GLOSSARY.terms.forEach((t, i) => {
    if (!(typeof t.en === "string" && t.en.trim() && typeof t.zh === "string" && t.zh.trim())) {
      errors.push(`terms[${i}]: en/zh must be non-empty strings`);
    }
  });
  GLOSSARY.forbidden.forEach((f, i) => {
    try {
      new RegExp(f.pattern, f.flags || "");
    } catch (e) {
      errors.push(`forbidden[${i}]: invalid regex (${e.message})`);
    }
    if (!(typeof f.reason === "string" && f.reason.trim())) errors.push(`forbidden[${i}]: reason required`);
  });
  assert.deepStrictEqual(errors, []);
});

test("glossary forbidden rules catch known pitfalls (self-check)", () => {
  const hits = (text) => rules.checkGlossary({ terms: [], forbidden: GLOSSARY.forbidden }, { en: text, zh: "" }, "x").length;
  const hitsZh = (text) => rules.checkGlossary({ terms: [], forbidden: GLOSSARY.forbidden }, { en: "", zh: text }, "x").length;
  assert.ok(hits("First author of the paper") > 0);
  assert.ok(hitsZh("以第一作者身份发表") > 0);
  assert.ok(hitsZh("共同第一作者") > 0);
  assert.ok(hits("Coursework: Deep Learning") > 0);
  assert.ok(hitsZh("著作权人：Hydraallen") > 0);
  assert.ok(hits("Copyright holder: Hydraallen") > 0);
  assert.strictEqual(hits("co-author, OSGym"), 0);
  assert.strictEqual(hitsZh("以共同作者身份完成论文"), 0);
});

test("all localized texts respect the glossary", () => {
  const errors = [];
  Object.keys(DATA).forEach((name) => {
    collectLocalized(DATA[name], name).forEach(({ value, where }) => {
      errors.push(...rules.checkGlossary(GLOSSARY, value, where));
    });
  });
  assert.deepStrictEqual(errors, []);
});

// ---------------------------------------------------------------------------
// File-specific rules / 各文件专项规则
// ---------------------------------------------------------------------------
test("research kinds are valid", () => {
  const bad = itemsOf("research.json").filter((r) => !RESEARCH_KINDS.includes(r.kind));
  assert.deepStrictEqual(bad.map((r) => r.id), []);
});

test("education GPA format and UMich official coursework", () => {
  const errors = [];
  itemsOf("education.json").forEach((e) => {
    if (e.gpa !== null && !/^\d\.\d{2,3}\/\d\.\d{2,3}$/.test(String(e.gpa))) {
      errors.push(`education#${e.id}: bad gpa "${e.gpa}"`);
    }
  });
  const umich = itemsOf("education.json").find((e) => e.id === "umich");
  assert.ok(umich, "education must contain id umich");
  assert.deepStrictEqual(umich.coursework.map((c) => c.en), UMICH_COURSEWORK);
  umich.coursework.forEach((c) => {
    if (c.en_source !== "official") errors.push(`umich coursework "${c.en}": en_source must be official`);
  });
  const cornell = itemsOf("education.json").find((e) => e.id === "cornell");
  if (cornell && cornell.gpa !== null) errors.push("cornell: GPA must not be published (owner decision)");
  assert.deepStrictEqual(errors, []);
});

test("publications: co-author only, valid status, DOI/arXiv links consistent", () => {
  const errors = [];
  itemsOf("publications.json").forEach((p) => {
    const w = `publications#${p.id}`;
    if (p.authorship !== "co-author") errors.push(`${w}: authorship must be "co-author"`);
    if (!PUB_STATUSES.includes(p.status)) errors.push(`${w}: bad status "${p.status}"`);
    if (p.status === "published" && !p.doi) errors.push(`${w}: published papers need a DOI`);
    const urls = (p.links || []).map((l) => l.url);
    if (p.doi && !urls.includes(`https://doi.org/${p.doi}`)) errors.push(`${w}: missing doi link`);
    if (p.arxiv && !urls.includes(`https://arxiv.org/abs/${p.arxiv}`)) errors.push(`${w}: missing arxiv link`);
    if (p.doi !== null && !/^10\.\d{4,9}\/\S+$/.test(String(p.doi))) errors.push(`${w}: bad doi`);
    if (p.arxiv !== null && !/^\d{4}\.\d{4,5}$/.test(String(p.arxiv))) errors.push(`${w}: bad arxiv id`);
  });
  assert.deepStrictEqual(errors, []);
});

test("awards: kind/level enums, copyright holder required and never the owner", () => {
  const errors = [];
  itemsOf("awards.json").forEach((a) => {
    const w = `awards#${a.id}`;
    if (!AWARD_KINDS.includes(a.kind)) errors.push(`${w}: bad kind "${a.kind}"`);
    if (a.level !== null && !AWARD_LEVELS.includes(a.level)) errors.push(`${w}: bad level "${a.level}"`);
    if (a.kind === "software-copyright") {
      if (!a.holder) errors.push(`${w}: software-copyright requires holder`);
      else if (OWNER_NAME_RE.test(a.holder.en) || OWNER_NAME_RE.test(a.holder.zh)) {
        errors.push(`${w}: holder must not be the owner`);
      }
    } else if ("holder" in a) {
      errors.push(`${w}: holder only allowed on software-copyright`);
    }
    // Registration / certificate numbers must never be published. 不得出现登记号/证书号。
    const text = JSON.stringify(a);
    if (/\d{4}SR\d{5,}|No\.\s*\d{6,}|登记号|证书号/.test(text)) errors.push(`${w}: contains a registration/certificate number`);
  });
  assert.deepStrictEqual(errors, []);
});

test("projects: images exist on disk and titles are unique", () => {
  const errors = [];
  const titles = new Set();
  itemsOf("projects.json").forEach((p) => {
    const w = `projects#${p.id}`;
    if (typeof p.title === "string") {
      if (!p.title.trim()) errors.push(`${w}: empty title`);
    } else {
      errors.push(...rules.checkLocalizedText(p.title, `${w}.title`));
    }
    const key = typeof p.title === "string" ? p.title : p.title && p.title.en;
    if (titles.has(key)) errors.push(`${w}: duplicate title "${key}"`);
    titles.add(key);
    if (/^(\.\/|\/|https?:)/.test(p.image)) errors.push(`${w}: image must be a repo-relative path like img/x.png`);
    else if (!fs.existsSync(path.join(rules.ROOT, p.image))) errors.push(`${w}: image ${p.image} not found`);
    if (!p.links.length) errors.push(`${w}: needs at least one link`);
  });
  assert.deepStrictEqual(errors, []);
});

test("skills: tex groups plus tabbed icon grid", () => {
  const doc = DATA["skills.json"];
  const errors = [];
  const extra = Object.keys(doc).filter((k) => !["schema", "groups", "items"].includes(k));
  if (extra.length) errors.push(`unexpected keys ${extra.join(",")}`);
  (doc.groups || []).forEach((g, i) => {
    const w = `skills.groups[${i}]`;
    if (!KEBAB_RE.test(String(g.id))) errors.push(`${w}: bad id`);
    errors.push(...rules.checkLocalizedText(g.label, `${w}.label`));
    errors.push(...checkStringArray(g.skills, `${w}.skills`));
  });
  if (!(doc.groups || []).length) errors.push("skills.groups must be non-empty");
  const tabIds = doc.items.map((t) => t.id);
  tabIds.forEach((id) => {
    if (!SKILL_TABS.includes(id)) errors.push(`skills tab "${id}" has no index.skills.tab.* string`);
  });
  doc.items.forEach((tab) => {
    const extraTab = Object.keys(tab).filter((k) => !["id", "skills"].includes(k));
    if (extraTab.length) errors.push(`skills#${tab.id}: unexpected keys ${extraTab.join(",")}`);
    (tab.skills || []).forEach((s, i) => {
      const w = `skills#${tab.id}.skills[${i}]`;
      if (!(typeof s.name === "string" && s.name.trim())) errors.push(`${w}: name required`);
      const iconOk = /^https:\/\//.test(s.icon) || fs.existsSync(path.join(rules.ROOT, String(s.icon)));
      if (!iconOk) errors.push(`${w}: icon must be https or an existing repo path`);
      const extraSkill = Object.keys(s).filter((k) => !["name", "icon"].includes(k));
      if (extraSkill.length) errors.push(`${w}: unexpected keys ${extraSkill.join(",")}`);
    });
  });
  assert.deepStrictEqual(errors, []);
});

test("profile: localized hero/about, public email only, https social links", () => {
  const p = DATA["profile.json"];
  const errors = [];
  if (p.schema !== 1) errors.push("schema must be 1");
  // Owner name lives only in strings (index.hero.name / meta.*); the public
  // e-mail only in the social "email" entry. No duplicate sources of truth.
  // 姓名只在词典中维护；公开邮箱只在 social 的 email 条目中维护。
  const allowed = ["schema", "intro", "typing_lines", "about", "languages", "tools", "social"];
  Object.keys(p).forEach((k) => {
    if (!allowed.includes(k)) errors.push(`unexpected field "${k}"`);
  });
  errors.push(...rules.checkLocalizedText(p.intro, "intro"));
  ["typing_lines", "about"].forEach((k) => {
    if (!Array.isArray(p[k]) || !p[k].length) errors.push(`${k}: must be a non-empty array`);
    else p[k].forEach((lt, i) => errors.push(...rules.checkLocalizedText(lt, `${k}[${i}]`)));
  });
  errors.push(...checkStringArray(p.languages, "languages"));
  errors.push(...checkStringArray(p.tools, "tools"));
  if (!Array.isArray(p.social) || !p.social.length) errors.push("social: must be a non-empty array");
  const mail = (p.social || []).filter((s) => String(s.url).startsWith("mailto:"));
  if (mail.length !== 1 || mail[0].id !== "email") errors.push('social: exactly one mailto entry, id "email"');
  if (new Set((p.social || []).map((s) => s.id)).size !== (p.social || []).length) errors.push("social: duplicate id");
  (p.social || []).forEach((s, i) => {
    if (!KEBAB_RE.test(String(s.id))) errors.push(`social[${i}]: bad id`);
    if (!(typeof s.name === "string" && s.name.trim())) errors.push(`social[${i}]: name required`);
    if (!/^(https:\/\/|mailto:)/.test(String(s.url))) errors.push(`social[${i}]: url must be https or mailto`);
    if (String(s.url).startsWith("mailto:") && s.url !== `mailto:${PUBLIC_EMAIL}`) errors.push(`social[${i}]: only the public email`);
    if (!/^https:\/\//.test(String(s.icon))) errors.push(`social[${i}]: icon must be https`);
  });
  assert.deepStrictEqual(errors, []);
});

test("no e-mail other than the public one appears anywhere in profile data", () => {
  const all = Object.values(DATA).map((d) => JSON.stringify(d)).join("\n");
  const emails = all.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g) || [];
  assert.deepStrictEqual([...new Set(emails)].filter((e) => e !== PUBLIC_EMAIL), []);
});
