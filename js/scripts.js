document.addEventListener("DOMContentLoaded", function () {
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.innerHTML = new Date().getFullYear();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const hamburgerMenu = document.querySelector(".hamburger-menu");
  const nav = document.querySelector("nav");

  if (!hamburgerMenu || !nav) return;

  nav.classList.add("hidden-nav");
  hamburgerMenu.classList.remove("toggle");

  hamburgerMenu.addEventListener("click", () => {
    const isClosed = nav.classList.contains("hidden-nav");

    if (isClosed) {
      nav.classList.remove("hidden-nav");
      hamburgerMenu.classList.add("toggle");
    } else {
      nav.classList.add("hidden-nav");
      hamburgerMenu.classList.remove("toggle");
    }
  });

  const navLinks = nav.querySelectorAll("a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.add("hidden-nav");
      hamburgerMenu.classList.remove("toggle");
    });
  });
});

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
    const response = await fetch("./data/movies.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const moviesData = await response.json();
    timelineRoot.innerHTML = "";
    renderTimeline(moviesData, timelineRoot);
  } catch (error) {
    console.error("Could not load movie data:", error);
    timelineRoot.innerHTML = `
      <div style="text-align:center; color:red; padding:20px;">
        <p>Error loading movie data.</p>
        <p>Note: If you are opening this file directly (file://), please use a Local Server.</p>
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
    const headerDiv = document.createElement("div");
    headerDiv.className = "timeline-header";
    headerDiv.innerHTML = `
      <div>
        <h3 class="timeline-year">${yearData.year}</h3>
        <p class="timeline-stats" style="margin:5px 0 0 0; font-size:14px; color:#666;">
           Watched: ${yearData.movies.length} movies
        </p>
      </div>
      <span class="toggle-icon">▼</span>
    `;

    const movieListContainer = document.createElement("div");
    movieListContainer.className = "movie-list-container";
    const favMovie = yearData.movies.find(m => m.title === yearData.favorite);
    const otherMovies = yearData.movies.filter(m => m.title !== yearData.favorite);
    if (favMovie) {
      const favSection = document.createElement("div");
      favSection.className = "favorite-section";
      const posterSrc = favMovie.poster ? favMovie.poster : "https://via.placeholder.com/200x300?text=No+Image";
      favSection.innerHTML = `
        <div class="favorite-label-large">🏆 Best of ${yearData.year}</div>
        <div class="favorite-card">
          <div class="poster-wrapper">
            <img src="${posterSrc}" alt="${favMovie.title}" loading="lazy" />
          </div>
          <div class="movie-info">
            <h4 class="movie-title">${favMovie.title}</h4>
            <p class="movie-date">${favMovie.date}</p>
          </div>
        </div>
      `;
      movieListContainer.appendChild(favSection);
    }

    if (otherMovies.length > 0) {
      const scrollWrapper = document.createElement("div");
      scrollWrapper.className = "vertical-scroll-wrapper";
      otherMovies.forEach((movie) => {
        const card = document.createElement("div");
        card.className = "movie-card";
        const posterSrc = movie.poster ? movie.poster : "https://via.placeholder.com/200x300?text=No+Image";
        card.innerHTML = `
          <div class="poster-wrapper">
            <img src="${posterSrc}" alt="${movie.title}" loading="lazy" />
          </div>
          <div class="movie-info">
            <h4 class="movie-title">${movie.title}</h4>
            <p class="movie-date">${movie.date}</p>
          </div>
        `;
        scrollWrapper.appendChild(card);
      });
      movieListContainer.appendChild(scrollWrapper);
    } else if (!favMovie) {
      movieListContainer.innerHTML += '<p style="padding:10px; text-align:center;">No movies recorded.</p>';
    }
    contentDiv.appendChild(headerDiv);
    contentDiv.appendChild(movieListContainer);
    itemDiv.appendChild(markerDiv);
    itemDiv.appendChild(contentDiv);
    rootElement.appendChild(itemDiv);
    contentDiv.addEventListener("click", function (e) {
      if (e.target.closest('.vertical-scroll-wrapper')) {
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
  });
}

