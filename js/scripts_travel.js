// ==========================================
// Script for Travel Page (Fixed: No Scroll on Map Click)
// ==========================================

let allTravelData = [];
let currentGalleryPhotos = [];
let currentPhotoIndex = 0;
let map; // Leaflet map instance
let tileLayer; // Keep track of the tile layer to switch languages
let markers = []; // Array to store map markers
let currentLanguage = 'en'; // Default language: English
let isCityView = false; // Track if we are in city view mode

// 大洲坐标中心点配置
const continentViews = {
  all: { center: [20, 0], zoom: 2 },
  asia: { center: [34.0479, 100.6197], zoom: 3 },
  europe: { center: [54.5260, 15.2551], zoom: 4 },
  namerica: { center: [54.5260, -105.2551], zoom: 3 },
  samerica: { center: [-8.7832, -55.4915], zoom: 3 },
  africa: { center: [-8.7832, 34.5085], zoom: 3 },
  oceania: { center: [-25.2744, 133.7751], zoom: 4 },
  antarctica: { center: [-75.0000, 0.0000], zoom: 2 }
};

document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("travel-grid");
  if (!grid) return;

  const sortSelect = document.getElementById("place-sort");
  const langSelect = document.getElementById("lang-select");
  const continentBtns = document.querySelectorAll(".continent-tabs .tab-btn");
  const visitedCheckbox = document.getElementById("filter-visited");
  const plannedCheckbox = document.getElementById("filter-planned");
  const resetMapBtn = document.getElementById("reset-map-btn");

  // Gallery & Lightbox Elements
  const galleryModal = document.getElementById("gallery-modal");
  const galleryGrid = document.getElementById("gallery-grid");
  const galleryTitle = document.getElementById("gallery-title");
  const galleryVideoBtn = document.getElementById("gallery-video-btn");
  const closeGalleryBtn = document.getElementById("close-gallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const closeLightboxBtn = document.getElementById("close-lightbox");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  // 1. Initialize Map
  function initMap() {
    if (document.getElementById('map-container')) {
      map = L.map('map-container').setView([20, 0], 2);
      addTileLayer(currentLanguage);
    }
  }

  function addTileLayer(lang) {
    if (tileLayer) map.removeLayer(tileLayer);

    let url = '';
    let attribution = '';

    if (lang === 'cn') {
      url = 'http://mt0.google.com/vt/lyrs=m&hl=zh-CN&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps';
    } else if (lang === 'en') {
      url = 'http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps';
    } else {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    tileLayer = L.tileLayer(url, {
      attribution: attribution,
      maxZoom: 20,
      subdomains: lang === 'local' ? 'abc' : ''
    }).addTo(map);
  }

  // 2. Load Data
  async function loadTravelData() {
    try {
      initMap();
      
      const indexResponse = await fetch("../data/travel/index.json");
      if (!indexResponse.ok) throw new Error("Failed to load index.json");
      const fileList = await indexResponse.json();
      
      const fetchPromises = fileList.map((filename) =>
        fetch(`./data/travel/${filename}.json`).then((res) => res.json())
      );
      
      allTravelData = await Promise.all(fetchPromises);
      updateView();
      
    } catch (error) {
      console.error("Error loading travel data:", error);
      grid.innerHTML = `<p style="text-align:center; color:red;">Error loading data.</p>`;
    }
  }

  // Helper: Centralized View Update
  function updateView() {
    if (isCityView) return; 

    const activeBtn = document.querySelector(".continent-tabs .tab-btn.active");
    const targetContinent = activeBtn ? activeBtn.getAttribute("data-continent") : "all";
    const showVisited = visitedCheckbox.checked;
    const showPlanned = plannedCheckbox.checked;

    let filteredData = allTravelData.filter(place => {
      if (targetContinent !== "all" && place.continent !== targetContinent) return false;
      const isPlanned = place.status === 'planned';
      if (isPlanned && !showPlanned) return false;
      if (!isPlanned && !showVisited) return false;
      return true;
    });

    renderMapMarkers(filteredData);
    sortSelect.dispatchEvent(new Event("change"));
  }

  // 3. Render Global Map Markers (Cities)
  function renderMapMarkers(data) {
    if (!map) return;
    clearMarkers();

    data.forEach(place => {
      if (place.coordinates) {
        const marker = L.marker(place.coordinates).addTo(map);
        
        // --- 修复点：移除了触发滚动的代码 ---
        marker.on('click', function() {
          showCityOnMap(place);
          // 之前这里有一行 dispatchEvent('focus-card') 导致了页面跳转，现已删除
        });

        // 鼠标悬停显示简单提示
        marker.bindTooltip(place.name, {
            permanent: false, 
            direction: 'top',
            offset: [0, -20]
        });

        markers.push(marker);
      }
    });
  }

  function clearMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
  }

  // --- City Map Logic ---

  function showCityOnMap(placeData) {
    if (!map || !placeData.coordinates) return;
    
    isCityView = true;
    clearMarkers(); // Clear global markers
    resetMapBtn.classList.remove("hidden-btn"); // Show back button

    // Fly to city
    map.flyTo(placeData.coordinates, 13, { duration: 1.5 });

    // Add markers for photos if they exist and have coordinates
    if (placeData.photos && placeData.photos.length > 0) {
      placeData.photos.forEach((photo, index) => {
        if (typeof photo === 'object' && photo.coordinates) {
          const marker = L.marker(photo.coordinates).addTo(map);
          
          // Popup with thumbnail and location name
          const popupContent = `
            <div style="text-align:center">
              <img src="${photo.src}" class="popup-photo-thumb" onclick="document.dispatchEvent(new CustomEvent('open-lightbox-index', {detail: ${index}}))">
              <div class="popup-location-name">${photo.location || 'Photo Location'}</div>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          markers.push(marker);
        }
      });
    }
  }

  function exitCityMode() {
    isCityView = false;
    resetMapBtn.classList.add("hidden-btn");
    
    // Reset view to current continent
    const activeBtn = document.querySelector(".continent-tabs .tab-btn.active");
    const targetContinent = activeBtn ? activeBtn.getAttribute("data-continent") : "all";
    if (continentViews[targetContinent]) {
        const view = continentViews[targetContinent];
        map.flyTo(view.center, view.zoom, { duration: 1.5 });
    }

    // Re-render global markers
    updateView();
  }

  resetMapBtn.addEventListener("click", exitCityMode);

  // Listen for popup click to open lightbox
  document.addEventListener('open-lightbox-index', function(e) {
    const index = e.detail;
    currentPhotoIndex = index;
    updateLightboxImage();
    lightbox.classList.remove("hidden-modal");
    setTimeout(() => lightbox.classList.add("active"), 10);
  });

  // 4. Render Grid Cards
  function renderGrid(data) {
    grid.innerHTML = "";
    if (data.length === 0) {
      grid.innerHTML = "<p>No places found matching your filters.</p>";
      return;
    }

    data.forEach((place) => {
      let displayName = place.name;
      if (place.country.toLowerCase() === "usa" && place.state) {
        displayName += `, ${place.state}`;
      }

      const isPlanned = place.status === "planned";
      const hasVideo = place.video && place.video.trim() !== "";
      
      let buttonsHtml = "";
      if (!isPlanned) {
        buttonsHtml += `<button class="action-btn photo-btn">View Photos</button>`;
      } else {
        buttonsHtml += `<span style="color:white; font-weight:bold;">Coming Soon</span>`;
      }
      
      if (hasVideo) {
        buttonsHtml += `<a href="${place.video}" target="_blank" class="action-btn video-btn-overlay">Play Video</a>`;
      }

      const card = document.createElement("div");
      card.className = `place-card ${isPlanned ? 'planned' : ''}`;
      card.setAttribute("tabindex", "0");
      card.setAttribute("data-continent", place.continent || "other");
      card.setAttribute("data-name", place.name);
      card.setAttribute("data-date", place.date); 

      card.innerHTML = `
        <div class="place-image-wrapper">
          <img src="${place.cover}" alt="${displayName}" loading="lazy">
          <div class="hover-actions">
            ${buttonsHtml}
          </div>
        </div>
        <div class="place-info">
          <div class="place-country">${place.country}</div>
          <h3 class="place-city">${displayName}</h3>
          <div class="place-date">${place.date_display}</div>
        </div>
      `;

      if (!isPlanned) {
        const openGalleryLogic = () => {
          showCityOnMap(place);
          const isLargeScreen = window.innerWidth > 768;
          if (isLargeScreen) {
            openLightboxDirectly(place);
          } else {
            openGalleryScroll(place);
          }
        };

        card.addEventListener("click", openGalleryLogic);
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openGalleryLogic();
          }
        });

        const photoBtn = card.querySelector(".photo-btn");
        if (photoBtn) {
          photoBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openGalleryLogic();
          });
        }
      }

      const videoBtn = card.querySelector(".video-btn-overlay");
      if (videoBtn) {
        videoBtn.addEventListener("click", (e) => e.stopPropagation());
      }

      grid.appendChild(card);
    });
  }

  // 5. Filtering Logic
  continentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      continentBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (isCityView) {
          isCityView = false;
          resetMapBtn.classList.add("hidden-btn");
      }

      const targetContinent = btn.getAttribute("data-continent");
      if (continentViews[targetContinent]) {
        const view = continentViews[targetContinent];
        map.flyTo(view.center, view.zoom, { duration: 1.5 });
      }
      
      updateView();
    });
  });

  if (visitedCheckbox) visitedCheckbox.addEventListener("change", updateView);
  if (plannedCheckbox) plannedCheckbox.addEventListener("change", updateView);

  // 6. Sorting Logic
  sortSelect.addEventListener("change", function () {
    const sortType = this.value;
    const activeBtn = document.querySelector(".continent-tabs .tab-btn.active");
    const targetContinent = activeBtn ? activeBtn.getAttribute("data-continent") : "all";
    const showVisited = visitedCheckbox.checked;
    const showPlanned = plannedCheckbox.checked;

    let dataToSort = allTravelData.filter(place => {
      if (targetContinent !== "all" && place.continent !== targetContinent) return false;
      const isPlanned = place.status === 'planned';
      if (isPlanned && !showPlanned) return false;
      if (!isPlanned && !showVisited) return false;
      return true;
    });

    const sortedData = [...dataToSort].sort((a, b) => {
      const dateA = a.date;
      const dateB = b.date;
      const nameA = a.name;
      const nameB = b.name;

      if (dateA === "TBD") return sortType === "newest" ? -1 : 1;
      if (dateB === "TBD") return sortType === "newest" ? 1 : -1;

      if (sortType === "az") return nameA.localeCompare(nameB);
      if (sortType === "newest") return new Date(dateB) - new Date(dateA);
      if (sortType === "oldest") return new Date(dateA) - new Date(dateB);
      return 0;
    });

    renderGrid(sortedData);
  });

  // 7. Language Logic
  if (langSelect) {
    langSelect.addEventListener("change", function() {
      currentLanguage = this.value;
      addTileLayer(currentLanguage);
    });
  }

  // --- Lightbox Logic ---
  
  function openLightboxDirectly(placeData) {
    if (!placeData.photos || placeData.photos.length === 0) {
      alert("No photos available.");
      return;
    }
    currentGalleryPhotos = placeData.photos;
    currentPhotoIndex = 0;
    updateLightboxImage();
    lightbox.classList.remove("hidden-modal");
    setTimeout(() => lightbox.classList.add("active"), 10);
  }

  function updateLightboxImage() {
    if (currentGalleryPhotos.length > 0) {
      const photo = currentGalleryPhotos[currentPhotoIndex];
      const src = typeof photo === 'object' ? photo.src : photo;
      const location = (typeof photo === 'object' && photo.location) ? photo.location : "";
      
      lightboxImg.src = src;
      if (lightboxCaption) {
        lightboxCaption.textContent = location;
        lightboxCaption.style.display = location ? 'block' : 'none';
      }
    }
  }

  function showNextPhoto() {
    if (currentGalleryPhotos.length === 0) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % currentGalleryPhotos.length;
    updateLightboxImage();
  }

  function showPrevPhoto() {
    if (currentGalleryPhotos.length === 0) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + currentGalleryPhotos.length) % currentGalleryPhotos.length;
    updateLightboxImage();
  }

  function openGalleryScroll(placeData) {
    const photos = placeData.photos;
    let title = placeData.name;
    if (placeData.country.toLowerCase() === "usa" && placeData.state) {
      title += `, ${placeData.state}`;
    }
    galleryTitle.textContent = title;

    if (placeData.video && placeData.video.trim() !== "") {
      galleryVideoBtn.href = placeData.video;
      galleryVideoBtn.classList.remove("hidden-btn");
    } else {
      galleryVideoBtn.href = "#";
      galleryVideoBtn.classList.add("hidden-btn");
    }

    galleryGrid.innerHTML = "";
    if (photos && photos.length > 0) {
      photos.forEach((photo, index) => {
        const div = document.createElement("div");
        div.className = "gallery-item";
        div.setAttribute("tabindex", "0");
        div.setAttribute("role", "button");
        
        const img = document.createElement("img");
        img.src = typeof photo === 'object' ? photo.src : photo;
        img.loading = "lazy";
        
        const openPhoto = () => {
          currentGalleryPhotos = photos;
          currentPhotoIndex = index;
          updateLightboxImage();
          lightbox.classList.remove("hidden-modal");
          setTimeout(() => lightbox.classList.add("active"), 10);
        };
        
        div.addEventListener("click", openPhoto);
        div.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPhoto();
            }
        });
        div.appendChild(img);
        galleryGrid.appendChild(div);
      });
      galleryModal.classList.remove("hidden-modal");
      document.body.style.overflow = "hidden";
      
      if (closeGalleryBtn) setTimeout(() => closeGalleryBtn.focus(), 100);
    } else {
      alert("No photos available yet!");
    }
  }

  // Event Listeners for Modals
  closeGalleryBtn.addEventListener("click", function () {
    galleryModal.classList.add("hidden-modal");
    document.body.style.overflow = "auto";
  });

  function closeLightbox() {
    lightbox.classList.remove("active");
    setTimeout(() => lightbox.classList.add("hidden-modal"), 300);
  }

  closeLightboxBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("hidden-modal")) {
      if (e.key === "ArrowLeft") showPrevPhoto();
      if (e.key === "ArrowRight") showNextPhoto();
      if (e.key === "Escape") closeLightbox();
    }
  });

  if (prevBtn) prevBtn.addEventListener("click", (e) => { e.stopPropagation(); showPrevPhoto(); });
  if (nextBtn) nextBtn.addEventListener("click", (e) => { e.stopPropagation(); showNextPhoto(); });

  // Map Popup Focus Logic (Global Map) - Only used for manual focus, not click
  document.addEventListener('focus-card', function(e) {
    const placeName = e.detail;
    const cards = document.querySelectorAll('.place-card');
    cards.forEach(card => {
      if (card.getAttribute('data-name') === placeName) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-card'); 
        setTimeout(() => card.classList.remove('highlight-card'), 2000);
      }
    });
  });

  loadTravelData();
});
