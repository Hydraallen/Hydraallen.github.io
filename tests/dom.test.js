"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { JSDOM } = require("jsdom");

// Require BEFORE any global.document is set so the browser bootstrap block
// (guarded by `typeof document`) is skipped during load.
const scripts = require("../js/scripts.js");

function makeDom(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// FIX #2: openMenu must not throw when nav has no focusable elements
// ---------------------------------------------------------------------------
test("openMenu does not throw when nav has no focusable elements", async () => {
  const dom = makeDom('<button class="hamburger-menu"></button><nav></nav>');
  const doc = dom.window.document;

  const controls = scripts.setupHamburgerMenu(doc);
  assert.ok(controls, "setup should return controls");
  assert.doesNotThrow(() => controls.openMenu());
  // Let the internal setTimeout(focus, 100) fire; guard must prevent a throw.
  await wait(150);
});

// ---------------------------------------------------------------------------
// FIX #1: contact form errors are rendered as text, not HTML (XSS-safe)
// ---------------------------------------------------------------------------
test("showFormErrors escapes untrusted backend error messages", () => {
  const dom = makeDom('<div id="s"></div>');
  const status = dom.window.document.getElementById("s");

  scripts.showFormErrors(status, {
    errors: [{ message: "<img src=x onerror=alert(1)>" }],
  });

  assert.strictEqual(
    status.querySelector("img"),
    null,
    "no real <img> element should be created"
  );
  assert.ok(
    status.textContent.includes("<img src=x onerror=alert(1)>"),
    "raw payload should appear as escaped text"
  );
});

test("setupContactForm submit flow renders backend errors safely", async () => {
  const dom = makeDom(`
    <form id="contact-form" action="/submit" method="POST">
      <input name="email" value="a@b.c">
      <button class="submit-btn" type="submit">Send</button>
    </form>
    <div id="form-status"></div>
  `);
  const win = dom.window;
  const doc = win.document;
  // scripts.js uses `new FormData(form)` -> needs jsdom's FormData/Event.
  global.FormData = win.FormData;

  const fakeFetch = async () => ({
    ok: false,
    json: async () => ({
      errors: [{ message: "<script>alert(1)</script>" }],
    }),
  });

  scripts.setupContactForm(doc, fakeFetch);

  const form = doc.getElementById("contact-form");
  form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));

  // allow the async submit handler to settle
  await tick();
  await tick();

  const status = doc.getElementById("form-status");
  assert.strictEqual(status.querySelector("script"), null);
  assert.ok(status.textContent.includes("<script>alert(1)</script>"));
  assert.ok(status.className.includes("error"));

  delete global.FormData;
});

test("showFormStatus success sets text and class safely", () => {
  const dom = makeDom('<div id="s"></div>');
  const status = dom.window.document.getElementById("s");
  scripts.showFormStatus(status, "Thanks!", "success");
  assert.strictEqual(status.textContent, "Thanks!");
  assert.ok(status.className.includes("success"));
});

// ---------------------------------------------------------------------------
// FIX #3: footer year uses textContent
// ---------------------------------------------------------------------------
test("setFooterYear writes the current year as text", () => {
  const dom = makeDom('<span id="year"></span>');
  const doc = dom.window.document;
  scripts.setFooterYear(doc);
  assert.strictEqual(
    doc.getElementById("year").textContent,
    String(new Date().getFullYear())
  );
});

// ---------------------------------------------------------------------------
// FIX #4: renderTimeline reuses lib helpers (dedup) and escapes titles
// ---------------------------------------------------------------------------
test("renderTimeline builds cards and escapes malicious movie titles", () => {
  const dom = makeDom('<div id="root"></div>');
  global.document = dom.window.document;
  try {
    const root = dom.window.document.getElementById("root");
    renderTimelineGlobalSafe(root);
  } finally {
    delete global.document;
  }
});

// helper kept separate so global.document is set when renderTimeline runs
function renderTimelineGlobalSafe(root) {
  const data = [
    {
      year: "2023",
      favorite: "Fav",
      movies: [
        { title: "Fav", date: "2023-01-01", poster: "" },
        { title: "<img src=x onerror=alert(1)>", date: "2023-02-02" },
      ],
    },
  ];
  scripts.renderTimeline(data, root);

  // No injected <img onerror> from the malicious title.
  const imgs = root.querySelectorAll("img");
  imgs.forEach((img) => {
    assert.strictEqual(img.getAttribute("onerror"), null);
  });
  // Favorite card + one other-movie card rendered.
  assert.ok(root.querySelector(".favorite-card"));
  assert.ok(root.querySelector(".vertical-scroll-wrapper"));
  // Placeholder used for the poster-less favorite.
  const favImg = root.querySelector(".favorite-card img");
  assert.ok(favImg.getAttribute("src").startsWith("data:image/svg+xml"));
  // Malicious title rendered as text, not markup.
  assert.ok(root.textContent.includes("<img src=x onerror=alert(1)>"));
}

// ---------------------------------------------------------------------------
// i18n: movies timeline strings + locale dates / 观影时间线本地化
// ---------------------------------------------------------------------------
const TIMELINE_DATA = [
  {
    year: 2024,
    favorite: "Fav",
    movies: [
      { title: "Fav", title_zh: "最爱", date: "Jan 12, 2024", poster: "" },
      { title: "Other", title_zh: "其他", date: "Feb 2, 2024", poster: "" },
      // No title_zh: zh falls back to the English title. 缺中文名时回退英文。
      { title: "Odd", date: "sometime", poster: "" },
    ],
  },
  { year: 2023, favorite: "", movies: [] },
];

function renderTimelineIn(lang) {
  const dom = makeDom('<div id="root"></div>');
  const root = dom.window.document.getElementById("root");
  scripts.renderTimeline(TIMELINE_DATA, root, lang);
  return root;
}

const dateTexts = (root) => [...root.querySelectorAll(".movie-date")].map((p) => p.textContent);
const titleTexts = (root) => [...root.querySelectorAll(".movie-title")].map((h) => h.textContent);
const altTexts = (root) => [...root.querySelectorAll(".poster-wrapper img")].map((i) => i.getAttribute("alt"));

test("renderTimeline (en default) keeps English labels and 'Jan 12, 2024' dates", () => {
  const dom = makeDom('<div id="root"></div>');
  const root = dom.window.document.getElementById("root");
  scripts.renderTimeline(TIMELINE_DATA, root);
  assert.ok(root.querySelector(".timeline-stats").textContent.includes("Watched: 3 movies"));
  assert.strictEqual(root.querySelector(".favorite-label-large").textContent, "🏆 Best of 2024");
  assert.strictEqual(root.querySelector(".timeline-content").getAttribute("aria-label"), "Expand movie list for 2024");
  assert.strictEqual(root.querySelector(".vertical-scroll-wrapper").getAttribute("aria-label"), "Movies list for 2024");
  assert.deepStrictEqual(dateTexts(root), ["Jan 12, 2024", "Feb 2, 2024", "sometime"]);
  assert.deepStrictEqual(titleTexts(root), ["Fav", "Other", "Odd"]);
  assert.deepStrictEqual(altTexts(root), ["Fav", "Other", "Odd"]);
  assert.ok(root.textContent.includes("No movies recorded."));
});

test("renderTimeline (zh) localizes labels and formats dates as YYYY.MM.DD", () => {
  const root = renderTimelineIn("zh");
  assert.ok(root.querySelector(".timeline-stats").textContent.includes("已看：3 部电影"));
  assert.strictEqual(root.querySelector(".favorite-label-large").textContent, "🏆 2024 年度最佳");
  assert.strictEqual(root.querySelector(".timeline-content").getAttribute("aria-label"), "展开 2024 年的电影列表");
  assert.strictEqual(root.querySelector(".vertical-scroll-wrapper").getAttribute("aria-label"), "2024 年电影列表");
  // Unparseable dates fall back to the raw string. 无法解析的日期原样显示。
  assert.deepStrictEqual(dateTexts(root), ["2024.01.12", "2024.02.02", "sometime"]);
  assert.ok(root.textContent.includes("暂无观影记录。"));
  // zh shows title_zh (title + poster alt); missing title_zh falls back to title.
  // 中文界面显示 title_zh（标题与海报 alt），缺失时回退英文片名。
  assert.deepStrictEqual(titleTexts(root), ["最爱", "其他", "Odd"]);
  assert.deepStrictEqual(altTexts(root), ["最爱", "其他", "Odd"]);
});

test("renderTimeline does not mutate the input movie objects", () => {
  const data = [{ year: 2024, favorite: "A", movies: [{ title: "A", title_zh: "甲", date: "Jan 12, 2024" }] }];
  const dom = makeDom('<div id="root"></div>');
  scripts.renderTimeline(data, dom.window.document.getElementById("root"), "zh");
  assert.deepStrictEqual(data[0].movies[0], { title: "A", title_zh: "甲", date: "Jan 12, 2024" });
});

function fakeFetch(routes) {
  return async (url) => {
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => routes[key] };
  };
}

async function runLoadMovies(fetchImpl, lang) {
  const dom = makeDom('<div id="root"></div>');
  const root = dom.window.document.getElementById("root");
  const origFetch = global.fetch;
  const origError = console.error;
  global.fetch = fetchImpl;
  console.error = () => {};
  try {
    const pending = scripts.loadMovies(root, lang);
    const loadingText = root.textContent.trim();
    await pending;
    return { root, loadingText };
  } finally {
    global.fetch = origFetch;
    console.error = origError;
  }
}

test("loadMovies (zh) shows localized loading text then renders sorted years", async () => {
  const fetchImpl = fakeFetch({
    "index.json": ["2023", "2024"],
    "2023.json": { year: 2023, favorite: "", movies: [{ title: "B", date: "Mar 3, 2023" }] },
    "2024.json": TIMELINE_DATA[0],
  });
  const { root, loadingText } = await runLoadMovies(fetchImpl, "zh");
  assert.strictEqual(loadingText, "正在加载电影……");
  const years = [...root.querySelectorAll(".timeline-year")].map((h) => h.textContent);
  assert.deepStrictEqual(years, ["2024", "2023"]);
  assert.ok(root.textContent.includes("2023.03.03"));
});

test("loadMovies shows a localized error when the index fails", async () => {
  const en = await runLoadMovies(fakeFetch({}), "en");
  assert.ok(en.root.textContent.includes("Error loading movie data."));
  const zh = await runLoadMovies(fakeFetch({}), "zh");
  assert.ok(zh.root.textContent.includes("电影数据加载失败。"));
  assert.ok(zh.root.textContent.includes("file://"));
});

// ---------------------------------------------------------------------------
// i18n: toggles query at click time (async-rendered content) + a11y state
// ---------------------------------------------------------------------------
test("setupToggle works on items rendered after setup and updates aria-expanded", () => {
  const dom = makeDom(
    '<button id="tb" aria-expanded="false">Show More</button><div id="list"></div>'
  );
  const doc = dom.window.document;
  scripts.setupToggle(doc, "tb", ".item.hidden_x", "hidden_x");

  // Content arrives later (e.g. rendered from JSON).
  doc.getElementById("list").innerHTML =
    '<div class="item"></div><div class="item hidden_x"></div><div class="item hidden_x"></div>';

  const btn = doc.getElementById("tb");
  btn.click();
  assert.strictEqual(doc.querySelectorAll(".hidden_x").length, 0);
  assert.strictEqual(btn.getAttribute("aria-expanded"), "true");
  assert.strictEqual(btn.textContent, "Show Less");

  btn.click();
  assert.strictEqual(doc.querySelectorAll(".hidden_x").length, 2);
  assert.strictEqual(btn.getAttribute("aria-expanded"), "false");
  assert.strictEqual(btn.textContent, "Show More");
});

test("setupToggle uses localized labels", () => {
  const dom = makeDom('<button id="tb">x</button><div class="i hide"></div>');
  const doc = dom.window.document;
  scripts.setupToggle(doc, "tb", ".i.hide", "hide", "zh");
  const btn = doc.getElementById("tb");
  btn.click();
  assert.strictEqual(btn.textContent, "收起");
  btn.click();
  assert.strictEqual(btn.textContent, "展开更多");
});

test("setupSkillsTabs delegates clicks, filters late cards and sets aria-selected", () => {
  const dom = makeDom(
    '<div class="continent-tabs"><button class="tab-btn active" data-continent="all">All</button></div>' +
      '<div id="skills"></div>'
  );
  const doc = dom.window.document;
  scripts.setupSkillsTabs(doc);

  doc.getElementById("skills").innerHTML =
    '<div class="skills-tabs" role="tablist">' +
    '<button class="tab-btn active" role="tab" aria-selected="true" data-target="backend">B</button>' +
    '<button class="tab-btn" role="tab" aria-selected="false" data-target="tools">T</button>' +
    "</div>" +
    '<div class="skill-card" data-category="backend"></div>' +
    '<div class="skill-card hidden-skill" data-category="tools"></div>';

  const [backend, tools] = doc.querySelectorAll(".skills-tabs .tab-btn");
  tools.click();
  assert.ok(tools.classList.contains("active"));
  assert.ok(!backend.classList.contains("active"));
  assert.strictEqual(tools.getAttribute("aria-selected"), "true");
  assert.strictEqual(backend.getAttribute("aria-selected"), "false");
  assert.ok(doc.querySelector('[data-category="backend"]').classList.contains("hidden-skill"));
  assert.ok(!doc.querySelector('[data-category="tools"]').classList.contains("hidden-skill"));

  // Continent tabs on the travel page are not hijacked by the skills handler.
  const continent = doc.querySelector(".continent-tabs .tab-btn");
  continent.click();
  assert.ok(tools.classList.contains("active"));
});

test("setupContactForm shows localized sending/success text", async () => {
  const dom = makeDom(`
    <form id="contact-form" action="/submit" method="POST">
      <button class="submit-btn" type="submit">Send Message</button>
    </form>
    <div id="form-status"></div>
  `);
  const win = dom.window;
  const doc = win.document;
  global.FormData = win.FormData;
  let seenDuringSubmit = null;
  const fakeFetch = async () => {
    seenDuringSubmit = doc.querySelector(".submit-btn").textContent;
    return { ok: true };
  };
  scripts.setupContactForm(doc, fakeFetch, "zh");
  doc
    .getElementById("contact-form")
    .dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
  await tick();
  await tick();
  assert.strictEqual(seenDuringSubmit, "发送中……");
  assert.strictEqual(doc.getElementById("form-status").textContent, "感谢留言！我会尽快回复你。");
  assert.strictEqual(doc.querySelector(".submit-btn").textContent, "Send Message");
  delete global.FormData;
});

test("showFormErrors falls back to a localized generic message", () => {
  const dom = makeDom('<div id="s"></div>');
  const status = dom.window.document.getElementById("s");
  scripts.showFormErrors(status, {}, "zh");
  assert.strictEqual(status.textContent, "抱歉！提交表单时出现问题。");
  scripts.showFormErrors(status, null);
  assert.strictEqual(status.textContent, "Oops! There was a problem submitting your form.");
});
