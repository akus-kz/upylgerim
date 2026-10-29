// ===== Өз иконкалар жинағы (SVG) =====
// Түсі currentColor арқылы беріледі, сондықтан жарық/қараңғы тақырыпқа өзі бейімделеді.

const ICON_PATHS = {
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 16V5"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chat: '<path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-8l-5 3.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M8 9.5h8M8 13h5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>',
  login: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l4 4-4 4"/><path d="M14 12H4"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M18 14.2a5 5 0 0 1 3.5 4.8"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/><path d="M3 20h18"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H4v1a3 3 0 0 0 4 2.8M16 6h4v1a3 3 0 0 1-4 2.8"/><path d="M12 13v4M8.5 20h7M9.5 17h5"/>',
  trendDown: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4h5v3"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

function icon(name, size = 18) {
  const span = document.createElement("span");
  span.className = "ico";
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
  return span;
}

// Түймедегі мәтінді "иконка + мәтін" етіп ауыстыру
function setLabel(el, name, text, size = 16) {
  el.textContent = "";
  el.appendChild(icon(name, size));
  if (text) el.append(text);
}

// 1-3 орынға арналған түрлі-түсті медаль (күміс/алтын/қола)
function medal(rank) {
  const [fill, edge] = { 1: ["#f5b301", "#b88700"], 2: ["#aab4c0", "#7b8794"], 3: ["#d48a4a", "#9a5d27"] }[rank];
  const span = document.createElement("span");
  span.className = "ico medal";
  span.title = rank + " орын";
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">` +
    `<path d="M6.5 1.5h4l2.5 7.5h-4z" fill="#ef4444"/><path d="M17.5 1.5h-4L11 9h4z" fill="#3b82f6"/>` +
    `<circle cx="12" cy="15.5" r="7" fill="${fill}" stroke="${edge}" stroke-width="1.5"/>` +
    `<circle cx="12" cy="15.5" r="4.6" fill="none" stroke="${edge}" stroke-opacity=".45" stroke-width=".8"/>` +
    `<text x="12" y="18.7" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="Arial,sans-serif">${rank}</text>` +
    `</svg>`;
  return span;
}

// HTML-дегі <i data-icon="..."> элементтерін иконкаға айналдыру
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.replaceWith(icon(el.dataset.icon, Number(el.dataset.size) || 16));
  });
}
hydrateIcons();
