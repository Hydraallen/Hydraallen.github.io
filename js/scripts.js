// script for updating the year in the footer
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("year").innerHTML = new Date().getFullYear();
});

// script for hamburger menu
document.addEventListener("DOMContentLoaded", () => {
  const hamburgerMenu = document.querySelector(".hamburger-menu");
  const nav = document.querySelector(".hidden-nav");
  const navLinks = nav.querySelectorAll("a");
  nav.classList.add("hidden-nav");
  hamburgerMenu.classList.remove("toggle");
  hamburgerMenu.addEventListener("click", () => {
    const isMenuOpen = nav.classList.contains("hidden-nav");
    if (isMenuOpen) {
      nav.classList.remove("hidden-nav");
      hamburgerMenu.classList.add("toggle");
    } else {
      nav.classList.add("hidden-nav");
      hamburgerMenu.classList.remove("toggle");
    }
  });
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.add("hidden-nav");
      hamburgerMenu.classList.remove("toggle");
    });
  });
});

// script for hide/show more projects
document.addEventListener("DOMContentLoaded", function () {
  const toggleProjectsBtn = document.getElementById("toggleProjectsBtn"); // 按钮
  const hiddenProjects = document.querySelectorAll(
    ".project-panel.hidden_project"
  );
  if (!toggleProjectsBtn) {
    console.error("Toggle button not found!");
    return;
  }
  toggleProjectsBtn.addEventListener("click", function () {
    const isHidden = Array.from(hiddenProjects).some(
      (project) =>
        project.style.display === "none" || project.style.display === ""
    );

    if (isHidden) {
      hiddenProjects.forEach((project) => {
        project.style.display = "block";
      });
      toggleProjectsBtn.textContent = "Show Less";
    } else {
      hiddenProjects.forEach((project) => {
        project.style.display = "none";
      });
      toggleProjectsBtn.textContent = "Show More";
    }
  });
});

// script for skill tab filtering
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
