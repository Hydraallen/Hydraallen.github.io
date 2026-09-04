// ==========================================
// Script for the Trip detail page (trip.html?place=<place_id>)
// Renders one destination: hero, day-by-day itinerary, route map, photo wall.
//
// Structure note: every unit of behaviour is a module-scope named function that
// receives its document / fetch dependencies as arguments, so each one can be
// required and exercised from Node without a browser. The DOMContentLoaded
// bootstrap at the bottom is deliberately thin.
// ==========================================

// --- Shared pure helpers (js/lib.js) ---
// Browser: lib.js is loaded BEFORE this file, exposing helpers as globals.
// Node (tests): require the module. This accessor bridges both environments
// without breaking the browser direct-include.
var lib =
  typeof module !== "undefined" && module.exports
    ? require("./lib.js")
    : {
        escapeHtml: escapeHtml,
        getDisplayName: getDisplayName,
        getLightboxSrc: getLightboxSrc,
        getLightboxCaption: getLightboxCaption,
        nextIndex: nextIndex,
        prevIndex: prevIndex,
        getPlaceIdFromSearch: getPlaceIdFromSearch,
        findPhotoIndex: findPhotoIndex,
        groupPhotosByLocation: groupPhotosByLocation,
        getTripDays: getTripDays,
        buildDayHtml: buildDayHtml,
      };

// Day route colours, cycled per day so consecutive days stay distinguishable.
var DAY_COLORS = ["#00695c", "#ef6c00", "#5e35b1", "#c2185b", "#0277bd", "#558b2f"];

// Lightbox open/close is two-phase to match the CSS transitions in
// css/styles_travel.css: the element is unhidden first, then `.active` drives
// the fade in; on close the fade runs before the element is hidden again.
var LIGHTBOX_ENTER_DELAY = 10;
var LIGHTBOX_EXIT_DELAY = 300;

// ==========================================
// 1. 数据加载
// ==========================================

// Load the place file and, when it references one, its trip file.
// The `../` prefix matches the convention used across this site; browsers clamp
// it at the site root, so it resolves to /data/....
// A missing/broken trip file is NOT fatal: the page degrades to a plain photo
// detail view. Only the place file failing is treated as an error.
async function loadTrip(placeId, fetchFn) {
  var placeRes = await fetchFn("../data/travel/" + encodeURIComponent(placeId) + ".json");
  if (!placeRes.ok) throw new Error("Could not load place " + placeId);
  var place = await placeRes.json();

  var trip = null;
  if (place && place.trip) {
    try {
      var tripRes = await fetchFn("../data/trips/" + encodeURIComponent(place.trip) + ".json");
      if (tripRes.ok) {
        trip = await tripRes.json();
      } else {
        console.warn("Warning: Could not load trip " + place.trip + ".json");
      }
    } catch (err) {
      console.warn("Warning: Could not load trip " + place.trip + ".json", err);
    }
  }

  return { place: place, trip: trip };
}

// ==========================================
// 2. 错误路径
// ==========================================

// Hide the page body and show a friendly message with a way back.
// `message` is data-derived (it can quote the ?place= id, which is untrusted
// URL input), so it is escaped before being written as HTML.
function showTripError(doc, message) {
  var page = doc.getElementById("trip-page");
  if (page) page.classList.add("hidden-btn");

  var errorEl = doc.getElementById("trip-error");
  if (!errorEl) return null;

  errorEl.innerHTML =
    lib.escapeHtml(message) +
    ' <a href="travel.html">Back to all destinations</a>';
  errorEl.classList.remove("hidden-btn");
  return errorEl;
}

// ==========================================
// 3. Hero
// ==========================================

// Dates prefer the trip's own label and fall back to the place's.
function getTripDateDisplay(place, trip) {
  if (trip && trip.date_display) return trip.date_display;
  return place && place.date_display ? place.date_display : "";
}

function renderHero(doc, place, trip) {
  var displayName = lib.getDisplayName(place);

  var cover = doc.querySelector(".trip-hero-cover");
  if (cover) {
    cover.src = place.cover || "";
    cover.alt = displayName;
  }

  var countryEl = doc.querySelector(".trip-country");
  if (countryEl) countryEl.textContent = place.country || "";

  var placeEl = doc.querySelector(".trip-place");
  if (placeEl) placeEl.textContent = displayName;

  var datesEl = doc.querySelector(".trip-dates");
  if (datesEl) datesEl.textContent = getTripDateDisplay(place, trip);

  var summaryEl = doc.querySelector(".trip-summary");
  if (summaryEl) {
    var summary = trip && trip.summary ? trip.summary : "";
    summaryEl.textContent = summary;
    summaryEl.classList.toggle("hidden-btn", summary === "");
  }

  var videoBtn = doc.querySelector(".trip-video-btn");
  if (videoBtn) {
    var video = place.video && place.video.trim() !== "" ? place.video : "";
    if (video) {
      videoBtn.href = video;
      videoBtn.classList.remove("hidden-btn");
    } else {
      videoBtn.href = "#";
      videoBtn.classList.add("hidden-btn");
    }
  }
}

// ==========================================
// 4. 逐日行程
// ==========================================

// Renders nothing (and hides the container) when there is no itinerary, rather
// than showing placeholder copy.
function renderItinerary(doc, trip, photos) {
  var container = doc.getElementById("trip-itinerary");
  if (!container) return null;

  var days = lib.getTripDays(trip);
  if (days.length === 0) {
    container.innerHTML = "";
    container.classList.add("hidden-btn");
    return container;
  }

  container.innerHTML = days
    .map(function (day) {
      return lib.buildDayHtml(day, photos);
    })
    .join("");
  container.classList.remove("hidden-btn");
  return container;
}

// ==========================================
// 5. 照片墙
// ==========================================

// A <button> (not a div) so keyboard activation and focus come for free.
// The index is emitted as a data attribute and read back through event
// delegation; it is coerced to a number rather than string-escaped.
function buildPhotoWallHtml(photos) {
  if (!Array.isArray(photos)) return "";
  return photos
    .map(function (photo, index) {
      var src = lib.escapeHtml(lib.getLightboxSrc(photo));
      var caption = lib.getLightboxCaption(photo) || "Travel photo";
      return (
        '<button class="wall-item" type="button" data-photo-index="' +
        Number(index) +
        '">' +
        '<img src="' +
        src +
        '" alt="' +
        lib.escapeHtml(caption) +
        '" loading="lazy">' +
        "</button>"
      );
    })
    .join("");
}

function renderPhotoWall(doc, photos) {
  var wall = doc.getElementById("trip-photo-wall");
  var heading = doc.querySelector(".trip-section-heading");
  var hasPhotos = Array.isArray(photos) && photos.length > 0;

  if (heading) heading.classList.toggle("hidden-btn", !hasPhotos);
  if (!wall) return null;

  wall.innerHTML = hasPhotos ? buildPhotoWallHtml(photos) : "";
  wall.classList.toggle("hidden-btn", !hasPhotos);
  return wall;
}

// ==========================================
// 6. 地图
// ==========================================

// Resolve each day's stops to coordinates by looking their photo up in the
// place gallery (stops carry no coordinates of their own). Days with fewer than
// two resolvable points cannot form a line and are dropped.
function getDayRoutes(trip, photos) {
  return lib
    .getTripDays(trip)
    .map(function (day) {
      var stops = day && Array.isArray(day.stops) ? day.stops : [];
      var points = [];
      stops.forEach(function (stop) {
        var index = stop ? lib.findPhotoIndex(photos, stop.photo) : -1;
        if (index < 0) return;
        var photo = photos[index];
        if (photo && photo.coordinates) points.push(photo.coordinates);
      });
      return { day: day && day.day, points: points };
    })
    .filter(function (route) {
      return route.points.length >= 2;
    });
}

// Popup gallery for one coordinate group. No inline handlers: the thumbnails
// carry data-photo-index and the map container handles the click by delegation.
// Each thumbnail is a <button> so it is reachable by Tab inside the popup and
// responds to Enter/Space; the accessible name lives on the button, so the
// <img> is labelled empty to keep the location from being announced twice.
function buildPopupHtml(group) {
  var thumbs = group.items
    .map(function (item) {
      var location = lib.escapeHtml(item.location || "");
      return (
        '<button class="popup-photo-thumb" type="button" data-photo-index="' +
        Number(item.originalIndex) +
        '" title="' +
        location +
        '" aria-label="Photo of ' +
        location +
        '">' +
        '<img src="' +
        lib.escapeHtml(lib.getLightboxSrc(item)) +
        '" alt="">' +
        "</button>"
      );
    })
    .join("");

  var count = group.items.length > 1 ? " (" + group.items.length + ")" : "";
  return (
    '<div class="popup-gallery">' +
    '<div class="popup-gallery-container">' +
    thumbs +
    "</div>" +
    '<div class="popup-location-name">' +
    lib.escapeHtml(group.locationName) +
    count +
    "</div>" +
    "</div>"
  );
}

// Build the trip map. Returns null when Leaflet is absent (Node tests) or the
// container is missing, so requiring this module never needs a browser.
function initTripMap(doc, place, trip) {
  if (typeof L === "undefined") return null;
  var container = doc.getElementById("trip-map");
  if (!container) return null;

  var map = L.map("trip-map");

  // The trip page has no language selector, so the English tiles are fixed.
  L.tileLayer("https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}", {
    attribution: "&copy; Google Maps",
    maxZoom: 20,
  }).addTo(map);

  var photos = Array.isArray(place.photos) ? place.photos : [];
  var bounds = L.latLngBounds();

  lib.groupPhotosByLocation(photos).forEach(function (group) {
    bounds.extend(group.coordinates);
    L.marker(group.coordinates)
      .addTo(map)
      .bindPopup(buildPopupHtml(group), { minWidth: 160, maxWidth: 300 });
  });

  // 每日路线：一天一条虚线，一天一个颜色，按天分组便于整体控制
  getDayRoutes(trip, photos).forEach(function (route, index) {
    route.points.forEach(function (point) {
      bounds.extend(point);
    });
    L.layerGroup([
      L.polyline(route.points, {
        color: DAY_COLORS[index % DAY_COLORS.length],
        weight: 3,
        opacity: 0.85,
        dashArray: "8 8",
      }),
    ]).addTo(map);
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  } else if (place.coordinates) {
    map.setView(place.coordinates, 12);
  } else {
    map.setView([20, 0], 2);
  }

  return map;
}

// ==========================================
// 7. Lightbox
// ==========================================

// Apply a photo to the lightbox DOM, keeping src, alt and caption in sync.
function applyLightboxPhoto(imgEl, captionEl, photo) {
  var src = lib.getLightboxSrc(photo);
  var caption = lib.getLightboxCaption(photo);
  if (imgEl) {
    imgEl.src = src;
    imgEl.alt = caption || "Travel photo";
  }
  if (captionEl) {
    captionEl.textContent = caption;
    captionEl.style.display = caption ? "block" : "none";
  }
}

// Wire the lightbox and return a controller. `photos` is the place gallery;
// every entry point (photo wall, itinerary thumbnails, map popups) opens it by
// gallery index.
function setupLightbox(doc, photos) {
  var lightbox = doc.getElementById("lightbox");
  if (!lightbox) return null;

  var imgEl = doc.getElementById("lightbox-img");
  var captionEl = doc.getElementById("lightbox-caption");
  var closeBtn = doc.getElementById("close-lightbox");
  var prevBtn = doc.getElementById("prev-btn");
  var nextBtn = doc.getElementById("next-btn");

  var gallery = Array.isArray(photos) ? photos : [];
  var currentIndex = 0;
  // Remembered so focus can be returned where the user left it on close.
  var lastTrigger = null;

  function update() {
    if (gallery.length === 0) return;
    applyLightboxPhoto(imgEl, captionEl, gallery[currentIndex]);
  }

  function isOpen() {
    return !lightbox.classList.contains("hidden-modal");
  }

  function open(index, trigger) {
    if (gallery.length === 0) return;
    var idx = Number(index);
    if (!isFinite(idx) || idx < 0 || idx >= gallery.length) return;

    lastTrigger = trigger || null;
    currentIndex = idx;
    update();
    lightbox.classList.remove("hidden-modal");
    setTimeout(function () {
      lightbox.classList.add("active");
      if (closeBtn) closeBtn.focus();
    }, LIGHTBOX_ENTER_DELAY);
  }

  function close() {
    lightbox.classList.remove("active");
    setTimeout(function () {
      lightbox.classList.add("hidden-modal");
    }, LIGHTBOX_EXIT_DELAY);
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function showNext() {
    if (gallery.length === 0) return;
    currentIndex = lib.nextIndex(currentIndex, gallery.length);
    update();
  }

  function showPrev() {
    if (gallery.length === 0) return;
    currentIndex = lib.prevIndex(currentIndex, gallery.length);
    update();
  }

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (prevBtn)
    prevBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      showPrev();
    });
  if (nextBtn)
    nextBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      showNext();
    });

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) close();
  });

  doc.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
    if (e.key === "Escape") close();
  });

  return {
    open: open,
    close: close,
    showNext: showNext,
    showPrev: showPrev,
    isOpen: isOpen,
    getIndex: function () {
      return currentIndex;
    },
  };
}

// One delegated listener per container: any descendant carrying a
// data-photo-index opens the lightbox at that gallery index.
function delegatePhotoClicks(root, controller) {
  if (!root || !controller) return;
  root.addEventListener("click", function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== "function") return;
    var trigger = target.closest("[data-photo-index]");
    if (!trigger || !root.contains(trigger)) return;
    controller.open(trigger.getAttribute("data-photo-index"), trigger);
  });
}

// ==========================================
// 8. 页面装配
// ==========================================

async function initTripPage(doc, fetchFn, search) {
  var fetcher = fetchFn || (typeof fetch !== "undefined" ? fetch : null);
  var searchString =
    typeof search === "string"
      ? search
      : typeof window !== "undefined" && window.location
        ? window.location.search
        : "";

  var placeId = lib.getPlaceIdFromSearch(searchString);
  if (!placeId) {
    return showTripError(doc, "No destination selected.");
  }
  if (!fetcher) {
    return showTripError(doc, "Could not load this destination.");
  }

  var data;
  try {
    data = await loadTrip(placeId, fetcher);
  } catch (err) {
    console.error("Error loading trip data:", err);
    return showTripError(doc, 'Could not find the destination "' + placeId + '".');
  }

  var place = data.place;
  if (!place || !place.id) {
    return showTripError(doc, 'Could not find the destination "' + placeId + '".');
  }

  var photos = Array.isArray(place.photos) ? place.photos : [];

  renderHero(doc, place, data.trip);
  renderItinerary(doc, data.trip, photos);
  renderPhotoWall(doc, photos);
  initTripMap(doc, place, data.trip);

  var controller = setupLightbox(doc, photos);
  delegatePhotoClicks(doc.getElementById("trip-photo-wall"), controller);
  delegatePhotoClicks(doc.getElementById("trip-itinerary"), controller);
  delegatePhotoClicks(doc.getElementById("trip-map"), controller);

  return controller;
}

// --- Browser bootstrap (guarded so Node `require` never touches the DOM) ---
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    initTripPage(document);
  });
}

// --- Node export guard (tests only; no-op in the browser) ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DAY_COLORS: DAY_COLORS,
    loadTrip: loadTrip,
    showTripError: showTripError,
    getTripDateDisplay: getTripDateDisplay,
    renderHero: renderHero,
    renderItinerary: renderItinerary,
    buildPhotoWallHtml: buildPhotoWallHtml,
    renderPhotoWall: renderPhotoWall,
    getDayRoutes: getDayRoutes,
    buildPopupHtml: buildPopupHtml,
    initTripMap: initTripMap,
    applyLightboxPhoto: applyLightboxPhoto,
    setupLightbox: setupLightbox,
    delegatePhotoClicks: delegatePhotoClicks,
    initTripPage: initTripPage,
  };
}
