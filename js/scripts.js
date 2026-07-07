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
function showFormErrors(statusEl, errorData) {
  if (!statusEl) return;
  let message = "Oops! There was a problem submitting your form.";
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

function setupContactForm(doc, fetchImpl) {
  const form = doc.getElementById("contact-form");
  const status = doc.getElementById("form-status");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(event.target);
    const submitBtn = form.querySelector(".submit-btn");
    const originalBtnText = submitBtn.textContent;

    submitBtn.textContent = "Sending...";
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
        showFormStatus(
          status,
          "Thanks for your message! I'll get back to you soon.",
          "success"
        );
        form.reset();
      } else {
        const errorData = await response.json();
        showFormErrors(status, errorData);
      }
    } catch (error) {
      // Log detail server-side/console; show a generic message to the user.
      console.error("Contact form submission failed:", error);
      showFormStatus(
        status,
        "Oops! There was a problem submitting your form.",
        "error"
      );
    } finally {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Generic "Show More / Show Less" toggle (projects, education)
// ---------------------------------------------------------------------------
function setupToggle(doc, btnId, hiddenSelector, hiddenClass) {
  const toggleBtn = doc.getElementById(btnId);
  const hiddenItems = doc.querySelectorAll(hiddenSelector);
  if (!toggleBtn || hiddenItems.length === 0) return;

  toggleBtn.addEventListener("click", function () {
    const isHidden = hiddenItems[0].classList.contains(hiddenClass);
    hiddenItems.forEach((item) => {
      if (isHidden) {
        item.classList.remove(hiddenClass);
      } else {
        item.classList.add(hiddenClass);
      }
    });
    toggleBtn.textContent = isHidden ? "Show Less" : "Show More";
  });
}

// ---------------------------------------------------------------------------
// Skills section tabs
// ---------------------------------------------------------------------------
function setupSkillsTabs(doc) {
  const tabBtns = doc.querySelectorAll(".tab-btn");
  const skillCards = doc.querySelectorAll(".skill-card");
  if (tabBtns.length === 0) return;

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.getAttribute("data-target");

      skillCards.forEach((card) => {
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
    });
  });
}

// ---------------------------------------------------------------------------
// Movies page
// ---------------------------------------------------------------------------
async function loadMovies(timelineRoot) {
  try {
    timelineRoot.innerHTML =
      '<p style="text-align:center; padding:20px;">Loading movies...</p>';
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
    renderTimeline(moviesData, timelineRoot);
  } catch (error) {
    // Detailed error to console only; user sees a generic, friendly message.
    console.error("Could not load movie data:", error);
    timelineRoot.innerHTML = `
      <div style="text-align:center; color:red; padding:20px;">
        <p>Error loading movie data.</p>
        <p>Note: Ensure you are running on a Local Server (http://) not file://</p>
      </div>
    `;
  }
}

function renderTimeline(data, rootElement) {
  data.forEach((yearData) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "timeline-item";
    const markerDiv = document.createElement("div");
    markerDiv.className = "timeline-marker";
    const contentDiv = document.createElement("div");
    contentDiv.className = "timeline-content";
    contentDiv.setAttribute("tabindex", "0");

    const movies = yearData.movies || [];
    const favMovie = movies.find((m) => m.title === yearData.favorite);
    const otherMovies = movies.filter((m) => m.title !== yearData.favorite);
    const hasMoreMovies = otherMovies.length > 0;

    if (hasMoreMovies) {
      contentDiv.setAttribute("role", "button");
      contentDiv.setAttribute(
        "aria-label",
        `Expand movie list for ${yearData.year}`
      );
    } else {
      contentDiv.style.cursor = "default";
    }

    const headerDiv = document.createElement("div");
    headerDiv.className = "timeline-header";
    const arrowHtml = hasMoreMovies
      ? '<span class="toggle-icon">▼</span>'
      : "";

    headerDiv.innerHTML = `
      <div>
        <h3 class="timeline-year">${escapeHtmlFn(yearData.year)}</h3>
        <p class="timeline-stats" style="margin:5px 0 0 0; font-size:14px; color:#666;">
           Watched: ${movies.length} movies
        </p>
      </div>
      ${arrowHtml}
    `;
    contentDiv.appendChild(headerDiv);

    if (favMovie) {
      const favSection = document.createElement("div");
      favSection.className = "favorite-section";

      if (hasMoreMovies) {
        favSection.style.borderBottom = "1px solid #eee";
        favSection.style.marginBottom = "20px";
      } else {
        favSection.style.borderBottom = "none";
        favSection.style.marginBottom = "0";
        favSection.style.paddingBottom = "0";
      }

      favSection.innerHTML =
        '<div class="favorite-label-large">🏆 Best of ' +
        escapeHtmlFn(yearData.year) +
        "</div>" +
        '<div class="favorite-card">' +
        buildMovieCardHtmlFn(favMovie) +
        "</div>";
      contentDiv.appendChild(favSection);
    }

    const movieListContainer = document.createElement("div");
    movieListContainer.className = "movie-list-container";

    if (hasMoreMovies) {
      const scrollWrapper = document.createElement("div");
      scrollWrapper.className = "vertical-scroll-wrapper";
      scrollWrapper.setAttribute("tabindex", "0");
      scrollWrapper.setAttribute(
        "aria-label",
        `Movies list for ${yearData.year}`
      );

      otherMovies.forEach((movie) => {
        const card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML = buildMovieCardHtmlFn(movie);
        scrollWrapper.appendChild(card);
      });
      movieListContainer.appendChild(scrollWrapper);
      contentDiv.appendChild(movieListContainer);
    } else if (!favMovie) {
      movieListContainer.innerHTML +=
        '<p style="padding:10px; text-align:center;">No movies recorded.</p>';
      contentDiv.appendChild(movieListContainer);
    }

    itemDiv.appendChild(markerDiv);
    itemDiv.appendChild(contentDiv);
    rootElement.appendChild(itemDiv);

    if (hasMoreMovies) {
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
      "hidden_project"
    )
  );
  document.addEventListener("DOMContentLoaded", () => setupSkillsTabs(document));
  document.addEventListener("DOMContentLoaded", () =>
    setupContactForm(document)
  );
  document.addEventListener("DOMContentLoaded", () =>
    setupToggle(document, "toggleEduBtn", ".hidden-edu", "hidden-edu")
  );
  document.addEventListener("DOMContentLoaded", () => {
    const timelineRoot = document.getElementById("timeline-root");
    if (timelineRoot) loadMovies(timelineRoot);
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
