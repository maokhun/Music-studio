"""
Suno AI Bulk Music Downloader & Decryptor
=========================================
Bypasses Suno rate-limits and CloudFront restrictions.
Decrypts Suno Mango DRM (AES-GCM + AES-128-CTR) into 320kbps MP3s.
Supports single songs, bulk URLs, playlists, cover art, and lyrics.
"""

import os
import sys
import re
import json
import time
import base64
import hashlib
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any, List, Callable

# Ensure UTF-8 console output on Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend

# Constants & Headers
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": "https://suno.com/",
    "Origin": "https://suno.com"
}

UUID_REGEX = re.compile(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", re.IGNORECASE)

# Theme Palette (Matches YouTube Automation Suite)
BG_DARK = "#0f1117"
BG_SURFACE = "#171a24"
BG_CARD = "#1c202d"
BORDER_COLOR = "#252938"
TEXT_COLOR = "#e7e9ee"
TEXT_MUTED = "#8b949e"
ACCENT_PURPLE = "#7928ca"
ACCENT_CYAN = "#00dfd8"
ACCENT_GREEN = "#10b981"
ACCENT_RED = "#ef4444"
INPUT_BG = "#13161f"


def sanitize_filename(name: str) -> str:
    """Sanitize filename for Windows filesystem while preserving Unicode characters."""
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = clean.strip().replace("\n", " ").replace("\r", "")
    return clean[:90] if clean else "suno_track"


class SunoDownloaderEngine:
    """Core engine to scrape, fetch Mango keys, decrypt, and transcode Suno tracks."""

    def __init__(self, session: Optional[requests.Session] = None):
        self.session = session or requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

    def extract_song_ids(self, text: str) -> List[str]:
        """Extract all unique Suno song UUIDs from a text blob, URL, or playlist."""
        ids = []
        # Check if text has playlist links
        playlist_matches = re.findall(r'/playlist/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', text, re.IGNORECASE)
        for p_id in playlist_matches:
            playlist_songs = self.extract_playlist_songs(p_id)
            ids.extend(playlist_songs)

        # Extract regular song UUIDs
        all_uuids = UUID_REGEX.findall(text)
        for u in all_uuids:
            u_clean = u.lower()
            if u_clean not in ids and u_clean not in [p.lower() for p in playlist_matches]:
                ids.append(u_clean)

        return ids

    def extract_playlist_songs(self, playlist_id: str) -> List[str]:
        """Fetch all song IDs from a Suno playlist."""
        api_url = f"https://studio-api.prod.suno.com/api/playlist/{playlist_id}/?page=1"
        try:
            r = self.session.get(api_url, timeout=10)
            if r.status_code == 200:
                data = r.json()
                clips = data.get("playlist_clips", [])
                extracted = [c.get("clip", {}).get("id") for c in clips if c.get("clip", {}).get("id")]
                if extracted:
                    return extracted
        except Exception:
            pass

        # Fallback scraping
        try:
            web_url = f"https://suno.com/playlist/{playlist_id}"
            r = self.session.get(web_url, timeout=10)
            if r.status_code == 200:
                all_found = set(UUID_REGEX.findall(r.text))
                all_found.discard(playlist_id)
                return list(all_found)
        except Exception:
            pass
        return []

    def fetch_song_metadata(self, song_id: str) -> Dict[str, Any]:
        """Scrape metadata including Title, Cover Art, and Prompt/Lyrics from Suno page."""
        url = f"https://suno.com/song/{song_id}"
        info = {
            "id": song_id,
            "title": f"Suno_{song_id[:8]}",
            "image_url": f"https://cdn2.suno.ai/image_large_{song_id}.jpeg",
            "prompt": "",
            "tags": ""
        }

        try:
            r = self.session.get(url, timeout=15)
            if r.status_code == 200:
                html = r.text
                # Title
                t_match = re.search(r'<meta property="og:title" content="([^"]+)"', html) or re.search(r'<meta name="twitter:title" content="([^"]+)"', html)
                if t_match:
                    t = t_match.group(1).replace(" | Suno", "").replace(" on Suno", "").strip()
                    if t:
                        info["title"] = t
                # Image
                img_match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
                if img_match:
                    info["image_url"] = img_match.group(1)
                # Tags
                tags_match = re.search(r'\"tags\"\s*:\s*\"([^\"]+)\"', html)
                if tags_match:
                    info["tags"] = tags_match.group(1)
                # Prompt / Lyrics
                p_match = re.search(r'\"prompt\"\s*:\s*\"([^\"]+)\"', html)
                if p_match:
                    try:
                        raw_p = json.loads(f'"{p_match.group(1)}"')
                        info["prompt"] = raw_p
                    except Exception:
                        info["prompt"] = p_match.group(1)
        except Exception:
            pass

        return info

    def decrypt_and_transcode(
        self,
        song_id: str,
        output_dir: str,
        save_cover: bool = False,
        save_lyrics: bool = False,
        log_callback: Optional[Callable[[str], None]] = None
    ) -> str:
        """Fetch Mango license, download CloudFront stream, decrypt AES-128-CTR, and export MP3."""
        os.makedirs(output_dir, exist_ok=True)

        if log_callback:
            log_callback(f"[*] Fetching metadata for {song_id}...")

        meta = self.fetch_song_metadata(song_id)
        raw_clean_title = sanitize_filename(meta["title"])

        # Track downloaded clip IDs to properly distinguish Version 1 and Version 2
        manifest_path = os.path.join(output_dir, ".downloaded_clips.json")
        manifest = {}
        if os.path.exists(manifest_path):
            try:
                with open(manifest_path, "r", encoding="utf-8") as mf:
                    manifest = json.load(mf)
            except Exception:
                manifest = {}

        # If this exact clip ID was already downloaded, skip it
        if song_id in manifest:
            existing_file = os.path.join(output_dir, manifest[song_id])
            if os.path.exists(existing_file) and os.path.getsize(existing_file) > 100000:
                if log_callback:
                    log_callback(f"[SKIPPED] Already exists: {manifest[song_id]}")
                return existing_file

        # Resolve unique filename for variations (V1, V2, V3...)
        claimed_files = set(manifest.values())
        clean_title = raw_clean_title
        mp3_name = f"{clean_title}.mp3"
        final_mp3 = os.path.join(output_dir, mp3_name)

        version_num = 2
        while (mp3_name in claimed_files and manifest.get(song_id) != mp3_name) or (os.path.exists(final_mp3) and manifest.get(song_id) != mp3_name):
            clean_title = f"{raw_clean_title}_V{version_num}"
            mp3_name = f"{clean_title}.mp3"
            final_mp3 = os.path.join(output_dir, mp3_name)
            version_num += 1

        if os.path.exists(final_mp3) and manifest.get(song_id) == mp3_name and os.path.getsize(final_mp3) > 100000:
            if log_callback:
                log_callback(f"[SKIPPED] Already exists: {mp3_name}")
            return final_mp3

        # 1. Fetch Mango Rights Keys
        if log_callback:
            log_callback(f"[*] Requesting Mango DRM license keys...")

        rights_url = "https://studio-api.prod.suno.com/api/mango/rights"
        payload = {"content_params": {"content_id": song_id, "content_type": "clip"}}
        r_res = self.session.post(rights_url, json=payload, timeout=15)
        if r_res.status_code != 200:
            raise Exception(f"Mango license request failed (HTTP {r_res.status_code}): {r_res.text}")

        rights_data = r_res.json()
        glt = rights_data["glt"]
        wrapped_key = base64.b64decode(rights_data["key"])
        wrapped_iv = base64.b64decode(rights_data["iv"])

        # 2. Unwrap Key & IV with AES-GCM
        user_key = hashlib.sha256(glt.encode("utf-8")).digest()
        aes_gcm = AESGCM(user_key)
        aad = song_id.encode("utf-8")
        content_key = aes_gcm.decrypt(wrapped_key[:12], wrapped_key[12:], aad)
        content_iv = aes_gcm.decrypt(wrapped_iv[:12], wrapped_iv[12:], aad)

        # 3. Download encrypted audio stream
        if log_callback:
            log_callback(f"[*] Downloading audio stream from CloudFront...")

        stream_url = f"https://d2lwuy8qc234o3.cloudfront.net/1/clip/{song_id}.m4a"
        s_res = self.session.get(stream_url, timeout=30)
        if s_res.status_code != 200:
            raise Exception(f"Audio stream download failed (HTTP {s_res.status_code})")
        encrypted_data = s_res.content

        # 4. Decrypt audio with AES-128-CTR
        if log_callback:
            log_callback(f"[*] Decrypting audio stream ({len(encrypted_data)} bytes)...")

        cipher = Cipher(algorithms.AES(content_key), modes.CTR(content_iv), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted_audio = decryptor.update(encrypted_data) + decryptor.finalize()

        temp_m4a = os.path.join(output_dir, f"temp_{song_id}.m4a")
        with open(temp_m4a, "wb") as f:
            f.write(decrypted_audio)

        # 5. Convert to 320kbps MP3 via FFmpeg
        if log_callback:
            log_callback(f"[*] Transcoding to 320kbps MP3: {clean_title}.mp3...")

        cmd = [
            "ffmpeg", "-y",
            "-i", temp_m4a,
            "-vn",
            "-c:a", "libmp3lame",
            "-b:a", "320k",
            final_mp3
        ]
        res = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace")
        if os.path.exists(temp_m4a):
            try:
                os.remove(temp_m4a)
            except Exception:
                pass

        if res.returncode != 0:
            raise Exception(f"FFmpeg transcode error: {res.stderr[:200]}")

        # 6. Save Cover Image
        if save_cover and meta.get("image_url"):
            try:
                cover_path = os.path.join(output_dir, f"{clean_title}.jpg")
                img_res = self.session.get(meta["image_url"], timeout=10)
                if img_res.status_code == 200:
                    with open(cover_path, "wb") as f:
                        f.write(img_res.content)
            except Exception:
                pass

        # 7. Save Lyrics / Prompt
        if save_lyrics and meta.get("prompt"):
            try:
                lyric_path = os.path.join(output_dir, f"{clean_title}_lyrics.txt")
                with open(lyric_path, "w", encoding="utf-8") as f:
                    f.write(f"Title: {meta['title']}\nTags: {meta['tags']}\n\n[PROMPT / LYRICS]\n{meta['prompt']}\n")
            except Exception:
                pass

        # Record clip into manifest
        manifest[song_id] = os.path.basename(final_mp3)
        try:
            with open(manifest_path, "w", encoding="utf-8") as mf:
                json.dump(manifest, mf, indent=2)
        except Exception:
            pass

        if log_callback:
            log_callback(f"[SUCCESS] Saved: {os.path.basename(final_mp3)} (320 kbps)")

        return final_mp3


class SunoBulkDownloaderGUI:
    """Modern Desktop GUI application for Suno Bulk Downloading."""

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Suno AI Bulk Downloader & Decryptor | Tokyo Phonk Automation")
        self.root.geometry("860x680")
        self.root.minsize(780, 560)
        self.root.configure(bg=BG_DARK)

        self.engine = SunoDownloaderEngine()
        self.is_downloading = False
        self.should_cancel = False

        # Variables
        default_dir = os.path.abspath(r"D:\SUNO\Downloads")
        if not os.path.exists(r"D:\SUNO"):
            default_dir = os.path.abspath("./suno_downloads")
        self.output_dir_var = tk.StringVar(value=default_dir)
        self.save_cover_var = tk.BooleanVar(value=True)
        self.save_lyrics_var = tk.BooleanVar(value=True)
        self.auto_open_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Ready. Paste Suno URLs or Playlist links above.")

        self._build_ui()

    def _build_ui(self):
        # Header Banner
        header = tk.Frame(self.root, bg=BG_SURFACE, pady=12, padx=20)
        header.pack(fill="x")

        title_lbl = tk.Label(
            header,
            text="🎵 SUNO AI BULK DOWNLOADER & DECRYPTOR",
            font=("Segoe UI", 14, "bold"),
            bg=BG_SURFACE,
            fg=ACCENT_CYAN
        )
        title_lbl.pack(anchor="w")

        sub_lbl = tk.Label(
            header,
            text="Bypasses Suno download limits • Mango DRM Decryption • High-Fidelity 320kbps MP3s",
            font=("Segoe UI", 9),
            bg=BG_SURFACE,
            fg=TEXT_MUTED
        )
        sub_lbl.pack(anchor="w", pady=(2, 0))

        # Main Container
        main_frame = tk.Frame(self.root, bg=BG_DARK, padx=18, pady=12)
        main_frame.pack(fill="both", expand=True)

        # Output Folder Selection Card
        folder_card = tk.Frame(main_frame, bg=BG_CARD, padx=12, pady=10, highlightbackground=BORDER_COLOR, highlightthickness=1)
        folder_card.pack(fill="x", pady=(0, 10))

        f_lbl = tk.Label(folder_card, text="Save Destination Folder:", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=TEXT_COLOR)
        f_lbl.pack(anchor="w")

        f_row = tk.Frame(folder_card, bg=BG_CARD)
        f_row.pack(fill="x", pady=(4, 0))

        f_entry = tk.Entry(f_row, textvariable=self.output_dir_var, font=("Segoe UI", 10), bg=INPUT_BG, fg=TEXT_COLOR, insertbackground=TEXT_COLOR, relief="flat", highlightbackground=BORDER_COLOR, highlightthickness=1)
        f_entry.pack(side="left", fill="x", expand=True, ipady=4, padx=(0, 8))

        btn_browse = tk.Button(f_row, text="📁 Browse...", font=("Segoe UI", 9, "bold"), bg="#252938", fg=TEXT_COLOR, relief="flat", cursor="hand2", padx=10, command=self._browse_folder)
        btn_browse.pack(side="left", padx=(0, 6))

        btn_open = tk.Button(f_row, text="📂 Open Folder", font=("Segoe UI", 9), bg="#252938", fg=TEXT_MUTED, relief="flat", cursor="hand2", padx=8, command=self._open_folder)
        btn_open.pack(side="left")

        # Links Input Card
        input_card = tk.Frame(main_frame, bg=BG_CARD, padx=12, pady=10, highlightbackground=BORDER_COLOR, highlightthickness=1)
        input_card.pack(fill="both", expand=True, pady=(0, 10))

        top_input_bar = tk.Frame(input_card, bg=BG_CARD)
        top_input_bar.pack(fill="x", pady=(0, 6))

        input_title = tk.Label(top_input_bar, text="Enter Suno Song or Playlist Links (1 per line or paste batch):", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=TEXT_COLOR)
        input_title.pack(side="left")

        btn_paste = tk.Button(top_input_bar, text="📋 Paste Clipboard", font=("Segoe UI", 8, "bold"), bg="#252938", fg=ACCENT_CYAN, relief="flat", cursor="hand2", padx=8, command=self._paste_clipboard)
        btn_paste.pack(side="right", padx=(4, 0))

        btn_clear = tk.Button(top_input_bar, text="🧹 Clear", font=("Segoe UI", 8), bg="#252938", fg=TEXT_MUTED, relief="flat", cursor="hand2", padx=8, command=self._clear_input)
        btn_clear.pack(side="right")

        # Text Area for Links
        self.txt_links = tk.Text(
            input_card,
            height=6,
            font=("Consolas", 10),
            bg=INPUT_BG,
            fg=TEXT_COLOR,
            insertbackground=TEXT_COLOR,
            relief="flat",
            highlightbackground=BORDER_COLOR,
            highlightthickness=1,
            wrap="word"
        )
        self.txt_links.pack(fill="both", expand=True)

        # Context Menu & Explicit Keyboard Bindings for Bulletproof Paste
        self._ctx_menu = tk.Menu(self.root, tearoff=0, bg="#1a1d27", fg="#ffffff", activebackground="#7928ca", activeforeground="#ffffff")
        self._ctx_menu.add_command(label="📋 Paste Clipboard", command=self._paste_clipboard)
        self._ctx_menu.add_command(label="✂️ Cut", command=lambda: self.txt_links.event_generate("<<Cut>>"))
        self._ctx_menu.add_command(label="📄 Copy", command=lambda: self.txt_links.event_generate("<<Copy>>"))
        self._ctx_menu.add_separator()
        self._ctx_menu.add_command(label="Select All", command=lambda: self.txt_links.tag_add("sel", "1.0", "end"))
        self._ctx_menu.add_command(label="🧹 Clear", command=self._clear_input)

        self.txt_links.bind("<Button-3>", lambda e: self._ctx_menu.tk_popup(e.x_root, e.y_root))
        self.txt_links.bind("<Control-v>", lambda e: (self._paste_clipboard(), "break")[1])
        self.txt_links.bind("<Control-V>", lambda e: (self._paste_clipboard(), "break")[1])
        self.txt_links.bind("<Shift-Insert>", lambda e: (self._paste_clipboard(), "break")[1])

        # Options Checkboxes
        opt_bar = tk.Frame(input_card, bg=BG_CARD)
        opt_bar.pack(fill="x", pady=(6, 0))

        chk_cover = tk.Checkbutton(opt_bar, text="Save Cover (.jpg)", variable=self.save_cover_var, font=("Segoe UI", 9), bg=BG_CARD, fg=TEXT_COLOR, selectcolor=INPUT_BG, activebackground=BG_CARD)
        chk_cover.pack(side="left", padx=(0, 12))

        chk_lyrics = tk.Checkbutton(opt_bar, text="Save Lyrics (.txt)", variable=self.save_lyrics_var, font=("Segoe UI", 9), bg=BG_CARD, fg=TEXT_COLOR, selectcolor=INPUT_BG, activebackground=BG_CARD)
        chk_lyrics.pack(side="left", padx=(0, 12))

        chk_auto_open = tk.Checkbutton(opt_bar, text="Auto-open folder when finished", variable=self.auto_open_var, font=("Segoe UI", 9), bg=BG_CARD, fg=ACCENT_CYAN, selectcolor=INPUT_BG, activebackground=BG_CARD)
        chk_auto_open.pack(side="left")

        # Action Buttons Bar
        act_bar = tk.Frame(main_frame, bg=BG_DARK)
        act_bar.pack(fill="x", pady=(0, 10))

        self.btn_download = tk.Button(
            act_bar,
            text="🚀 START BULK DOWNLOAD",
            font=("Segoe UI", 11, "bold"),
            bg=ACCENT_PURPLE,
            fg="#ffffff",
            activebackground="#9d4edd",
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            pady=8,
            command=self._start_download_thread
        )
        self.btn_download.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.btn_open_act = tk.Button(
            act_bar,
            text="📂 Open Downloads Folder",
            font=("Segoe UI", 10, "bold"),
            bg="#252938",
            fg=ACCENT_CYAN,
            activebackground=ACCENT_CYAN,
            activeforeground="#000000",
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
            command=self._open_folder
        )
        self.btn_open_act.pack(side="left", padx=(0, 8))

        self.btn_cancel = tk.Button(
            act_bar,
            text="⏹️ Cancel",
            font=("Segoe UI", 10, "bold"),
            bg="#252938",
            fg=ACCENT_RED,
            relief="flat",
            cursor="hand2",
            padx=14,
            state="disabled",
            command=self._cancel_download
        )
        self.btn_cancel.pack(side="right")

        # Progress Bar & Status
        prog_frame = tk.Frame(main_frame, bg=BG_CARD, padx=12, pady=8, highlightbackground=BORDER_COLOR, highlightthickness=1)
        prog_frame.pack(fill="x", pady=(0, 10))

        self.lbl_status = tk.Label(prog_frame, textvariable=self.status_var, font=("Segoe UI", 9), bg=BG_CARD, fg=TEXT_COLOR, anchor="w")
        self.lbl_status.pack(fill="x", pady=(0, 4))

        self.progress_bar = ttk.Progressbar(prog_frame, mode="determinate")
        self.progress_bar.pack(fill="x")

        # Console / Activity Log
        log_card = tk.Frame(main_frame, bg=BG_CARD, padx=12, pady=8, highlightbackground=BORDER_COLOR, highlightthickness=1)
        log_card.pack(fill="both", expand=True)

        log_lbl = tk.Label(log_card, text="Activity Log Console:", font=("Segoe UI", 8, "bold"), bg=BG_CARD, fg=TEXT_MUTED)
        log_lbl.pack(anchor="w", pady=(0, 4))

        self.txt_log = tk.Text(
            log_card,
            height=6,
            font=("Consolas", 9),
            bg=INPUT_BG,
            fg="#a6accd",
            relief="flat",
            highlightbackground=BORDER_COLOR,
            highlightthickness=1,
            state="disabled"
        )
        self.txt_log.pack(fill="both", expand=True)

    def log(self, message: str):
        """Append log message to the log text widget safely from any thread."""
        def _update():
            self.txt_log.config(state="normal")
            self.txt_log.insert("end", message + "\n")
            self.txt_log.see("end")
            self.txt_log.config(state="disabled")
        self.root.after(0, _update)

    def _browse_folder(self):
        folder = filedialog.askdirectory(initialdir=self.output_dir_var.get())
        if folder:
            self.output_dir_var.set(folder)

    def _open_folder(self):
        folder = self.output_dir_var.get()
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
        os.startfile(folder)

    def _get_system_clipboard_text(self):
        # 1. Try Windows Win32 API directly (CF_UNICODETEXT) - 100% reliable for Chrome / Web links
        try:
            import ctypes
            CF_UNICODETEXT = 13
            u32 = ctypes.windll.user32
            k32 = ctypes.windll.kernel32
            if u32.OpenClipboard(None):
                try:
                    h = u32.GetClipboardData(CF_UNICODETEXT)
                    if h:
                        p = k32.GlobalLock(h)
                        if p:
                            try:
                                text = ctypes.c_wchar_p(p).value
                                if text:
                                    return text.strip()
                            finally:
                                k32.GlobalUnlock(h)
                finally:
                    u32.CloseClipboard()
        except Exception:
            pass

        # 2. Try Tkinter default clipboard
        try:
            val = self.root.clipboard_get().strip()
            if val:
                return val
        except Exception:
            pass

        # 3. Fallback to PowerShell Get-Clipboard
        try:
            res = subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard"], capture_output=True, text=True, timeout=2)
            if res.stdout and res.stdout.strip():
                return res.stdout.strip()
        except Exception:
            pass

        return ""

    def _paste_clipboard(self):
        content = self._get_system_clipboard_text()
        if content:
            current = self.txt_links.get("1.0", "end").strip()
            new_text = f"{current}\n{content}".strip() if current else content
            self.txt_links.delete("1.0", "end")
            self.txt_links.insert("1.0", new_text)
            lines_count = len([line for line in content.splitlines() if line.strip()])
            self.log(f"[INFO] 📋 Pasted {lines_count} link(s) from clipboard.")
            self.status_var.set(f"Pasted {lines_count} link(s) from clipboard. Ready to download.")
        else:
            self.log("[WARN] ⚠️ Clipboard is empty or contains non-text content.")
            self.status_var.set("Clipboard is empty or contains non-text data.")

    def _clear_input(self):
        self.txt_links.delete("1.0", "end")

    def _cancel_download(self):
        if self.is_downloading:
            self.should_cancel = True
            self.status_var.set("Cancelling after current task finishes...")
            self.log("[!] User requested cancellation.")

    def _start_download_thread(self):
        raw_text = self.txt_links.get("1.0", "end").strip()
        if not raw_text:
            messagebox.showwarning("No Links", "Please paste at least one Suno song or playlist link!")
            return

        self.is_downloading = True
        self.should_cancel = False
        self.btn_download.config(state="disabled", bg="#3d1d63")
        self.btn_cancel.config(state="normal")
        self.progress_bar["value"] = 0

        threading.Thread(target=self._download_worker, args=(raw_text,), daemon=True).start()

    def _download_worker(self, raw_text: str):
        output_dir = self.output_dir_var.get().strip()
        save_cover = self.save_cover_var.get()
        save_lyrics = self.save_lyrics_var.get()

        self.log(f"==================================================")
        self.log(f"[*] Parsing Suno links and playlists...")
        song_ids = self.engine.extract_song_ids(raw_text)

        if not song_ids:
            self.log("[-] No valid Suno song IDs found in the input.")
            self.root.after(0, lambda: messagebox.showerror("Invalid Input", "Could not find any Suno song UUIDs or playlists."))
            self._finish_download(0, 0)
            return

        total = len(song_ids)
        self.log(f"[+] Found {total} Suno song(s) to process!")
        success_count = 0

        for idx, s_id in enumerate(song_ids, 1):
            if self.should_cancel:
                self.log("[!] Download queue cancelled by user.")
                break

            pct = int(((idx - 1) / total) * 100)
            self.root.after(0, lambda v=pct, i=idx, t=total: self._update_progress(v, f"Processing track {i}/{t}..."))

            self.log(f"\n--- [{idx}/{total}] Song ID: {s_id} ---")
            try:
                self.engine.decrypt_and_transcode(
                    song_id=s_id,
                    output_dir=output_dir,
                    save_cover=save_cover,
                    save_lyrics=save_lyrics,
                    log_callback=self.log
                )
                success_count += 1
            except Exception as e:
                self.log(f"[ERROR] Failed to download {s_id}: {str(e)}")

            # Gentle delay to ensure clean connection
            time.sleep(1.0)

        self._finish_download(success_count, total)

    def _update_progress(self, percent: int, status_text: str):
        self.progress_bar["value"] = percent
        self.status_var.set(status_text)

    def _finish_download(self, success: int, total: int):
        def _update():
            self.is_downloading = False
            self.btn_download.config(state="normal", bg=ACCENT_PURPLE)
            self.btn_cancel.config(state="disabled")
            self.progress_bar["value"] = 100
            final_msg = f"Finished! {success}/{total} songs downloaded to: {self.output_dir_var.get()}"
            self.status_var.set(final_msg)
            self.log(f"\n==================================================")
            self.log(f"[*] {final_msg}\n")
            
            # Highlight Open Folder button with high visibility
            self.btn_open_act.config(bg=ACCENT_CYAN, fg="#000000", font=("Segoe UI", 10, "bold"))
            
            if success > 0:
                if self.auto_open_var.get():
                    self._open_folder()
                else:
                    ans = messagebox.askyesno("Download Complete! 🎉", f"Successfully downloaded {success} of {total} songs!\n\nLocation:\n{self.output_dir_var.get()}\n\nWould you like to open the Downloads folder now?")
                    if ans:
                        self._open_folder()

        self.root.after(0, _update)


def main():
    # If URLs passed via CLI arguments
    if len(sys.argv) > 1:
        engine = SunoDownloaderEngine()
        arg_text = " ".join(sys.argv[1:])
        out_dir = r"D:\SUNO\Downloads" if os.path.exists(r"D:\SUNO") else "./suno_downloads"
        song_ids = engine.extract_song_ids(arg_text)
        print(f"[*] CLI Mode: Found {len(song_ids)} songs to download.")
        for s_id in song_ids:
            try:
                engine.decrypt_and_transcode(s_id, output_dir=out_dir, log_callback=print)
            except Exception as e:
                print(f"[!] Error: {e}")
        return

    # Launch GUI
    root = tk.Tk()
    app = SunoBulkDownloaderGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
