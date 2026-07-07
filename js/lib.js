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
var NO_IMAGE_PLACEHOLDER = "https://via.placeholder.com/200x300?text=No+Image";

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
  return movie && movie.poster ? movie.poster : NO_IMAGE_PLACEHOLDER;
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

// Travel: compose the display name, appending the US state when applicable.
function getDisplayName(place) {
  var displayName = place.name;
  if (place.country && place.country.toLowerCase() === "usa" && place.state) {
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

// Dual-environment export guard: Node gets module.exports, browser keeps globals.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    NO_IMAGE_PLACEHOLDER: NO_IMAGE_PLACEHOLDER,
    escapeHtml: escapeHtml,
    getPosterSrc: getPosterSrc,
    buildMovieCardHtml: buildMovieCardHtml,
    getDisplayName: getDisplayName,
    getLightboxSrc: getLightboxSrc,
    getLightboxCaption: getLightboxCaption,
    compareVisited: compareVisited,
    comparePlanned: comparePlanned,
    nextIndex: nextIndex,
    prevIndex: prevIndex,
  };
}
