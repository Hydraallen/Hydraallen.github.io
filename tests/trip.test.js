"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const lib = require("../js/lib.js");
const trip = require("../js/scripts_trip.js");

// ---------------------------------------------------------------------------
// getPlaceIdFromSearch
// ---------------------------------------------------------------------------

test("getPlaceIdFromSearch extracts the place id", () => {
  assert.strictEqual(lib.getPlaceIdFromSearch("?place=nyc"), "nyc");
  assert.strictEqual(lib.getPlaceIdFromSearch("place=nyc"), "nyc");
});

test("getPlaceIdFromSearch handles multiple params in any position", () => {
  assert.strictEqual(lib.getPlaceIdFromSearch("?a=1&place=kyoto&b=2"), "kyoto");
  assert.strictEqual(lib.getPlaceIdFromSearch("?place=kyoto&place=nyc"), "kyoto");
});

test("getPlaceIdFromSearch decodes percent-encoding", () => {
  assert.strictEqual(lib.getPlaceIdFromSearch("?place=new%20york"), "new york");
});

test("getPlaceIdFromSearch returns null for missing/empty/invalid input", () => {
  assert.strictEqual(lib.getPlaceIdFromSearch("?other=1"), null, "no place param");
  assert.strictEqual(lib.getPlaceIdFromSearch(""), null, "empty search string");
  assert.strictEqual(lib.getPlaceIdFromSearch("?place="), null, "empty value");
  assert.strictEqual(lib.getPlaceIdFromSearch(null), null, "null input");
  assert.strictEqual(lib.getPlaceIdFromSearch(undefined), null, "undefined input");
  assert.strictEqual(lib.getPlaceIdFromSearch(42), null, "non-string input");
});

// ---------------------------------------------------------------------------
// findPhotoIndex
// ---------------------------------------------------------------------------

test("findPhotoIndex finds object-shaped and string-shaped photos", () => {
  const photos = [{ src: "a.jpg" }, "b.jpg", { src: "c.jpg", location: "X" }];
  assert.strictEqual(lib.findPhotoIndex(photos, "a.jpg"), 0);
  assert.strictEqual(lib.findPhotoIndex(photos, "b.jpg"), 1, "plain string photo matches");
  assert.strictEqual(lib.findPhotoIndex(photos, "c.jpg"), 2);
});

test("findPhotoIndex returns -1 when the src is absent", () => {
  assert.strictEqual(lib.findPhotoIndex([{ src: "a.jpg" }], "z.jpg"), -1);
});

test("findPhotoIndex tolerates undefined/empty photos and missing src", () => {
  assert.strictEqual(lib.findPhotoIndex(undefined, "a.jpg"), -1, "photos undefined");
  assert.strictEqual(lib.findPhotoIndex([], "a.jpg"), -1, "photos empty");
  assert.strictEqual(lib.findPhotoIndex([{ src: "a.jpg" }], undefined), -1, "no src");
});

// ---------------------------------------------------------------------------
// groupPhotosByLocation
// ---------------------------------------------------------------------------

test("groupPhotosByLocation merges photos sharing coordinates", () => {
  const photos = [
    { src: "1.jpg", location: "Park", coordinates: [1, 2] },
    { src: "2.jpg", location: "Bridge", coordinates: [3, 4] },
    { src: "3.jpg", location: "Park", coordinates: [1, 2] },
  ];
  const groups = lib.groupPhotosByLocation(photos);

  assert.strictEqual(groups.length, 2, "two distinct coordinates -> two groups");
  assert.strictEqual(groups[0].locationName, "Park");
  assert.deepStrictEqual(groups[0].coordinates, [1, 2]);
  assert.deepStrictEqual(
    groups[0].items.map((i) => i.src),
    ["1.jpg", "3.jpg"],
    "same-coordinate photos land in one group"
  );
  assert.strictEqual(groups[1].locationName, "Bridge");
});

test("groupPhotosByLocation keeps first-seen order and correct originalIndex", () => {
  const photos = [
    { src: "0.jpg", location: "B", coordinates: [9, 9] },
    { src: "1.jpg", location: "A", coordinates: [1, 1] },
    { src: "2.jpg", location: "B", coordinates: [9, 9] },
  ];
  const groups = lib.groupPhotosByLocation(photos);

  assert.deepStrictEqual(
    groups.map((g) => g.locationName),
    ["B", "A"],
    "group order follows first appearance, not sort order"
  );
  assert.deepStrictEqual(
    groups[0].items.map((i) => i.originalIndex),
    [0, 2],
    "originalIndex refers to the position in the source array"
  );
  assert.deepStrictEqual(groups[1].items.map((i) => i.originalIndex), [1]);
});

test("groupPhotosByLocation skips entries without coordinates", () => {
  const photos = [
    "plain-string.jpg",
    { src: "no-coords.jpg", location: "Nowhere" },
    { src: "ok.jpg", location: "Here", coordinates: [5, 5] },
  ];
  const groups = lib.groupPhotosByLocation(photos);

  assert.strictEqual(groups.length, 1, "only the coordinate-bearing photo groups");
  assert.strictEqual(groups[0].items[0].src, "ok.jpg");
  assert.strictEqual(
    groups[0].items[0].originalIndex,
    2,
    "originalIndex still counts the skipped photos"
  );
});

test("groupPhotosByLocation defaults locationName to empty string", () => {
  const groups = lib.groupPhotosByLocation([{ src: "a.jpg", coordinates: [1, 1] }]);
  assert.strictEqual(groups[0].locationName, "");
});

test("groupPhotosByLocation returns [] for undefined/empty input", () => {
  assert.deepStrictEqual(lib.groupPhotosByLocation(undefined), []);
  assert.deepStrictEqual(lib.groupPhotosByLocation([]), []);
});

test("groupPhotosByLocation does not mutate the source photos", () => {
  const photo = { src: "a.jpg", coordinates: [1, 1] };
  lib.groupPhotosByLocation([photo]);
  assert.strictEqual(photo.originalIndex, undefined, "source photo stays untouched");
});

// ---------------------------------------------------------------------------
// STOP_TYPES / getStopType
// ---------------------------------------------------------------------------

test("STOP_TYPES exposes the four categories with an icon; labels come from the dictionary", () => {
  ["sight", "food", "hotel", "transport"].forEach((key) => {
    assert.ok(lib.STOP_TYPES[key], `${key} must exist`);
    assert.ok(lib.STOP_TYPES[key].icon, `${key} needs an icon`);
  });
  assert.strictEqual(lib.getStopType("hotel").label, "Stay");
  assert.strictEqual(lib.getStopType("transport").label, "Transit");
  assert.strictEqual(lib.getStopType("hotel", "zh").label, "住宿");
  assert.strictEqual(lib.getStopType("transport", "zh").label, "交通");
});

test("getStopType falls back instead of returning undefined", () => {
  assert.strictEqual(lib.getStopType("food").label, "Food");
  assert.deepStrictEqual(lib.getStopType("museum", "zh"), { label: "站点", icon: "•" });
  assert.deepStrictEqual(lib.getStopType("museum"), { label: "Stop", icon: "•" });
  assert.deepStrictEqual(lib.getStopType(undefined), { label: "Stop", icon: "•" });
  assert.deepStrictEqual(
    lib.getStopType("constructor"),
    { label: "Stop", icon: "•" },
    "inherited Object keys must not leak through"
  );
});

// ---------------------------------------------------------------------------
// getTripDays
// ---------------------------------------------------------------------------

test("getTripDays returns [] for null/undefined/missing/non-array days", () => {
  assert.deepStrictEqual(lib.getTripDays(null), []);
  assert.deepStrictEqual(lib.getTripDays(undefined), []);
  assert.deepStrictEqual(lib.getTripDays({}), [], "trip without days");
  assert.deepStrictEqual(lib.getTripDays({ days: "nope" }), [], "days not an array");
  assert.deepStrictEqual(lib.getTripDays({ days: {} }), []);
});

test("getTripDays returns the days array when present", () => {
  const days = [{ day: 1 }, { day: 2 }];
  assert.strictEqual(lib.getTripDays({ days: days }), days);
});

// ---------------------------------------------------------------------------
// buildStopHtml
// ---------------------------------------------------------------------------

test("buildStopHtml renders name, note and type sticker", () => {
  const html = lib.buildStopHtml({ type: "food", name: "Katz's", note: "pastrami" }, -1);
  assert.ok(html.includes('class="stop stop-food"'), "type drives the class");
  assert.ok(html.includes("🍜"));
  assert.ok(html.includes(">Food<"));
  assert.ok(html.includes('<h4 class="stop-name">Katz&#39;s</h4>'));
  assert.ok(html.includes('<p class="stop-note">pastrami</p>'));
});

test("buildStopHtml picks localized name/note and labels in the page language", () => {
  const stop = {
    type: "sight",
    name: { en: "Central Park", zh: "中央公园" },
    note: { en: "Walked for hours", zh: "走了三个多小时" },
    photo: "p.jpg",
  };
  const zh = lib.buildStopHtml(stop, 0, "zh");
  assert.ok(zh.includes('<h4 class="stop-name">中央公园</h4>'));
  assert.ok(zh.includes('<p class="stop-note">走了三个多小时</p>'));
  assert.ok(zh.includes(">景点<"), "zh type label");
  assert.ok(zh.includes('aria-label="中央公园的照片"'));
  const en = lib.buildStopHtml(stop, 0);
  assert.ok(en.includes('<h4 class="stop-name">Central Park</h4>'), "defaults to English");
  assert.ok(en.includes('aria-label="Photo of Central Park"'));
  assert.ok(!en.includes("[object Object]"));
});

test("buildStopHtml omits the note element when there is no note", () => {
  const html = lib.buildStopHtml({ type: "sight", name: "MoMA" }, -1);
  assert.ok(!html.includes("stop-note"), "no empty note paragraph");
});

test("buildStopHtml escapes an XSS payload in name and note", () => {
  const payload = '<img src=x onerror=alert(1)>';
  const html = lib.buildStopHtml({ type: "sight", name: payload, note: payload }, -1);

  assert.ok(!html.includes("<img src=x"), "raw injected img must not survive");
  assert.ok(!html.includes("onerror=alert(1)>"), "raw handler must not survive");
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "payload is escaped");
  assert.strictEqual(
    (html.match(/&lt;img src=x onerror=alert\(1\)&gt;/g) || []).length,
    2,
    "both name and note are escaped"
  );
});

test("buildStopHtml escapes a quote-breaking payload in the type class", () => {
  const html = lib.buildStopHtml({ type: '" onmouseover="evil()', name: "X" }, -1);
  assert.ok(!html.includes('onmouseover="evil()'), "attribute must not be broken out of");
  assert.ok(!html.includes("undefined"), "unknown type still uses the fallback label");
});

test("buildStopHtml renders a thumbnail only when a photo maps to an index", () => {
  const withPhoto = lib.buildStopHtml(
    { type: "sight", name: "Central Park", photo: "p.jpg" },
    3
  );
  assert.ok(withPhoto.includes('<img class="stop-photo" src="p.jpg"'), "thumbnail rendered");
  assert.ok(withPhoto.includes('data-photo-index="3"'), "index exposed for delegation");
  assert.ok(withPhoto.includes('loading="lazy"'));
  assert.ok(!withPhoto.includes("onclick"), "no inline handler");
  assert.ok(!withPhoto.includes("/>"), "void tags are not self-closing");
});

test("buildStopHtml makes the thumbnail keyboard reachable", () => {
  const html = lib.buildStopHtml(
    { type: "sight", name: "Central Park", photo: "p.jpg" },
    3
  );
  assert.ok(
    html.includes('<button class="stop-photo-btn" type="button" data-photo-index="3"'),
    "the thumbnail is wrapped in a real button carrying the index"
  );
  assert.ok(
    html.includes('aria-label="Photo of Central Park"'),
    "the button has an accessible name"
  );
  assert.ok(html.includes('alt=""'), "the image is not announced a second time");
  assert.ok(!html.includes("tabindex"), "no hand-rolled tabindex is needed");
  assert.ok(!html.includes('role="button"'), "no ARIA role stands in for a button");
  assert.ok(html.includes("</button></li>"), "the button closes inside the list item");
});

test("buildStopHtml escapes the stop name inside the button label", () => {
  const html = lib.buildStopHtml(
    { type: "sight", name: '" onfocus="evil()', photo: "p.jpg" },
    1
  );
  assert.ok(!html.includes('onfocus="evil()'), "attribute must not be broken out of");
});

test("buildStopHtml renders no thumbnail when photoIndex is -1", () => {
  const html = lib.buildStopHtml({ type: "sight", name: "X", photo: "p.jpg" }, -1);
  assert.ok(!html.includes('<img class="stop-photo"'), "unmatched photo -> no thumbnail");
  assert.ok(!html.includes("data-photo-index"), "no index attribute either");
});

test("buildStopHtml renders no thumbnail when the stop has no photo", () => {
  const html = lib.buildStopHtml({ type: "sight", name: "X" }, 0);
  assert.ok(!html.includes('<img class="stop-photo"'));
  assert.ok(!html.includes("data-photo-index"));
});

test("buildStopHtml coerces a non-numeric photoIndex instead of injecting it", () => {
  const html = lib.buildStopHtml(
    { type: "sight", name: "X", photo: "p.jpg" },
    '1" onload="evil()'
  );
  assert.ok(!html.includes("onload"), "string index must not reach the attribute");
});

test("buildStopHtml survives a missing/unknown type without printing undefined", () => {
  const unknown = lib.buildStopHtml({ name: "Mystery" }, -1);
  assert.ok(!unknown.includes("undefined"), "no undefined in the output");
  assert.ok(unknown.includes(">Stop<"), "fallback label used");
  assert.ok(unknown.includes("•"), "fallback icon used");
  assert.ok(unknown.includes('class="stop stop-default"'));
});

test("buildStopHtml tolerates a null stop", () => {
  const html = lib.buildStopHtml(null, -1);
  assert.ok(html.startsWith("<li"), "still returns a list item");
  assert.ok(!html.includes("undefined"));
});

// ---------------------------------------------------------------------------
// buildDayHtml
// ---------------------------------------------------------------------------

test("buildDayHtml renders the date stub, title and stop list", () => {
  const html = lib.buildDayHtml(
    { day: 2, date: "2025-01-11", title: "Downtown", stops: [{ type: "food", name: "Joe's" }] },
    []
  );
  assert.ok(html.includes('<section class="trip-day">'));
  assert.ok(html.includes('<span class="day-badge">Day 2</span>'));
  assert.ok(html.includes('<span class="day-date">Jan 11, 2025</span>'), "ISO date is localized");
  assert.ok(html.includes('<h3 class="day-title">Downtown</h3>'));
  assert.ok(html.includes('<ol class="stop-list">'));
  assert.ok(html.includes("Joe&#39;s"));
});

test("buildDayHtml renders the badge, date and title in Chinese", () => {
  const html = lib.buildDayHtml(
    { day: 3, date: "2025-01-12", title: { en: "Central Park", zh: "中央公园" }, stops: [] },
    [],
    "zh"
  );
  assert.ok(html.includes('<span class="day-badge">第 3 天</span>'));
  assert.ok(html.includes('<span class="day-date">2025.01.12</span>'));
  assert.ok(html.includes('<h3 class="day-title">中央公园</h3>'));
});

test("buildDayHtml maps each stop photo to its gallery index", () => {
  const photos = [{ src: "a.jpg" }, { src: "b.jpg" }, { src: "c.jpg" }];
  const html = lib.buildDayHtml(
    {
      day: 1,
      date: "d",
      title: "t",
      stops: [
        { type: "sight", name: "A", photo: "c.jpg" },
        { type: "sight", name: "B", photo: "missing.jpg" },
      ],
    },
    photos
  );
  assert.ok(html.includes('data-photo-index="2"'), "c.jpg resolves to index 2");
  assert.strictEqual(
    (html.match(/data-photo-index/g) || []).length,
    1,
    "the unmatched photo gets no index"
  );
});

test("buildDayHtml renders an empty list when stops are missing or malformed", () => {
  assert.ok(
    lib.buildDayHtml({ day: 1, date: "d", title: "t" }, []).includes('<ol class="stop-list"></ol>'),
    "missing stops -> empty <ol>"
  );
  assert.ok(
    lib.buildDayHtml({ stops: "nope" }, []).includes('<ol class="stop-list"></ol>'),
    "non-array stops -> empty <ol>"
  );
  assert.doesNotThrow(() => lib.buildDayHtml(null, undefined), "a null day must not throw");
});

test("buildDayHtml escapes day metadata", () => {
  const html = lib.buildDayHtml(
    { day: "<b>1</b>", date: '"><script>x</script>', title: "<i>t</i>", stops: [] },
    []
  );
  assert.ok(!html.includes("<script>"), "raw script tag must not survive");
  assert.ok(!html.includes("<b>1</b>"));
  assert.ok(!html.includes("<i>t</i>"));
});

// ---------------------------------------------------------------------------
// buildPopupHtml
// ---------------------------------------------------------------------------

test("buildPopupHtml renders one thumbnail per item inside the gallery strip", () => {
  const html = trip.buildPopupHtml({
    locationName: "Central Park",
    items: [
      { src: "a.jpg", location: "Central Park", originalIndex: 0 },
      { src: "b.jpg", location: "Central Park", originalIndex: 4 },
    ],
  });
  assert.ok(html.includes('<div class="popup-gallery-container">'), "scroll container present");
  assert.strictEqual((html.match(/popup-photo-thumb/g) || []).length, 2, "one thumb per item");
  assert.ok(html.includes('data-photo-index="0"'));
  assert.ok(html.includes('data-photo-index="4"'), "the gallery index is preserved, not the position");
  assert.ok(
    html.includes('<div class="popup-location-name">Central Park (2)</div>'),
    "the count is shown for a multi-photo group"
  );
  assert.ok(!html.includes("/>"), "void tags are not self-closing");
  assert.ok(!html.includes("onclick"), "no inline handler");
});

test("buildPopupHtml omits the count for a single photo", () => {
  const html = trip.buildPopupHtml({
    locationName: "MoMA",
    items: [{ src: "a.jpg", location: "MoMA", originalIndex: 1 }],
  });
  assert.ok(html.includes('<div class="popup-location-name">MoMA</div>'), "no (1) suffix");
});

test("buildPopupHtml makes popup thumbnails keyboard reachable", () => {
  const html = trip.buildPopupHtml({
    locationName: "MoMA",
    items: [{ src: "a.jpg", location: "MoMA", originalIndex: 1 }],
  });
  assert.ok(
    html.includes('<button class="popup-photo-thumb" type="button" data-photo-index="1"'),
    "the thumbnail is a real button carrying the index"
  );
  assert.ok(html.includes('aria-label="Photo of MoMA"'), "the button has an accessible name");
  assert.ok(html.includes('alt=""'), "the image is not announced a second time");
  assert.ok(!html.includes("tabindex"), "no hand-rolled tabindex is needed");
  assert.ok(!html.includes('role="button"'), "no ARIA role stands in for a button");
});

test("buildPopupHtml picks localized locations", () => {
  const loc = { en: "Central Park", zh: "中央公园" };
  const group = {
    locationName: loc,
    items: [
      { src: "a.jpg", location: loc, originalIndex: 0 },
      { src: "b.jpg", location: loc, originalIndex: 1 },
    ],
  };
  const zh = trip.buildPopupHtml(group, "zh");
  assert.ok(zh.includes('<div class="popup-location-name">中央公园 (2)</div>'));
  assert.ok(zh.includes('aria-label="中央公园的照片"'));
  assert.ok(zh.includes('title="中央公园"'));
  assert.ok(trip.buildPopupHtml(group).includes("Central Park (2)"), "defaults to English");
});

test("buildPopupHtml escapes location and src, and coerces the index", () => {
  const html = trip.buildPopupHtml({
    locationName: '<script>x</script>',
    items: [
      {
        src: '" onerror="evil()',
        location: '" onmouseover="evil()',
        originalIndex: '2" onload="evil()',
      },
    ],
  });
  assert.ok(!html.includes("<script>"), "raw script tag must not survive");
  assert.ok(!html.includes('onerror="evil()'), "src must not break out of its attribute");
  assert.ok(!html.includes('onmouseover="evil()'), "location must not break out of its attribute");
  assert.ok(!html.includes("onload"), "a string index must not reach the attribute");
});

// ---------------------------------------------------------------------------
// Page-level helpers: dates, photo wall, error path, tiles (bilingual)
// ---------------------------------------------------------------------------
const PLACE = {
  id: "nyc",
  name: { en: "New York City", zh: "纽约" },
  country_code: "US",
  state: "NY",
  status: "visited",
  date: "2025-01-10",
  date_end: "2025-01-14",
};

test("getTripDateDisplay prefers the trip's day range, then the place dates", () => {
  const t = { days: [{ date: "2025-01-11" }, { date: "2025-01-13" }] };
  assert.strictEqual(trip.getTripDateDisplay(PLACE, t), "Jan 11–13, 2025");
  assert.strictEqual(trip.getTripDateDisplay(PLACE, t, "zh"), "2025.01.11 – 01.13");
  assert.strictEqual(trip.getTripDateDisplay(PLACE, null, "zh"), "2025.01.10 – 01.14");
  assert.strictEqual(trip.getTripDateDisplay(PLACE, { days: [] }), "Jan 10–14, 2025");
  assert.strictEqual(trip.getTripDateDisplay(null, null), "");
});

test("buildPhotoWallHtml uses localized captions and a localized fallback alt", () => {
  const photos = [{ src: "a.jpg", location: { en: "Times Square", zh: "时代广场" } }, "b.jpg"];
  const zh = trip.buildPhotoWallHtml(photos, "zh");
  assert.ok(zh.includes('alt="时代广场"'));
  assert.ok(zh.includes('alt="旅行照片"'), "string photo gets the zh fallback");
  const en = trip.buildPhotoWallHtml(photos);
  assert.ok(en.includes('alt="Times Square"'));
  assert.ok(en.includes('alt="Travel photo"'));
});

test("tripTileUrl follows the site language", () => {
  assert.ok(trip.tripTileUrl("en").includes("hl=en"));
  assert.ok(trip.tripTileUrl("zh").includes("hl=zh-CN"));
  assert.ok(trip.tripTileUrl().includes("hl=en"), "defaults to English");
});

function fakeErrorDoc() {
  const nodes = {
    "trip-page": { classList: { add() {} } },
    "trip-error": {
      innerHTML: "",
      classList: { removed: [], remove(c) { this.removed.push(c); } },
    },
  };
  return { nodes, getElementById: (id) => nodes[id] || null };
}

test("showTripError localizes the back link and keeps the language", () => {
  const doc = fakeErrorDoc();
  trip.showTripError(doc, "找不到", "zh");
  const html = doc.nodes["trip-error"].innerHTML;
  assert.ok(html.includes('href="travel.html?lang=zh"'), html);
  assert.ok(html.includes(">返回所有目的地</a>"));
  const docEn = fakeErrorDoc();
  trip.showTripError(docEn, '<b>x</b>');
  assert.ok(docEn.nodes["trip-error"].innerHTML.startsWith("&lt;b&gt;x&lt;/b&gt;"), "message escaped");
  assert.ok(docEn.nodes["trip-error"].innerHTML.includes(">Back to all destinations</a>"));
});
