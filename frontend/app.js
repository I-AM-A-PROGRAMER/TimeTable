// KIIT Schedule — front-end logic
// Auto-selects today; builds a day strip with REAL dates of the current week.

// API base auto-detection:
//  - Local dev (served by Flask at the same origin)  -> ""        (relative)
//  - On Vercel (frontend only)                       -> your Render URL
//    override by setting window.KIIT_API in index.html, or just hardcode below.
const API_BASE = "https://timetable-8sed.onrender.com";

const api = (path) => `${API_BASE}${path}`;

const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];

const el = {
  dept: document.getElementById("dept-select"),
  section: document.getElementById("section-select"),
  strip: document.getElementById("day-strip"),
  dayTitle: document.getElementById("day-title"),
  datePill: document.getElementById("date-pill"),
  list: document.getElementById("schedule-list"),
  status: document.getElementById("status"),
  clock: document.getElementById("clock"),
  courseCount: document.getElementById("course-count"),
};

let state = {
  grouped: {},
  timetable: null,
  weekDates: [],
  selectedDay: null,
};

// ----------------------------------------------------------------- //
// Date helpers
// ----------------------------------------------------------------- //
function getWeekDates() {
  const today = new Date();
  const jsDay = today.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const arr = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isToday = sameDay(d, today);
    arr.push({
      full: DAY_FULL[i],
      short: DAY_SHORT[i],
      date: d.getDate(),
      dateObj: d,
      isToday,
    });
  }
  return arr;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function todayName() {
  const js = new Date().getDay();
  return js >= 1 && js <= 5 ? DAY_FULL[js - 1] : null;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fmt12(hhmm) {
  let [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ----------------------------------------------------------------- //
// Init
// ----------------------------------------------------------------- //
async function init() {
  state.weekDates = getWeekDates();
  buildDayStrip();

  await loadSections();

  const saved = localStorage.getItem("kiit_section");
  if (saved && selectSection(saved)) {
    await loadTimetable(saved);
  }

  el.section.addEventListener("change", () => {
    const code = el.section.value;
    if (code) localStorage.setItem("kiit_section", code);
    loadTimetable(code);
  });
  el.dept.addEventListener("change", populateSections);

  tickClock();
  setInterval(tickClock, 1000 * 20);
  setInterval(() => { if (state.timetable) renderSchedule(); }, 1000 * 60);
}

// ----------------------------------------------------------------- //
// Day strip
// ----------------------------------------------------------------- //
function buildDayStrip() {
  el.strip.innerHTML = "";
  state.weekDates.forEach((wd, i) => {
    const chip = document.createElement("div");
    chip.className = "day-chip";
    if (wd.isToday) chip.classList.add("today");
    chip.innerHTML = `<div class="d-num">${wd.date}</div><div class="d-name">${wd.short}</div>`;
    chip.addEventListener("click", () => selectDay(i));
    el.strip.appendChild(chip);
  });

  const todayIdx = state.weekDates.findIndex((d) => d.isToday);
  selectDay(todayIdx >= 0 ? todayIdx : 0);
}

function selectDay(i) {
  state.selectedDay = i;
  [...el.strip.children].forEach((c, idx) => {
    c.classList.toggle("active", idx === i);
  });
  if (state.timetable) renderSchedule();
}

// ----------------------------------------------------------------- //
// Sections dropdowns
// ----------------------------------------------------------------- //
async function loadSections() {
  try {
    const res = await fetch(api("/api/sections"));
    state.grouped = await res.json();
  } catch (e) {
    el.list.innerHTML = `<div class="empty"><div class="empty-emoji">⚠️</div><p>Could not reach the API. Is the backend running?</p></div>`;
    return;
  }

  el.dept.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = ""; ph.textContent = "Department";
  el.dept.appendChild(ph);

  const depts = Object.keys(state.grouped).sort(sortDepts);
  depts.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = deptLabel(d);
    el.dept.appendChild(opt);
  });
  populateSections();
}

function sortDepts(a, b) {
  const core = ["CS-S5", "IT-S5", "CSSE-S5", "CSCE-S5"];
  const ca = core.indexOf(a), cb = core.indexOf(b);
  if (ca !== -1 || cb !== -1) {
    if (ca !== -1 && cb !== -1) return ca - cb;
    return ca !== -1 ? -1 : 1;
  }
  return a.localeCompare(b);
}

function deptLabel(d) {
  const map = {
    "CS-S5": "CSE · Sem 5",
    "IT-S5": "IT · Sem 5",
    "CSSE-S5": "CSSE · Sem 5",
    "CSCE-S5": "CSCE · Sem 5",
    "AI-S5-PE1": "AI · Sem 5 (Prog. Elec.)",
    "DOS-S5-PE1": "DOS · Sem 5 (Prog. Elec.)",
    "HPC-S5-PE1": "HPC · Sem 5 (Prog. Elec.)",
    "IPA-S5-PE1": "IPA · Sem 5 (Prog. Elec.)",
    "BD-S5-PE2": "BD · Sem 5 (Open Elec.)",
    "BDS-S5-PE2": "BDS · Sem 5 (Open Elec.)",
    "CD-S5-PE2": "CD · Sem 5 (Open Elec.)",
    "CI-S5-PE2": "CI · Sem 5 (Open Elec.)",
    "DMDW-S5-PE2": "DMDW · Sem 5 (Open Elec.)",
    "PSIOT-S5-PE2": "PSIOT · Sem 5 (Open Elec.)",
    "SVP-S5-PE2": "SVP · Sem 5 (Open Elec.)",
  };
  return map[d] || d;
}

function populateSections() {
  const dept = el.dept.value;
  el.section.innerHTML = "";
  if (!dept) {
    el.section.disabled = true;
    const o = document.createElement("option");
    o.textContent = "Section";
    el.section.appendChild(o);
    return;
  }
  el.section.disabled = false;
  const secs = state.grouped[dept] || [];
  const o = document.createElement("option");
  o.value = ""; o.textContent = `Section (${secs.length})`;
  el.section.appendChild(o);
  secs.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.code; opt.textContent = s.code;
    el.section.appendChild(opt);
  });
}

function selectSection(code) {
  for (const d of Object.keys(state.grouped)) {
    if (state.grouped[d].some((s) => s.code === code)) {
      el.dept.value = d;
      populateSections();
      el.section.value = code;
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------- //
// Timetable
// ----------------------------------------------------------------- //
async function loadTimetable(section) {
  if (!section) {
    state.timetable = null;
    el.list.innerHTML = `<div class="empty"><div class="empty-emoji">📅</div><p>Pick your department and section to see your timetable.</p></div>`;
    el.status.hidden = true;
    el.dayTitle.textContent = "—";
    el.datePill.textContent = "";
    el.courseCount.textContent = "";
    return;
  }
  try {
    const res = await fetch(api(`/api/timetable?section=${encodeURIComponent(section)}`));
    if (!res.ok) throw new Error("not found");
    state.timetable = await res.json();
    renderSchedule();
  } catch (e) {
    el.list.innerHTML = `<div class="empty"><div class="empty-emoji">⚠️</div><p>Could not load timetable for this section.</p></div>`;
  }
}

const PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

function renderSchedule() {
  if (!state.timetable) return;
  const wd = state.weekDates[state.selectedDay];
  const day = wd.full;
  const classes = state.timetable.days[day] || [];

  const todayTag = wd.isToday ? ' <span class="today-tag">TODAY</span>' : "";
  el.dayTitle.innerHTML = `${day}${todayTag}`;

  el.datePill.textContent = wd.dateObj.toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  if (classes.length === 0) {
    el.list.innerHTML = `<div class="empty"><div class="empty-emoji">🎉</div><p>No classes on ${day}. Enjoy your day!</p></div>`;
    el.status.hidden = true;
    el.courseCount.textContent = "";
    return;
  }

  const now = nowMinutes();
  let ongoingIdx = -1;
  if (wd.isToday) {
    ongoingIdx = classes.findIndex(
      (c) => toMinutes(c.start) <= now && now < toMinutes(c.end)
    );
  }

  el.list.innerHTML = classes.map((c, i) => {
    const on = i === ongoingIdx;
    return `
      <div class="class-card ${on ? "ongoing" : ""}">
        <div class="time">
          <div class="start">${fmt12(c.start)}</div>
          <div class="end">${fmt12(c.end)}</div>
        </div>
        <div class="body">
          <div class="subject">${escapeHtml(c.subject)}</div>
          <div class="teacher">${escapeHtml(c.teacher || "")}</div>
          <div class="room">${PIN_SVG}${escapeHtml(c.room || "—")}</div>
        </div>
      </div>`;
  }).join("");

  renderStatus(classes, ongoingIdx, wd.isToday);
  el.courseCount.textContent = `${classes.length} classes · ${day}`;
}

function renderStatus(classes, ongoingIdx, isToday) {
  if (!isToday) { el.status.hidden = true; return; }
  el.status.hidden = false;

  if (ongoingIdx >= 0) {
    const c = classes[ongoingIdx];
    el.status.className = "status";
    el.status.innerHTML = `
      <span class="dot"></span>
      <div class="info">
        <div class="label">In class now</div>
        <div class="subj">${escapeHtml(c.subject)} · ${escapeHtml(c.room || "")}</div>
        <div class="sub">${escapeHtml(c.teacher || "")} · ends ${fmt12(c.end)}</div>
      </div>`;
    return;
  }

  const now = nowMinutes();
  const next = classes.find((c) => toMinutes(c.start) > now);
  if (next) {
    el.status.className = "status idle";
    el.status.innerHTML = `
      <span class="dot"></span>
      <div class="info">
        <div class="label">Next up</div>
        <div class="subj">${escapeHtml(next.subject)} · ${escapeHtml(next.room || "")}</div>
        <div class="sub">starts ${fmt12(next.start)}</div>
      </div>`;
  } else {
    el.status.className = "status idle";
    el.status.innerHTML = `
      <span class="dot"></span>
      <div class="info">
        <div class="label">All done</div>
        <div class="subj">No more classes today 🎉</div>
      </div>`;
  }
}

// ----------------------------------------------------------------- //
// Clock
// ----------------------------------------------------------------- //
function tickClock() {
  el.clock.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
  });
}

document.addEventListener("DOMContentLoaded", init);
