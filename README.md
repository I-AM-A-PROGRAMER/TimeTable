# KIIT Timetable Web App

A sleek, mobile-first web app to view your **KIIT University timetable** — supports daily and weekly views, professional elective merging, color-coded class cards, and one-tap image downloads.

Built with **Flask + SQLite** on the backend and vanilla **HTML / CSS / JS** on the frontend. Data is parsed directly from the official Excel sheet.

---

## Features

### Core
- Pick your **Department → Section** from dropdowns (CS, IT, CSSE, CSCE, etc.)
- Pick **Professional Elective 1** (AI, IPA, HPC, DOS) and **Professional Elective 2** (CI, CD, BDS, BD, SVP, PSIOT, DMDW) with their own section selectors
- All three schedules are **merged** into a single unified timetable

### Daily View
- Swipe through **Mon – Fri** via a date strip
- Each class shown as a card: **time · subject · teacher · room**
- A live banner highlights the **ongoing class** (or the next one up)
- Defaults to **today** on load

### Weekly View
- Toggle between **Daily** and **Weekly** with a segmented pill control
- Grid table layout: days on the Y-axis, time slots on the X-axis
- **Color-coded cards** — Core (green), PE1 (blue), PE2 (amber)
- **Dynamic column trimming** — only shows time slots up to the latest scheduled class across the entire week
- Headers show **start times only** (08:00, 09:00, …) — no period labels
- **Download Image** — exports the full weekly grid as a high-resolution PNG via `html2canvas`

### Design & UX
- **Onyx Black** dark theme with emerald green and amber gold accents
- Premium glassmorphism cards, smooth transitions, and micro-animations
- **Fully responsive** — works on phones, tablets, and desktop
- **PWA** — installable as a home screen app with offline caching via Service Worker
- **Remembers your selection** across visits (saved in `localStorage`)

---

## Files

```
build_db.py                                # parses the Excel → timetable.db
app.py                                     # Flask server (API + serves frontend)
frontend/
  index.html                               # page markup
  styles.css                               # Onyx Black theme + all styling
  app.js                                   # UI logic, view switching, download
  sw.js                                    # Service Worker for offline/PWA
  manifest.json                            # PWA manifest
  favicon.png / icon-192.png / icon-512.png
5th_Semester_timetable_..._.xlsx           # timetable source (input)
timetable.db                               # generated database (auto-created)
render.yaml                                # Render deployment config
vercel.json                                # Vercel deployment config
```

---

## Run it

**One-time setup** (do this whenever the Excel changes):

```bash
pip install flask openpyxl
python build_db.py
```

**Start the app:**

```bash
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

---

## Updating the timetable

When you get a new Excel from the college:

1. Put the new `.xlsx` in this folder.
2. Run `python build_db.py` again (it rebuilds the database from scratch).
3. Refresh the browser.

If the file has a different name, pass it explicitly:
```bash
python build_db.py "path/to/new_timetable.xlsx"
```

## API

- `GET /api/sections` — all sections grouped by department
- `GET /api/timetable?section=CS1` — full week for a section

---

## Notes

- The "ongoing class" highlight is based on the **viewer's device clock** (local time), and only shows when viewing *today*.
- Free periods (blank cells in the Excel) are simply not shown.
- Sections are grouped under their original department codes (e.g. `DOS-S5-PE1` = DOS Professional Elective 1).
- The weekly grid dynamically trims trailing empty time slots — if no class runs past 1 PM across the entire week, columns stop at 12:00.