"use strict";

// Content guardrails for data/travel/*.json and data/trips/*.json.
// 旅行 / 行程数据校验：本地化完整性、国家代码、ISO 日期与顺序、清单一致性。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("./helpers/content_rules.js");

const { dict } = rules.loadAllStrings();
const TRAVEL_DIR = path.join(rules.ROOT, "data", "travel");
const TRIPS_DIR = path.join(rules.ROOT, "data", "trips");
const MANIFEST_EXCLUDED = ["index.json", "backup.json"];

const PLACE_KEYS = [
  "id", "name", "country_code", "state", "continent", "date", "date_end",
  "video", "status", "trip", "cover", "coordinates", "photos",
];
const CONTINENTS = ["asia", "europe", "namerica", "samerica", "africa", "oceania", "antarctica"];
const STOP_TYPES = ["sight", "food", "hotel", "transport"];

function readDir(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !MANIFEST_EXCLUDED.includes(f))
    .sort()
    .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
}

const places = readDir(TRAVEL_DIR);
const trips = readDir(TRIPS_DIR);

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
}

// --- Places -----------------------------------------------------------------

function checkPlaceShape(p, where) {
  const errors = [];
  const extra = Object.keys(p).filter((k) => !PLACE_KEYS.includes(k));
  if (extra.length) errors.push(`${where}: unexpected keys ${extra.join(",")}`);
  ["country", "date_display"].forEach((legacy) => {
    if (legacy in p) errors.push(`${where}: legacy field "${legacy}" must be removed`);
  });
  errors.push(...rules.checkLocalizedText(p.name, `${where}.name`));
  if (!/^[A-Z]{2}$/.test(String(p.country_code))) {
    errors.push(`${where}.country_code: expected ISO alpha-2, got "${p.country_code}"`);
  } else if (!(`country.${p.country_code}` in dict)) {
    errors.push(`${where}.country_code: no "country.${p.country_code}" string`);
  }
  if ("state" in p) {
    if (p.country_code !== "US") errors.push(`${where}.state: only US places carry a state`);
    if (!(`state.${p.state}` in dict)) errors.push(`${where}.state: no "state.${p.state}" string`);
  }
  if (!CONTINENTS.includes(p.continent)) errors.push(`${where}.continent: "${p.continent}"`);
  if (!Array.isArray(p.coordinates) || p.coordinates.length !== 2) {
    errors.push(`${where}.coordinates: expected [lat, lng]`);
  }
  return errors;
}

function checkPlaceDates(p, where) {
  if (p.status === "idea") {
    return p.date === null && p.date_end === null
      ? []
      : [`${where}: idea places use date:null, date_end:null`];
  }
  if (p.status !== "visited") return [`${where}.status: "${p.status}"`];
  return rules.checkDateRange({ start: p.date, end: p.date_end }, where, "day").concat(
    p.date_end === null ? [`${where}.date_end: a visited place needs an end date`] : []
  );
}

function checkPhotos(p, where) {
  const errors = [];
  (p.photos || []).forEach((photo, i) => {
    const w = `${where}.photos[${i}]`;
    if (typeof photo === "string") return;
    if (typeof photo.src !== "string" || !photo.src) errors.push(`${w}.src missing`);
    if ("location" in photo) errors.push(...rules.checkLocalizedText(photo.location, `${w}.location`));
  });
  return errors;
}

test("travel: every place matches the bilingual schema", () => {
  const errors = [];
  places.forEach(({ file, data }) => {
    if (data.id !== file.replace(/\.json$/, "")) errors.push(`${file}: id "${data.id}" != file name`);
    errors.push(...checkPlaceShape(data, file), ...checkPlaceDates(data, file), ...checkPhotos(data, file));
  });
  assert.deepStrictEqual(errors, []);
});

// Image paths are relative to the JSON file. An empty cover means "no cover yet"
// (new places from the LifeChecklist sync); anything else must exist on disk.
// 图片路径相对 JSON 文件；空 cover 表示尚无封面，否则文件必须存在。
function checkImageFiles(p, where, dir = TRAVEL_DIR) {
  const exists = (rel) => fs.existsSync(path.resolve(dir, rel));
  const errors = [];
  if (typeof p.cover !== "string") errors.push(`${where}.cover: expected a string`);
  else if (p.cover && !exists(p.cover)) errors.push(`${where}.cover: missing file ${p.cover}`);
  (p.photos || []).forEach((photo, i) => {
    const src = typeof photo === "string" ? photo : photo && photo.src;
    if (typeof src === "string" && src && !exists(src)) {
      errors.push(`${where}.photos[${i}]: missing file ${src}`);
    }
  });
  return errors;
}

test("travel: every cover and photo file exists", () => {
  const errors = places.flatMap(({ file, data }) => checkImageFiles(data, file));
  assert.deepStrictEqual(errors, []);
});

test("image rules flag missing cover and photo files, allow an empty cover", () => {
  const photos = ["../../img/nope/a.jpg", { src: "../../img/nope/b.jpg" }];
  const errors = checkImageFiles({ cover: "../../img/nope/c.jpg", photos }, "p");
  assert.deepStrictEqual(errors, [
    "p.cover: missing file ../../img/nope/c.jpg",
    "p.photos[0]: missing file ../../img/nope/a.jpg",
    "p.photos[1]: missing file ../../img/nope/b.jpg",
  ]);
  assert.deepStrictEqual(checkImageFiles({ cover: "", photos: [] }, "p"), []);
  assert.deepStrictEqual(checkImageFiles({ photos: [] }, "p"), ["p.cover: expected a string"]);
});

test("travel: index.json lists exactly the place files", () => {
  const files = places.map((p) => p.file.replace(/\.json$/, ""));
  assert.deepStrictEqual(readManifest(TRAVEL_DIR), files);
});

test("travel: a referenced trip file exists and names the place back", () => {
  const errors = [];
  places
    .filter(({ data }) => data.trip)
    .forEach(({ file, data }) => {
      const tripEntry = trips.find((t) => t.data.id === data.trip);
      if (!tripEntry) errors.push(`${file}: trip "${data.trip}" not found`);
      else if (!(tripEntry.data.places || []).includes(data.id)) {
        errors.push(`${file}: trip "${data.trip}" does not list "${data.id}"`);
      }
    });
  assert.deepStrictEqual(errors, []);
});

// --- Trips ------------------------------------------------------------------

function checkStop(stop, where) {
  const errors = [];
  if (!STOP_TYPES.includes(stop.type)) errors.push(`${where}.type: "${stop.type}"`);
  if (typeof stop.name !== "string" || stop.name.trim() === "") {
    errors.push(...rules.checkLocalizedText(stop.name, `${where}.name`));
  }
  if ("note" in stop) errors.push(...rules.checkLocalizedText(stop.note, `${where}.note`));
  return errors;
}

function checkDay(day, i, where, photoSrcs) {
  const errors = [];
  const w = `${where}.days[${i}]`;
  if (day.day !== i + 1) errors.push(`${w}.day: expected ${i + 1}, got ${day.day}`);
  if (!rules.isIsoDay(day.date)) errors.push(`${w}.date: invalid "${day.date}"`);
  errors.push(...rules.checkLocalizedText(day.title, `${w}.title`));
  (day.stops || []).forEach((stop, j) => {
    errors.push(...checkStop(stop, `${w}.stops[${j}]`));
    if (stop.photo && !photoSrcs.has(stop.photo)) {
      errors.push(`${w}.stops[${j}].photo: "${stop.photo}" is not in the place gallery`);
    }
  });
  return errors;
}

function checkTrip(trip, where) {
  const errors = [];
  if ("date_display" in trip) errors.push(`${where}: legacy field "date_display" must be removed`);
  errors.push(...rules.checkLocalizedText(trip.title, `${where}.title`));
  if ("summary" in trip) errors.push(...rules.checkLocalizedText(trip.summary, `${where}.summary`));
  const photoSrcs = new Set();
  (trip.places || []).forEach((id) => {
    const place = places.find((p) => p.data.id === id);
    if (!place) errors.push(`${where}.places: unknown place "${id}"`);
    else (place.data.photos || []).forEach((ph) => photoSrcs.add(typeof ph === "string" ? ph : ph.src));
  });
  const days = Array.isArray(trip.days) ? trip.days : [];
  days.forEach((day, i) => errors.push(...checkDay(day, i, where, photoSrcs)));
  for (let i = 1; i < days.length; i++) {
    if (!(String(days[i - 1].date) < String(days[i].date))) {
      errors.push(`${where}.days[${i}]: dates must strictly increase`);
    }
  }
  return errors;
}

test("trips: every trip matches the bilingual schema with ordered ISO days", () => {
  const errors = [];
  trips.forEach(({ file, data }) => {
    if (data.id !== file.replace(/\.json$/, "")) errors.push(`${file}: id "${data.id}" != file name`);
    errors.push(...checkTrip(data, file));
  });
  assert.deepStrictEqual(errors, []);
});

test("trips: days fall inside the place's visit dates", () => {
  const errors = [];
  trips.forEach(({ file, data }) => {
    const days = data.days || [];
    (data.places || []).forEach((id) => {
      const place = places.find((p) => p.data.id === id);
      if (!place || !days.length) return;
      const { date, date_end: end } = place.data;
      if (days[0].date < date || days[days.length - 1].date > end) {
        errors.push(`${file}: days ${days[0].date}..${days[days.length - 1].date} outside ${id} ${date}..${end}`);
      }
    });
  });
  assert.deepStrictEqual(errors, []);
});

test("trips: index.json lists exactly the trip files", () => {
  assert.deepStrictEqual(readManifest(TRIPS_DIR), trips.map((t) => t.file.replace(/\.json$/, "")));
});

// --- Rule self-tests (fictional fixtures) ------------------------------------

test("place rules flag legacy fields, bad codes and inverted dates", () => {
  const bad = {
    id: "x", name: "Plain", country: "🇺🇸 USA", country_code: "usa", continent: "mars",
    date: "2025-02-01", date_end: "2025-01-01", status: "visited", coordinates: [1, 2],
    date_display: "Feb 1",
  };
  const errors = checkPlaceShape(bad, "x").concat(checkPlaceDates(bad, "x"));
  ["legacy field \"country\"", "legacy field \"date_display\"", "x.name", "country_code", "continent", "after end"]
    .forEach((needle) => assert.ok(errors.some((e) => e.includes(needle)), needle));
  assert.deepStrictEqual(
    checkPlaceDates({ status: "idea", date: "2025-01-01", date_end: null }, "p").length,
    1
  );
  assert.deepStrictEqual(checkPlaceDates({ status: "idea", date: null, date_end: null }, "p"), []);
  // The legacy "planned" status was renamed to "idea" and is rejected.
  assert.deepStrictEqual(
    checkPlaceDates({ status: "planned", date: null, date_end: null }, "p"),
    ['p.status: "planned"']
  );
});

test("trip rules require localized title/notes and strictly increasing days", () => {
  const errors = checkTrip(
    {
      title: "纽约",
      days: [
        { day: 1, date: "2025-01-02", title: { en: "A", zh: "甲" }, stops: [{ type: "food", name: "Joe's", note: "好吃" }] },
        { day: 2, date: "2025-01-01", title: { en: "B", zh: "乙" }, stops: [{ type: "sight", name: { en: "X" } }] },
      ],
    },
    "t"
  );
  ["t.title", "stops[0].note", "stops[0].name", "dates must strictly increase"].forEach((needle) =>
    assert.ok(errors.some((e) => e.includes(needle)), needle)
  );
});
