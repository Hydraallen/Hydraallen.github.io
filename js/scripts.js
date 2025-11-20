// script for updating the year in the footer
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("year").innerHTML = new Date().getFullYear();
});


// script for hamburger menu
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('.hidden-nav');
    const navLinks = nav.querySelectorAll('a'); 
    nav.classList.add('hidden-nav');
    hamburgerMenu.classList.remove('toggle');
    hamburgerMenu.addEventListener('click', () => {
        const isMenuOpen = nav.classList.contains('hidden-nav');
        if (isMenuOpen) {
            nav.classList.remove('hidden-nav');
            hamburgerMenu.classList.add('toggle');
        } else {
            nav.classList.add('hidden-nav');
            hamburgerMenu.classList.remove('toggle');
        }
    });
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.add('hidden-nav');
            hamburgerMenu.classList.remove('toggle');
        });
    });
});



document.addEventListener('DOMContentLoaded', function () {
  const toggleProjectsBtn = document.getElementById('toggleProjectsBtn'); // 按钮
  const hiddenProjects = document.querySelectorAll('.project-panel.hidden_project'); // 隐藏的项目
  if (!toggleProjectsBtn) {
    console.error('Toggle button not found!');
    return;
  }
  toggleProjectsBtn.addEventListener('click', function () {
    const isHidden = Array.from(hiddenProjects).some(
      (project) => project.style.display === 'none' || project.style.display === ''
    );

    if (isHidden) {
      hiddenProjects.forEach((project) => {
        project.style.display = 'block';
      });
      toggleProjectsBtn.textContent = 'Show Less';
    } else {
      hiddenProjects.forEach((project) => {
        project.style.display = 'none';
      });
      toggleProjectsBtn.textContent = 'Show More';
    }
  });
});


