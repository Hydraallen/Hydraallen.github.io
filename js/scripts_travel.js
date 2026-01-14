// ==========================================
// Script for Travel Page (Final Version with Filters)
// ==========================================

let allTravelData = [];
let currentGalleryPhotos = [];
let currentPhotoIndex = 0;
let map; // Leaflet map instance
let tileLayer; // Keep track of the tile layer to switch languages
let markers = []; // Array to store map markers
let currentLanguage = 'en'; // Default language: English

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
  const langSelect = document.getElementById("lang-select"); // 语言选择器
  const continentBtns = document.querySelectorAll(".continent-tabs .tab-btn");
  
  // 筛选复选框
  const visitedCheckbox = document.getElementById("filter-visited");
  const plannedCheckbox = document.getElementById("filter-planned");

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
      // 初始化地图容器
      map = L.map('map-container').setView([20, 0], 2);
      
      // 加载默认语言图层 (English)
      addTileLayer(currentLanguage);
    }
  }

  // Helper: Switch Map Tile Layer based on Language
  function addTileLayer(lang) {
    // 如果已有图层，先移除，防止叠加
    if (tileLayer) {
      map.removeLayer(tileLayer);
    }

    let url = '';
    let attribution = '';

    if (lang === 'cn') {
      // Google Maps - Chinese (强制中文)
      url = 'http://mt0.google.com/vt/lyrs=m&hl=zh-CN&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps';
    } else if (lang === 'en') {
      // Google Maps - English (强制英文)
      url = 'http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps';
    } else {
      // Original / Local - OpenStreetMap (显示当地语言)
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    tileLayer = L.tileLayer(url, {
      attribution: attribution,
      maxZoom: 20,
      subdomains: lang === 'local' ? 'abc' : '' // OSM uses subdomains
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
      
      // 初始渲染：显示全部
      updateView();
      
    } catch (error) {
      console.error("Error loading travel data:", error);
      grid.innerHTML = `<p style="text-align:center; color:red;">Error loading data.</p>`;
    }
  }

  // Helper: Centralized View Update (Map + Grid)
  function updateView() {
    // 1. 获取当前激活的大洲
    const activeBtn = document.querySelector(".continent-tabs .tab-btn.active");
    const targetContinent = activeBtn ? activeBtn.getAttribute("data-continent") : "all";

    // 2. 获取筛选按钮状态
    const showVisited = visitedCheckbox.checked;
    const showPlanned = plannedCheckbox.checked;

    // 3. 筛选数据
    let filteredData = allTravelData.filter(place => {
      // 大洲筛选
      if (targetContinent !== "all" && place.continent !== targetContinent) {
        return false;
      }
      
      // 状态筛选 (Visited / Planned)
      const isPlanned = place.status === 'planned';
      if (isPlanned && !showPlanned) return false; // 如果是计划中，但没勾选 Bucket List -> 隐藏
      if (!isPlanned && !showVisited) return false; // 如果是已去过，但没勾选 Visited -> 隐藏

      return true;
    });

    // 4. 渲染地图标记
    renderMapMarkers(filteredData);

    // 5. 触发排序 (排序逻辑内部会调用 renderGrid)
    sortSelect.dispatchEvent(new Event("change"));
  }

  // 3. Render Map Markers
  function renderMapMarkers(data) {
    if (!map) return;

    // 清除现有标记
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    data.forEach(place => {
      if (place.coordinates) {
        const isPlanned = place.status === 'planned';
        
        // 创建标记
        const marker = L.marker(place.coordinates).addTo(map);
        
        // Popup 内容
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
        card.classList.add('highlight-card'); 
        setTimeout(() => card.classList.remove('highlight-card'), 2000);
      }
    });
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

      const videoBtn = card.querySelector(".video-btn-overlay");
      if (videoBtn) {
        videoBtn.addEventListener("click", (e) => e.stopPropagation());
      }

      grid.appendChild(card);
    });
  }

  // 5. Filtering Logic (Tabs & Checkboxes)
  
  // 大洲 Tab 点击
  continentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      continentBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const targetContinent = btn.getAttribute("data-continent");
      
      // 移动地图视角
      if (continentViews[targetContinent]) {
        const view = continentViews[targetContinent];
        map.flyTo(view.center, view.zoom, { duration: 1.5 });
      }
      
      // 更新列表和标记
      updateView();
    });
  });

  // 状态 Checkbox 点击 (Visited / Bucket List)
  if (visitedCheckbox) visitedCheckbox.addEventListener("change", updateView);
  if (plannedCheckbox) plannedCheckbox.addEventListener("change", updateView);

  // 6. Language Switching Logic
  if (langSelect) {
    langSelect.addEventListener("change", function() {
      currentLanguage = this.value; // 'en', 'cn', or 'local'
      addTileLayer(currentLanguage); // 切换地图底图
    });
  }

  // 7. Sorting Logic
  sortSelect.addEventListener("change", function () {
    const sortType = this.value;
    
    // 重新获取经过筛选（大洲+状态）的数据
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

  // --- Lightbox & Gallery Logic (Unchanged) ---
  
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
