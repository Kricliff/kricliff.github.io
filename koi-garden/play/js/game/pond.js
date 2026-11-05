// Koi Garden: The koi ponds, with every koi the player owns, in painted gardens you decorate with pearls.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Koi ponds ----------
   Four painted ponds seen from above, made the way the garden is (assets/pond/): the full picture with eight
   decorations and the same picture without them. The game shows the bare pond and, for every decoration you own,
   the full picture through that decoration's mask, so whatever you buy is part of the painting, in its light and
   style. A pond opens once the one before it is fully decorated; a locked one can be looked at, dimmed.
   Your koi swim live in the painted water. A mask of the open water steers them and hides any part of them that
   slips past the edge stones, and the decorations are drawn over them, so they glide under the bridge, the pads and
   the trees. They take on the water's colour and the light in the water plays over them.
   Tap the water to feed them, tap a koi to see its name. Pinch or double-tap to zoom in, drag to look around.
   Owned decorations live in journey.pond (owned, hidden, and "at", the pond you look at), so iCloud keeps them. */
const pondCv = $("pondCanvas"), pc = pondCv.getContext("2d");
let pondOpen = false, pondBack = null, pondFish = [], pondFood = null, pondLast = 0;
const POND_PIC = { w: 1080, h: 1920 };
const PONDS = [
  { n: 1, name: "Koi Pond", prefix: "", items: [
    ["lotus", "Lotus flowers", 120, 0.81, 0.24], ["toro", "Floating lanterns", 200, 0.62, 0.92], ["lantern", "Stone lantern", 220, 0.9, 0.07],
    ["fountain", "Bamboo spout", 260, 0.13, 0.87], ["bamboo", "Bamboo grove", 300, 0.14, 0.07], ["maple", "Red maple", 450, 0.15, 0.52],
    ["cherry", "Cherry tree", 500, 0.88, 0.58], ["bridge", "Red bridge", 650, 0.5, 0.42]] },
  { n: 2, name: "Moon Pond", prefix: "moon-", items: [
    ["lilies", "White water lilies", 150, 0.83, 0.25], ["lanterns", "Lotus lanterns", 220, 0.62, 0.91], ["pagoda", "Pagoda lantern", 240, 0.9, 0.07],
    ["pavilion", "Tea pavilion", 280, 0.12, 0.07], ["boat", "Rowing boat", 320, 0.15, 0.87], ["hydrangea", "Hydrangeas", 380, 0.88, 0.56],
    ["willow", "Weeping willow", 480, 0.12, 0.52], ["bridge", "Zig-zag bridge", 600, 0.5, 0.41]] },
  { n: 3, name: "Winter Pond", prefix: "winter-", items: [
    ["ice", "Ice floes", 160, 0.8, 0.25], ["fence", "Bamboo fence", 200, 0.12, 0.89], ["snowlantern", "Snow lantern", 280, 0.87, 0.06],
    ["ducks", "Mandarin ducks", 300, 0.6, 0.86], ["camellia", "Red camellia", 360, 0.12, 0.53], ["pine", "Snowy pine", 420, 0.2, 0.07],
    ["shrine", "Little shrine", 480, 0.88, 0.56], ["bridge", "Stone bridge", 550, 0.5, 0.43]] },
  { n: 4, name: "Golden Pond", prefix: "golden-", items: [
    ["leaves", "Floating leaves", 180, 0.8, 0.25], ["tea", "Tea table", 300, 0.12, 0.87], ["carp", "Carp fountain", 380, 0.1, 0.5],
    ["stones", "Stepping stones", 420, 0.5, 0.43], ["boat", "Parasol boat", 450, 0.65, 0.89], ["ginkgo", "Golden ginkgo", 500, 0.15, 0.06],
    ["bell", "Temple bell", 650, 0.88, 0.06], ["veranda", "Temple veranda", 700, 0.93, 0.56]] }
].map(p => ({ ...p, items: p.items.map(([key, name, price, u, v]) => ({ id: p.prefix + key, key, n: p.n, name, price, at: [u, v],
  img: `img/pond/pond-${p.n}-${key}.webp` })) }));
// Every decoration in every pond, for the shop and the rest of the game
const POND_DECOR = PONDS.flatMap(p => p.items);
const pondState = () => journey.pond || (journey.pond = { owned: [], hidden: [] });
const decorOwned = d => pondState().owned.includes(d.id);
const decorShown = d => decorOwned(d) && !pondState().hidden.includes(d.id);
const pondDone = p => p.items.every(decorOwned);
const pondUnlocked = p => p.n === 1 || pondDone(PONDS[p.n - 2]);
// The pond being looked at (it may be locked), and the newest open one
const pondShownNow = () => PONDS.find(q => q.n === (pondState().at || 1)) || PONDS[0];
const pondNewest = () => [...PONDS].reverse().find(pondUnlocked);
const pondFile = (p, name) => `img/pond/pond-${p.n}-${name}`;

const pondImages = {};
function pondImage(src) {
  if (!pondImages[src]) {
    const im = new Image();
    im.onload = () => { if (pondOpen) { pondCache = {}; buildPondLayers(); if (reduceMotion) drawPond(); } };
    im.src = src;
    pondImages[src] = im;
  }
  return pondImages[src];
}
const imgReady = im => im.complete && im.naturalWidth > 0;
function loadPondImages(p) {
  ["bare.webp", "done.webp", "water.png"].forEach(n => pondImage(pondFile(p, n)));
  p.items.forEach(d => pondImage(pondFile(p, `mask-${d.key}.png`)));
}
// The whole width of the picture always shows, so nothing on the banks is cut off. On a phone taller than the
// picture, it sits in the middle and a soft, darker copy of it fills above and below (under the title and the hint).
function pondFit() {
  const W = innerWidth, H = innerHeight, s = POND_PIC.h * (W / POND_PIC.w) <= H ? W / POND_PIC.w : Math.max(W / POND_PIC.w, H / POND_PIC.h);
  return { s, x: (W - POND_PIC.w * s) / 2, y: (H - POND_PIC.h * s) / 2, w: POND_PIC.w * s, h: POND_PIC.h * s };
}
const pondPoint = (u, v) => { const f = pondFit(); return { x: f.x + u * f.w, y: f.y + v * f.h }; };

/* ---------- Zoom ----------
   The pond is drawn in "world" coordinates, the screen at zoom 1. A view of zoom z and offset (ox, oy) maps them to the
   screen: screen = world * z + offset. Pinch or double-tap to zoom, drag to look around while zoomed. */
const pondView = { z: 1, ox: 0, oy: 0 };
const toWorld = (x, y) => ({ x: (x - pondView.ox) / pondView.z, y: (y - pondView.oy) / pondView.z });
const toScreen = (x, y) => ({ x: x * pondView.z + pondView.ox, y: y * pondView.z + pondView.oy });
function clampView() {
  const W = innerWidth, H = innerHeight, v = pondView;
  v.z = Math.max(1, Math.min(3, v.z));
  v.ox = Math.min(0, Math.max(W - W * v.z, v.ox));
  v.oy = Math.min(0, Math.max(H - H * v.z, v.oy));
}
function zoomAt(x, y, z) {
  const w = toWorld(x, y);
  pondView.z = z;
  pondView.ox = x - w.x * z;
  pondView.oy = y - w.y * z;
  clampView();
}
const resetView = () => { pondView.z = 1; pondView.ox = 0; pondView.oy = 0; };

/* ---------- The painted layers ----------
   Made at the picture's own size, once per pond, theme and set of decorations, then drawn through the view: the bare
   pond (its top and bottom feathered when the phone is taller than it), the decorations (the full picture through the
   masks of the ones shown), and the open water. The soft copy behind is made at screen size. */
let pondCache = {}, pondWet = null, pondFade = null, pondTint = null;
const picCanvas = () => { const cv = document.createElement("canvas"); cv.width = POND_PIC.w; cv.height = POND_PIC.h; return cv; };
function nightWash(c, w, h) {
  if (!isNight()) return;
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "rgb(78, 92, 160)";
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = "source-over";
}
function buildPondLayers() {
  const p = pondShownNow(), f = pondFit(), W = innerWidth, H = innerHeight;
  const bare = pondImage(pondFile(p, "bare.webp")), done = pondImage(pondFile(p, "done.webp")), wet = pondImage(pondFile(p, "water.png"));
  const key = `${p.n}|${isNight()}|${W}x${H}|${imgReady(bare)}|${imgReady(wet)}`;
  if (pondCache.key !== key) {
    pondCache = { key };
    // The water, as a grid to steer the koi by, and its colour, to tint them with
    pondWet = null;
    if (imgReady(wet)) {
      const g = document.createElement("canvas");
      g.width = wet.naturalWidth; g.height = wet.naturalHeight;
      const gx = g.getContext("2d");
      gx.drawImage(wet, 0, 0);
      const data = gx.getImageData(0, 0, g.width, g.height).data, cells = new Uint8Array(g.width * g.height);
      for (let i = 0; i < cells.length; i++) cells[i] = data[i * 4 + 3] > 128 ? 1 : 0;
      pondWet = { w: g.width, h: g.height, cells };
      pondCache.water = wet;
      if (imgReady(bare)) {
        const t = document.createElement("canvas"); t.width = g.width; t.height = g.height;
        const tx = t.getContext("2d"); tx.drawImage(bare, 0, 0, g.width, g.height);
        const px = tx.getImageData(0, 0, g.width, g.height).data;
        let r = 0, gg = 0, b = 0, k = 0;
        for (let i = 0; i < cells.length; i++) if (cells[i]) { r += px[i * 4]; gg += px[i * 4 + 1]; b += px[i * 4 + 2]; k++; }
        if (k) pondTint = `rgb(${Math.round(r / k)}, ${Math.round(gg / k)}, ${Math.round(b / k)})`;
      }
    }
    if (imgReady(bare)) {
      const base = picCanvas(), b = base.getContext("2d");
      b.drawImage(bare, 0, 0);
      nightWash(b, POND_PIC.w, POND_PIC.h);
      if (f.y > 0) {
        const e = Math.min(48, f.y * 0.9) / f.h, g = b.createLinearGradient(0, 0, 0, POND_PIC.h);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(e, "#000"); g.addColorStop(1 - e, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
        b.globalCompositeOperation = "destination-in";
        b.fillStyle = g;
        b.fillRect(0, 0, POND_PIC.w, POND_PIC.h);
        b.globalCompositeOperation = "source-over";
      }
      pondCache.base = base;
      const back = document.createElement("canvas"), dpr = Math.min(2, devicePixelRatio || 1);
      back.width = Math.round(W * dpr); back.height = Math.round(H * dpr);
      const bx = back.getContext("2d"), tiny = document.createElement("canvas");
      tiny.width = 36; tiny.height = 64;
      tiny.getContext("2d").drawImage(bare, 0, 0, 36, 64);
      const s2 = Math.max(W / POND_PIC.w, H / POND_PIC.h);
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bx.drawImage(tiny, (W - POND_PIC.w * s2) / 2, (H - POND_PIC.h * s2) / 2, POND_PIC.w * s2, POND_PIC.h * s2);
      bx.fillStyle = "rgba(6, 30, 32, 0.35)";
      bx.fillRect(0, 0, W, H);
      nightWash(bx, W, H);
      pondCache.back = back;
    }
  }
  // The decorations: rebuilt when they change, and every frame while one fades in
  const shown = pondUnlocked(p) ? p.items.filter(decorShown) : [];
  const masksReady = shown.every(d => imgReady(pondImage(pondFile(p, `mask-${d.key}.png`))));
  const overKey = shown.map(d => d.id).join(",") + (pondFade ? `|${pondFade.id}:${pondFade.k.toFixed(2)}` : "") + `|${masksReady}`;
  if (imgReady(done) && pondCache.overKey !== overKey) {
    pondCache.overKey = overKey;
    const over = pondCache.over || picCanvas(), o = over.getContext("2d");
    o.clearRect(0, 0, POND_PIC.w, POND_PIC.h);
    if (shown.length) {
      const m = pondCache.maskCv || (pondCache.maskCv = picCanvas()), mx = m.getContext("2d");
      mx.clearRect(0, 0, POND_PIC.w, POND_PIC.h);
      shown.forEach(d => {
        const im = pondImage(pondFile(p, `mask-${d.key}.png`));
        if (!imgReady(im)) return;
        mx.globalAlpha = pondFade && pondFade.id === d.id ? pondFade.k : 1;
        mx.drawImage(im, 0, 0, POND_PIC.w, POND_PIC.h);
      });
      mx.globalAlpha = 1;
      o.drawImage(done, 0, 0);
      nightWash(o, POND_PIC.w, POND_PIC.h);
      o.globalCompositeOperation = "destination-in";
      o.drawImage(m, 0, 0);
      o.globalCompositeOperation = "source-over";
    }
    pondCache.over = over;
  }
}
// Is a point in the world in the open water?
function inWater(x, y) {
  if (!pondWet) return true;
  const f = pondFit(), u = (x - f.x) / f.w, v = (y - f.y) / f.h;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
  return pondWet.cells[Math.floor(v * pondWet.h) * pondWet.w + Math.floor(u * pondWet.w)] === 1;
}
// Open water all round a point, so a koi there is well away from the edge
const roomy = (x, y, r) => inWater(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every(k => inWater(x + Math.cos(k * 0.785) * r, y + Math.sin(k * 0.785) * r));
// A random spot well inside the open water, for a koi to make its way to
function waterSpot() {
  for (const r of [48, 32, 18, 0]) for (let k = 0; k < 60; k++) {
    const x = Math.random() * innerWidth, y = Math.random() * innerHeight;
    if (roomy(x, y, r)) return { x, y };
  }
  return { x: innerWidth / 2, y: innerHeight / 2 };
}
let fishLayer = null;
function sizePond() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  pondCv.width = innerWidth * dpr;
  pondCv.height = innerHeight * dpr;
  pc.setTransform(dpr, 0, 0, dpr, 0, 0);
  fishLayer = document.createElement("canvas");
  fishLayer.width = pondCv.width; fishLayer.height = pondCv.height;
  clampView();
  buildPondLayers();
}

/* ---------- Choosing a pond: arrows and dots under the title ---------- */
function paintPondBar() {
  const p = pondShownNow(), open = pondUnlocked(p), got = p.items.filter(decorOwned).length;
  $("pondTitle").textContent = p.name;
  $("pondCount").textContent = open ? `${got} of ${p.items.length} decorations · ${journey.koi.length || 2} koi`
    : `Opens when ${PONDS[p.n - 2].name} is fully decorated`;
  $("pondPrev").disabled = p.n === 1;
  $("pondNext").disabled = p.n === PONDS.length;
  $("pondDots").innerHTML = PONDS.map(q => `<i class="${q.n === p.n ? "on" : ""}${pondUnlocked(q) ? "" : " shut"}${pondDone(q) ? " done" : ""}"></i>`).join("");
  $("pondLocked").hidden = open;
  if (!open) $("pondLocked").innerHTML = `<b>${p.name}</b><span>Decorate ${PONDS[p.n - 2].name} with all eight things to open this pond.</span>`;
  $("pondDecorate").hidden = !open;
  if (!open) { $("pondShop").hidden = true; $("pondHint").hidden = false; }
}
function stepPond(step) {
  const cur = pondShownNow().n, n = Math.max(1, Math.min(PONDS.length, cur + step));
  if (n === cur) return;
  pondState().at = n;
  saveJourney();
  resetView();
  pondFade = null;
  pondCache = {};
  loadPondImages(PONDS[n - 1]);
  buildPondLayers();
  placeFish();
  paintPondBar();
  if (!$("pondShop").hidden) paintPondShop();
  if (reduceMotion) drawPond();
  tick();
}
$("pondPrev").addEventListener("click", () => stepPond(-1));
$("pondNext").addEventListener("click", () => stepPond(1));

/* ---------- Decorating, here in the pond and from the shop ---------- */
function paintPondShop() {
  const p = pondShownNow();
  $("pondBank").querySelector("b").textContent = journey.pearls;
  $("pondShopTitle").textContent = `Decorate ${p.name}`;
  $("pondGrid").innerHTML = p.items.map(d => {
    const owned = decorOwned(d), shown = decorShown(d);
    const status = owned ? (shown ? "In your pond" : "Hidden · tap to show")
      : pondBuying === d.id ? "Tap again to buy" : `<i class="pearl"></i> ${d.price}`;
    return `<button class="pond-item${owned ? " owned" : ""}${shown ? " on" : ""}${pondBuying === d.id ? " confirm" : ""}${!owned && journey.pearls < d.price ? " short" : ""}" data-id="${d.id}">`
      + `<img src="${d.img}" alt=""><b>${d.name}</b><small>${status}</small></button>`;
  }).join("");
  const n = p.items.filter(decorOwned).length, next = PONDS[p.n];
  $("pondShopNote").textContent = n === p.items.length ? (next ? `${p.name} is complete. ${next.name} is open: tap › to visit it.` : "Every pond is complete. Your koi thank you.")
    : n ? `${n} of ${p.items.length}. Tap one you own to show or hide it.${next ? ` All eight open ${next.name}.` : ""}`
    : `Buy decorations with pearls. They stay in your pond for good.${next ? ` All eight open ${next.name}.` : ""}`;
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
  const w = pondPoint(d.at[0], d.at[1]), s = toScreen(w.x, w.y);
  sparkBurst(s.x, s.y, 26);
  bowl(6, 0.05);
  buzz([12, 30, 12]);
});
// A new or shown decoration fades into the painting over a second
function fadeIn(d) {
  if (!pondOpen || reduceMotion || pondShownNow().n !== d.n) { buildPondLayers(); if (pondOpen && reduceMotion) drawPond(); return; }
  pondFade = { id: d.id, k: 0 };
}
// Shared with the shop
function buyDecor(d) {
  const p = PONDS[d.n - 1];
  if (decorOwned(d) || journey.pearls < d.price || !pondUnlocked(p)) return false;
  journey.pearls -= d.price;
  pondState().owned.push(d.id);
  saveJourney();
  track("buy", { data: { kind: "pond", id: d.id, pearls: d.price } });
  fadeIn(d);
  // The last decoration of a pond opens the next one
  const next = PONDS[d.n];
  if (pondDone(p) && next) setTimeout(() => notify(`${p.name} is complete`, `${next.name} is open`, true), 900);
  if (pondOpen) paintPondBar();
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
function drawPond() {
  const W = innerWidth, H = innerHeight, t = waterClock(), f = pondFit(), v = pondView;
  const dpr = pondCv.width / W;
  pc.setTransform(dpr, 0, 0, dpr, 0, 0);
  pc.clearRect(0, 0, W, H);
  if (pondCache.back) pc.drawImage(pondCache.back, 0, 0, W, H);
  // The world: the view's zoom and offset; the picture sits in it where pondFit() puts it
  const world = c => c.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * v.ox, dpr * v.oy);
  world(pc);
  if (pondCache.base) pc.drawImage(pondCache.base, f.x, f.y, f.w, f.h);
  const locked = !pondUnlocked(pondShownNow());
  if (!locked && fishLayer) {
    // The koi, the food and the light in the water are drawn on their own layer and cut to the water, so a koi that
    // slips past the edge stones goes under them instead of over the bank
    const fl = fishLayer.getContext("2d");
    fl.setTransform(1, 0, 0, 1, 0, 0);
    fl.clearRect(0, 0, fishLayer.width, fishLayer.height);
    world(fl);
    if (pondFood) {
      fl.fillStyle = "#b07a3e";
      pondFood.bits.forEach(b => { fl.beginPath(); fl.arc(b.x, b.y, 2.6, 0, Math.PI * 2); fl.fill(); });
    }
    // Seen through the water: its colour mixed in, deeper at night
    drawFish(fl, pondFish, 0.95, isNight() ? 0.18 : 0.26, pondTint ? [pondTint, isNight() ? 0.42 : 0.2] : null);
    // The net of light on the water lies over them
    if (isNight()) drawMoonlight(fl, W, H, t, 1); else drawShimmer(fl, W, H, t, 0.7);
    if (pondCache.water) {
      fl.globalCompositeOperation = "destination-in";
      fl.drawImage(pondCache.water, f.x, f.y, f.w, f.h);
      fl.globalCompositeOperation = "source-over";
    }
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.drawImage(fishLayer, 0, 0);
    world(pc);
  }
  // The decorations lie over the koi: the bridge, the pads, the trees leaning out over the water
  if (!locked && pondCache.over) pc.drawImage(pondCache.over, f.x, f.y, f.w, f.h);
  pc.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (locked) { pc.fillStyle = "rgba(5, 20, 25, 0.45)"; pc.fillRect(0, 0, W, H); }
}
function placeFish() {
  const owned = journey.koi.length ? journey.koi : [0, 3];
  pondFish = owned.map(k => {
    const f = makeFish(k, innerWidth, innerHeight, 50, 74), s = waterSpot();
    f.x = s.x; f.y = s.y;
    return f;
  });
  pondFood = null;
}
function pondLoop(now) {
  if (!pondOpen) return;
  // Smaller koi swim a little slower, so they keep the calm pace of the big ones
  const dt = Math.min(0.05, (now - pondLast) / 1000 || 0.016) * 0.8;
  pondLast = now;
  if (pondFood) {
    // A koi eats a pellet when its mouth reaches it
    pondFood.bits = pondFood.bits.filter(b => !pondFish.some(f =>
      Math.hypot(f.x + Math.cos(f.a) * f.len * 0.45 - b.x, f.y + Math.sin(f.a) * f.len * 0.45 - b.y) < 10));
    pondFood.left -= dt;
    if (!pondFood.bits.length || pondFood.left <= 0) pondFood = null;
  }
  if (pondFade) {
    pondFade.k = Math.min(1, pondFade.k + dt / 0.9);
    if (pondFade.k >= 1) pondFade = null;
  }
  buildPondLayers();
  pondFish.forEach(f => {
    if (!f.goal || f.goalIn <= 0 || Math.hypot(f.goal.x - f.x, f.goal.y - f.y) < 30) { f.goal = waterSpot(); f.goalIn = 6 + Math.random() * 6; }
    f.goalIn -= dt;
    const px = f.x, py = f.y;
    stepFish(f, dt, innerWidth, innerHeight, pondFood);
    const head = a => inWater(f.x + Math.cos(a) * f.len * 0.55, f.y + Math.sin(a) * f.len * 0.55);
    // Keep to the painted water. A step that would put the head on the bank is not taken: the koi stays where it
    // was and turns, gently but surely, towards open water.
    if (!head(f.a)) {
      f.x = px; f.y = py;
      const to = pondFood && pondFood.bits.length && inWater(pondFood.bits[0].x, pondFood.bits[0].y) ? pondFood.bits[0] : f.goal;
      // Turn whichever way frees the head soonest, else towards where it is heading
      let side = Math.sign(wrapAngle(Math.atan2(to.y - f.y, to.x - f.x) - f.a)) || 1;
      for (const da of [0.4, 0.8, 1.2]) { if (head(f.a + da)) { side = 1; break; } if (head(f.a - da)) { side = -1; break; } }
      f.a += side * dt * 2.4;
      f.turn = side * 1.2; f.turnTarget = side * 1.2; f.turnVel = 0;
      f.v = Math.min(f.v, 10); f.vTarget = 14; f.timer = 0.9;
      if (Math.random() < dt) f.goal = waterSpot();
    } else {
      // Ahead, a little further: start easing round before reaching the edge
      const look = f.len * (0.9 + f.v / 50);
      const ahead = d => inWater(f.x + Math.cos(f.a + d) * look, f.y + Math.sin(f.a + d) * look);
      if (!ahead(0) && !(pondFood && pondFood.bits.length)) {
        const side = ahead(0.6) ? 1 : ahead(-0.6) ? -1 : Math.sign(wrapAngle(Math.atan2(f.goal.y - f.y, f.goal.x - f.x) - f.a)) || 1;
        f.turnTarget = side * 1.5;
        f.vTarget = Math.min(f.vTarget, 18);
        f.timer = 0.6;
      }
    }
    // A koi that is somehow out of the water (the screen turned, a pond changed) slips back into it
    if (!inWater(f.x, f.y)) { f.x += (f.goal.x - f.x) * Math.min(1, dt * 1.2); f.y += (f.goal.y - f.y) * Math.min(1, dt * 1.2); }
  });
  drawPond();
  requestAnimationFrame(pondLoop);
}
function openPond(back) {
  pondBack = back || null;
  pondOpen = true;
  $("pondView").hidden = false;
  // Open on the pond you looked at last, or the newest one if that is locked again (after Start over)
  if (!pondUnlocked(pondShownNow())) pondState().at = pondNewest().n;
  loadPondImages(pondShownNow());
  pondFade = null;
  pondCache = {};
  resetView();
  sizePond();
  placeFish();
  paintPondBar();
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

/* ---------- Touch: tap to feed or name a koi, pinch or double-tap to zoom, drag to look around ---------- */
const pondTouch = { pts: new Map(), start: null, pinch: null, lastTap: 0, moved: false };
pondCv.addEventListener("pointerdown", e => {
  audioInit();
  try { pondCv.setPointerCapture(e.pointerId); } catch (err) {}
  pondTouch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pondTouch.pts.size === 1) {
    pondTouch.start = { x: e.clientX, y: e.clientY, ox: pondView.ox, oy: pondView.oy };
    pondTouch.moved = false;
  } else if (pondTouch.pts.size === 2) {
    const [a, b] = [...pondTouch.pts.values()];
    pondTouch.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    pondTouch.moved = true;
  }
});
pondCv.addEventListener("pointermove", e => {
  if (!pondTouch.pts.has(e.pointerId)) return;
  pondTouch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pondTouch.pinch && pondTouch.pts.size >= 2) {
    const [a, b] = [...pondTouch.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    zoomAt(mid.x, mid.y, pondView.z * d / pondTouch.pinch.d);
    // Two fingers moving together also pan
    pondView.ox += mid.x - pondTouch.pinch.mid.x;
    pondView.oy += mid.y - pondTouch.pinch.mid.y;
    clampView();
    pondTouch.pinch = { d, mid };
  } else if (pondTouch.start) {
    const dx = e.clientX - pondTouch.start.x, dy = e.clientY - pondTouch.start.y;
    if (Math.hypot(dx, dy) > 8) pondTouch.moved = true;
    if (pondTouch.moved && pondView.z > 1) { pondView.ox = pondTouch.start.ox + dx; pondView.oy = pondTouch.start.oy + dy; clampView(); }
  }
  if (reduceMotion) drawPond();
});
function pondPointerEnd(e) {
  if (!pondTouch.pts.has(e.pointerId)) return;
  pondTouch.pts.delete(e.pointerId);
  if (pondTouch.pts.size < 2) pondTouch.pinch = null;
  // One finger still down after a pinch: carry on dragging from where it is
  if (pondTouch.pts.size) { const [p] = [...pondTouch.pts.values()]; pondTouch.start = { x: p.x, y: p.y, ox: pondView.ox, oy: pondView.oy }; return; }
  const st = pondTouch.start;
  pondTouch.start = null;
  if (!st || pondTouch.moved || e.type === "pointercancel") return;
  const now = performance.now();
  // A double tap zooms in on that spot, or back out
  if (now - pondTouch.lastTap < 300) {
    pondTouch.lastTap = 0;
    zoomAt(e.clientX, e.clientY, pondView.z > 1.2 ? 1 : 2.2);
    if (reduceMotion) drawPond();
    return;
  }
  pondTouch.lastTap = now;
  pondTap(e.clientX, e.clientY);
}
pondCv.addEventListener("pointerup", pondPointerEnd);
pondCv.addEventListener("pointercancel", pondPointerEnd);
function pondTap(sx, sy) {
  if (!pondUnlocked(pondShownNow())) return;
  const { x, y } = toWorld(sx, sy);
  // Tapping a koi shows its name; the topmost koi wins
  const hit = [...pondFish].reverse().find(f => {
    const dx = x - f.x, dy = y - f.y, c = Math.cos(-f.a), s = Math.sin(-f.a);
    return Math.abs(dx * c - dy * s) < f.len / 2 + 6 && Math.abs(dx * s + dy * c) < f.len * 0.2 + 6;
  });
  if (hit) {
    const label = document.createElement("div"), at = toScreen(hit.x, hit.y);
    label.className = "koi-label";
    label.textContent = ALL_KOI[hit.k].name + (ALL_KOI[hit.k].rare ? " · rare" : "");
    label.style.left = at.x + "px";
    label.style.top = at.y + "px";
    $("pondView").appendChild(label);
    setTimeout(() => label.remove(), 2300);
    tick();
    return;
  }
  // Tapping the water drops a few pellets, and the koi come to eat. On the bank nothing falls in.
  if (!inWater(x, y)) return;
  const ring = document.createElement("div");
  ring.className = "tap-ring";
  ring.style.left = sx + "px";
  ring.style.top = sy + "px";
  $("pondView").appendChild(ring);
  setTimeout(() => ring.remove(), 1200);
  pondFood = { left: 8, bits: [...Array(6)].map(() => ({ x: x + (Math.random() - 0.5) * 22, y: y + (Math.random() - 0.5) * 22 })).filter(b => inWater(b.x, b.y)) };
  if (!pondFood.bits.length) pondFood = null;
  voice(520, 0, 0.12, 0.03, 380);
}
window.addEventListener("resize", () => { if (pondOpen) { pondCache = {}; sizePond(); if (reduceMotion) drawPond(); } });

document.addEventListener("visibilitychange", () => {
  // Leaving the app: send the latest progress, best score included, to iCloud
  if (document.hidden) cloudPush();
  if (!document.hidden && koiPaused && !reduceMotion) { koiPaused = false; lastKoi = performance.now(); requestAnimationFrame(koiLoop); }
});
