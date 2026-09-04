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
