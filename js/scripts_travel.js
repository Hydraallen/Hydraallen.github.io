// ==========================================
// Script for Travel Page
// Features: Persistent Global Markers, Auto-Bounds, Colored Markers (Visited/Planned)
// Modified: Orange markers for TODO, Split Sections, Independent Sorting, Dynamic Map Bounds
// ==========================================

// --- Shared pure helpers (js/lib.js) ---
// Browser: lib.js is loaded BEFORE this file, exposing helpers as globals.
// Node (tests): require the module. This accessor bridges both environments
// without breaking the browser direct-include.
var lib =
  typeof module !== "undefined" && module.exports
    ? require("./lib.js")
    : {
        escapeHtml: escapeHtml,
        getDisplayName: getDisplayName,
        compareVisited: compareVisited,
        comparePlanned: comparePlanned,
      };

// Fetch every travel data file with per-file fault tolerance: a single 404 or
// non-JSON response is warned about and skipped (returned as null then filtered
// out) instead of rejecting the whole Promise.all and blanking the map + grid.
// `fetchFn` is injected so this stays testable without a real network / Leaflet.
async function fetchTravelFiles(fileList, fetchFn) {
  const dataPromises = fileList.map(async (filename) => {
    try {
      const res = await fetchFn(`../data/travel/${filename}.json`);
      if (!res.ok) {
        console.warn(`Warning: Could not load ${filename}.json`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`Warning: Could not load ${filename}.json`, err);
      return null;
    }
  });
  const rawData = await Promise.all(dataPromises);
  return rawData.filter(Boolean);
}

// Build the trip detail-page URL for a place. The id is percent-encoded so an
// id containing spaces or reserved characters cannot break out of the query
// string. Module-level so it is unit-testable without Leaflet / the DOM.
function tripUrl(place) {
  return `trip.html?place=${encodeURIComponent(place.id)}`;
}

let allTravelData = [];
let map; // Leaflet map instance
let tileLayer; // Keep track of the tile layer to switch languages

// 全局标记：所有城市/区域的主标记
let globalMarkers = [];

let currentLanguage = 'en'; // Default language: English

// --- 1. 定义自定义颜色的图钉 ---
// Guard against a missing Leaflet global so this module can be required in Node
// tests (where `L` is absent); in the browser `L` is always defined by this point.
const MarkerIcons = typeof L === "undefined" ? {} : {
  visited: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }),
  planned: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
};

// 大洲坐标中心点配置 (作为无数据时的 fallback)
// [修改] 调整了大洋洲的默认视野，以防没有数据时也能看到新西兰
const continentViews = {
  all: { center: [20, 0], zoom: 2 },
  asia: { center: [34.0479, 100.6197], zoom: 3 },
  europe: { center: [54.5260, 15.2551], zoom: 4 },
  namerica: { center: [54.5260, -105.2551], zoom: 3 },
  samerica: { center: [-8.7832, -55.4915], zoom: 3 },
  africa: { center: [-8.7832, 34.5085], zoom: 3 },
  oceania: { center: [-30.0, 160.0], zoom: 3 }, // [修改] 中心向东移，包含新西兰
  antarctica: { center: [-75.0000, 0.0000], zoom: 2 }
};

// Guarded so the module can be required in Node tests without a `document`
// global; in the browser this registers the page bootstrap as before.
if (typeof document !== "undefined") {
document.addEventListener("DOMContentLoaded", function () {
  const gridContainer = document.getElementById("travel-grid"); // Main container
  if (!gridContainer) return;

  const sortSelect = document.getElementById("place-sort");
  const langSelect = document.getElementById("lang-select");
  const continentBtns = document.querySelectorAll(".continent-tabs .tab-btn");
  const visitedCheckbox = document.getElementById("filter-visited");
  const plannedCheckbox = document.getElementById("filter-planned");

  // 2. Initialize Map
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
      url = 'https://mt0.google.com/vt/lyrs=m&hl=zh-CN&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps';
    } else if (lang === 'en') {
      url = 'https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
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

  // 3. Load Data
  async function loadTravelData() {
    try {
      initMap();
      
      // Path unified to `../data/travel/...` for both index and data files,
      // matching the convention in scripts.js (loadMovies). Browsers clamp the
      // leading `../` at the site root, so this resolves to /data/travel/...
      const indexResponse = await fetch("../data/travel/index.json");
      if (!indexResponse.ok) throw new Error("Failed to load index.json");
      const fileList = await indexResponse.json();

      // Per-file fault tolerance: one bad file no longer blanks the whole page.
      allTravelData = await fetchTravelFiles(fileList, fetch);
      updateView();
      
    } catch (error) {
      console.error("Error loading travel data:", error);
      gridContainer.innerHTML = `<p style="text-align:center; color:red;">Error loading data.</p>`;
    }
  }

  // Helper: Centralized View Update
  function updateView() {
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

    renderGlobalMarkers(filteredData);

    // 触发排序事件以重新渲染网格
    sortSelect.dispatchEvent(new Event("change"));
  }

  // 4. Render Global Map Markers (Cities)
  function renderGlobalMarkers(data) {
    if (!map) return;
    
    // 清除旧的全局标记
    globalMarkers.forEach(marker => map.removeLayer(marker));
    globalMarkers = [];

    data.forEach(place => {
      if (place.coordinates) {
        // 根据状态选择图标颜色
        const iconType = (place.status === 'planned') ? MarkerIcons.planned : MarkerIcons.visited;

        const marker = L.marker(place.coordinates, { icon: iconType }).addTo(map);
        
        // 点击城市标记：进入该地点的行程详情页
        marker.on('click', function() {
          window.location.href = tripUrl(place);
        });

        marker.bindTooltip(place.name, {
            permanent: false, 
            direction: 'top',
            offset: [0, -40] // 调整 Tooltip 位置以适应新图标高度
        });

        globalMarkers.push(marker);
      }
    });
  }

  // [新增] 自动缩放到大洲逻辑
  // 解决问题：根据实际数据点调整视野，确保所有图钉都在视野内
  function autoZoomToContinent(continent) {
    if (continent === "all") {
      map.flyTo([20, 0], 2, { duration: 1.5 });
      return;
    }

    // 1. 筛选该大洲的所有数据（包括 Visited 和 Planned）
    // 这样可以确保地图视野包含你所有感兴趣的点
    const continentData = allTravelData.filter(p => p.continent === continent && p.coordinates);
    
    if (continentData.length > 0) {
      const bounds = L.latLngBounds();
      continentData.forEach(p => bounds.extend(p.coordinates));
      
      if (bounds.isValid()) {
        // 使用 flyToBounds 自动适配边界
        // maxZoom: 5 确保如果只有一个城市，不会缩放得太近，保持大洲的上下文
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5, maxZoom: 5 });
        return;
      }
    }

    // 2. 如果没有数据，回退到硬编码的默认视图
    if (continentViews[continent]) {
      const view = continentViews[continent];
      map.flyTo(view.center, view.zoom, { duration: 1.5 });
    }
  }

  // 5. Render Grid Cards
  function renderGrid(data, sortType) {
    gridContainer.innerHTML = "";
    gridContainer.className = "travel-wrapper"; 

    if (data.length === 0) {
      gridContainer.innerHTML = "<p style='text-align:center; width:100%'>No places found matching your filters.</p>";
      return;
    }

    // 分离数据
    const visitedData = data.filter(p => p.status !== 'planned');
    const plannedData = data.filter(p => p.status === 'planned');

    // --- 排序逻辑 (comparators reused from lib.js) ---

    // 1. Visited 排序
    visitedData.sort(lib.compareVisited(sortType));

    // 2. TODO 排序
    plannedData.sort(lib.comparePlanned(sortType));

    // --- 渲染逻辑 ---

    const createSection = (title, items, isPlanned) => {
      if (items.length === 0) return;

      const header = document.createElement("h3");
      header.className = "travel-section-title";
      header.textContent = title;
      header.style.borderLeftColor = isPlanned ? '#ff9800' : '#00695c';

      const gridDiv = document.createElement("div");
      gridDiv.className = "travel-grid"; 

      items.forEach(place => {
        const card = createCard(place, isPlanned);
        gridDiv.appendChild(card);
      });

      gridContainer.appendChild(header);
      gridContainer.appendChild(gridDiv);
    };

    createSection("Visited Places", visitedData, false);
    createSection("TODO List", plannedData, true);
  }

  // 创建卡片的逻辑
  function createCard(place, isPlanned) {
    const displayName = lib.getDisplayName(place);

    const hasVideo = place.video && place.video.trim() !== "";

    // Overlay content. The video link is a real <a> to an external host, so it
    // must stay a sibling of the card link — nesting <a> inside <a> is invalid
    // HTML; it sits above the stretched link via z-index (see .hover-actions).
    let overlayHtml = "";
    if (isPlanned) {
      overlayHtml += `<span class="hover-note">Coming Soon</span>`;
    }
    if (hasVideo) {
      overlayHtml += `<a href="${lib.escapeHtml(place.video)}" target="_blank" rel="noopener noreferrer" class="action-btn video-btn-overlay">Play Video</a>`;
    }

    const card = document.createElement("div");
    card.className = `place-card ${isPlanned ? 'planned' : ''}`;
    card.setAttribute("data-continent", place.continent || "other");
    card.setAttribute("data-name", place.name);
    card.setAttribute("data-date", place.date);

    // The place name is a genuine link; `.place-card-link::after` stretches its
    // hit area over the whole card, so keyboard focus, middle-click and
    // open-in-new-tab all come for free without a hand-rolled key handler.
    card.innerHTML = `
      <div class="place-image-wrapper">
        <img src="${lib.escapeHtml(place.cover)}" alt="${lib.escapeHtml(displayName)}" loading="lazy">
        <div class="hover-actions">
          ${overlayHtml}
        </div>
      </div>
      <div class="place-info">
        <div class="place-country">${lib.escapeHtml(place.country)}</div>
        <h3 class="place-city">
          <a class="place-card-link" href="${lib.escapeHtml(tripUrl(place))}">${lib.escapeHtml(displayName)}</a>
        </h3>
        <div class="place-date">${lib.escapeHtml(place.date_display)}</div>
      </div>
    `;

    return card;
  }

  // 6. Filtering Logic
  continentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      continentBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const targetContinent = btn.getAttribute("data-continent");
      
      // [修改] 使用自动缩放逻辑
      autoZoomToContinent(targetContinent);
      
      updateView();
    });
  });

  if (visitedCheckbox) visitedCheckbox.addEventListener("change", updateView);
  if (plannedCheckbox) plannedCheckbox.addEventListener("change", updateView);

  // 7. Sorting Logic
  sortSelect.addEventListener("change", function () {
    const sortType = this.value;
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

    renderGrid(filteredData, sortType);
  });

  // 8. Language Logic
  if (langSelect) {
    langSelect.addEventListener("change", function() {
      currentLanguage = this.value;
      addTileLayer(currentLanguage);
    });
  }

  loadTravelData();
});
}

// --- Node export guard (tests only; no-op in the browser) ---
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fetchTravelFiles: fetchTravelFiles,
    tripUrl: tripUrl,
  };
}
