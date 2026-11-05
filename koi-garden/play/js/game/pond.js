// Koi Garden: The koi pond, with every koi the player owns.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Koi pond: every koi you own, big, with lily pads and feeding ---------- */
const pondCv = $("pondCanvas"), pc = pondCv.getContext("2d");
let pondOpen = false, pondBack = null, pondFish = [], pondFood = null, pondLast = 0, pads = [];
function sizePond() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  pondCv.width = innerWidth * dpr;
  pondCv.height = innerHeight * dpr;
  pc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function makePads() {
  pads = [];
  const W = innerWidth, H = innerHeight;
  // Lily pads float near the edges so the middle stays open for the koi
  const decorated = POND_DECOR.some(d => decorShown(d));
  // A decorated pond has its own lilies to buy; the drawn ones stay out of the open water
  const spots = decorated ? [] : [[0.08, 0.3], [0.92, 0.22], [0.85, 0.7], [0.12, 0.82], [0.55, 0.92], [0.4, 0.14]];
  spots.forEach(([fx, fy], i) => pads.push({ x: fx * W, y: fy * H, r: 32 + Math.random() * 24, rot: Math.random() * Math.PI * 2,
    flower: i === 1 || i === 3, seed: Math.floor(Math.random() * 1e9), sprite: null, night: null }));
}
// The outline of a lily pad: a slightly uneven circle with a narrow slit to the centre
function padPath(c, r, rnd) {
  const slit = 0.16, steps = 48, wob = [rnd(), rnd(), rnd()].map(v => v * Math.PI * 2);
  c.beginPath();
  c.moveTo(0, 0);
  for (let k = 0; k <= steps; k++) {
    const a = slit + k * (Math.PI * 2 - slit * 2) / steps;
    const rr = r * (1 + 0.025 * Math.sin(a * 3 + wob[0]) + 0.015 * Math.sin(a * 7 + wob[1]) + 0.01 * Math.sin(a * 13 + wob[2]));
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
}
// A water lily seen from above: three rings of pointed petals around a golden centre
function drawLily(c, R, night, rnd) {
  const petal = (len, wid, base, tip) => {
    const g = c.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, base); g.addColorStop(1, tip);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(len * 0.3, -wid, len * 0.8, -wid * 0.7, len, 0);
    c.bezierCurveTo(len * 0.8, wid * 0.7, len * 0.3, wid, 0, 0);
    c.fill();
    c.strokeStyle = "rgba(150, 40, 90, 0.1)";
    c.lineWidth = Math.max(0.5, R * 0.012);
    c.beginPath(); c.moveTo(len * 0.12, 0); c.lineTo(len * 0.85, 0); c.stroke();
  };
  const rings = night
    ? [[12, 1, 0.26, "#e2d0e2", "#b86c98"], [10, 0.8, 0.24, "#ecdcec", "#c983ad"], [8, 0.58, 0.21, "#f3e8f3", "#d6a2c1"], [6, 0.38, 0.17, "#f8f0f6", "#e2bcd2"]]
    : [[12, 1, 0.26, "#fde9f1", "#ea6f9f"], [10, 0.8, 0.24, "#fff0f5", "#f287b2"], [8, 0.58, 0.21, "#fff6f9", "#f7a9c8"], [6, 0.38, 0.17, "#fffbfd", "#fbcadc"]];
  c.save();
  c.shadowColor = "rgba(0, 0, 0, 0.35)";
  c.shadowBlur = R * 0.25;
  c.shadowOffsetX = R * 0.08;
  c.shadowOffsetY = R * 0.12;
  rings.forEach(([n, len, wid, base, tip], ring) => {
    // Each ring sits a little higher and casts a soft shadow on the one below
    if (ring) { c.shadowColor = "rgba(120, 20, 60, 0.25)"; c.shadowBlur = R * 0.08; c.shadowOffsetX = R * 0.02; c.shadowOffsetY = R * 0.03; }
    const turn = ring * 0.37 + rnd() * 0.3;
    for (let k = 0; k < n; k++) {
      c.save();
      c.rotate(turn + k * Math.PI * 2 / n + (rnd() - 0.5) * 0.12);
      petal(R * len * (0.92 + rnd() * 0.12), R * wid, base, tip);
      c.restore();
    }
  });
  c.shadowColor = "transparent";
  c.restore();
  // Golden centre with a ring of stamens
  const g = c.createRadialGradient(-R * 0.03, -R * 0.03, 0, 0, 0, R * 0.2);
  g.addColorStop(0, night ? "#f1d27a" : "#ffe27a"); g.addColorStop(1, night ? "#c9952e" : "#e9a520");
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, R * 0.17, 0, Math.PI * 2); c.fill();
  c.fillStyle = night ? "#e8c35a" : "#ffd23f";
  for (let k = 0; k < 18; k++) {
    const a = k * Math.PI * 2 / 18, d = R * (0.2 + rnd() * 0.04);
    c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, R * 0.028, 0, Math.PI * 2); c.fill();
  }
}
// Each pad is painted once to its own canvas (it only changes with day and night), then placed every frame
function padSprite(p) {
  const night = isNight();
  if (p.sprite && p.night === night) return p.sprite;
  const dpr = Math.min(2, devicePixelRatio || 1), r = p.r, half = r * 1.45;
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.ceil(half * 2 * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
  let rnd = seeded(p.seed);
  // Soft shadow on the water
  c.save();
  c.shadowColor = "rgba(0, 0, 0, 0.4)";
  c.shadowBlur = r * 0.3;
  c.shadowOffsetX = r * 0.08;
  c.shadowOffsetY = r * 0.14;
  padPath(c, r, rnd);
  c.fillStyle = "#000";
  c.fill();
  c.restore();
  // Leaf colour: lighter in the middle, deeper towards the edge
  rnd = seeded(p.seed);
  padPath(c, r, rnd);
  c.save();
  c.clip();
  const base = c.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, r * 1.05);
  if (night) { base.addColorStop(0, "#47724c"); base.addColorStop(0.6, "#2c5236"); base.addColorStop(1, "#1c3a27"); }
  else { base.addColorStop(0, "#74a04f"); base.addColorStop(0.55, "#447f37"); base.addColorStop(1, "#2b5c2d"); }
  c.fillStyle = base;
  c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  // Mottling: a few soft, sun-faded and darker patches
  for (let k = 0; k < 9; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.85, sr = r * (0.12 + rnd() * 0.22);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    const g = c.createRadialGradient(x, y, 0, x, y, sr);
    const tone = rnd() < 0.5 ? (night ? "120, 150, 90" : "190, 205, 110") : (night ? "20, 40, 25" : "60, 70, 25");
    g.addColorStop(0, `rgba(${tone}, ${0.12 + rnd() * 0.12})`); g.addColorStop(1, `rgba(${tone}, 0)`);
    c.fillStyle = g;
    c.fillRect(x - sr, y - sr, sr * 2, sr * 2);
  }
  // Fine grain, so the leaf does not look flat
  for (let k = 0; k < 220; k++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
    c.fillStyle = rnd() < 0.5 ? "rgba(255, 255, 220, 0.06)" : "rgba(0, 30, 0, 0.07)";
    c.fillRect(Math.cos(a) * d, Math.sin(a) * d, r * 0.03, r * 0.03);
  }
  // Veins: faint, gently curved lines from the centre, each splitting once towards the rim
  c.lineCap = "round";
  const veins = 15;
  for (let k = 0; k < veins; k++) {
    const a = 0.3 + k * (Math.PI * 2 - 0.6) / (veins - 1), bend = (rnd() - 0.5) * 0.25;
    const ex = Math.cos(a + bend) * r * 0.93, ey = Math.sin(a + bend) * r * 0.93;
    const mx = Math.cos(a) * r * 0.5, my = Math.sin(a) * r * 0.5;
    c.strokeStyle = night ? "rgba(170, 210, 160, 0.1)" : "rgba(220, 240, 180, 0.17)";
    c.lineWidth = Math.max(0.6, r * 0.026);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
    const f = 0.62, fx = Math.cos(a + bend * 0.6) * r * f, fy = Math.sin(a + bend * 0.6) * r * f;
    const fa = a + (rnd() < 0.5 ? -1 : 1) * 0.17;
    c.lineWidth = Math.max(0.4, r * 0.012);
    c.strokeStyle = night ? "rgba(170, 210, 160, 0.06)" : "rgba(220, 240, 180, 0.09)";
    c.beginPath(); c.moveTo(fx, fy); c.lineTo(Math.cos(fa) * r * 0.92, Math.sin(fa) * r * 0.92); c.stroke();
  }
  // Light from above: a broad sheen, and a darker inner shade on the far side
  const sheen = c.createRadialGradient(-r * 0.35, -r * 0.4, 0, -r * 0.35, -r * 0.4, r * 0.9);
  sheen.addColorStop(0, `rgba(255, 255, 240, ${night ? 0.08 : 0.2})`); sheen.addColorStop(1, "rgba(255, 255, 240, 0)");
  c.fillStyle = sheen;
  c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  c.restore();
  // The rim curls up a little: a light inner edge and a thin dark outline
  rnd = seeded(p.seed);
  padPath(c, r, rnd);
  c.save();
  c.clip();
  c.strokeStyle = night ? "rgba(120, 150, 100, 0.22)" : "rgba(170, 190, 100, 0.32)";
  c.lineWidth = r * 0.06;
  c.stroke();
  c.restore();
  padPath(c, r, seeded(p.seed));
  c.strokeStyle = night ? "rgba(10, 25, 15, 0.45)" : "rgba(60, 50, 20, 0.35)";
  c.lineWidth = Math.max(0.6, r * 0.015);
  c.stroke();
  rnd = seeded(p.seed + 1);
  // A water drop now and then
  if (rnd() < 0.6) {
    const a = rnd() * Math.PI * 2, d = r * (0.3 + rnd() * 0.4), dr = r * (0.05 + rnd() * 0.04);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    c.fillStyle = "rgba(0, 30, 10, 0.25)";
    c.beginPath(); c.arc(x + dr * 0.25, y + dr * 0.35, dr, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(x - dr * 0.3, y - dr * 0.35, 0, x, y, dr);
    g.addColorStop(0, "rgba(255, 255, 255, 0.9)"); g.addColorStop(0.35, "rgba(220, 245, 230, 0.35)"); g.addColorStop(1, "rgba(160, 210, 170, 0.15)");
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, dr, 0, Math.PI * 2); c.fill();
  }
  if (p.flower) {
    c.save();
    c.translate(r * 0.22, -r * 0.18);
    drawLily(c, r * 0.62, night, rnd);
    c.restore();
  }
  p.sprite = { cv, half };
  p.night = night;
  return p.sprite;
}
let padTime = 0;
function drawPad(c, p) {
  const sp = padSprite(p);
  // Pads ride the water: a slow sway and a faint drift
  const t = padTime + p.seed % 100;
  c.save();
  c.translate(p.x + Math.sin(t * 0.21) * 1.5, p.y + Math.cos(t * 0.17) * 1.5);
  c.rotate(p.rot + Math.sin(t * 0.26) * 0.04);
  c.drawImage(sp.cv, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
  c.restore();
}
/* ---------- Decorations for the pond, bought with pearls ----------
   Each has its own place, kept clear of the others and of the open water in the middle where the koi swim. Floating
   things (lilies, lotus, lanterns) ride the water under the koi; the rest stand over them, so a koi can pass under the
   bridge. Owned decorations live in journey.pond (so iCloud keeps them); hidden ones stay owned. */
// Places are [x, y, size] as shares of the screen (size of its width). Everything sits on the banks round the pond:
// a row along the top under the title, a column down each side and a row along the bottom. The open water in the
// middle stays free, and when there is anything standing on the banks the koi keep to that open water.
const POND_DECOR = [
  { id: "lilies", name: "Water lilies", img: "img/map/pad.webp", price: 80, spots: [[0.24, 0.24, 0.12], [0.77, 0.48, 0.11], [0.25, 0.77, 0.11]], float: true },
  { id: "reeds", name: "Reeds", img: "img/map/reeds.webp", price: 100, spots: [[0.06, 0.5, 0.17], [0.95, 0.56, 0.15]] },
  { id: "rocks", name: "Mossy rocks", img: "img/map/rock.webp", price: 120, spots: [[0.91, 0.86, 0.19]] },
  { id: "lotus", name: "White lotus", img: "img/ui/lotus-white.webp", price: 150, spots: [[0.76, 0.77, 0.14]], float: true },
  { id: "toro", name: "Floating lanterns", img: "img/ui/toro.webp", price: 200, spots: [[0.24, 0.62, 0.14]], float: true, glow: true },
  { id: "lantern", name: "Stone lantern", img: "img/map/lantern.webp", price: 220, spots: [[0.09, 0.16, 0.2]] },
  { id: "basin", name: "Stone basin", img: "img/ui/basin.webp", price: 250, spots: [[0.91, 0.16, 0.19]] },
  { id: "bamboo", name: "Bamboo grove", img: "img/ui/bamboo-clump.webp", price: 260, spots: [[0.08, 0.85, 0.22]] },
  { id: "fountain", name: "Bamboo fountain", img: "img/ui/fountain.webp", price: 320, spots: [[0.92, 0.34, 0.2]] },
  { id: "pine", name: "Island pine", img: "img/map/pine.webp", price: 380, spots: [[0.08, 0.33, 0.22]] },
  { id: "bridge", name: "Red bridge", img: "img/map/bridge.webp", price: 450, spots: [[0.33, 0.87, 0.27]] },
  { id: "cherry", name: "Cherry tree", img: "img/map/blossom.webp", price: 500, spots: [[0.9, 0.68, 0.24]] },
  { id: "maple", name: "Red maple", img: "img/map/maple.webp", price: 500, spots: [[0.1, 0.68, 0.24]] },
  { id: "torii", name: "Torii gate", img: "img/map/torii.webp", price: 650, spots: [[0.5, 0.15, 0.26]] },
  { id: "pagoda", name: "Pagoda", img: "img/map/pagoda.webp", price: 800, spots: [[0.64, 0.86, 0.22]] }
];
// The open water the koi swim in: all of it, or the middle when something stands on the banks
function pondWater() {
  const W = innerWidth, H = innerHeight;
  if (!POND_DECOR.some(d => !d.float && decorShown(d))) return { x: 0, y: 0, w: W, h: H };
  const x = W * 0.17, y = H * 0.24;
  return { x, y, w: W - 2 * x, h: H * 0.76 - y };
}
const pondDecorImages = {};
const pondState = () => journey.pond || (journey.pond = { owned: [], hidden: [] });
const decorOwned = d => pondState().owned.includes(d.id);
const decorShown = d => decorOwned(d) && !pondState().hidden.includes(d.id);
function decorImage(d) {
  if (!pondDecorImages[d.img]) { pondDecorImages[d.img] = new Image(); pondDecorImages[d.img].src = d.img; }
  return pondDecorImages[d.img];
}
// Every placed piece, nearest the bottom drawn last, so things lower on the screen stand in front
function decorPieces(floating) {
  const W = innerWidth, H = innerHeight, unit = Math.min(W, H * 0.6);
  const list = [];
  POND_DECOR.forEach(d => {
    if (!decorShown(d) || !!d.float !== floating) return;
    d.spots.forEach(([fx, fy, fs], k) => list.push({ d, k, x: fx * W, y: fy * H, s: fs * unit }));
  });
  return list.sort((a, b) => a.y - b.y);
}
function drawDecor(c, floating, t) {
  decorPieces(floating).forEach(p => {
    const im = decorImage(p.d);
    if (!im.complete || !im.naturalWidth) return;
    c.save();
    let x = p.x, y = p.y;
    if (floating) { x += Math.sin(t * 0.4 + p.k * 2) * 3; y += Math.cos(t * 0.33 + p.k) * 2; }
    c.translate(x, y);
    if (floating) c.rotate(Math.sin(t * 0.25 + p.k) * 0.05);
    if (p.d.glow) {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, p.s * 0.75);
      g.addColorStop(0, `rgba(255, 190, 110, ${isNight() ? 0.45 : 0.25})`);
      g.addColorStop(1, "rgba(255, 170, 90, 0)");
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, p.s * 0.75, 0, 6.283); c.fill();
    }
    // A soft shadow on the water under things that stand in it
    if (!floating) {
      c.fillStyle = "rgba(0, 20, 25, 0.22)";
      c.beginPath(); c.ellipse(p.s * 0.06, p.s * 0.36, p.s * 0.4, p.s * 0.12, 0, 0, 6.283); c.fill();
    }
    if (isNight() && !p.d.glow) c.filter = "brightness(0.6) saturate(0.8)";
    c.drawImage(im, -p.s / 2, -p.s / 2, p.s, p.s);
    c.filter = "none";
    c.restore();
  });
}
// Standing things are mirrored in the water under them, softly and a little rippled, so they stand in the pond
// instead of floating over it. Drawn on the surface: over the koi, under the lily pads and floating things.
function drawReflections(c, t) {
  decorPieces(false).forEach(p => {
    const im = decorImage(p.d);
    if (!im.complete || !im.naturalWidth) return;
    const base = p.y + p.s * 0.44;
    c.save();
    c.globalAlpha = isNight() ? 0.16 : 0.22;
    // Thin horizontal slices, each nudged sideways a little, the way ripples break up a reflection
    const slices = 10, sh = p.s / slices;
    for (let k = 0; k < slices; k++) {
      const sy = (k / slices) * im.naturalHeight, sH = im.naturalHeight / slices;
      const dy = base + (slices - 1 - k) * sh * 0.5;
      const wob = Math.sin(t * 1.3 + k * 0.9 + p.k) * p.s * 0.012 * (1 + (slices - k) / slices);
      c.save();
      c.translate(p.x + wob, dy + sh * 0.5);
      c.scale(1, -0.5);
      c.drawImage(im, 0, sy, im.naturalWidth, sH, -p.s / 2, -sh / 2, p.s, sh);
      c.restore();
    }
    c.restore();
  });
}
function paintPondShop() {
  $("pondBank").querySelector("b").textContent = journey.pearls;
  $("pondGrid").innerHTML = POND_DECOR.map(d => {
    const owned = decorOwned(d), shown = decorShown(d);
    const status = owned ? (shown ? "In your pond" : "Hidden · tap to show")
      : pondBuying === d.id ? "Tap again to buy" : `<i class="pearl"></i> ${d.price}`;
    return `<button class="pond-item${owned ? " owned" : ""}${shown ? " on" : ""}${pondBuying === d.id ? " confirm" : ""}${!owned && journey.pearls < d.price ? " short" : ""}" data-id="${d.id}">`
      + `<img src="${d.img}" alt=""><b>${d.name}</b><small>${status}</small></button>`;
  }).join("");
  const n = pondState().owned.length;
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
  // Bought: it appears in the pond with a splash and a ring of gold where it stands
  pondBuying = null;
  buyDecor(d);
  paintPondShop();
  const p = decorPieces(!!d.float).find(q => q.d === d);
  if (p) { sparkBurst(p.x, p.y, 26); splash(p.x, p.y + p.s * 0.3, 0); }
  bowl(6, 0.05);
  buzz([12, 30, 12]);
  if (reduceMotion) drawPond();
});
// Shared with the shop
function buyDecor(d) {
  if (decorOwned(d) || journey.pearls < d.price) return false;
  journey.pearls -= d.price;
  pondState().owned.push(d.id);
  saveJourney();
  track("buy", { data: { kind: "pond", id: d.id, pearls: d.price } });
  if (pondOpen) makePads();
  return true;
}
function toggleDecor(d) {
  const st = pondState();
  st.hidden = decorShown(d) ? st.hidden.concat(d.id) : st.hidden.filter(x => x !== d.id);
  saveJourney();
  tick();
  if (pondOpen) makePads();
  if (pondOpen && reduceMotion) drawPond();
}
function drawPond() {
  const W = innerWidth, H = innerHeight;
  pc.clearRect(0, 0, W, H);
  const t = waterClock();
  drawShimmer(pc, W, H, t, 1);
  if (pondFood) {
    pc.fillStyle = "#b07a3e";
    pondFood.bits.forEach(b => { pc.beginPath(); pc.arc(b.x, b.y, 3.2, 0, Math.PI * 2); pc.fill(); });
  }
  // At night the koi are a little sunk in the dark water: the water's colour is mixed into them, not see-through
  drawFish(pc, pondFish, 0.97, isNight() ? 0.2 : 0.3, isNight() ? ["#16205a", 0.2] : null);
  // Moonlight lies on the surface: over the koi, under the floating pads
  drawMoonlight(pc, W, H, t, 1);
  drawReflections(pc, t);
  pads.forEach(p => drawPad(pc, p));
  // Your decorations: floating ones on the water, then the ones standing in it
  drawDecor(pc, true, t);
  drawDecor(pc, false, t);
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
  // The koi swim in the open water; one still on the banks (decorations just went in) glides back into it
  const wa = pondWater();
  const food = pondFood && { bits: pondFood.bits.map(b => ({ x: b.x - wa.x, y: b.y - wa.y })) };
  pondFish.forEach(f => {
    f.x -= wa.x; f.y -= wa.y;
    stepFish(f, dt, wa.w, wa.h, food);
    f.x = Math.min(wa.w + 30, Math.max(-30, f.x)); f.y = Math.min(wa.h + 30, Math.max(-30, f.y));
    f.x += wa.x; f.y += wa.y;
  });
  padTime += dt;
  drawPond();
  requestAnimationFrame(pondLoop);
}
function openPond(back) {
  pondBack = back || null;
  pondOpen = true;
  $("pondView").hidden = false;
  sizePond();
  const owned = journey.koi.length ? journey.koi : [0, 3];
  const wa = pondWater();
  pondFish = owned.map(k => { const f = makeFish(k, wa.w, wa.h, 92, 140); f.x += wa.x; f.y += wa.y; return f; });
  $("pondCount").textContent = journey.koi.length
    ? `${journey.koi.length} of ${ALL_KOI.length} koi`
    : "Two visitors, until your first koi arrives";
  makePads();
  pondFood = null;
  $("pondShop").hidden = true;
  $("pondHint").hidden = false;
  // The hint says how the pond works, then fades so nothing covers the banks
  const hint = $("pondHint");
  hint.classList.remove("gone");
  clearTimeout(hint.fadeTimer);
  hint.fadeTimer = setTimeout(() => hint.classList.add("gone"), 6000);
  POND_DECOR.forEach(d => { if (decorShown(d)) decorImage(d).onload = () => { if (reduceMotion) drawPond(); }; });
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
  // Tapping the water drops a few pellets, and the koi come to eat
  const ring = document.createElement("div");
  ring.className = "tap-ring";
  ring.style.left = x + "px";
  ring.style.top = y + "px";
  $("pondView").appendChild(ring);
  setTimeout(() => ring.remove(), 1200);
  // Food lands in the open water, so the koi can reach it
  const wa = pondWater(), fx = Math.min(wa.x + wa.w - 20, Math.max(wa.x + 20, x)), fy = Math.min(wa.y + wa.h - 20, Math.max(wa.y + 20, y));
  pondFood = { left: 8, bits: [...Array(6)].map(() => ({ x: fx + (Math.random() - 0.5) * 34, y: fy + (Math.random() - 0.5) * 34 })) };
  voice(520, 0, 0.12, 0.03, 380);
});
window.addEventListener("resize", () => { if (pondOpen) { sizePond(); makePads(); if (reduceMotion) drawPond(); } });

document.addEventListener("visibilitychange", () => {
  // Leaving the app: send the latest progress, best score included, to iCloud
  if (document.hidden) cloudPush();
  if (!document.hidden && koiPaused && !reduceMotion) { koiPaused = false; lastKoi = performance.now(); requestAnimationFrame(koiLoop); }
});
