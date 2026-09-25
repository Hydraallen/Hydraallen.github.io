"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

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
// Card / marker navigation: place ids are percent-encoded into the trip URL.
// ---------------------------------------------------------------------------
test("tripUrl percent-encodes the place id", () => {
  assert.strictEqual(travel.tripUrl({ id: "nyc" }), "trip.html?place=nyc");
  assert.strictEqual(
    travel.tripUrl({ id: "san jose&x=1" }),
    "trip.html?place=san%20jose%26x%3D1",
    "spaces and query separators must not break out of the query string"
  );
});

test("tripUrl carries the page language when one is given", () => {
  assert.strictEqual(travel.tripUrl({ id: "nyc" }, "zh"), "trip.html?place=nyc&lang=zh");
  assert.strictEqual(travel.tripUrl({ id: "nyc" }, "en"), "trip.html?place=nyc&lang=en");
});

// ---------------------------------------------------------------------------
// Map tiles follow the site language (zh -> Chinese Google tiles).
// ---------------------------------------------------------------------------
test("mapLangFor maps the site language to a tile language", () => {
  assert.strictEqual(travel.mapLangFor("zh"), "cn");
  assert.strictEqual(travel.mapLangFor("en"), "en");
  assert.strictEqual(travel.mapLangFor(undefined), "en");
});

// ---------------------------------------------------------------------------
// buildPlaceCardHtml: pure, bilingual card markup.
// ---------------------------------------------------------------------------
const VISITED = {
  id: "ithaca",
  name: { en: "Ithaca", zh: "伊萨卡" },
  country_code: "US",
  state: "NY",
  continent: "namerica",
  date: "2025-01-15",
  date_end: "2025-05-17",
  video: "https://example.com/v",
  status: "visited",
  cover: "c.jpg",
};
const IDEA = {
  id: "japan",
  name: { en: "Japan", zh: "日本" },
  country_code: "JP",
  continent: "asia",
  date: null,
  date_end: null,
  video: "",
  status: "idea",
  cover: "j.jpg",
};

test("buildPlaceCardHtml renders an English card by default", () => {
  const html = travel.buildPlaceCardHtml(VISITED, false);
  assert.ok(html.includes('<div class="place-country">\u{1F1FA}\u{1F1F8} USA</div>'));
  assert.ok(html.includes('href="trip.html?place=ithaca&amp;lang=en">Ithaca, NY</a>'));
  assert.ok(html.includes('<div class="place-date">Jan 15 – May 17, 2025</div>'));
  assert.ok(html.includes('alt="Ithaca, NY"'));
  assert.ok(html.includes(">Play Video</a>"));
  assert.ok(!html.includes("Coming Soon"));
});

test("buildPlaceCardHtml renders a Chinese card", () => {
  const html = travel.buildPlaceCardHtml(VISITED, false, "zh");
  assert.ok(html.includes('<div class="place-country">\u{1F1FA}\u{1F1F8} 美国</div>'));
  assert.ok(html.includes('href="trip.html?place=ithaca&amp;lang=zh">伊萨卡，纽约州</a>'));
  assert.ok(html.includes('<div class="place-date">2025.01.15 – 05.17</div>'));
  assert.ok(html.includes(">播放视频</a>"));
});

test("buildPlaceCardHtml marks idea places and never prints null", () => {
  const en = travel.buildPlaceCardHtml(IDEA, true, "en");
  assert.ok(en.includes('<span class="hover-note">Coming Soon</span>'));
  assert.ok(en.includes('<div class="place-date">TODO List</div>'));
  assert.ok(!en.includes("Play Video"), "no video -> no button");
  const zh = travel.buildPlaceCardHtml(IDEA, true, "zh");
  assert.ok(zh.includes(">即将出发</span>"));
  assert.ok(zh.includes('<div class="place-date">待出发</div>'));
  [en, zh].forEach((html) => {
    assert.ok(!/null|undefined|\[object Object\]/.test(html));
  });
});

test("buildPlaceCardHtml escapes data-derived values", () => {
  const evil = Object.assign({}, VISITED, {
    name: { en: "<img src=x onerror=alert(1)>", zh: "x" },
    cover: '" onerror="evil()',
    video: 'javascript:"><script>',
  });
  const html = travel.buildPlaceCardHtml(evil, false);
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes('onerror="evil()'));
  assert.ok(!html.includes("<script>"));
});

test("buildPlaceCardHtml renders a placeholder instead of <img> when there is no cover", () => {
  [
    { ...IDEA, cover: "" },
    { ...IDEA, cover: "   " },
    { ...IDEA, cover: undefined },
  ].forEach((place) => {
    const html = travel.buildPlaceCardHtml(place, true, "en");
    assert.ok(!html.includes("<img"), "no <img> for an empty cover");
    assert.ok(html.includes('<div class="place-cover-placeholder" aria-hidden="true"></div>'));
    assert.ok(html.includes('<span class="hover-note">Coming Soon</span>'), "overlay kept");
  });
  const withCover = travel.buildPlaceCardHtml(IDEA, true, "en");
  assert.ok(withCover.includes('<img src="j.jpg"'));
  assert.ok(!withCover.includes("place-cover-placeholder"));
});
