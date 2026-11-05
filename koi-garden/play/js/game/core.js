// Koi Garden: Constants, shapes, lines, level data, the saved state and the iCloud backup.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

const N = 9;
const COLORS = 6;
const KOI = 7;
const ROCK = 8;
const UNDO_PER_GAME = 2;
const SWAP_COST = 20;
const HINT_COST = 15;
// Pearls buy help in a Journey level: a joker koi in the gold slot, or five more pieces when you run out
const JOKER_PRICE = { arrow: 60, ripple: 90, rainbow: 120 };
const MORE_PIECES = 5, MORE_PIECES_COST = 80;
const AD_GAP_MS = 150000;       // at least 2.5 minutes between ad breaks
const AD_AFTER_REWARD_MS = 90000;
const FREE_ROUNDS = 2;          // no ad break in the first rounds of a session
// No 3×3 block: it filled a whole square at once and gave easy points
const SHAPE_SRC = [
  "x", "xx", "x\nx", "xxx", "x\nx\nx", "xxxx", "x\nx\nx\nx", "xxxxx", "x\nx\nx\nx\nx",
  "xx\nxx", "xxx\nxxx", "xx\nxx\nxx",
  "xx\nx.", "xx\n.x", "x.\nxx", ".x\nxx",
  "x.\n.x", ".x\nx.", "x..\n.x.\n..x", "..x\n.x.\nx..",
  "x..\nx..\nxxx", "..x\n..x\nxxx", "xxx\nx..\nx..", "xxx\n..x\n..x",
  "xxx\n.x.", ".x.\nxxx", "x.\nxx\nx.", ".x\nxx\n.x", ".x.\nxxx\n.x.",
  "xx.\n.xx", ".xx\nxx.", "x.\nxx\n.x", ".x\nxx\nx.",
  "x.\nx.\nxx", ".x\n.x\nxx", "xx\nx.\nx.", "xx\n.x\n.x",
  "xxx\nx..", "xxx\n..x", "x..\nxxx", "..x\nxxx"
].map(s => s.split("\n"));
const stonesIn = g => g.join("").split("x").length - 1;
// Big and awkward pieces show up less often
const WEIGHTS = SHAPE_SRC.map(g => {
  const n = stonesIn(g), w = g[0].length, h = g.length;
  return (w === 5 || h === 5) ? 0.6 : n === 1 ? 0.6 : 1;
});
const shapeCache = new Map();
function parse(grid) {
  const key = grid.join("/");
  if (shapeCache.has(key)) return shapeCache.get(key);
  const cells = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "x") cells.push([r, c]); }));
  const sh = { cells, h: grid.length, w: grid[0].length, grid };
  shapeCache.set(key, sh);
  return sh;
}
function rotateGrid(g) {
  const h = g.length, w = g[0].length, out = [];
  for (let r = 0; r < w; r++) { let row = ""; for (let c = 0; c < h; c++) row += g[h - 1 - c][r]; out.push(row); }
  return out;
}

// Every line a player can clear: 9 rows, 9 columns, 9 beds of 3×3
const LINES = [];
for (let r = 0; r < N; r++) LINES.push({ kind: "row", cells: [...Array(N)].map((_, c) => r * N + c) });
for (let c = 0; c < N; c++) LINES.push({ kind: "col", cells: [...Array(N)].map((_, r) => r * N + c) });
const BEDS = [];
for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br * 3 + r) * N + bc * 3 + c);
  const bed = { kind: "bed", cells, br, bc };
  BEDS.push(bed);
  LINES.push(bed);
}
const TUT_GAP = 4 * N + 4;

/* ---------- Journey levels live in levels.js, shared with the level tuner ---------- */
const KL = window.KoiLevels;
const levelDef = n => KL.levelDef(n);
const BAMBOO = KL.BAMBOO, HOLE = KL.HOLE, FROG = KL.FROG, LEAF = KL.LEAF;
const chapterOf = KL.chapterOf, chapterName = KL.chapterName, PER_CHAPTER = KL.PER;
// Finishing a chapter's last level gives a pearl bonus
const CHAPTER_PEARLS = 100;
// One koi per level for the collection. Top-down koi sprites, head pointing right, in img/koi/
const KOI_TYPES = [
  { name: "Kohaku", img: "img/koi/01-kohaku.png" },
  { name: "Showa", img: "img/koi/02-showa.png" },
  { name: "Asagi", img: "img/koi/03-asagi.png" },
  { name: "Ogon", img: "img/koi/04-ogon.png" },
  { name: "Yamabuki", img: "img/koi/05-yamabuki.png" },
  { name: "Chagoi", img: "img/koi/06-chagoi.png" },
  { name: "Bekko", img: "img/koi/07-bekko.png" },
  { name: "Shusui", img: "img/koi/08-shusui.png" },
  { name: "Kumonryu", img: "img/koi/09-kumonryu.png" },
  { name: "Hi Utsuri", img: "img/koi/10-hi-utsuri.png" },
  { name: "Ki Utsuri", img: "img/koi/11-ki-utsuri.png" },
  { name: "Goshiki", img: "img/koi/12-goshiki.png" },
  { name: "Kujaku", img: "img/koi/13-kujaku.png" },
  { name: "Platinum", img: "img/koi/14-platinum.png" },
  { name: "Ochiba", img: "img/koi/15-ochiba.png" }
];
// Rare koi come from the Daily streak, one at each milestone
const RARE_KOI = [
  { name: "Tancho", img: "img/koi/16-tancho.png", at: 7 },
  { name: "Kin Showa", img: "img/koi/17-kin-showa.png", at: 14 },
  { name: "Ginrin Kohaku", img: "img/koi/18-ginrin-kohaku.png", at: 21 },
  { name: "Kikokuryu", img: "img/koi/19-kikokuryu.png", at: 30 }
];
// One koi for finishing each of chapters 2-10, painted in code (assets/koi/make_chapter_koi.py)
const CHAPTER_KOI = [
  { name: "Sanke", img: "img/koi/20-sanke.png", chapter: 2 },
  { name: "Shiro Utsuri", img: "img/koi/21-shiro-utsuri.png", chapter: 3 },
  { name: "Ai Goromo", img: "img/koi/22-ai-goromo.png", chapter: 4 },
  { name: "Soragoi", img: "img/koi/23-soragoi.png", chapter: 5 },
  { name: "Benigoi", img: "img/koi/24-benigoi.png", chapter: 6 },
  { name: "Karashigoi", img: "img/koi/25-karashigoi.png", chapter: 7 },
  { name: "Gin Matsuba", img: "img/koi/26-gin-matsuba.png", chapter: 8 },
  { name: "Hariwake", img: "img/koi/27-hariwake.png", chapter: 9 },
  { name: "Midorigoi", img: "img/koi/28-midorigoi.png", chapter: 10 }
];
// One koi for each weekly festival, also painted in code. Each comes only by reaching the last goal of its festival week.
const FESTIVAL_KOI = [
  { name: "Orenji Ogon", img: "img/koi/29-orenji-ogon.png", festival: "lantern", festName: "Lantern Festival" },
  { name: "Kikusui", img: "img/koi/30-kikusui.png", festival: "moon", festName: "Moon Viewing" },
  { name: "Sakura Ogon", img: "img/koi/31-sakura-ogon.png", festival: "sakura", festName: "Sakura Week" },
  { name: "Kin Ki Utsuri", img: "img/koi/32-kin-ki-utsuri.png", festival: "firefly", festName: "Firefly Night" }
];
// Every koi has one index, kept for good since saved progress stores them: 0-14 from Journey levels, 15-18 rare,
// 19-27 from chapters, 28-31 from festivals
const ALL_KOI = [...KOI_TYPES, ...RARE_KOI.map(r => ({ ...r, rare: true })), ...CHAPTER_KOI.map(k => ({ ...k, chapterKoi: true })),
  ...FESTIVAL_KOI.map(k => ({ ...k, festivalKoi: true }))];
const rareIndex = r => KOI_TYPES.length + RARE_KOI.indexOf(r);
const CHAPTER_KOI_START = KOI_TYPES.length + RARE_KOI.length;
const FESTIVAL_KOI_START = CHAPTER_KOI_START + CHAPTER_KOI.length;
// The koi for finishing chapter c, or -1 when that chapter has none
const chapterKoiIndex = c => CHAPTER_KOI.some(k => k.chapter === c) ? CHAPTER_KOI_START + CHAPTER_KOI.findIndex(k => k.chapter === c) : -1;
// Players who finished chapters before chapter koi existed get theirs; true when any were added
function grantChapterKoi() {
  let added = false;
  CHAPTER_KOI.forEach(k => {
    const i = chapterKoiIndex(k.chapter);
    if (journey.unlocked > k.chapter * PER_CHAPTER && !journey.koi.includes(i)) { journey.koi.push(i); added = true; }
  });
  return added;
}
const koiImages = ALL_KOI.map(k => { const im = new Image(); im.src = k.img; return im; });
// Joker koi work like Candy Crush specials: bigger moves earn stronger jokers.
// Each uses a koi sprite from the collection and lands on any empty cell.
const JOKERS = {
  arrow: { name: "Arrow Koi", koi: 7, short: "Row + column", does: "clears its whole row and column",
    explain: "Drop it on any empty spot. It shoots out along that spot's row and column and clears every stone on both lines." },
  ripple: { name: "Ripple Koi", koi: 8, short: "5×5 area", does: "clears a 5×5 area around it",
    explain: "Drop it on any empty spot. A wave spreads two spots in every direction and clears every stone in that 5×5 square." },
  rainbow: { name: "Rainbow Koi", koi: 11, short: "One colour", does: "clears every stone in the colour it lands next to",
    explain: "Drop it next to the colour you want gone. It clears every stone of that colour, all over the board." }
};
const MAX_JOKERS = 3;
// Win streak: Journey levels won in a row. Steps 1, 3 and 5 start the next level with a joker ready.
// Losing a level ends the current, unless the player keeps going with a video and wins.
const CURRENT_STEPS = [{ at: 1, joker: "arrow" }, { at: 3, joker: "ripple" }, { at: 5, joker: "rainbow" }];
const CURRENT_MAX = 5;
const currentJokers = s => CURRENT_STEPS.filter(st => s >= st.at).map(st => st.joker);
const jokerList = list => list.map(t => JOKERS[t].name.replace(" Koi", "")).join(" + ") + " Koi";
// Clearing the whole board at once
const STILL_BONUS = 150;
const NEW_IN = {
  1: "Your first level. Score points by placing pieces and clearing lines.",
  2: "New: golden koi stones. Clear the row, column or square they sit in to set them free.",
  4: "New goal: Harmony. Fill a 3×3 square with stones of one colour.",
  6: "New goal: clear every starting stone. They wear a gold ring with a dot, so you can tell them from your own.",
  5: "Hard level: fewer spare pieces, and double pearls if you make it.",
  10: "Hard level: plan which squares to clear first. Double pearls.",
  11: "New: ice. A frozen stone needs two clears. The first breaks the ice. A joker koi takes it in one go.",
  15: "Chapter finale and a Hard level. Take a breath and plan ahead.",
  16: "New: bamboo. Every few moves without a clear, it grows into an empty spot next to it. Clear it before it spreads.",
  17: "Bamboo grows only while you miss. Each clear resets its count.",
  31: "New: lotus flowers float on empty spots. Fill the row, column or square under a flower and clear it to collect the flower.",
  46: "New: shaped boards. The water is part of no line, so rows and columns through it are shorter, and easier to fill.",
  61: "New: blossom stones. When a clear takes one, it bursts and takes every stone around it too. Two side by side set each other off.",
  76: "New goal: frogs. Every few moves they hop to a nearby spot. Clear the row, column or square a frog sits in to send it home.",
  91: "Tea House mixes everything you have met so far. Look at the goal first.",
  106: "New: maple leaves. Every few moves a leaf drifts onto an empty spot. Clear it like any stone before the board fills up.",
  121: "Snow Temple: more of the stones are frozen. Each needs two clears.",
  136: "The last chapter, Golden Pagoda: everything at once. Take a breath before each Hard level."
};
const goalTarget = L => KL.goalTarget(L);
// What is still missing, in words: "2 koi", "1 lotus flower", "40 points"
function goalShortBy(L, left) {
  if (L.goal === "bamboo") left = bambooLeft();
  if (left <= 0) return "";
  const words = { score: ["point", "points"], koi: ["koi", "koi"], harmony: ["Harmony square", "Harmony squares"],
    clear: ["starting stone", "starting stones"], lotus: ["lotus flower", "lotus flowers"], bamboo: ["bamboo", "bamboo"],
    frog: ["frog", "frogs"] }[L.goal];
  return `${left} ${words[left === 1 ? 0 : 1]}`;
}
const bambooLeft = () => S.board.filter(v => v === BAMBOO).length;
function goalText(L) {
  const t = goalTarget(L);
  return L.goal === "score" ? `Reach ${t} points`
    : L.goal === "koi" ? `Free ${t} golden koi`
    : L.goal === "harmony" ? `Make ${t} Harmony ${t === 1 ? "square" : "squares"}`
    : L.goal === "bamboo" ? "Clear all the bamboo"
    : L.goal === "lotus" ? `Collect ${t} lotus flowers`
    : L.goal === "frog" ? `Send ${t} frogs home`
    : `Clear all ${t} starting stones`;
}
function goalProgress() {
  const L = levelDef(S.level);
  return L.goal === "score" ? S.score : L.goal === "koi" ? S.koi : L.goal === "harmony" ? S.harmony
    : L.goal === "lotus" ? S.lotusGot : L.goal === "frog" ? (S.frogs || 0) : L.goal === "bamboo" ? (bambooLeft() ? 0 : goalTarget(L))
    : L.stones - Object.keys(S.preset).length;
}
function goalShort() {
  const L = levelDef(S.level);
  if (L.goal === "bamboo") return `Bamboo ${bambooLeft()}`;
  const name = { score: "Points", koi: "Koi", harmony: "Harmony", clear: "Stones", lotus: "Lotus", frog: "Frogs" }[L.goal];
  return `${name} ${Math.min(goalProgress(), goalTarget(L))}/${goalTarget(L)}`;
}
const goalMet = () => goalProgress() >= goalTarget(levelDef(S.level));
const piecesLeft = () => (S.limit - S.dealt) + S.tray.filter(Boolean).length;

// Daily challenge: one seed per calendar day gives everyone the same board and pieces
const DAILY_PIECES = 30;
const DAILY_EPOCH = Date.UTC(2026, 9, 1);
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return keyOf(d); };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
function today() {
  const d = new Date();
  return {
    key: keyOf(d),
    num: Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY_EPOCH) / 864e5) + 1,
    label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  };
}
function hashSeed(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h | 0;
}
// mulberry32
function step32(a) {
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seeded(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; return step32(a); }; }
// The daily keeps its generator state in the game, so a reload continues the same sequence
function rnd() {
  if (!S || S.mode !== "daily") return Math.random();
  S.rng = (S.rng + 0x6D2B79F5) | 0;
  return step32(S.rng);
}

const WORDS = ["Clear", "Still", "In flow", "Steady", "Present", "Calm mind", "Unshakeable"];
const TIPS = [
  "Focus on the next move, not the score. Process beats outcome.",
  "Breathe out longer than you breathe in. It tells your body it is safe.",
  "A mistake is information, not a verdict about you.",
  "Name what you feel. Putting words on it loosens its grip.",
  "Control what you can control: your next action.",
  "Confidence grows from small wins you notice. Notice this one.",
  "When you rush, slow down your breath first and your hands will follow.",
  "Talk to yourself like you would talk to a good friend under pressure."
];
const QUOTES = [
  "“Muddy water is best cleared by leaving it alone.”",
  "“Pressure is a privilege.” — Billie Jean King",
  "“Between stimulus and response there is a space.” — Viktor Frankl",
  "“The obstacle in the path becomes the path.”",
  "“Nature does not hurry, yet everything is accomplished.” — Lao Tzu"
];

const $ = id => document.getElementById(id);
const boardEl = $("board"), trayEl = $("tray"), overlay = $("overlay");
const slots = [...trayEl.querySelectorAll(".slot:not(.joker-slot)")];
const jokerSlot = $("jokerSlot");
const bedEls = BEDS.map(b => {
  const d = document.createElement("div");
  d.className = "bed" + ((b.br + b.bc) % 2 ? " alt" : "");
  d.style.gridRow = `${b.br * 3 + 1} / span 3`;
  d.style.gridColumn = `${b.bc * 3 + 1} / span 3`;
  boardEl.appendChild(d);
  return d;
});
const cellEls = [];
for (let i = 0; i < N * N; i++) {
  const d = document.createElement("div");
  d.className = "cell";
  d.style.gridRow = String(Math.floor(i / N) + 1);
  d.style.gridColumn = String((i % N) + 1);
  boardEl.appendChild(d);
  cellEls.push(d);
}

// Rule diagrams in the help card
document.querySelectorAll(".mini").forEach(m => {
  const demo = m.dataset.demo;
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N;
    const el = document.createElement("i");
    const alt = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 1;
    const on = demo === "row" ? r === 4 : demo === "col" ? c === 4 : (r >= 3 && r < 6 && c >= 3 && c < 6);
    el.className = on ? "on" : alt ? "alt" : "";
    m.appendChild(el);
  }
});

let S;
const G = { journey: null, endless: null, daily: null };
let daily = { last: "", streak: 0, best: {}, night: false, restoredOn: "" };
let journey = { unlocked: 1, stars: {}, pearls: 0, fails: {}, koi: [], streak: 0, gift: "", owned: [] };
let look = { board: "sand", stones: "river" };
let prefs = { big: false, calm: false };
let noAds = false, sessions = 0;
let lanterns = { week: "", count: 0, claimed: [] };
let tasks = { day: "", list: [], opened: false };
let best = 0, muted = false, tutDone = false, promised = false;
let remind = { on: false, time: "19:00" };
let garden = "auto";
let clearing = {};
// Ad pacing lives in memory: a new session starts fresh, as it would in the app
const ads = { lastBreak: 0, lastReward: 0, rounds: 0 };
try {
  best = +localStorage.getItem("mb-best-9") || 0;
  muted = localStorage.getItem("mb-muted") === "1";
  tutDone = localStorage.getItem("mb-tut") === "done";
  promised = localStorage.getItem("mb-promise") === "1";
  daily = Object.assign(daily, JSON.parse(localStorage.getItem("mb-daily") || "{}"));
  journey = Object.assign(journey, JSON.parse(localStorage.getItem("mb-journey") || "{}"));
  // Players who reached a 7-day streak before rare koi existed get their Tancho
  if ((daily.moon || daily.night) && !journey.koi.includes(15)) journey.koi.push(15);
  remind = Object.assign(remind, JSON.parse(localStorage.getItem("mb-remind") || "{}"));
  garden = localStorage.getItem("mb-garden") || "auto";
  prefs = Object.assign(prefs, JSON.parse(localStorage.getItem("mb-prefs") || "{}"));
  noAds = localStorage.getItem("mb-noads") === "1";
  lanterns = Object.assign(lanterns, JSON.parse(localStorage.getItem("mb-lanterns") || "{}"));
  tasks = Object.assign(tasks, JSON.parse(localStorage.getItem("mb-tasks") || "{}"));
  look = Object.assign(look, JSON.parse(localStorage.getItem("mb-look") || "{}"));
  sessions = (+localStorage.getItem("mb-sessions") || 0) + 1;
  localStorage.setItem("mb-sessions", String(sessions));
} catch (e) {}
const nativeApp = !!(window.MBNative && window.MBNative.isNative);
const saveDaily = () => { try { localStorage.setItem("mb-daily", JSON.stringify(daily)); } catch (e) {} cloudSoon(); };

/* ---------- iCloud backup of progress ----------
   The phone's own storage stays the source the game reads. iCloud holds a copy, so a new
   iPhone or a reinstall picks up where the player left off. "epoch" goes up on Start over,
   so an older copy on iCloud never brings back progress the player chose to clear. */
const CLOUD_KEYS = { journey: "mb-journey", daily: "mb-daily", best: "mb-best-9", tut: "mb-tut" };
const localEpoch = () => { try { return +localStorage.getItem("mb-epoch") || 0; } catch (e) { return 0; } };
function cloudSnapshot() {
  const data = { epoch: localEpoch() };
  try { Object.entries(CLOUD_KEYS).forEach(([k, key]) => { const v = localStorage.getItem(key); if (v !== null) data[k] = v; }); } catch (e) {}
  return data;
}
// How far a saved journey or daily has come, to pick the one with more progress. Pearls are left out:
// spending them (on a style or in the garden) is progress too, and an older copy with more pearls must not
// win and undo the purchase. "rev" goes up on every save, so of two copies that are otherwise even, the
// one played last wins.
const parseOr = (v, d) => { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
function journeyRank(v) {
  const j = parseOr(v, {});
  const stars = Object.values(j.stars || {}).reduce((a, b) => a + (+b || 0), 0);
  return [j.unlocked || 0, (j.koi || []).length, stars, (j.owned || []).length, ((j.garden || {}).bought || []).length, j.rev || 0];
}
const dailyRank = v => { const d = parseOr(v, {}); return [d.last || "", d.streak || 0]; };
const ahead = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
// The parts of "cloud" that are further along than "local", when both belong to the same epoch
function cloudAhead(local, cloud) {
  const take = {};
  if (!cloud || (cloud.epoch || 0) !== local.epoch) return take;
  if (cloud.journey && ahead(journeyRank(cloud.journey), journeyRank(local.journey))) take.journey = cloud.journey;
  if (cloud.daily && ahead(dailyRank(cloud.daily), dailyRank(local.daily))) take.daily = cloud.daily;
  if ((+cloud.best || 0) > (+local.best || 0)) take.best = cloud.best;
  if (cloud.tut === "done" && local.tut !== "done") take.tut = "done";
  return take;
}
// Nothing goes up to iCloud before its copy has been read, and an upload never lowers
// progress made on another device: each part keeps whichever copy is further along.
let cloudTimer = 0, cloudReady = false, cloudKnown = null;
function cloudPush() {
  clearTimeout(cloudTimer);
  if (!nativeApp || !cloudReady) return;
  const local = cloudSnapshot();
  if (cloudKnown && (cloudKnown.epoch || 0) > local.epoch) return;
  const data = { ...local, ...cloudAhead(local, cloudKnown) };
  cloudKnown = data;
  window.MBNative.cloudSave(data);
}
function cloudSoon() {
  if (!nativeApp) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(cloudPush, 2000);
}
// Reload at most once per launch, so a disagreement with iCloud can never loop
function reloadOnce() {
  try { if (sessionStorage.getItem("mb-reloaded")) return; sessionStorage.setItem("mb-reloaded", "1"); } catch (e) { return; }
  location.reload();
}
// Shown in Settings: is the iCloud copy on?
let cloudOn = null;
function syncCloudNote() {
  const el = $("cloudNote");
  if (!el) return;
  el.hidden = !nativeApp;
  el.textContent = cloudOn === false
    ? "iCloud backup is off. Sign in to iCloud in the iPhone Settings app to keep your progress on a new iPhone."
    : "Your progress is backed up to iCloud automatically. Nothing to sign in to.";
}
// Returns true when iCloud had more progress and the game needs to reload with it
async function cloudRestore() {
  const cloud = await window.MBNative.cloudLoad();
  cloudOn = !!cloud;
  syncCloudNote();
  if (!cloud) return false;
  cloudKnown = cloud;
  const local = cloudSnapshot();
  let take = cloudAhead(local, cloud);
  if ((cloud.epoch || 0) > local.epoch) {
    // Started over on another device: follow it
    take = { epoch: cloud.epoch };
    Object.keys(CLOUD_KEYS).forEach(k => { take[k] = cloud[k] === undefined ? null : cloud[k]; });
  }
  if (!Object.keys(take).length) { cloudReady = true; cloudPush(); return false; }
  try {
    Object.entries(take).forEach(([k, v]) => {
      const key = k === "epoch" ? "mb-epoch" : CLOUD_KEYS[k];
      if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, String(v));
    });
  } catch (e) { return false; }
  return true;
}
// iCloud sometimes delivers its copy a little after launch on a new iPhone. Bring it in
// straight away if this phone has no progress yet; otherwise it is merged on the next push.
const hasProgress = () => { const l = cloudSnapshot(); return !!(l.journey || l.daily || +l.best); };
function cloudChanged() {
  window.MBNative.cloudLoad().then(cloud => {
    if (!cloud) return;
    cloudKnown = cloud;
    if (!hasProgress()) cloudRestore().then(more => { if (more) reloadOnce(); });
  });
}
// The very first session has no banner and no ad breaks, so the first impression is the game itself
const firstSession = () => sessions <= 1;
const bannerOn = () => !firstSession() && !noAds;
const savePrefs = () => { try { localStorage.setItem("mb-prefs", JSON.stringify(prefs)); } catch (e) {} };
const saveJourney = () => { journey.rev = (journey.rev || 0) + 1; try { localStorage.setItem("mb-journey", JSON.stringify(journey)); } catch (e) {} cloudSoon(); };
const colorVars = v => `--c:var(--p${v});--rad:var(--r${v});--img:var(--i${v})`;
