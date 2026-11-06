// Koi Garden: Particles, combo words and the light in the water.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Effects ---------- */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fxCanvas = $("fx"), fx = fxCanvas.getContext("2d");
const koiCanvas = $("koiLayer"), kx = koiCanvas.getContext("2d");
const palette = {};
const entering = new Set();
let justPlaced = new Set(), fellAt = -1, grewAt = -1, clearDelay = {}, clearToken = null;
// Cells where a frog just landed or a leaf just fell, for their little arrival animations
let hopTo = new Set(), leafAt = -1;
let parts = [], fxRunning = false, lastFx = 0;
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  for (let k = 1; k <= 9; k++) palette[k] = cs.getPropertyValue(`--p${k}`).trim();
  palette.gold = cs.getPropertyValue("--gold").trim();
  palette.petal = cs.getPropertyValue("--p5").trim();
}
function sizeCanvases() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  [fxCanvas, koiCanvas].forEach(c => {
    c.width = Math.round(innerWidth * dpr);
    c.height = Math.round(innerHeight * dpr);
    c.style.width = innerWidth + "px";
    c.style.height = innerHeight + "px";
    c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  });
}
// The whole effects canvas, whatever the page's size says now: in-app browsers (Messenger, Instagram) change the
// viewport without a resize event, and clearing only innerWidth x innerHeight then left old frames smeared on screen
function clearFx() {
  fx.save();
  fx.setTransform(1, 0, 0, 1, 0, 0);
  fx.globalAlpha = 1;
  fx.globalCompositeOperation = "source-over";
  fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  fx.restore();
}
// The canvases follow the viewport even when no resize event comes
function fxSizeOk() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (fxCanvas.width !== Math.round(innerWidth * dpr) || fxCanvas.height !== Math.round(innerHeight * dpr)) sizeCanvases();
}
function spawn(p) {
  if (reduceMotion) return;
  // Calm effects keep about a third of the particles, and all koi
  if (prefs.calm && !p.catchable && !["koi", "leap", "orbit", "dart", "petal"].includes(p.type) && Math.random() > 0.35) return;
  parts.push(Object.assign({ t: 0, delay: 0, rot: 0, vr: 0, g: 900, drag: 0.985, phase: 0 }, p));
  if (!fxRunning) { fxSizeOk(); fxRunning = true; lastFx = performance.now(); requestAnimationFrame(fxLoop); }
}
function fxLoop(now) {
  const dt = Math.min(0.05, (now - lastFx) / 1000);
  lastFx = now;
  fxSizeOk();
  clearFx();
  const dpr = fxCanvas.width / innerWidth || 1;
  fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  parts = parts.filter(p => { try { return stepPart(p, dt); } catch (e) { fx.restore(); return false; } });
  // Particles born during the frame (a trail behind something moving) join for the next one
  if (fxLater.length) { parts.push(...fxLater.map(p => Object.assign({ t: 0, delay: 0, rot: 0, vr: 0, g: 900, drag: 0.985, phase: 0 }, p))); fxLater = []; }
  if (parts.length) requestAnimationFrame(fxLoop);
  else { fxRunning = false; clearFx(); }
}
// One particle for one frame: false when it is done. A particle that fails to draw is dropped, and the loop carries on.
function stepPart(p, dt) {
  {
    if (p.delay > 0) { p.delay -= dt; return true; }
    p.t += dt;
    if (p.t >= p.life) return false;
    // Some move along their own path (the lucky koi, things floating up) instead of flying freely
    if (p.path) p.path(p, dt);
    else if (p.type === "orbit") {
      // Circles the board, facing the way it swims
      p.ang += p.w * dt;
      p.x = p.cx + Math.cos(p.ang) * p.R;
      p.y = p.cy + Math.sin(p.ang) * p.R;
      p.rot = p.ang + Math.PI / 2;
    } else {
      if (p.type === "petal") p.vx += Math.sin(p.t * 3 + p.phase) * 40 * dt;
      if (p.type === "koi") p.vx += Math.sin(p.t * 7 + p.phase) * 220 * dt;
      p.vy += p.g * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot = p.type === "koi" || p.type === "leap" || p.type === "dart" ? Math.atan2(p.vy, p.vx) : p.rot + p.vr * dt;
    }
    const a = 1 - p.t / p.life;
    fx.save();
    fx.globalAlpha = Math.min(1, a * 1.5, p.type === "orbit" ? p.t * 4 : 1);
    fx.translate(p.x, p.y);
    fx.rotate(p.rot);
    fx.fillStyle = p.color;
    if (p.draw) p.draw(fx, p);
    else if (p.type === "shard") {
      fx.beginPath();
      fx.moveTo(-p.size, -p.size * 0.6); fx.lineTo(p.size, -p.size * 0.2); fx.lineTo(-p.size * 0.2, p.size);
      fx.closePath(); fx.fill();
    } else if (p.type === "spark") {
      const s = p.size * (0.4 + a);
      fx.beginPath();
      for (let k = 0; k < 4; k++) {
        const ang = k * Math.PI / 2;
        fx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s);
        fx.lineTo(Math.cos(ang + Math.PI / 4) * s * 0.28, Math.sin(ang + Math.PI / 4) * s * 0.28);
      }
      fx.closePath(); fx.fill();
    } else if (p.type === "petal") {
      fx.beginPath(); fx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); fx.fill();
    } else if (p.type === "dust") {
      fx.beginPath(); fx.arc(0, 0, p.size * (1 + p.t / p.life), 0, Math.PI * 2); fx.fill();
    } else if (p.type === "koi") {
      drawKoiSprite(fx, koiImages[p.img === undefined ? 3 : p.img], p.size * 3, p.t * 11, Math.sin(p.t * 7 + p.phase) * 0.5, 1.3);
    } else if (p.type === "leap") {
      // A little bigger at the top of the arc, as if it comes closer
      const sc = 1 + 0.3 * Math.sin(Math.PI * p.t / p.life);
      fx.scale(sc, sc);
      drawWarpedKoi(fx, koiImages[p.img], p.size * 3, p.t * 14, Math.sin(p.t * 9 + p.phase) * 0.3, 1.2, fx.globalAlpha);
    } else if (p.type === "dart") {
      drawWarpedKoi(fx, koiImages[p.img], p.size * 3, p.t * 30, 0, 0.6, fx.globalAlpha);
    } else if (p.type === "orbit") {
      drawWarpedKoi(fx, koiImages[p.img], p.size * 3, p.t * 12, 0.5, 1, fx.globalAlpha);
    } else if (p.type === "drop") {
      fx.beginPath(); fx.arc(0, 0, p.size, 0, Math.PI * 2); fx.fill();
    }
    fx.restore();
    return true;
  }
}
function cellCenter(i) {
  const r = cellEls[i].getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}
// Stones burst into shards, one after another along the line
function shatter(map, delays) {
  Object.keys(map).forEach(k => {
    const i = +k, { x, y, w } = cellCenter(i);
    const d = (delays[i] || 0) / 1000 + 0.1, col = palette[map[k]] || palette.gold;
    for (let n = 0; n < 6; n++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
      spawn({ type: "shard", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160, life: 0.7 + Math.random() * 0.4,
        size: w * (0.1 + Math.random() * 0.08), color: col, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, delay: d });
    }
    spawn({ type: "spark", x, y, vx: 0, vy: -40, g: 0, life: 0.45, size: w * 0.38, color: "#ffffff", delay: d });
  });
}
function iceShatter(i) {
  const { x, y, w } = cellCenter(i);
  for (let n = 0; n < 12; n++) {
    const a = Math.random() * Math.PI * 2, sp = 100 + Math.random() * 220;
    spawn({ type: "shard", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.65, size: w * 0.1,
      color: "rgba(225, 242, 255, 0.95)", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16 });
  }
}
function sparkle(l) {
  const a = cellCenter(l.cells[0]), b = cellCenter(l.cells[l.cells.length - 1]);
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  for (let n = 0; n < 28; n++) {
    const ang = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 320;
    spawn({ type: "spark", x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 120, life: 0.8 + Math.random() * 0.5,
      size: 4 + Math.random() * 6, color: palette.gold, delay: Math.random() * 0.2 });
  }
}
// A freed koi swims up and out of the pond
function swimAway(i) {
  const { x, y, w } = cellCenter(i);
  spawn({ type: "koi", x, y, vx: (Math.random() - 0.5) * 160, vy: -60, g: -380, drag: 0.995, life: 1.8,
    size: w * 0.42, phase: Math.random() * 6, delay: 0.25 });
}
function petals(count = 90) {
  const cols = [palette.petal, palette.gold, "#ffffff"];
  for (let n = 0; n < count; n++) {
    spawn({ type: "petal", x: Math.random() * innerWidth, y: -20 - Math.random() * 80, vx: (Math.random() - 0.5) * 40,
      vy: 60 + Math.random() * 90, g: 25, drag: 0.995, life: 3.2 + Math.random() * 1.2, size: 4 + Math.random() * 4,
      color: cols[n % 3], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 5, phase: Math.random() * 6, delay: Math.random() * 0.9 });
  }
}
function dust(i, count = 2) {
  const { x, y, w } = cellCenter(i);
  for (let n = 0; n < count; n++) {
    spawn({ type: "dust", x: x + (Math.random() - 0.5) * w * 0.6, y: y + w * 0.3, vx: (Math.random() - 0.5) * 60,
      vy: -20 - Math.random() * 30, g: 40, life: 0.5, size: w * 0.08, color: "rgba(190, 150, 90, 0.45)" });
  }
}
function sweeps(lines) {
  if (reduceMotion) return;
  const wrap = $("boardWrap"), wr = wrap.getBoundingClientRect();
  lines.forEach(l => {
    const a = cellEls[l.cells[0]].getBoundingClientRect(), b = cellEls[l.cells[l.cells.length - 1]].getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "sweep" + (l.kind === "col" ? " v" : l.kind === "bed" ? " bed" : "");
    Object.assign(el.style, { left: (a.left - wr.left - 2) + "px", top: (a.top - wr.top - 2) + "px",
      width: (b.right - a.left + 4) + "px", height: (b.bottom - a.top + 4) + "px" });
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 650);
  });
}
// A koi from the collection leaps out of the pond, over the board and back in
function leap() {
  if (reduceMotion) return;
  const b = $("board").getBoundingClientRect();
  const dir = Math.random() < 0.5 ? 1 : -1;
  const x0 = b.left + b.width * (dir > 0 ? 0.16 : 0.84), y0 = b.top + b.height * 0.8;
  const T = 1.15, g = 1500, vx = dir * b.width * 0.68 / T;
  const owned = journey.koi.filter(i => koiImages[i]);
  const img = owned.length ? owned[Math.floor(Math.random() * owned.length)] : 0;
  splash(x0, y0, 0);
  sfxSplash(0);
  sfxSplash(T - 0.08);
  spawn({ type: "leap", x: x0, y: y0, vx, vy: -g * T / 2, g, drag: 1, life: T, size: b.width / N * 0.95, img, phase: Math.random() * 6 });
  splash(x0 + vx * T, y0, T - 0.08);
  buzz(10);
}
function splash(x, y, delay) {
  for (let n = 0; n < 14; n++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7, sp = 150 + Math.random() * 230;
    spawn({ type: "drop", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, drag: 0.99, life: 0.5 + Math.random() * 0.3,
      size: 1.8 + Math.random() * 2.4, color: "rgba(225, 246, 255, 0.95)", delay });
  }
  setTimeout(() => ring("splash-ring", x, y), delay * 1000);
}
function ring(cls, x, y, size) {
  if (reduceMotion) return;
  const el = document.createElement("div");
  el.className = cls;
  if (size) el.style.width = el.style.height = size + "px";
  el.style.left = x + "px";
  el.style.top = y + "px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
// Each joker shows its own move: four koi dart out along the row and column, a wave spreads
// over the 5×5 square, or a streak of colour runs to every stone it takes
function jokerShow(type, r, c, cells, colourIdx) {
  const from = cellCenter(r * N + c), pitch = metrics().pitch;
  if (type === "arrow") {
    sweeps([{ kind: "row", cells: LINES[r].cells }, { kind: "col", cells: LINES[N + c].cells }]);
    // The stones go one cell further out every 45 ms; the koi keep pace with them
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => spawn({ type: "dart", x: from.x, y: from.y, vx: dx * pitch / 0.045, vy: dy * pitch / 0.045,
      g: 0, drag: 1, life: 0.42, size: pitch * 0.38, img: JOKERS.arrow.koi }));
  } else if (type === "ripple") {
    ring("ripple-ring", from.x, from.y, pitch * 5.2);
    setTimeout(() => ring("ripple-ring", from.x, from.y, pitch * 5.2), 160);
  } else {
    const colour = palette[colourIdx] || palette.gold;
    cells.forEach(i => {
      const to = cellCenter(i), t = Math.max(0.12, (clearDelay[i] || 0) / 1000 + 0.08);
      for (let k = 0; k < 3; k++) spawn({ type: "spark", x: from.x, y: from.y, vx: (to.x - from.x) / t, vy: (to.y - from.y) / t, g: 0, drag: 1,
        life: t, size: 5 - k, color: k ? "#ffffff" : colour, delay: k * 0.03 });
    });
  }
}
// A collected lotus lifts off as pink petals with a little bell
function pickLotus(i) {
  const { x, y, w } = cellCenter(i);
  for (let n = 0; n < 10; n++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
    spawn({ type: "petal", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 60, drag: 0.97, life: 1.2 + Math.random() * 0.5,
      size: w * 0.12, color: n % 3 ? "#ff9fc4" : "#ffffff", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, phase: Math.random() * 6 });
  }
  if (sfxOk()) bell(hz(14 + Math.floor(Math.random() * 3)), ac.currentTime, 0.035);
}
// New bamboo pushes up with a few green leaves
// A blossom stone bursts into petals
function blossomBurst(i) {
  const { x, y, w } = cellCenter(i);
  for (let n = 0; n < 16; n++) {
    const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 160;
    spawn({ type: "petal", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 70, drag: 0.96, life: 1.1 + Math.random() * 0.6,
      size: w * 0.13, color: n % 4 ? "#ffb7cf" : "#ffffff", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 7, phase: Math.random() * 6 });
  }
}
// A frog sent home jumps off the board in a high arc
function frogHome(i) {
  const { x, y, w } = cellCenter(i);
  const el = document.createElement("div");
  el.className = "frog-jump";
  el.style.cssText = `left:${x - w / 2}px;top:${y - w / 2}px;width:${w}px;height:${w}px;--dx:${(Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 80)}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
  if (sfxOk()) { voice(520, 0.02, 0.06, 0.05, 340); voice(620, 0.11, 0.06, 0.04, 400); }
}
function leaves(i) {
  const { x, y, w } = cellCenter(i);
  for (let n = 0; n < 6; n++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2, sp = 50 + Math.random() * 90;
    spawn({ type: "petal", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, drag: 0.98, life: 0.9,
      size: w * 0.1, color: n % 2 ? "#7cc24a" : "#4f9a2c", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, phase: Math.random() * 6 });
  }
}
// Still water: rings spread across the empty board and a golden koi swims a lap around it
function stillWater() {
  const b = $("board").getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  ring("still-ring", cx, cy, b.width);
  setTimeout(() => ring("still-ring", cx, cy, b.width), 280);
  spawn({ type: "orbit", x: cx, y: cy - b.width * 0.36, cx, cy, R: b.width * 0.36, ang: -Math.PI / 2, w: 2.7, g: 0,
    life: 2.3, size: b.width / N * 0.8, img: 3 });
  petals(40);
  stillSound();
  buzz([12, 40, 12, 40, 20]);
}
// A sprinkle of gold sparks from one point
function sparkBurst(x, y, count = 24) {
  for (let n = 0; n < count; n++) {
    const ang = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 300;
    spawn({ type: "spark", x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 160, life: 0.7 + Math.random() * 0.5,
      size: 4 + Math.random() * 5, color: palette.gold, delay: Math.random() * 0.12 });
  }
}
// Pearls fly in an arc from a reward into a pearl count, which ticks up as each one lands
function flyPearls(fromEl, bank, from, to, delay = 0) {
  const num = bank.querySelector("b");
  if (reduceMotion || to <= from) { num.textContent = to; return; }
  num.textContent = from;
  const a = fromEl.getBoundingClientRect(), b = bank.getBoundingClientRect();
  const n = Math.min(8, Math.max(3, Math.round((to - from) / 6)));
  let got = 0;
  for (let k = 0; k < n; k++) {
    const el = document.createElement("i");
    el.className = "pearl fly-pearl";
    document.body.appendChild(el);
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 40, y0 = a.top + a.height / 2;
    const x1 = b.left + 13, y1 = b.top + b.height / 2;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 90, my = Math.min(y0, y1) - 30 - Math.random() * 50;
    const anim = el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.5)`, opacity: 0 },
      { transform: `translate(${mx}px, ${my}px) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.85)`, opacity: 1 }
    ], { duration: 640, delay: delay + k * 75, easing: "cubic-bezier(0.645, 0.045, 0.355, 1)", fill: "backwards" });
    anim.onfinish = () => {
      el.remove();
      got++;
      num.textContent = Math.round(from + (to - from) * got / n);
      restartClass(bank, "bump");
      voice(880 + got * 70, 0, 0.09, 0.025);
    };
  }
}
function restartClass(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function flyScore(pts) {
  if (reduceMotion) return;
  const wr = $("boardWrap").getBoundingClientRect(), sr = $("score").getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "fly";
  el.textContent = "+" + pts;
  document.body.appendChild(el);
  const x0 = wr.left + wr.width / 2 - 20, y0 = wr.top + wr.height * 0.42, x1 = sr.left + sr.width / 2 - 20, y1 = sr.top;
  const anim = el.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1.2)`, opacity: 0 },
    { transform: `translate(${x0}px, ${y0 - 24}px) scale(1.2)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.6)`, opacity: 0.3 }
  ], { duration: 950, easing: "cubic-bezier(0.5, 0, 0.8, 0.6)" });
  anim.onfinish = () => { el.remove(); restartClass($("score"), "bump"); };
}

// Koi drifting through the water around the garden
// The pond shows the koi you have collected, up to six; a new pond starts with two
const pondKoi = () => {
  const own = journey.koi.slice(-6);
  return own.length >= 2 ? own : [0, 3, ...own].filter((k, i, a) => a.indexOf(k) === i).slice(0, Math.max(2, own.length));
};
// Draws a sprite centred on the origin, facing +x, cut into thin vertical strips.
// A wave travels from head to tail and grows towards the tail, the way a real fish swims;
// "bend" curves the body into a turn so the tail trails on the outside.
const KOI_STRIPS = 40;
function drawKoiSprite(c, img, len, phase, bend = 0, amp = 1, strips = KOI_STRIPS) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || (img.complete === false)) return;
  const ht = len * h / w, sw = w / strips, dw = len / strips;
  // Sideways offset of the body's centre line at a point (0 = head, 1 = tail tip)
  // About three quarters of a wave fits on the body, so it ripples instead of flapping like a board
  const lineY = tail => (Math.sin(phase - tail * 4.6) * (0.016 + 0.1 * tail * tail) * amp + bend * tail * tail * 0.3) * len;
  for (let i = 0; i < strips; i++) {
    const tail = 1 - (i + 0.5) / strips;
    const y = lineY(tail);
    // Turn each strip along the curve so neighbouring strips meet without steps
    const slope = (lineY(tail - 0.5 / strips) - lineY(tail + 0.5 / strips)) / dw;
    c.save();
    c.translate(-len / 2 + (i + 0.5) * dw, y);
    c.rotate(Math.atan(slope));
    c.drawImage(img, i * sw, 0, sw + 1, h, -dw / 2 - 0.6, -ht / 2, dw + 1.2, ht);
    c.restore();
  }
}
// The strips overlap a little to hide seams. Drawn straight onto the pond with transparency,
// every overlap shows up twice as dark, which striped the koi and their shadows. So the bent
// fish is first built fully opaque on a scratch canvas and then laid on the pond in one piece.
const warpCv = document.createElement("canvas"), wx = warpCv.getContext("2d");
// The koi pictures are 512 px wide but most koi are drawn far smaller. Each is scaled down once per size (in steps of
// 32 px), so the strips below copy from a small picture instead of the full one every frame.
const scaledKoiCache = new Map();
// With `tint` [colour, amount] the water's colour is mixed in, which looks like a faint koi seen through the water but
// can be drawn solid (and so far faster than a see-through koi).
function scaledKoi(img, px, tint) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const size = Math.min(Math.ceil(px / 32) * 32, w);
  if (!w || img.complete === false || (!tint && size >= w * 0.85)) return img;
  let sizes = scaledKoiCache.get(img);
  if (!sizes) scaledKoiCache.set(img, sizes = new Map());
  const key = tint ? `${size}|${tint.join()}` : size;
  if (!sizes.has(key)) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = Math.max(1, Math.round(h * size / w));
    const x = cv.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(img, 0, 0, cv.width, cv.height);
    if (tint) {
      x.globalCompositeOperation = "source-atop";
      x.globalAlpha = tint[1];
      x.fillStyle = tint[0];
      x.fillRect(0, 0, cv.width, cv.height);
    }
    sizes.set(key, cv);
  }
  return sizes.get(key);
}
function drawWarpedKoi(c, img, len, phase, bend, amp, alpha, strips, tint) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || (img.complete === false)) return;
  if (!c.getTransform) { c.globalAlpha = alpha; drawKoiSprite(c, img, len, phase, bend, amp); return; }
  const m = c.getTransform(), s = Math.max(1, Math.hypot(m.a, m.b));
  // About one strip per 12 screen pixels is enough for a smooth bend; small koi need far fewer than 40
  strips = strips || Math.max(10, Math.min(KOI_STRIPS, Math.round(len * s / 12)));
  img = scaledKoi(img, len * s, tint);
  if (tint) alpha = 1;
  // A nearly solid koi can go straight onto the canvas: the strips overlap by a pixel, and at this alpha the overlap
  // does not show. Fainter koi go through a canvas of their own first, so the seams do not show as lines.
  if (alpha >= 0.95) { c.globalAlpha = alpha; drawKoiSprite(c, img, len, phase, bend, amp, strips); return; }
  const bw = len * 1.1, bh = len * h / w + len * 0.8;
  const pw = Math.ceil(bw * s), ph = Math.ceil(bh * s);
  if (!(pw >= 1 && ph >= 1 && pw < 4096 && ph < 4096)) return;
  if (warpCv.width < pw || warpCv.height < ph) {
    warpCv.width = Math.max(warpCv.width, pw);
    warpCv.height = Math.max(warpCv.height, ph);
  }
  wx.setTransform(1, 0, 0, 1, 0, 0);
  wx.clearRect(0, 0, pw + 1, ph + 1);
  wx.setTransform(s, 0, 0, s, pw / 2, ph / 2);
  drawKoiSprite(wx, img, len, phase, bend, amp, strips);
  c.globalAlpha = alpha;
  c.drawImage(warpCv, 0, 0, pw, ph, -bw / 2, -bh / 2, bw, bh);
}
// A blurred dark copy of each sprite, used as its shadow on the pond floor
const shadowCache = new Map();
function koiShadow(img) {
  if (shadowCache.has(img)) return shadowCache.get(img);
  if (!img.complete || !img.naturalWidth) return null;
  const pad = 24, cv = document.createElement("canvas");
  cv.width = img.naturalWidth + pad * 2;
  cv.height = img.naturalHeight + pad * 2;
  const c = cv.getContext("2d");
  c.shadowColor = "rgba(0, 0, 0, 1)";
  c.shadowBlur = 14;
  c.shadowOffsetX = 10000;
  c.drawImage(img, pad - 10000, pad);
  shadowCache.set(img, cv);
  return cv;
}
// Swimming koi, shared by the background pond and the full koi pond
function makeFish(k, W, H, lenMin, lenMax) {
  const v = 16 + Math.random() * 14;
  return { x: 40 + Math.random() * Math.max(1, W - 80), y: 40 + Math.random() * Math.max(1, H - 80),
    a: Math.random() * Math.PI * 2, v, vTarget: v, turn: 0, turnTarget: 0, timer: Math.random() * 3,
    phase: Math.random() * 6, len: lenMin + Math.random() * (lenMax - lenMin), img: koiImages[k], k };
}
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
function stepFish(f, dt, W, H, food) {
  // Every few seconds pick a new gentle drift: a slow turn and a new cruising speed,
  // sometimes a short burst, sometimes a long glide
  f.timer -= dt;
  if (f.timer <= 0) {
    f.turnTarget = (Math.random() - 0.5) * 0.9;
    f.vTarget = Math.random() < 0.25 ? 34 + Math.random() * 14 : 10 + Math.random() * 18;
    f.timer = 2 + Math.random() * 4;
  }
  // Near the edge, turn back towards the middle of the pond instead of popping out
  const edge = 50;
  if (f.x < edge || f.x > W - edge || f.y < edge || f.y > H - edge) {
    const want = Math.atan2(H / 2 - f.y, W / 2 - f.x);
    f.turnTarget = Math.max(-1.3, Math.min(1.3, wrapAngle(want - f.a) * 1.5));
  }
  // Food in the water: nearby koi turn towards it and slow down as they arrive
  if (food && food.bits.length) {
    const b = food.bits[0], d = Math.hypot(b.x - f.x, b.y - f.y);
    if (d < 460) {
      f.turnTarget = Math.max(-1.8, Math.min(1.8, wrapAngle(Math.atan2(b.y - f.y, b.x - f.x) - f.a) * 2.2));
      f.vTarget = d < 50 ? 12 : 44;
      f.timer = 0.8;
    }
  }
  // Ease towards the targets so nothing changes abruptly. The turn rate itself is eased
  // through a second step, so a koi leans into a curve instead of snapping onto it
  f.turnVel = (f.turnVel || 0) + (f.turnTarget - f.turn) * dt * 2.4;
  f.turnVel *= Math.exp(-dt * 2.6);
  f.turn += f.turnVel * dt;
  f.v += (f.vTarget - f.v) * Math.min(1, dt * 0.7);
  f.a += f.turn * dt;
  f.x += Math.cos(f.a) * f.v * dt;
  f.y += Math.sin(f.a) * f.v * dt;
  // Kick hard while speeding up or turning, glide with a small lazy beat otherwise
  const effort = Math.max(0, (f.vTarget - f.v) / 18) + Math.abs(f.turn) * 0.5 + f.v / 60;
  const ampTarget = Math.min(1.5, 0.45 + effort);
  f.amp = (f.amp || ampTarget) + (ampTarget - (f.amp || ampTarget)) * Math.min(1, dt * 1.5);
  f.phase += dt * (1.8 + f.v * 0.09 + f.amp * 2.2);
}
function drawFish(c, list, alpha, shadowAlpha, tint) {
  list.forEach(f => {
    // Swim harder while speeding up, glide with a lazy tail, and bend into the turn
    const amp = f.amp || 1;
    const bend = Math.max(-1, Math.min(1, -f.turn * 1.1));
    // The head sways a touch against the tail beat, as a real koi's does
    const yaw = Math.sin(f.phase + 0.6) * 0.035 * amp;
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.a + yaw);
    const sh = koiShadow(f.img);
    if (sh) {
      c.save();
      c.translate(f.len * 0.08, f.len * 0.12);
      // The shadow is soft, so six strips bend it enough
      drawWarpedKoi(c, sh, sh.width * f.len / f.img.naturalWidth, f.phase - 0.15, bend, amp, shadowAlpha, 6);
      c.restore();
    }
    drawWarpedKoi(c, f.img, f.len, f.phase, bend, amp, alpha, 0, tint);
    c.restore();
  });
}
const isNight = () => document.documentElement.dataset.garden === "night";

// Background pond behind the board
const swimmers = [];
let lastKoi = 0, koiPaused = false;
function initKoi() {
  swimmers.length = 0;
  // Start in the water below the garden picture, so no koi begins on the grass
  const top = sceneTop();
  pondKoi().forEach(k => { const f = makeFish(k, innerWidth, innerHeight - top, 66, 100); f.y += top; swimmers.push(f); });
}
/* ---------- Light in the water ----------
   Shimmer: the moving net of light on the bottom of shallow water, made from one small
   tileable pattern drawn twice, drifting different ways so the crossings flicker.
   At night a moon sits off the top of the screen: a soft glow, and its reflection as a
   broken, rippling path of light on the surface. */
const causticTiles = {};
function causticTile(night) {
  const key = night ? "night" : "day";
  if (causticTiles[key]) return causticTiles[key];
  const N = 128, pts = [], rnd = seeded(7);
  for (let k = 0; k < 14; k++) pts.push([rnd() * N, rnd() * N]);
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const c = cv.getContext("2d"), img = c.createImageData(N, N);
  const [cr, cg, cb] = night ? [170, 200, 255] : [255, 255, 235];
  const TAU = Math.PI * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // Bend the cell walls into curves: warp where we sample, using whole periods so the tile still repeats
    const u = x / N, v = y / N;
    const sx = x + 7 * Math.sin(TAU * (2 * v + 0.3)) + 3 * Math.sin(TAU * (3 * u + 2 * v));
    const sy = y + 7 * Math.sin(TAU * (2 * u + 0.7)) + 3 * Math.sin(TAU * (2 * u - 3 * v));
    // Distance to the nearest and second nearest point, wrapping so the tile repeats seamlessly
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) {
      let dx = Math.abs((((sx - px) % N) + N) % N), dy = Math.abs((((sy - py) % N) + N) % N);
      if (dx > N / 2) dx = N - dx;
      if (dy > N / 2) dy = N - dy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    // Bright where two cells meet: thin lines that soften away from the edge, some brighter than others
    const e = Math.max(0, 1 - (d2 - d1) / 3.6);
    const vary = 0.6 + 0.4 * Math.sin(TAU * (u + 2 * v)) * Math.sin(TAU * (2 * u - v + 0.25));
    const i = (y * N + x) * 4;
    img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb;
    img.data[i + 3] = Math.round(255 * Math.pow(e, 1.6) * vary);
  }
  c.putImageData(img, 0, 0);
  return (causticTiles[key] = cv);
}
// The soft light is painted at half size on a scratch canvas and then stretched over the
// water, which keeps it smooth and cheap; only the sharp moon glints are drawn at full size.
const WATER_Q = 0.5;
const waterLayers = new WeakMap();
function drawShimmer(c, W, H, t, strength) {
  const night = isNight();
  let L = waterLayers.get(c);
  const w = Math.ceil(W * WATER_Q), h = Math.ceil(H * WATER_Q);
  if (!L || L.night !== night) {
    const cv = document.createElement("canvas"), x = cv.getContext("2d"), tile = causticTile(night);
    L = { night, cv, x, a: x.createPattern(tile, "repeat"), b: x.createPattern(tile, "repeat") };
    waterLayers.set(c, L);
  }
  if (L.cv.width !== w || L.cv.height !== h) { L.cv.width = w; L.cv.height = h; }
  const x = L.x;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, w, h);
  x.setTransform(WATER_Q, 0, 0, WATER_Q, 0, 0);
  x.globalCompositeOperation = "lighter";
  if (L.a && L.a.setTransform && typeof DOMMatrix !== "undefined") {
    const base = (night ? 0.1 : 0.17) * strength;
    [[L.a, 2.4, 7, 4, 0.2], [L.b, 3.2, -5, 6, 1.1]].forEach(([pat, sc, vx, vy, rot]) => {
      pat.setTransform(new DOMMatrix().translateSelf(vx * t, vy * t).rotateSelf(rot * 57.3).scaleSelf(sc, sc));
      x.fillStyle = pat;
      // The light breathes a little, so it never looks like a still texture
      x.globalAlpha = base * (0.75 + 0.25 * Math.sin(t * 0.9 + rot * 3));
      x.fillRect(0, 0, W, H);
    });
  }
  if (night) {
    // Glow from the moon above the pond
    const mx = W * 0.76, top = -H * 0.04, R = Math.max(W, H) * 0.7;
    const glow = x.createRadialGradient(mx, top, 0, mx, top, R);
    glow.addColorStop(0, `rgba(190, 210, 255, ${0.22 * strength})`);
    glow.addColorStop(0.4, `rgba(150, 175, 240, ${0.07 * strength})`);
    glow.addColorStop(1, "rgba(150, 175, 240, 0)");
    x.globalAlpha = 1;
    x.fillStyle = glow;
    x.fillRect(0, 0, W, Math.min(H, top + R));
  }
  c.save();
  c.globalCompositeOperation = "lighter";
  c.drawImage(L.cv, 0, 0, W, H);
  c.restore();
}
function drawMoonlight(c, W, H, t, strength) {
  if (!isNight()) return;
  const mx = W * 0.76;
  c.save();
  c.globalCompositeOperation = "lighter";
  // The moon's own reflection, softened by the ripples
  const my = H * 0.09, mr = Math.min(W, H) * 0.07;
  const disc = c.createRadialGradient(mx, my, 0, mx, my, mr * 1.8);
  disc.addColorStop(0, `rgba(235, 240, 255, ${0.45 * strength})`);
  disc.addColorStop(0.45, `rgba(210, 222, 255, ${0.2 * strength})`);
  disc.addColorStop(1, "rgba(210, 222, 255, 0)");
  c.fillStyle = disc;
  c.beginPath(); c.arc(mx, my, mr * 1.8, 0, Math.PI * 2); c.fill();
  // A path of light broken into short glints that ripple and twinkle
  const rows = 70, y0 = my + mr * 0.5, y1 = H * 0.66;
  for (let k = 0; k < rows; k++) {
    const f = k / rows, y = y0 + (y1 - y0) * f;
    // Each ripple row breaks into two or three glints that drift and twinkle on their own
    for (let j = 0; j < 3; j++) {
      const twinkle = Math.max(0, Math.sin(t * (1.8 + j * 0.6) + k * 2.1 + j * 2.4));
      const a = 0.38 * (1 - f) * (1 - f * 0.6) * twinkle * strength;
      if (a < 0.015) continue;
      const spread = W * (0.02 + 0.09 * f);
      const x = mx + Math.sin(t * 0.6 + k * 0.9 + j * 2.0) * spread;
      const w = W * (0.02 + 0.07 * f) * (0.6 + 0.4 * Math.sin(t * 1.1 + k * 1.7 + j));
      c.fillStyle = `rgba(228, 236, 255, ${a})`;
      c.beginPath(); c.ellipse(x, y, w / 2, 1 + f * 1.8, 0, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}
const waterClock = () => performance.now() / 1000;

function drawSwimmers() {
  const W = innerWidth, H = innerHeight, t = waterClock();
  kx.clearRect(0, 0, W, H);
  // Behind the board the light stays gentle, so the stones remain easy to read
  drawShimmer(kx, W, H, t, 0.6);
  drawFish(kx, swimmers, isNight() ? 0.6 : 0.92, isNight() ? 0.18 : 0.28);
  drawWorld(kx, W, H, t);
  drawMoonlight(kx, W, H, t, 0.7);
}
function koiLoop(now) {
  if (document.hidden) { koiPaused = true; return; }
  const dt = Math.min(0.05, (now - lastKoi) / 1000 || 0.016);
  lastKoi = now;
  // The full koi pond covers the screen, so the background can rest
  requestAnimationFrame(koiLoop);
  if (!pondOpen) {
    // With a garden above the board the koi keep to the water below it, and a big combo draws them in
    const top = sceneTop(), lure = koiAttractor();
    if (lure) lure.bits[0] = { x: lure.bits[0].x, y: lure.bits[0].y - top };
    swimmers.forEach(f => {
      f.y -= top;
      stepFish(f, dt, innerWidth, innerHeight - top, lure);
      // A koi still up by the picture (the garden just appeared) glides down into the water
      if (f.y < 0) f.y += Math.min(-f.y, 120 * dt);
      f.y += top;
    });
    drawSwimmers();
  }
}
function startKoi() {
  initKoi();
  koiImages.forEach(im => im.addEventListener("load", () => { if (reduceMotion) drawSwimmers(); }));
  if (reduceMotion) { drawSwimmers(); return; }
  lastKoi = performance.now();
  requestAnimationFrame(koiLoop);
}

/* ---------- Ripples and score words ---------- */
function ripples(lines, mono = []) {
  const wrap = $("boardWrap").getBoundingClientRect();
  lines.forEach(l => {
    const a = cellEls[l.cells[0]].getBoundingClientRect();
    const b = cellEls[l.cells[l.cells.length - 1]].getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "ripple" + (mono.includes(l) ? " gold" : "");
    el.style.left = ((a.left + b.right) / 2 - wrap.left) + "px";
    el.style.top = ((a.top + b.bottom) / 2 - wrap.top) + "px";
    $("boardWrap").appendChild(el);
    setTimeout(() => el.remove(), 950);
  });
}
// Combos climb a ladder of calm: Calm, Flow, Zen, Deep zen
const COMBO_WORDS = ["Calm", "Flow", "Zen", "Deep zen"];
function burst(pts, n, mono, freed, still) {
  const tier = Math.min(COMBO_WORDS.length, S.combo - 1);
  const word = still ? "Still water" : mono ? "Harmony" : freed ? (freed === 1 ? "Koi freed" : `${freed} koi freed`)
    : tier > 0 ? COMBO_WORDS[tier - 1] : WORDS[Math.min(WORDS.length - 1, n - 1)];
  const parts = [word];
  if (S.combo > 1) parts.push(`combo ×${S.combo}`);
  const el = document.createElement("div");
  el.className = "burst" + (mono || freed || still ? " gold" : "") + (S.combo > 1 ? ` combo tier${Math.min(3, tier)}` : "");
  el.innerHTML = `<b>+${pts}</b><span>${parts.join(" · ")}</span>`;
  $("boardWrap").appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
function toast(text) {
  const el = document.createElement("div");
  el.className = "burst gold";
  el.style.top = "18%";
  el.innerHTML = `<span>${text}</span>`;
  $("boardWrap").appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
