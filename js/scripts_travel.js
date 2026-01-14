// ==========================================
// Script for Travel Page (Updated with Map)
// ==========================================

let allTravelData = [];
let currentGalleryPhotos = [];
let currentPhotoIndex = 0;
let map; // Leaflet map instance
let markers = []; // Array to store map markers

// 大洲坐标中心点配置 (用于地图视角切换)
const continentViews = {
  all: { center: [20, 0], zoom: 2 },
  asia: { center: [34.0479, 100.6197], zoom: 3 },
  europe: { center: [54.5260, 15.2551], zoom: 4 },
  namerica: { center: [54.5260, -105.2551], zoom: 3 },
  samerica: { center: [-8.7832, -55.4915], zoom: 3 },
  africa: { center: [-8.7832, 34.5085], zoom: 3 },
  oceania: { center: [-25.2744, 133.7751], zoom: 4 }
};

document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("travel-grid");
  // 如果页面上没有 travel-grid，说明不在 Travel 页面，直接退出
  if (!grid) return;

  const sortSelect = document.getElementById("place-sort");
  const continentBtns = document.querySelectorAll(".continent-tabs .tab-btn");
  
  // Gallery & Lightbox Elements
  const galleryModal = document.getElementById("gallery-modal");
  const galleryGrid = document.getElementById("gallery-grid");
  const galleryTitle = document.getElementById("gallery-title");
  const galleryVideoBtn = document.getElementById("gallery-video-btn");
  const closeGalleryBtn = document.getElementById("close-gallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeLightboxBtn = document.getElementById("close-lightbox");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  // 1. Initialize Map
  function initMap() {
    if (document.getElementById('map-container')) {
      map = L.map('map-container').setView([20, 0], 2);
      
      // 使用 OpenStreetMap 图层 (免费)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
    }
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
      
      // 初始渲染：显示全部
      renderGrid(allTravelData);
      renderMapMarkers(allTravelData);
      
      // 触发一次排序
      sortSelect.dispatchEvent(new Event("change"));
      
    } catch (error) {
      console.error("Error loading travel data:", error);
      grid.innerHTML = `<p style="text-align:center; color:red;">Error loading data.</p>`;
    }
  }

  // 3. Render Map Markers
  function renderMapMarkers(data) {
    if (!map) return;

    // 清除现有标记
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    data.forEach(place => {
      if (place.coordinates) {
        // 区分颜色：去过(绿色默认)，想去(橙色)
        // Leaflet 默认图标是蓝色，这里我们可以用 CSS filter 或者自定义 icon
        // 为了简单，这里使用默认图标，但在 popup 里区分
        
        const isPlanned = place.status === 'planned';
        const markerColor = isPlanned ? 'hue-rotate(140deg)' : ''; // 简单的 CSS 滤镜变色

        const marker = L.marker(place.coordinates).addTo(map);
        
        // 自定义 Popup 内容
        const popupContent = `
          <div style="text-align:center">
            <strong>${place.name}</strong><br>
            <span style="color:${isPlanned ? '#ff9800' : '#00695c'}">
              ${isPlanned ? '✈️ Bucket List' : '✅ Visited'}
            </span><br>
            <button onclick="document.dispatchEvent(new CustomEvent('focus-card', {detail: '${place.name}'}))" 
              style="margin-top:5px; cursor:pointer; background:#eee; border:none; padding:4px 8px; border-radius:4px;">
              View Details
            </button>
          </div>
        `;

        marker.bindPopup(popupContent);
        markers.push(marker);
      }
    });
  }

  // 监听地图 Popup 点击事件，滚动到对应卡片
  document.addEventListener('focus-card', function(e) {
    const placeName = e.detail;
    const cards = document.querySelectorAll('.place-card');
    cards.forEach(card => {
      if (card.getAttribute('data-name') === placeName) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-card'); // 你可以在 CSS 加一个闪烁动画
        setTimeout(() => card.classList.remove('highlight-card'), 2000);
      }
    });
  });

  // 4. Render Grid Cards
  function renderGrid(data) {
    grid.innerHTML = "";
    if (data.length === 0) {
      grid.innerHTML = "<p>No places found for this category.</p>";
      return;
    }

    data.forEach((place) => {
      let displayName = place.name;
      if (place.country.toLowerCase() === "usa" && place.state) {
        displayName += `, ${place.state}`;
      }

      const isPlanned = place.status === "planned";
      const hasVideo = place.video && place.video.trim() !== "";
      
      // 按钮逻辑：如果是 Planned，可能没有 View Photos 按钮
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
      card.setAttribute("data-date", place.date); // 用于排序

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

      // 点击事件逻辑
      if (!isPlanned) {
        const openGalleryLogic = () => {
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

      // 视频按钮阻止冒泡
      const videoBtn = card.querySelector(".video-btn-overlay");
      if (videoBtn) {
        videoBtn.addEventListener("click", (e) => e.stopPropagation());
      }

      grid.appendChild(card);
    });
  }

  // 5. Filtering Logic (Tabs)
  continentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // UI Update
      continentBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const targetContinent = btn.getAttribute("data-continent");

      // Filter Data
      let filteredData = allTravelData;
      if (targetContinent !== "all") {
        filteredData = allTravelData.filter(place => place.continent === targetContinent);
      }

      // Re-render Grid
      renderGrid(filteredData);
      
      // Re-render Map Markers (Optional: if you only want to show markers for current tab)
      // renderMapMarkers(filteredData); 
      // Or keep all markers and just move the camera:
      
      // Move Map Camera
      if (continentViews[targetContinent]) {
        const view = continentViews[targetContinent];
        map.flyTo(view.center, view.zoom, { duration: 1.5 });
      }
      
      // Re-apply current sort
      sortSelect.dispatchEvent(new Event("change"));
    });
  });

  // 6. Sorting Logic
  sortSelect.addEventListener("change", function () {
    const sortType = this.value;
    const currentCards = Array.from(grid.getElementsByClassName("place-card"));
    
    const sortedCards = currentCards.sort((a, b) => {
      const dateA = a.getAttribute("data-date");
      const dateB = b.getAttribute("data-date");
      const nameA = a.getAttribute("data-name");
      const nameB = b.getAttribute("data-name");

      // 处理 TBD 日期 (Planned trips usually at top or bottom)
      if (dateA === "TBD") return sortType === "newest" ? -1 : 1;
      if (dateB === "TBD") return sortType === "newest" ? 1 : -1;

      if (sortType === "az") return nameA.localeCompare(nameB);
      if (sortType === "newest") return new Date(dateB) - new Date(dateA);
      if (sortType === "oldest") return new Date(dateA) - new Date(dateB);
      return 0;
    });

    sortedCards.forEach((card) => grid.appendChild(card));
  });

  // --- Lightbox & Gallery Logic (Kept largely the same) ---
  
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
      lightboxImg.src = currentGalleryPhotos[currentPhotoIndex];
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
      photos.forEach((src, index) => {
        const div = document.createElement("div");
        div.className = "gallery-item";
        div.setAttribute("tabindex", "0");
        div.setAttribute("role", "button");
        const img = document.createElement("img");
        img.src = src;
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

  // Start Loading
  loadTravelData();
});
