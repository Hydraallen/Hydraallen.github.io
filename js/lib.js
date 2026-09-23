// ==========================================
// js/lib.js
// Pure helper functions shared by scripts.js (movies) and scripts_travel.js.
// IMPORTANT: This module MUST NOT touch the DOM at the top level.
// It works in two environments:
//   - Browser: plain function declarations expose helpers on the global scope
//     (HTML must load this file BEFORE scripts.js / scripts_travel.js).
//   - Node (tests): the module.exports guard at the bottom exports everything.
// i18n: js/i18n.js is loaded in <head> on every page, so in the browser its
// globals exist before this file runs; Node requires it (which also registers
// all strings). User-facing text is resolved at call time with a `lang`
// argument that defaults to "en".
// 文案通过 js/i18n.js 取得；渲染函数都接收末尾的 lang 参数（默认 "en"）。
// ==========================================

var _libI18n =
  typeof module !== "undefined" && module.exports
    ? require("./i18n.js")
    : { t: t, pick: pick, formatDayRange: formatDayRange };

// Placeholder poster used when a movie has no poster image.
// Inline SVG data URI keeps this self-contained (no external host). It carries
// no text, so it needs no translation (the <img> alt is the movie title).
// 内联 SVG data URI，不含文字，因此无需翻译。
var NO_POSTER_SRC =
  "data:image/svg+xml;utf8," +
  "%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22%3E" +
  "%3Crect width=%22200%22 height=%22300%22 fill=%22%23e0e0e0%22/%3E%3C/svg%3E";

// Escape a string for safe interpolation into HTML (text or attribute context).
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Return the poster URL for a movie, falling back to the placeholder image.
function getPosterSrc(movie) {
  return movie && movie.poster ? movie.poster : NO_POSTER_SRC;
}

// Build the inner HTML string for a single movie card.
// Reused by both the "favorite" card and the scroll-list cards in renderTimeline.
function buildMovieCardHtml(movie) {
  var posterSrc = getPosterSrc(movie);
  var title = movie ? movie.title : "";
  var date = movie ? movie.date : "";
  return (
    '<div class="poster-wrapper">' +
    '<img src="' +
    escapeHtml(posterSrc) +
    '" alt="' +
    escapeHtml(title) +
    '" loading="lazy">' +
    "</div>" +
    '<div class="movie-info">' +
    '<h4 class="movie-title">' +
    escapeHtml(title) +
    "</h4>" +
    '<p class="movie-date">' +
    escapeHtml(date) +
    "</p>" +
    "</div>"
  );
}

// ISO 3166-1 alpha-2 code -> flag emoji built from regional-indicator symbols
// ("US" -> 🇺🇸). Anything that is not exactly two letters yields "".
var REGIONAL_INDICATOR_A = 0x1f1e6;

function flagEmoji(code) {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return "";
  return code
    .toUpperCase()
    .split("")
    .map(function (ch) {
      return String.fromCodePoint(REGIONAL_INDICATOR_A + ch.charCodeAt(0) - 65);
    })
    .join("");
}

// Travel: "🇺🇸 USA" / "🇺🇸 美国" from place.country_code (names: "country.<code>").
function getCountryLabel(place, lang) {
  var code = place && place.country_code;
  if (!flagEmoji(code)) return "";
  return flagEmoji(code) + " " + _libI18n.t("country." + code.toUpperCase(), lang);
}

// Travel: compose the display name, appending the US state when applicable.
// en keeps the postal code ("Seattle, WA"); zh uses the full state name
// ("西雅图，华盛顿州") but drops it when it only repeats the place name
// ("纽约" rather than "纽约，纽约州"). Never a trailing comma.
function getDisplayName(place, lang) {
  var safePlace = place || {};
  var name = _libI18n.pick(safePlace.name, lang);
  if (!safePlace.state || safePlace.country_code !== "US") return name;
  var state = _libI18n.t("state." + safePlace.state, lang);
  if (lang === "zh") {
    return state.indexOf(name) === 0 ? name : name + "，" + state;
  }
  return name + ", " + state;
}

// Travel: visit dates as a localized range; planned places show a label.
function formatPlaceDates(place, lang) {
  var safePlace = place || {};
  if (safePlace.status === "planned" || !safePlace.date) {
    return _libI18n.t("travel.date.planned", lang);
  }
  return _libI18n.formatDayRange(safePlace.date, safePlace.date_end, lang);
}

// Travel lightbox: a photo may be a plain URL string or an object
// { src, location } where location is LocalizedText (or a plain string).
function getLightboxSrc(photo) {
  return typeof photo === "object" && photo !== null ? photo.src : photo;
}

function getLightboxCaption(photo, lang) {
  return typeof photo === "object" && photo !== null && photo.location
    ? _libI18n.pick(photo.location, lang)
    : "";
}

// Locale-aware name comparison: zh sorts by pinyin, en alphabetically.
function nameComparer(lang) {
  var collator = new Intl.Collator(lang === "zh" ? "zh-Hans-CN" : "en");
  return function (a, b) {
    return collator.compare(_libI18n.pick(a.name, lang), _libI18n.pick(b.name, lang));
  };
}

// Travel: comparator factory for the "Visited" list. Dates are ISO strings, so
// they compare lexically; an undated entry (null) sorts first for "newest".
function compareVisited(sortType, lang) {
  var byName = nameComparer(lang);
  return function (a, b) {
    if (sortType === "newest" || sortType === "oldest") {
      if (!a.date && !b.date) return 0;
      if (!a.date) return sortType === "newest" ? -1 : 1;
      if (!b.date) return sortType === "newest" ? 1 : -1;
      if (a.date === b.date) return 0;
      var asc = a.date < b.date ? -1 : 1;
      return sortType === "newest" ? -asc : asc;
    }
    if (sortType === "az") return byName(a, b);
    if (sortType === "za") return byName(b, a);
    return 0;
  };
}

// Travel: comparator factory for the "TODO"/planned list (name only).
function comparePlanned(sortType, lang) {
  var byName = nameComparer(lang);
  return function (a, b) {
    return sortType === "za" ? byName(b, a) : byName(a, b);
  };
}

// Circular index helpers for gallery navigation.
function nextIndex(i, len) {
  return (i + 1) % len;
}

function prevIndex(i, len) {
  return (i - 1 + len) % len;
}

// ==========================================
// Trip itinerary helpers (trip.html?place=<id>)
// 行程页纯函数
// ==========================================

// Read the ?place= id from a location.search string. The search string is passed
// in rather than read from `location` so this stays pure and testable.
function getPlaceIdFromSearch(search) {
  if (typeof search !== "string" || search === "") return null;
  var params = new URLSearchParams(search);
  var placeId = params.get("place");
  return placeId ? placeId : null;
}

// Index of the photo whose lightbox src matches `src`, or -1 when absent.
// Reuses getLightboxSrc so both photo shapes (string / {src, location}) match.
function findPhotoIndex(photos, src) {
  if (!Array.isArray(photos) || !src) return -1;
  for (var i = 0; i < photos.length; i++) {
    if (getLightboxSrc(photos[i]) === src) return i;
  }
  return -1;
}

// Group photos that share the same coordinates, preserving first-seen order.
// Each item keeps its originalIndex so the lightbox can jump to the right photo.
// Photos without coordinates are skipped — they cannot be placed on a map.
function groupPhotosByLocation(photos) {
  if (!Array.isArray(photos)) return [];

  var order = [];
  var byKey = {};

  photos.forEach(function (photo, index) {
    if (typeof photo !== "object" || photo === null || !photo.coordinates) return;

    var key = photo.coordinates.join(",");
    if (!Object.prototype.hasOwnProperty.call(byKey, key)) {
      byKey[key] = {
        locationName: photo.location || "",
        coordinates: photo.coordinates,
        items: [],
      };
      order.push(key);
    }
    byKey[key].items.push(Object.assign({}, photo, { originalIndex: index }));
  });

  return order.map(function (key) {
    return byKey[key];
  });
}

// Stop categories rendered on a trip day. Labels live in the dictionary
// ("trip.stop_type.<type>") so they follow the page language.
// 站点类型标签来自词典，随页面语言切换。
var STOP_TYPES = {
  sight: { icon: "📍" },
  food: { icon: "🍜" },
  hotel: { icon: "🛏" },
  transport: { icon: "🚃" },
};
var DEFAULT_STOP_ICON = "•";

// Always returns a usable {label, icon}; an unknown or missing type falls back
// to a neutral one so the rendered HTML never contains "undefined".
// hasOwnProperty guards against inherited keys like "constructor".
function getStopType(type, lang) {
  var known =
    typeof type === "string" && Object.prototype.hasOwnProperty.call(STOP_TYPES, type);
  return {
    label: _libI18n.t("trip.stop_type." + (known ? type : "default"), lang),
    icon: known ? STOP_TYPES[type].icon : DEFAULT_STOP_ICON,
  };
}

// Defensive read of trip.days — a malformed or missing trip renders as empty.
function getTripDays(trip) {
  if (!trip || !Array.isArray(trip.days)) return [];
  return trip.days;
}

// Build the <li> for a single stop.
// photoIndex < 0 means "this stop has no photo in the gallery" -> no thumbnail.
// Escape all interpolated, data-derived values to avoid HTML/attribute
// injection. photoIndex is coerced to an integer (not string-escaped).
// The index is exposed as a data attribute; the page opens the lightbox through
// event delegation, so no inline handler is emitted here.
// The thumbnail is wrapped in a <button> so it is reachable by Tab and can be
// activated with Enter/Space; the button also carries the index, which makes it
// the delegation trigger and therefore a focusable target to restore focus to
// when the lightbox closes. Its accessible name comes from aria-label, so the
// <img> is labelled empty to avoid announcing the stop name twice.
function buildStopHtml(stop, photoIndex, lang) {
  var safeStop = stop || {};
  var typeInfo = getStopType(safeStop.type, lang);
  var name = _libI18n.pick(safeStop.name, lang);
  var note = _libI18n.pick(safeStop.note, lang);
  var typeKey = safeStop.type ? String(safeStop.type) : "default";
  var idx = Number(photoIndex);
  var hasPhoto = safeStop.photo && isFinite(idx) && idx >= 0;

  var html =
    '<li class="stop stop-' +
    escapeHtml(typeKey) +
    '">' +
    '<span class="stop-type">' +
    '<span class="stop-icon" aria-hidden="true">' +
    escapeHtml(typeInfo.icon) +
    "</span>" +
    '<span class="stop-label">' +
    escapeHtml(typeInfo.label) +
    "</span>" +
    "</span>" +
    '<div class="stop-body">' +
    '<h4 class="stop-name">' +
    escapeHtml(name) +
    "</h4>";

  if (note) {
    html += '<p class="stop-note">' + escapeHtml(note) + "</p>";
  }
  html += "</div>";

  if (hasPhoto) {
    html +=
      '<button class="stop-photo-btn" type="button" data-photo-index="' +
      idx +
      '" aria-label="' +
      escapeHtml(_libI18n.t("travel.photo_of", lang, { name: name })) +
      '">' +
      '<img class="stop-photo" src="' +
      escapeHtml(getLightboxSrc(safeStop.photo)) +
      '" alt="" loading="lazy">' +
      "</button>";
  }

  return html + "</li>";
}

// Build one <section> for a trip day; `photos` is the place gallery, used to
// resolve each stop's photo back to its gallery index for the lightbox.
function buildDayHtml(day, photos, lang) {
  var safeDay = day || {};
  var stops = Array.isArray(safeDay.stops) ? safeDay.stops : [];

  var stopsHtml = stops
    .map(function (stop) {
      var photoIndex = stop ? findPhotoIndex(photos, stop.photo) : -1;
      return buildStopHtml(stop, photoIndex, lang);
    })
    .join("");

  return (
    '<section class="trip-day">' +
    '<div class="day-stub">' +
    '<span class="day-badge">' +
    escapeHtml(_libI18n.t("trip.day", lang, { n: safeDay.day == null ? "" : safeDay.day })) +
    "</span>" +
    '<span class="day-date">' +
    escapeHtml(_libI18n.formatDayRange(safeDay.date, null, lang)) +
    "</span>" +
    "</div>" +
    '<h3 class="day-title">' +
    escapeHtml(_libI18n.pick(safeDay.title, lang)) +
    "</h3>" +
    '<ol class="stop-list">' +
    stopsHtml +
    "</ol>" +
    "</section>"
  );
}

// Dual-environment export guard: Node gets module.exports, browser keeps globals.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    NO_POSTER_SRC: NO_POSTER_SRC,
    escapeHtml: escapeHtml,
    getPosterSrc: getPosterSrc,
    buildMovieCardHtml: buildMovieCardHtml,
    flagEmoji: flagEmoji,
    getCountryLabel: getCountryLabel,
    getDisplayName: getDisplayName,
    formatPlaceDates: formatPlaceDates,
    getLightboxSrc: getLightboxSrc,
    getLightboxCaption: getLightboxCaption,
    compareVisited: compareVisited,
    comparePlanned: comparePlanned,
    nextIndex: nextIndex,
    prevIndex: prevIndex,
    getPlaceIdFromSearch: getPlaceIdFromSearch,
    findPhotoIndex: findPhotoIndex,
    groupPhotosByLocation: groupPhotosByLocation,
    STOP_TYPES: STOP_TYPES,
    getStopType: getStopType,
    getTripDays: getTripDays,
    buildStopHtml: buildStopHtml,
    buildDayHtml: buildDayHtml,
  };
}
