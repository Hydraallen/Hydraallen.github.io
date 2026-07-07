// ==========================================
// js/nav.js
// Single source of truth for the primary navigation sidebar.
//
// Dual-environment:
//   - Browser: registers a DOMContentLoaded listener that SYNCHRONOUSLY injects
//     the <nav id="primary-nav"> into the `#nav-placeholder` element on each
//     page. This file MUST be loaded AFTER js/lib.js and BEFORE js/scripts.js so
//     that its DOMContentLoaded listener runs first and the nav already exists
//     in the DOM when scripts.js's setupHamburgerMenu() queries for it.
//   - Node (tests): the module.exports guard at the bottom exports the pure
//     buildNavHtml()/getCurrentPage() helpers; no DOM side effects on require.
// ==========================================

"use strict";

// Icon base (icons8 outlined black icons, matching the previous inline nav).
var ICON = {
  about: "https://img.icons8.com/ios-filled/50/000000/user.png",
  experience: "https://img.icons8.com/ios-filled/50/000000/briefcase.png",
  projects: "https://img.icons8.com/ios-filled/50/000000/task.png",
  skills: "https://img.icons8.com/ios-filled/50/000000/combo-chart.png",
  education: "https://img.icons8.com/ios-filled/50/000000/graduation-cap.png",
  movies: "https://img.icons8.com/ios-filled/50/000000/film-reel.png",
  travel: "https://img.icons8.com/ios-filled/50/000000/camera.png",
  contact: "https://img.icons8.com/ios-filled/50/000000/new-post.png",
};

// Normalize a location.pathname into one of the known page keys.
function getCurrentPage(pathname) {
  var path = pathname || "";
  if (/movies\.html$/.test(path)) return "movies.html";
  if (/travel\.html$/.test(path)) return "travel.html";
  if (/404\.html$/.test(path)) return "404";
  return "index.html";
}

// Build a single <li> nav entry. Icons are decorative (alt=""/aria-hidden).
function navLink(href, iconSrc, label, isCurrent) {
  var attrs = isCurrent
    ? ' class="active-nav-item" aria-current="page"'
    : "";
  return (
    "      <li>\n" +
    '        <a href="' +
    href +
    '"' +
    attrs +
    ">\n" +
    '          <img src="' +
    iconSrc +
    '" alt="" aria-hidden="true">\n' +
    "          " +
    label +
    "\n" +
    "        </a>\n" +
    "      </li>"
  );
}

// Pure function: returns the full <nav> markup string for the given page.
// Anchor links use the absolute `index.html#section` form so they work from
// every page (index and sub-pages). The current page's own link carries
// aria-current="page" and points at itself (never the href="#" anti-pattern).
function buildNavHtml(currentPage) {
  var page = currentPage || "index.html";
  var moviesCurrent = page === "movies.html";
  var travelCurrent = page === "travel.html";

  var items = [
    navLink("index.html#about", ICON.about, "About", false),
    navLink("index.html#experience", ICON.experience, "Experience", false),
    navLink("index.html#projects", ICON.projects, "Projects", false),
    navLink("index.html#skills", ICON.skills, "Skills", false),
    navLink("index.html#education", ICON.education, "Education", false),
    navLink("movies.html", ICON.movies, "Movies", moviesCurrent),
    navLink("travel.html", ICON.travel, "Travel", travelCurrent),
    navLink("index.html#contact", ICON.contact, "Contact", false),
  ];

  return (
    '<nav id="primary-nav" class="hidden-nav">\n' +
    '    <div class="profile-picture">\n' +
    '      <img src="./img/avatar.jpg" alt="Hydraallen profile picture">\n' +
    "    </div>\n" +
    '    <ul class="navigation">\n' +
    items.join("\n") +
    "\n" +
    "    </ul>\n" +
    "  </nav>"
  );
}

// Synchronously replace the placeholder element with the built nav markup.
function injectNav(doc, pathname) {
  var placeholder = doc.getElementById("nav-placeholder");
  if (!placeholder) return null;
  placeholder.outerHTML = buildNavHtml(getCurrentPage(pathname));
  return doc.getElementById("primary-nav");
}

// --- Browser bootstrap (guarded so Node `require` never touches the DOM) ---
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var pathname =
      typeof window !== "undefined" && window.location
        ? window.location.pathname
        : "";
    injectNav(document, pathname);
  });
}

// --- Node export guard ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getCurrentPage: getCurrentPage,
    buildNavHtml: buildNavHtml,
    injectNav: injectNav,
  };
}
