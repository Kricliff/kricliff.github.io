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
/* Each chapter's own look, by its scene (so chapters after 10 that reuse a name also reuse its look): a painted stretch
   of water with its own banks, a landmark by the chapter's last stone that lights up when the chapter is done, and
   for most chapters stepping stones of their own. Painted with Everygen (assets/map/make_map.py). */
const CHAPTER_LOOK = [
  { mark: "azumaya" },
  { mark: "bamboo-gate", stone: "moss" },
  { mark: "lotus-pavilion", stone: "pad" },
  { mark: "moon-bridge", stone: "wood" },
  { mark: "cherry-shrine", stone: "cherry" },
  { mark: "waterfall" },
  { mark: "tea-house", stone: "wood" },
  { mark: "maple-gate", stone: "maple" },
  { mark: "bell", stone: "snow" },
  { mark: "golden", stone: "gold" }
];
const stoneImg = k => k === "pad" ? "img/map/pad.webp" : `img/map/stone-${k}.webp`;
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
  const own = journey.koi.filter(i => koiImages[i]), fish = [];
  // The chapters' stretches of garden
  for (let c = 1; c <= maxC; c++) {
    const z = ZONES[(c - 1) % ZONES.length];
    const top = g.gateY(c) - MAP_GATE / 2, bottom = c === 1 ? g.H : g.gateY(c - 1) - MAP_GATE / 2;
    const sc = sceneOfChapter(c), look = CHAPTER_LOOK[sc];
    html += `<div class="zone" style="top:${top}px;height:${bottom - top}px;--tint:${z.tint};background-image:url(img/map/ch-${sc + 1}.webp)"></div>`;
    // The chapter's landmark beside its last stone, across the water from it; lit once the chapter is done
    const endP = g.pos(c * PER_CHAPTER), leftSide = endP.x > W / 2, size = Math.min(170, W * 0.42);
    const done = cur > c * PER_CHAPTER;
    html += `<div class="landmark${done ? " lit" : ""}" style="left:${(leftSide ? W * 0.2 : W * 0.8) - size / 2}px;top:${endP.y - size * 0.62}px;width:${size}px;height:${size}px">`
      + `<img src="img/map/mark-${look.mark}.webp" alt=""></div>`;
    // At each gate a view into the chapter's garden, which the stream runs through
    const gy = c === 1 ? g.H - 150 : g.gateY(c - 1), open = cur > (c - 1) * PER_CHAPTER;
    html += `<div class="gate-garden${open ? "" : " shut"}" style="top:${gy - 170}px;background-image:url(${sceneImg(sceneOfChapter(c))})"></div>`;
    // Scenery along both banks: something every stone or so, alternating sides, never on the path
    const rnd = seeded(hashSeed("map-zone-" + c));
    for (let k = 0; k < 8; k++) {
      const n = (c - 1) * PER_CHAPTER + 1 + Math.floor((k + rnd() * 0.9) * PER_CHAPTER / 8);
      if (n >= c * PER_CHAPTER - 1) continue;
      const p = g.pos(n), side = p.x > W / 2 ? -1 : 1;
      const kind = z.decor[k % z.decor.length], up = DECOR_UPRIGHT[kind], size = (40 + rnd() * 30) * (up || 1);
      const x = W / 2 + side * W * (0.33 + rnd() * 0.12), y = p.y + (rnd() - 0.5) * MAP_STEP;
      const turn = Math.round((rnd() - 0.5) * 40);
      html += `<div class="decor d-${kind}" style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;--r:${up ? 0 : turn}deg">${DECOR[kind]}</div>`;
    }
    // Two koi from your collection swim in every chapter's water, each in its own stretch beside the path
    for (let k = 0; k < 2; k++) {
      const n = (c - 1) * PER_CHAPTER + 3 + k * 7, p = g.pos(n), side = p.x > W / 2 ? -1 : 1;
      const bw = Math.round(W * MAP_FISH_BOX.w), bh = MAP_FISH_BOX.h;
      const f = makeFish(own.length ? own[(c * 3 + k) % own.length] : [0, 3][k], bw, bh, 50, 64);
      Object.assign(f, { hx: W / 2 + side * W * 0.3 - bw / 2, hy: p.y - bh * 0.6, bw, bh });
      fish.push(f);
    }
  }
  // The koi are drawn here: above the gardens and the scenery, under the stream, the gates and the stones
  html += `<canvas class="map-swim" id="mapSwim" aria-hidden="true"></canvas>`;
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
    const stone = CHAPTER_LOOK[sceneOfChapter(chapterOf(n))].stone;
    html += `<button class="step${done ? " done" : ""}${locked ? " locked" : ""}${n === cur ? " current" : ""}${L.hard ? " hard" : ""}${st === 3 ? " three" : ""}${stone ? " themed" : ""}" data-n="${n}" style="left:${p.x}px;top:${p.y}px"`
      + ` aria-label="${locked ? `Level ${n}, locked` : `Level ${n}${done ? `, ${st} stars` : ""}`}">`
      + `${stone ? `<i class="stone-img" style="background-image:url(${stoneImg(stone)})"></i>` : ""}${L.hard ? '<span class="hard-tag">HARD</span>' : ""}<b>${n}</b>`
      + (done ? `<span class="step-stars">${"★".repeat(st)}<i>${"★".repeat(3 - st)}</i></span>` : "") + `</button>`;
  }
  // Your koi, swimming round the stone you are on: drawn here, over the stones
  html += `<canvas class="map-swim over" id="mapSwimOver" aria-hidden="true"></canvas>`;
  world.innerHTML = html;
  mapFish = fish;
  mapSwim = { cv: $("mapSwim"), over: $("mapSwimOver"), top: -1e9, W, H: 0 };
  mapOwn = Object.assign(makeFish(own.length ? own[own.length - 1] : 0, 1, 1, 52, 52), { n: 0, amp: 0.8, turn: 0, ang: -Math.PI / 2, spin: MAP_OWN_SPIN, spinTarget: MAP_OWN_SPIN, burstIn: 4, hop: null });
}

/* ---------- Koi in the map's water ----------
   They swim the way the koi behind the board do (makeFish, stepFish and drawFish in effects.js): a body that bends
   with each tail beat and into each turn, a shadow on the bottom, unhurried drifts with now and then a burst of speed.
   Each keeps to its own stretch of water, a box beside the path; near its edge it turns back in. They were CSS loops
   before, the same circle over and over with a stiff wiggle.
   The canvas lies inside the map and is twice the screen's height, so it scrolls with the map by itself and is only
   moved (and drawn afresh) when the view has nearly reached its edge. A tap in the water sends nearby koi darting off. */
const MAP_FISH_BOX = { w: 0.34, h: 300 };
let mapFish = [], mapSwim = null;
function stepMapFish(dt) { mapFish.forEach(f => stepFish(f, dt, f.bw, f.bh, null)); }
function drawMapFish() {
  const sw = mapSwim;
  if (!sw || !sw.cv) return;
  const sc = $("mapScroll"), H = sc.clientHeight, top = sc.scrollTop, dpr = Math.min(2, devicePixelRatio || 1);
  if (H !== sw.H) {
    sw.H = H;
    [sw.cv, sw.over].forEach(cv => { cv.width = Math.round(sw.W * dpr); cv.height = Math.round(2 * H * dpr); cv.style.width = sw.W + "px"; cv.style.height = 2 * H + "px"; });
    sw.top = -1e9;
  }
  // Move the canvases only when the view is close to their top or bottom edge
  if (top < sw.top + 40 || top + H > sw.top + 2 * H - 40) { sw.top = Math.max(0, Math.round(top - H / 2)); sw.cv.style.top = sw.over.style.top = sw.top + "px"; }
  drawMapOwn(dpr);
  const c = sw.cv.getContext("2d"), night = isNight();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, sw.cv.width, sw.cv.height);
  c.setTransform(dpr, 0, 0, dpr, 0, -sw.top * dpr);
  // Seen through the water: a touch of its colour, more at night
  const tint = [night ? "#0d2a44" : "#1f6f73", night ? 0.38 : 0.14];
  mapFish.forEach(f => {
    if (f.hy + f.bh + 60 < sw.top || f.hy - 60 > sw.top + 2 * H) return;
    c.save();
    c.translate(f.hx, f.hy);
    drawFish(c, [f], 1, night ? 0.18 : 0.3, tint);
    c.restore();
  });
}
function mapFishTap(e) {
  const w = $("mapWorld").getBoundingClientRect(), x = e.clientX - w.left, y = e.clientY - w.top;
  let near = false;
  mapFish.forEach(f => {
    const fx = f.hx + f.x, fy = f.hy + f.y;
    if (Math.hypot(fx - x, fy - y) > 150) return;
    near = true;
    // Away from the finger, fast, then back to an easy glide
    f.a = Math.atan2(fy - y, fx - x);
    f.turn = 0; f.turnTarget = 0; f.turnVel = 0;
    f.v = f.vTarget = 58;
    f.timer = 1.1;
  });
  ring("tap-ring map-tap", e.clientX, e.clientY);
  if (near && sfxOk()) voice(620 + Math.random() * 120, 0, 0.12, 0.018, 420);
}
/* ---------- Your koi on the map ----------
   It swims round the stone you are on, as a koi circles a rock: never quite the same lap twice, now slower, now with a
   short burst, the body bent into the turn. After a win it leaps out of the water, across to the next stone, with a
   splash where it lands, and swims on round that one. It was a picture turned in a circle before. */
const MAP_OWN_R = 44, MAP_OWN_SPIN = 1.05, MAP_OWN_HOP = 0.75;
let mapOwn = null;
function placeMapKoi(n) {
  if (!mapOwn) return;
  mapOwn.n = n;
  mapOwn.hop = null;
  const p = mapGeo.pos(n);
  mapOwn.x = p.x + Math.cos(mapOwn.ang) * MAP_OWN_R;
  mapOwn.y = p.y + Math.sin(mapOwn.ang) * MAP_OWN_R;
}
// From the stone it is on to stone n, in a leap; onLand runs as it touches the water again
function hopMapKoi(n, onLand) {
  const o = mapOwn;
  if (!o) return;
  const a = mapGeo.pos(o.n), b = mapGeo.pos(n);
  // It lands on the side of the new stone that faces the old one, and swims on round from there
  const land = Math.atan2(a.y - b.y, a.x - b.x) + 0.5;
  o.hop = { from: { x: o.x, y: o.y }, to: { x: b.x + Math.cos(land) * MAP_OWN_R, y: b.y + Math.sin(land) * MAP_OWN_R }, t: 0, land, n, onLand };
}
function stepMapOwn(dt) {
  const o = mapOwn;
  if (!o || !mapGeo) return;
  if (o.hop) {
    const h = o.hop;
    h.t = Math.min(1, h.t + dt / MAP_OWN_HOP);
    const k = h.t < 0.5 ? 2 * h.t * h.t : 1 - 2 * (1 - h.t) * (1 - h.t);
    const px = o.x, py = o.y;
    o.x = h.from.x + (h.to.x - h.from.x) * k;
    o.y = h.from.y + (h.to.y - h.from.y) * k;
    if (Math.hypot(o.x - px, o.y - py) > 0.3) o.a = Math.atan2(o.y - py, o.x - px);
    o.amp = 1.5;
    o.turn = 0;
    o.phase += dt * 14;
    if (h.t >= 1) {
      o.hop = null;
      o.n = h.n;
      o.ang = h.land;
      o.spin = o.spinTarget = MAP_OWN_SPIN * 1.8;
      o.burstIn = 1.2;
      const w = $("mapWorld").getBoundingClientRect();
      splash(w.left + o.x, w.top + o.y, 0);
      ring("tap-ring map-tap", w.left + o.x, w.top + o.y);
      if (h.onLand) h.onLand();
    }
    return;
  }
  // Round the stone: the speed drifts, and every few seconds there is a short burst or a slow glide
  o.burstIn -= dt;
  if (o.burstIn <= 0) {
    o.spinTarget = MAP_OWN_SPIN * (Math.random() < 0.3 ? 1.9 : 0.55 + Math.random() * 0.7);
    o.burstIn = 2.5 + Math.random() * 3.5;
  }
  o.spin += (o.spinTarget - o.spin) * Math.min(1, dt * 0.9);
  o.ang += o.spin * dt;
  // The lap is not a perfect circle: it swings a little wider and closer
  const r = MAP_OWN_R + Math.sin(o.ang * 2 + o.phase * 0.05) * 5, p = mapGeo.pos(o.n);
  const nx = p.x + Math.cos(o.ang) * r, ny = p.y + Math.sin(o.ang) * r;
  o.a = Math.atan2(ny - o.y, nx - o.x) || o.ang + Math.PI / 2;
  o.x = nx; o.y = ny;
  o.turn = o.spin;
  const speed = o.spin * r, ampTarget = Math.min(1.4, 0.45 + Math.abs(o.spinTarget - o.spin) * 0.8 + speed / 60);
  o.amp += (ampTarget - o.amp) * Math.min(1, dt * 1.5);
  o.phase += dt * (1.8 + speed * 0.09 + o.amp * 2.2);
}
function drawMapOwn(dpr) {
  const o = mapOwn, cv = mapSwim && mapSwim.over;
  if (!cv) return;
  const c = cv.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  if (!o || !o.n) return;
  c.setTransform(dpr, 0, 0, dpr, 0, -mapSwim.top * dpr);
  if (!o.hop) { drawFish(c, [o], 1, 0.35); return; }
  // In the air: bigger as it rises, its shadow left behind on the water below
  const lift = Math.sin(Math.PI * o.hop.t), s = 1 + 0.35 * lift;
  c.save();
  c.translate(o.x, o.y - 46 * lift);
  c.scale(s, s);
  c.translate(-o.x, -o.y);
  drawFish(c, [o], 1, 0.35 * (1 - lift));
  c.restore();
}
let mapChapterNow = 1;
function mapChapterInView() {
  const sc = $("mapScroll"), mid = sc.scrollTop + sc.clientHeight / 2;
  let c = 1;
  for (let k = 1; mapGeo && k <= 200; k++) { if (mapGeo.gateY(k) > mid) c = k + 1; else break; }
  const changed = mapChapterNow !== c;
  mapChapterNow = c;
  $("mapChapter").textContent = `Chapter ${c} · ${chapterName(c)}`;
  // This chapter's progress: levels done and stars, out of what it holds
  const first = (c - 1) * PER_CHAPTER + 1;
  let doneN = 0, starsN = 0;
  for (let n = first; n < first + PER_CHAPTER; n++) if (journey.stars[n] !== undefined) { doneN++; starsN += +journey.stars[n] || 0; }
  $("mapProgress").textContent = `${doneN}/${PER_CHAPTER} levels · ${starsN}/${PER_CHAPTER * 3} ★`
    + (first >= TRAIL_FROM ? ` · lotus ${trailText(trailRound(first))}` : "");
  if (changed && mapBannerReady) {
    const b = $("mapBanner");
    b.innerHTML = `<small>Chapter ${c}</small>${chapterName(c)}`;
    restartClass(b, "show");
  }
}
let mapBannerReady = false;
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
  mapBannerReady = false;
  mapChapterNow = 0;
  mapChapterInView();
  setTimeout(() => { mapBannerReady = true; }, 600);
  // After a win, the koi starts on the stone it left and hops across to the new one
  if (seen < cur && !reduceMotion) {
    placeMapKoi(seen);
    const next = $("mapWorld").querySelector(`.step[data-n="${cur}"]`);
    if (next) next.classList.add("rising");
    // Half a lap round the old stone first, then the leap
    setTimeout(() => hopMapKoi(cur, () => { if (next) next.classList.add("rose"); bowl(4, 0.04); buzz(10); }), 700);
  } else placeMapKoi(cur);
  journey.mapSeen = cur;
  saveJourney();
  huntAt = 0;
  paintHunt();
  startMapLife();
}
function closeMap() { $("mapView").hidden = true; stopMapLife(); }
/* ---------- Star hunt ----------
   Levels that are won but have fewer than three stars (skipped ones too). The button on the map counts them and
   scrolls to the next one each time it is tapped; the stone pulses, and a tap on it plays the level again. */
let huntAt = 0;
const huntLevels = () => { const out = []; for (let n = 1; n < currentLevel(); n++) if ((journey.stars[n] || 0) < 3) out.push(n); return out; };
function paintHunt() {
  const list = huntLevels(), b = $("mapHunt");
  b.hidden = !list.length;
  if (list.length) b.innerHTML = `<span>★★★</span> ${list.length} ${list.length === 1 ? "level" : "levels"} to perfect`;
}
$("mapHunt").addEventListener("click", () => {
  const list = huntLevels();
  if (!list.length || !mapGeo) return;
  // The next one after the last stone shown, so every tap moves on
  const n = list.find(k => k > huntAt) || list[0];
  huntAt = n;
  const sc = $("mapScroll"), st = journey.stars[n] || 0;
  sc.scrollTo({ top: mapGeo.pos(n).y - sc.clientHeight * 0.5, behavior: reduceMotion ? "auto" : "smooth" });
  $("mapWorld").querySelectorAll(".step.hunt").forEach(el => el.classList.remove("hunt"));
  const step = $("mapWorld").querySelector(`.step[data-n="${n}"]`);
  if (step) step.classList.add("hunt");
  $("mapHunt").innerHTML = `Level ${n} · ${st ? "★".repeat(st) : "skipped"} · tap the stone to play it again`;
  tick();
});
$("mapScroll").addEventListener("scroll", () => { if (mapGeo) mapChapterInView(); if (reduceMotion) drawMapFish(); }, { passive: true });
/* Light moving on the water, and the chapter's petals, leaves, snow or fireflies drifting over the map */
const mapCv = $("mapFx"), mapCx = mapCv.getContext("2d");
let mapLife = null;
function startMapLife() {
  stopMapLife();
  // With reduced motion the koi hold still: drawn once here, and again as the map scrolls
  if (reduceMotion) { drawMapFish(); return; }
  const dpr = Math.min(2, devicePixelRatio || 1);
  const life = mapLife = { raf: 0, last: performance.now(), kindName: "", list: [], W: 0, H: 0 };
  const frame = now => {
    if (mapLife !== life || $("mapView").hidden) return;
    life.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - life.last) / 1000);
    life.last = now;
    stepMapFish(dt);
    stepMapOwn(dt);
    drawMapFish();
    const W = mapCv.clientWidth, H = mapCv.clientHeight;
    if (W !== life.W || H !== life.H) { life.W = W; life.H = H; mapCv.width = W * dpr; mapCv.height = H * dpr; }
    mapCx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapCx.clearRect(0, 0, W, H);
    drawShimmer(mapCx, W, H, now / 1000, 0.75);
    const scene = SCENES[sceneOfChapter(mapChapterNow)], kindName = scene.air, kind = AIR[kindName];
    if (kindName !== life.kindName || scene.id !== life.scene) {
      life.kindName = kindName;
      life.scene = scene.id;
      life.flies = MAP_BUTTERFLIES.has(scene.id) ? [...Array(prefs.calm ? 2 : 4)].map(() => butterfly(W, H)) : [];
      if (kind && kind.img) worldImage(kind.img);
      life.list = kind ? [...Array(Math.round(kind.n * (prefs.calm ? 0.5 : 1)))].map(() => airBit(kind, W, H, false)) : [];
    }
    // The map is big and calm: leaves, petals and snow drift a little slower than round the board
    drawAirBits(mapCx, kind, life.list, W, H, dt * MAP_AIR_PACE, now);
    drawButterflies(mapCx, life.flies || [], W, H, dt * 0.6, now);
    mapCx.globalAlpha = 1;
  };
  life.raf = requestAnimationFrame(frame);
}
// Butterflies over the chapters with gardens and flowers: wandering, wings beating
const MAP_AIR_PACE = 0.3;
const MAP_BUTTERFLIES = new Set(["koi-pond", "bamboo-grove", "lotus-lake", "cherry-hill", "tea-house"]);
const BUTTERFLY_COLOURS = ["#ffd75e", "#ff9ec4", "#ffffff", "#9fd8ff", "#ffb36b"];
const butterfly = (W, H) => ({ x: Math.random() * W, y: Math.random() * H, a: Math.random() * 6.28, ph: Math.random() * 6.28,
  c: BUTTERFLY_COLOURS[Math.floor(Math.random() * BUTTERFLY_COLOURS.length)], s: 6 + Math.random() * 4 });
function drawButterflies(c, list, W, H, dt, now) {
  list.forEach(b => {
    b.a += Math.sin(now / 900 + b.ph) * 1.4 * dt;
    b.x += Math.cos(b.a) * 24 * dt;
    b.y += Math.sin(b.a) * 18 * dt;
    if (b.x < -20) b.x = W + 15; else if (b.x > W + 20) b.x = -15;
    if (b.y < -20) b.y = H + 15; else if (b.y > H + 20) b.y = -15;
    const flap = 0.25 + 0.75 * Math.abs(Math.sin(now / 85 + b.ph));
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.a + Math.PI / 2);
    c.globalAlpha = 0.92;
    c.fillStyle = b.c;
    c.shadowColor = "rgba(0, 0, 0, 0.25)";
    c.shadowBlur = 3;
    c.beginPath();
    c.ellipse(-b.s * 0.45 * flap, -b.s * 0.15, b.s * 0.5 * flap + 0.4, b.s * 0.6, -0.3, 0, 6.283);
    c.ellipse(b.s * 0.45 * flap, -b.s * 0.15, b.s * 0.5 * flap + 0.4, b.s * 0.6, 0.3, 0, 6.283);
    c.ellipse(-b.s * 0.3 * flap, b.s * 0.35, b.s * 0.32 * flap + 0.3, b.s * 0.38, -0.5, 0, 6.283);
    c.ellipse(b.s * 0.3 * flap, b.s * 0.35, b.s * 0.32 * flap + 0.3, b.s * 0.38, 0.5, 0, 6.283);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "#3a2a1a";
    c.fillRect(-0.8, -b.s * 0.55, 1.6, b.s * 1.1);
    c.restore();
  });
}
function stopMapLife() { if (mapLife) cancelAnimationFrame(mapLife.raf); mapLife = null; mapCx.clearRect(0, 0, mapCv.width, mapCv.height); }
$("mapWorld").addEventListener("click", e => {
  const b = e.target.closest(".step");
  if (!b) { if (!reduceMotion) mapFishTap(e); return; }
  const n = +b.dataset.n;
  if (n > currentLevel()) { restartClass(b, "nope"); knock(); return; }
  closeMap();
  playLevel(n, false);
});
function openLevelIntro() {
  const L = levelDef(S.level);
  $("levelEyebrow").textContent = `Level ${S.level} · ${L.hard ? "Hard · double pearls" : chapterName(chapterOf(S.level))}` + (S.replay ? " · playing again" : "");
  // A view of the garden this level is played in, at its time of day
  const sc = sceneNowFor(S), ls = $("levelScene");
  ls.style.backgroundImage = `url(${sceneImg(sc.k)})`;
  ls.dataset.phase = sc.phase;
  $("levelSceneName").textContent = `Chapter ${chapterOf(S.level)} · ${chapterName(chapterOf(S.level))}`
    + (sc.rain ? " · rain" : sc.phase === "gold" ? " · afternoon" : sc.phase === "dusk" ? " · dusk" : "");
  $("levelGoal").textContent = goalText(L);
  $("levelPieces").textContent = `${S.limit} pieces` + (S.help ? ` · ${S.help} extra to help you through` : "");
  $("levelStars").textContent = L.p2 ? `Stars: 1 for the goal, 2 with ${L.p2} ${L.p2 === 1 ? "piece" : "pieces"} left, 3 with ${L.p3} left.`
    : L.s2 ? `Stars: 1 for the goal, 2 at ${L.s2} points, 3 at ${L.s3}.` : "Stars: 1 for the goal, more for a high score.";
  // What is new on this level always shows; a calm tip only now and then, so the card stays short
  const note = S.tut === 1 ? "Start by filling the glowing square in the middle."
    : NEW_IN[S.level] || (S.level % 4 === 1 ? TIPS[(S.level - 1) % TIPS.length] : "");
  $("levelNote").textContent = note;
  $("levelNote").hidden = !note;
  const trail = $("levelTrail");
  trail.hidden = !L.trail;
  if (L.trail) trail.innerHTML = `<img src="img/lotus.webp" alt=""><span><b>Lotus trail</b> · `
    + (L.goal === "lotus" ? `the first ${TRAIL_PER_LEVEL} flowers count` : `collect the ${TRAIL_PER_LEVEL} lotus flowers before you finish`)
    + ` · ${trailText(trailRound(S.level))}</span>`;
  $("levelCard").querySelector(".stars-help").open = false;
  const cur = $("levelCurrent");
  cur.hidden = !!S.tut;
  if (!S.tut) {
    const s = journey.streak || 0;
    const waiting = S.jokers.length ? `You start with <b>${jokerList(S.jokers)}</b>${S.gift ? ", one a gift from your basket" : ""}.` : "";
    cur.innerHTML = currentRow(s, false) + `<p>${s
      ? `<b>Win streak ×${s}</b>${journey.shield ? " · shield ready" : ""} · ${waiting}`
      : `${waiting ? waiting + " " : ""}Win levels in a row for a <b>win streak</b>: jokers ready at the start.`}</p>`;
  }
  $("levelShop").hidden = !!S.tut || (S.jokers.length >= MAX_JOKERS && !!journey.shield);
  $("levelShop").innerHTML = `<i class="pearl"></i> ${S.jokers.length >= MAX_JOKERS ? "Get a streak shield" : "Bring a joker"}`;
  openCard("levelCard");
}
$("levelShop").addEventListener("click", () => openJokerShop(openLevelIntro));
// Five lotus buds, one per win in a row; the steps that give a joker are larger
function currentRow(s, fresh) {
  const shown = Math.min(s, CURRENT_MAX);
  let pips = "";
  for (let k = 1; k <= CURRENT_MAX; k++) {
    const step = CURRENT_STEPS.find(st => st.at === k);
    pips += `<i class="pip${k <= shown ? " on" : ""}${step ? " pip-joker" : ""}${fresh && k === shown ? " bloom" : ""}">${step ? `<img src="${ALL_KOI[JOKERS[step.joker].koi].img}" alt="">` : ""}</i>`;
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
  // On boards where the score is mostly luck (p2 and p3 instead of s2 and s3) the stars are for pieces left.
  const earned = L.p2 ? (left >= L.p3 ? 3 : left >= L.p2 ? 2 : 1)
    : L.s2 ? (S.score >= L.s3 ? 3 : S.score >= L.s2 ? 2 : 1) : ratio >= 0.45 ? 3 : ratio >= 0.25 ? 2 : 1;
  S.stars = S.extra ? 1 : Math.min(S.paidPieces ? 2 : 3, earned);
  // A level that is already won pays only for stars it did not have, and does not move the win streak or the chest:
  // otherwise level 1, played again and again, gave pearls, chests and three jokers for any Hard level.
  const hadStars = journey.stars[S.level] || 0;
  S.replay = hadStars > 0;
  S.pearls = (S.replay ? 5 * Math.max(0, S.stars - hadStars) : 10 + 5 * S.stars) * (L.hard ? 2 : 1);
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
  // A milestone koi for the fifth and tenth level of chapters 2-10
  const mileKoi = milestoneKoiIndex(S.level);
  if (mileKoi >= 0 && !journey.koi.includes(mileKoi)) {
    journey.koi.push(mileKoi);
    S.newKoi = mileKoi;
    initKoi();
  }
  // The lotus trail: up to three flowers count for a level, the best win is kept, and each round has three gifts
  S.trail = null;
  if (L.trail) {
    const round = trailRound(S.level), before = trailCount(round);
    journey.lotus = journey.lotus || {};
    journey.trail = journey.trail || [];
    const got = Math.min(TRAIL_PER_LEVEL, S.lotusGot || 0);
    if (got > (journey.lotus[S.level] || 0)) journey.lotus[S.level] = got;
    const now = trailCount(round);
    S.trail = { got, gain: now - before, round, pearls: 0 };
    TRAIL_GOALS.forEach((at, i) => {
      const key = `${round}:${i}`;
      if (now < at || journey.trail.includes(key)) return;
      journey.trail.push(key);
      journey.pearls += TRAIL_PEARLS[i];
      S.trail.pearls += TRAIL_PEARLS[i];
      const ki = i === TRAIL_GOALS.length - 1 ? trailKoiIndex(round) : -1;
      const newKoi = ki >= 0 && !journey.koi.includes(ki);
      if (newKoi) { journey.koi.push(ki); S.newKoi = ki; initKoi(); }
      setTimeout(() => notify(`Lotus trail · ${at} flowers`, `+${TRAIL_PEARLS[i]} pearls` + (newKoi ? ` and a new koi: ${ALL_KOI[ki].name}` : ""), true), 2200 + i * 300);
    });
  }
  journey.stars[S.level] = Math.max(journey.stars[S.level] || 0, S.stars);
  journey.unlocked = Math.max(journey.unlocked, S.level + 1);
  delete journey.fails[S.level];
  if (S.replay) S.chestOpened = null;
  else { journey.streak = (journey.streak || 0) + 1; fillChest(); }
  saveJourney();
  tasksAdd({ stars: S.stars });
  track("level_end", { level: S.level, result: "win", stars: S.stars, data: { left, help: S.help || 0, replay: S.replay, jokers: S.jokersUsed || 0, rescued: !!S.rescued, extra: !!S.extra } });
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
    + (S.replay && !S.pearls ? " · played again: pearls come with new stars" : ` · <b>+${S.pearls * (S.doubled ? 2 : 1)}</b> pearls`);
  $("winDouble").hidden = S.doubled || !S.pearls;
  $("winKoi").hidden = !(S.newKoi >= 0);
  if (S.newKoi >= 0) {
    $("winKoiName").textContent = `New koi: ${ALL_KOI[S.newKoi].name}`;
    $("winKoiImg").src = ALL_KOI[S.newKoi].img;
  }
  $("winNext").innerHTML = `Level ${S.level + 1}<small>${goalText(levelDef(S.level + 1))}</small>`;
  paintChest();
  const tr = $("winTrail");
  tr.hidden = !S.trail;
  if (S.trail) tr.innerHTML = `<img src="img/lotus.webp" alt=""><span><b>Lotus trail</b> · ${S.trail.got} of ${TRAIL_PER_LEVEL} flowers here`
    + (S.trail.gain ? ` · +${S.trail.gain}` : S.trail.got ? " · no more than your best" : "") + ` · ${trailText(S.trail.round)}</span>`;
  // Enough stars for something in the garden: say what, and open the garden with one tap
  const pick = gardenAffordable();
  $("winGarden").hidden = !pick;
  if (pick) $("winGarden").innerHTML = `<span class="gn-star">★ ${starsToSpend()}</span><span class="gn-text">Enough to restore the <b>${pick.name.toLowerCase()}</b> in your garden</span><span class="gn-go">Garden ›</span>`;
  const s = journey.streak || 0, step = CURRENT_STEPS.find(st => st.at === s);
  $("winCurrent").hidden = S.replay && !s;
  $("winCurrent").innerHTML = currentRow(s, S.bank === undefined && !S.replay) + `<p><b>Win streak ×${s}</b> · `
    + (S.replay ? "A level played again leaves your streak as it is." : (step ? `New: ${JOKERS[step.joker].name}! ` : "") + `Next level starts with ${jokerList(currentJokers(s))}.`) + "</p>";
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
$("winNext").addEventListener("click", () => withPromise(() => playLevel(S.level + 1, true, true)));
$("winMap").addEventListener("click", () => withPromise(openMap));
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
    // The streak drops one step here; keeping going with a video and winning brings it back
    // (not on a level played again: that neither builds the streak nor costs it)
    // A streak shield takes the loss instead, once
    S.shielded = 0;
    if (journey.streak && !S.replay && journey.shield) { journey.shield = false; S.shielded = journey.streak; }
    else if (journey.streak && !S.replay) { S.lostStreak = journey.streak; journey.streak = streakAfterLoss(journey.streak); }
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
  lost.hidden = !S.lostStreak && !S.shielded;
  if (S.shielded) lost.innerHTML = `Your <b>streak shield</b> kept your win streak ×${S.shielded}. The shield is used up.`;
  if (S.lostStreak) {
    const kept = streakAfterLoss(S.lostStreak);
    const now = kept ? `Your <b>win streak</b> slips from ×${S.lostStreak} to ×${kept}. You still start with ${jokerList(currentJokers(kept))}.`
      : `Your <b>win streak ×${S.lostStreak}</b> has ended. Win a level to start a new one.`;
    lost.innerHTML = rescue.hidden ? now : `Keep going to save your <b>win streak ×${S.lostStreak}</b>.`
      + (kept ? ` Otherwise it slips to ×${kept}.` : "");
  }
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
  // Nothing to swap when the pieces are used up and only jokers are left: do not take pearls or a video for it
  if (!S.tray.some(Boolean)) { toast("No pieces to swap"); return; }
  const swap = () => { clearHint(); S.tray = S.tray.map(p => p && fairPiece(10, 2)); enterAll(); closeOverlay(); render(); tick(); };
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
          // A lotus is worth most when it is the goal; on the lotus trail it is a bonus
          if (S.lotus && S.lotus[i]) score += S.mode === "journey" && levelDef(S.level).goal !== "lotus" ? 20 : 60;
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
  // No piece fits anywhere (a joker is keeping the round alive): say so instead of taking pearls for nothing
  if (!findHint()) { toast(S.jokers && S.jokers.length ? "No piece fits · use your joker koi" : "No piece fits"); return; }
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
  ["Journey", "Endless", "Daily"].forEach(m => $("mode" + m).setAttribute("aria-pressed", String(modeId(S) === m.toLowerCase())));
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
  // The chest grows with the chapters up to chapter 6 (100 pearls), so late chapters do not flood the shop
  const c = Math.min(6, chapterOf(S.level));
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
