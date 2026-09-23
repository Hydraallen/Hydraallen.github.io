// ==========================================
// js/i18n/strings.misc.js
// UI strings for movies.html and 404.html.
// 观影页与 404 页文案。电影标题是专有名词，不翻译（保持数据原样）。
// ==========================================
(function (dict) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = dict;
  } else if (typeof registerStrings === "function") {
    registerStrings("misc", dict);
  }
})({
  // --- movies.html / 观影页 ---
  "movies.hero.my": { en: "My", zh: "我的" },
  "movies.hero.title": { en: "Movie Journey", zh: "观影之旅" },
  "movies.hero.intro_1": { en: "A visual timeline of the movies I've watched.", zh: "我看过的电影，按时间线排列。" },
  "movies.hero.intro_2": { en: "Click on a year to view the collection.", zh: "点击年份查看当年片单。" },
  "movies.heading": { en: "Watch History", zh: "观影记录" },
  "movies.loading": { en: "Loading movies...", zh: "正在加载电影……" },
  "movies.error": { en: "Error loading movie data.", zh: "电影数据加载失败。" },
  "movies.error_hint": {
    en: "Note: Ensure you are running on a Local Server (http://) not file://",
    zh: "提示：请通过本地服务器（http://）而不是 file:// 打开页面",
  },
  "movies.expand": { en: "Expand movie list for {year}", zh: "展开 {year} 年的电影列表" },
  "movies.watched": { en: "Watched: {n} movies", zh: "已看：{n} 部电影" },
  "movies.best_of": { en: "🏆 Best of {year}", zh: "🏆 {year} 年度最佳" },
  "movies.list_label": { en: "Movies list for {year}", zh: "{year} 年电影列表" },
  "movies.empty": { en: "No movies recorded.", zh: "暂无观影记录。" },

  // --- 404.html / 404 页 ---
  "notfound.title": { en: "Page Not Found", zh: "页面未找到" },
  "notfound.body_1": {
    en: "Oops! It looks like you've ventured into uncharted territory.",
    zh: "哎呀！你好像闯进了一片未知领域。",
  },
  "notfound.body_2": {
    en: "The page you are looking for might have been removed or is temporarily unavailable.",
    zh: "你要找的页面可能已被删除，或暂时无法访问。",
  },
});
