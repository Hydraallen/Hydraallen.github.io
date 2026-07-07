"""Movie Cleaner - Tkinter GUI,用于逐年清理电影收藏。

模块内的纯逻辑函数(build_imdb_url / get_title / parse_year_files /
atomic_write_json)可独立测试;GUI 回调、setup_ui、load_image 依赖 Tk 与
网络,标注为不可自动化测试。
"""
import json
import logging
import os
import tkinter as tk
import webbrowser
from io import BytesIO
from tkinter import messagebox
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests
from PIL import Image, ImageTk

logger = logging.getLogger(__name__)

BACKUP_FILE = "backup.json"
EXCLUDED_FILES = {"index.json", "backup.json"}
# requests 分离超时:(连接超时, 读取超时)
REQUEST_TIMEOUT = (3, 10)


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
        """原子保存当前年份数据与备份数据。"""
        if self.current_filename and self.current_data is not None:
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


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    root = tk.Tk()
    app = MovieCleanerApp(root)
    root.mainloop()
