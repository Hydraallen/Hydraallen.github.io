"""Movie Cleaner - Tkinter GUI,用于逐年清理电影收藏。

模块内的纯逻辑函数(build_imdb_url / get_title / parse_year_files /
atomic_write_json / title_zh 查询)可独立测试;GUI 回调、setup_ui、load_image
依赖 Tk 与网络,标注为不可自动化测试。

title_zh(中文片名):保存时对缺失 title_zh 的电影自动查询 Wikidata
(优先中文维基 zh-cn 变体标题,即大陆译名),查不到则留空待手动补;
tests/content_movies.test.js 会强制每部电影都有 title_zh。
批量补全:python movie_cleaner.py --fill-zh
"""
import json
import logging
import os
import re
import sys
import tkinter as tk
import webbrowser
from io import BytesIO
from tkinter import messagebox
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import quote

import requests
from PIL import Image, ImageTk

logger = logging.getLogger(__name__)

BACKUP_FILE = "backup.json"
EXCLUDED_FILES = {"index.json", "backup.json"}
# requests 分离超时:(连接超时, 读取超时)
REQUEST_TIMEOUT = (3, 10)

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
ZHWIKI_API = "https://zh.wikipedia.org/w/api.php"
HTTP_HEADERS = {"User-Agent": "HydraallenMovieCleaner/1.0 (https://hydraallen.github.io)"}
SEARCH_LIMIT = 10
YEAR_TOLERANCE = 1
# 简体标签优先;繁体标签仅在可用 opencc 转换时使用
SIMPLIFIED_LABEL_LANGS = ("zh-cn", "zh-hans", "zh-sg", "zh-my")
TRADITIONAL_LABEL_LANGS = ("zh", "zh-tw", "zh-hant", "zh-hk", "zh-mo")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
TAG_RE = re.compile(r"<[^>]+>")
# 维基消歧义后缀,如 "沙丘 (2021年电影)"、"某片（电影）"
DISAMBIG_RE = re.compile(r"\s*[(（][^()（）]*(?:电影|影片|电视电影|film)[^()（）]*[)）]\s*$")

TitleLookup = Callable[[str, int], Optional[str]]


# --------------------------------------------------------------------------- #
# 纯逻辑函数(可自动化测试)
# --------------------------------------------------------------------------- #
def build_imdb_url(title: str) -> str:
    """构造 IMDb 搜索 URL,对查询串做 URL 编码。"""
    return "https://www.imdb.com/find?q=" + quote(title, safe="")


def get_title(movie: Dict[str, Any]) -> str:
    """安全获取电影标题,缺失时返回 'Unknown'。"""
    return movie.get("title", "Unknown")


def parse_year_files(filenames: List[str]) -> Dict[int, str]:
    """从文件名列表中解析出 {年份: 文件名},排除 index/backup 及非年份文件。"""
    result: Dict[int, str] = {}
    for name in filenames:
        if name in EXCLUDED_FILES:
            continue
        if not name.endswith(".json"):
            continue
        stem = name[: -len(".json")]
        if stem.isdigit():
            result[int(stem)] = name
    return result


def atomic_write_json(path: str, data: Any) -> None:
    """原子写 JSON:先写入同目录 .tmp 文件,再 os.replace 覆盖目标。"""
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)


# --------------------------------------------------------------------------- #
# title_zh:Wikidata 查询(纯逻辑,HTTP 经 _http_get,测试中 mock)
# --------------------------------------------------------------------------- #
def _http_get(url: str, params: Dict[str, Any]) -> Any:
    """GET 并解析 JSON;带超时与 User-Agent。网络错误由调用方处理。"""
    res = requests.get(url, params=params, headers=HTTP_HEADERS, timeout=REQUEST_TIMEOUT)
    res.raise_for_status()
    return res.json()


def _to_simplified(text: str) -> Optional[str]:
    """繁转简;未安装 opencc 时返回 None(此时不使用繁体标签)。"""
    try:
        from opencc import OpenCC  # type: ignore[import-not-found]
    except ImportError:
        return None
    return OpenCC("t2s").convert(text)


def strip_disambiguation(title: str) -> str:
    """去掉维基条目的消歧义后缀,如 "沙丘 (2021年电影)" -> "沙丘"。"""
    return DISAMBIG_RE.sub("", title).strip()


def pick_zh_label(labels: Dict[str, str]) -> Optional[str]:
    """按 zh-cn > zh-hans > zh-sg/zh-my > 繁体(需可转换) 选取含汉字的标签。"""
    for lang in SIMPLIFIED_LABEL_LANGS:
        label = labels.get(lang, "").strip()
        if CJK_RE.search(label):
            return label
    for lang in TRADITIONAL_LABEL_LANGS:
        label = labels.get(lang, "").strip()
        if CJK_RE.search(label):
            converted = _to_simplified(label)
            if converted:
                return converted
    return None


def _claim_values(entity: Dict[str, Any], prop: str) -> List[Any]:
    snaks = (c.get("mainsnak", {}) for c in entity.get("claims", {}).get(prop, []))
    return [s["datavalue"]["value"] for s in snaks if "datavalue" in s]


def _release_years(entity: Dict[str, Any]) -> List[int]:
    years = []
    for value in _claim_values(entity, "P577"):
        match = re.match(r"[+-]?(\d{4})", str(value.get("time", "")))
        if match:
            years.append(int(match.group(1)))
    return years


def _best_film_entity(entities: List[Dict[str, Any]], year: int) -> Optional[Dict[str, Any]]:
    """只保留带 IMDb 编号(tt…)的条目,按上映年份与目标年份的差距选最近者。"""
    scored = []
    for rank, ent in enumerate(entities):
        imdb_ids = [v for v in _claim_values(ent, "P345") if str(v).startswith("tt")]
        gaps = [abs(y - year) for y in _release_years(ent)]
        if imdb_ids and gaps and min(gaps) <= YEAR_TOLERANCE:
            scored.append((min(gaps), rank, ent))
    return min(scored, key=lambda s: s[:2])[2] if scored else None


def _zhwiki_mainland_title(page: str) -> Optional[str]:
    """中文维基条目在 zh-cn 变体下的显示标题(应用条目自身的地区词转换)。"""
    data = _http_get(ZHWIKI_API, {"action": "parse", "page": page, "prop": "displaytitle",
                                  "variant": "zh-cn", "redirects": 1, "format": "json"})
    raw = data.get("parse", {}).get("displaytitle")
    title = strip_disambiguation(TAG_RE.sub("", raw)) if raw else ""
    return title if CJK_RE.search(title) else None


def lookup_title_zh(title: str, year: int) -> Optional[str]:
    """按英文片名 + 年份在 Wikidata 查中文片名;任何失败都返回 None(不抛出)。"""
    try:
        hits = _http_get(WIKIDATA_API, {"action": "wbsearchentities", "search": title,
                                        "language": "en", "type": "item",
                                        "limit": SEARCH_LIMIT, "format": "json"})["search"]
        ids = [h["id"] for h in hits]
        if not ids:
            return None
        entities = _http_get(WIKIDATA_API, {"action": "wbgetentities", "ids": "|".join(ids),
                                            "props": "labels|claims|sitelinks",
                                            "sitefilter": "zhwiki", "format": "json"})["entities"]
        best = _best_film_entity([entities[i] for i in ids if i in entities], year)
        if best is None:
            return None
        zhwiki = best.get("sitelinks", {}).get("zhwiki", {}).get("title")
        mainland = _zhwiki_mainland_title(zhwiki) if zhwiki else None
        labels = {k: v.get("value", "") for k, v in best.get("labels", {}).items()}
        return mainland or pick_zh_label(labels)
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError):
        logger.warning("title_zh lookup failed for %r (%s); fill it manually", title, year)
        return None


def fill_missing_title_zh(
    movies: List[Dict[str, Any]], year: int, lookup: Optional[TitleLookup] = None
) -> List[Dict[str, Any]]:
    """返回新列表:缺 title_zh 的电影尝试查询补全;已有的不覆盖,查不到的保持原样。"""
    do_lookup = lookup or lookup_title_zh
    result = []
    for movie in movies:
        if str(movie.get("title_zh", "")).strip():
            result.append(movie)
            continue
        found = do_lookup(get_title(movie), year)
        result.append({**movie, "title_zh": found} if found else movie)
    return result


# --------------------------------------------------------------------------- #
# GUI 应用(GUI 逻辑不可自动化测试)
# --------------------------------------------------------------------------- #
class MovieCleanerApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Movie Cleaner - Multi File Mode")
        self.root.geometry("600x900")

        self.year_files: Dict[int, str] = {}
        self.backup_data: List[Dict[str, Any]] = []

        self.current_data: Optional[Dict[str, Any]] = None
        self.current_movies: List[Dict[str, Any]] = []
        self.current_filename: Optional[str] = None

        self.index = 0
        self.selected_year: Optional[int] = None

        self.load_backup()
        self.scan_files()
        self.setup_ui()
        self.select_year_dialog()

    def load_backup(self) -> None:
        """加载备份文件,失败则回退为空列表。"""
        if os.path.exists(BACKUP_FILE):
            try:
                with open(BACKUP_FILE, "r", encoding="utf-8") as f:
                    self.backup_data = json.load(f)
            except (OSError, json.JSONDecodeError):
                logger.exception("Failed to load backup file %s", BACKUP_FILE)
                self.backup_data = []
        else:
            self.backup_data = []

    def scan_files(self) -> None:
        """扫描当前目录的年份 JSON 文件。"""
        self.year_files = parse_year_files(os.listdir("."))

        if not self.year_files:
            messagebox.showerror("Error", "No year files (e.g., 1996.json) found.")
            self.root.destroy()

    def load_year_data(self, year: int) -> bool:
        """加载某年份数据文件,成功返回 True。"""
        filename = self.year_files[year]
        self.current_filename = filename

        try:
            with open(filename, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    data = data[0]
                self.current_data = data
                self.current_movies = data.get("movies", [])
                self.selected_year = year
                self.index = 0
                return True
        except (OSError, json.JSONDecodeError) as e:
            logger.exception("Failed to load %s", filename)
            messagebox.showerror("Error", f"Failed to load {filename}: {e}")
            return False

    def save_data(self) -> None:
        """原子保存当前年份数据与备份数据(保存前补全缺失的 title_zh)。"""
        if self.current_filename and self.current_data is not None:
            year = self.current_data.get("year") or getattr(self, "selected_year", None)
            if year:
                self.current_movies = fill_missing_title_zh(self.current_movies, int(year))
                self.current_data["movies"] = self.current_movies
            self.current_data["total_count"] = len(self.current_movies)
            self.current_data["saved_count"] = len(self.current_movies)
            atomic_write_json(self.current_filename, self.current_data)

        atomic_write_json(BACKUP_FILE, self.backup_data)

    def setup_ui(self) -> None:
        """构建 Tk 界面(不可自动化测试:依赖 Tk 主循环)。"""
        self.lbl_title = tk.Label(self.root, text="Loading...", font=("Arial", 18, "bold"), wraplength=580)
        self.lbl_title.pack(pady=10)

        self.lbl_date = tk.Label(self.root, text="", font=("Arial", 12), fg="gray")
        self.lbl_date.pack(pady=5)

        self.lbl_fav = tk.Label(self.root, text="", font=("Arial", 10), fg="#E91E63")
        self.lbl_fav.pack(pady=0)

        self.lbl_img = tk.Label(self.root, bg="#f0f0f0", width=400, height=500)
        self.lbl_img.pack(pady=10)

        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)

        self.btn_back = tk.Button(btn_frame, text="🔙 Change Year", command=self.return_to_year_select, bg="#DDDDDD", fg="black", width=15)
        self.btn_back.pack(side=tk.LEFT, padx=5)

        self.btn_imdb = tk.Button(btn_frame, text="View on IMDb", command=self.open_imdb, bg="#E2B616", fg="black", width=15)
        self.btn_imdb.pack(side=tk.LEFT, padx=5)

        self.btn_fav = tk.Button(btn_frame, text="❤️ Set as Favorite", command=self.set_favorite, bg="#FFCDD2", fg="#C2185B", width=15)
        self.btn_fav.pack(side=tk.LEFT, padx=5)

        self.lbl_help = tk.Label(self.root, text="← / → : Keep & Next   |   Enter : Remove & Backup", font=("Arial", 10), fg="blue")
        self.lbl_help.pack(pady=20, side=tk.BOTTOM)

        self.root.bind("<Left>", self.prev_movie)
        self.root.bind("<Right>", self.next_movie)
        self.root.bind("<Return>", self.move_to_backup)

    def select_year_dialog(self) -> None:
        """弹出年份选择对话框(不可自动化测试:依赖 Tk)。"""
        years = sorted(self.year_files.keys(), reverse=True)

        win = tk.Toplevel(self.root)
        win.title("Select Year")
        win.geometry("300x400")

        tk.Label(win, text="Select a year file:").pack(pady=10)

        lb = tk.Listbox(win)
        lb.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        for y in years:
            lb.insert(tk.END, str(y))

        def confirm() -> None:
            sel = lb.curselection()
            if sel:
                y = int(lb.get(sel[0]))
                if self.load_year_data(y):
                    win.destroy()
                    self.render_movie()
            else:
                messagebox.showwarning("Warning", "Please select a year.")

        tk.Button(win, text="Load", command=confirm).pack(pady=10)
        self.root.wait_window(win)

        if not self.selected_year:
            self.root.destroy()

    def return_to_year_select(self) -> None:
        """保存并返回年份选择(GUI 回调,不可自动化测试)。"""
        self.save_data()
        self.select_year_dialog()

    def render_movie(self) -> None:
        """渲染当前电影(GUI 回调,不可自动化测试)。"""
        if not self.current_movies:
            messagebox.showinfo("Finished", f"No more movies in {self.selected_year}.")
            self.select_year_dialog()
            return

        if self.index >= len(self.current_movies):
            self.index = 0
        elif self.index < 0:
            self.index = len(self.current_movies) - 1

        movie = self.current_movies[self.index]

        self.lbl_title.config(text=f"{get_title(movie)} ({self.index + 1}/{len(self.current_movies)})")
        self.lbl_date.config(text=movie.get("date", ""))

        fav_title = self.current_data.get("favorite", "") if self.current_data else ""
        if fav_title == get_title(movie):
            self.lbl_fav.config(text="★ Year Favorite ★")
            self.btn_fav.config(text="Is Favorite", state=tk.DISABLED)
        else:
            self.lbl_fav.config(text=f"Current Favorite: {fav_title}" if fav_title else "No Favorite Set")
            self.btn_fav.config(text="❤️ Set as Favorite", state=tk.NORMAL)

        url = movie.get("poster")
        if url:
            self.load_image(url)
        else:
            self.lbl_img.config(image="", text="No Poster", bg="#cccccc")

    def set_favorite(self) -> None:
        """设置当前电影为年度最爱(GUI 回调)。"""
        if not self.current_movies:
            return
        title = get_title(self.current_movies[self.index])
        if self.current_data is not None:
            self.current_data["favorite"] = title
        self.save_data()
        self.render_movie()

    def load_image(self, url: str) -> None:
        """下载并显示海报(不可自动化测试:依赖网络与 Tk)。"""
        try:
            res = requests.get(url, timeout=REQUEST_TIMEOUT)
            res.raise_for_status()
            img = Image.open(BytesIO(res.content))

            base_w = 400
            ratio = base_w / float(img.size[0])
            h_size = int(float(img.size[1]) * float(ratio))

            if h_size > 550:
                h_size = 550
                base_w = int(float(img.size[0]) * (550 / float(img.size[1])))

            img = img.resize((base_w, h_size), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)

            self.lbl_img.config(image=photo, text="")
            self.lbl_img.image = photo
        except (requests.RequestException, OSError):
            logger.exception("Failed to load image from %s", url)
            self.lbl_img.config(image="", text="Image Error", bg="#cccccc")

    def open_imdb(self) -> None:
        """在浏览器打开 IMDb 搜索(GUI 回调)。"""
        if self.current_movies:
            title = get_title(self.current_movies[self.index])
            webbrowser.open(build_imdb_url(title))

    def next_movie(self, event: Optional["tk.Event"] = None) -> None:
        """下一部(GUI 回调)。"""
        if self.current_movies:
            self.index += 1
            self.render_movie()

    def prev_movie(self, event: Optional["tk.Event"] = None) -> None:
        """上一部(GUI 回调)。"""
        if self.current_movies:
            self.index -= 1
            self.render_movie()

    def move_to_backup(self, event: Optional["tk.Event"] = None) -> None:
        """移除当前电影并存入备份(GUI 回调)。"""
        if not self.current_movies:
            return

        movie = self.current_movies.pop(self.index)

        backup_entry = next((i for i in self.backup_data if i.get("year") == self.selected_year), None)

        if not backup_entry:
            backup_entry = {
                "year": self.selected_year,
                "total_count": 0,
                "saved_count": 0,
                "favorite": "",
                "movies": [],
            }
            self.backup_data.append(backup_entry)

        backup_entry["movies"].append(movie)

        self.save_data()

        if self.index >= len(self.current_movies):
            self.index = len(self.current_movies) - 1

        self.render_movie()


def fill_zh_for_all_years(directory: str = ".") -> List[str]:
    """批量为所有年份文件补 title_zh,返回仍缺失的 "年份|片名" 列表。"""
    missing: List[str] = []
    for year, name in sorted(parse_year_files(os.listdir(directory)).items()):
        path = os.path.join(directory, name)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        movies = fill_missing_title_zh(data.get("movies", []), year)
        if movies != data.get("movies", []):
            atomic_write_json(path, {**data, "movies": movies})
        missing += [f"{year}|{get_title(m)}" for m in movies if not m.get("title_zh")]
    return missing


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    if "--fill-zh" in sys.argv:
        still_missing = fill_zh_for_all_years(".")
        for item in still_missing:
            logger.info("missing title_zh: %s", item)
        sys.exit(1 if still_missing else 0)
    root = tk.Tk()
    app = MovieCleanerApp(root)
    root.mainloop()
