// ==========================================
// js/lib.js
// Pure helper functions shared by scripts.js (movies) and scripts_travel.js.
// IMPORTANT: This module MUST NOT touch the DOM at the top level.
// It works in two environments:
//   - Browser: plain function declarations expose helpers on the global scope
//     (HTML must load this file BEFORE scripts.js / scripts_travel.js).
//   - Node (tests): the module.exports guard at the bottom exports everything.
// ==========================================

// Placeholder poster used when a movie has no poster image.
// Inline SVG data URI keeps this self-contained (no external host).
// 内联 SVG data URI，避免依赖外部图床。
var NO_POSTER_SRC =
  "data:image/svg+xml;utf8," +
  "%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22%3E" +
  "%3Crect width=%22200%22 height=%22300%22 fill=%22%23e0e0e0%22/%3E" +
  "%3Ctext x=%22100%22 y=%22150%22 font-family=%22sans-serif%22 font-size=%2218%22" +
  " fill=%22%23666666%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3E" +
  "No Poster%3C/text%3E%3C/svg%3E";

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

// Country names in data/travel/*.json carry a leading flag emoji ("🇺🇸 USA").
// Normalise to bare lowercase letters before comparing, so the check is an exact
// match on the country rather than a substring test that "Usaland" would pass.
function normalizeCountry(country) {
  if (typeof country !== "string") return "";
  return country.replace(/[^A-Za-z ]/g, "").trim().toLowerCase();
}

var US_COUNTRY_NAMES = ["usa", "united states", "united states of america"];

// Travel: compose the display name, appending the US state when applicable.
// A place without a `state` field keeps its bare name — never a trailing comma.
function getDisplayName(place) {
  var displayName = place.name;
  if (place.state && US_COUNTRY_NAMES.indexOf(normalizeCountry(place.country)) !== -1) {
    displayName += ", " + place.state;
  }
  return displayName;
}

// Travel lightbox: a photo may be a plain URL string or an object { src, location }.
function getLightboxSrc(photo) {
  return typeof photo === "object" && photo !== null ? photo.src : photo;
}

function getLightboxCaption(photo) {
  return typeof photo === "object" && photo !== null && photo.location
    ? photo.location
    : "";
}

// Travel: comparator factory for the "Visited" list.
function compareVisited(sortType) {
  return function (a, b) {
    var dateA = a.date;
    var dateB = b.date;
    var nameA = a.name;
    var nameB = b.name;

    if (sortType === "newest" || sortType === "oldest") {
      if (dateA === "TBD") return sortType === "newest" ? -1 : 1;
      if (dateB === "TBD") return sortType === "newest" ? 1 : -1;
      if (sortType === "newest") return new Date(dateB) - new Date(dateA);
      if (sortType === "oldest") return new Date(dateA) - new Date(dateB);
    }

    if (sortType === "az") return nameA.localeCompare(nameB);
    if (sortType === "za") return nameB.localeCompare(nameA);

    return 0;
  };
}

// Travel: comparator factory for the "TODO"/planned list.
function comparePlanned(sortType) {
  return function (a, b) {
    var nameA = a.name;
    var nameB = b.name;
    if (sortType === "za") {
      return nameB.localeCompare(nameA);
    }
    return nameA.localeCompare(nameB);
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

// Stop categories rendered on a trip day. Labels are English (site UI is English).
var STOP_TYPES = {
  sight: { label: "Sight", icon: "📍" },
  food: { label: "Food", icon: "🍜" },
  hotel: { label: "Stay", icon: "🛏" },
  transport: { label: "Transit", icon: "🚃" },
};

// Always returns a usable descriptor; an unknown or missing type falls back to a
// neutral one so the rendered HTML never contains "undefined".
// hasOwnProperty guards against inherited keys like "constructor".
function getStopType(type) {
  if (
    typeof type === "string" &&
    Object.prototype.hasOwnProperty.call(STOP_TYPES, type)
  ) {
    return STOP_TYPES[type];
  }
  return { label: "Stop", icon: "•" };
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
function buildStopHtml(stop, photoIndex) {
  var safeStop = stop || {};
  var typeInfo = getStopType(safeStop.type);
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
    escapeHtml(safeStop.name) +
    "</h4>";

  if (safeStop.note) {
    html += '<p class="stop-note">' + escapeHtml(safeStop.note) + "</p>";
  }
  html += "</div>";

  if (hasPhoto) {
    html +=
      '<button class="stop-photo-btn" type="button" data-photo-index="' +
      idx +
      '" aria-label="Photo of ' +
      escapeHtml(safeStop.name) +
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
function buildDayHtml(day, photos) {
  var safeDay = day || {};
  var stops = Array.isArray(safeDay.stops) ? safeDay.stops : [];

  var stopsHtml = stops
    .map(function (stop) {
      var photoIndex = stop ? findPhotoIndex(photos, stop.photo) : -1;
      return buildStopHtml(stop, photoIndex);
    })
    .join("");

  return (
    '<section class="trip-day">' +
    '<div class="day-stub">' +
    '<span class="day-badge">Day ' +
    escapeHtml(safeDay.day) +
    "</span>" +
    '<span class="day-date">' +
    escapeHtml(safeDay.date) +
    "</span>" +
    "</div>" +
    '<h3 class="day-title">' +
    escapeHtml(safeDay.title) +
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
    normalizeCountry: normalizeCountry,
    getDisplayName: getDisplayName,
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
