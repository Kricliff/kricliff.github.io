// Koi Garden: The koi pond, with every koi the player owns, in a painted garden you decorate with pearls.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Koi pond ----------
   One painted pond seen from above, made the way the garden is (assets/pond/): the full picture with all eight
   decorations and the same picture without them. The game shows the bare pond and, for every decoration you own,
   the full picture through that decoration's mask, so whatever you buy is part of the painting, in its light and
   style. Your koi swim live in the painted water: a mask of the open water keeps them in it, and the decorations
   are drawn over them, so they glide under the bridge, the lotus pads and the overhanging trees.
   Tap the water to feed them, tap a koi to see its name. Owned decorations live in journey.pond, so iCloud keeps
   them; hidden ones stay owned. */
const pondCv = $("pondCanvas"), pc = pondCv.getContext("2d");
let pondOpen = false, pondBack = null, pondFish = [], pondFood = null, pondLast = 0;
const POND_PIC = { w: 1080, h: 1920, n: 1 };
const pondFile = name => `img/pond/pond-${POND_PIC.n}-${name}`;
// Each decoration, its price, and where it stands in the picture (shares of width and height, for the sparkle when it arrives)
const POND_DECOR = [
  { id: "lotus", name: "Lotus flowers", price: 120, at: [0.81, 0.24] },
  { id: "toro", name: "Floating lanterns", price: 200, at: [0.62, 0.92] },
  { id: "lantern", name: "Stone lantern", price: 220, at: [0.9, 0.07] },
  { id: "fountain", name: "Bamboo spout", price: 260, at: [0.13, 0.87] },
  { id: "bamboo", name: "Bamboo grove", price: 300, at: [0.14, 0.07] },
  { id: "maple", name: "Red maple", price: 450, at: [0.15, 0.52] },
  { id: "cherry", name: "Cherry tree", price: 500, at: [0.88, 0.58] },
  { id: "bridge", name: "Red bridge", price: 650, at: [0.5, 0.42] }
].map(d => ({ ...d, img: pondFile(`${d.id}.webp`) }));
const pondState = () => journey.pond || (journey.pond = { owned: [], hidden: [] });
const decorOwned = d => pondState().owned.includes(d.id);
const decorShown = d => decorOwned(d) && !pondState().hidden.includes(d.id);

const pondImages = {};
function pondImage(src) {
  if (!pondImages[src]) {
    const im = new Image();
    im.onload = () => { if (pondOpen) buildPondLayers(); };
    im.src = src;
    pondImages[src] = im;
  }
  return pondImages[src];
}
const imgReady = im => im.complete && im.naturalWidth > 0;
// The whole width of the picture always shows, so nothing on the banks is cut off. On a phone taller than the
// picture, it sits in the middle and a soft, darker copy of it fills above and below (under the title and the hint).
function pondFit() {
  const W = innerWidth, H = innerHeight, s = POND_PIC.h * (W / POND_PIC.w) <= H ? W / POND_PIC.w : Math.max(W / POND_PIC.w, H / POND_PIC.h);
  return { s, x: (W - POND_PIC.w * s) / 2, y: (H - POND_PIC.h * s) / 2, w: POND_PIC.w * s, h: POND_PIC.h * s };
}
const pondPoint = (u, v) => { const f = pondFit(); return { x: f.x + u * f.w, y: f.y + v * f.h }; };

/* The painted layers, made again when the screen, the theme or the decorations change: the bare pond, the
   decorations (the full picture through the masks of the ones shown), and the open water for clipping the light */
const pondLayers = { base: document.createElement("canvas"), over: document.createElement("canvas"), water: document.createElement("canvas"),
  light: document.createElement("canvas"), key: "" };
let pondWet = null, pondFade = null;
function layerSize(cv) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c;
}
// Night: the painting dims to a blue moonlit pond, like the rest of the game
function nightWash(c) {
  if (!isNight()) return;
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "rgb(78, 92, 160)";
  c.fillRect(0, 0, innerWidth, innerHeight);
  c.globalCompositeOperation = "source-over";
}
function buildPondLayers() {
  const f = pondFit(), bare = pondImage(pondFile("bare.webp")), done = pondImage(pondFile("done.webp"));
  const b = layerSize(pondLayers.base);
  if (imgReady(bare)) {
    const W = innerWidth, H = innerHeight;
    if (f.y > 0) {
      // Behind: the picture blown up to cover the screen, blurred by drawing it tiny and stretching it, and darkened
      const s2 = Math.max(W / POND_PIC.w, H / POND_PIC.h), tiny = document.createElement("canvas");
      tiny.width = 36; tiny.height = 64;
      tiny.getContext("2d").drawImage(bare, 0, 0, 36, 64);
      b.imageSmoothingQuality = "high";
      b.drawImage(tiny, (W - POND_PIC.w * s2) / 2, (H - POND_PIC.h * s2) / 2, POND_PIC.w * s2, POND_PIC.h * s2);
      b.fillStyle = "rgba(6, 30, 32, 0.35)";
      b.fillRect(0, 0, W, H);
      // In front: the picture itself, its top and bottom edges feathered into the soft copy
      const pic = document.createElement("canvas"), px = layerSize(pic), feather = Math.min(48, f.y * 0.9);
      px.drawImage(bare, f.x, f.y, f.w, f.h);
      const g = px.createLinearGradient(0, f.y, 0, f.y + f.h);
      const e = feather / f.h;
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(e, "#000"); g.addColorStop(1 - e, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
      px.globalCompositeOperation = "destination-in";
      px.fillStyle = g;
      px.fillRect(0, f.y, W, f.h);
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.drawImage(pic, 0, 0);
      const dpr = pondLayers.base.width / W;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else b.drawImage(bare, f.x, f.y, f.w, f.h);
    nightWash(b);
  }
  const o = layerSize(pondLayers.over);
  const shown = POND_DECOR.filter(decorShown);
  if (imgReady(done) && shown.length) {
    o.drawImage(done, f.x, f.y, f.w, f.h);
    nightWash(o);
    // The masks together say where the full picture shows
    const m = document.createElement("canvas"), mx = layerSize(m);
    shown.forEach(d => {
      const im = pondImage(pondFile(`mask-${d.id}.png`));
      if (!imgReady(im)) return;
      mx.globalAlpha = pondFade && pondFade.id === d.id ? pondFade.k : 1;
      mx.drawImage(im, f.x, f.y, f.w, f.h);
    });
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = "destination-in";
    o.drawImage(m, 0, 0);
    o.globalCompositeOperation = "source-over";
  }
  const w = layerSize(pondLayers.water), wet = pondImage(pondFile("water.png"));
  if (imgReady(wet)) {
    w.drawImage(wet, f.x, f.y, f.w, f.h);
    // The water mask as a grid the koi can be steered by
    if (!pondWet) {
      const g = document.createElement("canvas");
      g.width = wet.naturalWidth; g.height = wet.naturalHeight;
      const gx = g.getContext("2d");
      gx.drawImage(wet, 0, 0);
      const data = gx.getImageData(0, 0, g.width, g.height).data, cells = new Uint8Array(g.width * g.height);
      for (let i = 0; i < cells.length; i++) cells[i] = data[i * 4 + 3] > 128 ? 1 : 0;
      pondWet = { w: g.width, h: g.height, cells };
    }
  }
  layerSize(pondLayers.light);
}
// Is a point on the screen in the open water?
function inWater(x, y) {
  if (!pondWet) return true;
  const f = pondFit(), u = (x - f.x) / f.w, v = (y - f.y) / f.h;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
  return pondWet.cells[Math.floor(v * pondWet.h) * pondWet.w + Math.floor(u * pondWet.w)] === 1;
}
// A random spot in the open water, for a koi to make its way to
function waterSpot() {
  for (let k = 0; k < 60; k++) {
    const x = Math.random() * innerWidth, y = Math.random() * innerHeight;
    if (inWater(x, y)) return { x, y };
  }
  return { x: innerWidth / 2, y: innerHeight / 2 };
}
function sizePond() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  pondCv.width = innerWidth * dpr;
  pondCv.height = innerHeight * dpr;
  pc.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildPondLayers();
}

/* ---------- Decorating, here in the pond and from the shop ---------- */
function paintPondShop() {
  $("pondBank").querySelector("b").textContent = journey.pearls;
  $("pondGrid").innerHTML = POND_DECOR.map(d => {
    const owned = decorOwned(d), shown = decorShown(d);
    const status = owned ? (shown ? "In your pond" : "Hidden · tap to show")
      : pondBuying === d.id ? "Tap again to buy" : `<i class="pearl"></i> ${d.price}`;
    return `<button class="pond-item${owned ? " owned" : ""}${shown ? " on" : ""}${pondBuying === d.id ? " confirm" : ""}${!owned && journey.pearls < d.price ? " short" : ""}" data-id="${d.id}">`
      + `<img src="${d.img}" alt=""><b>${d.name}</b><small>${status}</small></button>`;
  }).join("");
  const n = POND_DECOR.filter(decorOwned).length;
  $("pondShopNote").textContent = n ? `${n} of ${POND_DECOR.length} decorations. Tap one you own to show or hide it.` : "Buy decorations with pearls. They stay in your pond for good.";
}
let pondBuying = null, pondBuyTimer = 0;
$("pondDecorate").addEventListener("click", () => { pondBuying = null; paintPondShop(); $("pondShop").hidden = false; $("pondHint").hidden = true; });
$("pondShopClose").addEventListener("click", () => { $("pondShop").hidden = true; $("pondHint").hidden = false; });
$("pondGrid").addEventListener("click", e => {
  const b = e.target.closest(".pond-item");
  if (!b) return;
  const d = POND_DECOR.find(x => x.id === b.dataset.id);
  clearTimeout(pondBuyTimer);
  if (decorOwned(d)) {
    toggleDecor(d);
    pondBuying = null;
    paintPondShop();
    return;
  }
  if (journey.pearls < d.price) {
    pondBuying = null;
    paintPondShop();
    const tile = $("pondGrid").querySelector(`[data-id="${d.id}"]`);
    tile.querySelector("small").textContent = `${d.price - journey.pearls} more pearls needed`;
    restartClass(tile, "nope");
    knock();
    return;
  }
  if (pondBuying !== d.id) {
    pondBuying = d.id;
    paintPondShop();
    pondBuyTimer = setTimeout(() => { pondBuying = null; paintPondShop(); }, 3500);
    return;
  }
  // Bought: it grows into the painting with a ring of gold where it stands
  pondBuying = null;
  buyDecor(d);
  paintPondShop();
  const p = pondPoint(d.at[0], d.at[1]);
  sparkBurst(p.x, p.y, 26);
  bowl(6, 0.05);
  buzz([12, 30, 12]);
});
// A new or shown decoration fades into the painting over a second
function fadeIn(d) {
  if (!pondOpen || reduceMotion) { buildPondLayers(); if (pondOpen) drawPond(); return; }
  pondFade = { id: d.id, k: 0 };
}
// Shared with the shop
function buyDecor(d) {
  if (decorOwned(d) || journey.pearls < d.price) return false;
  journey.pearls -= d.price;
  pondState().owned.push(d.id);
  saveJourney();
  track("buy", { data: { kind: "pond", id: d.id, pearls: d.price } });
  fadeIn(d);
  return true;
}
function toggleDecor(d) {
  const st = pondState(), was = decorShown(d);
  st.hidden = was ? st.hidden.concat(d.id) : st.hidden.filter(x => x !== d.id);
  saveJourney();
  tick();
  if (was) { buildPondLayers(); if (pondOpen && reduceMotion) drawPond(); } else fadeIn(d);
}

/* ---------- Drawing and swimming ---------- */
// Light moving on the water, and the moon's path at night, only on the water itself
function drawWaterLight(t, moon) {
  const L = pondLayers.light, c = L.getContext("2d"), W = innerWidth, H = innerHeight;
  const dpr = L.width / W;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  if (moon) drawMoonlight(c, W, H, t, 1); else drawShimmer(c, W, H, t, 0.55);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(pondLayers.water, 0, 0);
  c.globalCompositeOperation = "source-over";
  pc.save();
  pc.globalCompositeOperation = "lighter";
  pc.drawImage(L, 0, 0, W, H);
  pc.restore();
}
function drawPond() {
  const W = innerWidth, H = innerHeight, t = waterClock();
  pc.clearRect(0, 0, W, H);
  pc.drawImage(pondLayers.base, 0, 0, W, H);
  drawWaterLight(t, false);
  if (pondFood) {
    pc.fillStyle = "#b07a3e";
    pondFood.bits.forEach(b => { pc.beginPath(); pc.arc(b.x, b.y, 3.2, 0, Math.PI * 2); pc.fill(); });
  }
  // At night the koi are a little sunk in the dark water: the water's colour is mixed into them, not see-through
  drawFish(pc, pondFish, 0.97, isNight() ? 0.2 : 0.3, isNight() ? ["#16205a", 0.2] : null);
  if (isNight()) drawWaterLight(t, true);
  // The decorations lie over the koi: the bridge, the lotus pads, the trees leaning out over the water
  pc.drawImage(pondLayers.over, 0, 0, W, H);
}
function pondLoop(now) {
  if (!pondOpen) return;
  const dt = Math.min(0.05, (now - pondLast) / 1000 || 0.016);
  pondLast = now;
  if (pondFood) {
    // A koi eats a pellet when its mouth reaches it
    pondFood.bits = pondFood.bits.filter(b => !pondFish.some(f =>
      Math.hypot(f.x + Math.cos(f.a) * f.len * 0.45 - b.x, f.y + Math.sin(f.a) * f.len * 0.45 - b.y) < 16));
    pondFood.left -= dt;
    if (!pondFood.bits.length || pondFood.left <= 0) pondFood = null;
  }
  // The theme can change while the pond is open
  const key = `${isNight()}`;
  if (pondLayers.key !== key) { pondLayers.key = key; buildPondLayers(); }
  if (pondFade) {
    pondFade.k = Math.min(1, pondFade.k + dt / 1.1);
    buildPondLayers();
    if (pondFade.k >= 1) pondFade = null;
  }
  pondFish.forEach(f => {
    stepFish(f, dt, innerWidth, innerHeight, pondFood);
    // Keep to the painted water: when the way ahead is bank, turn towards a spot in the open water
    if (!f.goal || f.goalIn <= 0 || Math.hypot(f.goal.x - f.x, f.goal.y - f.y) < 40) { f.goal = waterSpot(); f.goalIn = 6 + Math.random() * 6; }
    f.goalIn -= dt;
    const ahead = f.len * 0.75;
    if (!inWater(f.x + Math.cos(f.a) * ahead, f.y + Math.sin(f.a) * ahead)) {
      const want = Math.atan2(f.goal.y - f.y, f.goal.x - f.x);
      f.turnTarget = Math.max(-1.9, Math.min(1.9, wrapAngle(want - f.a) * 2.4));
      f.vTarget = Math.min(f.vTarget, 22);
      f.timer = 0.6;
    }
    // A koi that is somehow on the bank (the screen turned) slips back into the water
    if (!inWater(f.x, f.y)) { f.x += (f.goal.x - f.x) * Math.min(1, dt * 0.9); f.y += (f.goal.y - f.y) * Math.min(1, dt * 0.9); }
  });
  drawPond();
  requestAnimationFrame(pondLoop);
}
function openPond(back) {
  pondBack = back || null;
  pondOpen = true;
  $("pondView").hidden = false;
  ["bare.webp", "done.webp", "water.png"].forEach(n => pondImage(pondFile(n)));
  POND_DECOR.forEach(d => pondImage(pondFile(`mask-${d.id}.png`)));
  pondFade = null;
  sizePond();
  pondLayers.key = `${isNight()}`;
  const owned = journey.koi.length ? journey.koi : [0, 3];
  pondFish = owned.map(k => { const f = makeFish(k, innerWidth, innerHeight, 84, 124); const s = waterSpot(); f.x = s.x; f.y = s.y; return f; });
  $("pondCount").textContent = journey.koi.length
    ? `${journey.koi.length} of ${ALL_KOI.length} koi`
    : "Two visitors, until your first koi arrives";
  pondFood = null;
  $("pondShop").hidden = true;
  $("pondHint").hidden = false;
  // The hint says how the pond works, then fades so nothing covers the painting
  const hint = $("pondHint");
  hint.classList.remove("gone");
  clearTimeout(hint.fadeTimer);
  hint.fadeTimer = setTimeout(() => hint.classList.add("gone"), 6000);
  if (reduceMotion) { drawPond(); return; }
  pondLast = performance.now();
  requestAnimationFrame(pondLoop);
}
function closePond() {
  pondOpen = false;
  $("pondView").hidden = true;
  $("pondView").querySelectorAll(".koi-label, .tap-ring").forEach(el => el.remove());
  const b = pondBack;
  pondBack = null;
  if (b) b();
}
$("pondDone").addEventListener("click", closePond);
pondCv.addEventListener("pointerdown", e => {
  const x = e.clientX, y = e.clientY;
  audioInit();
  // Tapping a koi shows its name; the topmost koi wins
  const hit = [...pondFish].reverse().find(f => {
    const dx = x - f.x, dy = y - f.y, c = Math.cos(-f.a), s = Math.sin(-f.a);
    return Math.abs(dx * c - dy * s) < f.len / 2 && Math.abs(dx * s + dy * c) < f.len * 0.2;
  });
  if (hit) {
    const label = document.createElement("div");
    label.className = "koi-label";
    label.textContent = ALL_KOI[hit.k].name + (ALL_KOI[hit.k].rare ? " · rare" : "");
    label.style.left = hit.x + "px";
    label.style.top = hit.y + "px";
    $("pondView").appendChild(label);
    setTimeout(() => label.remove(), 2300);
    tick();
    return;
  }
  // Tapping the water drops a few pellets, and the koi come to eat. On the bank nothing falls in.
  if (!inWater(x, y)) return;
  const ring = document.createElement("div");
  ring.className = "tap-ring";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  $("pondView").appendChild(ring);
  setTimeout(() => ring.remove(), 1200);
  pondFood = { left: 8, bits: [...Array(6)].map(() => ({ x: x + (Math.random() - 0.5) * 34, y: y + (Math.random() - 0.5) * 34 })).filter(b => inWater(b.x, b.y)) };
  if (!pondFood.bits.length) pondFood = null;
  voice(520, 0, 0.12, 0.03, 380);
});
window.addEventListener("resize", () => { if (pondOpen) { sizePond(); if (reduceMotion) drawPond(); } });

document.addEventListener("visibilitychange", () => {
  // Leaving the app: send the latest progress, best score included, to iCloud
  if (document.hidden) cloudPush();
  if (!document.hidden && koiPaused && !reduceMotion) { koiPaused = false; lastKoi = performance.now(); requestAnimationFrame(koiLoop); }
});
