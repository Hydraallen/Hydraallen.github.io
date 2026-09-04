"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { JSDOM } = require("jsdom");

// Require BEFORE any global.document is set so the browser bootstrap block
// (guarded by `typeof document`) is skipped during load.
const nav = require("../js/nav.js");

// ---------------------------------------------------------------------------
// getCurrentPage: pathname -> page key
// ---------------------------------------------------------------------------
test("getCurrentPage maps pathnames to page keys", () => {
  assert.strictEqual(nav.getCurrentPage("/movies.html"), "movies.html");
  assert.strictEqual(nav.getCurrentPage("/travel.html"), "travel.html");
  assert.strictEqual(nav.getCurrentPage("/404.html"), "404");
  assert.strictEqual(nav.getCurrentPage("/index.html"), "index.html");
  assert.strictEqual(nav.getCurrentPage("/"), "index.html");
  assert.strictEqual(nav.getCurrentPage(""), "index.html");
});

test("getCurrentPage maps trip.html to the travel page key", () => {
  assert.strictEqual(nav.getCurrentPage("/trip.html"), "travel.html");

  // The trip detail page keeps the Travel nav entry highlighted.
  const html = nav.buildNavHtml(nav.getCurrentPage("/trip.html"));
  assert.ok(html.includes('href="travel.html" class="active-nav-item" aria-current="page"'));
  assert.ok(!html.includes('href="movies.html" class="active-nav-item"'));
});

// ---------------------------------------------------------------------------
// buildNavHtml: single source of truth for nav markup
// ---------------------------------------------------------------------------
test("buildNavHtml contains profile image and all nav items", () => {
  const html = nav.buildNavHtml("index.html");
  assert.ok(html.includes('id="primary-nav"'), "nav has stable id");
  assert.ok(html.includes("avatar.jpg"), "includes profile picture");
  for (const label of [
    "About",
    "Experience",
    "Projects",
    "Skills",
    "Education",
    "Movies",
    "Travel",
    "Contact",
  ]) {
    assert.ok(html.includes(">\n          " + label) || html.includes(label), `includes ${label}`);
  }
});

test("buildNavHtml highlights the current page with aria-current and no href=#", () => {
  const html = nav.buildNavHtml("movies.html");
  assert.ok(
    html.includes('href="movies.html" class="active-nav-item" aria-current="page"'),
    "Movies link is marked as current"
  );
  assert.ok(!html.includes('href="#"'), "never uses the href=# anti-pattern");
});

test("buildNavHtml highlights differ per current page", () => {
  const movies = nav.buildNavHtml("movies.html");
  const travel = nav.buildNavHtml("travel.html");

  // Movies page: Movies link is current, Travel is not.
  assert.ok(movies.includes('href="movies.html" class="active-nav-item"'));
  assert.ok(!movies.includes('href="travel.html" class="active-nav-item"'));

  // Travel page: Travel link is current, Movies is not.
  assert.ok(travel.includes('href="travel.html" class="active-nav-item"'));
  assert.ok(!travel.includes('href="movies.html" class="active-nav-item"'));
});

test("buildNavHtml nav icons are decorative (aria-hidden, empty alt)", () => {
  const html = nav.buildNavHtml("index.html");
  assert.ok(html.includes('alt="" aria-hidden="true"'), "icons are decorative");
});

// ---------------------------------------------------------------------------
// injectNav: synchronous placeholder replacement (timing-safe for scripts.js)
// ---------------------------------------------------------------------------
test("injectNav replaces #nav-placeholder synchronously with #primary-nav", () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><div id="nav-placeholder"></div></body></html>'
  );
  const doc = dom.window.document;

  const result = nav.injectNav(doc, "/movies.html");

  assert.strictEqual(doc.getElementById("nav-placeholder"), null, "placeholder removed");
  const injected = doc.getElementById("primary-nav");
  assert.ok(injected, "primary-nav present after injection");
  assert.strictEqual(injected.tagName, "NAV");
  assert.ok(injected.classList.contains("hidden-nav"), "nav starts hidden");
  assert.strictEqual(result, injected, "returns the injected nav element");

  // The Movies link is the current page.
  const current = injected.querySelector('[aria-current="page"]');
  assert.ok(current);
  assert.strictEqual(current.getAttribute("href"), "movies.html");
});

test("injectNav is a no-op when placeholder is absent", () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  assert.strictEqual(nav.injectNav(dom.window.document, "/index.html"), null);
});
