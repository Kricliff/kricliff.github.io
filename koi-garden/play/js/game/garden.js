// Koi Garden: The garden you restore with stars, one area for each chapter.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Garden ----------
   Each chapter has a garden area that starts overgrown. Stars from the Journey restore it one thing at a time:
   a lantern, a bridge, a tea house. Every area is two pictures of the same place, wild and restored
   (img/garden/<id>-wild.webp and -done.webp); a restored thing fades in from the restored picture where it stands.
   The five things always stand in the same five spots of the picture. Stars spent here still count for unlocking
   styles: those look at the stars earned, the garden at the stars left to spend. */
const GARDEN = [
  { id: "koi-pond", name: "Koi Pond", items: ["Stone lantern", "Pine and bench", "Red bridge", "Stepping stones", "Water lilies"] },
  { id: "bamboo-grove", name: "Bamboo Grove", items: ["Bamboo fence", "Bamboo fountain", "Bamboo thicket", "Stone path", "Wooden gate"] },
  { id: "lotus-lake", name: "Lotus Lake", items: ["Heron statue", "Reed bed", "Wooden pier", "Rowing boat", "Lotus field"] },
  { id: "moon-bridge", name: "Moon Bridge", items: ["Weeping willow", "String of lanterns", "Moon bridge", "Rock island", "Stone bench"] },
  { id: "cherry-hill", name: "Cherry Hill", items: ["Torii gate", "Paper lanterns", "Cherry tree", "Stone steps", "Picnic blanket"] },
  { id: "mountain-spring", name: "Mountain Spring", items: ["Waterfall", "Young maple", "Hot spring", "Mossy boulders", "Wooden bucket"] },
  { id: "tea-house", name: "Tea House", items: ["Tea house", "Stone basin", "Raked gravel", "Tea set", "Clipped azaleas"] },
  { id: "maple-valley", name: "Maple Valley", items: ["Red maple", "Stone pagoda", "Wooden swing", "Deer statue", "Fallen leaves"] },
  { id: "snow-temple", name: "Snow Temple", items: ["Temple bell", "Snowy pine", "Small shrine", "Snow lantern", "Frozen pond"] },
  { id: "golden-pagoda", name: "Golden Pagoda", items: ["Golden pagoda", "Golden lanterns", "Koi fountain", "Drum bridge", "Peony beds"] }
];
// Stars each thing costs: 30 for a whole area, about what a chapter gives at two stars a level
const gardenCost = (a, k) => 2 + 2 * k;
const gardenAreaPearls = a => 60 + 15 * a;
const starsEarned = () => Object.values(journey.stars).reduce((s, v) => s + (+v || 0), 0);
const starsToSpend = () => starsEarned() - ((journey.garden && journey.garden.spent) || 0);
const gardenOwned = (a, k) => !!(journey.garden && journey.garden.bought && journey.garden.bought.includes(`${GARDEN[a].id}:${k}`));
const gardenOpenArea = a => journey.unlocked > a * PER_CHAPTER || a === 0;
const gardenAreaDone = a => GARDEN[a].items.every((_, k) => gardenOwned(a, k));
const gardenBoughtCount = () => (journey.garden && journey.garden.bought ? journey.garden.bought.length : 0);
// The cheapest thing the player could restore right now, or null
function gardenAffordable() {
  const left = starsToSpend();
  let best = null;
  GARDEN.forEach((area, a) => {
    if (!gardenOpenArea(a)) return;
    area.items.forEach((name, k) => {
      const cost = gardenCost(a, k);
      if (!gardenOwned(a, k) && cost <= left && (!best || cost < best.cost)) best = { a, k, name, cost };
    });
  });
  return best;
}

let gardenArea = 0, gardenBack = null;
function openGarden(back, area) {
  gardenBack = back || null;
  // Open on the newest area with something left to do
  if (area === undefined) {
    area = 0;
    GARDEN.forEach((_, a) => { if (gardenOpenArea(a) && !gardenAreaDone(a)) area = Math.max(area, a); });
    const pick = gardenAffordable();
    if (pick) area = pick.a;
  }
  gardenArea = area;
  $("gardenView").hidden = false;
  paintGarden();
}
function closeGarden() {
  $("gardenView").hidden = true;
  stopGardenLife();
  if (!homeEl.hidden) paintHome();
  if (gardenBack) { const b = gardenBack; gardenBack = null; b(); }
}
function gardenLayer(a, k, fresh) {
  const el = document.createElement("div");
  el.className = "garden-layer" + (fresh ? " fresh" : "");
  el.style.backgroundImage = `url(img/garden/${GARDEN[a].id}-done.webp)`;
  const mask = `url(img/garden/${GARDEN[a].id}-mask-${k}.png)`;
  el.style.webkitMaskImage = el.style.maskImage = mask;
  return el;
}
function paintGarden(fresh) {
  const a = gardenArea, area = GARDEN[a], open = gardenOpenArea(a);
  $("gardenTitle").textContent = `${area.name} garden`;
  $("gardenStars").textContent = starsToSpend();
  const scene = $("gardenScene");
  scene.innerHTML = "";
  scene.style.backgroundImage = `url(img/garden/${area.id}-wild.webp)`;
  scene.classList.toggle("locked", !open);
  area.items.forEach((_, k) => { if (gardenOwned(a, k)) scene.appendChild(gardenLayer(a, k, fresh === k)); });
  if (gardenAreaDone(a)) scene.appendChild(Object.assign(document.createElement("div"), { className: "garden-full", style: `background-image:url(img/garden/${area.id}-done.webp)` }));
  startGardenLife(a);
  // The area picker: one dot per chapter
  $("gardenDots").innerHTML = GARDEN.map((g, i) => `<button class="gdot${i === a ? " on" : ""}${gardenAreaDone(i) ? " done" : ""}${gardenOpenArea(i) ? "" : " shut"}" data-a="${i}" aria-label="${g.name}"></button>`).join("");
  $("gardenPrev").disabled = a === 0;
  $("gardenNext").disabled = a === GARDEN.length - 1;
  const list = $("gardenItems");
  if (!open) {
    list.innerHTML = `<p class="garden-note">This garden opens when you reach chapter ${a + 1}, ${KL.chapterName(a + 1)}, in the Journey.</p>`;
    return;
  }
  const left = starsToSpend();
  list.innerHTML = area.items.map((name, k) => {
    const cost = gardenCost(a, k), got = gardenOwned(a, k);
    const btn = got ? `<span class="g-done">Restored</span>`
      : cost <= left ? `<button class="btn primary g-buy" data-k="${k}">Restore <span class="g-cost">★ ${cost}</span></button>`
      : `<span class="g-need">★ ${cost}<small>${cost - left} more</small></span>`;
    return `<li class="${got ? "got" : ""}"><span class="g-name">${name}</span>${btn}</li>`;
  }).join("") + (gardenAreaDone(a) ? `<p class="garden-note done">The ${area.name} garden is restored. Thank you, gardener.</p>`
    : `<p class="garden-note">Restore all five for <b>+${gardenAreaPearls(a)}</b> pearls.</p>`);
}
function buyGarden(k) {
  const a = gardenArea, cost = gardenCost(a, k);
  if (gardenOwned(a, k) || cost > starsToSpend() || !gardenOpenArea(a)) return;
  journey.garden = journey.garden || { spent: 0, bought: [] };
  journey.garden.spent += cost;
  journey.garden.bought.push(`${GARDEN[a].id}:${k}`);
  const finished = gardenAreaDone(a);
  if (finished) journey.pearls += gardenAreaPearls(a);
  saveJourney();
  paintGarden(k);
  chime(true);
  buzz([10, 40, 18]);
  track("garden", { data: { area: GARDEN[a].id, item: k } });
  if (finished) setTimeout(() => {
    bowl(6, 0.05);
    notify(`${GARDEN[a].name} garden restored`, `+${gardenAreaPearls(a)} pearls`, true);
    $("gardenScene").classList.add("complete");
  }, 900);
}
$("gardenItems").addEventListener("click", e => { const b = e.target.closest(".g-buy"); if (b) buyGarden(+b.dataset.k); });
$("gardenDots").addEventListener("click", e => { const b = e.target.closest(".gdot"); if (b) { gardenArea = +b.dataset.a; paintGarden(); } });
$("gardenPrev").addEventListener("click", () => { if (gardenArea > 0) { gardenArea--; paintGarden(); } });
$("gardenNext").addEventListener("click", () => { if (gardenArea < GARDEN.length - 1) { gardenArea++; paintGarden(); } });
$("gardenDone").addEventListener("click", closeGarden);

/* ---------- The garden comes alive ----------
   Small things move in the picture: the main tree sways once it is restored, and something drifts through the air in
   every area (petals, leaves, snow, fireflies, pollen). The koi painted in the pictures stay still: moving koi drawn on
   top swam across banks and piers, since the picture has no idea where the water ends.
   Places are fractions of the picture (x across, y down). A sway is a soft-edged copy of the restored picture round
   the tree, turned a little about the trunk. Nothing moves with Reduce Motion or Calm, or while the garden is shut. */
const GARDEN_LIFE = {
  "koi-pond": { sway: [{ k: 1, x: 0.82, y: 0.1, r: 0.15, px: 0.86, py: 0.22 }], air: "pollen" },
  "bamboo-grove": { sway: [{ k: 2, x: 0.44, y: 0.2, r: 0.2, px: 0.45, py: 0.42 }], air: "bamboo" },
  "lotus-lake": { sway: [{ k: 1, x: 0.84, y: 0.1, r: 0.13, px: 0.84, py: 0.2 }], air: "pollen" },
  "moon-bridge": { sway: [{ k: 0, x: 0.2, y: 0.13, r: 0.2, px: 0.2, py: 0.05 }], air: "fireflies", night: true },
  "cherry-hill": { sway: [{ k: 2, x: 0.5, y: 0.3, r: 0.2, px: 0.5, py: 0.45 }], air: "petals" },
  "mountain-spring": { sway: [{ k: 1, x: 0.8, y: 0.15, r: 0.16, px: 0.8, py: 0.3 }], air: "maple" },
  "tea-house": { air: "petals" },
  "maple-valley": { sway: [{ k: 0, x: 0.2, y: 0.12, r: 0.21, px: 0.22, py: 0.28 }], air: "maple" },
  "snow-temple": { sway: [{ k: 1, x: 0.8, y: 0.15, r: 0.15, px: 0.82, py: 0.3 }], air: "snow" },
  "golden-pagoda": { air: "sparkle" }
};
const AIR = {
  petals: { n: 14, img: "img/blossom.webp", size: [7, 11], fall: [10, 20], spin: true },
  maple: { n: 10, img: "img/leaf.webp", size: [9, 14], fall: [12, 22], spin: true },
  bamboo: { n: 9, colour: "#7fae4a", size: [8, 12], fall: [10, 18], spin: true, sliver: true },
  snow: { n: 26, colour: "#ffffff", size: [1.5, 3.5], fall: [8, 18] },
  fireflies: { n: 12, colour: "#ffe58a", size: [1.6, 2.6], glow: true, float: true },
  pollen: { n: 12, colour: "#fff6cf", size: [1, 2], float: true, faint: true },
  sparkle: { n: 12, colour: "#ffd86b", size: [1.2, 2.4], glow: true, float: true }
};
const airImages = {};
let gardenFx = null;
function stopGardenLife() {
  if (gardenFx) cancelAnimationFrame(gardenFx.raf);
  gardenFx = null;
}
function startGardenLife(a) {
  stopGardenLife();
  const scene = $("gardenScene"), life = GARDEN_LIFE[GARDEN[a].id];
  if (!life || reduceMotion || prefs.calm || !gardenOpenArea(a)) return;
  const done = k => gardenOwned(a, k);
  // The trees: CSS turns them, so they cost nothing per frame
  (life.sway || []).filter(s => done(s.k)).forEach((s, i) => {
    const el = document.createElement("div");
    el.className = "garden-sway";
    el.style.backgroundImage = `url(img/garden/${GARDEN[a].id}-done.webp)`;
    el.style.setProperty("--m", `radial-gradient(circle at ${s.x * 100}% ${s.y * 100}%, #000 ${s.r * 55}%, transparent ${s.r * 100}%)`);
    el.style.transformOrigin = `${s.px * 100}% ${s.py * 100}%`;
    el.style.animationDelay = `${-i * 1.7}s`;
    scene.appendChild(el);
  });
  if (!life.night) scene.appendChild(Object.assign(document.createElement("div"), { className: "garden-light" }));
  const cv = document.createElement("canvas");
  cv.className = "garden-fx";
  scene.appendChild(cv);
  const c = cv.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0;
  const size = () => { W = scene.clientWidth; H = scene.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size();
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
  const kind = AIR[life.air];
  if (kind && kind.img && !airImages[kind.img]) { airImages[kind.img] = new Image(); airImages[kind.img].src = kind.img; }
  const spawn = top => ({ x: rnd(0, 1), y: top ? rnd(-0.1, 0) : rnd(0, 1), s: rnd(kind.size[0], kind.size[1]), v: kind.fall ? rnd(kind.fall[0], kind.fall[1]) : 0,
    rot: rnd(0, 6.3), spin: rnd(-1.5, 1.5), ph: rnd(0, 6.3) });
  const air = kind ? [...Array(kind.n)].map(() => spawn(false)) : [];
  let last = performance.now();
  const fx = gardenFx = { raf: 0 };
  const frame = now => {
    if (gardenFx !== fx) return;
    fx.raf = requestAnimationFrame(frame);
    if ($("gardenView").hidden) { stopGardenLife(); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (scene.clientWidth !== W || scene.clientHeight !== H) size();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.globalAlpha = 1;
    air.forEach((p, i) => {
      if (kind.float) {
        p.ph += dt * 0.6;
        p.x += Math.cos(p.ph + i) * dt * 0.012;
        p.y += Math.sin(p.ph * 0.8 + i) * dt * 0.01;
        if (p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) Object.assign(p, spawn(false));
      } else {
        p.y += p.v * dt / H * 3;
        p.x += Math.sin(now / 1100 + p.ph) * dt * 0.02 + dt * 0.006;
        p.rot += p.spin * dt;
        if (p.y > 1.05 || p.x > 1.05) Object.assign(p, spawn(true));
      }
      const x = p.x * W, y = p.y * H;
      if (kind.img) {
        const im = airImages[kind.img];
        if (!im.complete) return;
        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        c.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.rot * 1.3)));
        c.globalAlpha = 0.9;
        c.drawImage(im, -p.s / 2, -p.s / 2, p.s, p.s);
        c.restore();
      } else if (kind.sliver) {
        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        c.fillStyle = kind.colour;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.ellipse(0, 0, p.s / 2, p.s / 7, 0, 0, 6.283);
        c.fill();
        c.restore();
      } else {
        const tw = kind.glow ? 0.45 + 0.55 * Math.max(0, Math.sin(now / 700 + p.ph * 3)) : 1;
        c.globalAlpha = (kind.faint ? 0.55 : 0.9) * tw;
        if (kind.glow) { c.shadowColor = kind.colour; c.shadowBlur = 8; }
        c.fillStyle = kind.colour;
        c.beginPath();
        c.arc(x, y, p.s, 0, 6.283);
        c.fill();
        c.shadowBlur = 0;
      }
    });
    c.globalAlpha = 1;
  };
  fx.raf = requestAnimationFrame(frame);
}
