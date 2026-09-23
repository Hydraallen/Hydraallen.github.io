// ==========================================
// js/i18n/strings.travel.js
// UI strings for travel.html + trip.html, plus country / US-state names.
// 旅行页与行程页文案，以及国家（ISO alpha-2）与美国州名。
// Country names: "country.<ISO alpha-2>"; flags come from flagEmoji(code).
// State names: "state.<USPS code>"; English keeps the postal code ("NY") as today.
// ==========================================
(function (dict) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = dict;
  } else if (typeof registerStrings === "function") {
    registerStrings("travel", dict);
  }
})({
  // --- travel.html header / 旅行页头部 ---
  "travel.hero.my": { en: "My", zh: "我的" },
  "travel.hero.title": { en: "Travel Journey", zh: "旅行足迹" },
  "travel.hero.intro_1": { en: "Using image and video to defeat time.", zh: "用影像对抗时间。" },
  "travel.hero.intro_2": { en: "Explore the world through my lens.", zh: "透过我的镜头看世界。" },
  "travel.heading": { en: "Travel Journey", zh: "旅行足迹" },

  // --- Continent tabs / 大洲筛选 ---
  "travel.continent.label": { en: "Filter places by continent", zh: "按大洲筛选地点" },
  "travel.continent.all": { en: "All World", zh: "全世界" },
  "travel.continent.asia": { en: "Asia", zh: "亚洲" },
  "travel.continent.europe": { en: "Europe", zh: "欧洲" },
  "travel.continent.namerica": { en: "North America", zh: "北美洲" },
  "travel.continent.samerica": { en: "South America", zh: "南美洲" },
  "travel.continent.africa": { en: "Africa", zh: "非洲" },
  "travel.continent.oceania": { en: "Oceania", zh: "大洋洲" },
  "travel.continent.antarctica": { en: "Antarctica", zh: "南极洲" },

  // --- Controls / 控制区 ---
  "travel.sort.label": { en: "Sort by", zh: "排序方式" },
  "travel.sort.newest": { en: "Date (Newest)", zh: "日期（最新）" },
  "travel.sort.oldest": { en: "Date (Oldest)", zh: "日期（最早）" },
  "travel.sort.az": { en: "Name (A-Z)", zh: "名称（A–Z）" },
  "travel.sort.za": { en: "Name (Z-A)", zh: "名称（Z–A）" },
  "travel.map_lang.label": { en: "Map Language", zh: "地图语言" },
  "travel.map_lang.en": { en: "English", zh: "英文" },
  "travel.map_lang.cn": { en: "中文 (Chinese)", zh: "中文" },
  "travel.map_lang.local": { en: "Original (Local)", zh: "当地语言" },
  "travel.filter.visited": { en: "Visited", zh: "去过" },
  "travel.filter.planned": { en: "TODO List", zh: "心愿单" },

  // --- Grid / 卡片列表 ---
  "travel.loading": { en: "Loading world map & memories...", zh: "正在加载世界地图与回忆……" },
  "travel.error": { en: "Error loading data.", zh: "数据加载失败。" },
  "travel.empty": { en: "No places found matching your filters.", zh: "没有符合筛选条件的地点。" },
  "travel.section.visited": { en: "Visited Places", zh: "去过的地方" },
  "travel.section.planned": { en: "TODO List", zh: "心愿单" },
  "travel.coming_soon": { en: "Coming Soon", zh: "即将出发" },
  "travel.play_video": { en: "Play Video", zh: "播放视频" },
  "travel.date.planned": { en: "TODO List", zh: "待出发" },

  // --- Lightbox / 灯箱 ---
  "travel.lightbox.prev": { en: "Previous photo", zh: "上一张" },
  "travel.lightbox.next": { en: "Next photo", zh: "下一张" },
  "travel.lightbox.photo_alt": { en: "Travel Photo", zh: "旅行照片" },
  "travel.photo_of": { en: "Photo of {name}", zh: "{name}的照片" },

  // --- trip.html / 行程页 ---
  "trip.hero.trip": { en: "Trip", zh: "旅行" },
  "trip.hero.journal": { en: "Journal", zh: "手记" },
  "trip.hero.intro_1": { en: "One destination, day by day.", zh: "一个目的地，一天一天地走。" },
  "trip.hero.intro_2": { en: "Where I went, what I ate, what I shot.", zh: "去了哪里，吃了什么，拍了什么。" },
  "trip.back": { en: "← All destinations", zh: "← 所有目的地" },
  "trip.watch_video": { en: "▶ Watch Video", zh: "▶ 观看视频" },
  "trip.photos": { en: "Photos", zh: "照片" },
  "trip.day": { en: "Day {n}", zh: "第 {n} 天" },
  "trip.photo_fallback": { en: "Travel photo", zh: "旅行照片" },
  "trip.stop_type.sight": { en: "Sight", zh: "景点" },
  "trip.stop_type.food": { en: "Food", zh: "美食" },
  "trip.stop_type.hotel": { en: "Stay", zh: "住宿" },
  "trip.stop_type.transport": { en: "Transit", zh: "交通" },
  "trip.stop_type.default": { en: "Stop", zh: "站点" },
  "trip.error.no_place": { en: "No destination selected.", zh: "未选择目的地。" },
  "trip.error.load": { en: "Could not load this destination.", zh: "无法加载该目的地。" },
  "trip.error.not_found": { en: 'Could not find the destination "{id}".', zh: "找不到目的地“{id}”。" },
  "trip.error.back": { en: "Back to all destinations", zh: "返回所有目的地" },

  // --- Countries (ISO 3166-1 alpha-2) / 国家 ---
  "country.AE": { en: "UAE", zh: "阿联酋" },
  "country.AQ": { en: "Antarctica", zh: "南极洲" },
  "country.AU": { en: "Australia", zh: "澳大利亚" },
  "country.CN": { en: "China", zh: "中国" },
  "country.CZ": { en: "Czech Republic", zh: "捷克" },
  "country.DE": { en: "Germany", zh: "德国" },
  "country.ES": { en: "Spain", zh: "西班牙" },
  "country.ET": { en: "Ethiopia", zh: "埃塞俄比亚" },
  "country.FR": { en: "France", zh: "法国" },
  "country.GB": { en: "United Kingdom", zh: "英国" },
  "country.IS": { en: "Iceland", zh: "冰岛" },
  "country.JP": { en: "Japan", zh: "日本" },
  "country.KR": { en: "South Korea", zh: "韩国" },
  "country.NO": { en: "Norway", zh: "挪威" },
  "country.NZ": { en: "New Zealand", zh: "新西兰" },
  "country.PE": { en: "Peru", zh: "秘鲁" },
  "country.SG": { en: "Singapore", zh: "新加坡" },
  "country.TR": { en: "Turkey", zh: "土耳其" },
  "country.US": { en: "USA", zh: "美国" },

  // --- US states (USPS codes) / 美国州名 ---
  "state.AK": { en: "AK", zh: "阿拉斯加州" },
  "state.CA": { en: "CA", zh: "加利福尼亚州" },
  "state.DC": { en: "DC", zh: "华盛顿特区" },
  "state.FL": { en: "FL", zh: "佛罗里达州" },
  "state.HI": { en: "HI", zh: "夏威夷州" },
  "state.MA": { en: "MA", zh: "马萨诸塞州" },
  "state.MI": { en: "MI", zh: "密歇根州" },
  "state.NJ": { en: "NJ", zh: "新泽西州" },
  "state.NM": { en: "NM", zh: "新墨西哥州" },
  "state.NV": { en: "NV", zh: "内华达州" },
  "state.NY": { en: "NY", zh: "纽约州" },
  "state.OH": { en: "OH", zh: "俄亥俄州" },
  "state.PA": { en: "PA", zh: "宾夕法尼亚州" },
  "state.WA": { en: "WA", zh: "华盛顿州" },
});
