// Koi Garden: The Journey map, the win streak, reminders and gardens.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Journey map ----------
   A path of stepping stones winds up a stream through the garden, level 1 at the bottom. Each
   chapter is its own stretch with its own colours and scenery, and a wooden gate with its name.
   Your koi circles the stone you are on, and after a win it hops across to the next one. */
const MAP_STEP = 100, MAP_GATE = 330, MAP_BOTTOM = 300, MAP_TOP = 150;
// Scenery for each chapter: a wash of colour over the water and the things growing along the path
const ZONES = [
  { tint: "rgba(30, 150, 140, 0.18)", decor: ["pad", "reeds", "koi"] },
  { tint: "rgba(80, 160, 60, 0.22)", decor: ["bamboo", "bamboo", "pad"] },
  { tint: "rgba(220, 110, 160, 0.16)", decor: ["lotus", "pad", "lotus"] },
  { tint: "rgba(60, 80, 170, 0.22)", decor: ["bridge", "pad", "lantern"] },
  { tint: "rgba(240, 140, 180, 0.2)", decor: ["blossom", "blossom", "pad"] },
  { tint: "rgba(110, 130, 140, 0.24)", decor: ["rock", "reeds", "pad"] },
  { tint: "rgba(170, 120, 60, 0.2)", decor: ["lantern", "rock", "pad"] },
  { tint: "rgba(220, 100, 40, 0.2)", decor: ["maple", "maple", "rock"] },
  { tint: "rgba(220, 235, 255, 0.24)", decor: ["pine", "pine", "rock"] },
  { tint: "rgba(240, 190, 60, 0.2)", decor: ["pagoda", "lantern", "pad"] }
];
// Painted with Viewmax (assets/map/make_map.py). Upright things stand straight and are drawn larger.
const DECOR = Object.fromEntries(["pad", "bridge", "blossom", "rock", "lantern", "maple", "pine", "pagoda", "reeds"]
  .map(k => [k, `<img src="img/map/${k}.webp" alt="">`]).concat([
    ["koi", '<img src="img/koi/04-ogon.png" alt="">'], ["bamboo", '<img src="img/ui/bamboo-clump.webp" alt="">'], ["lotus", '<img src="img/lotus.webp" alt="">']]));
const DECOR_UPRIGHT = { bridge: 1.3, blossom: 1.5, lantern: 1.1, maple: 1.5, pine: 1.5, pagoda: 1.5, reeds: 1.1, bamboo: 1.5 };
let mapGeo = null;
function mapGeometry(maxC, W) {
  const H = MAP_BOTTOM + maxC * (PER_CHAPTER * MAP_STEP + MAP_GATE) + MAP_TOP;
  const pos = n => {
    const c = chapterOf(n), i = (n - 1) % PER_CHAPTER;
    const y = H - (MAP_BOTTOM + (c - 1) * (PER_CHAPTER * MAP_STEP + MAP_GATE) + (i + 0.5) * MAP_STEP);
    return { x: W / 2 + Math.sin(n * 0.8) * W * 0.27, y };
  };
  const gateY = c => H - (MAP_BOTTOM + c * (PER_CHAPTER * MAP_STEP + MAP_GATE) - MAP_GATE / 2);
  return { H, W, pos, gateY };
}
// A smooth curve through the points (Catmull-Rom turned into Bézier segments)
function smoothPath(pts) {
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
}
function buildMap() {
  const world = $("mapWorld"), W = Math.min(480, $("mapScroll").clientWidth || innerWidth);
  const cur = currentLevel(), maxC = chapterOf(cur) + 1, last = maxC * PER_CHAPTER;
  const g = mapGeo = mapGeometry(maxC, W);
  world.style.height = g.H + "px";
  world.style.width = W + "px";
  const pts = [{ x: W / 2, y: g.H - 40 }];
  for (let n = 1; n <= last; n++) pts.push(g.pos(n));
  pts.push({ x: W / 2, y: 30 });
  const doneTo = Math.min(cur, last);
  let html = "";
  const own = journey.koi.filter(i => koiImages[i]);
  // The chapters' stretches of garden
  for (let c = 1; c <= maxC; c++) {
    const z = ZONES[(c - 1) % ZONES.length];
    const top = g.gateY(c) - MAP_GATE / 2, bottom = c === 1 ? g.H : g.gateY(c - 1) - MAP_GATE / 2;
    html += `<div class="zone" style="top:${top}px;height:${bottom - top}px;--tint:${z.tint}"></div>`;
    // At each gate a view into the chapter's garden, which the stream runs through
    const gy = c === 1 ? g.H - 150 : g.gateY(c - 1), open = cur > (c - 1) * PER_CHAPTER;
    html += `<div class="gate-garden${open ? "" : " shut"}" style="top:${gy - 170}px;background-image:url(${sceneImg(sceneOfChapter(c))})"></div>`;
    // Scenery along both banks: something every stone or so, alternating sides, never on the path
    const rnd = seeded(hashSeed("map-zone-" + c));
    for (let k = 0; k < 16; k++) {
      const n = (c - 1) * PER_CHAPTER + 1 + Math.floor((k + rnd() * 0.9) * PER_CHAPTER / 16);
      const p = g.pos(n), side = p.x > W / 2 ? -1 : 1;
      const kind = z.decor[k % z.decor.length], up = DECOR_UPRIGHT[kind], size = (40 + rnd() * 30) * (up || 1);
      const x = W / 2 + side * W * (0.33 + rnd() * 0.12), y = p.y + (rnd() - 0.5) * MAP_STEP;
      const turn = Math.round((rnd() - 0.5) * 40);
      html += `<div class="decor d-${kind}" style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;--r:${up ? 0 : turn}deg">${DECOR[kind]}</div>`;
    }
    // Two koi from your collection drift about in every chapter's water
    for (let k = 0; k < 2; k++) {
      const n = (c - 1) * PER_CHAPTER + 3 + k * 7, p = g.pos(n), side = p.x > W / 2 ? -1 : 1;
      const img = ALL_KOI[own.length ? own[(c * 3 + k) % own.length] : [0, 3][k]].img;
      html += `<div class="map-fish" style="left:${W / 2 + side * W * 0.3}px;top:${p.y}px;--d:${-(c * 2.3 + k * 5.1).toFixed(1)}s;--s:${side}"><img src="${img}" alt=""></div>`;
    }
  }
  // The stream, and the part of it already travelled
  html += `<svg class="stream" width="${W}" height="${g.H}" viewBox="0 0 ${W} ${g.H}" aria-hidden="true">`
    + `<path class="bank" d="${smoothPath(pts)}"/><path class="water" d="${smoothPath(pts)}"/><path class="deep" d="${smoothPath(pts)}"/><path class="shine" d="${smoothPath(pts)}"/>`
    + `<path class="trail" d="${smoothPath(pts.slice(0, doneTo + 1))}"/></svg>`;
  // A gate at the start of every chapter after the first
  for (let c = 1; c <= maxC; c++) {
    const y = c === 1 ? g.H - 150 : g.gateY(c - 1);
    const open = cur > (c - 1) * PER_CHAPTER;
    // The gate also shows the koi waiting for whoever finishes the chapter before it
    const ki = chapterKoiIndex(c - 1), got = ki >= 0 && journey.koi.includes(ki);
    const prize = ki < 0 ? "" : `<span class="gate-koi${got ? "" : " waiting"}"><img src="${ALL_KOI[ki].img}" alt="">${got ? ALL_KOI[ki].name : "New koi"}</span>`;
    html += `<div class="gate${open ? "" : " shut"}" style="top:${y}px"><span class="gate-sign"><small>Chapter ${c}</small>${chapterName(c)}${open ? "" : `<em>Finish level ${(c - 1) * PER_CHAPTER} to open</em>`}${prize}</span></div>`;
  }
  // The stepping stones
  for (let n = 1; n <= last; n++) {
    const p = g.pos(n), L = levelDef(n);
    const done = journey.stars[n] !== undefined, locked = n > cur, st = journey.stars[n] || 0;
    html += `<button class="step${done ? " done" : ""}${locked ? " locked" : ""}${n === cur ? " current" : ""}${L.hard ? " hard" : ""}" data-n="${n}" style="left:${p.x}px;top:${p.y}px"`
      + ` aria-label="${locked ? `Level ${n}, locked` : `Level ${n}${done ? `, ${st} stars` : ""}`}">`
      + `${L.hard ? '<span class="hard-tag">HARD</span>' : ""}<b>${n}</b>`
      + (done ? `<span class="step-stars">${"★".repeat(st)}<i>${"★".repeat(3 - st)}</i></span>` : "") + `</button>`;
  }
  // Your koi
  html += `<div class="map-koi" id="mapKoi"><img src="${ALL_KOI[own.length ? own[own.length - 1] : 0].img}" alt=""></div>`;
  world.innerHTML = html;
}
function placeMapKoi(n) {
  const p = mapGeo.pos(n), el = $("mapKoi");
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
}
let mapChapterNow = 1;
function mapChapterInView() {
  const sc = $("mapScroll"), mid = sc.scrollTop + sc.clientHeight / 2;
  let c = 1;
  for (let k = 1; mapGeo && k <= 200; k++) { if (mapGeo.gateY(k) > mid) c = k + 1; else break; }
  mapChapterNow = c;
  $("mapChapter").textContent = `Chapter ${c} · ${chapterName(c)}`;
}
function openMap() {
  clearSurprises();
  closeOverlay();
  const view = $("mapView");
  view.hidden = false;
  buildMap();
  const total = Object.values(journey.stars).reduce((a, b) => a + (+b || 0), 0);
  $("mapStars").textContent = total;
  $("mapPearls").textContent = journey.pearls;
  // The big button always leads to the level you are on, or back into the one in progress
  const resume = S && S.mode === "journey" && !S.over && S.placed > 0;
  const n = resume ? S.level : currentLevel();
  $("mapPlay").querySelector("b").textContent = resume ? `Back to level ${n}` : `Play level ${n}`;
  $("mapPlay").querySelector("small").textContent = goalText(levelDef(n));
  $("mapBoost").hidden = !journey.streak;
  $("mapBoost").textContent = `×${journey.streak || 0}`;
  // Open on the stone you are on
  const cur = currentLevel(), seen = journey.mapSeen || cur;
  const sc = $("mapScroll");
  sc.scrollTop = mapGeo.pos(cur).y - sc.clientHeight * 0.55;
  mapChapterInView();
  // After a win, the koi starts on the stone it left and hops across to the new one
  if (seen < cur && !reduceMotion) {
    placeMapKoi(seen);
    const next = $("mapWorld").querySelector(`.step[data-n="${cur}"]`);
    if (next) next.classList.add("rising");
    setTimeout(() => {
      const a = mapGeo.pos(seen), b = mapGeo.pos(cur), el = $("mapKoi");
      el.animate([
        { left: a.x + "px", top: a.y + "px" },
        { left: (a.x + b.x) / 2 + "px", top: Math.min(a.y, b.y) - 50 + "px", offset: 0.5 },
        { left: b.x + "px", top: b.y + "px" }
      ], { duration: 700, easing: "cubic-bezier(0.645, 0.045, 0.355, 1)" });
      placeMapKoi(cur);
      setTimeout(() => { if (next) next.classList.add("rose"); bowl(4, 0.04); }, 650);
    }, 450);
  } else placeMapKoi(cur);
  journey.mapSeen = cur;
  saveJourney();
  startMapLife();
}
function closeMap() { $("mapView").hidden = true; stopMapLife(); }
$("mapScroll").addEventListener("scroll", () => { if (mapGeo) mapChapterInView(); }, { passive: true });
/* Light moving on the water, and the chapter's petals, leaves, snow or fireflies drifting over the map */
const mapCv = $("mapFx"), mapCx = mapCv.getContext("2d");
let mapLife = null;
function startMapLife() {
  stopMapLife();
  if (reduceMotion) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const life = mapLife = { raf: 0, last: performance.now(), kindName: "", list: [], W: 0, H: 0 };
  const frame = now => {
    if (mapLife !== life || $("mapView").hidden) return;
    life.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - life.last) / 1000);
    life.last = now;
    const W = mapCv.clientWidth, H = mapCv.clientHeight;
    if (W !== life.W || H !== life.H) { life.W = W; life.H = H; mapCv.width = W * dpr; mapCv.height = H * dpr; }
    mapCx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapCx.clearRect(0, 0, W, H);
    drawShimmer(mapCx, W, H, now / 1000, 0.75);
    const kindName = SCENES[sceneOfChapter(mapChapterNow)].air, kind = AIR[kindName];
    if (kindName !== life.kindName) {
      life.kindName = kindName;
      if (kind && kind.img) worldImage(kind.img);
      life.list = kind ? [...Array(Math.round(kind.n * (prefs.calm ? 0.5 : 1)))].map(() => airBit(kind, W, H, false)) : [];
    }
    drawAirBits(mapCx, kind, life.list, W, H, dt, now);
    mapCx.globalAlpha = 1;
  };
  life.raf = requestAnimationFrame(frame);
}
function stopMapLife() { if (mapLife) cancelAnimationFrame(mapLife.raf); mapLife = null; mapCx.clearRect(0, 0, mapCv.width, mapCv.height); }
$("mapWorld").addEventListener("click", e => {
  const b = e.target.closest(".step");
  if (!b) return;
  const n = +b.dataset.n;
  if (n > currentLevel()) { restartClass(b, "nope"); knock(); return; }
  closeMap();
  playLevel(n, false);
});
function openLevelIntro() {
  const L = levelDef(S.level);
  $("levelEyebrow").textContent = `Level ${S.level} · ${L.hard ? "Hard · double pearls" : chapterName(chapterOf(S.level))}`;
  // A view of the garden this level is played in, at its time of day
  const sc = sceneNowFor(S), ls = $("levelScene");
  ls.style.backgroundImage = `url(${sceneImg(sc.k)})`;
  ls.dataset.phase = sc.phase;
  $("levelSceneName").textContent = `Chapter ${chapterOf(S.level)} · ${chapterName(chapterOf(S.level))}`
    + (sc.rain ? " · rain" : sc.phase === "gold" ? " · afternoon" : sc.phase === "dusk" ? " · dusk" : "");
  $("levelGoal").textContent = goalText(L);
  $("levelPieces").textContent = `${L.pieces} pieces`;
  $("levelStars").textContent = L.s2 ? `Stars: 1 for the goal, 2 at ${L.s2} points, 3 at ${L.s3}.` : "Stars: 1 for the goal, more for a high score.";
  // What is new on this level always shows; a calm tip only now and then, so the card stays short
  const note = S.tut === 1 ? "Start by filling the glowing square in the middle."
    : NEW_IN[S.level] || (S.level % 4 === 1 ? TIPS[(S.level - 1) % TIPS.length] : "");
  $("levelNote").textContent = note;
  $("levelNote").hidden = !note;
  $("levelCard").querySelector(".stars-help").open = false;
  const cur = $("levelCurrent");
  cur.hidden = !!S.tut;
  if (!S.tut) {
    const s = journey.streak || 0;
    const waiting = S.jokers.length ? `You start with <b>${jokerList(S.jokers)}</b>${S.gift ? ", one a gift from your basket" : ""}.` : "";
    cur.innerHTML = currentRow(s, false) + `<p>${s
      ? `<b>Win streak ×${s}</b> · ${waiting}`
      : `${waiting ? waiting + " " : ""}Win levels in a row for a <b>win streak</b>: jokers ready at the start.`}</p>`;
  }
  $("levelShop").hidden = !!S.tut || S.jokers.length >= MAX_JOKERS;
  openCard("levelCard");
}
$("levelShop").addEventListener("click", () => openJokerShop(openLevelIntro));
// Five lotus buds, one per win in a row; the steps that give a joker are larger
function currentRow(s, fresh) {
  const shown = Math.min(s, CURRENT_MAX);
  let pips = "";
  for (let k = 1; k <= CURRENT_MAX; k++) {
    const step = CURRENT_STEPS.find(st => st.at === k);
    pips += `<i class="pip${k <= shown ? " on" : ""}${step ? " step" : ""}${fresh && k === shown ? " bloom" : ""}">${step ? `<img src="${ALL_KOI[JOKERS[step.joker].koi].img}" alt="">` : ""}</i>`;
  }
  return `<div class="pips" aria-hidden="true">${pips}</div>`;
}
$("levelPlay").addEventListener("click", () => {
  closeOverlay();
  // The jokers from the win streak and the basket arrive in the gold slot
  if (S.boost && !S.boostShown) {
    S.boostShown = true;
    restartClass(jokerSlot, "gain");
    toast(journey.streak ? `Win streak ×${journey.streak}` : "A gift from your basket");
    bowl(4, 0.04);
  }
});
// Leave the map: continue a level in progress, otherwise open the next level
function leaveMap() {
  closeMap();
  if (S && S.mode === "journey" && !S.over && S.placed > 0) { if (G.journey !== S) S = G.journey; closeOverlay(); render(); }
  else playLevel(currentLevel(), false);
}
$("mapPlay").addEventListener("click", leaveMap);
$("mapClose").addEventListener("click", leaveMap);
$("levelMap").addEventListener("click", openMap);

function winLevel() {
  S.over = true;
  S.won = true;
  const left = piecesLeft();
  S.jokerBonus = 50 * (S.jokers || []).length;
  S.bonus = 20 * left + S.jokerBonus;
  S.score += S.bonus;
  const ratio = left / S.limit;
  // Stars come from the score, pieces and jokers left included: one for the goal, two and three at the level's s2
  // and s3 (what the tuning bot scores in an average and a good win). Levels without them fall back on pieces left.
  // Extra pieces from a video cap it at one star, five pieces bought with pearls at two.
  const L = levelDef(S.level);
  const earned = L.s2 ? (S.score >= L.s3 ? 3 : S.score >= L.s2 ? 2 : 1) : ratio >= 0.45 ? 3 : ratio >= 0.25 ? 2 : 1;
  S.stars = S.extra ? 1 : Math.min(S.paidPieces ? 2 : 3, earned);
  S.pearls = (10 + 5 * S.stars) * (levelDef(S.level).hard ? 2 : 1);
  // The last level of a chapter, the first time: a pearl bonus and the next chapter opens
  S.chapterDone = S.level % PER_CHAPTER === 0 && journey.unlocked <= S.level;
  if (S.chapterDone) S.pearls += CHAPTER_PEARLS;
  journey.pearls += S.pearls;
  // Finishing a level for the first time (skips do not count) welcomes its koi into the collection
  S.newKoi = -1;
  if (S.level <= KOI_TYPES.length && !journey.koi.includes(S.level - 1)) {
    journey.koi.push(S.level - 1);
    S.newKoi = S.level - 1;
    initKoi();
  }
  // The last level of chapters 2-10 welcomes that chapter's koi
  const chapterKoi = S.level % PER_CHAPTER === 0 ? chapterKoiIndex(chapterOf(S.level)) : -1;
  if (chapterKoi >= 0 && !journey.koi.includes(chapterKoi)) {
    journey.koi.push(chapterKoi);
    S.newKoi = chapterKoi;
    initKoi();
  }
  journey.stars[S.level] = Math.max(journey.stars[S.level] || 0, S.stars);
  journey.unlocked = Math.max(journey.unlocked, S.level + 1);
  delete journey.fails[S.level];
  journey.streak = (journey.streak || 0) + 1;
  fillChest();
  saveJourney();
  tasksAdd({ stars: S.stars });
  track("level_end", { level: S.level, result: "win", stars: S.stars, data: { left, jokers: S.jokersUsed || 0, rescued: !!S.rescued, extra: !!S.extra } });
  setTimeout(() => checkStyleUnlocks(false), 1500);
  if (S.chapterDone) setTimeout(() => notify(`Chapter ${chapterOf(S.level)} complete · +${CHAPTER_PEARLS} pearls`, `${chapterName(chapterOf(S.level) + 1)} is open`, true), 2600);
  render();
  setTimeout(() => { showWin(); celebrate(); }, 750);
}
function showWin() {
  $("winEyebrow").textContent = `Level ${S.level} complete`;
  $("winStars").innerHTML = [...Array(S.stars)].map((_, k) => `<span style="animation-delay:${0.2 + k * 0.22}s">★</span>`).join("") + `<i>${"★".repeat(3 - S.stars)}</i>`;
  $("winScore").textContent = S.score;
  $("winStats").innerHTML = `<b>+${S.bonus - (S.jokerBonus || 0)}</b> for pieces left`
    + (S.jokerBonus ? ` · <b>+${S.jokerBonus}</b> from unused jokers` : "")
    + ` · <b>+${S.pearls * (S.doubled ? 2 : 1)}</b> pearls`;
  $("winDouble").hidden = S.doubled;
  $("winKoi").hidden = !(S.newKoi >= 0);
  if (S.newKoi >= 0) {
    $("winKoiName").textContent = `New koi: ${ALL_KOI[S.newKoi].name}`;
    $("winKoiImg").src = ALL_KOI[S.newKoi].img;
  }
  $("winNext").innerHTML = `Level ${S.level + 1}<small>${goalText(levelDef(S.level + 1))}</small>`;
  paintChest();
  // Enough stars for something in the garden: say what, and open the garden with one tap
  const pick = gardenAffordable();
  $("winGarden").hidden = !pick;
  if (pick) $("winGarden").innerHTML = `<span class="gn-star">★ ${starsToSpend()}</span><span class="gn-text">Enough to restore the <b>${pick.name.toLowerCase()}</b> in your garden</span><span class="gn-go">Garden ›</span>`;
  const s = journey.streak || 0, step = CURRENT_STEPS.find(st => st.at === s);
  $("winCurrent").innerHTML = currentRow(s, S.bank === undefined) + `<p><b>Win streak ×${s}</b> · `
    + (step ? `New: ${JOKERS[step.joker].name}! ` : "") + `Next level starts with ${jokerList(currentJokers(s))}.</p>`;
  openCard("winCard");
  if (S.bank === undefined) { winSound(S.stars); starsLand(S.stars); } else bowl(6, 0.05);
  // Pearls fly from the reward line into the pearl count, once per reward
  const gained = S.pearls * (S.doubled ? 2 : 1);
  const from = S.bank === undefined ? journey.pearls - gained : S.bank;
  S.bank = journey.pearls;
  flyPearls($("winStats"), $("winBank"), from, journey.pearls, 650);
}
// Each star lands with a ring of gold and its own note; the third shakes the card a little
function starsLand(n) {
  if (reduceMotion) return;
  const stars = [...$("winStars").querySelectorAll("span")];
  stars.forEach((el, k) => setTimeout(() => {
    if ($("winCard").hidden) return;
    const r = el.getBoundingClientRect();
    sparkBurst(r.left + r.width / 2, r.top + r.height / 2, k === 2 ? 30 : 16);
    starSound(k);
    buzz(k === 2 ? [14, 30, 18] : 10);
    if (k === 2 && !prefs.calm) restartClass($("winCard"), "thump");
  }, 200 + k * 220 + 300));
}
$("winNext").addEventListener("click", () => playLevel(S.level + 1, true, true));
$("winMap").addEventListener("click", openMap);
$("winDouble").addEventListener("click", () => showAd("double", () => {
  journey.pearls += S.pearls;
  S.doubled = true;
  saveJourney();
  showWin();
}));

function showFail(reason) {
  S.over = true;
  S.failReason = reason;
  if (!S.failCounted) {
    failSound();
    journey.fails[S.level] = (journey.fails[S.level] || 0) + 1;
    S.failCounted = true;
    // The current ends here; keeping going with a video and winning brings it back
    if (journey.streak) { S.lostStreak = journey.streak; journey.streak = 0; }
    saveJourney();
    track("level_end", { level: S.level, result: "fail", data: { reason, jokers: S.jokersUsed || 0 } });
  }
  $("failEyebrow").textContent = `Level ${S.level} · ${reason === "out" ? "out of pieces" : "no moves left"}`;
  const L = levelDef(S.level);
  const p = goalProgress(), t = goalTarget(L);
  const ratio = Math.min(1, p / t), short = goalShortBy(L, t - p);
  $("failTitle").textContent = ratio >= 0.7 ? "So close!" : "The pond needs another try";
  $("failProgress").textContent = goalShort();
  // How far you got, so a near miss feels like one
  const bar = $("failBar").firstElementChild;
  bar.style.width = "0%";
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = Math.round(ratio * 100) + "%"; }));
  $("failBar").classList.toggle("close", ratio >= 0.7);
  $("failShort").textContent = ratio >= 0.7 && short ? `Only ${short} to go.${reason === "out" && !S.extra ? " Ten more pieces could do it." : ""}` : "";
  const rescue = $("failRescue");
  if (reason === "out" && !S.extra) { rescue.hidden = false; rescue.innerHTML = `<span class="tag">Ad</span>+10 pieces <small>· max 1 star</small>`; }
  else if (reason === "stuck" && !S.rescued) { rescue.hidden = false; rescue.innerHTML = `<span class="tag">Ad</span>Clear the centre and keep going`; }
  else rescue.hidden = true;
  // Or five more pieces for pearls, once a try, without a video
  const buy = $("failBuy");
  buy.hidden = !(reason === "out" && !S.paidPieces);
  if (!buy.hidden) {
    buy.disabled = journey.pearls < MORE_PIECES_COST;
    buy.innerHTML = `<span class="cost-tag"><i class="pearl"></i>${MORE_PIECES_COST}</span>+${MORE_PIECES} pieces <small>· max 2 stars</small>`;
  }
  $("failSkip").hidden = (journey.fails[S.level] || 0) < 3;
  const lost = $("failCurrent");
  lost.hidden = !S.lostStreak;
  if (S.lostStreak) lost.innerHTML = rescue.hidden
    ? `Your <b>win streak ×${S.lostStreak}</b> has ended. Win a level to start a new one.`
    : `Keep going to save your <b>win streak ×${S.lostStreak}</b>.`;
  openCard("failCard");
}
$("failRescue").addEventListener("click", () => {
  const reason = S.failReason;
  showAd(reason === "out" ? "pieces" : "continue", () => {
    if (reason === "out") {
      S.limit += 10;
      S.extra = true;
      S.tray = S.tray.map(p => p || dealPiece());
    } else {
      // Clear your own stones from the centre 5×5; starting stones stay
      for (let r = 2; r < 7; r++) for (let c = 2; c < 7; c++) { const i = r * N + c; if (!S.preset[i]) S.board[i] = 0; }
      S.rescued = true;
      S.tray = S.tray.map(p => p && fairPiece(10, 2));
    }
    S.over = false;
    S.failCounted = false;
    if (S.lostStreak) { journey.streak = S.lostStreak; S.lostStreak = 0; saveJourney(); }
    closeOverlay();
    render();
    bowl(3);
    checkOver();
  });
});
$("failBuy").addEventListener("click", () => {
  if (S.failReason !== "out" || S.paidPieces || journey.pearls < MORE_PIECES_COST) return;
  journey.pearls -= MORE_PIECES_COST;
  S.paidPieces = true;
  S.limit += MORE_PIECES;
  S.tray = S.tray.map(p => p || dealPiece());
  S.over = false;
  S.failCounted = false;
  if (S.lostStreak) { journey.streak = S.lostStreak; S.lostStreak = 0; }
  saveJourney();
  track("buy", { level: S.level, data: { kind: "pieces", pearls: MORE_PIECES_COST } });
  closeOverlay();
  render();
  chime(true);
  toast(`+${MORE_PIECES} pieces`);
  checkOver();
});
$("failRetry").addEventListener("click", () => playLevel(S.level, true));
$("failMap").addEventListener("click", openMap);
$("failBreathe").addEventListener("click", () => { const r = S.failReason; showBreak(() => showFail(r)); });
$("failSkip").addEventListener("click", () => showAd("skip", () => {
  track("level_end", { level: S.level, result: "skip" });
  journey.stars[S.level] = journey.stars[S.level] || 0;
  journey.unlocked = Math.max(journey.unlocked, S.level + 1);
  delete journey.fails[S.level];
  saveJourney();
  openMap();
}));
$("swapBtn").addEventListener("click", () => {
  if (S.mode !== "journey" || S.over || drag || !overlay.hidden) return;
  const swap = () => { clearHint(); S.tray = S.tray.map(p => p && fairPiece(10, 2)); entering.add(0); entering.add(1); closeOverlay(); render(); tick(); };
  if (journey.pearls >= SWAP_COST) { journey.pearls -= SWAP_COST; saveJourney(); swap(); }
  else showAd("swap", swap);
});

// Hint: try both pieces in every rotation and spot, prefer clears, then snug fits next to other stones
let hintCells = new Set(), hintSlot = -1, hintTimer = null;
function findHint() {
  let bestMove = null;
  S.tray.forEach((p, slot) => {
    if (!p) return;
    let g = p.g;
    for (let k = 0; k < 4; k++, g = rotateGrid(g)) {
      const sh = parse(g);
      for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.w; c++) {
        if (!fits(sh, r, c)) continue;
        const sim = S.board.slice();
        const cells = sh.cells.map(([dr, dc]) => (r + dr) * N + c + dc);
        cells.forEach(i => { sim[i] = p.c; });
        const lines = fullLines(sim);
        let score = lines.length * 100;
        lineCells(lines).forEach(i => {
          if (S.board[i] === KOI) score += 60;
          if (S.preset && S.preset[i]) score += 15;
          if (S.board[i] === BAMBOO) score += 40;
          if (S.lotus && S.lotus[i]) score += 60;
        });
        cells.forEach(i => {
          const rr = Math.floor(i / N), cc = i % N;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => {
            const r2 = rr + a, c2 = cc + b;
            score += (r2 < 0 || c2 < 0 || r2 >= N || c2 >= N || S.board[r2 * N + c2]) ? 2 : 0;
          });
        });
        if (!bestMove || score > bestMove.score) bestMove = { score, slot, g, cells };
      }
    }
  });
  return bestMove;
}
function clearHint() { hintCells = new Set(); hintSlot = -1; clearTimeout(hintTimer); }
function showHint() {
  const h = findHint();
  if (!h) return;
  S.tray[h.slot].g = h.g;
  hintCells = new Set(h.cells);
  hintSlot = h.slot;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { clearHint(); render(); }, 6000);
  closeOverlay();
  render();
  tick();
}
$("hintBtn").addEventListener("click", () => {
  if (S.mode === "daily" || S.over || drag || !overlay.hidden) return;
  if (journey.pearls >= HINT_COST) { journey.pearls -= HINT_COST; saveJourney(); showHint(); }
  else showAd("hint", showHint);
});

/* ---------- Streak, reminders, gardens ---------- */
function liveStreak() { return daily.last === today().key || daily.last === dayOffset(-1) ? daily.streak : 0; }
function canRestore() {
  return daily.streak > 1 && daily.last === dayOffset(-2)
    && (!daily.restoredOn || daysBetween(daily.restoredOn, today().key) >= 7);
}
function updateModes() {
  ["Journey", "Endless", "Daily"].forEach(m => $("mode" + m).setAttribute("aria-pressed", String(S.mode === m.toLowerCase())));
  // On a Journey level the board gets the room: Endless and Daily are on the home screen
  document.querySelector("header .modes").hidden = S.mode === "journey";
  const t = today();
  $("modeDaily").textContent = `Daily #${t.num}`;
  $("modeDaily").classList.toggle("new", !playedOfficial() && S.mode !== "daily");
  const nudge = $("nudge");
  let msg = "";
  if (canRestore()) msg = `Your <b>${daily.streak}-day streak</b> slipped yesterday. Tap to save it with pearls or a short video.`;
  else if (S.mode !== "daily" && daily.last === dayOffset(-1) && daily.streak > 0) msg = `Keep your <b>${daily.streak}-day streak</b> alive. Today’s daily is waiting.`;
  nudge.innerHTML = msg;
  if (nudge.hidden === !!msg) { nudge.hidden = !msg; requestAnimationFrame(layout); }
}
$("nudge").addEventListener("click", () => {
  if (!overlay.hidden || drag) return;
  if (canRestore()) openStreakSave();
  else switchMode("daily");
});
/* Saving a slipped Daily streak: with pearls, or with a short video. Either way at most once a week. */
const STREAK_SAVE_COST = 150;
function restoreStreak() {
  daily.last = dayOffset(-1);
  daily.restoredOn = today().key;
  saveDaily();
  closeOverlay();
  render();
  bowl(4);
  setTimeout(() => toast(`${daily.streak}-day streak saved`), 200);
}
function openStreakSave() {
  $("streakNum").textContent = daily.streak;
  $("streakTitle").textContent = `Save your ${daily.streak}-day streak?`;
  $("streakBank").querySelector("b").textContent = journey.pearls;
  const b = $("streakPearls"), can = journey.pearls >= STREAK_SAVE_COST;
  b.disabled = !can;
  b.innerHTML = `<span class="cost-tag"><i class="pearl"></i>${STREAK_SAVE_COST}</span>Save with pearls`
    + (can ? "" : ` <small>· ${STREAK_SAVE_COST - journey.pearls} more needed</small>`);
  openCard("streakCard");
}
$("streakPearls").addEventListener("click", () => {
  if (!canRestore() || journey.pearls < STREAK_SAVE_COST) return;
  journey.pearls -= STREAK_SAVE_COST;
  saveJourney();
  track("buy", { data: { kind: "streak", pearls: STREAK_SAVE_COST } });
  const r = $("streakNum").getBoundingClientRect();
  sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 26);
  chime(true);
  restoreStreak();
});
$("streakVideo").addEventListener("click", () => { if (canRestore()) showAd("streak", restoreStreak); });
$("streakLater").addEventListener("click", () => closeOverlay());

function notifCopy() {
  const s = liveStreak();
  return s > 0 ? `Your ${s}-day streak is waiting. One calm round before the day ends?` : "Today’s pond is ready. Three minutes of calm?";
}
function syncRemind() {
  $("remindOn").checked = remind.on;
  $("remindTime").value = remind.time;
  $("notifTime").textContent = remind.time;
  $("notifText").textContent = notifCopy();
  $("notif").classList.toggle("off", !remind.on);
  $("dailyRemind").textContent = remind.on ? `Reminder on at ${remind.time} · change` : "Remind me tomorrow";
}
function saveRemind() { try { localStorage.setItem("mb-remind", JSON.stringify(remind)); } catch (e) {} syncRemind(); syncNativeReminders(); }
// In the app, reminders become local notifications. If the player says no to notifications, switch the reminder off again.
function syncNativeReminders() {
  if (!nativeApp) return;
  window.MBNative.scheduleReminders({ on: remind.on, time: remind.time, text: notifCopy(), playedToday: playedOfficial() }).then(ok => {
    if (remind.on && !ok) {
      remind.on = false;
      try { localStorage.setItem("mb-remind", JSON.stringify(remind)); } catch (e) {}
      syncRemind();
    }
  });
}
let remindBack = null;
function openRemind(back) { remindBack = back; syncRemind(); openCard("remindCard"); }
$("remindOn").addEventListener("change", e => { remind.on = e.target.checked; saveRemind(); });
$("remindTime").addEventListener("change", e => { remind.time = e.target.value; remind.on = true; saveRemind(); });
$("remindDone").addEventListener("click", () => { const b = remindBack; remindBack = null; b ? b() : closeOverlay(); });

// Day, Night or Auto. Auto follows the phone's light or dark setting.
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function applyGarden() {
  const night = garden === "night" || (garden === "auto" && darkQuery.matches);
  if (night) document.documentElement.dataset.garden = "night";
  else delete document.documentElement.dataset.garden;
  ["Auto", "Day", "Night"].forEach(g => $("garden" + g).setAttribute("aria-pressed", String(garden === g.toLowerCase())));
  readPalette();
  $("gardenNote").textContent = garden === "auto" ? "Auto follows your phone: day by day, night by night." : garden === "night" ? "The night pond, with lantern-coloured stones." : "The day pond, in full colour.";
}
darkQuery.addEventListener("change", () => { if (garden === "auto") applyGarden(); });
function setGarden(g) {
  garden = g;
  try { localStorage.setItem("mb-garden", g); } catch (e) {}
  applyGarden();
}
$("gardenDay").addEventListener("click", () => setGarden("day"));
$("gardenNight").addEventListener("click", () => setGarden("night"));
$("gardenAuto").addEventListener("click", () => setGarden("auto"));
["Journey", "Endless", "Daily"].forEach(m => $("mode" + m).addEventListener("click", () => {
  if (overlay.hidden || !$("levelCard").hidden) switchMode(m.toLowerCase());
}));

/* ---------- The chest: every fifth level won fills it ----------
   Five pips on the win card; the fifth win opens it for pearls and a joker for the next level. */
const CHEST_EVERY = 5;
function fillChest() {
  journey.chest = (journey.chest || 0) + 1;
  S.chestOpened = null;
  if (journey.chest < CHEST_EVERY) return;
  journey.chest = 0;
  const c = Math.min(10, chapterOf(S.level));
  const pearls = 40 + 10 * c;
  journey.pearls += pearls;
  // A joker waits for the next level, unless the basket already left one there
  const jokers = ["arrow", "ripple", "rainbow"];
  const joker = journey.gift ? "" : jokers[S.level % jokers.length];
  if (joker) journey.gift = joker;
  S.chestOpened = { pearls, joker };
  tasksAdd({});
}
function paintChest() {
  const row = $("winChest"), n = journey.chest || 0, open = S.chestOpened;
  const pips = [...Array(CHEST_EVERY)].map((_, k) => `<i class="${open || k < n ? "on" : ""}${!open && k === n - 1 ? " new" : ""}"></i>`).join("");
  row.className = "chest-row" + (open ? " open" : "");
  row.innerHTML = `<span class="chest" aria-hidden="true"><img class="shut" src="img/ui/chest.webp" alt=""><img class="open" src="img/ui/chest-open.webp" alt=""></span>`
    + `<span class="chest-text">${open
      ? `<b>Chest opened!</b> +${open.pearls} pearls${open.joker ? ` · ${JOKERS[open.joker].name} for your next level` : ""}`
      : `<b>Chest</b> · ${CHEST_EVERY - n} more ${CHEST_EVERY - n === 1 ? "win" : "wins"} to open it`}</span><span class="pips">${pips}</span>`;
  if (open && !S.chestShown) {
    S.chestShown = true;
    setTimeout(() => chime(true), 700);
  }
}

$("winGarden").addEventListener("click", () => openGarden(() => {}));
