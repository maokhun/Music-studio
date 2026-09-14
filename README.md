# 🎵 CamMusic AI - Khmer & Global AI Music Studio Suite

An advanced, full-stack AI Music Studio and Production Suite for generating, remastering, and exporting studio-grade music with synchronized lyrics, karaoke subtitles, and unlimited Suno bypass tools.

---

## 🌟 Key Features

### 1. 🎛️ AI Audio Auto-Remastering Engine (24-bit Lossless Studio WAV)
- **Multi-Band DSP Mastering Chain**:
  - **Bass Punch EQ (80Hz Shelf)**: Boosts low-end depth and kick drum impact without muddying the mix.
  - **Mid-Mud Cleanup (380Hz Notch)**: Eliminates boxiness and frequency clashing.
  - **Vocal Presence (3.4kHz Peaking)**: Crystal clear vocal clarity and harmonic excitation.
  - **Air Shimmer (11kHz Shelf)**: High-end studio polish and spatial air.
  - **Dynamic Glue Compressor & True-Peak Limiter**: Normalized to **-14 LUFS (Spotify / Apple Music / DistroKid Ready)**.
  - **24-bit PCM WAV Encoder**: Lossless studio-grade output.

### 2. ⚡ Suno Importer & Unlimited Bypass Downloader
- **Auto-Fetch Real Song Title & Lyrics**: Automatically retrieves song titles, real lyrics, duration, and style tags directly from Suno.
- **Direct Multi-Link Batch Downloader**: Paste multiple Suno URLs to import and unlock them in bulk.
- **High-Bitrate MP3 (320kbps)**, **24-bit Mastered WAV**, and **Full HD MP4 Video** direct downloads bypassing Suno quota limits.

### 3. 🎬 Subtitle & Karaoke Timing Studio (SRT / LRC)
- **Musical Structure Timing Engine**: Automatically computes timestamps according to song tempo, intro (8-12s), verse pacing (2.5-5.5s), chorus, and outro fade.
- **Timed Lines Editor**: Micro-adjust start/end timestamps (+/- 0.5s) with live audio scrubbing.
- **Export Ready**: 
  - 📄 `.srt` format for YouTube Video MV captions.
  - 🎵 `.lrc` format for synchronized Karaoke lyrics.

### 4. 🎨 Compact Pro Studio UI & Batch Actions
- Ultra-slim track feed layout (~60px profile).
- Multi-select checkboxes with Batch MP3, Batch WAV, and Batch MP4 actions.
- Inline title renaming (click-to-edit with check/cancel).
- Live EQ Visualizer and real-time audio player.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+ (optional for background automation)

### Installation
```bash
# Clone the repository
git clone https://github.com/maokhun/AI_Music_Studio.git

# Navigate into project directory
cd AI_Music_Studio

# Install dependencies
npm install

# Build production bundle
npm run build

# Start the Studio server
npm start
```

Open your browser and visit: `http://localhost:3000`

---

## 🛠️ Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Frontend**: React 18, Tailwind CSS, Lucide Icons
- **Audio DSP**: Web Audio API, OfflineAudioContext, Custom 24-bit PCM WAV DSP Pipeline
- **Subtitles**: Custom Musical Structure Heuristic Engine
- **Backend API**: Next.js Route Handlers, Node.js HTTPS

---

## 📜 License
MIT License. Created by [maokhun](https://github.com/maokhun).
