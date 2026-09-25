"use strict";

// Tests for js/scripts_profile.js (index page renderer) and index.html wiring.
// 首页渲染器与 index.html 结构测试。Fixtures in tests/fixtures/profile are fictional.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const profile = require("../js/scripts_profile.js");
const scripts = require("../js/scripts.js");
const rules = require("./helpers/content_rules.js");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "profile");
const DATA_DIR = path.join(rules.ROOT, "data", "profile");
const INDEX_HTML = fs.readFileSync(path.join(rules.ROOT, "index.html"), "utf8");

function readJson(dir, name) {
  return JSON.parse(fs.readFileSync(path.join(dir, name + ".json"), "utf8"));
}

// Fake fetch serving files from `dir`; names in `failing` answer 404 / throw.
function fakeFetch(dir, failing = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const name = path.basename(url, ".json");
    if (failing[name] === "throw") throw new Error("network down");
    if (failing[name] === "404") return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => readJson(dir, name) };
  };
  fn.calls = calls;
  return fn;
}

async function fixtureData(failing) {
  return profile.loadProfile(fakeFetch(FIXTURE_DIR, failing));
}

function indexDoc() {
  return new JSDOM(INDEX_HTML).window.document;
}

function jsonFilesIn(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

// ---------------------------------------------------------------------------
// PROFILE_FILES contract
// ---------------------------------------------------------------------------
test("PROFILE_FILES matches the fixture directory", () => {
  assert.deepStrictEqual([...profile.PROFILE_FILES].sort(), jsonFilesIn(FIXTURE_DIR));
});

test("PROFILE_FILES matches data/profile when present", (t) => {
  if (!fs.existsSync(DATA_DIR)) return t.skip("data/profile not created yet");
  assert.deepStrictEqual([...profile.PROFILE_FILES].sort(), jsonFilesIn(DATA_DIR));
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
test("safeUrl allows http(s), mailto and relative paths; rejects script schemes", () => {
  assert.strictEqual(profile.safeUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.strictEqual(profile.safeUrl("http://example.com"), "http://example.com");
  assert.strictEqual(profile.safeUrl("mailto:a@example.com"), "mailto:a@example.com");
  assert.strictEqual(profile.safeUrl("img/x.png"), "img/x.png");
  assert.strictEqual(profile.safeUrl("./img/x.png"), "./img/x.png");
  assert.strictEqual(profile.safeUrl("../data/x.json"), "../data/x.json");
  assert.strictEqual(profile.safeUrl("javascript:alert(1)"), "");
  assert.strictEqual(profile.safeUrl(" JaVaScRiPt:alert(1)"), "");
  assert.strictEqual(profile.safeUrl("java\tscript:alert(1)"), "");
  assert.strictEqual(profile.safeUrl("data:text/html,x"), "");
  assert.strictEqual(profile.safeUrl("//evil.example.com"), "");
  assert.strictEqual(profile.safeUrl(null), "");
  assert.strictEqual(profile.safeUrl(42), "");
});

test("highlightMetrics escapes text and bolds standalone numbers with units", () => {
  assert.strictEqual(
    profile.highlightMetrics("Cut latency by 35% across 1,200 runs."),
    "Cut latency by <strong>35%</strong> across <strong>1,200</strong> runs."
  );
  assert.strictEqual(profile.highlightMetrics("准确率达到 86%。"), "准确率达到 <strong>86%</strong>。");
  assert.strictEqual(profile.highlightMetrics("提升 3.5 个点，10x 更快"), "提升 <strong>3.5</strong> 个点，<strong>10x</strong> 更快");
  assert.strictEqual(profile.highlightMetrics("Served 2,000+ users"), "Served <strong>2,000+</strong> users");
});

test("highlightMetrics leaves identifiers alone and never breaks escaping", () => {
  assert.strictEqual(profile.highlightMetrics("SAM2 on Mind2Web in 3D"), "SAM2 on Mind2Web in 3D");
  assert.strictEqual(profile.highlightMetrics("it's <b>5</b> & more"), "it&#39;s &lt;b&gt;<strong>5</strong>&lt;/b&gt; &amp; more");
  assert.strictEqual(profile.highlightMetrics("课程（2023.09-2023.12），Sep–Dec 2024"), "课程（2023.09-2023.12），Sep–Dec 2024");
  assert.strictEqual(profile.highlightMetrics("2024 users, 2025%"), "2024 users, <strong>2025%</strong>");
  assert.strictEqual(profile.highlightMetrics(""), "");
  assert.strictEqual(profile.highlightMetrics(null), "");
});

test("buildTypingSvgUrl encodes lines (spaces -> +, ; inside a line escaped)", () => {
  const url = profile.buildTypingSvgUrl(["Hello there", "a;b", "你好"]);
  assert.ok(url.startsWith("https://readme-typing-svg.herokuapp.com?"));
  const lines = url.split("&lines=")[1];
  assert.strictEqual(lines, "Hello+there;a%3Bb;%E4%BD%A0%E5%A5%BD");
  assert.strictEqual(profile.buildTypingSvgUrl([]), "");
  assert.strictEqual(profile.buildTypingSvgUrl(null), "");
});

// ---------------------------------------------------------------------------
// loadProfile
// ---------------------------------------------------------------------------
test("loadProfile fetches every PROFILE_FILES entry under ../data/profile/", async () => {
  const fetchFn = fakeFetch(FIXTURE_DIR);
  const data = await profile.loadProfile(fetchFn);
  assert.deepStrictEqual(
    fetchFn.calls.sort(),
    profile.PROFILE_FILES.map((n) => `../data/profile/${n}.json`).sort()
  );
  assert.deepStrictEqual(data.errors, []);
  assert.strictEqual(data.profile.intro.en, "A fictional builder of imaginary tools.");
  assert.strictEqual(data.experience.length, 3);
  assert.strictEqual(data.skills[0].id, "ai");
});

test("loadProfile tolerates single-file failures (404 and thrown errors)", async () => {
  const data = await fixtureData({ awards: "404", research: "throw" });
  assert.strictEqual(data.awards, null);
  assert.strictEqual(data.research, null);
  assert.deepStrictEqual(data.errors.sort(), ["awards", "research"]);
  assert.strictEqual(data.experience.length, 3);
});

test("loadProfile accepts profile.json as a bare object or {items:[obj]}", async () => {
  const wrapped = { schema: 1, items: [{ name: "Wrapped" }] };
  const fetchFn = async (url) => ({
    ok: true,
    json: async () => (url.endsWith("profile.json") ? wrapped : { schema: 1, items: [] }),
  });
  const data = await profile.loadProfile(fetchFn);
  assert.strictEqual(data.profile.name, "Wrapped");
});

test("loadProfile treats a malformed list file as a failure", async () => {
  const fetchFn = async (url) => ({
    ok: true,
    json: async () => (url.endsWith("skills.json") ? { schema: 1, items: "nope" } : { schema: 1, items: [] }),
  });
  const data = await profile.loadProfile(fetchFn);
  assert.strictEqual(data.skills, null);
  assert.ok(data.errors.includes("skills"));
});

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------
test("buildExperienceCardHtml reuses .education-card markup in both languages", () => {
  const item = readJson(FIXTURE_DIR, "experience").items[0];
  const en = profile.buildExperienceCardHtml(item, "en");
  assert.ok(en.includes('class="education-card"'));
  assert.ok(en.includes("<h3>Zyxcorp Fixture Labs</h3>"));
  assert.ok(en.includes("Aug 2030 – Present"));
  assert.ok(en.includes("Imaginary Agent Intern"));
  assert.ok(en.includes("Atlantis · Remote"));
  assert.ok(en.includes("<strong>35%</strong>"));
  assert.ok(en.includes('<li class="tech-tag">Tool Calling</li>'));
  assert.ok(en.includes('href="https://example.com/zyx"'));
  const zh = profile.buildExperienceCardHtml(item, "zh");
  assert.ok(zh.includes("Zyxcorp 测试实验室"));
  assert.ok(zh.includes("2030.08 – 至今"));
  assert.ok(zh.includes("亚特兰蒂斯 · 远程"));
  assert.ok(zh.includes("技术栈"));
});

test("buildExperienceCardHtml marks featured:false as collapsed", () => {
  const item = readJson(FIXTURE_DIR, "experience").items[1];
  const html = profile.buildExperienceCardHtml(item, "en");
  assert.ok(html.includes('class="education-card profile-collapsed"'));
  assert.ok(!html.includes("edu-major"), "null location renders nothing");
  assert.ok(!html.includes("tech-tags"), "no tech -> no tag list");
});

test("buildResearchCardHtml drops unsafe links and labels safe ones", () => {
  const item = readJson(FIXTURE_DIR, "research").items[0];
  const html = profile.buildResearchCardHtml(item, "en");
  assert.ok(html.includes("FixtureSeg Pseudo Segmentation"));
  assert.ok(html.includes("Research Assistant · Nowhere Vision Lab"));
  assert.ok(html.includes('href="https://github.com/example/fixtureseg"'));
  assert.ok(html.includes(">GitHub<"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(profile.buildResearchCardHtml(item, "zh").includes("科研助理 · 无名视觉实验室"));
});

test("buildPublicationHtml shows title, co-author badge, status, venue, date, links", () => {
  const [pre, pub] = readJson(FIXTURE_DIR, "publications").items;
  const en = profile.buildPublicationHtml(pre, "en");
  assert.ok(en.includes("Imaginary Gym: A Fictional Benchmark"));
  assert.ok(en.includes("Co-author"));
  assert.ok(en.includes("Preprint"));
  assert.ok(en.includes("arXiv preprint"));
  assert.ok(en.includes("Nov 2030"));
  assert.ok(en.includes('href="https://arxiv.org/abs/0000.00000"'));
  assert.ok(en.includes("A. Person, B. Testperson"));
  const zh = profile.buildPublicationHtml(pub, "zh");
  assert.ok(zh.includes("共同作者"));
  assert.ok(zh.includes("已发表"));
  assert.ok(zh.includes("2031.01"));
  assert.ok(zh.includes("profile-collapsed"));
  assert.ok(zh.includes(">DOI<"));
});

test("buildProjectPanelHtml builds gallery panels with localized alt and buttons", () => {
  const [widget, gadget] = readJson(FIXTURE_DIR, "projects").items;
  const en = profile.buildProjectPanelHtml(widget, "en");
  assert.ok(en.includes('class="project-panel"'));
  assert.ok(en.includes('src="img/widget.png"'));
  assert.ok(en.includes('alt="Widgetron preview"'));
  assert.ok(en.includes("GitHub"));
  const zh = profile.buildProjectPanelHtml(gadget, "zh");
  assert.ok(zh.includes('class="project-panel hidden_project"'));
  assert.ok(zh.includes("小工具网站"));
  assert.ok(zh.includes("在线访问"));
  assert.ok(zh.includes("live-site-btn"));
});

test("buildSkillGroupsHtml: first tab active, other groups' cards hidden", () => {
  const groups = readJson(FIXTURE_DIR, "skills").items;
  const out = profile.buildSkillGroupsHtml(groups, "zh");
  assert.ok(out.tabs.includes('data-target="ai"'));
  assert.ok(out.tabs.includes("AI 与 Agent"));
  assert.ok(/class="tab-btn active"[^>]*aria-selected="true"[^>]*data-target="ai"/.test(out.tabs));
  assert.ok(/aria-selected="false"[^>]*data-target="backend"/.test(out.tabs));
  assert.ok(out.cards.includes('<div class="skill-card" data-category="ai">'));
  assert.ok(out.cards.includes('<div class="skill-card hidden-skill" data-category="backend">'));
  assert.strictEqual(
    profile.buildSkillCardHtml({ name: "Go", icon: "javascript:x" }, "backend", false),
    '<div class="skill-card" data-category="backend"><span>Go</span></div>'
  );
});

test("buildEducationCardHtml renders GPA, coursework, minors; collapses via hidden-edu", () => {
  const [main, exchange] = readJson(FIXTURE_DIR, "education").items;
  const en = profile.buildEducationCardHtml(main, "en");
  assert.ok(en.includes("Nowhere University of Fixtures"));
  assert.ok(en.includes("GPA: 3.99/4.00"));
  assert.ok(en.includes("Relevant Coursework: Pretend Mining, Fake Vision"));
  assert.ok(!en.includes("hidden-edu"));
  const zh = profile.buildEducationCardHtml(exchange, "zh");
  assert.ok(zh.includes("hidden-edu"));
  assert.ok(zh.includes("辅修：计算机科学"));
  assert.ok(!zh.includes("GPA"), "null gpa renders nothing");
});

test("buildAwardHtml renders kind/level labels and the copyright holder", () => {
  const [cup, copyright] = readJson(FIXTURE_DIR, "awards").items;
  const en = profile.buildAwardHtml(cup, "en");
  assert.ok(en.includes("Fixture Cup Honorable Mention"));
  assert.ok(en.includes("International"));
  assert.ok(en.includes("Award"));
  assert.ok(en.includes("Fixture Society"));
  assert.ok(en.includes("May 2030"));
  const zh = profile.buildAwardHtml(copyright, "zh");
  assert.ok(zh.includes("软件著作权"));
  assert.ok(zh.includes("著作权人：无名测试大学"));
  assert.ok(zh.includes("profile-collapsed"));
});

test("buildActivityHtml and buildAboutHtml escape data", () => {
  const act = readJson(FIXTURE_DIR, "activities").items[0];
  assert.ok(profile.buildActivityHtml(act, "zh").includes("课程助教"));
  const about = profile.buildAboutHtml(readJson(FIXTURE_DIR, "profile"), "en");
  assert.ok(about.includes("&lt;b&gt;tags&lt;/b&gt; &amp; &quot;quotes&quot;"));
  assert.ok(!about.includes("<b>"));
  assert.ok(about.includes("Languages &amp; Tools"));
  assert.ok(about.includes("Python, Go"));
  assert.ok(about.includes("Git, Docker"));
});

// ---------------------------------------------------------------------------
// renderProfile on the real index.html
// ---------------------------------------------------------------------------
test("renderProfile fills every section from fixtures (en)", async () => {
  const doc = indexDoc();
  profile.renderProfile(doc, await fixtureData(), "en");
  assert.strictEqual(doc.getElementById("hero-intro").textContent, "A fictional builder of imaginary tools.");
  assert.ok(doc.querySelector(".typing-svg img").getAttribute("src").includes("lines=Hello+there;"));
  assert.ok(doc.getElementById("about-content").textContent.includes("Nowhere Institute of Fixtures"));
  assert.strictEqual(doc.querySelectorAll("#experience-list .education-card").length, 2, "visible:false skipped");
  assert.ok(!doc.body.innerHTML.includes("Invisible Hiddenco"));
  assert.strictEqual(doc.querySelectorAll("#research-list .education-card").length, 1);
  assert.strictEqual(doc.querySelectorAll("#publications-list .publication").length, 2);
  assert.strictEqual(doc.querySelectorAll("#projects-grid .project-panel").length, 2);
  assert.strictEqual(doc.querySelectorAll("#skills-grid .skill-card").length, 3);
  assert.strictEqual(doc.querySelectorAll("#skills .skills-tabs .tab-btn").length, 2);
  assert.strictEqual(doc.querySelectorAll("#education-list .education-card").length, 2);
  assert.strictEqual(doc.querySelectorAll("#awards-list .award-item").length, 2);
  assert.strictEqual(doc.querySelectorAll("#activities-list .education-card").length, 1);
  assert.ok(!doc.body.innerHTML.includes("javascript:"));
});

test("renderProfile (zh) localizes content and social aria-labels", async () => {
  const doc = indexDoc();
  profile.renderProfile(doc, await fixtureData(), "zh");
  assert.ok(doc.getElementById("experience-list").textContent.includes("Zyxcorp 测试实验室"));
  assert.ok(doc.getElementById("education-list").textContent.includes("2030.08 – 至今"));
  const gh = doc.querySelector('.social-icons a[data-social="GitHub"]');
  assert.strictEqual(gh.getAttribute("aria-label"), "GitHub 主页（在新标签页打开）");
});

test("renderProfile hides toggles for sections with nothing collapsed", async () => {
  const doc = indexDoc();
  profile.renderProfile(doc, await fixtureData(), "en");
  assert.strictEqual(doc.getElementById("toggleExperienceBtn").hidden, false);
  assert.strictEqual(doc.getElementById("toggleResearchBtn").hidden, true);
  assert.strictEqual(doc.getElementById("toggleActivitiesBtn").hidden, true);
  assert.strictEqual(doc.getElementById("toggleProjectsBtn").hidden, false);
  assert.strictEqual(doc.getElementById("toggleEduBtn").hidden, false);
});

test("renderProfile shows the load error only in sections whose file failed", async () => {
  const doc = indexDoc();
  profile.renderProfile(doc, await fixtureData({ awards: "404" }), "zh");
  assert.ok(doc.getElementById("awards-list").textContent.includes("无法加载个人资料"));
  assert.ok(!doc.getElementById("experience-list").textContent.includes("无法加载"));
  assert.strictEqual(doc.getElementById("toggleAwardsBtn").hidden, true);
});

test("collapsed items expand/collapse with setupToggle after async render", async () => {
  const doc = indexDoc();
  profile.wireProfileToggles(doc, scripts.setupToggle, "en");
  scripts.setupToggle(doc, "toggleEduBtn", ".hidden-edu", "hidden-edu", "en");
  profile.renderProfile(doc, await fixtureData(), "en");

  const collapsedExp = () => doc.querySelectorAll("#experience .profile-collapsed").length;
  assert.strictEqual(collapsedExp(), 1);
  doc.getElementById("toggleExperienceBtn").click();
  assert.strictEqual(collapsedExp(), 0);
  assert.strictEqual(doc.getElementById("toggleExperienceBtn").getAttribute("aria-expanded"), "true");
  doc.getElementById("toggleExperienceBtn").click();
  assert.strictEqual(collapsedExp(), 1);

  assert.strictEqual(doc.querySelectorAll("#education .hidden-edu").length, 1);
  doc.getElementById("toggleEduBtn").click();
  assert.strictEqual(doc.querySelectorAll("#education .hidden-edu").length, 0);
});

// ---------------------------------------------------------------------------
// index.html structure
// ---------------------------------------------------------------------------
test("index.html: sections in the planned order", () => {
  const ids = [...indexDoc().querySelectorAll("main > section")].map((s) => s.id);
  assert.deepStrictEqual(ids, [
    "about", "experience", "research", "publications", "projects",
    "skills", "education", "awards", "activities", "contact",
  ]);
});

test("index.html: every section heading is translatable", () => {
  const doc = indexDoc();
  doc.querySelectorAll("main > section").forEach((s) => {
    const h2 = s.querySelector("h2");
    assert.strictEqual(h2.getAttribute("data-i18n"), `index.section.${s.id}`);
  });
});

test("index.html: loads the renderer after scripts.js and links its stylesheet", () => {
  const doc = indexDoc();
  const srcs = [...doc.querySelectorAll("body script[src]")].map((s) => s.getAttribute("src"));
  assert.ok(srcs.indexOf("js/scripts_profile.js") > srcs.indexOf("js/scripts.js"));
  assert.ok(doc.querySelector('link[href="css/styles_profile.css"]'));
});

test("index.html: bilingual <noscript> note and working contact form", () => {
  const doc = indexDoc();
  const ns = doc.querySelector("main noscript");
  assert.ok(ns, "noscript present");
  assert.ok(INDEX_HTML.includes("This site needs JavaScript"));
  assert.ok(INDEX_HTML.includes("本网站需要启用 JavaScript"));
  const form = doc.getElementById("contact-form");
  assert.strictEqual(form.getAttribute("action"), "https://formspree.io/f/mrbnkykq");
  assert.ok(doc.getElementById("name").getAttribute("data-i18n-attr").includes("placeholder:index.contact.name_placeholder"));
});

function contentNames(dir) {
  const names = [];
  const add = (v) => {
    if (!v) return;
    if (typeof v === "string") names.push(v);
    else ["en", "zh"].forEach((l) => typeof v[l] === "string" && names.push(v[l]));
  };
  const fields = { experience: "org", activities: "org", research: "title", publications: "title", education: "school", awards: "title" };
  Object.keys(fields).forEach((file) => {
    if (!fs.existsSync(path.join(dir, file + ".json"))) return;
    (readJson(dir, file).items || []).forEach((i) => add(i[fields[file]]));
  });
  return names.filter((n) => n.trim().length >= 4);
}

test("index.html: no hardcoded CV content (fixture + data org names / titles)", () => {
  const dirs = [FIXTURE_DIR];
  if (fs.existsSync(DATA_DIR)) dirs.push(DATA_DIR);
  // <head> meta description is site-level copy, not CV data / 只检查 <body>
  const body = INDEX_HTML.slice(INDEX_HTML.indexOf("<body"));
  const hits = dirs.flatMap(contentNames).filter((name) => body.includes(name));
  assert.deepStrictEqual(hits, []);
  // Legacy hardcoded entries must be gone too / 旧的硬编码内容必须移除
  ["OpenAGI", "Salesforce", "Baosight", "University of Michigan", "Shanghai Jiao Tong", "Cornell", "OSGym"].forEach(
    (s) => assert.ok(!body.includes(s), s)
  );
});

test("index.html: social links are not hardcoded (rendered from profile.json)", () => {
  const social = readJson(DATA_DIR, "profile").social;
  const hits = social.filter((s) => INDEX_HTML.includes(s.url)).map((s) => s.url);
  assert.deepStrictEqual(hits, []);
  const box = indexDoc().querySelector("header .social-icons");
  assert.ok(box, "social container present");
  assert.strictEqual(box.children.length, 0, "container starts empty");
});

test("renderProfile renders social links from data with localized labels", async () => {
  const doc = indexDoc();
  profile.renderProfile(doc, await fixtureData(), "en");
  const links = [...doc.querySelectorAll(".social-icons a")];
  assert.deepStrictEqual(links.map((a) => a.getAttribute("data-social")), ["GitHub", "Email"], "unsafe url dropped");
  const [gh, mail] = links;
  assert.strictEqual(gh.getAttribute("href"), "https://github.com/example-fixture");
  assert.strictEqual(gh.getAttribute("target"), "_blank");
  assert.strictEqual(gh.getAttribute("rel"), "noopener noreferrer");
  assert.strictEqual(gh.getAttribute("aria-label"), "GitHub profile (opens in new tab)");
  assert.strictEqual(gh.querySelector("img.icon").getAttribute("alt"), "");
  assert.strictEqual(mail.getAttribute("href"), "mailto:fixture@example.com");
  assert.strictEqual(mail.getAttribute("target"), null, "mailto stays in the same tab");
  assert.strictEqual(mail.getAttribute("aria-label"), "Send an email");
  profile.renderProfile(doc, await fixtureData(), "zh");
  assert.strictEqual(doc.querySelectorAll(".social-icons a").length, 2, "re-render replaces, not appends");
  assert.strictEqual(doc.querySelector('.social-icons a[data-social="Email"]').getAttribute("aria-label"), "发送邮件");
});

test("renderProfile leaves social icons empty when profile.json fails", async () => {
  const doc = indexDoc();
  profile.renderProfile(doc, await fixtureData({ profile: "404" }), "en");
  assert.strictEqual(doc.querySelectorAll(".social-icons a").length, 0);
});

test("index.html: hero name is translatable (Hydraallen in both languages)", () => {
  const i18n = require("../js/i18n.js");
  const doc = indexDoc();
  const name = doc.querySelector("header h1 [data-i18n='index.hero.name']");
  assert.ok(name, "hero name carries data-i18n");
  assert.strictEqual(name.textContent, "Hydraallen.");
  i18n.applyTranslations(doc, "zh");
  assert.strictEqual(doc.querySelector("header h1").textContent, "你好，我是 Hydraallen");
  i18n.applyTranslations(doc, "en");
  assert.strictEqual(doc.querySelector("header h1").textContent, "Hi, I'm Hydraallen.");
});

test("buildAwardHtml supports level college and a null date", () => {
  const item = { id: "x", title: { en: "Fixture Prize", zh: "测试奖" }, kind: "award", level: "college", issuer: null, date: null };
  const en = profile.buildAwardHtml(item, "en");
  assert.ok(en.includes(">College<"));
  assert.ok(!en.includes("award-date"), "null date renders no date badge");
  assert.ok(profile.buildAwardHtml(item, "zh").includes(">院级<"));
});

test("null summary renders nothing", () => {
  const item = { id: "y", org: { en: "Org", zh: "组织" }, role: { en: "R", zh: "角" }, location: null, start: "2020-01", end: "2020-02", summary: null, bullets: [] };
  assert.ok(!profile.buildExperienceCardHtml(item, "en").includes("exp-summary"));
});
