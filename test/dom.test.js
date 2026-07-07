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
  assert.ok(favImg.getAttribute("src").includes("placeholder"));
  // Malicious title rendered as text, not markup.
  assert.ok(root.textContent.includes("<img src=x onerror=alert(1)>"));
}
