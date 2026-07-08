# KIIT Timetable Web App

A web app to view the **daily college timetable** — shows class time, subject, teacher, and room number. Highlights **today's** schedule and the **ongoing class** based on the viewer's local clock.

Built with **Flask + SQLite**. Data is parsed directly from the Excel sheet.

---

## What it does

- Pick your **department** → **section** from dropdowns (CS, IT, CSSE, CSCE, plus all electives: DOS, HPC, IPA, CD, CI, DMDW, SVP, etc.)
- Pick a **day** (defaults to today)
- See each class as a card: **time · subject · teacher · room**
- A live banner shows the **class happening right now** (or the next one up)
- Mobile-friendly responsive design
- Remembers your section on next visit (saved in the browser)

---

## Files

```
build_db.py                              # parses the Excel -> timetable.db
app.py                                   # Flask server (API + serves the page)
templates/index.html                     # page markup
static/styles.css                        # styling
static/app.js                            # UI logic + ongoing-class highlight
5th_Semester_timetable_..._.xlsx         # your timetable (input)
timetable.db                             # generated database (auto-created)
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

---

## Period times

| Period | Time |
|--------|------|
| P1 | 08:00 – 09:00 |
| P2 | 09:00 – 10:00 |
| P3 | 10:00 – 11:00 |
| P4 | 11:00 – 12:00 |
| P5 | 12:00 – 13:00 |
| P6 | 13:00 – 14:00 |
| P7 | 14:00 – 15:00 |
| P8 | 15:00 – 16:00 |
| P9 | 16:00 – 17:00 |
| P10| 17:00 – 18:00 |

---

## API (for tinkerers)

- `GET /api/sections` — all sections grouped by department
- `GET /api/timetable?section=CS1` — full week for a section

---

## Notes

- The "ongoing class" highlight is based on the **viewer's device clock** (local time), and only shows when viewing *today*.
- Free periods (blank cells in the Excel) are simply not shown.
- Sections are grouped under their original department codes (e.g. `DOS-S5-PE1` = DOS Program Elective).
