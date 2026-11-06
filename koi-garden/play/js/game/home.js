// Koi Garden: Pond tasks and the home screen.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Pond tasks: three small goals a day, and a bamboo basket when all are done ---------- */
// "best" tasks count the highest value reached, the others add up. "from" waits for that Journey level.
const TASKS = {
  lines: { sizes: [12, 20, 30], text: n => `Clear ${n} lines` },
  combo: { sizes: [3, 4], best: true, text: n => `Reach combo ×${n}` },
  harmony: { sizes: [1, 2], text: n => `Make ${n} Harmony ${n === 1 ? "square" : "squares"}` },
  koi: { sizes: [3, 5], from: 3, text: n => `Free ${n} golden koi` },
  joker: { sizes: [1, 2], text: n => `Use ${n} joker koi` },
  stars: { sizes: [3, 5], from: 2, text: n => `Win ${n} stars in Journey` },
  pieces: { sizes: [40, 70], text: n => `Place ${n} pieces` },
  daily: { sizes: [1], text: () => "Play today’s Daily" },
  endless: { sizes: [300, 500], best: true, text: n => `Score ${n} in one Endless game` }
};
const BASKET_PEARLS = 40;
const tasksLabel = () => { checkTasks(); return basketReady() ? "Your task basket is ready" : `Pond tasks · ${tasksDone()}/${tasks.list.length} done`; };
const saveTasks = () => { try { localStorage.setItem("mb-tasks", JSON.stringify(tasks)); } catch (e) {} };
const tasksDone = () => tasks.list.filter(t => t.got >= t.n).length;
const basketReady = () => tasks.list.length && tasksDone() === tasks.list.length && !tasks.opened;
// New tasks each day, the same for everyone who has reached the same point
function checkTasks() {
  const key = today().key;
  if (tasks.day === key) return;
  const r = seeded(hashSeed("pond-tasks-" + key));
  const ids = Object.keys(TASKS).filter(id => (!TASKS[id].from || journey.unlocked >= TASKS[id].from) && !(id === "daily" && playedOfficial()));
  const list = [];
  while (list.length < 3 && ids.length) {
    const id = ids.splice(Math.floor(r() * ids.length), 1)[0];
    const sizes = TASKS[id].sizes;
    list.push({ id, n: sizes[Math.floor(r() * sizes.length)], got: 0 });
  }
  tasks = { day: key, list, opened: false };
  saveTasks();
}
function tasksAdd(gains) {
  checkTasks();
  let changed = false;
  tasks.list.forEach(t => {
    const v = gains[t.id];
    if (!v || t.got >= t.n) return;
    t.got = Math.min(t.n, TASKS[t.id].best ? Math.max(t.got, v) : t.got + v);
    changed = true;
    if (t.got >= t.n) taskPop(t);
  });
  if (changed) saveTasks();
}
function taskPop(t) {
  const k = tasksDone(), all = k === tasks.list.length;
  notify(`Pond task ${k}/${tasks.list.length}`, all ? "All done · your basket is ready" : TASKS[t.id].text(t.n), all);
}
// A small card slides down from the top of the screen, one at a time,
// above any open card so it is seen even when it arrives with the end of a round
let popChain = Promise.resolve();
function notify(label, text, gold) {
  popChain = popChain.then(() => new Promise(done => {
    const el = document.createElement("div");
    el.className = "task-pop" + (gold ? " all" : "");
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.3 3.3L17 9"/></svg>`
      + `<span><small>${label}</small>${text}</span>`;
    document.body.appendChild(el);
    chime(gold);
    buzz(gold ? [10, 30, 10] : 10);
    setTimeout(() => el.classList.add("out"), 2000);
    setTimeout(() => { el.remove(); done(); }, 2250);
  }));
}
function paintTasks() {
  checkTasks();
  $("tasksList").innerHTML = tasks.list.map(t => {
    const ok = t.got >= t.n;
    return `<li class="${ok ? "done" : ""}"><span>${ok ? "✓ " : ""}${TASKS[t.id].text(t.n)}</span><small>${t.got}/${t.n}</small>`
      + `<i class="task-bar"><i style="width:${(t.got / t.n) * 100}%"></i></i></li>`;
  }).join("");
  const mid = new Date(); mid.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((mid - new Date()) / 60000));
  $("tasksEyebrow").textContent = `Pond tasks · ${mins >= 60 ? Math.floor(mins / 60) + " h" : mins + " min"} left`;
  $("tasksBank").querySelector("b").textContent = journey.pearls;
  const wrap = $("basketWrap");
  wrap.className = "basket-wrap" + (tasks.opened ? " opened" : basketReady() ? " ready" : "");
  const open = $("basketOpen");
  open.hidden = tasks.opened;
  open.disabled = !basketReady();
  $("basketNote").textContent = tasks.opened ? "Basket opened. New tasks arrive tomorrow."
    : basketReady() ? "Your basket is ready." : `Finish all three to open the basket · ${tasksDone()}/${tasks.list.length} done`;
}
let tasksBack = null;
function openTasks(back) {
  tasksBack = back || openMap;
  $("basketGifts").innerHTML = "";
  paintTasks();
  openCard("tasksCard");
}
// Rewards: pearls, and a joker that waits for the next Journey level
function openBasket() {
  if (!basketReady()) return;
  tasks.opened = true;
  saveTasks();
  const gift = journey.gift ? "" : ["arrow", "ripple", "rainbow"][Math.floor(Math.random() * 3)];
  const pearls = BASKET_PEARLS + (gift ? 0 : 20);
  const before = journey.pearls;
  journey.pearls += pearls;
  if (gift) journey.gift = gift;
  saveJourney();
  const wrap = $("basketWrap"), gifts = $("basketGifts");
  $("basketOpen").hidden = true;
  gifts.innerHTML = `<div class="gift"><i class="pearl big"></i><b>+${pearls}</b><span>pearls</span></div>`
    + (gift ? `<div class="gift"><img src="${ALL_KOI[JOKERS[gift].koi].img}" alt=""><b>${JOKERS[gift].name}</b><span>for your next level</span></div>` : "");
  $("basketNote").textContent = gift ? `The ${JOKERS[gift].name} waits in the gold slot when you start your next Journey level.` : "Basket opened. New tasks arrive tomorrow.";
  const reveal = () => {
    wrap.className = "basket-wrap opened";
    const r = wrap.getBoundingClientRect();
    sparkBurst(r.left + r.width / 2, r.top + r.height * 0.45);
    basketSound();
    buzz([15, 40, 25]);
    flyPearls(gifts.querySelector(".gift"), $("tasksBank"), before, journey.pearls, 520);
  };
  if (reduceMotion) { reveal(); return; }
  // Wiggle, then the lid pops off and the gifts rise out
  wrap.className = "basket-wrap ready shake";
  knock();
  setTimeout(knock, 220);
  setTimeout(reveal, 560);
}
$("basketOpen").addEventListener("click", openBasket);
$("tasksDone").addEventListener("click", () => tasksBack());

$("eventDone").addEventListener("click", () => eventBack());
$("promiseOk").addEventListener("click", () => {
  if (nativeApp && !promised) window.MBNative.init({ banner: bannerOn() });
  promised = true;
  try { localStorage.setItem("mb-promise", "1"); } catch (e) {}
  closeOverlay();
});

/* ---------- Home: shoji doors around a moon window onto the pond ----------
   The game opens here. Play slides the doors apart into the pond; the logo in the
   game's header slides them shut again. */
// The festival button wears this week's festival
const FEST_ICONS = {
  lantern: '<path d="M12 2v2"/><path d="M9 4h6"/><path d="M8 6.5C5.5 8 5 10 5 12.5S5.5 17 8 18.5h8c2.5-1.5 3-3.5 3-6S18.5 8 16 6.5z"/><path d="M12 6.5v12M8.7 7c-1.2 3-1.2 8 0 11M15.3 7c1.2 3 1.2 8 0 11"/><path d="M10 18.5V21h4v-2.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 4v3M15.5 5.5h3"/>',
  sakura: '<path d="M12 12c-1.8-2.2-2.2-5.2 0-7.5 2.2 2.3 1.8 5.3 0 7.5z"/><path d="M12 12c2.6-1.1 5.6-.5 7.2 2.2-2.8 1.3-5.6.4-7.2-2.2z"/><path d="M12 12c.6 2.7-.4 5.6-3.4 6.8-.9-3 .6-5.6 3.4-6.8z"/><path d="M12 12c-.6 2.7.4 5.6 3.4 6.8.9-3-.6-5.6-3.4-6.8z"/><path d="M12 12c-2.6-1.1-5.6-.5-7.2 2.2 2.8 1.3 5.6.4 7.2-2.2z"/>',
  firefly: '<path d="M12 9v9"/><circle cx="12" cy="7" r="2"/><path d="M12 10c-3-3.5-7-2.5-7 0s4 2.5 7 0zM12 10c3-3.5 7-2.5 7 0s-4 2.5-7 0z"/><circle cx="12" cy="19" r="2.2" fill="currentColor"/><path d="M6 19.5l-1 .5M18 19.5l1 .5M12 22.5v.5"/>'
};
// Painted with Viewmax (assets/ui/); the line drawings above stay as a fallback for a festival without a picture
const FEST_PICS = { lantern: "img/ui/lantern.webp", moon: "img/ui/moon.webp", sakura: "img/ui/sakura.webp", firefly: "img/ui/firefly.webp" };
const festIcon = id => FEST_PICS[id] ? `<img class="paint" src="${FEST_PICS[id]}" alt="">`
  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${FEST_ICONS[id] || FEST_ICONS.lantern}</svg>`;
const homeEl = $("home"), moonCv = $("moonCanvas"), mc = moonCv.getContext("2d");
let homeLoop = 0, homeLast = 0, moonAng = 0, moonBoost = 0;
const journeyResume = () => G.journey && !G.journey.over && G.journey.placed > 0;
function paintHome() {
  $("homePearls").textContent = journey.pearls;
  const s = journey.streak || 0;
  const n = currentLevel();
  const play = $("homePlay");
  play.querySelector("b").textContent = journeyResume() ? `Back to level ${G.journey.level}` : `Level ${n}`;
  play.querySelector("small").textContent = goalText(levelDef(journeyResume() ? G.journey.level : n));
  $("homeBoost").hidden = !s;
  $("homeBoost").textContent = `×${s}`;
  checkTasks();
  $("homeTasks").querySelector(".hb-label").textContent = basketReady() ? "Basket!" : (tasksDone() ? `Tasks ${tasksDone()}/${tasks.list.length}` : "Tasks");
  $("homeTasks").classList.toggle("ready", !!basketReady());
  checkLanternWeek();
  const fest = festivalNow();
  $("homeLanterns").querySelector(".hb-label").textContent = lanterns.count ? `${fest.short} ${lanterns.count}` : fest.short;
  $("homeLanterns").setAttribute("aria-label", `${fest.name}: ${lanterns.count} ${festUnit(fest, lanterns.count)} ${fest.verb} this week`);
  $("homeFestIcon").innerHTML = festIcon(fest.id);
  const t = today(), played = playedOfficial();
  $("homeDaily").querySelector(".hb-icon b").textContent = t.num;
  $("homeDaily").querySelector(".hb-label").textContent = played ? `Done · ${liveStreak()}🔥` : "Daily";
  $("homeDaily").classList.toggle("ready", !played);
  $("homeKoi").querySelector(".hb-label").textContent = `Koi ${journey.koi.length}/${ALL_KOI.length}`;
  $("homeGarden").querySelector(".hb-label").textContent = gardenBoughtCount() ? `Garden ${gardenBoughtCount()}/${GARDEN.length * 5}` : "Garden";
  // A dot when there are enough stars to restore something
  $("gardenDot").hidden = !gardenAffordable();
}
function sizeMoon() {
  const r = moonCv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  moonCv.width = Math.max(1, r.width * dpr);
  moonCv.height = Math.max(1, r.height * dpr);
  mc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
// Two koi circle each other inside the window, like a tomoe
function moonFrame(now) {
  if (homeEl.hidden) { homeLoop = 0; return; }
  const dt = Math.min(0.05, (now - homeLast) / 1000);
  homeLast = now;
  moonAng += dt * (0.55 + moonBoost);
  const w = moonCv.clientWidth, h = moonCv.clientHeight;
  mc.clearRect(0, 0, w, h);
  const own = pondKoi(), R = w * 0.24, len = w * 0.44;
  [0, 1].forEach(k => {
    const a = moonAng + k * Math.PI, img = koiImages[own[k % own.length]];
    mc.save();
    mc.translate(w / 2 + Math.cos(a) * R, h / 2 + Math.sin(a) * R);
    mc.rotate(a + Math.PI / 2);
    drawWarpedKoi(mc, img, len, now / 1000 * (5 + moonBoost * 4) + k, 0.7, 1, 1);
    mc.restore();
  });
  homeLoop = requestAnimationFrame(moonFrame);
}
function startMoon() {
  if (homeLoop) return;
  homeLast = performance.now();
  // With reduced motion the koi hold still: draw one frame and stop
  if (reduceMotion) { moonFrame(homeLast); cancelAnimationFrame(homeLoop); homeLoop = 0; return; }
  homeLoop = requestAnimationFrame(moonFrame);
}
function showHome(animate) {
  if (drag) return;
  clearSurprises();
  closeOverlay();
  paintHome();
  homeEl.hidden = false;
  sizeMoon();
  moonBoost = 0;
  startMoon();
  if (!animate || reduceMotion) { homeEl.classList.remove("opening"); return; }
  // Start with the doors open, then let them slide shut
  homeEl.classList.add("opening", "instant");
  void homeEl.offsetWidth;
  homeEl.classList.remove("instant");
  requestAnimationFrame(() => homeEl.classList.remove("opening"));
  doors(false);
}
let homeBusy = false;
function enterGame(after) {
  if (homeBusy || homeEl.hidden) return;
  audioInit();
  if (reduceMotion) { homeEl.hidden = true; after(); return; }
  homeBusy = true;
  moonBoost = 3;
  homeEl.classList.add("opening");
  restartClass($("app"), "arrive");
  doors(true);
  buzz(10);
  setTimeout(after, 650);
  setTimeout(() => { homeEl.hidden = true; homeEl.classList.remove("opening"); homeBusy = false; }, 950);
}
function homePlay() {
  enterGame(() => {
    if (journeyResume()) { S = G.journey; shownScore = S.score; closeOverlay(); render(); return; }
    startLevel(currentLevel());
    closeOverlay();
    render();
    openLevelIntro();
  });
}
$("homePlay").addEventListener("click", homePlay);
$("homeMap").addEventListener("click", () => enterGame(openMap));
$("homeEndless").addEventListener("click", () => enterGame(() => switchMode("endless")));
$("homeDaily").addEventListener("click", () => enterGame(() => switchMode("daily")));
$("homeTasks").addEventListener("click", () => openTasks(closeOverlay));
$("homeShop").addEventListener("click", () => { if (overlay.hidden) openShop("board"); });
// The pearl count opens the shop too: that is where pearls are spent
$("homePearls").parentElement.addEventListener("click", () => { if (overlay.hidden) openShop(); });
$("homeLanterns").addEventListener("click", () => { eventBack = closeOverlay; openEvent(); });
$("homeKoi").addEventListener("click", () => { koiBack = closeOverlay; openKoi(); });
$("homeSettings").addEventListener("click", () => openFromHeader("settingsCard"));
$("homeHelp").addEventListener("click", () => openFromHeader("helpCard"));
$("brand").addEventListener("click", () => { if (overlay.hidden) showHome(true); });
$("mapHome").addEventListener("click", () => { closeMap(); showHome(true); });
