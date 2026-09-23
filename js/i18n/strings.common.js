// ==========================================
// js/i18n/strings.common.js
// Shared UI strings: nav, language switch, footer, <head> meta, common buttons.
// 全站共享文案：导航、语言切换、页脚、<head> 元信息、通用按钮。
// Shape: { "key": { en, zh } }. {name} placeholders must match in both languages.
// Browser: registers itself (js/i18n.js must be loaded first). Node: exports the dict.
// ==========================================
(function (dict) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = dict;
  } else if (typeof registerStrings === "function") {
    registerStrings("common", dict);
  }
})({
  // --- Navigation / 导航 ---
  "nav.label": { en: "Primary navigation", zh: "主导航" },
  "nav.toggle": { en: "Toggle navigation", zh: "打开或关闭导航菜单" },
  "nav.avatar_alt": { en: "Hydraallen profile picture", zh: "Hydraallen的头像" },
  "nav.about": { en: "About", zh: "关于我" },
  "nav.experience": { en: "Experience", zh: "工作经历" },
  "nav.research": { en: "Research", zh: "科研与项目" },
  "nav.projects": { en: "Projects", zh: "开源项目" },
  "nav.skills": { en: "Skills", zh: "技能" },
  "nav.education": { en: "Education", zh: "教育背景" },
  "nav.awards": { en: "Awards", zh: "荣誉奖项" },
  "nav.movies": { en: "Movies", zh: "观影" },
  "nav.travel": { en: "Travel", zh: "旅行" },
  "nav.contact": { en: "Contact", zh: "联系我" },

  // --- Language switch / 语言切换 ---
  // Language names are shown in their own language on both sides.
  "lang.label": { en: "Language", zh: "语言" },
  "lang.name.en": { en: "English", zh: "English" },
  "lang.name.zh": { en: "中文", zh: "中文" },
  "lang.switch_to": { en: "Switch language to {name}", zh: "将语言切换为{name}" },

  // --- Footer / 页脚: "© {prefix} <year> {suffix}" ---
  "footer.copyright_prefix": { en: "Copyrights", zh: "版权所有" },
  "footer.copyright_suffix": { en: "by Hydraallen. All rights reserved.", zh: "Hydraallen保留所有权利。" },

  // --- Common UI / 通用 ---
  "common.skip": { en: "Skip to Main Content", zh: "跳到主要内容" },
  "common.back_home": { en: "Back to Home", zh: "返回首页" },
  "common.show_more": { en: "Show More", zh: "展开更多" },
  "common.show_less": { en: "Show Less", zh: "收起" },
  "common.present": { en: "Present", zh: "至今" },
  "common.close": { en: "Close", zh: "关闭" },

  // --- <title> / 页面标题 ---
  "meta.title.index": { en: "Home | Hydraallen", zh: "首页 | Hydraallen" },
  "meta.title.movies": { en: "Movies | Hydraallen", zh: "观影 | Hydraallen" },
  "meta.title.travel": { en: "Travel | Hydraallen", zh: "旅行 | Hydraallen" },
  "meta.title.trip": { en: "Trip | Hydraallen", zh: "行程 | Hydraallen" },
  "meta.title.404": { en: "Page Not Found | Hydraallen", zh: "页面未找到 | Hydraallen" },

  // --- <meta name="description"> / 页面描述 ---
  "meta.description.index": {
    en: "Hydraallen is a Master of Science in Information student at the University of Michigan and a passionate programmer working on Agent AI, machine learning, and online judge platforms.",
    zh: "Hydraallen是密歇根大学信息学硕士（MSI）在读学生，热爱编程，专注于 Agent AI、机器学习与在线评测平台。",
  },
  "meta.description.movies": {
    en: "A visual timeline of the movies Hydraallen has watched over the years, organized by year with favorites highlighted.",
    zh: "Hydraallen历年观影的可视化时间线，按年份整理并标出年度最爱。",
  },
  "meta.description.travel": {
    en: "Explore Hydraallen's travel journey through an interactive world map and photo galleries capturing places visited across every continent.",
    zh: "通过交互式世界地图与照片墙，探索Hydraallen走过各大洲的旅行足迹。",
  },
  "meta.description.trip": {
    en: "A day-by-day trip journal from Hydraallen's travels: itinerary, route map and photos for a single destination.",
    zh: "Hydraallen的逐日旅行手记：单个目的地的行程、路线地图与照片。",
  },
  "meta.description.404": {
    en: "The page you were looking for on Hydraallen's site could not be found. Head back to the home page to continue exploring.",
    zh: "在Hydraallen的网站上找不到你要访问的页面。返回首页继续浏览吧。",
  },
});
