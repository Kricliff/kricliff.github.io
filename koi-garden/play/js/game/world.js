// Koi Garden: The world around the board. Each chapter's scene, its weather and time of day, surprises in the water,
// the bigger moments when lines clear, and the board answering the finger.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Scenes ----------
   Every chapter plays in its own garden: the restored garden picture (img/garden/) shows above the board and fades
   into the pond, the water takes the chapter's colour, and something drifts in the air. Through a chapter the day
   goes on: levels 1-5 of it in daylight, 6-10 in the golden afternoon, 11-15 at dusk with lanterns. Some levels
   bring a light rain. Daily has a garden of the day, and Endless walks on to the next garden every 600 points. */
const SCENES = [
  { id: "koi-pond", name: "Koi Pond", air: "pollen", water: ["#0f5a5e", "#0a3c43", "#1d8a83"] },
  { id: "bamboo-grove", name: "Bamboo Grove", air: "bamboo", water: ["#16584a", "#0b382e", "#2f8a64"] },
  { id: "lotus-lake", name: "Lotus Lake", air: "pollen", water: ["#1d5361", "#11343f", "#3d8794"] },
  { id: "moon-bridge", name: "Moon Bridge", air: "fireflies", water: ["#173f68", "#0b2343", "#2f5f98"] },
  { id: "cherry-hill", name: "Cherry Hill", air: "petals", water: ["#145b68", "#0a3a45", "#2c8e8f"] },
  { id: "mountain-spring", name: "Mountain Spring", air: "maple", water: ["#1f4f60", "#11313e", "#3a7c8c"] },
  { id: "tea-house", name: "Tea House", air: "petals", water: ["#24584b", "#143a31", "#4a8a6c"] },
  { id: "maple-valley", name: "Maple Valley", air: "maple", water: ["#2a4c4f", "#173133", "#6c7552"] },
  { id: "snow-temple", name: "Snow Temple", air: "snow", water: ["#245470", "#13344a", "#5a90ac"] },
  { id: "golden-pagoda", name: "Golden Pagoda", air: "sparkle", water: ["#1b4d4a", "#0d2f2d", "#7d7a3e"] }
];
const ENDLESS_SCENE_EVERY = 600;
// Chapters 1-10 have their own garden; after that the journey loops through chapters 2-10, as their names do
const sceneOfChapter = c => c <= SCENES.length ? c - 1 : (c - 11) % (SCENES.length - 1) + 1;
const PHASES = ["day", "gold", "dusk"];
function sceneNowFor(st) {
  if (!st) return null;
  if (st.mode === "journey") {
    const c = chapterOf(st.level), i = (st.level - 1) % PER_CHAPTER;
    const rnd = seeded(hashSeed("weather-" + st.level));
    const k = st.tut ? 0 : sceneOfChapter(c), sc = SCENES[k];
    const rain = !st.tut && !["snow", "fireflies"].includes(sc.air) && rnd() < 0.22;
    return { k, phase: st.tut ? "day" : PHASES[Math.floor(i / 5)], rain };
  }
  if (st.mode === "daily") {
    const k = (st.num || 0) % SCENES.length;
    return { k, phase: "day", rain: false };
  }
  return { k: Math.floor((st.score || 0) / ENDLESS_SCENE_EVERY) % SCENES.length, phase: "day", rain: false };
}

// The layers: two pictures that cross-fade, and a wash of light for the afternoon and dusk
const sceneEl = document.createElement("div");
sceneEl.className = "scene";
sceneEl.id = "scene";
sceneEl.setAttribute("aria-hidden", "true");
sceneEl.innerHTML = '<i class="scene-pic"></i><i class="scene-pic"></i><b class="sky gold"></b><b class="sky dusk"></b><b class="sky rain"></b>';
document.body.insertBefore(sceneEl, koiCanvas);
const scenePics = [...sceneEl.querySelectorAll(".scene-pic")];
let sceneKey = "", scenePic = 0, sceneInfo = null;
const sceneImg = k => `img/garden/${SCENES[k].id}-done.webp`;
function applyScene(force) {
  const sc = sceneNowFor(S);
  const key = sc ? `${sc.k}|${sc.phase}|${sc.rain}` : "";
  if (key === sceneKey && !force) return;
  const was = sceneInfo;
  sceneKey = key;
  sceneInfo = sc;
  const root = document.documentElement;
  if (!sc) { delete root.dataset.scene; return; }
  const s = SCENES[sc.k];
  root.dataset.scene = s.id;
  root.style.setProperty("--scene-water", s.water[0]);
  root.style.setProperty("--scene-deep", s.water[1]);
  root.style.setProperty("--scene-hi", s.water[2]);
  // A new garden fades in over the old one
  if (!was || was.k !== sc.k) {
    const next = scenePics[1 - scenePic], cur = scenePics[scenePic];
    next.style.backgroundImage = `url(${sceneImg(sc.k)})`;
    const show = () => { next.classList.add("on"); cur.classList.remove("on"); scenePic = 1 - scenePic; };
    const im = new Image();
    im.onload = show;
    im.onerror = show;
    im.src = sceneImg(sc.k);
    // A new garden in Endless is worth a word
    if (was && S && S.mode === "endless" && !S.over) setTimeout(() => toast(`On to ${s.name}`), 300);
  }
  sceneEl.dataset.phase = sc.phase;
  sceneEl.classList.toggle("raining", !!sc.rain);
  setAir(s.air, sc.phase, sc.rain);
}
// How far down the picture reaches: a little past the top of the board
function sizeScene() {
  const b = boardEl.getBoundingClientRect();
  if (!b.height) return;
  document.documentElement.style.setProperty("--scene-h", Math.round(b.top + b.height * 0.22) + "px");
}
// The water starts about where the picture has faded; the background koi keep below it
const sceneTop = () => sceneInfo && !reduceMotion ? Math.max(0, boardEl.getBoundingClientRect().top - 30) : 0;

/* ---------- What drifts in the air, and the rain ----------
   Drawn on the koi layer behind the app, so it shows around the board and through the glass of the tray. */
const worldAir = { kind: null, list: [], rain: false, drops: [], rings: [], ringIn: 0, glows: [], last: 0 };
const worldImages = {};
function worldImage(src) {
  if (!worldImages[src]) { worldImages[src] = new Image(); worldImages[src].src = src; }
  return worldImages[src];
}
function setAir(kindName, phase, rain) {
  const kind = AIR[kindName] || null;
  if (kind && kind.img) worldImage(kind.img);
  const W = innerWidth, H = innerHeight;
  const calm = prefs.calm ? 0.5 : 1;
  if (worldAir.kindName !== kindName) {
    worldAir.kindName = kindName;
    worldAir.kind = kind;
    worldAir.list = kind ? [...Array(Math.round(kind.n * calm))].map(() => airBit(kind, W, H, false)) : [];
  }
  // Lantern light at dusk: a few warm, soft glows that drift slowly
  worldAir.glows = phase === "dusk" ? [...Array(Math.round(7 * calm))].map(() => ({ x: Math.random() * W, y: Math.random() * H,
    r: 10 + Math.random() * 16, ph: Math.random() * 6.3 })) : [];
  worldAir.rain = !!rain;
  worldAir.drops = rain ? [...Array(Math.round(46 * calm))].map(() => ({ x: Math.random() * W, y: Math.random() * H, v: 520 + Math.random() * 260, l: 9 + Math.random() * 10 })) : [];
  worldAir.rings = [];
}
const airRand = (lo, hi) => lo + Math.random() * (hi - lo);
function airBit(kind, W, H, top) {
  return { x: airRand(0, W), y: top ? airRand(-40, -5) : airRand(0, H), s: airRand(kind.size[0], kind.size[1]) * 1.25,
    v: kind.fall ? airRand(kind.fall[0], kind.fall[1]) * 2.2 : 0, rot: airRand(0, 6.3), spin: airRand(-1.5, 1.5), ph: airRand(0, 6.3) };
}
// Petals, leaves, snow or fireflies drifting over a canvas: used round the board and on the map
function drawAirBits(c, kind, list, W, H, dt, now) {
  if (kind) list.forEach((p, i) => {
    if (kind.float) {
      p.ph += dt * 0.6;
      p.x += Math.cos(p.ph + i) * dt * 9;
      p.y += Math.sin(p.ph * 0.8 + i) * dt * 7;
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) Object.assign(p, airBit(kind, W, H, false));
    } else {
      p.y += p.v * dt;
      p.x += Math.sin(now / 1100 + p.ph) * dt * 14 + dt * 5;
      p.rot += p.spin * dt;
      if (p.y > H + 20 || p.x > W + 20) Object.assign(p, airBit(kind, W, H, true));
    }
    if (kind.img) {
      const im = worldImage(kind.img);
      if (!im.complete || !im.naturalWidth) return;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.rot * 1.3)));
      c.globalAlpha = 0.85;
      c.drawImage(im, -p.s / 2, -p.s / 2, p.s, p.s);
      c.restore();
    } else if (kind.sliver) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = kind.colour;
      c.globalAlpha = 0.8;
      c.beginPath();
      c.ellipse(0, 0, p.s / 2, p.s / 7, 0, 0, 6.283);
      c.fill();
      c.restore();
    } else {
      const tw = kind.glow ? 0.45 + 0.55 * Math.max(0, Math.sin(now / 700 + p.ph * 3)) : 1;
      c.globalAlpha = (kind.faint ? 0.5 : 0.85) * tw;
      if (kind.glow) { c.shadowColor = kind.colour; c.shadowBlur = 10; }
      c.fillStyle = kind.colour;
      c.beginPath();
      c.arc(p.x, p.y, p.s, 0, 6.283);
      c.fill();
      c.shadowBlur = 0;
    }
  });
}
function drawWorld(c, W, H, t) {
  if (!sceneInfo) return;
  const now = performance.now(), dt = Math.min(0.05, (now - (worldAir.last || now)) / 1000);
  worldAir.last = now;
  drawAirBits(c, worldAir.kind, worldAir.list, W, H, dt, now);
  // Dusk: lantern light drifting over the water
  worldAir.glows.forEach((g, i) => {
    g.ph += dt * 0.4;
    g.x += Math.cos(g.ph + i) * dt * 6;
    g.y += Math.sin(g.ph * 0.7 + i) * dt * 4 - dt * 3;
    if (g.y < -30) { g.y = H + 20; g.x = Math.random() * W; }
    const a = 0.22 + 0.12 * Math.sin(now / 900 + i * 2);
    const gr = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    gr.addColorStop(0, `rgba(255, 196, 120, ${a})`);
    gr.addColorStop(1, "rgba(255, 160, 90, 0)");
    c.globalAlpha = 1;
    c.fillStyle = gr;
    c.beginPath(); c.arc(g.x, g.y, g.r, 0, 6.283); c.fill();
  });
  if (worldAir.rain) {
    c.globalAlpha = 0.32;
    c.strokeStyle = "rgba(225, 240, 255, 1)";
    c.lineWidth = 1;
    c.beginPath();
    worldAir.drops.forEach(d => {
      d.y += d.v * dt;
      d.x -= d.v * dt * 0.12;
      if (d.y > H) { d.y = -d.l; d.x = Math.random() * (W + 60); }
      c.moveTo(d.x, d.y);
      c.lineTo(d.x + d.l * 0.12, d.y - d.l);
    });
    c.stroke();
    // Little rings where the drops meet the pond
    worldAir.ringIn -= dt;
    const top = sceneTop();
    if (worldAir.ringIn <= 0) {
      worldAir.ringIn = 0.12 + Math.random() * 0.18;
      worldAir.rings.push({ x: Math.random() * W, y: top + Math.random() * (H - top), age: 0 });
    }
    worldAir.rings = worldAir.rings.filter(r => (r.age += dt) < 1.1);
    worldAir.rings.forEach(r => {
      const k = r.age / 1.1;
      c.globalAlpha = 0.4 * (1 - k);
      c.beginPath();
      c.ellipse(r.x, r.y, 3 + k * 16, (3 + k * 16) * 0.4, 0, 0, 6.283);
      c.stroke();
    });
  }
  c.globalAlpha = 1;
}

/* ---------- Koi that answer: a tap in the water scatters them, a big combo gathers them ---------- */
let koiGather = null;
function koiAttractor() {
  if (!koiGather || performance.now() > koiGather.until) { koiGather = null; return null; }
  return { bits: [{ x: koiGather.x, y: koiGather.y }] };
}
function gatherKoi(ms) {
  const b = boardEl.getBoundingClientRect();
  koiGather = { until: performance.now() + ms, x: b.left + b.width / 2, y: b.top + b.height / 2 };
  swimmers.forEach(f => { f.vTarget = 46; f.timer = 0; });
}
function waterTap(x, y) {
  if (reduceMotion) return;
  ring("tap-ring", x, y);
  swimmers.forEach(f => {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < 170) {
      f.a = Math.atan2(f.y - y, f.x - x);
      f.turn = 0; f.turnTarget = 0;
      f.v = f.vTarget = 58;
      f.timer = 1.1;
    }
  });
  if (sfxOk()) voice(620 + Math.random() * 120, 0, 0.12, 0.018, 420);
}

/* ---------- Surprises during a round ----------
   A lucky golden koi glides over the board now and then (tap it for pearls), a dragonfly settles on an empty spot
   (cover it with a stone for pearls), and after a big move a festival lantern, moonbeam, petal or firefly floats up
   (tap it for this week's festival). None of them change the rules or the score, so levels play as tuned. */
const LUCKY_PEARLS = 5, FLY_PEARLS = 3, FLY_MOVES = 5;
const surpriseOn = () => S && !S.over && !S.tut && !reduceMotion;
let fxLater = [];
function surpriseState() { return S.surp || (S.surp = { koi: 0, lastKoi: -99, fly: 0, lastFly: -99, floats: 0 }); }
// Called after every move, with the cells just placed and what the move did
function worldMove(placedIdx, g) {
  if (!S || S.tut) return;
  const st = surpriseState();
  // The dragonfly: a stone on its spot sends it off with pearls; anything else on it just scares it away
  if (S.fly) {
    const i = S.fly.i;
    if (placedIdx.includes(i)) {
      S.fly = null;
      flyOff(i, true);
      journey.pearls += FLY_PEARLS;
      saveJourney();
      setTimeout(() => toast(`Dragonfly · +${FLY_PEARLS} pearls`), 200);
    } else if (S.board[i] || --S.fly.left <= 0) {
      S.fly = null;
      flyOff(i, false);
    }
  }
  if (S.over || reduceMotion) return;
  if (S.mode !== "daily" && !S.fly && S.placed >= 3 && S.placed - st.lastFly >= 6 && st.fly < (S.mode === "endless" ? 8 : 3) && Math.random() < 0.13) {
    const empty = [];
    for (let i = 0; i < N * N; i++) if (!S.board[i] && !(S.lotus && S.lotus[i]) && !placedIdx.includes(i)) empty.push(i);
    if (empty.length > 6) {
      S.fly = { i: empty[Math.floor(Math.random() * empty.length)], left: FLY_MOVES };
      st.fly++;
      st.lastFly = S.placed;
      if (sfxOk()) { voice(1400, 0, 0.05, 0.01, 1700); voice(1500, 0.07, 0.05, 0.01, 1800); }
    }
  }
  if (S.placed >= 4 && S.placed - st.lastKoi >= 10 && st.koi < 2 && Math.random() < 0.09) {
    st.koi++;
    st.lastKoi = S.placed;
    setTimeout(luckyKoi, 900);
  }
  if (g && (g.lines >= 2 || g.combo >= 3 || g.harmony) && st.floats < 3 && Math.random() < 0.6) {
    st.floats++;
    setTimeout(festivalFloat, 1100);
  }
}
// The lucky koi glides across the board on a gentle wave and leaves a trail of gold
function luckyKoi() {
  if (!surpriseOn() || !overlay.hidden) return;
  const b = boardEl.getBoundingClientRect(), pitch = b.width / N;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const x0 = dir > 0 ? b.left - pitch * 2 : b.right + pitch * 2, x1 = dir > 0 ? b.right + pitch * 2 : b.left - pitch * 2;
  const y0 = b.top + b.height * (0.25 + Math.random() * 0.5);
  const life = 6.5, amp = b.height * 0.12, size = pitch * 1.9;
  let trail = 0;
  spawn({ type: "lucky", x: x0, y: y0, life, g: 0, catchable: true, hit: size * 0.75, size,
    path(p, dt) {
      const k = p.t / p.life;
      const nx = x0 + (x1 - x0) * k, ny = y0 + Math.sin(k * Math.PI * 2) * amp;
      p.rot = Math.atan2(ny - p.y, nx - p.x) || (dir > 0 ? 0 : Math.PI);
      p.x = nx; p.y = ny;
      if ((trail -= dt) <= 0) {
        trail = 0.07;
        fxLater.push({ type: "spark", x: p.x - Math.cos(p.rot) * size * 0.5, y: p.y - Math.sin(p.rot) * size * 0.5, vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30, g: 0, life: 0.6, size: 3 + Math.random() * 3, color: palette.gold || "#ffc93c" });
      }
    },
    draw(c, p) {
      const k = p.t / p.life, a = Math.min(1, k * 6, (1 - k) * 6);
      c.globalAlpha = a * (0.55 + 0.15 * Math.sin(p.t * 6));
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, size * 0.75);
      gr.addColorStop(0, "rgba(255, 220, 120, 0.9)");
      gr.addColorStop(1, "rgba(255, 200, 80, 0)");
      c.fillStyle = gr;
      c.beginPath(); c.arc(0, 0, size * 0.75, 0, 6.283); c.fill();
      drawWarpedKoi(c, koiImages[3], size, p.t * 10, Math.sin(p.t * 3) * 0.3, 1, a * 0.95);
    },
    caught(p) {
      journey.pearls += LUCKY_PEARLS;
      saveJourney();
      sparkBurst(p.x, p.y, 30);
      splash(p.x, p.y, 0);
      chime(true);
      buzz([10, 30, 14]);
      toast(`Lucky koi · +${LUCKY_PEARLS} pearls`);
    } });
  if (sfxOk()) { const t = ac.currentTime; bell(hz(12), t, 0.025); bell(hz(14), t + 0.12, 0.02); }
}
// This week's festival sends something up from the board after a big move
const FLOAT_LOOK = {
  lantern: (c, p) => {
    const f = 0.85 + 0.15 * Math.sin(p.t * 9);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, `rgba(255, 190, 90, ${0.55 * f})`);
    gr.addColorStop(1, "rgba(255, 150, 60, 0)");
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 30, 0, 6.283); c.fill();
    c.fillStyle = `rgb(${Math.round(240 * f)}, ${Math.round(120 * f)}, 50)`;
    c.beginPath(); c.ellipse(0, 0, 11, 14, 0, 0, 6.283); c.fill();
    c.strokeStyle = "rgba(120, 40, 10, 0.5)"; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, 5, 14, 0, 0, 6.283); c.stroke();
    c.fillStyle = "#4a2a14";
    c.fillRect(-6, -16, 12, 3); c.fillRect(-6, 13, 12, 3);
  },
  moon: (c, p) => {
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, "rgba(220, 230, 255, 0.7)");
    gr.addColorStop(1, "rgba(180, 200, 255, 0)");
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 30, 0, 6.283); c.fill();
    c.fillStyle = "#f4f1e2"; c.beginPath(); c.arc(0, 0, 12, 0, 6.283); c.fill();
    c.fillStyle = "rgba(190, 185, 160, 0.5)";
    c.beginPath(); c.arc(-4, -3, 3, 0, 6.283); c.arc(4, 4, 2, 0, 6.283); c.fill();
  },
  sakura: (c, p) => {
    const im = worldImage("img/blossom.webp");
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, "rgba(255, 200, 225, 0.6)");
    gr.addColorStop(1, "rgba(255, 180, 210, 0)");
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 30, 0, 6.283); c.fill();
    if (im.complete && im.naturalWidth) { c.rotate(p.t * 0.8); c.drawImage(im, -15, -15, 30, 30); }
  },
  firefly: (c, p) => {
    const f = 0.5 + 0.5 * Math.max(0, Math.sin(p.t * 5));
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 28);
    gr.addColorStop(0, `rgba(255, 240, 140, ${0.35 + 0.5 * f})`);
    gr.addColorStop(1, "rgba(220, 255, 120, 0)");
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 28, 0, 6.283); c.fill();
    c.fillStyle = "#fff6b0"; c.beginPath(); c.arc(0, 0, 5, 0, 6.283); c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.45)";
    c.beginPath(); c.ellipse(-5, -4, 5, 2.5, -0.5, 0, 6.283); c.ellipse(5, -4, 5, 2.5, 0.5, 0, 6.283); c.fill();
  }
};
function festivalFloat() {
  if (!surpriseOn() || !overlay.hidden) return;
  const fest = festivalNow(), b = boardEl.getBoundingClientRect();
  const x0 = b.left + b.width * (0.2 + Math.random() * 0.6), y0 = b.bottom - b.height * 0.1, y1 = b.top - 40;
  const look = FLOAT_LOOK[fest.id];
  spawn({ type: "float", x: x0, y: y0, life: 7, g: 0, catchable: true, hit: 36,
    path(p) {
      const k = p.t / p.life;
      p.y = y0 + (y1 - y0) * k;
      p.x = x0 + Math.sin(p.t * 1.4) * 16;
      p.rot = Math.sin(p.t * 1.4) * 0.12;
    },
    draw(c, p) {
      const k = p.t / p.life;
      c.globalAlpha = Math.min(1, k * 5, (1 - k) * 4);
      c.save();
      look(c, p);
      c.restore();
      // A small tag under it says what it is worth
      c.rotate(-p.rot);
      c.font = "800 11px 'Zen Maru Gothic', system-ui, sans-serif";
      c.textAlign = "center";
      c.fillStyle = "#fff";
      c.strokeStyle = "rgba(0, 0, 0, 0.45)";
      c.lineWidth = 3;
      const tag = `+${fest.float}`;
      c.strokeText(tag, 0, 32); c.fillText(tag, 0, 32);
    },
    caught(p) {
      sparkBurst(p.x, p.y, 22);
      bowl(5, 0.04);
      buzz(12);
      festivalAdd(fest.float, true);
    } });
}
// A tap catches whatever surprise is under the finger
function catchSurprise(x, y) {
  for (const p of parts) {
    if (!p.catchable || p.delay > 0 || p.t >= p.life || p.t < 0.15) continue;
    if (Math.hypot(p.x - x, p.y - y) <= p.hit) {
      p.catchable = false;
      p.t = p.life;
      p.caught(p);
      return true;
    }
  }
  return false;
}
// When a card opens, surprises still on the way go quietly
function clearSurprises() { parts.forEach(p => { if (p.catchable) { p.catchable = false; p.t = p.life; } }); }
// The dragonfly leaves the board, darting off in a curve
const DRAGONFLY_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="rgba(200,235,255,0.7)" stroke="rgba(120,170,210,0.9)" stroke-width="0.6"><ellipse cx="13" cy="15" rx="10" ry="3.4" transform="rotate(-18 13 15)"/><ellipse cx="27" cy="15" rx="10" ry="3.4" transform="rotate(18 27 15)"/><ellipse cx="13.5" cy="21" rx="9" ry="3" transform="rotate(14 13.5 21)"/><ellipse cx="26.5" cy="21" rx="9" ry="3" transform="rotate(-14 26.5 21)"/></g><path d="M20 10v24" stroke="#2f8fb0" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="9" r="2.8" fill="#1f6f8a"/></svg>';
function flyOff(i, happy) {
  if (reduceMotion) return;
  const { x, y, w } = cellCenter(i);
  const el = document.createElement("div");
  el.className = "dragonfly-off";
  el.innerHTML = DRAGONFLY_SVG;
  el.style.cssText = `left:${x - w / 2}px;top:${y - w / 2}px;width:${w}px;height:${w}px`;
  document.body.appendChild(el);
  const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 100);
  el.animate([
    { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
    { transform: `translate(${dx * 0.3}px, -60px) rotate(${dx > 0 ? 25 : -25}deg)`, opacity: 1, offset: 0.4 },
    { transform: `translate(${dx}px, -260px) rotate(${dx > 0 ? 40 : -40}deg)`, opacity: 0 }
  ], { duration: 1100, easing: "cubic-bezier(0.4, 0, 0.6, 1)" }).onfinish = () => el.remove();
  if (happy) { sparkBurst(x, y, 16); chime(false); }
  else if (sfxOk()) voice(1500, 0, 0.06, 0.008, 1900);
}

/* ---------- Bigger moments when lines clear ---------- */
// One small koi swims out of each cleared line (three at most)
function lineKoi(lines) {
  if (reduceMotion) return;
  const own = journey.koi.filter(i => koiImages[i]);
  lines.slice(0, 3).forEach((l, k) => {
    const cells = l.cells.filter(i => S.board[i] !== HOLE);
    const { x, y, w } = cellCenter(cells[Math.floor(cells.length / 2)]);
    const img = own.length ? own[Math.floor(Math.random() * own.length)] : [0, 3, 4][k];
    const a = Math.random() * Math.PI * 2;
    spawn({ type: "koi", img, x, y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 90 - 40, g: -160, drag: 0.99, life: 1.5,
      size: w * 0.34, phase: Math.random() * 6, delay: 0.32 + k * 0.08 });
  });
}
// The combo ladder grows outward: rings round the board, the koi gather, and at ×6 koi leap over the whole screen
function comboFx(combo) {
  if (reduceMotion || combo < 2) return;
  boardPulse(Math.min(3, combo - 1));
  if (combo >= 4) gatherKoi(3500);
  if (combo >= 6 && combo % 2 === 0) setTimeout(megaLeap, 350);
}
function boardPulse(k) {
  const b = boardEl.getBoundingClientRect();
  for (let j = 0; j < k; j++) setTimeout(() => {
    const el = document.createElement("div");
    el.className = "board-pulse";
    el.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }, j * 150);
}
function megaLeap() {
  if (reduceMotion) return;
  const own = journey.koi.filter(i => koiImages[i]);
  const W = innerWidth, H = innerHeight;
  [0, 1, 2].forEach(k => {
    const dir = k % 2 ? -1 : 1, T = 1.5 + k * 0.12, g = 1100;
    const x0 = dir > 0 ? W * (0.02 + k * 0.08) : W * (0.98 - k * 0.08), y0 = H * (0.82 - k * 0.04);
    const vx = dir * W * (0.7 - k * 0.1) / T;
    const delay = k * 0.22;
    const img = own.length ? own[(k * 5) % own.length] : [3, 0, 4][k];
    splash(x0, y0, delay);
    spawn({ type: "leap", x: x0, y: y0, vx, vy: -g * T / 2, g, drag: 1, life: T, size: W * (0.1 - k * 0.012), img, phase: k * 2, delay });
    splash(x0 + vx * T, y0, delay + T - 0.08);
    sfxSplash(delay);
  });
  buzz([16, 40, 16, 40, 24]);
}
// The win shower matches the garden: petals, maple leaves, snow, fireflies or gold
function celebrate() {
  const kindName = sceneInfo ? SCENES[sceneInfo.k].air : "petals";
  if (kindName === "petals" || kindName === "pollen" || !AIR[kindName]) { petals(); return; }
  const kind = AIR[kindName];
  const W = innerWidth, H = innerHeight;
  const n = kind.img ? 60 : 80;
  for (let k = 0; k < n; k++) {
    if (kind.float) {
      // Fireflies and gold rise from below
      spawn({ type: "glow", x: Math.random() * W, y: H * (0.6 + Math.random() * 0.45), vx: (Math.random() - 0.5) * 30, vy: -(40 + Math.random() * 70),
        g: 0, drag: 1, life: 2.6 + Math.random() * 1.4, size: 2 + Math.random() * 3, color: kind.colour, phase: Math.random() * 6, delay: Math.random() * 1.2,
        draw: drawGlowBit });
    } else {
      const im = kind.img ? worldImage(kind.img) : null;
      spawn({ type: "petal", x: Math.random() * W, y: -20 - Math.random() * 80, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90, g: 25, drag: 0.995,
        life: 3.2 + Math.random() * 1.2, size: (kind.img ? 9 : 3) + Math.random() * 5, color: kind.colour || "#fff", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 5,
        phase: Math.random() * 6, delay: Math.random() * 0.9, draw: im ? (c, p) => { if (im.complete) c.drawImage(im, -p.size, -p.size, p.size * 2, p.size * 2); } : null });
    }
  }
}
function drawGlowBit(c, p) {
  const tw = 0.5 + 0.5 * Math.max(0, Math.sin(p.t * 6 + p.phase));
  c.globalAlpha *= tw;
  c.shadowColor = p.color;
  c.shadowBlur = 10;
  c.fillStyle = p.color;
  c.beginPath(); c.arc(0, 0, p.size, 0, 6.283); c.fill();
  c.shadowBlur = 0;
}
// A soft ring in the water follows the finger while a piece is dragged
let trailAt = 0;
function dragTrail(x, y) {
  const now = performance.now();
  if (now - trailAt < 95) return;
  trailAt = now;
  spawn({ type: "trail", x, y, vx: 0, vy: 0, g: 0, life: 0.7, size: 6,
    draw(c, p) {
      const k = p.t / p.life;
      c.globalAlpha = 0.35 * (1 - k);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, 6 + k * 22, (6 + k * 22) * 0.45, 0, 0, 6.283); c.stroke();
    } });
}
// The stones round a newly placed piece make room for it, a few pixels each way
let nudged = new Map();
function nudgeAround(placedIdx) {
  if (reduceMotion || prefs.calm) return;
  const placed = new Set(placedIdx);
  nudged = new Map();
  placedIdx.forEach(i => {
    const r = Math.floor(i / N), c = i % N;
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
      const r2 = r + dr, c2 = c + dc, j = r2 * N + c2;
      if (r2 < 0 || c2 < 0 || r2 >= N || c2 >= N || placed.has(j) || !S.board[j] || S.board[j] === HOLE) return;
      nudged.set(j, [dc, dr]);
    });
  });
  setTimeout(() => { nudged = new Map(); }, 380);
}

/* ---------- Taps ---------- */
window.addEventListener("pointerdown", e => {
  if (!S || !overlay.hidden || drag || !homeEl.hidden || !$("mapView").hidden || pondOpen || !$("gardenView").hidden) return;
  if (e.target.closest("button, .slot, .float, .joker-float")) return;
  if (catchSurprise(e.clientX, e.clientY)) { e.preventDefault(); return; }
  // A tap in the water around the board: a ripple, and the koi nearby dart away
  if (!e.target.closest(".board, header, .below, .tray, .banner")) waterTap(e.clientX, e.clientY);
});
addEventListener("resize", () => { sizeScene(); if (sceneInfo) setAir(SCENES[sceneInfo.k].air, sceneInfo.phase, sceneInfo.rain); });
