// ===== Фронтенд: сервермен fetch арқылы байланысады =====
const LEVEL_COLORS = {
  "Өте жақсы": "#16a34a",
  "Жақсы": "#2563eb",
  "Қанағаттанарлық": "#f59e0b",
  "Қанағаттанарлықсыз": "#dc2626",
  "Баға жоқ": "#94a3b8",
};
const RESERVED_COLUMNS = ["#", "Орны", "Студент", "Топ", "Орташа балл", "Үлгерімі"];

const $ = (id) => document.getElementById(id);
let subjects = [];
let currentList = [];
let editingId = null;
let barChart, pieChart, subjectChart, detailChart;
let lastCharts = null;

// ---------- Сессия мен тақырып ----------
let token = sessionStorage.getItem("token") || "";
const isAdmin = () => !!token;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  setLabel($("themeBtn"), theme === "dark" ? "sun" : "moon", "", 18);
  try { localStorage.setItem("theme", theme); } catch (e) {}
  if (lastCharts) renderCharts(...lastCharts);
}

function applyAuthUi() {
  document.querySelectorAll(".admin-only").forEach((el) => (el.hidden = !isAdmin()));
  setLabel($("loginBtn"), isAdmin() ? "logout" : "login", isAdmin() ? "Шығу" : "Мұғалім кіруі");
  $("loginBtn").className = "small" + (isAdmin() ? " secondary" : "");
  if (typeof renderChat === "function") renderChat(); // чат: мұғалімге "өшіру" түймесін көрсету
}

// ---------- API көмекшісі ----------
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { // сессия мерзімі өтті
    token = "";
    sessionStorage.removeItem("token");
    applyAuthUi();
    refresh();
  }
  if (!res.ok) throw new Error((data.errors || ["Қате орын алды"]).join("\n"));
  return data;
}

function toast(message, isError = false) {
  const t = $("toast");
  t.textContent = message;
  t.className = "toast" + (isError ? " error" : "");
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3500);
}

// ---------- Кіру / шығу ----------
async function doLogin() {
  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("password").value }) });
    token = data.token;
    sessionStorage.setItem("token", token);
    $("loginDialog").close();
    $("password").value = "";
    applyAuthUi();
    refresh();
    toast("Қош келдіңіз!");
  } catch (e) {
    toast(e.message, true);
  }
}

async function doLogout() {
  try { await api("/api/logout", { method: "POST" }); } catch (e) {}
  token = "";
  sessionStorage.removeItem("token");
  resetForm();
  applyAuthUi();
  refresh();
  toast("Жүйеден шықтыңыз");
}

// ---------- Форма ----------
function buildForm() {
  const box = $("scoreInputs");
  box.innerHTML = "";
  subjects.forEach((sub) => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = 0;
    inp.max = 100;
    inp.placeholder = sub.name;
    inp.dataset.subject = sub.id;
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") saveStudent(); });
    box.appendChild(inp);
  });
}

function scoreInputs() {
  return [...document.querySelectorAll("#scoreInputs input")];
}

function readForm() {
  const scores = {};
  scoreInputs().forEach((i) => (scores[i.dataset.subject] = i.value));
  return { name: $("name").value, group: $("group").value, scores };
}

function resetForm() {
  $("name").value = "";
  $("group").value = "";
  scoreInputs().forEach((i) => (i.value = ""));
  editingId = null;
  $("formTitle").textContent = "Жаңа студент қосу";
  $("saveBtn").textContent = "Есептеу және қосу";
  $("cancelBtn").hidden = true;
}

function startEdit(s) {
  editingId = s.id;
  $("name").value = s.name;
  $("group").value = s.group || "";
  scoreInputs().forEach((i) => (i.value = s.scores[i.dataset.subject] ?? ""));
  $("formTitle").textContent = "Студентті өзгерту";
  $("saveBtn").textContent = "Сақтау";
  $("cancelBtn").hidden = false;
  $("name").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveStudent() {
  const body = JSON.stringify(readForm());
  try {
    if (editingId) {
      await api("/api/students/" + editingId, { method: "PUT", body });
      toast("Өзгерістер сақталды");
    } else {
      await api("/api/students", { method: "POST", body });
      toast("Студент қосылды");
    }
    resetForm();
    refresh();
  } catch (e) {
    toast(e.message, true);
  }
}

async function removeStudent(s) {
  if (!confirm(`"${s.name}" студентін өшіресіз бе?`)) return;
  try {
    await api("/api/students/" + s.id, { method: "DELETE" });
    if (editingId === s.id) resetForm();
    toast("Студент өшірілді");
    refresh();
  } catch (e) {
    toast(e.message, true);
  }
}

// ---------- CSV: экспорт ----------
function exportCsv() {
  if (!currentList.length) return toast("Экспорттайтын деректер жоқ", true);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Студент", "Топ", ...subjects.map((s) => s.name), "Орташа балл", "Үлгерімі"];
  const rows = [head];
  currentList.forEach((s) => rows.push([
    s.name, s.group || "", ...subjects.map((sub) => s.scores[sub.id] ?? ""),
    s.average === null ? "" : s.average.toFixed(2), s.level,
  ]));
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n"); // BOM: Excel-де қазақша әріптер дұрыс шығады
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "ulgerim.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- CSV: импорт ----------
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const delim = first.split(";").length >= first.split(",").length ? ";" : ",";
  const rows = [];
  let row = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = ""; rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

async function importCsv(file) {
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("Файл бос немесе тақырыбы жоқ");
    const head = rows[0].map((h) => h.trim());
    const nameIdx = head.indexOf("Студент");
    if (nameIdx === -1) throw new Error('CSV-да "Студент" бағаны болуы керек');
    const groupIdx = head.indexOf("Топ");

    const payload = rows.slice(1).map((r) => {
      const scores = {};
      head.forEach((h, i) => { if (!RESERVED_COLUMNS.includes(h) && h) scores[h] = r[i] ?? ""; });
      return { name: r[nameIdx] ?? "", group: groupIdx >= 0 ? r[groupIdx] ?? "" : "", scores };
    });

    const res = await api("/api/import", { method: "POST", body: JSON.stringify({ rows: payload }) });
    let msg = `Қосылды: ${res.added}`;
    if (res.errorCount) msg += `, қате: ${res.errorCount}`;
    toast(msg, res.errorCount > 0 && res.added === 0);
    if (res.errorCount) alert("Қате жолдар:\n" + res.errors.slice(0, 8).join("\n"));
    if (res.ignored.length) alert("Пән ретінде танылмаған бағандар өткізілді:\n" + res.ignored.join(", "));
    refresh();
  } catch (e) {
    toast(e.message, true);
  } finally {
    $("importFile").value = "";
  }
}

// ---------- Пәндерді басқару ----------
function renderSubjectList() {
  const ul = $("subjectList");
  ul.innerHTML = "";
  subjects.forEach((sub) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = sub.name;
    const del = document.createElement("button");
    del.className = "small danger";
    setLabel(del, "trash", "Өшіру", 14);
    del.onclick = async () => {
      if (!confirm(`"${sub.name}" пәнін және оның барлық бағасын өшіресіз бе?`)) return;
      try {
        await api("/api/subjects/" + sub.id, { method: "DELETE" });
        await refresh();
        renderSubjectList();
      } catch (e) { toast(e.message, true); }
    };
    li.append(span, del);
    ul.appendChild(li);
  });
}

async function addSubject() {
  const name = $("newSubject").value.trim();
  if (!name) return;
  try {
    await api("/api/subjects", { method: "POST", body: JSON.stringify({ name }) });
    $("newSubject").value = "";
    await refresh();
    renderSubjectList();
    toast("Пән қосылды");
  } catch (e) { toast(e.message, true); }
}

// ---------- Студент карточкасы ----------
async function showDetail(s) {
  try {
    const d = await api("/api/students/" + s.id);
    $("detailTitle").textContent = d.name;
    const meta = $("detailMeta");
    meta.innerHTML = "";
    const parts = [
      "Топ: " + (d.group || "-"),
      "Орны: " + (d.rank ?? "-") + " / " + d.groupSize,
      "Орташа: " + (d.average === null ? "-" : d.average.toFixed(2)),
    ];
    parts.forEach((p) => { const sp = document.createElement("span"); sp.textContent = p; meta.appendChild(sp); });
    meta.appendChild(badge(d.level));

    $("detailDialog").showModal();
    if (detailChart) detailChart.destroy();
    setChartColors();
    detailChart = new Chart($("detailChart"), {
      type: "bar",
      data: {
        labels: subjects.map((x) => x.name),
        datasets: [
          { label: d.name, data: subjects.map((x) => d.scores[x.id] ?? 0), backgroundColor: "#3b82f6" },
          { label: "Топтың орташасы", data: subjects.map((x) => d.groupAverages[x.id] ?? 0), backgroundColor: "#94a3b8" },
        ],
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } },
    });
  } catch (e) { toast(e.message, true); }
}

// ---------- Көрсету ----------
function badge(levelName) {
  const span = document.createElement("span");
  span.className = "badge";
  span.style.background = LEVEL_COLORS[levelName];
  span.textContent = levelName;
  return span;
}

const scoreClass = (n) => (typeof n !== "number" ? "" : n >= 90 ? "score-high" : n < 50 ? "score-low" : "");

function renderHead() {
  const tr = $("headRow");
  tr.innerHTML = "";
  const cols = ["Орны", "Студент", "Топ", ...subjects.map((s) => s.name), "Орташа балл", "Үлгерімі"];
  if (isAdmin()) cols.push("Әрекет");
  cols.forEach((c) => { const th = document.createElement("th"); th.textContent = c; tr.appendChild(th); });
}

function cell(row, value, cls) {
  const td = document.createElement("td");
  td.textContent = value; // textContent: XSS-тен қорғайды
  if (cls) td.className = cls;
  row.appendChild(td);
  return td;
}

function renderTable(list) {
  currentList = list;
  const tbody = $("results");
  tbody.innerHTML = "";
  $("empty").hidden = list.length > 0;

  list.forEach((s) => {
    const row = document.createElement("tr");
    const rankTd = cell(row, "", "rank");
    if (s.rank === null) rankTd.textContent = "-";
    else if (s.rank <= 3) rankTd.appendChild(medal(s.rank));
    else rankTd.textContent = s.rank;
    const nameTd = cell(row, s.name, "name");
    nameTd.title = "Толық ақпарат";
    nameTd.onclick = () => showDetail(s);
    cell(row, s.group || "-", "group");
    subjects.forEach((sub) => {
      const v = s.scores[sub.id];
      cell(row, v ?? "-", scoreClass(v));
    });
    cell(row, s.average === null ? "-" : s.average.toFixed(2), scoreClass(s.average));
    const levelTd = document.createElement("td");
    levelTd.appendChild(badge(s.level));
    row.appendChild(levelTd);

    if (isAdmin()) {
      const actTd = document.createElement("td");
      const edit = document.createElement("button");
      edit.className = "small";
      setLabel(edit, "pencil", "Өзгерту", 14);
      edit.onclick = () => startEdit(s);
      const del = document.createElement("button");
      del.className = "small danger";
      setLabel(del, "trash", "Өшіру", 14);
      del.onclick = () => removeStudent(s);
      actTd.append(edit, del);
      row.appendChild(actTd);
    }
    tbody.appendChild(row);
  });
}

function statCard(title, value, sub, iconName, color) {
  const div = document.createElement("div");
  div.className = "stat";
  const bubble = document.createElement("span");
  bubble.className = "stat-ico";
  bubble.style.setProperty("--c", color);
  bubble.appendChild(icon(iconName, 22));
  div.appendChild(bubble);
  const small = document.createElement("small");
  small.textContent = title;
  const b = document.createElement("b");
  b.textContent = value;
  div.append(small, b);
  if (sub) {
    const span = document.createElement("span");
    span.textContent = sub;
    div.appendChild(span);
  }
  return div;
}

function renderStats(st) {
  const box = $("stats");
  box.innerHTML = "";
  box.append(
    statCard("Студенттер саны", st.count, "", "users", "#2563eb"),
    statCard("Орташа балл", st.classAverage.toFixed(2), "", "chart", "#8b5cf6"),
    statCard("Ең жоғары балл", st.best ? st.best.name : "-", st.best ? st.best.average.toFixed(2) : "", "trophy", "#f59e0b"),
    statCard("Ең төмен балл", st.worst ? st.worst.name : "-", st.worst ? st.worst.average.toFixed(2) : "", "trendDown", "#dc2626")
  );
}

function renderGroups(groups) {
  const sel = $("groupFilter");
  const keep = sel.value;
  sel.innerHTML = "";
  sel.add(new Option("Барлық топтар", ""));
  groups.forEach((g) => sel.add(new Option(g, g)));
  sel.value = groups.includes(keep) ? keep : "";
  const dl = $("groupList");
  dl.innerHTML = "";
  groups.forEach((g) => dl.appendChild(new Option(g)));
}

function setChartColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  Chart.defaults.color = dark ? "#cbd5e1" : "#475569";
  Chart.defaults.borderColor = dark ? "#26324a" : "#e2e8f0";
}

function renderCharts(list, stats) {
  lastCharts = [list, stats];
  setChartColors();
  [barChart, pieChart, subjectChart].forEach((c) => c && c.destroy());

  barChart = new Chart($("barChart"), {
    type: "bar",
    data: {
      labels: list.map((s) => s.name),
      datasets: [{
        label: "Орташа балл",
        data: list.map((s) => s.average ?? 0),
        backgroundColor: list.map((s) => LEVEL_COLORS[s.level]),
      }],
    },
    options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } },
  });

  const labels = Object.keys(stats.distribution).filter((l) => stats.distribution[l] > 0);
  pieChart = new Chart($("pieChart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: labels.map((l) => stats.distribution[l]), backgroundColor: labels.map((l) => LEVEL_COLORS[l]), borderWidth: 0 }],
    },
  });

  subjectChart = new Chart($("subjectChart"), {
    type: "bar",
    data: {
      labels: subjects.map((s) => s.name),
      datasets: [{ label: "Орташа балл", data: subjects.map((s) => stats.subjectAverages[s.id] ?? 0), backgroundColor: "#8b5cf6" }],
    },
    options: { indexAxis: "y", scales: { x: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } },
  });
}

async function refresh() {
  try {
    const search = encodeURIComponent($("search").value.trim());
    const sort = encodeURIComponent($("sort").value);
    const group = encodeURIComponent($("groupFilter").value);
    const [subs, list, stats] = await Promise.all([
      api("/api/subjects"),
      api(`/api/students?search=${search}&sort=${sort}&group=${group}`),
      api(`/api/stats?group=${group}`),
    ]);
    if (JSON.stringify(subs) !== JSON.stringify(subjects)) {
      subjects = subs;
      buildForm();
      resetForm();
    }
    renderGroups(stats.groups);
    renderHead();
    renderTable(list);
    renderStats(stats);
    renderCharts(list, stats);
  } catch (e) {
    toast(e.message.includes("жүйеге кіріңіз") ? e.message : "Серверге қосылу мүмкін емес: " + e.message, true);
  }
}

// ---------- Оқиғалар ----------
$("saveBtn").onclick = saveStudent;
$("cancelBtn").onclick = resetForm;
$("name").addEventListener("keydown", (e) => { if (e.key === "Enter") saveStudent(); });
$("group").addEventListener("keydown", (e) => { if (e.key === "Enter") saveStudent(); });
$("sort").onchange = refresh;
$("groupFilter").onchange = refresh;
$("exportBtn").onclick = exportCsv;
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = (e) => e.target.files[0] && importCsv(e.target.files[0]);
$("subjectsBtn").onclick = () => { renderSubjectList(); $("subjectsDialog").showModal(); };
$("subjectsClose").onclick = () => $("subjectsDialog").close();
$("addSubjectBtn").onclick = addSubject;
$("newSubject").addEventListener("keydown", (e) => { if (e.key === "Enter") addSubject(); });
$("detailClose").onclick = () => $("detailDialog").close();
$("detailDialog").addEventListener("close", () => { if (detailChart) { detailChart.destroy(); detailChart = null; } });
$("themeBtn").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
$("loginBtn").onclick = () => (isAdmin() ? doLogout() : ($("loginDialog").showModal(), $("password").focus()));
$("loginOk").onclick = doLogin;
$("loginCancel").onclick = () => $("loginDialog").close();
$("password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
let searchTimer;
$("search").oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(refresh, 250); };

// ---------- Бастау ----------
let savedTheme = "light";
try { savedTheme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) {}
applyTheme(savedTheme);
applyAuthUi();
refresh();
