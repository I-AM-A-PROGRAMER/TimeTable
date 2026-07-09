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
  pe1: document.getElementById("pe1-select"),
  pe1Section: document.getElementById("pe1-section-select"),
  pe2: document.getElementById("pe2-select"),
  pe2Section: document.getElementById("pe2-section-select"),
  strip: document.getElementById("day-strip"),
  dayTitle: document.getElementById("day-title"),
  datePill: document.getElementById("date-pill"),
  list: document.getElementById("schedule-list"),
  status: document.getElementById("status"),
  clock: document.getElementById("clock"),
  courseCount: document.getElementById("course-count"),
  
  // Weekly View & Selector elements
  btnDaily: document.getElementById("btn-view-daily"),
  btnWeekly: document.getElementById("btn-view-weekly"),
  btnDownload: document.getElementById("btn-download"),
  dailyView: document.getElementById("daily-view"),
  weeklyView: document.getElementById("weekly-view"),
  weeklyCaptureArea: document.getElementById("weekly-capture-area"),
  weeklyGridBody: document.getElementById("weekly-grid-body"),
  weeklyGridHead: document.getElementById("weekly-grid-head"),
  weeklySectionsTitle: document.getElementById("weekly-sections-title"),
};

let state = {
  grouped: {},
  timetable: null,
  weekDates: [],
  selectedDay: null,
  currentView: "daily",
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

  const savedCoreSec = localStorage.getItem("kiit_section");
  const savedPE1Dept = localStorage.getItem("kiit_pe1_dept");
  const savedPE1Sec = localStorage.getItem("kiit_pe1_section");
  const savedPE2Dept = localStorage.getItem("kiit_pe2_dept");
  const savedPE2Sec = localStorage.getItem("kiit_pe2_section");
  const savedView = localStorage.getItem("kiit_view") || "daily";

  if (savedCoreSec && selectSection(savedCoreSec)) {
    if (savedPE1Dept) {
      el.pe1.value = savedPE1Dept;
      populatePESections(1);
      if (savedPE1Sec && [...el.pe1Section.options].some(o => o.value === savedPE1Sec)) {
        el.pe1Section.value = savedPE1Sec;
      }
    }
    if (savedPE2Dept) {
      el.pe2.value = savedPE2Dept;
      populatePESections(2);
      if (savedPE2Sec && [...el.pe2Section.options].some(o => o.value === savedPE2Sec)) {
        el.pe2Section.value = savedPE2Sec;
      }
    }
    await loadCombinedTimetable();
  }

  // Set initial view state
  switchView(savedView);

  // Event Listeners for view switching
  el.btnDaily.addEventListener("click", () => switchView("daily"));
  el.btnWeekly.addEventListener("click", () => switchView("weekly"));
  el.btnDownload.addEventListener("click", downloadWeeklyImage);

  el.section.addEventListener("change", () => {
    const code = el.section.value;
    if (code) localStorage.setItem("kiit_section", code);
    else localStorage.removeItem("kiit_section");
    loadCombinedTimetable();
  });
  el.dept.addEventListener("change", () => {
    populateSections();
    loadCombinedTimetable();
  });

  el.pe1.addEventListener("change", () => {
    const dept = el.pe1.value;
    if (dept) localStorage.setItem("kiit_pe1_dept", dept);
    else {
      localStorage.removeItem("kiit_pe1_dept");
      localStorage.removeItem("kiit_pe1_section");
    }
    populatePESections(1);
    loadCombinedTimetable();
  });
  el.pe1Section.addEventListener("change", () => {
    const code = el.pe1Section.value;
    if (code) localStorage.setItem("kiit_pe1_section", code);
    else localStorage.removeItem("kiit_pe1_section");
    loadCombinedTimetable();
  });

  el.pe2.addEventListener("change", () => {
    const dept = el.pe2.value;
    if (dept) localStorage.setItem("kiit_pe2_dept", dept);
    else {
      localStorage.removeItem("kiit_pe2_dept");
      localStorage.removeItem("kiit_pe2_section");
    }
    populatePESections(2);
    loadCombinedTimetable();
  });
  el.pe2Section.addEventListener("change", () => {
    const code = el.pe2Section.value;
    if (code) localStorage.setItem("kiit_pe2_section", code);
    else localStorage.removeItem("kiit_pe2_section");
    loadCombinedTimetable();
  });

  tickClock();
  setInterval(tickClock, 1000 * 20);
  setInterval(() => { if (state.timetable) { if (state.currentView === "daily") renderSchedule(); else renderWeeklySchedule(); } }, 1000 * 60);
}

// ----------------------------------------------------------------- //
// PWA & Service Worker Logic (Decoupled from API initialization)
// ----------------------------------------------------------------- //
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      console.log("Service Worker registered successfully:", reg.scope);
      reg.update();
    } catch (e) {
      console.warn("Service Worker registration failed:", e);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      console.log("Service Worker updated, reloading...");
      window.location.reload();
    }
  });
}

// PWA Custom Install Prompt Banner
let deferredPrompt;
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

if (!isStandalone) {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent standard browser bar from displaying
    e.preventDefault();
    deferredPrompt = e;

    const installBanner = document.getElementById("install-banner");
    // Only show banner if not dismissed in the current browser session
    if (installBanner && !sessionStorage.getItem("kiit_pwa_dismissed")) {
      installBanner.hidden = false;
    }
  });

  const installBanner = document.getElementById("install-banner");
  const btnInstallNow = document.getElementById("btn-install-now");
  const btnInstallDismiss = document.getElementById("btn-install-dismiss");

  if (installBanner && btnInstallNow && btnInstallDismiss) {
    btnInstallNow.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      
      installBanner.hidden = true;
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA installation outcome: ${outcome}`);
      deferredPrompt = null;
    });

    btnInstallDismiss.addEventListener("click", () => {
      installBanner.hidden = true;
      sessionStorage.setItem("kiit_pwa_dismissed", "true");
    });
  }
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
    localStorage.setItem("kiit_sections_cache", JSON.stringify(state.grouped));
  } catch (e) {
    const cached = localStorage.getItem("kiit_sections_cache");
    if (cached) {
      state.grouped = JSON.parse(cached);
    } else {
      el.list.innerHTML = `<div class="empty"><div class="empty-emoji">⚠️</div><p>Could not reach the API. Is the backend running?</p></div>`;
      return;
    }
  }

  // 1. Populate Core Department Select
  el.dept.innerHTML = "";
  const phDept = document.createElement("option");
  phDept.value = ""; phDept.textContent = "Department";
  el.dept.appendChild(phDept);

  const coreDepts = ["CS-S5", "IT-S5", "CSSE-S5", "CSCE-S5"];
  coreDepts.forEach((d) => {
    if (state.grouped[d]) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = deptLabel(d);
      el.dept.appendChild(opt);
    }
  });

  // 2. Populate PE1 Select
  el.pe1.innerHTML = "";
  const phPE1 = document.createElement("option");
  phPE1.value = ""; phPE1.textContent = "Professional Elective 1";
  el.pe1.appendChild(phPE1);

  const pe1Depts = ["AI-S5-PE1", "IPA-S5-PE1", "HPC-S5-PE1", "DOS-S5-PE1"];
  pe1Depts.forEach((d) => {
    if (state.grouped[d]) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = getPELabel(d);
      el.pe1.appendChild(opt);
    }
  });

  // 3. Populate PE2 Select
  el.pe2.innerHTML = "";
  const phPE2 = document.createElement("option");
  phPE2.value = ""; phPE2.textContent = "Professional Elective 2";
  el.pe2.appendChild(phPE2);

  const pe2Depts = ["CI-S5-PE2", "CD-S5-PE2", "BDS-S5-PE2", "BD-S5-PE2", "SVP-S5-PE2", "PSIOT-S5-PE2", "DMDW-S5-PE2"];
  pe2Depts.forEach((d) => {
    if (state.grouped[d]) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = getPELabel(d);
      el.pe2.appendChild(opt);
    }
  });

  populateSections();
  populatePESections(1);
  populatePESections(2);
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

function getPELabel(d) {
  return d.split("-")[0];
}

function populateSections() {
  const dept = el.dept.value;
  el.section.innerHTML = "";
  if (!dept) {
    el.section.disabled = true;
    const o = document.createElement("option");
    o.value = ""; o.textContent = "Section";
    el.section.appendChild(o);
    return;
  }
  el.section.disabled = false;
  const secs = [...(state.grouped[dept] || [])];
  secs.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const o = document.createElement("option");
  o.value = ""; o.textContent = `Section (${secs.length})`;
  el.section.appendChild(o);
  secs.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.code; opt.textContent = s.code;
    el.section.appendChild(opt);
  });
}

function populatePESections(num) {
  const peSelect = num === 1 ? el.pe1 : el.pe2;
  const peSecSelect = num === 1 ? el.pe1Section : el.pe2Section;
  const dept = peSelect.value;

  peSecSelect.innerHTML = "";
  if (!dept) {
    peSecSelect.disabled = true;
    const o = document.createElement("option");
    o.value = ""; o.textContent = "Section";
    peSecSelect.appendChild(o);
    return;
  }

  peSecSelect.disabled = false;
  const secs = [...(state.grouped[dept] || [])];
  secs.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const o = document.createElement("option");
  o.value = ""; o.textContent = `Section (${secs.length})`;
  peSecSelect.appendChild(o);

  secs.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.code; opt.textContent = s.code;
    peSecSelect.appendChild(opt);
  });
}

function selectSection(code) {
  const coreDepts = ["CS-S5", "IT-S5", "CSSE-S5", "CSCE-S5"];
  for (const d of coreDepts) {
    if (state.grouped[d] && state.grouped[d].some((s) => s.code === code)) {
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
async function loadCombinedTimetable() {
  const coreSec = el.section.value;
  const pe1Sec = el.pe1Section.value;
  const pe2Sec = el.pe2Section.value;

  if (!coreSec) {
    state.timetable = null;
    const emptyHtml = `<div class="empty"><div class="empty-emoji">📅</div><p>Pick your department and section to see your timetable.</p></div>`;
    el.list.innerHTML = emptyHtml;
    el.weeklyGridHead.innerHTML = `<tr><th>Day</th></tr>`;
    el.weeklyGridBody.innerHTML = `<tr><td colspan="11">${emptyHtml}</td></tr>`;
    el.status.hidden = true;
    el.status.style.display = "none";
    el.dayTitle.textContent = "—";
    el.datePill.textContent = "";
    el.courseCount.textContent = "";
    el.weeklySectionsTitle.textContent = "—";
    return;
  }

  const fetchSection = async (sec) => {
    if (!sec) return null;
    try {
      const res = await fetch(api(`/api/timetable?section=${encodeURIComponent(sec)}`));
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      localStorage.setItem(`kiit_timetable_cache_${sec}`, JSON.stringify(data));
      return data;
    } catch (e) {
      const cached = localStorage.getItem(`kiit_timetable_cache_${sec}`);
      if (cached) return JSON.parse(cached);
      return null;
    }
  };

  try {
    const [coreData, pe1Data, pe2Data] = await Promise.all([
      fetchSection(coreSec),
      fetchSection(pe1Sec),
      fetchSection(pe2Sec),
    ]);

    if (!coreData) {
      const errorHtml = `<div class="empty"><div class="empty-emoji">⚠️</div><p>Could not load timetable for the main section.</p></div>`;
      el.list.innerHTML = errorHtml;
      el.weeklyGridHead.innerHTML = `<tr><th>Day</th></tr>`;
      el.weeklyGridBody.innerHTML = `<tr><td colspan="11">${errorHtml}</td></tr>`;
      return;
    }

    const combined = {
      section: coreData.section,
      department: coreData.department,
      semester: coreData.semester,
      days: {},
    };

    DAY_FULL.forEach((day) => {
      const classes = [];
      if (coreData.days && coreData.days[day]) {
        classes.push(...coreData.days[day].map(c => ({ ...c, type: "core" })));
      }
      if (pe1Data && pe1Data.days && pe1Data.days[day]) {
        classes.push(...pe1Data.days[day].map(c => ({ ...c, type: "pe1" })));
      }
      if (pe2Data && pe2Data.days && pe2Data.days[day]) {
        classes.push(...pe2Data.days[day].map(c => ({ ...c, type: "pe2" })));
      }
      classes.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      combined.days[day] = classes;
    });

    state.timetable = combined;
    if (state.currentView === "daily") {
      renderSchedule();
    } else {
      renderWeeklySchedule();
    }
  } catch (err) {
    const errorHtml = `<div class="empty"><div class="empty-emoji">⚠️</div><p>An error occurred loading the timetables.</p></div>`;
    el.list.innerHTML = errorHtml;
    el.weeklyGridHead.innerHTML = `<tr><th>Day</th></tr>`;
    el.weeklyGridBody.innerHTML = `<tr><td colspan="11">${errorHtml}</td></tr>`;
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
  if (!isToday || state.currentView !== "daily") {
    el.status.hidden = true;
    el.status.style.display = "none";
    return;
  }
  el.status.hidden = false;
  el.status.style.display = "flex";

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

// ----------------------------------------------------------------- //
// Weekly View & Switch View Logic
// ----------------------------------------------------------------- //
function switchView(view) {
  state.currentView = view;
  localStorage.setItem("kiit_view", view);

  if (view === "weekly") {
    el.btnDaily.classList.remove("active");
    el.btnWeekly.classList.add("active");

    el.strip.style.display = "none";
    el.status.style.display = "none";
    el.dailyView.style.display = "none";
    el.weeklyView.style.display = "flex";

    renderWeeklySchedule();
  } else {
    el.btnDaily.classList.add("active");
    el.btnWeekly.classList.remove("active");

    el.strip.style.display = "grid";
    el.status.style.display = el.status.hidden ? "none" : "flex";
    el.dailyView.style.display = "block";
    el.weeklyView.style.display = "none";

    if (state.timetable) renderSchedule();
  }
}

function renderWeeklySchedule() {
  const container = el.weeklyGridBody;
  container.innerHTML = "";

  if (!state.timetable) {
    el.weeklyGridHead.innerHTML = `<tr><th>Day</th></tr>`;
    container.innerHTML = `<tr><td colspan="11"><div class="empty"><div class="empty-emoji">📅</div><p>Pick your department and section to see your timetable.</p></div></td></tr>`;
    el.weeklySectionsTitle.textContent = "—";
    return;
  }

  // Calculate the maximum period dynamically based on scheduled classes across all days
  let maxPeriod = 5; // Default minimum columns: P5 (up to 1:00 PM)
  DAY_FULL.forEach((day) => {
    const classes = state.timetable.days[day] || [];
    classes.forEach((c) => {
      const num = parseInt(c.period.replace("P", ""), 10);
      if (num > maxPeriod) {
        maxPeriod = num;
      }
    });
  });

  // Build the unified title (e.g. CS1 · HPC1 · CI1)
  const coreSec = el.section.value;
  const pe1Sec = el.pe1Section.value;
  const pe2Sec = el.pe2Section.value;
  
  let titleParts = [coreSec];
  if (pe1Sec) titleParts.push(pe1Sec);
  if (pe2Sec) titleParts.push(pe2Sec);
  el.weeklySectionsTitle.textContent = titleParts.join(" · ");

  const PERIOD_TIMES = {
    "P1": "08:00",
    "P2": "09:00",
    "P3": "10:00",
    "P4": "11:00",
    "P5": "12:00",
    "P6": "13:00",
    "P7": "14:00",
    "P8": "15:00",
    "P9": "16:00",
    "P10": "17:00"
  };

  // Build dynamic time headers (no P1..Pn, just time)
  let headHtml = `<tr><th>Day</th>`;
  for (let i = 1; i <= maxPeriod; i++) {
    const timeStr = PERIOD_TIMES[`P${i}`] || "";
    headHtml += `<th>${timeStr}</th>`;
  }
  headHtml += `</tr>`;
  el.weeklyGridHead.innerHTML = headHtml;

  const DAY_SHORT_MAP = {
    "Monday": "Mon",
    "Tuesday": "Tue",
    "Wednesday": "Wed",
    "Thursday": "Thu",
    "Friday": "Fri"
  };

  DAY_FULL.forEach((day) => {
    const classes = state.timetable.days[day] || [];

    // Group classes by period name (P1 to P10)
    const periodMap = {};
    for (let i = 1; i <= maxPeriod; i++) {
      periodMap[`P${i}`] = [];
    }
    classes.forEach((c) => {
      if (periodMap[c.period]) {
        periodMap[c.period].push(c);
      }
    });

    const row = document.createElement("tr");

    // 1. Day cell
    const dayCell = document.createElement("td");
    dayCell.className = "day-cell";
    dayCell.textContent = DAY_SHORT_MAP[day] || day;
    row.appendChild(dayCell);

    // 2. Period cells (P1 to maxPeriod)
    for (let i = 1; i <= maxPeriod; i++) {
      const pKey = `P${i}`;
      const cellClasses = periodMap[pKey] || [];
      const cell = document.createElement("td");
      cell.className = "class-cell";

      if (cellClasses.length > 0) {
        const stack = document.createElement("div");
        stack.className = "weekly-cell-stack";

        cellClasses.forEach((c) => {
          const card = document.createElement("div");
          card.className = `weekly-cell-card ${c.type || "core"}`;
          card.innerHTML = `
            <div class="subj">${escapeHtml(c.subject)}</div>
            <div class="room">${escapeHtml(c.room || "—")}</div>
          `;
          stack.appendChild(card);
        });

        cell.appendChild(stack);
      }
      row.appendChild(cell);
    }

    container.appendChild(row);
  });
}

async function downloadWeeklyImage() {
  const area = el.weeklyCaptureArea;
  const coreSec = el.section.value;
  const pe1Sec = el.pe1Section.value;
  const pe2Sec = el.pe2Section.value;

  if (!coreSec) {
    alert("Please select a core section first.");
    return;
  }

  let filename = `timetable_${coreSec}`;
  if (pe1Sec) filename += `_${pe1Sec}`;
  if (pe2Sec) filename += `_${pe2Sec}`;
  filename += ".png";

  try {
    const canvas = await html2canvas(area, {
      backgroundColor: "#09090b", // Onyx Black
      scale: 2, // high quality
      logging: false,
      useCORS: true,
      onclone: (clonedDoc) => {
        const clonedArea = clonedDoc.getElementById("weekly-capture-area");
        if (clonedArea) {
          // Force layout expansion to ensure full table grid renders without truncation
          clonedArea.style.width = "950px";
          clonedArea.style.maxWidth = "none";
          
          const wrapper = clonedArea.querySelector(".weekly-grid-wrapper");
          if (wrapper) {
            wrapper.style.overflowX = "visible";
            wrapper.style.width = "100%";
          }
          const table = clonedArea.querySelector(".weekly-grid-table");
          if (table) {
            table.style.width = "100%";
            table.style.minWidth = "850px";
          }
        }
      }
    });

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("Failed to download image", err);
    alert("Could not generate image. Please try again.");
  }
}

document.addEventListener("DOMContentLoaded", init);
