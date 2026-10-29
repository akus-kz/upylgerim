// ===== Бэкенд: Node.js + Express =====
// Деректер data/db.json файлында сақталады (сервер өшсе де жоғалмайды).

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.set("trust proxy", 1); // Render/Railway/nginx артында шынайы IP алу үшін
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data"); // хостингте тұрақты дискіге көрсетіңіз
const DB_FILE = path.join(DATA_DIR, "db.json");
const OLD_FILE = path.join(DATA_DIR, "students.json"); // алдыңғы нұсқа
const MAX_SUBJECTS = 12;

// ---------- Деректер қоймасы ----------
const DEFAULT_SUBJECTS = [
  { id: "math", name: "Математика" },
  { id: "info", name: "Информатика" },
  { id: "english", name: "Ағылшын тілі" },
];

const SEED_STUDENTS = [
  { name: "Айдана Серік", group: "ИС-23", scores: { math: 95, info: 90, english: 85 } },
  { name: "Арман Болат", group: "ИС-23", scores: { math: 75, info: 80, english: 70 } },
  { name: "Аружан Ермек", group: "ИС-23", scores: { math: 100, info: 95, english: 90 } },
  { name: "Данияр Асқар", group: "ИС-24", scores: { math: 65, info: 70, english: 60 } },
  { name: "Мадина Әли", group: "ИС-24", scores: { math: 85, info: 90, english: 95 } },
].map((s) => ({ id: crypto.randomUUID(), ...s }));

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    if (fs.existsSync(DB_FILE)) {
      const d = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      return { subjects: d.subjects || DEFAULT_SUBJECTS, students: d.students || [] };
    }
    if (fs.existsSync(OLD_FILE)) { // алдыңғы нұсқадан көшіру
      const old = JSON.parse(fs.readFileSync(OLD_FILE, "utf8"));
      const db = { subjects: DEFAULT_SUBJECTS, students: old.map((s) => ({ group: "", ...s })) };
      saveDb(db);
      return db;
    }
  } catch (e) {
    console.error("Дерекқор оқылмады, бос басталды:", e.message);
    return { subjects: DEFAULT_SUBJECTS, students: [] };
  }
  const seedFile = path.join(__dirname, "seed", "db.json"); // нақты деректер (бірінші іске қосуда)
  if (fs.existsSync(seedFile)) {
    const seeded = JSON.parse(fs.readFileSync(seedFile, "utf8"));
    saveDb(seeded);
    return seeded;
  }
  const db = { subjects: DEFAULT_SUBJECTS, students: SEED_STUDENTS };
  saveDb(db);
  return db;
}

function saveDb(data = db) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE); // файл бұзылмауы үшін
}

let db = loadDb();

// ---------- Есептеулер ----------
function average(scores) {
  const vals = db.subjects.map((s) => scores[s.id]).filter((v) => typeof v === "number");
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function level(avg) {
  if (avg === null) return "Баға жоқ";
  if (avg >= 90) return "Өте жақсы";
  if (avg >= 75) return "Жақсы";
  if (avg >= 50) return "Қанағаттанарлық";
  return "Қанағаттанарлықсыз";
}

const round2 = (n) => Math.round(n * 100) / 100;

// Орындар топ ішінде есептеледі (бірдей балл = бірдей орын)
function withRanks(list) {
  const byGroup = {};
  list.forEach((s) => {
    const g = s.group || "";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push({ s, avg: average(s.scores) });
  });
  const rank = new Map();
  Object.values(byGroup).forEach((members) => {
    members.forEach((m) => {
      rank.set(m.s.id, m.avg === null ? null : 1 + members.filter((o) => o.avg !== null && o.avg > m.avg).length);
    });
  });
  return list.map((s) => {
    const avg = average(s.scores);
    return { ...s, average: avg === null ? null : round2(avg), level: level(avg), rank: rank.get(s.id) };
  });
}

function subjectAverages(list) {
  const out = {};
  db.subjects.forEach((sub) => {
    const vals = list.map((s) => s.scores[sub.id]).filter((v) => typeof v === "number");
    out[sub.id] = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  return out;
}

// ---------- Валидация (сервер жағында) ----------
function validate(body) {
  const errors = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 60) errors.push("Аты-жөні 2-60 таңба аралығында болуы керек");
  const group = String(body.group || "").trim().slice(0, 30);

  const raw = body.scores || {};
  const scores = {};
  let count = 0;
  for (const sub of db.subjects) {
    const v = raw[sub.id];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.push(`"${sub.name}" бағасы 0 мен 100 аралығында болуы керек`);
    } else {
      scores[sub.id] = n;
      count++;
    }
  }
  if (count === 0 && errors.length === 0) errors.push("Кемінде бір баға енгізіңіз");
  return { errors, value: { name, group, scores } };
}

// ---------- Авторизация (мұғалім) ----------
// Құпия сөзді өзгерту: ADMIN_PASSWORD=мойпароль npm start
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const sessions = new Set();

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Интернетте әдепкі құпия сөзбен іске қосуға болмайды
if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD орнатылмаған. Қауіпсіздік үшін сервер іске қосылмады.");
  process.exit(1);
}

// Кіру әрекеттерін шектеу: 8 қате → 15 минутқа блок (IP бойынша)
const loginFails = new Map();
setInterval(() => { const t = Date.now(); for (const [k, v] of loginFails) if (v.until < t && v.n < 8) loginFails.delete(k); }, 600000).unref();

// PRIVATE_VIEW=1 болса, бағаларды тек мұғалім көреді
function readGuard(req, res, next) {
  if (process.env.PRIVATE_VIEW !== "1") return next();
  return requireAuth(req, res, next);
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!sessions.has(token)) return res.status(401).json({ errors: ["Алдымен жүйеге кіріңіз"] });
  next();
}

// ---------- API ----------
app.use(express.json({ limit: "300kb" }));

app.post("/api/login", (req, res) => {
  const f = loginFails.get(req.ip);
  if (f && f.n >= 8 && f.until > Date.now()) {
    return res.status(429).json({ errors: ["Тым көп қате әрекет. 15 минуттан соң қайталаңыз"] });
  }
  setTimeout(() => { // кішкене кідіріс: құпия сөзді іріктеуден қорғау
    if (!safeEqual((req.body || {}).password || "", ADMIN_PASSWORD)) {
      const cur = loginFails.get(req.ip) || { n: 0, until: 0 };
      cur.n++; cur.until = Date.now() + 15 * 60 * 1000;
      loginFails.set(req.ip, cur);
      return res.status(401).json({ errors: ["Құпия сөз қате"] });
    }
    loginFails.delete(req.ip);
    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    res.json({ token });
  }, 400);
});

app.post("/api/logout", (req, res) => {
  sessions.delete((req.headers.authorization || "").replace("Bearer ", ""));
  res.status(204).end();
});

// --- Пәндер ---
app.get("/api/subjects", (req, res) => res.json(db.subjects));

app.post("/api/subjects", requireAuth, (req, res) => {
  const name = String((req.body || {}).name || "").trim();
  if (name.length < 1 || name.length > 30) return res.status(400).json({ errors: ["Пән атауы 1-30 таңба болуы керек"] });
  if (db.subjects.length >= MAX_SUBJECTS) return res.status(400).json({ errors: [`Пәндер саны ${MAX_SUBJECTS}-тен аспауы керек`] });
  if (db.subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ errors: ["Мұндай пән бар"] });
  }
  const subject = { id: "s" + crypto.randomBytes(3).toString("hex"), name };
  db.subjects.push(subject);
  saveDb();
  res.status(201).json(subject);
});

app.delete("/api/subjects/:id", requireAuth, (req, res) => {
  const idx = db.subjects.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errors: ["Пән табылмады"] });
  if (db.subjects.length <= 1) return res.status(400).json({ errors: ["Кемінде бір пән қалуы керек"] });
  const [removed] = db.subjects.splice(idx, 1);
  db.students.forEach((s) => delete s.scores[removed.id]);
  saveDb();
  res.status(204).end();
});

// --- Студенттер ---
app.get("/api/students", readGuard, (req, res) => {
  const q = String(req.query.search || "").trim().toLowerCase();
  const group = String(req.query.group || "");
  const sort = String(req.query.sort || "");
  let list = withRanks(db.students);
  if (group) list = list.filter((s) => (s.group || "") === group);
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
  if (sort === "avg_desc") list.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  else if (sort === "avg_asc") list.sort((a, b) => (a.average ?? 101) - (b.average ?? 101));
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "kk"));
  res.json(list);
});

// Бір студент + оның тобының пән бойынша орташасы (салыстыру үшін)
app.get("/api/students/:id", readGuard, (req, res) => {
  const all = withRanks(db.students);
  const s = all.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ errors: ["Студент табылмады"] });
  const members = all.filter((x) => (x.group || "") === (s.group || ""));
  res.json({ ...s, groupSize: members.length, groupAverages: subjectAverages(members) });
});

app.post("/api/students", requireAuth, (req, res) => {
  const { errors, value } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });
  const student = { id: crypto.randomUUID(), ...value };
  db.students.push(student);
  saveDb();
  res.status(201).json(withRanks(db.students).find((s) => s.id === student.id));
});

app.put("/api/students/:id", requireAuth, (req, res) => {
  const idx = db.students.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errors: ["Студент табылмады"] });
  const { errors, value } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });
  db.students[idx] = { id: db.students[idx].id, ...value };
  saveDb();
  res.json(withRanks(db.students).find((s) => s.id === db.students[idx].id));
});

app.delete("/api/students/:id", requireAuth, (req, res) => {
  const idx = db.students.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errors: ["Студент табылмады"] });
  db.students.splice(idx, 1);
  saveDb();
  res.status(204).end();
});

// --- CSV импорты (клиент CSV-ны оқып, JSON жібереді) ---
app.post("/api/import", requireAuth, (req, res) => {
  const rows = (req.body || {}).rows;
  if (!Array.isArray(rows)) return res.status(400).json({ errors: ["Деректер дұрыс емес"] });
  if (rows.length > 500) return res.status(400).json({ errors: ["Бір рет 500 жолдан көп импорттауға болмайды"] });

  const byName = new Map(db.subjects.map((s) => [s.name.toLowerCase(), s.id]));
  const ignored = new Set();
  const errors = [];
  let added = 0;

  rows.forEach((r, i) => {
    const scores = {};
    for (const [k, v] of Object.entries(r.scores || {})) {
      const id = byName.get(String(k).trim().toLowerCase());
      if (id) scores[id] = v;
      else ignored.add(k);
    }
    const { errors: e, value } = validate({ name: r.name, group: r.group, scores });
    if (e.length) errors.push(`${i + 2}-жол: ${e.join("; ")}`);
    else {
      db.students.push({ id: crypto.randomUUID(), ...value });
      added++;
    }
  });
  if (added) saveDb();
  res.json({ added, errors: errors.slice(0, 20), errorCount: errors.length, ignored: [...ignored] });
});

// --- Статистика (топ бойынша сүзуге болады) ---
app.get("/api/stats", readGuard, (req, res) => {
  const group = String(req.query.group || "");
  const all = withRanks(db.students);
  const groups = [...new Set(all.map((s) => s.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, "kk"));
  const list = group ? all.filter((s) => (s.group || "") === group) : all;

  const distribution = { "Өте жақсы": 0, "Жақсы": 0, "Қанағаттанарлық": 0, "Қанағаттанарлықсыз": 0, "Баға жоқ": 0 };
  list.forEach((s) => distribution[s.level]++);

  const graded = list.filter((s) => s.average !== null).sort((a, b) => b.average - a.average);
  const classAverage = graded.length ? round2(graded.reduce((a, s) => a + s.average, 0) / graded.length) : 0;

  res.json({
    count: list.length,
    classAverage,
    best: graded[0] || null,
    worst: graded.length ? graded[graded.length - 1] : null,
    distribution,
    subjectAverages: subjectAverages(list),
    groups,
  });
});

// ---------- Чат (Server-Sent Events: хабарламалар бәріне бірден жетеді) ----------
const CHAT_FILE = path.join(DATA_DIR, "chat.json");
const CHAT_MAX = 200;
let chat = [];
try {
  if (fs.existsSync(CHAT_FILE)) chat = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
} catch (e) {
  chat = [];
}
const chatClients = new Set();
const lastPost = new Map(); // IP -> соңғы хабарлама уақыты (спамнан қорғау)

function saveChat() {
  const tmp = CHAT_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(chat), "utf8");
  fs.renameSync(tmp, CHAT_FILE);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  chatClients.forEach((client) => client.write(payload));
}

// Байланыс үзілмеуі үшін әр 25 секунд сайын "ping"
setInterval(() => {
  chatClients.forEach((client) => client.write(": ping\n\n"));
  const old = Date.now() - 60000;
  lastPost.forEach((t, ip) => { if (t < old) lastPost.delete(ip); });
}, 25000);

app.get("/api/chat/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  res.write(`event: init\ndata: ${JSON.stringify(chat)}\n\n`);
  chatClients.add(res);
  req.on("close", () => chatClients.delete(res));
});

app.post("/api/chat", (req, res) => {
  const teacher = sessions.has((req.headers.authorization || "").replace("Bearer ", ""));
  const now = Date.now();
  if (now - (lastPost.get(req.ip) || 0) < 1500) {
    return res.status(429).json({ errors: ["Тым жиі жазып жатырсыз, сәл күтіңіз"] });
  }
  const body = req.body || {};
  const name = teacher ? "Мұғалім" : String(body.name || "").trim();
  const text = String(body.text || "").trim();

  const errors = [];
  if (name.length < 2 || name.length > 20) errors.push("Аты 2-20 таңба болуы керек");
  if (!teacher && name.toLowerCase() === "мұғалім") errors.push("Бұл атпен жазуға болмайды");
  if (text.length < 1 || text.length > 300) errors.push("Хабарлама 1-300 таңба болуы керек");
  if (errors.length) return res.status(400).json({ errors });

  const message = { id: crypto.randomUUID(), name, text, time: new Date().toISOString(), teacher };
  chat.push(message);
  if (chat.length > CHAT_MAX) chat.splice(0, chat.length - CHAT_MAX);
  lastPost.set(req.ip, now);
  saveChat();
  broadcast("message", message);
  res.status(201).json(message);
});

// Хабарламаны мұғалім өшіре алады
app.delete("/api/chat/:id", requireAuth, (req, res) => {
  const idx = chat.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ errors: ["Хабарлама табылмады"] });
  chat.splice(idx, 1);
  saveChat();
  broadcast("delete", { id: req.params.id });
  res.status(204).end();
});

// ---------- Фронтенд (статикалық файлдар) ----------
// Chart.js интернетсіз де жұмыс істеуі үшін node_modules-тен беріледі
app.use("/vendor/chart.js", express.static(path.join(__dirname, "node_modules/chart.js/dist")));
app.use(express.static(path.join(__dirname, "public")));

// JSON қателері
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ errors: ["Дұрыс емес JSON"] });
  if (err.type === "entity.too.large") return res.status(413).json({ errors: ["Файл тым үлкен"] });
  console.error(err);
  res.status(500).json({ errors: ["Сервер қатесі"] });
});

app.listen(PORT, () => {
  console.log(`Сервер іске қосылды: http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.log("Мұғалім құпия сөзі (әдепкі): admin123");
});
