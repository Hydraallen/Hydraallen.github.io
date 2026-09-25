# Changelog

## [2.1.0] - 2026-09-24
### Features
- **Travel status `planned` renamed to `idea`**: travel data now uses `status: visited|idea`. The rename covers all 23 affected `data/travel/*.json` files, `js/lib.js` (`comparePlanned` → `compareIdea`), `js/scripts_travel.js` (`MarkerIcons.idea`, `#filter-idea`, the card class), `travel.html` (`.idea-toggle`), `css/styles_travel.css`, and the dictionary keys `travel.{filter,section,date}.planned` → `.idea`.
- **Country names**: added `country.CH/CL/EG/GR/IT/PT` (Switzerland, Chile, Egypt, Greece, Italy, Portugal) ahead of new travel entries.
- **Travel sync check**: `tools/travel_sync_check.py` compares `data/travel/*.json` with a LifeChecklist snapshot (schema 1). It checks the fields LifeChecklist owns (name, country_code, state, continent, status, dates, and coordinates to 4 dp). It reports mismatches and snapshot places with no public file (exit 1), and it lists public orphans as warnings. The snapshot comes from `--snapshot`, else `LIFECHECKLIST_TRAVEL_SNAPSHOT`, else the gitignored `tools/travel_sources.local.json`. Tests use fictional fixtures under `tests/fixtures/travel/`.
- **Image guardrail**: a content test requires every non-empty travel `cover` and every photo `src` to exist on disk.
- **Docs**: new "Travel sync" section in `CLAUDE.md` covering which repo owns which fields and how to run the check.

### Design Rationale
- This matches the private LifeChecklist status vocabulary (`idea|done`, exported as `idea|visited`), so the planned one-way travel sync maps statuses directly.
- The sync check mirrors `cv_sync_check.py` (same source-resolution order and exit codes) and never needs the private repo. It reads only the exported snapshot, so this public repo holds no private data or paths.
- Field ownership is split so that neither side overwrites the other: travel facts live in LifeChecklist, and media and trip links stay here.
- Only internal identifiers changed. Visible labels ("TODO List" / 心愿单 / 待出发) and marker colours (orange for idea, green for visited) stay the same.

### Notes & Caveats
- The content test now rejects `status: "planned"`, so a stale data file fails `npm test`.
- `country.*` is a dynamic key prefix, so the new country names pass the unused-key check before any place uses them.
- An empty `cover` is allowed, because places the exporter adds start without one. The travel card and the trip hero then render a neutral CSS placeholder block (`lib.hasCover`) instead of an `<img src="">`.
- Orphans (public places missing from the snapshot) never fail the check, because the exporter never deletes files. Delete such files by hand when a place is meant to leave the site.

## [2.0.0] - 2026-09-23
### Features
- **Bilingual site (EN / 简体中文)** across all five pages, including data. `?lang=` persists, `<html lang>` is `en`/`zh-Hans`, titles and meta descriptions are localized, and a language switch in the nav reloads the page while keeping `?place=` and `#hash`. The zh UI uses the owner's Chinese name Hydraallen. English keeps Hydraallen / Hydraallen.
- **CV-synced index**: every index section (about, experience, research & projects, publications, open-source projects, skills, education, awards, student work) is rendered from `data/profile/*.json` by `js/scripts_profile.js`. Social links now come from `profile.json` too. `index.html` holds no CV content.
- **Content**: internships (Tencent, Salesforce, Philo-homes, OpenAGI, Baosight), JOJ3, SAM2 research, two co-authored papers (OSGym, SAM2 / npj Digital Surgery), education (UMich, SJTU, Cornell exchange, TU Berlin winter school), selected awards, and student work. zh text is verbatim from `experience.md`. en text is a 1:1 translation.
- **Travel / trips**: names, notes and titles are LocalizedText. Countries use ISO `country_code` with localized names and flag emoji. Dates are ISO and rendered per locale. Map tiles follow the site language.
- **Movies**: every movie has `title_zh` (Wikidata-backed, `movie_cleaner.py --fill-zh`), and dates are localized.
- **Guardrails**: strict dictionary checks (complete en/zh, matching params, no unused keys, each dynamic key prefix must really be concatenated in JS), static English fallback equals the dictionary, the owner name stays consistent between hero and meta titles, LocalizedText schema, en/zh number parity, glossary with forbidden patterns, a zero-hardcode check on index, `tools/cv_sync_check.py` against `experience.md`, and the privacy guard.
- **Docs**: `CLAUDE.md` rewritten for the new architecture and the CV content-update workflow.
- **Movie title fixes**: 34 corrections applied to `title_zh` (mainland release titles, e.g. 星球大战前传1：幽灵的威胁, 机器人总动员, 超胆侠), and the 2022 English title "Train Bullet" is now "Bullet Train". Owner overrides: Lee (2024) keeps 李·米勒, and the sequel trilogy keeps the official unnumbered titles (星球大战：原力觉醒 / 最后的绝地武士 / 天行者崛起).
- **Privacy guard scope**: now covers every published text file, not only `*.html`/`js/`/`css/`/`data/`. That includes top-level docs and configs, `tools/`, `tests/` (fixtures included) and `.tex`. Only the guard itself and its unit tests are exempt. E-mails on reserved domains (`example.com/.org/.net`, `.invalid`, `.test`) are allowed as fixtures.
- **Nav / anchors**: the language switch now sits directly under the avatar, so it is visible without scrolling at 1280×720 and near the top of the opened mobile menu. Index sections get `scroll-margin-top` (76px mobile, 16px desktop, in `styles_profile.css`), so the fixed 60px mobile bar no longer covers section headings after an anchor jump.
- **Owner review pass**: SAM2 role is now "Research Assistant"; the JOJ3 summary no longer says "the university's"; the OSGym bullet now reads "co-authored … (arXiv preprint arXiv:2511.11672)". The Seattle graffiti-bus photo has a real zh caption (那辆涂鸦巴士). 16 English notes and titles in `data/trips/nyc_2025.json` were rewritten to match the zh more closely and read more naturally.
- **Local preview script**: `manage-service.sh {start|stop|restart|status|help}` serves the repo on `127.0.0.1:$PORT` (default 8000) in the background with a PID file and log under the gitignored `.preview/`. It refuses a double start or a busy port, waits for the server to respond, and stops only the recorded PID.
- **NYC trip facts**: day 4 now takes the 4/5/6 (not the B, which does not stop there) to Brooklyn Bridge–City Hall. Tacos El Bronco is in Sunset Park, Brooklyn, not Queens.

### Design Rationale
- Runtime i18n with one HTML per page keeps the site build-free on GitHub Pages. A full reload on language switch avoids client-side state.
- One source of truth per fact: the owner's display name lives only in the strings (`index.hero.name` + `meta.*`, tied together by a test). The unused `profile.json` `name`/`full_name` were removed. Social links and the public e-mail live only in `profile.json` `social`. The duplicate top-level `email` and the hardcoded HTML icons were removed. Rendering social links from data matches the rest of index, which already needs JS. The bilingual `<noscript>` note covers no-JS visitors, so no second copy of the links is kept.
- Nav labels and the Show More/Less text are literal `t("…")` calls, so the unused-key scan sees them instead of relying on broad exemptions. The dynamic-prefix allowlist shrank from 14 to 9 entries, each documented and verified.
- `experience.md` (zh) is the canonical CV source, and the English LaTeX CV is only a terminology reference, so the two languages cannot drift apart silently.

### Notes & Caveats
- `index.html` now needs an HTTP server locally (`python -m http.server`), like movies and travel.
- Without JavaScript the index shows only the header, section headings, the contact form and the `<noscript>` note. Social icons are also JS-rendered now.
- Fixed: on mobile the nav's `height:100%` + `padding-top` (content-box) pushed the language switch below the viewport, out of reach. `nav#primary-nav` is now `border-box` (in `styles_i18n.css`).
- `experience.md` has "计算机组成件导论" (likely a typo). It is kept verbatim in the site's zh coursework until the source is fixed.
- `cv_sync_check.py` needs `CV_EXPERIENCE_MD` or `tools/cv_sources.local.json`. The real-source pytest is skipped otherwise.

## [1.1.0] - 2026-09-23
### Features
- **Privacy guard**: `tools/privacy_guard.py` + `tests/test_privacy_guard.py` scan published files (`*.html`, `js/`, `css/`, `data/`) for CN/US phone numbers, long ID-like digit runs, non-whitelisted e-mails (only `wangruiallen@gmail.com` allowed), sensitive keywords and PDF links; fail if any PDF is tracked or a `CV/` directory exists.
- **CV removed**: deleted the `CV/` directory (LaTeX sources + PDFs) and the Resume button on `index.html`. `.cv-btn` CSS is kept (still used by "Back to Home").
- **i18n core** (`js/i18n.js`): language resolution (`?lang=` > `localStorage["site.lang"]` > browser languages > English), `t()`/`pick()`, date formatting (`formatMonth[Range]`, `formatDay[Range]`, `parseMovieDate`), `withLangParam()`, `applyTranslations()` for `data-i18n` / `data-i18n-attr` / `data-i18n-title`, FOUC guard (`html.i18n-pending`).
- **Dictionaries**: `js/i18n/strings.{common,index,travel,misc}.js` with the full English/Chinese key skeleton (nav, footer, meta, common buttons, index sections + contact form, travel/trip UI, country and US-state names, movies, 404).
- **Nav**: Research and Awards anchors, localized labels, `?lang=` on links, and an EN / 中文 language switch that keeps `?place=` and `#hash`.
- **Pages**: all five pages load the i18n runtime in `<head>`, expose `hreflang` alternates (except 404), and localize `<title>`, meta description, skip link, hamburger label, "Back to Home" and footer.
- **scripts.js**: Show More/Less toggles and skills tabs work on content rendered after setup (query at click time / event delegation), keep `aria-expanded` / `aria-selected` in sync, and the contact form messages are localized.
- **Guardrail helpers**: `tests/helpers/content_rules.js` (dictionary, HTML wiring, LocalizedText, dates, number parity, glossary rules) with unit tests.

### Design Rationale
- Runtime i18n with one HTML per page keeps the site build-free (GitHub Pages serves the repo root). Switching language is a full reload, so there is no client-side state to keep consistent.
- The static HTML stays English and doubles as the no-JS / crawler fallback; a test checks that it matches the dictionary's `en` values.
- Strings files self-register in the browser and export plain objects in Node, so tests load the real dictionaries without a DOM.
- `og:*` tags stay English: social crawlers do not run JavaScript.

### Notes & Caveats
- Git history still contains the old CV files. History is not rewritten.
- `#research` / `#awards` anchors are added to the nav now; the matching index sections arrive with the profile renderer (Phase 3).
- The "no unused keys" dictionary test is marked `todo` until every page is wired; it must become strict afterwards.
