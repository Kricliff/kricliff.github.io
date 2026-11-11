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
  const next = afterPromise;
  afterPromise = null;
  if (next) next();
});
// A new player meets the promise about ads after the first win, not before the first move
let afterPromise = null;
function withPromise(next) {
  if (promised) { next(); return; }
  afterPromise = next;
  openCard("promiseCard");
}

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
  // Challenges: today's date on the calendar, and a dot while today's Daily or this week's Weekly is still to play
  const t = today(), played = playedOfficial();
  $("homeChallenges").querySelector(".hb-icon b").textContent = t.num;
  $("homeChallenges").querySelector(".hb-label").textContent = played && liveStreak() ? `Challenges ${liveStreak()}🔥` : "Challenges";
  $("homeChallenges").classList.toggle("ready", !played || !playedWeekly());
  // Collection: a dot when there are enough stars to restore something in the garden
  $("gardenDot").hidden = !gardenAffordable();
}

/* ---------- Challenges and Collection: one button each on the home screen, a card with the two ways in ---------- */
function pickTile(id, img, title, status, ready) {
  return `<button class="btn pick-tile${ready ? " ready" : ""}" data-pick="${id}"><img src="img/${img}" alt=""><b>${title}</b><small>${status}</small></button>`;
}
function openChallenges() {
  const played = playedOfficial(), wPlayed = playedWeekly(), streak = liveStreak();
  $("pickEyebrow").textContent = "Challenges";
  $("pickTitle").textContent = "Same board for everyone";
  $("pickTiles").innerHTML =
    pickTile("daily", "ui/calendar.webp", "Daily", played ? `Done today${streak ? ` · ${streak}🔥` : ""}` : `New board today${streak ? ` · ${streak}🔥 streak` : ""}`, !played) +
    pickTile("weekly", "ui/calendars.webp", "Weekly", wPlayed ? "Done this week ✓" : "One board all week", !wPlayed);
  openCard("pickCard");
}
function openCollection() {
  const bought = gardenBoughtCount(), canBuy = !!gardenAffordable();
  $("pickEyebrow").textContent = "Collection";
  $("pickTitle").textContent = "Your koi and your garden";
  $("pickTiles").innerHTML =
    pickTile("koi", "koi/01-kohaku.png", "Koi", `${journey.koi.length} of ${ALL_KOI.length} found`, false) +
    pickTile("garden", "ui/bonsai.webp", "Garden", canBuy ? "You can restore something" : `${bought} of ${GARDEN.length * 5} restored`, canBuy);
  openCard("pickCard");
}
$("pickTiles").addEventListener("click", e => {
  const b = e.target.closest("[data-pick]");
  if (!b) return;
  const go = b.dataset.pick;
  if (go === "daily" || go === "weekly") { closeOverlay(); enterGame(() => switchMode(go)); }
  else if (go === "koi") { koiBack = openCollection; openKoi(); }
  else if (go === "garden") { closeOverlay(); openGarden(); }
});
$("pickDone").addEventListener("click", closeOverlay);
function sizeMoon() {
  // The two badges on the right spread to the height of the three on the left
  const l = homeEl.querySelector(".home-side.l");
  if (l.offsetHeight) homeEl.style.setProperty("--side-h", l.offsetHeight + "px");
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
  setTimeout(maybeShowChallenge, 700);
  if (!animate || reduceMotion) { homeEl.classList.remove("opening"); return; }
  // Start with the doors open, then let them slide shut
  homeEl.classList.add("opening", "instant");
  void homeEl.offsetWidth;
  homeEl.classList.remove("instant");
  requestAnimationFrame(() => homeEl.classList.remove("opening"));
  doors(false);
}
/* ---------- A challenge from a friend ----------
   "Challenge a friend" on the Daily and Weekly cards shares a link to the web version of the game with the board's day
   and the score to beat (?d=2026-11-10&s=532, and w=1 for the weekly). The link is read here, kept for as long as its
   board lasts, and shown once on the home screen. The result card then sets the two scores side by side. */
let challenge = null;
const sameChallenge = (a, b) => !!a && !!b && a.day === b.day && a.score === b.score && !!a.weekly === !!b.weekly;
const saveChallenge = () => { try { localStorage.setItem("mb-challenge", JSON.stringify(challenge)); } catch (e) {} };
// The challenges this player shared: their own link coming back (tapped in Messages, say) is not a friend's challenge
function ownChallenges() { try { return JSON.parse(localStorage.getItem("mb-challenge-mine") || "[]"); } catch (e) { return []; } }
function rememberOwnChallenge(c) {
  try { localStorage.setItem("mb-challenge-mine", JSON.stringify([c, ...ownChallenges().filter(o => !sameChallenge(o, c))].slice(0, 8))); } catch (e) {}
}
// Keeps the challenge in a link's query (?d=…&s=…&w=1). True when the link held a new one from someone else.
function takeChallenge(search) {
  try {
    const q = new URLSearchParams(search), day = q.get("d"), score = Math.round(+q.get("s"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "") || !(score > 0 && score < 1e6)) return false;
    const c = { day, score, weekly: q.get("w") === "1" };
    if (ownChallenges().some(o => sameChallenge(o, c))) return false;
    // The same link again (the app opened by it once more) keeps whether it has been shown
    if (sameChallenge(challenge, c)) return !challenge.shown;
    challenge = c;
    saveChallenge();
    return true;
  } catch (e) { return false; }
}
(function readChallenge() {
  // In the browser the challenge comes in the page's own address; keep the address clean afterwards, so a reload or
  // a shared link does not carry it along
  try { challenge = JSON.parse(localStorage.getItem("mb-challenge") || "null"); } catch (e) { challenge = null; }
  takeChallenge(location.search);
  if (new URLSearchParams(location.search).has("d")) { try { history.replaceState(null, "", location.pathname); } catch (e) {} }
})();
// In the app the challenge comes through a Universal Link: a tap on a link to the web version opens the app instead
// (apple-app-site-association on kricliff.github.io, and Associated Domains in App.entitlements). Shown straight away
// when nothing else is open, otherwise the next time the home screen opens.
function challengeFromLink(url) {
  let search = "";
  try { search = new URL(url).search; } catch (e) { return; }
  if (!takeChallenge(search)) return;
  setTimeout(maybeShowChallenge, homeEl.hidden ? 300 : 900);
}
const challengeLive = () => challenge && challenge.day === (challenge.weekly ? thisWeek().key : today().key);
function maybeShowChallenge() {
  if (!challenge || challenge.shown || !overlay.hidden) return;
  // Shown once: remembered, so it does not come back every time the app starts
  challenge.shown = true;
  saveChallenge();
  const W = challenge.weekly, name = W ? "this week’s challenge" : "today’s Daily";
  if (!challengeLive()) {
    try { localStorage.removeItem("mb-challenge"); } catch (e) {}
    challenge = null;
    info("That challenge has ended", `It was for an earlier board. ${W ? "This week’s challenge" : "Today’s Daily"} is waiting for you instead.`);
    return;
  }
  const mine = (W ? weekly : daily).best[challenge.day];
  $("challengeScore").textContent = challenge.score;
  $("challengeTitle").textContent = `A friend scored ${challenge.score} on ${name}`;
  $("challengeText").innerHTML = mine === undefined ? "You get the same board and the same pieces. Your first try is the one that counts."
    : mine > challenge.score ? `Your official score is <b>${mine}</b>. You are ahead by ${mine - challenge.score}.`
    : mine < challenge.score ? `Your official score is <b>${mine}</b>, ${challenge.score - mine} short. You can practise the board, but the official score stays.`
    : `Your official score is <b>${mine}</b> too. Level!`;
  $("challengePlay").textContent = mine === undefined ? (W ? "Play the Weekly" : "Play the Daily") : "See my result";
  openCard("challengeCard");
}
$("challengePlay").addEventListener("click", () => {
  const mode = challenge && challenge.weekly ? "weekly" : "daily";
  closeOverlay();
  if (!homeEl.hidden) enterGame(() => switchMode(mode)); else switchMode(mode);
});
$("challengeLater").addEventListener("click", closeOverlay);
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
$("homeChallenges").addEventListener("click", () => { if (overlay.hidden) openChallenges(); });
$("homeCollection").addEventListener("click", () => { if (overlay.hidden) openCollection(); });
$("homeTasks").addEventListener("click", () => openTasks(closeOverlay));
$("homeShop").addEventListener("click", () => { if (overlay.hidden) openShop("board"); });
// The pearl count opens the shop too: that is where pearls are spent
$("homePearls").parentElement.addEventListener("click", () => { if (overlay.hidden) openShop(); });
$("homeLanterns").addEventListener("click", () => { eventBack = closeOverlay; openEvent(); });
$("homeSettings").addEventListener("click", () => openFromHeader("settingsCard"));
$("brand").addEventListener("click", () => { if (overlay.hidden) showHome(true); });
$("mapHome").addEventListener("click", () => { closeMap(); showHome(true); });
