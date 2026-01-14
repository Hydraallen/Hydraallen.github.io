// Script to update the year in the footer
document.addEventListener("DOMContentLoaded", function () {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.innerHTML = new Date().getFullYear();
  }
});

// Script for Hamburger Menu
document.addEventListener("DOMContentLoaded", () => {
  const hamburgerMenu = document.querySelector(".hamburger-menu");
  const nav = document.querySelector("nav");
  if (!hamburgerMenu || !nav) return;
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
      firstFocusableElement.focus();
    }, 100);
    document.addEventListener("keydown", trapTabKey);
  }
  function closeMenu() {
    nav.classList.add("hidden-nav");
    hamburgerMenu.classList.remove("toggle");
    hamburgerMenu.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", trapTabKey);
    hamburgerMenu.focus();
  }

  function trapTabKey(e) {
    const isTabPressed = e.key === "Tab" || e.keyCode === 9;
    const isEscPressed = e.key === "Escape" || e.keyCode === 27;
    if (isEscPressed) {
      closeMenu();
      return;
    }
    if (!isTabPressed) {
      return;
    }
    if (e.shiftKey) {
      if (document.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement.focus();
      }
    } else {
      if (document.activeElement === lastFocusableElement) {
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
  const navLinks = nav.querySelectorAll("a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });
});

// Script for Projects Section
document.addEventListener("DOMContentLoaded", function () {
  const toggleProjectsBtn = document.getElementById("toggleProjectsBtn");
  const hiddenProjects = document.querySelectorAll(
    ".project-panel.hidden_project"
  );

  if (toggleProjectsBtn && hiddenProjects.length > 0) {
    toggleProjectsBtn.addEventListener("click", function () {
      const isHidden = hiddenProjects[0].classList.contains("hidden_project");

      if (isHidden) {
        hiddenProjects.forEach((project) => {
          project.classList.remove("hidden_project");
        });
        toggleProjectsBtn.textContent = "Show Less";
      } else {
        hiddenProjects.forEach((project) => {
          project.classList.add("hidden_project");
        });
        toggleProjectsBtn.textContent = "Show More";
      }
    });
  }
});

// Script for Skills Section
document.addEventListener("DOMContentLoaded", function () {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const skillCards = document.querySelectorAll(".skill-card");

  if (tabBtns.length > 0) {
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
});

// Script for Contact Form
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const data = new FormData(event.target);
      const submitBtn = form.querySelector(".submit-btn");
      const originalBtnText = submitBtn.textContent;

      submitBtn.textContent = "Sending...";
      submitBtn.disabled = true;

      try {
        const response = await fetch(event.target.action, {
          method: form.method,
          body: data,
          headers: {
            Accept: "application/json",
          },
        });

        if (response.ok) {
          status.innerHTML =
            "Thanks for your message! I'll get back to you soon.";
          status.className = "form-status success";
          form.reset();
        } else {
          const errorData = await response.json();
          if (Object.hasOwn(errorData, "errors")) {
            status.innerHTML = errorData["errors"]
              .map((error) => error["message"])
              .join(", ");
          } else {
            status.innerHTML =
              "Oops! There was a problem submitting your form.";
          }
          status.className = "form-status error";
        }
      } catch (error) {
        status.innerHTML = "Oops! There was a problem submitting your form.";
        status.className = "form-status error";
      } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }
});

// Script for Education Section
document.addEventListener("DOMContentLoaded", function () {
  const toggleEduBtn = document.getElementById("toggleEduBtn");
  const hiddenEduCards = document.querySelectorAll(".hidden-edu");

  if (toggleEduBtn && hiddenEduCards.length > 0) {
    toggleEduBtn.addEventListener("click", function () {
      const isHidden = hiddenEduCards[0].classList.contains("hidden-edu");

      if (isHidden) {
        hiddenEduCards.forEach((card) => {
          card.classList.remove("hidden-edu");
        });
        toggleEduBtn.textContent = "Show Less";
      } else {
        hiddenEduCards.forEach((card) => {
          card.classList.add("hidden-edu");
        });
        toggleEduBtn.textContent = "Show More";
      }
    });
  }
});

// Script for Movies Page
document.addEventListener("DOMContentLoaded", function () {
  const timelineRoot = document.getElementById("timeline-root");
  if (timelineRoot) {
    loadMovies(timelineRoot);
  }
});
async function loadMovies(timelineRoot) {
  try {
    timelineRoot.innerHTML =
      '<p style="text-align:center; padding:20px;">Loading movies...</p>';
    const indexResponse = await fetch("../data/movies/index.json");
    if (!indexResponse.ok) {
      throw new Error(`Failed to load index.json: ${indexResponse.status}`);
    }
    const fileList = await indexResponse.json(); // 得到 ["2022", "2023", ...]
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
    console.error("Could not load movie data:", error);
    timelineRoot.innerHTML = `
      <div style="text-align:center; color:red; padding:20px;">
        <p>Error loading movie data.</p>
        <p>Details: ${error.message}</p>
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
      contentDiv.setAttribute("aria-label", `Expand movie list for ${yearData.year}`);
    } else {
      contentDiv.style.cursor = "default";
    }

    const headerDiv = document.createElement("div");
    headerDiv.className = "timeline-header";
    const arrowHtml = hasMoreMovies ? '<span class="toggle-icon">▼</span>' : '';

    headerDiv.innerHTML = `
      <div>
        <h3 class="timeline-year">${yearData.year}</h3>
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

      const posterSrc = favMovie.poster
        ? favMovie.poster
        : "https://via.placeholder.com/200x300?text=No+Image";

      favSection.innerHTML = `
        <div class="favorite-label-large">🏆 Best of ${yearData.year}</div>
        <div class="favorite-card">
          <div class="poster-wrapper">
            <img src="${posterSrc}" alt="${favMovie.title}" loading="lazy">
          </div>
          <div class="movie-info">
            <h4 class="movie-title">${favMovie.title}</h4>
            <p class="movie-date">${favMovie.date}</p>
          </div>
        </div>
      `;
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
        const posterSrc = movie.poster
          ? movie.poster
          : "https://via.placeholder.com/200x300?text=No+Image";
        card.innerHTML = `
          <div class="poster-wrapper">
            <img src="${posterSrc}" alt="${movie.title}" loading="lazy">
          </div>
          <div class="movie-info">
            <h4 class="movie-title">${movie.title}</h4>
            <p class="movie-date">${movie.date}</p>
          </div>
        `;
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
        if (e.target.closest(".vertical-scroll-wrapper")) {
          return;
        }

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
