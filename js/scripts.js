// ==========================================
// js/scripts.js
// Dual-environment:
//   - Browser: relies on js/lib.js being loaded FIRST (global helpers) and
//     registers DOMContentLoaded listeners at the bottom.
//   - Node (tests): requires ./lib.js and exports the testable DOM functions;
//     top-level DOM side effects are guarded by `typeof document`.
// ==========================================

// --- Resolve shared pure helpers (Node require vs browser globals) ---
var _lib =
  typeof module !== "undefined" && module.exports
    ? require("./lib.js")
    : {
        escapeHtml: escapeHtml,
        getPosterSrc: getPosterSrc,
        buildMovieCardHtml: buildMovieCardHtml,
      };
var escapeHtmlFn = _lib.escapeHtml;

// --- i18n (js/i18n.js is loaded in <head>, so its globals exist in the browser) ---
var _i18n =
  typeof module !== "undefined" && module.exports
    ? require("./i18n.js")
    : {
        t: t,
        getLang: getLang,
        normalizeLang: normalizeLang,
        parseMovieDate: parseMovieDate,
        formatDay: formatDay,
      };
var getPosterSrcFn = _lib.getPosterSrc;
var buildMovieCardHtmlFn = _lib.buildMovieCardHtml;

// ---------------------------------------------------------------------------
// Footer year
// ---------------------------------------------------------------------------
function setFooterYear(doc) {
  const yearSpan = doc.getElementById("year");
  if (yearSpan) {
    // textContent (not innerHTML): a year is plain text, never markup.
    yearSpan.textContent = String(new Date().getFullYear());
  }
}

// ---------------------------------------------------------------------------
// Hamburger menu (returns controls so it is unit-testable via jsdom)
// ---------------------------------------------------------------------------
function setupHamburgerMenu(doc) {
  const hamburgerMenu = doc.querySelector(".hamburger-menu");
  const nav = doc.querySelector("nav");
  if (!hamburgerMenu || !nav) return null;

  nav.classList.add("hidden-nav");
  hamburgerMenu.classList.remove("toggle");

  const focusableNavElements = nav.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
  );
  const firstFocusableElement = focusableNavElements[0];
  const lastFocusableElement =
    focusableNavElements[focusableNavElements.length - 1];

  function openMenu() {
    nav.classList.remove("hidden-nav");
    hamburgerMenu.classList.add("toggle");
    hamburgerMenu.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      // Guard: nav may contain no focusable elements -> element is undefined.
      if (firstFocusableElement) firstFocusableElement.focus();
    }, 100);
    doc.addEventListener("keydown", trapTabKey);
  }

  function closeMenu() {
    nav.classList.add("hidden-nav");
    hamburgerMenu.classList.remove("toggle");
    hamburgerMenu.setAttribute("aria-expanded", "false");
    doc.removeEventListener("keydown", trapTabKey);
    hamburgerMenu.focus();
  }

  function trapTabKey(e) {
    const isTabPressed = e.key === "Tab" || e.keyCode === 9;
    const isEscPressed = e.key === "Escape" || e.keyCode === 27;
    if (isEscPressed) {
      closeMenu();
      return;
    }
    if (!isTabPressed) return;
    if (!firstFocusableElement || !lastFocusableElement) return;

    if (e.shiftKey) {
      if (doc.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement.focus();
      }
    } else {
      if (doc.activeElement === lastFocusableElement) {
        e.preventDefault();
        firstFocusableElement.focus();
      }
    }
  }

  hamburgerMenu.addEventListener("click", () => {
    const isClosed = nav.classList.contains("hidden-nav");
    if (isClosed) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });

  return { openMenu, closeMenu };
}

// ---------------------------------------------------------------------------
// Contact form status helpers (XSS-safe: always textContent, never innerHTML)
// ---------------------------------------------------------------------------
function showFormStatus(statusEl, message, type) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = "form-status " + type;
}

// Renders backend-provided error data. The backend response is UNTRUSTED, so
// messages are written with textContent to prevent HTML/script injection.
function showFormErrors(statusEl, errorData, lang = "en") {
  if (!statusEl) return;
  let message = _i18n.t("index.contact.error", lang);
  if (
    errorData &&
    Object.hasOwn(errorData, "errors") &&
    Array.isArray(errorData.errors)
  ) {
    message = errorData.errors.map((error) => error.message).join(", ");
  }
  statusEl.textContent = message;
  statusEl.className = "form-status error";
}

function setupContactForm(doc, fetchImpl, lang = "en") {
  const form = doc.getElementById("contact-form");
  const status = doc.getElementById("form-status");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(event.target);
    const submitBtn = form.querySelector(".submit-btn");
    const originalBtnText = submitBtn.textContent;

    submitBtn.textContent = _i18n.t("index.contact.sending", lang);
    submitBtn.disabled = true;

    try {
      const doFetch =
        fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
      const response = await doFetch(event.target.action, {
        method: form.method,
        body: data,
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        showFormStatus(status, _i18n.t("index.contact.success", lang), "success");
        form.reset();
      } else {
        const errorData = await response.json();
        showFormErrors(status, errorData, lang);
      }
    } catch (error) {
      // Log detail server-side/console; show a generic message to the user.
      console.error("Contact form submission failed:", error);
      showFormStatus(status, _i18n.t("index.contact.error", lang), "error");
    } finally {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Generic "Show More / Show Less" toggle (projects, education)
// Items are queried at CLICK time because index content is rendered
// asynchronously from JSON. Items revealed by a button are tagged with
// data-toggle-owner so the next click collapses exactly those again.
// 点击时再查询（内容由 JSON 异步渲染）；展开的条目打标记，收起时精确还原。
// ---------------------------------------------------------------------------
function setupToggle(doc, btnId, hiddenSelector, hiddenClass, lang = "en") {
  const toggleBtn = doc.getElementById(btnId);
  if (!toggleBtn) return;
  const ownerSelector = '[data-toggle-owner="' + btnId + '"]';

  toggleBtn.addEventListener("click", function () {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    if (expanded) {
      doc.querySelectorAll(ownerSelector).forEach((item) => {
        item.classList.add(hiddenClass);
        item.removeAttribute("data-toggle-owner");
      });
    } else {
      doc.querySelectorAll(hiddenSelector).forEach((item) => {
        item.classList.remove(hiddenClass);
        item.setAttribute("data-toggle-owner", btnId);
      });
    }
    toggleBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
    toggleBtn.textContent = expanded ? _i18n.t("common.show_more", lang) : _i18n.t("common.show_less", lang);
  });
}

// ---------------------------------------------------------------------------
// Skills section tabs (event delegation: tabs/cards may render after setup;
// scoped to .skills-tabs so the travel page's continent tabs are untouched)
// 技能标签页：事件委托，只作用于 .skills-tabs。
// ---------------------------------------------------------------------------
function selectSkillsTab(doc, btn) {
  const tablist = btn.closest(".skills-tabs");
  tablist.querySelectorAll(".tab-btn").forEach((b) => {
    const isActive = b === btn;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  const target = btn.getAttribute("data-target");

  doc.querySelectorAll(".skill-card").forEach((card) => {
    const cardCategory = card.getAttribute("data-category");
    if (target === "all" || cardCategory === target) {
      card.classList.remove("hidden-skill");
      card.classList.add("transparent-skill");
      void card.offsetWidth;
      card.classList.remove("transparent-skill");
    } else {
      card.classList.add("hidden-skill");
    }
  });
}

function setupSkillsTabs(doc) {
  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const btn = target.closest(".skills-tabs .tab-btn");
    if (btn) selectSkillsTab(doc, btn);
  });
}

// ---------------------------------------------------------------------------
// Movies page
// Movie titles are proper nouns and stay as-is; dates in the data look like
// "Jan 12, 2024" and are re-formatted per locale (zh: "2024.01.12").
// 片名不翻译；数据中的日期按语言重新格式化，无法解析时原样显示。
// ---------------------------------------------------------------------------
function formatMovieDate(raw, lang = "en") {
  const iso = _i18n.parseMovieDate(raw);
  return iso ? _i18n.formatDay(iso, lang) : raw || "";
}

// `title` is the English title; zh uses `title_zh` when present.
// `title` 为英文片名；中文界面优先显示 `title_zh`，缺失时回退英文。
function localizeMovieTitle(movie, lang = "en") {
  const zh = typeof movie.title_zh === "string" ? movie.title_zh.trim() : "";
  return _i18n.normalizeLang(lang) === "zh" && zh ? zh : movie.title;
}

// Immutable copy with localized title/date; lib's buildMovieCardHtml escapes
// both (the title also becomes the poster alt text).
// 返回新对象，不修改原数据；标题同时用作海报 alt。
function buildLocalizedMovieCardHtml(movie, lang = "en") {
  return buildMovieCardHtmlFn({
    ...movie,
    title: localizeMovieTitle(movie, lang),
    date: formatMovieDate(movie.date, lang),
  });
}

async function loadMovies(timelineRoot, lang = "en") {
  try {
    timelineRoot.innerHTML =
      '<p class="movies-status">' + escapeHtmlFn(_i18n.t("movies.loading", lang)) + "</p>";
    const indexResponse = await fetch("../data/movies/index.json");
    if (!indexResponse.ok) {
      throw new Error(`Failed to load index.json: ${indexResponse.status}`);
    }
    const fileList = await indexResponse.json();
    const dataPromises = fileList.map(async (fileName) => {
      const res = await fetch(`../data/movies/${fileName}.json`);
      if (!res.ok) {
        console.warn(`Warning: Could not load ${fileName}.json`);
        return null;
      }
      return res.json();
    });
    const rawData = await Promise.all(dataPromises);
    const moviesData = rawData
      .filter((item) => item !== null)
      .sort((a, b) => parseInt(b.year) - parseInt(a.year));
    timelineRoot.innerHTML = "";
    renderTimeline(moviesData, timelineRoot, lang);
  } catch (error) {
    // Detailed error to console only; user sees a generic, friendly message.
    console.error("Could not load movie data:", error);
    timelineRoot.innerHTML =
      '<div class="movies-status movies-error">' +
      "<p>" + escapeHtmlFn(_i18n.t("movies.error", lang)) + "</p>" +
      "<p>" + escapeHtmlFn(_i18n.t("movies.error_hint", lang)) + "</p>" +
      "</div>";
  }
}

function buildTimelineHeader(doc, yearData, count, hasMoreMovies, lang) {
  const headerDiv = doc.createElement("div");
  headerDiv.className = "timeline-header";
  const arrowHtml = hasMoreMovies ? '<span class="toggle-icon">▼</span>' : "";
  headerDiv.innerHTML =
    "<div>" +
    '<h3 class="timeline-year">' + escapeHtmlFn(yearData.year) + "</h3>" +
    '<p class="timeline-stats">' +
    escapeHtmlFn(_i18n.t("movies.watched", lang, { n: count })) +
    "</p>" +
    "</div>" +
    arrowHtml;
  return headerDiv;
}

function buildFavoriteSection(doc, yearData, favMovie, hasMoreMovies, lang) {
  const favSection = doc.createElement("div");
  // Border/spacing depend on whether a list follows (styles_movies.css).
  // 下方是否还有列表决定分隔线与间距。
  favSection.className = "favorite-section" + (hasMoreMovies ? "" : " favorite-section--solo");
  favSection.innerHTML =
    '<div class="favorite-label-large">' +
    escapeHtmlFn(_i18n.t("movies.best_of", lang, { year: yearData.year })) +
    "</div>" +
    '<div class="favorite-card">' +
    buildLocalizedMovieCardHtml(favMovie, lang) +
    "</div>";
  return favSection;
}

function buildMovieList(doc, yearData, otherMovies, lang) {
  const movieListContainer = doc.createElement("div");
  movieListContainer.className = "movie-list-container";
  if (otherMovies.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "movies-empty";
    empty.textContent = _i18n.t("movies.empty", lang);
    movieListContainer.appendChild(empty);
    return movieListContainer;
  }
  const scrollWrapper = doc.createElement("div");
  scrollWrapper.className = "vertical-scroll-wrapper";
  scrollWrapper.setAttribute("tabindex", "0");
  scrollWrapper.setAttribute("aria-label", _i18n.t("movies.list_label", lang, { year: yearData.year }));
  otherMovies.forEach((movie) => {
    const card = doc.createElement("div");
    card.className = "movie-card";
    card.innerHTML = buildLocalizedMovieCardHtml(movie, lang);
    scrollWrapper.appendChild(card);
  });
  movieListContainer.appendChild(scrollWrapper);
  return movieListContainer;
}

// Expand / collapse a year's list (click + Enter/Space).
function attachTimelineToggle(contentDiv) {
  contentDiv.addEventListener("click", function (e) {
    if (e.target.closest(".vertical-scroll-wrapper")) return;

    const parent = this.parentElement;
    const container = parent.querySelector(".movie-list-container");
    const isActive = parent.classList.contains("active");

    if (!isActive) {
      parent.classList.add("active");
      const height = container.scrollHeight;
      container.style.maxHeight = height + "px";
      setTimeout(() => {
        if (parent.classList.contains("active")) {
          container.style.maxHeight = "none";
        }
      }, 600);
    } else {
      container.style.maxHeight = container.scrollHeight + "px";
      void container.offsetHeight;
      parent.classList.remove("active");
      container.style.maxHeight = null;
    }
  });

  contentDiv.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.click();
    }
  });
}

function renderTimelineYear(doc, yearData, lang) {
  const itemDiv = doc.createElement("div");
  itemDiv.className = "timeline-item";
  const markerDiv = doc.createElement("div");
  markerDiv.className = "timeline-marker";
  const contentDiv = doc.createElement("div");
  contentDiv.className = "timeline-content";
  contentDiv.setAttribute("tabindex", "0");

  const movies = yearData.movies || [];
  const favMovie = movies.find((m) => m.title === yearData.favorite);
  const otherMovies = movies.filter((m) => m.title !== yearData.favorite);
  const hasMoreMovies = otherMovies.length > 0;

  if (hasMoreMovies) {
    contentDiv.setAttribute("role", "button");
    contentDiv.setAttribute("aria-label", _i18n.t("movies.expand", lang, { year: yearData.year }));
  } else {
    contentDiv.classList.add("timeline-content--static");
  }

  contentDiv.appendChild(buildTimelineHeader(doc, yearData, movies.length, hasMoreMovies, lang));
  if (favMovie) {
    contentDiv.appendChild(buildFavoriteSection(doc, yearData, favMovie, hasMoreMovies, lang));
  }
  if (hasMoreMovies || !favMovie) {
    contentDiv.appendChild(buildMovieList(doc, yearData, otherMovies, lang));
  }

  itemDiv.appendChild(markerDiv);
  itemDiv.appendChild(contentDiv);
  if (hasMoreMovies) attachTimelineToggle(contentDiv);
  return itemDiv;
}

function renderTimeline(data, rootElement, lang = "en") {
  const doc = rootElement.ownerDocument;
  data.forEach((yearData) => {
    rootElement.appendChild(renderTimelineYear(doc, yearData, lang));
  });
}

// ---------------------------------------------------------------------------
// Browser bootstrap (guarded so Node `require` never touches the DOM)
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => setFooterYear(document));
  document.addEventListener("DOMContentLoaded", () =>
    setupHamburgerMenu(document)
  );
  document.addEventListener("DOMContentLoaded", () =>
    setupToggle(
      document,
      "toggleProjectsBtn",
      ".project-panel.hidden_project",
      "hidden_project",
      _i18n.getLang()
    )
  );
  document.addEventListener("DOMContentLoaded", () => setupSkillsTabs(document));
  document.addEventListener("DOMContentLoaded", () =>
    setupContactForm(document, undefined, _i18n.getLang())
  );
  document.addEventListener("DOMContentLoaded", () =>
    setupToggle(document, "toggleEduBtn", ".hidden-edu", "hidden-edu", _i18n.getLang())
  );
  document.addEventListener("DOMContentLoaded", () => {
    const timelineRoot = document.getElementById("timeline-root");
    if (timelineRoot) loadMovies(timelineRoot, _i18n.getLang());
  });
}

// --- Node export guard ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    setFooterYear,
    setupHamburgerMenu,
    showFormStatus,
    showFormErrors,
    setupContactForm,
    setupToggle,
    setupSkillsTabs,
    renderTimeline,
    loadMovies,
  };
}
