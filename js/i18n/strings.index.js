// ==========================================
// js/i18n/strings.index.js
// UI strings for index.html (section headings, labels, contact form).
// 首页 UI 文案（区块标题、标签、联系表单）。CV 内容本身来自 data/profile/*.json。
// Shape: { "key": { en, zh } }. {name} placeholders must match in both languages.
// ==========================================
(function (dict) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = dict;
  } else if (typeof registerStrings === "function") {
    registerStrings("index", dict);
  }
})({
  // --- Hero / 头部 ---
  "index.hero.greeting": { en: "Hi, I'm", zh: "你好，我是" },
  // en keeps the handle; zh uses the owner-approved Chinese name / 中文界面使用本名
  "index.hero.name": { en: "Hydraallen.", zh: "Hydraallen" },
  "index.hero.typing_alt": { en: "Animated greeting", zh: "动态问候语" },
  "index.social.profile": { en: "{name} profile (opens in new tab)", zh: "{name} 主页（在新标签页打开）" },
  "index.social.email": { en: "Send an email", zh: "发送邮件" },
  "index.noscript": {
    en: "This site needs JavaScript to load its content.",
    zh: "本网站需要启用 JavaScript 才能加载内容。",
  },
  "index.error.load": {
    en: "Could not load profile data. Please refresh the page.",
    zh: "无法加载个人资料，请刷新页面重试。",
  },

  // --- Section headings / 区块标题 ---
  "index.section.about": { en: "About", zh: "关于我" },
  "index.section.experience": { en: "Work Experience", zh: "工作经历" },
  "index.section.research": { en: "Research & Projects", zh: "科研与项目" },
  "index.section.publications": { en: "Publications", zh: "论文发表" },
  "index.section.projects": { en: "Open Source & Side Projects", zh: "开源与个人项目" },
  "index.section.skills": { en: "Skills", zh: "技能" },
  "index.section.education": { en: "Education", zh: "教育背景" },
  "index.section.awards": { en: "Awards & Honors", zh: "荣誉奖项" },
  "index.section.activities": { en: "Student Work", zh: "学生工作" },
  "index.section.contact": { en: "Contact", zh: "联系我" },

  // --- About / 关于 ---
  "index.about.languages_tools": { en: "Languages & Tools", zh: "编程语言与工具" },
  "index.about.languages": { en: "Languages:", zh: "编程语言：" },
  "index.about.tools": { en: "Tools & Technologies:", zh: "工具与技术：" },

  // --- Experience / research / activities cards / 经历卡片 ---
  "index.exp.tech": { en: "Tech stack", zh: "技术栈" },
  "index.exp.remote": { en: "Remote", zh: "远程" },

  // --- Publications / 论文 ---
  "index.pub.co_author": { en: "Co-author", zh: "共同作者" },
  "index.pub.status.preprint": { en: "Preprint", zh: "预印本" },
  "index.pub.status.published": { en: "Published", zh: "已发表" },
  "index.pub.link.arxiv": { en: "arXiv", zh: "arXiv" },
  "index.pub.link.doi": { en: "DOI", zh: "DOI" },

  // --- Projects gallery / 项目卡片 ---
  "index.project.live_site": { en: "Live Site", zh: "在线访问" },
  "index.project.github": { en: "GitHub", zh: "GitHub" },
  "index.project.image_alt": { en: "{name} preview", zh: "{name} 预览图" },

  // --- Skills / 技能 ---
  "index.skills.tabs_label": { en: "Skill categories", zh: "技能分类" },
  "index.skills.tab.ai": { en: "AI & Agents", zh: "AI 与 Agent" },
  "index.skills.tab.backend": { en: "Backend", zh: "后端" },
  "index.skills.tab.frontend": { en: "Frontend", zh: "前端" },
  "index.skills.tab.devops": { en: "DevOps", zh: "DevOps" },
  "index.skills.tab.tools": { en: "Tools", zh: "工具" },

  // --- Education / 教育 ---
  "index.edu.gpa": { en: "GPA: {gpa}", zh: "GPA：{gpa}" },
  "index.edu.minors": { en: "Minors: {list}", zh: "辅修：{list}" },
  "index.edu.coursework": { en: "Relevant Coursework: {list}", zh: "相关课程：{list}" },
  "index.edu.list_sep": { en: ", ", zh: "、" },

  // --- Awards / 奖项 ---
  "index.award.holder": { en: "Copyright holder: {holder}", zh: "著作权人：{holder}" },
  "index.award.kind.award": { en: "Award", zh: "奖项" },
  "index.award.kind.honor": { en: "Honor", zh: "荣誉" },
  "index.award.kind.scholarship": { en: "Scholarship", zh: "奖学金" },
  "index.award.kind.software-copyright": { en: "Software Copyright", zh: "软件著作权" },
  "index.award.kind.certification": { en: "Certification", zh: "证书" },
  "index.award.level.international": { en: "International", zh: "国际级" },
  "index.award.level.national": { en: "National", zh: "国家级" },
  "index.award.level.regional": { en: "Regional", zh: "赛区级" },
  "index.award.level.university": { en: "University", zh: "校级" },
  "index.award.level.college": { en: "College", zh: "院级" },

  // --- Contact form / 联系表单 ---
  "index.contact.intro": {
    en: "Have a question or want to work together? Feel free to leave a message!",
    zh: "有问题或想一起合作？欢迎给我留言！",
  },
  "index.contact.name_label": { en: "Name:", zh: "姓名：" },
  "index.contact.name_placeholder": { en: "Your Name", zh: "你的名字" },
  "index.contact.email_label": { en: "Email:", zh: "邮箱：" },
  "index.contact.email_placeholder": { en: "Your Email", zh: "你的邮箱" },
  "index.contact.message_label": { en: "Message:", zh: "留言：" },
  "index.contact.message_placeholder": { en: "Write your message here...", zh: "在这里写下你的留言……" },
  "index.contact.submit": { en: "Send Message", zh: "发送留言" },
  "index.contact.sending": { en: "Sending...", zh: "发送中……" },
  "index.contact.success": {
    en: "Thanks for your message! I'll get back to you soon.",
    zh: "感谢留言！我会尽快回复你。",
  },
  "index.contact.error": {
    en: "Oops! There was a problem submitting your form.",
    zh: "抱歉！提交表单时出现问题。",
  },
});
