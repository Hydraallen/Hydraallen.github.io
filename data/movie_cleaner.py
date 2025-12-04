import json
import os
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk
import requests
from io import BytesIO
import webbrowser

SOURCE_FILE = 'movies.json'
BACKUP_FILE = 'backup.json'

class MovieCleanerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Movie Cleaner")
        self.root.geometry("600x900")
        
        self.movies_data = []
        self.backup_data = []
        self.current_year_data = None
        self.current_movies_list = []
        self.current_index = 0
        self.selected_year = None

        self.load_data()
        self.setup_ui()
        self.select_year()

    def load_data(self):
        if os.path.exists(SOURCE_FILE):
            with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
                self.movies_data = json.load(f)
        else:
            messagebox.showerror("Error", f"File not found: {SOURCE_FILE}")
            self.root.destroy()
            return

        if os.path.exists(BACKUP_FILE):
            with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
                self.backup_data = json.load(f)
        else:
            self.backup_data = []

    def save_data(self):
        with open(SOURCE_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.movies_data, f, indent=2, ensure_ascii=False)
        
        with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.backup_data, f, indent=2, ensure_ascii=False)

    def setup_ui(self):
        self.lbl_title = tk.Label(self.root, text="Loading...", font=("Arial", 18, "bold"), wraplength=580)
        self.lbl_title.pack(pady=10)

        self.lbl_date = tk.Label(self.root, text="", font=("Arial", 12), fg="gray")
        self.lbl_date.pack(pady=5)

        self.lbl_fav_status = tk.Label(self.root, text="", font=("Arial", 10), fg="#E91E63")
        self.lbl_fav_status.pack(pady=0)

        self.lbl_image = tk.Label(self.root, bg="#f0f0f0", width=400, height=500)
        self.lbl_image.pack(pady=10)

        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)

        self.btn_imdb = tk.Button(btn_frame, text="View on IMDb", command=self.open_imdb, bg="#E2B616", fg="black", width=15)
        self.btn_imdb.pack(side=tk.LEFT, padx=10)

        self.btn_fav = tk.Button(btn_frame, text="❤️ Set as Favorite", command=self.set_favorite, bg="#FFCDD2", fg="#C2185B", width=15)
        self.btn_fav.pack(side=tk.LEFT, padx=10)

        self.lbl_info = tk.Label(self.root, text="← / → : Keep & Next   |   Enter : Remove & Backup", font=("Arial", 10), fg="blue")
        self.lbl_info.pack(pady=20, side=tk.BOTTOM)

        self.root.bind('<Left>', self.prev_movie)
        self.root.bind('<Right>', self.next_movie)
        self.root.bind('<Return>', self.move_to_backup)

    def select_year(self):
        years = [str(item['year']) for item in self.movies_data]
        
        if not years:
            messagebox.showinfo("Info", "No data found.")
            self.root.destroy()
            return

        select_win = tk.Toplevel(self.root)
        select_win.title("Select Year")
        select_win.geometry("300x400")
        
        tk.Label(select_win, text="Select a year to filter:").pack(pady=10)
        
        listbox = tk.Listbox(select_win)
        listbox.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        for year in years:
            listbox.insert(tk.END, year)

        def on_select():
            selection = listbox.curselection()
            if selection:
                selected_y = int(listbox.get(selection[0]))
                self.selected_year = selected_y
                for item in self.movies_data:
                    if item['year'] == selected_y:
                        self.current_year_data = item
                        self.current_movies_list = item['movies']
                        break
                select_win.destroy()
                self.show_current_movie()
            else:
                messagebox.showwarning("Warning", "Please select a year.")

        tk.Button(select_win, text="Confirm", command=on_select).pack(pady=10)
        
        self.root.wait_window(select_win)
        
        if not self.selected_year:
            self.root.destroy()

    def show_current_movie(self):
        if not self.current_movies_list:
            messagebox.showinfo("Done", f"All movies for {self.selected_year} have been processed!")
            self.root.destroy()
            return

        if self.current_index >= len(self.current_movies_list):
            self.current_index = 0
        elif self.current_index < 0:
            self.current_index = len(self.current_movies_list) - 1

        movie = self.current_movies_list[self.current_index]
        
        self.lbl_title.config(text=f"{movie['title']} ({self.current_index + 1}/{len(self.current_movies_list)})")
        self.lbl_date.config(text=movie['date'])

        current_fav = self.current_year_data.get("favorite", "")
        if current_fav == movie['title']:
            self.lbl_fav_status.config(text="★ Year Favorite ★")
            self.btn_fav.config(text="Is Favorite", state=tk.DISABLED)
        else:
            self.lbl_fav_status.config(text=f"Current Favorite: {current_fav}" if current_fav else "Current Favorite: None")
            self.btn_fav.config(text="❤️ Set as Favorite", state=tk.NORMAL)

        self.load_image_from_url(movie['poster'])

    def set_favorite(self):
        if not self.current_movies_list:
            return
            
        movie_title = self.current_movies_list[self.current_index]['title']
        
        self.current_year_data['favorite'] = movie_title
        
        self.save_data()
        
        self.show_current_movie()
        print(f"Set favorite: {movie_title}")

    def load_image_from_url(self, url):
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            image_data = Image.open(BytesIO(response.content))
            
            base_width = 400
            w_percent = (base_width / float(image_data.size[0]))
            h_size = int((float(image_data.size[1]) * float(w_percent)))
            
            if h_size > 550:
                h_size = 550
                base_width = int((float(image_data.size[0]) * (550 / float(image_data.size[1]))))

            image_data = image_data.resize((base_width, h_size), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(image_data)
            
            self.lbl_image.config(image=photo, text="")
            self.lbl_image.image = photo
        except Exception as e:
            print(f"Image load failed: {e}")
            self.lbl_image.config(image="", text="Image not available", bg="#cccccc")

    def open_imdb(self):
        if self.current_movies_list:
            title = self.current_movies_list[self.current_index]['title']
            url = f"https://www.imdb.com/find?q={title}"
            webbrowser.open(url)

    def next_movie(self, event=None):
        if self.current_movies_list:
            self.current_index += 1
            self.show_current_movie()

    def prev_movie(self, event=None):
        if self.current_movies_list:
            self.current_index -= 1
            self.show_current_movie()

    def move_to_backup(self, event=None):
        if not self.current_movies_list:
            return

        movie_to_move = self.current_movies_list.pop(self.current_index)
        
        backup_year_entry = next((item for item in self.backup_data if item['year'] == self.selected_year), None)
        
        if not backup_year_entry:
            backup_year_entry = {
                "year": self.selected_year,
                "total_count": 0,
                "saved_count": 0,
                "favorite": "",
                "movies": []
            }
            self.backup_data.append(backup_year_entry)
        
        backup_year_entry['movies'].append(movie_to_move)
        
        self.current_year_data['total_count'] = len(self.current_movies_list)
        
        self.save_data()
        print(f"Moved: {movie_to_move['title']}")

        if self.current_index >= len(self.current_movies_list):
            self.current_index = len(self.current_movies_list) - 1
            
        self.show_current_movie()

if __name__ == "__main__":
    root = tk.Tk()
    app = MovieCleanerApp(root)
    root.mainloop()
