// Koi Garden: Anonymous play statistics for the owner's dashboard, only after the player says yes.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Play statistics ----------
   How far players get, which levels are hardest and who comes back, shown in the Koi Garden tab of the owner's dashboard
   (some-work-station, apps/api/src/koi-routes.ts). Off until the player says yes: they are asked once, from their second
   session, and can change it in Settings. Only the iPhone app sends, never the web version. Each phone gets a random ID;
   no name, e-mail, advertising ID or progress details beyond levels, scores and choices. Events wait in localStorage while
   the phone is offline, at most STATS_MAX_QUEUE of them. */
const STATS_URL = "https://dashbord.cliffordcoaching.no/api-proxy/koi/events";
// Keep in step with MARKETING_VERSION in Xcode
const APP_VERSION = "1.0";
const STATS_MAX_QUEUE = 300;
const STATS_BATCH = 50;
// A new session starts when the app comes back after this long in the background
const SESSION_GAP_MS = 30 * 60 * 1000;
// on: null = not asked yet, true = yes, false = no
let stats = { on: null, id: "" };
let statsQueue = [];
try {
  stats = Object.assign(stats, JSON.parse(localStorage.getItem("mb-stats") || "{}"));
  statsQueue = JSON.parse(localStorage.getItem("mb-stats-queue") || "[]");
  if (!Array.isArray(statsQueue)) statsQueue = [];
} catch (e) {}
const saveStats = () => { try { localStorage.setItem("mb-stats", JSON.stringify(stats)); } catch (e) {} };
const saveStatsQueue = () => { try { localStorage.setItem("mb-stats-queue", JSON.stringify(statsQueue)); } catch (e) {} };
const statsSending = () => stats.on === true && !!stats.id && nativeApp;

function newInstallId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const hex = n => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}

function setStats(on) {
  stats.on = on;
  // Saying no forgets the ID and anything not yet sent; saying yes again starts as a new player
  if (on && !stats.id) stats.id = newInstallId();
  if (!on) { stats.id = ""; statsQueue = []; saveStatsQueue(); }
  saveStats();
  syncStatsUI();
  if (on) { track("session"); flushStats(); }
}

// kind and the fields the dashboard knows: level, result, stars and data (small numbers and short codes)
function track(kind, fields) {
  if (!statsSending()) return;
  statsQueue.push(Object.assign({ kind, t: Date.now() }, fields));
  if (statsQueue.length > STATS_MAX_QUEUE) statsQueue.splice(0, statsQueue.length - STATS_MAX_QUEUE);
  saveStatsQueue();
  if (statsQueue.length >= 20) flushStats();
}

let statsBusy = false;
function flushStats() {
  if (!statsSending() || statsBusy || !statsQueue.length) return;
  const batch = statsQueue.slice(0, STATS_BATCH), now = Date.now();
  const events = batch.map(e => {
    const out = Object.assign({}, e, { ago: Math.max(0, Math.round((now - e.t) / 1000)) });
    delete out.t;
    return out;
  });
  statsBusy = true;
  // text/plain keeps it a simple request, so the app needs no CORS preflight
  fetch(STATS_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ install: stats.id, version: APP_VERSION, events }), keepalive: true })
    .then(r => {
      // Sent, or refused for good: either way these are done. Busy (429) or down (5xx): try again later.
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) {
        statsQueue.splice(0, batch.length);
        saveStatsQueue();
      }
    })
    .catch(() => {})
    .finally(() => { statsBusy = false; });
}
setInterval(flushStats, 60000);
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); flushStats(); return; }
  if (hiddenAt && Date.now() - hiddenAt > SESSION_GAP_MS) track("session");
});

function syncStatsUI() {
  $("statsRow").hidden = !nativeApp;
  $("statsOn").checked = stats.on === true;
}
$("statsOn").addEventListener("change", e => setStats(e.target.checked));
$("statsYes").addEventListener("click", () => { setStats(true); closeOverlay(); });
$("statsNo").addEventListener("click", () => { setStats(false); closeOverlay(); });

// Asked once, from the second session, when nothing else is open
function maybeAskStats() {
  if (!nativeApp || stats.on !== null || firstSession()) return;
  setTimeout(() => { if (overlay.hidden && stats.on === null) openCard("statsCard"); }, 1500);
}
