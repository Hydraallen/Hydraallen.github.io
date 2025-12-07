import json
import os
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk
import requests
from io import BytesIO
import webbrowser

BACKUP_FILE = 'backup.json'

class MovieCleanerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Movie Cleaner - Multi File Mode")
        self.root.geometry("600x900")
        
        self.year_files = {}
        self.backup_data = []
        
        self.current_data = None
        self.current_movies = []
        self.current_filename = None
        
        self.index = 0
        self.selected_year = None

        self.load_backup()
        self.scan_files()
        self.setup_ui()
        self.select_year_dialog()

    def load_backup(self):
        if os.path.exists(BACKUP_FILE):
            try:
                with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
                    self.backup_data = json.load(f)
            except Exception:
                self.backup_data = []
        else:
            self.backup_data = []

    def scan_files(self):
        files = [f for f in os.listdir('.') if f.endswith('.json') and f[:-5].isdigit()]
        self.year_files = {int(f[:-5]): f for f in files}
        
        if not self.year_files:
            messagebox.showerror("Error", "No year files (e.g., 1996.json) found.")
            self.root.destroy()

    def load_year_data(self, year):
        filename = self.year_files[year]
        self.current_filename = filename
        
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    data = data[0]
                self.current_data = data
                self.current_movies = data.get('movies', [])
                self.selected_year = year
                self.index = 0
                return True
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load {filename}: {e}")
            return False

    def save_data(self):
        if self.current_filename and self.current_data:
            self.current_data['total_count'] = len(self.current_movies)
            self.current_data['saved_count'] = len(self.current_movies)
            with open(self.current_filename, 'w', encoding='utf-8') as f:
                json.dump(self.current_data, f, indent=2, ensure_ascii=False)
        
        with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.backup_data, f, indent=2, ensure_ascii=False)

    def setup_ui(self):
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

        self.root.bind('<Left>', self.prev_movie)
        self.root.bind('<Right>', self.next_movie)
        self.root.bind('<Return>', self.move_to_backup)

    def select_year_dialog(self):
        years = sorted(self.year_files.keys(), reverse=True)
        
        win = tk.Toplevel(self.root)
        win.title("Select Year")
        win.geometry("300x400")
        
        tk.Label(win, text="Select a year file:").pack(pady=10)
        
        lb = tk.Listbox(win)
        lb.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        for y in years:
            lb.insert(tk.END, str(y))

        def confirm():
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

    def return_to_year_select(self):
        self.save_data()
        self.select_year_dialog()

    def render_movie(self):
        if not self.current_movies:
            messagebox.showinfo("Finished", f"No more movies in {self.selected_year}.")
            self.select_year_dialog()
            return

        if self.index >= len(self.current_movies):
            self.index = 0
        elif self.index < 0:
            self.index = len(self.current_movies) - 1

        movie = self.current_movies[self.index]
        
        self.lbl_title.config(text=f"{movie.get('title', 'Unknown')} ({self.index + 1}/{len(self.current_movies)})")
        self.lbl_date.config(text=movie.get('date', ''))

        fav_title = self.current_data.get("favorite", "")
        if fav_title == movie.get('title'):
            self.lbl_fav.config(text="★ Year Favorite ★")
            self.btn_fav.config(text="Is Favorite", state=tk.DISABLED)
        else:
            self.lbl_fav.config(text=f"Current Favorite: {fav_title}" if fav_title else "No Favorite Set")
            self.btn_fav.config(text="❤️ Set as Favorite", state=tk.NORMAL)

        url = movie.get('poster')
        if url:
            self.load_image(url)
        else:
            self.lbl_img.config(image="", text="No Poster", bg="#cccccc")

    def set_favorite(self):
        if not self.current_movies: return
        title = self.current_movies[self.index]['title']
        self.current_data['favorite'] = title
        self.save_data()
        self.render_movie()

    def load_image(self, url):
        try:
            res = requests.get(url, timeout=3)
            res.raise_for_status()
            img = Image.open(BytesIO(res.content))
            
            base_w = 400
            ratio = (base_w / float(img.size[0]))
            h_size = int((float(img.size[1]) * float(ratio)))
            
            if h_size > 550:
                h_size = 550
                base_w = int((float(img.size[0]) * (550 / float(img.size[1]))))

            img = img.resize((base_w, h_size), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            
            self.lbl_img.config(image=photo, text="")
            self.lbl_img.image = photo
        except:
            self.lbl_img.config(image="", text="Image Error", bg="#cccccc")

    def open_imdb(self):
        if self.current_movies:
            t = self.current_movies[self.index]['title']
            webbrowser.open(f"https://www.imdb.com/find?q={t}")

    def next_movie(self, event=None):
        if self.current_movies:
            self.index += 1
            self.render_movie()

    def prev_movie(self, event=None):
        if self.current_movies:
            self.index -= 1
            self.render_movie()

    def move_to_backup(self, event=None):
        if not self.current_movies: return

        movie = self.current_movies.pop(self.index)
        
        backup_entry = next((i for i in self.backup_data if i.get('year') == self.selected_year), None)
        
        if not backup_entry:
            backup_entry = {
                "year": self.selected_year,
                "total_count": 0,
                "saved_count": 0,
                "favorite": "",
                "movies": []
            }
            self.backup_data.append(backup_entry)
        
        backup_entry['movies'].append(movie)
        
        self.save_data()
        
        if self.index >= len(self.current_movies):
            self.index = len(self.current_movies) - 1
            
        self.render_movie()

if __name__ == "__main__":
    root = tk.Tk()
    app = MovieCleanerApp(root)
    root.mainloop()
