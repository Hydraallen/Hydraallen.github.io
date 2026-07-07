"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { JSDOM } = require("jsdom");

// Require BEFORE any global.document is set so the DOMContentLoaded bootstrap
// (guarded by `typeof document`) is skipped, and MarkerIcons is skipped too
// (guarded by `typeof L`). Only the module-level pure helpers are exercised.
const travel = require("../js/scripts_travel.js");

// ---------------------------------------------------------------------------
// FIX #1: loadTravelData fault tolerance — a single 404 / bad file is skipped,
// the rest still load, instead of Promise.all rejecting and blanking the page.
// ---------------------------------------------------------------------------

// Minimal fake fetch: maps a URL substring to a canned Response-like object.
function makeFetch(responses) {
  return function fetchFn(url) {
    const key = Object.keys(responses).find((k) => url.includes(k));
    const r = responses[key];
    if (!r) return Promise.reject(new Error(`network error for ${url}`));
    return Promise.resolve(r);
  };
}

function okJson(data) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function notFound() {
  return { ok: false, status: 404, json: () => Promise.reject(new Error("no body")) };
}

test("fetchTravelFiles skips a 404 file and returns the rest", async () => {
  const fetchFn = makeFetch({
    "alaska.json": okJson({ name: "Alaska" }),
    "boston.json": notFound(), // 404 -> skipped
    "japan.json": okJson({ name: "Japan" }),
  });

  const result = await travel.fetchTravelFiles(["alaska", "boston", "japan"], fetchFn);

  assert.deepStrictEqual(
    result.map((p) => p.name),
    ["Alaska", "Japan"],
    "the 404 file must be filtered out, others preserved in order"
  );
});

test("fetchTravelFiles skips a file whose fetch rejects (network error)", async () => {
  const fetchFn = makeFetch({
    "alaska.json": okJson({ name: "Alaska" }),
    // "boston" intentionally absent -> fetchFn rejects for it
  });

  const result = await travel.fetchTravelFiles(["alaska", "boston"], fetchFn);
  assert.deepStrictEqual(result.map((p) => p.name), ["Alaska"]);
});

test("fetchTravelFiles skips a file whose json() throws (non-JSON body)", async () => {
  const fetchFn = makeFetch({
    "alaska.json": okJson({ name: "Alaska" }),
    "bad.json": { ok: true, status: 200, json: () => Promise.reject(new Error("not json")) },
  });

  const result = await travel.fetchTravelFiles(["alaska", "bad"], fetchFn);
  assert.deepStrictEqual(result.map((p) => p.name), ["Alaska"]);
});

test("fetchTravelFiles returns [] when every file fails", async () => {
  const fetchFn = makeFetch({}); // everything rejects
  const result = await travel.fetchTravelFiles(["a", "b"], fetchFn);
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// FIX #3: lightbox alt text updates per photo (was stuck on "Travel Photo").
// ---------------------------------------------------------------------------
test("applyLightboxPhoto updates src, alt, and caption per photo", () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
      '<img id="lightbox-img" src="" alt="Travel Photo">' +
      '<div id="lightbox-caption"></div>' +
      "</body></html>"
  );
  const doc = dom.window.document;
  const img = doc.getElementById("lightbox-img");
  const caption = doc.getElementById("lightbox-caption");

  // Photo with a location -> alt + caption reflect it.
  travel.applyLightboxPhoto(img, caption, { src: "a.jpg", location: "Denali" });
  assert.strictEqual(img.getAttribute("src"), "a.jpg");
  assert.strictEqual(img.getAttribute("alt"), "Denali");
  assert.strictEqual(caption.textContent, "Denali");
  assert.strictEqual(caption.style.display, "block");

  // Switching to a different photo updates the alt (regression guard).
  travel.applyLightboxPhoto(img, caption, { src: "b.jpg", location: "Kyoto" });
  assert.strictEqual(img.getAttribute("src"), "b.jpg");
  assert.strictEqual(img.getAttribute("alt"), "Kyoto");
  assert.strictEqual(caption.textContent, "Kyoto");

  // Plain-string photo (no location) -> alt falls back, caption hidden.
  travel.applyLightboxPhoto(img, caption, "c.jpg");
  assert.strictEqual(img.getAttribute("src"), "c.jpg");
  assert.strictEqual(img.getAttribute("alt"), "Travel photo");
  assert.strictEqual(caption.textContent, "");
  assert.strictEqual(caption.style.display, "none");
});
