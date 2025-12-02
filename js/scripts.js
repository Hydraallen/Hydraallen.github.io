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

// Script for handling Formspree contact form submission via AJAX
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
            'Accept': 'application/json'
          }
        });
        if (response.ok) {
          status.innerHTML = "Thanks for your message! I'll get back to you soon.";
          status.className = "form-status success";
          form.reset(); 
        } else {
          const errorData = await response.json();
          if (Object.hasOwn(errorData, 'errors')) {
            status.innerHTML = errorData["errors"].map(error => error["message"]).join(", ");
          } else {
            status.innerHTML = "Oops! There was a problem submitting your form.";
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



