// ===== Чат: EventSource арқылы жаңа хабарламалар бірден келеді =====
// ($, api, toast, isAdmin app.js ішінде жарияланған)

const CHAT_LIMIT = 200;
let chatMessages = [];
let chatOpen = false;
let unread = 0;

// Өз хабарламаларымның id-лері (оларды оң жақта көрсету үшін)
let myIds = new Set();
try { myIds = new Set(JSON.parse(localStorage.getItem("chatMyIds") || "[]")); } catch (e) {}
function rememberMine(id) {
  myIds.add(id);
  try { localStorage.setItem("chatMyIds", JSON.stringify([...myIds].slice(-CHAT_LIMIT))); } catch (e) {}
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderChat(forceScroll = false) {
  const box = $("chatMessages");
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
  box.innerHTML = "";

  if (!chatMessages.length) {
    const p = document.createElement("p");
    p.className = "chat-empty";
    p.textContent = "Әлі хабарлама жоқ. Бірінші болып жазыңыз!";
    box.appendChild(p);
  }

  chatMessages.forEach((m) => {
    const div = document.createElement("div");
    div.className = "msg" + (myIds.has(m.id) ? " mine" : "") + (m.teacher ? " teacher" : "");

    const head = document.createElement("div");
    head.className = "msg-head";
    const name = document.createElement("b");
    name.textContent = m.name; // textContent: басқа студенттің HTML-ы жұмыс істемейді
    head.appendChild(name);
    if (m.teacher) {
      const tag = document.createElement("span");
      tag.className = "msg-tag";
      tag.textContent = "мұғалім";
      head.appendChild(tag);
    }
    const time = document.createElement("span");
    time.textContent = formatTime(m.time);
    head.appendChild(time);

    if (isAdmin()) {
      const del = document.createElement("button");
      del.className = "msg-del";
      del.appendChild(icon("close", 12));
      del.title = "Өшіру";
      del.onclick = async () => {
        try { await api("/api/chat/" + m.id, { method: "DELETE" }); }
        catch (e) { toast(e.message, true); }
      };
      head.appendChild(del);
    }

    const text = document.createElement("div");
    text.className = "msg-text";
    text.textContent = m.text;
    div.append(head, text);
    box.appendChild(div);
  });

  $("chatNameRow").hidden = isAdmin(); // мұғалім әрдайым "Мұғалім" деген атпен жазады
  if (forceScroll || atBottom) box.scrollTop = box.scrollHeight;
}

function updateBadge() {
  const b = $("chatBadge");
  b.textContent = unread > 99 ? "99+" : unread;
  b.hidden = unread === 0;
}

function toggleChat(open) {
  chatOpen = open;
  $("chatPanel").hidden = !open;
  if (open) {
    unread = 0;
    updateBadge();
    renderChat(true);
    $("chatText").focus();
  }
}

async function sendChat() {
  const text = $("chatText").value.trim();
  if (!text) return;
  const name = $("chatName").value.trim();
  if (!isAdmin() && name.length < 2) {
    toast("Алдымен атыңызды жазыңыз", true);
    $("chatName").focus();
    return;
  }
  try {
    const m = await api("/api/chat", { method: "POST", body: JSON.stringify({ name, text }) });
    rememberMine(m.id);
    $("chatText").value = "";
    renderChat(true);
  } catch (e) {
    toast(e.message, true);
  }
}

// ---------- Серверге қосылу ----------
const events = new EventSource("/api/chat/stream"); // үзілсе, браузер өзі қайта қосылады

events.addEventListener("init", (e) => {
  chatMessages = JSON.parse(e.data);
  renderChat(true);
});

events.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (chatMessages.some((x) => x.id === m.id)) return;
  chatMessages.push(m);
  if (chatMessages.length > CHAT_LIMIT) chatMessages.shift();
  renderChat();
  if (!chatOpen && !myIds.has(m.id)) {
    unread++;
    updateBadge();
  }
});

events.addEventListener("delete", (e) => {
  const { id } = JSON.parse(e.data);
  chatMessages = chatMessages.filter((m) => m.id !== id);
  renderChat();
});

// ---------- Оқиғалар ----------
try { $("chatName").value = localStorage.getItem("chatName") || ""; } catch (e) {}
$("chatName").addEventListener("change", () => {
  try { localStorage.setItem("chatName", $("chatName").value.trim()); } catch (e) {}
});
$("chatFab").onclick = () => toggleChat(!chatOpen);
$("chatClose").onclick = () => toggleChat(false);
$("chatSend").onclick = sendChat;
$("chatText").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
renderChat();
