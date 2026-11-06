// Koi Garden: Overlays, settings, the koi collection, the weekly festivals and garden styles.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Overlays ---------- */
const cards = ["promiseCard", "statsCard", "levelCard", "winCard", "failCard", "helpCard", "settingsCard", "resetCard", "koiCard", "eventCard", "streakCard", "infoCard", "breakCard", "overCard", "dailyCard", "remindCard", "rewardCard", "adCard", "tasksCard", "testerCard", "jokerCard", "shopCard"];
function openCard(id) {
  clearSurprises();
  overlay.hidden = false;
  cards.forEach(c => { $(c).hidden = c !== id; });
  overlay.scrollTop = 0;
  const btn = $(id).querySelector(".btn:not(:disabled), .node:not(:disabled)");
  if (btn) btn.focus({ preventScroll: true });
}
function closeOverlay() {
  overlay.hidden = true;
  cards.forEach(c => { $(c).hidden = true; });
  if (!homeEl.hidden) paintHome();
}

// Help and settings open from the board, the map or a level card, and return there
let helpBack = null;
function openFromHeader(id) {
  if (drag) return;
  if (!overlay.hidden && $("levelCard").hidden) return;
  helpBack = !$("levelCard").hidden ? openLevelIntro : null;
  if (id === "settingsCard") syncSettings();
  openCard(id);
}
const backFromHeader = () => { const b = helpBack; helpBack = null; b ? b() : closeOverlay(); };
// The house in the game's header slides the doors shut and goes back to the home screen.
// It takes the place the rules had there; the rules open from Settings and from home.
$("homeBtn").addEventListener("click", () => { if (overlay.hidden && !drag) showHome(true); });
$("settingsHelp").addEventListener("click", () => {
  // Back to Settings, which then still returns to wherever it was opened from
  const prev = helpBack;
  helpBack = () => { helpBack = prev; syncSettings(); openCard("settingsCard"); };
  openCard("helpCard");
});
$("settings").addEventListener("click", () => openFromHeader("settingsCard"));
$("helpDone").addEventListener("click", backFromHeader);
$("settingsDone").addEventListener("click", backFromHeader);
// Starting over clears all progress but keeps settings, reminders and the ad-free purchase
$("resetBtn").addEventListener("click", () => openCard("resetCard"));
$("resetKeep").addEventListener("click", () => { syncSettings(); openCard("settingsCard"); });
$("resetYes").addEventListener("click", async () => {
  try {
    ["mb-journey", "mb-daily", "mb-best-9", "mb-lanterns", "mb-tasks", "mb-joker-tut", "mb-joker-seen"].forEach(k => localStorage.removeItem(k));
    localStorage.setItem("mb-epoch", String(localEpoch() + 1));
  } catch (e) {}
  // Clear the iCloud copy too, or it would bring the old progress back
  if (nativeApp) { clearTimeout(cloudTimer); await window.MBNative.cloudSave(cloudSnapshot()); }
  location.reload();
});
function info(title, text, back) {
  $("infoTitle").textContent = title;
  $("infoText").textContent = text;
  $("infoDone").onclick = () => (back ? back() : closeOverlay());
  openCard("infoCard");
}

/* ---------- Settings ---------- */
function applyPrefs() {
  document.documentElement.classList.toggle("big", !!prefs.big);
  document.documentElement.classList.toggle("calm", !!prefs.calm);
  $("banner").hidden = !bannerOn();
  // The app's AdMob banner floats above everything, so cards leave room for it
  document.documentElement.style.setProperty("--banner-room", nativeApp && bannerOn() ? "64px" : "0px");
  if (S) layout();
}
function syncSettings() {
  syncCloudNote();
  syncAudioUI();
  $("bigToggle").checked = !!prefs.big;
  $("calmToggle").checked = !!prefs.calm;
  $("adsTitle").textContent = noAds ? "Ads removed" : "Remove ads";
  $("adsText").textContent = noAds
    ? "Thank you for supporting Koi Garden. No banner and no ad breaks. Videos for rewards are still there if you want them."
    : "One purchase removes the banner and the ad breaks between rounds, for good. Videos for rewards stay, and you choose when to watch.";
  $("buyNoAds").hidden = noAds;
  if (!noAds && nativeApp) window.MBNative.noAdsPrice().then(pr => { if (pr) $("buyNoAds").textContent = `Remove ads · ${pr}`; });
}
$("bigToggle").addEventListener("change", e => { prefs.big = e.target.checked; savePrefs(); applyPrefs(); render(); });
$("calmToggle").addEventListener("change", e => { prefs.calm = e.target.checked; savePrefs(); applyPrefs(); });
$("settingsRemind").addEventListener("click", () => openRemind(() => { syncSettings(); openCard("settingsCard"); }));
function setNoAds() {
  noAds = true;
  try { localStorage.setItem("mb-noads", "1"); } catch (e) {}
  if (nativeApp) window.MBNative.removeBanner();
  applyPrefs();
  syncSettings();
}
const backToSettings = () => { syncSettings(); openCard("settingsCard"); };
$("buyNoAds").addEventListener("click", async () => {
  if (!nativeApp) { info("Remove ads", "In the iPhone app this opens the App Store purchase. In the browser there is nothing to buy.", backToSettings); return; }
  const btn = $("buyNoAds");
  btn.disabled = true;
  const result = await window.MBNative.buyNoAds();
  btn.disabled = false;
  if (result === "purchased") { setNoAds(); track("purchase"); info("Ads removed", "Thank you. The banner and the ad breaks are gone for good.", backToSettings); }
  else if (result === "failed") info("Purchase not completed", "The App Store could not finish the purchase. Check your connection and try again.", backToSettings);
});
$("restoreBtn").addEventListener("click", async () => {
  if (!nativeApp) { info("Restore purchase", "Restoring works in the iPhone app.", backToSettings); return; }
  const owned = await window.MBNative.restoreNoAds();
  if (owned) { setNoAds(); info("Purchase restored", "Ads are removed on this device.", backToSettings); }
  else info("Nothing to restore", "We found no Remove ads purchase on this Apple ID.", backToSettings);
});

/* ---------- Koi collection ---------- */
function openKoi() {
  const grid = $("koiGrid");
  grid.innerHTML = "";
  $("koiTitle").textContent = `${journey.koi.length} of ${ALL_KOI.length} koi`;
  ALL_KOI.forEach((k, i) => {
    const section = i === KOI_TYPES.length ? "Rare koi · Daily streak" : i === CHAPTER_KOI_START ? "Chapter koi · Journey"
      : i === FESTIVAL_KOI_START ? "Festival koi · one each week" : "";
    if (section) {
      const h = document.createElement("div");
      h.className = "koi-section";
      h.textContent = section;
      grid.appendChild(h);
    }
    const owned = journey.koi.includes(i);
    const cell = document.createElement("div");
    cell.className = "koi-cell" + (owned ? "" : " locked") + (k.rare || k.festivalKoi ? " rare" : "");
    const im = document.createElement("img");
    im.src = k.img;
    im.alt = owned ? k.name : "Locked koi";
    cell.appendChild(im);
    const name = document.createElement("span");
    name.textContent = owned ? k.name : k.rare ? `${k.at}-day streak` : k.chapterKoi ? `Chapter ${k.chapter}` : k.festivalKoi ? k.festName : `Level ${i + 1}`;
    cell.appendChild(name);
    grid.appendChild(cell);
  });
  openCard("koiCard");
}
let koiBack = openMap;
$("koiDone").addEventListener("click", () => koiBack());
$("koiPond").addEventListener("click", () => openPond(openKoi));
$("settingsPond").addEventListener("click", () => openPond(() => { syncSettings(); openCard("settingsCard"); }));

/* ---------- Weekly festivals: one goal across all modes, a new festival every Monday ----------
   Four festivals take turns: Lantern Festival, Moon Viewing, Sakura Week and Firefly Night. Each counts a different
   kind of move, has its own colours and its own koi, which only comes to the pond by reaching the last goal that week.
   Missed it? The same festival comes back four weeks later. Progress is kept in "mb-lanterns" (its old name). */
const FESTIVALS = [
  { id: "lantern", name: "Lantern Festival", short: "Lanterns", unit: ["lantern", "lanterns"], verb: "lit", float: 3,
    how: "Every line you clear lights a lantern, in any mode. A Harmony square lights three.",
    gain: g => (g.lines || 0) + 2 * (g.harmony || 0), goals: [30, 80, 150] },
  { id: "moon", name: "Moon Viewing", short: "Moonbeams", unit: ["moonbeam", "moonbeams"], verb: "caught", float: 4,
    how: "Clear in a combo to catch moonlight: a clear at combo ×2 catches 2, at ×3 catches 3, and so on. Still water catches 10.",
    gain: g => (g.lines && g.combo >= 2 ? g.combo : 0) + (g.still ? 10 : 0), goals: [50, 130, 240] },
  { id: "sakura", name: "Sakura Week", short: "Petals", unit: ["petal", "petals"], verb: "gathered", float: 25,
    how: "Every stone you clear lets a cherry petal fall.",
    gain: g => g.stones || 0, goals: [250, 650, 1200] },
  { id: "firefly", name: "Firefly Night", short: "Fireflies", unit: ["firefly", "fireflies"], verb: "caught", float: 2,
    how: "Clear two or more lines at once for a firefly per line. Every golden koi, lotus flower or frog you free adds one, and a joker koi catches two.",
    gain: g => ((g.lines || 0) >= 2 ? g.lines : 0) + (g.koi || 0) + (g.lotus || 0) + (g.frogs || 0) + (g.joker ? 2 : 0), goals: [20, 50, 100] }
];
const FESTIVAL_PEARLS = [20, 40, 80];
// The first festival week starts on Monday 2 November 2026 with the Lantern Festival, the one that was already running
const FESTIVAL_EPOCH = new Date(2026, 10, 2);
function weekStart(d = new Date()) {
  d = new Date(d);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const festivalIndexAt = d => ((Math.round((weekStart(d) - FESTIVAL_EPOCH) / (7 * 864e5)) % FESTIVALS.length) + FESTIVALS.length) % FESTIVALS.length;
const festivalNow = () => FESTIVALS[festivalIndexAt(new Date())];
const festivalNext = () => { const d = weekStart(); d.setDate(d.getDate() + 7); return FESTIVALS[festivalIndexAt(d)]; };
// Weeks until a festival is on again (0 = this week)
function festivalIn(id) {
  for (let w = 0; w < FESTIVALS.length; w++) { const d = weekStart(); d.setDate(d.getDate() + 7 * w); if (FESTIVALS[festivalIndexAt(d)].id === id) return w; }
  return FESTIVALS.length;
}
const onSaleNow = item => !item.festival || festivalNow().id === item.festival;
const festivalBoard = f => BOARDS.find(b => b.festival === f.id);
const festivalKoi = f => FESTIVAL_KOI_START + FESTIVAL_KOI.findIndex(k => k.festival === f.id);
const festUnit = (f, n) => f.unit[n === 1 ? 0 : 1];
function checkLanternWeek() {
  const wk = keyOf(weekStart()), f = festivalNow();
  if (lanterns.week !== wk) { lanterns = { week: wk, count: 0, claimed: [], kind: f.id }; saveLanterns(); }
  if (!lanterns.kind) { lanterns.kind = f.id; saveLanterns(); }
  document.documentElement.dataset.festival = f.id;
}
function saveLanterns() { try { localStorage.setItem("mb-lanterns", JSON.stringify(lanterns)); } catch (e) {} }
// What a move did, counted the way this week's festival counts it
function festivalGain(g) {
  const n = festivalNow().gain(g);
  if (n > 0) festivalAdd(n);
}
function festivalAdd(n, shout) {
  checkLanternWeek();
  const f = festivalNow();
  lanterns.count += n;
  if (shout) toast(`+${n} ${festUnit(f, n)}`);
  f.goals.forEach((at, i) => {
    if (lanterns.count >= at && !lanterns.claimed.includes(i)) {
      lanterns.claimed.push(i);
      journey.pearls += FESTIVAL_PEARLS[i];
      // The last goal brings the festival's own koi, the first time
      const ki = festivalKoi(f), last = i === f.goals.length - 1, newKoi = last && ki >= 0 && !journey.koi.includes(ki);
      if (newKoi) { journey.koi.push(ki); initKoi(); }
      saveJourney();
      setTimeout(() => notify(`${f.name} · ${at} ${festUnit(f, at)}`, newKoi ? `+${FESTIVAL_PEARLS[i]} pearls and a new koi: ${ALL_KOI[ki].name}` : `+${FESTIVAL_PEARLS[i]} pearls`, true), 900);
    }
  });
  saveLanterns();
}
function openEvent() {
  checkLanternWeek();
  const f = festivalNow(), goals = f.goals, top = goals[goals.length - 1], ki = festivalKoi(f);
  $("eventCard").dataset.festival = f.id;
  $("eventPic").src = FEST_PICS[f.id] || FEST_PICS.lantern;
  $("eventTitle").textContent = f.name;
  $("eventStats").innerHTML = `<b>${lanterns.count}</b> ${festUnit(f, lanterns.count)} ${f.verb} this week`;
  $("eventBar").style.width = Math.min(100, (lanterns.count / top) * 100) + "%";
  $("eventGoals").innerHTML = goals.map((at, i) => {
    const done = lanterns.claimed.includes(i), koi = i === goals.length - 1 && ki >= 0;
    return `<li class="${done ? "done" : ""}"><span>${done ? "✓ " : ""}${at} ${festUnit(f, at)}</span><span>+${FESTIVAL_PEARLS[i]} pearls${koi ? ` + <img class="fest-koi-mini" src="${ALL_KOI[ki].img}" alt="${ALL_KOI[ki].name}">` : ""}</span></li>`;
  }).join("");
  const owned = journey.koi.includes(ki);
  $("eventKoi").innerHTML = `<img src="${ALL_KOI[ki].img}" alt=""><span><b>${ALL_KOI[ki].name}</b>${owned ? "is in your pond" : `only this week, at ${top} ${festUnit(f, top)}`}</span>`;
  $("eventKoi").classList.toggle("owned", owned);
  $("eventHow").textContent = f.how + " Catch the ones that float up from the board for more.";
  const end = weekStart(); end.setDate(end.getDate() + 7);
  const hrs = Math.max(1, Math.round((end - new Date()) / 36e5));
  $("eventEyebrow").textContent = `This week · ${Math.floor(hrs / 24)}d ${hrs % 24}h left`;
  $("eventNext").textContent = `Next week: ${festivalNext().name}`;
  // This week's board in the shop
  const fb = festivalBoard(f), fbOwned = fb && ownsStyle(fb);
  $("eventBoard").hidden = !fb;
  if (fb) $("eventBoard").innerHTML = `<span class="pv-board" data-board="${fb.id}" aria-hidden="true"><i></i><i class="alt"></i><i class="alt"></i><i></i></span>`
    + `<span><b>${fb.name}</b>${fbOwned ? "is yours" : `festival board · <i class="pearl"></i> ${fb.price} in the shop, this week only`}</span>`;
  $("eventBoard").classList.toggle("owned", !!fbOwned);
  openCard("eventCard");
}
let eventBack = openMap;
$("eventBoard").addEventListener("click", () => { closeOverlay(); openShop("board", openEvent); });

/* ---------- Garden styles: ten boards and eight kinds of stone ----------
   Each colour keeps its own stone shape in every style, so colour-blind players can still match.
   "stars" styles open with total Journey stars, "streak" ones with a 14-day Daily streak or
   a win streak of 5, and the rest are bought with pearls. Owned styles live in the journey, so iCloud keeps them. */
const BOARDS = [
  { id: "sand", name: "Zen Sand" },
  { id: "cherry", name: "Cherry Blossom", need: "stars", at: 30 },
  { id: "jade", name: "Jade Temple", price: 300 },
  { id: "lacquer", name: "Moon Lacquer", need: "streak" },
  { id: "tatami", name: "Tea House", price: 600 },
  { id: "moss", name: "Moss Temple", need: "stars", at: 150 },
  { id: "bamboo", name: "Bamboo Mat", price: 400 },
  { id: "snow", name: "Snow Garden", price: 450 },
  { id: "pond", name: "Koi Pond", price: 700 },
  { id: "stars", name: "Starry Night", price: 1000 },
  // Festival boards: on sale only in their festival's week, and back every fourth week. Bought ones are kept for good.
  { id: "lanternnight", name: "Lantern Night", price: 400, festival: "lantern" },
  { id: "moonsilk", name: "Moon Silk", price: 400, festival: "moon" },
  { id: "petal", name: "Petal Stream", price: 400, festival: "sakura" },
  { id: "firefly", name: "Firefly Meadow", price: 400, festival: "firefly" }
];
const STONES = [
  { id: "river", name: "River Stones" },
  { id: "ceramic", name: "Glazed Ceramic", need: "stars", at: 15 },
  { id: "gem", name: "Gemstones", price: 300 },
  { id: "lantern", name: "Lanterns", need: "streak" },
  { id: "wood", name: "Hinoki Wood", price: 350 },
  { id: "marble", name: "Marble", price: 500 },
  { id: "seaglass", name: "Sea Glass", price: 600 },
  { id: "porcelain", name: "Blue Porcelain", price: 800 }
];
const STYLE_KINDS = { board: BOARDS, stones: STONES };
const totalStars = () => Object.values(journey.stars).reduce((a, b) => a + (+b || 0), 0);
const ownsStyle = item => !item.need && !item.price || (journey.owned || []).includes(item.id);
function styleEarned(item) {
  if (item.need === "stars") return totalStars() >= item.at;
  if (item.need === "streak") return liveStreak() >= 14 || (journey.streak || 0) >= 5 || journey.koi.includes(rareIndex(RARE_KOI[1]));
  return false;
}
// Adds styles the player has just earned, with a notice unless quiet
function checkStyleUnlocks(quiet) {
  if (!journey.owned) journey.owned = [];
  let added = false;
  [...BOARDS, ...STONES].forEach(item => {
    if (item.need && !journey.owned.includes(item.id) && styleEarned(item)) {
      journey.owned.push(item.id);
      added = true;
      if (!quiet) notify("New garden style", `${item.name} unlocked`, true);
    }
  });
  if (added) saveJourney();
}
const saveLook = () => { try { localStorage.setItem("mb-look", JSON.stringify(look)); } catch (e) {} };
function applyLook() {
  // A style that is no longer owned (after Start over) falls back to the first one
  Object.entries(STYLE_KINDS).forEach(([kind, list]) => {
    const item = list.find(x => x.id === look[kind]);
    if (!item || !ownsStyle(item)) look[kind] = list[0].id;
  });
  document.documentElement.dataset.board = look.board;
  document.documentElement.dataset.stones = look.stones;
}
const PREVIEW_STONES = [[1, "18%", "16%"], [4, "52%", "16%"], [3, "18%", "52%"], [5, "52%", "52%"]];
function styleTile(kind, item) {
  const on = look[kind] === item.id, owns = ownsStyle(item);
  let status = on ? "In use" : owns ? "Tap to use" : "";
  if (!owns) {
    const wait = item.festival && !onSaleNow(item) ? festivalIn(item.festival) : 0;
    if (wait) status = `${FESTIVALS.find(f => f.id === item.festival).name} · back in ${wait === 1 ? "1 week" : wait + " weeks"}`;
    else if (item.price) status = buying === item.id ? "Tap again to buy" : `<i class="pearl"></i> ${item.price} pearls${item.festival ? " · this week" : ""}`;
    else if (item.need === "stars") status = `★ ${Math.min(totalStars(), item.at)}/${item.at} stars`;
    else status = "14-day Daily streak or a win streak of 5";
  }
  const stones = PREVIEW_STONES.map(([c, x, y]) => `<span class="stone" style="${colorVars(c)};left:${x};top:${y}"></span>`).join("");
  return `<button class="style-tile pv${on ? " on" : ""}${owns ? "" : " locked"}${item.festival ? " fest" : ""}${buying === item.id ? " confirm" : ""}" data-kind="${kind}" data-id="${item.id}"`
    + ` data-board="${kind === "board" ? item.id : look.board}" data-stones="${kind === "stones" ? item.id : look.stones}" aria-pressed="${on}">`
    + `<span class="pv-board"><i></i><i class="alt"></i><i class="alt"></i><i></i>${stones}</span>`
    + `<b>${item.name}</b><small>${status}</small></button>`;
}
let buying = null;
// The brush on the home screen and Board & stones in Settings open the shop on its Boards tab
function openStyles(back) { openShop("board", back); }
function buyStyle(kind, item) {
  if (ownsStyle(item) || !item.price || !onSaleNow(item) || journey.pearls < item.price) return false;
  journey.pearls -= item.price;
  if (!journey.owned) journey.owned = [];
  journey.owned.push(item.id);
  track("style", { data: { id: item.id } });
  saveJourney();
  useStyle(kind, item.id);
  return true;
}
function useStyle(kind, id) {
  look[kind] = id;
  saveLook();
  applyLook();
  restartClass($("boardWrap"), "restyle");
  tick();
}
$("settingsStyle").addEventListener("click", () => { closeOverlay(); openStyles(() => { syncSettings(); openCard("settingsCard"); }); });

/* ---------- A ✕ in the top corner of the longer cards ----------
   It does what the card's own Back or Done button does, so nobody has to scroll down for it. */
[["koiCard", "koiDone"], ["tasksCard", "tasksDone"], ["eventCard", "eventDone"], ["settingsCard", "settingsDone"],
 ["helpCard", "helpDone"], ["shopCard", "shopDone"], ["infoCard", "infoDone"]].forEach(([card, done]) => {
  const x = document.createElement("button");
  x.className = "card-close";
  x.type = "button";
  x.textContent = "✕";
  x.setAttribute("aria-label", "Close");
  x.addEventListener("click", () => $(done).click());
  $(card).prepend(x);
});
