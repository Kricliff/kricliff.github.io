// Koi Garden: Drawing the board and tray, previews, dragging pieces and making moves.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Render ---------- */
let shownScore = 0, scoreAnim = null;
// In a Journey level with a goal other than points (free koi, clear stones, lotus, frogs, Harmony, bamboo) the
// header shows that goal instead of the score: how many are done and how many are left. Points still give the stars.
const goalHead = () => S && S.mode === "journey" && !S.tut && levelDef(S.level).goal !== "score";
// What is left, in a word or two: "3 koi left", "1 Harmony left"
const GOAL_HEAD = { koi: ["koi", "koi", "all koi free"], harmony: ["Harmony", "Harmony", "all Harmony made"], clear: ["stone", "stones", "all stones cleared"],
  lotus: ["lotus", "lotus", "all lotus picked"], frog: ["frog", "frogs", "all frogs home"] };
let shownGoal = "";
function paintGoalHead() {
  const L = levelDef(S.level), t = goalTarget(L), el = $("score");
  cancelAnimationFrame(scoreAnim);
  el.classList.remove("rolling");
  let big, label;
  if (L.goal === "bamboo") {
    const left = bambooLeft();
    big = String(left);
    label = left ? "bamboo left" : "all clear";
  } else {
    const got = Math.min(goalProgress(), t), left = t - got;
    big = `${got}<small>/${t}</small>`;
    const w = GOAL_HEAD[L.goal];
    label = left ? `${left} ${w[left === 1 ? 0 : 1]} left` : w[2];
  }
  const key = `${S.level}|${big}`;
  if (key !== shownGoal) {
    // Each koi freed (or stone cleared, flower picked…) bumps the number, but not the first paint of a level
    if (shownGoal.split("|")[0] === String(S.level)) restartClass(el, "bump");
    shownGoal = key;
    el.innerHTML = big;
  }
  $("bestLabel").textContent = label;
  $("best").textContent = "";
  shownScore = S.score;
}
function paintScore() {
  $("score").classList.toggle("goal", goalHead());
  if (goalHead()) { paintGoalHead(); return; }
  shownGoal = "";
  const target = S.score;
  cancelAnimationFrame(scoreAnim);
  const from = shownScore, t0 = performance.now();
  // Big gains roll up for longer, so a big clear is felt in the score too
  const dur = Math.min(1100, 350 + Math.max(0, target - from) * 2.5);
  $("score").classList.toggle("rolling", target - from >= 80 && !reduceMotion);
  const stepFn = now => {
    const k = Math.min(1, (now - t0) / dur);
    shownScore = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
    $("score").textContent = shownScore;
    if (k < 1) scoreAnim = requestAnimationFrame(stepFn);
    else $("score").classList.remove("rolling");
  };
  if (from === target) $("score").textContent = target;
  else scoreAnim = requestAnimationFrame(stepFn);
}
// Under the score in a Journey level: the scores for two and three stars, lit once reached.
// Pieces and jokers left still add their points on the win card, so the stars can come at the very end too.
function paintStarGoals() {
  const el = $("starGoals"), L = S.mode === "journey" && !S.tut ? levelDef(S.level) : null;
  el.hidden = !(L && L.s2);
  if (el.hidden) return;
  // With a goal in the header there are no points to compare with, so the stars simply light up: the first for the
  // goal, the next two for a high score (pieces and jokers left still add theirs at the end)
  el.classList.toggle("lamps", goalHead());
  if (goalHead()) {
    const lit = !goalMet() ? 0 : S.score >= L.s3 ? 3 : S.score >= L.s2 ? 2 : 1;
    el.innerHTML = [0, 1, 2].map(k => `<span class="${k < lit ? "got" : ""}">★</span>`).join("");
    el.setAttribute("aria-label", `${lit} of 3 stars so far`);
    return;
  }
  el.removeAttribute("aria-label");
  const goal = (n, at) => `<span class="${S.score >= at ? "got" : ""}">${"★".repeat(n)} ${at}</span>`;
  el.innerHTML = goal(2, L.s2) + goal(3, L.s3);
}
// The combo ladder: the board glows warmer with every step, and a chip shows the combo and the misses it has left
function paintCombo() {
  const k = Math.min(5, S.combo || 0), chip = $("comboChip");
  $("boardWrap").dataset.combo = k >= 2 ? k : 0;
  chip.hidden = k < 2;
  if (k < 2) return;
  chip.querySelector("b").textContent = `Combo ×${S.combo}`;
  [...chip.querySelectorAll("i")].forEach((dot, j) => dot.classList.toggle("used", j < (S.miss || 0)));
}
function render() {
  paintCombo();
  // In "clear the starting stones" levels, mark those stones so they stand out from your own
  const markStart = S.mode === "journey" && levelDef(S.level).goal === "clear" && S.preset;
  cellEls.forEach((el, i) => {
    // Water in a shaped board: no stone, no line, just the pond showing through
    if (S.board[i] === HOLE) {
      el.className = "cell hole";
      el.style.setProperty("--c", "transparent");
      el.style.setProperty("--img", "none");
      el.style.removeProperty("--rad");
      return;
    }
    const v = S.board[i] || clearing[i];
    el.className = "cell" + (v ? " filled" : "") + (clearing[i] ? " pop" : "")
      + (v === FROG ? " frog" : "") + (v === LEAF ? " leaf" : "") + (S.blossom && S.blossom[i] && S.board[i] ? " blossom" : "")
      + (hopTo.has(i) && v === FROG ? " hop" : "") + (i === leafAt ? " leaf-fall" : "")
      + (v === KOI ? " koi" : "") + (v === BAMBOO ? " bamboo" : "") + (S.lotus && S.lotus[i] ? " lotus" : "") + (i === grewAt ? " sprout" : "")
      + (S.ice && S.ice[i] && S.board[i] ? " ice" : "")
      + (S.tut === 1 && i === TUT_GAP && !v ? " target" : "")
      + (justPlaced.has(i) && !clearing[i] ? " drop" : "") + (i === fellAt ? " fall" : "") + (hintCells.has(i) ? " hintspot" : "")
      + (markStart && S.preset[i] && S.board[i] ? " start" : "")
      + (nudged.has(i) && v && !clearing[i] ? " nudge" : "") + (S.fly && S.fly.i === i && !v ? " dragonfly" : "");
    if (nudged.has(i)) { el.style.setProperty("--nx", nudged.get(i)[0]); el.style.setProperty("--ny", nudged.get(i)[1]); }
    if (clearing[i]) { el.style.setProperty("--d", (clearDelay[i] || 0) + "ms"); el.style.setProperty("--spin", ((i * 37) % 30 - 15) + "deg"); }
    el.style.setProperty("--c", v ? `var(--p${v})` : "transparent");
    el.style.setProperty("--img", v ? `var(--i${v})` : "none");
    if (v) el.style.setProperty("--rad", `var(--r${v})`); else el.style.removeProperty("--rad");
  });
  BEDS.forEach((b, k) => {
    const filled = b.cells.filter(i => S.board[i]);
    const near = filled.length >= 7 && filled.length < 9;
    const colours = new Set(filled.map(i => S.board[i]).filter(v => v !== HOLE));
    bedEls[k].classList.toggle("near", near);
    bedEls[k].classList.toggle("mono", near && colours.size === 1 && [...colours][0] <= COLORS);
  });
  renderTray();
  paintScore();
  applyScene();
  if (S.mode === "journey" && goalHead()) { /* the goal is in the header, painted by paintScore() */ }
  else if (S.mode === "journey") { $("bestLabel").textContent = "Level"; $("best").textContent = S.level; }
  else if (S.mode === "daily") { $("bestLabel").textContent = "Best"; $("best").textContent = Math.max(daily.best[S.day] || 0, S.practice ? 0 : S.score); }
  else { $("bestLabel").textContent = "Best"; $("best").textContent = Math.max(best, S.score); }
  paintStarGoals();

  const pill = $("pill");
  pill.hidden = S.mode === "endless";
  if (S.mode === "daily") {
    const left = DAILY_PIECES - S.dealt + S.tray.filter(Boolean).length;
    pill.innerHTML = `${S.practice ? "Practice" : `#${S.num}`} <span class="dim">· ${left} ${left === 1 ? "piece" : "pieces"} left</span>`;
  } else if (S.mode === "journey") {
    const left = piecesLeft();
    const L = levelDef(S.level);
    // On bamboo boards the pill counts down to the next growth
    const grow = L.grow && bambooLeft() ? ` <span class="dim">· grows in ${S.growIn}</span>` : "";
    // When the goal is in the header, the pill says which level this is instead
    pill.innerHTML = `${goalHead() ? `Level ${S.level}` : goalShort()} <span class="dim">· ${left} ${left === 1 ? "piece" : "pieces"}</span>${grow}`;
  }
  const playing = !S.over && !S.tut && S.mode !== "daily";
  const icon = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const price = cost => journey.pearls >= cost ? `<span class="cost">${cost}</span>` : `<span class="tag">Ad</span>`;
  const hintB = $("hintBtn");
  hintB.hidden = !playing;
  hintB.innerHTML = icon('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>') + price(HINT_COST);
  hintB.setAttribute("aria-label", journey.pearls >= HINT_COST ? `Hint for ${HINT_COST} pearls` : "Hint after a short video");
  const undo = $("undoBtn");
  undo.hidden = !(playing && S.prev && S.undoLeft > 0);
  undo.innerHTML = icon('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>') + `<span class="tag">Ad</span><span class="dim">${S.undoLeft || 0}</span>`;
  undo.setAttribute("aria-label", `Undo after a short video, ${S.undoLeft || 0} left`);
  const swap = $("swapBtn");
  swap.hidden = !(playing && S.mode === "journey");
  swap.innerHTML = icon('<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>') + price(SWAP_COST);
  swap.setAttribute("aria-label", journey.pearls >= SWAP_COST ? `Swap pieces for ${SWAP_COST} pearls` : "Swap pieces after a short video");
  updateModes();

  const hint = $("hint");
  // Room is tight next to the helper buttons, so the tip shows only when they are hidden
  hint.hidden = playing && S.mode !== "endless" ? true : playing && !!S.prev;
  if (S.tut === 1) hint.innerHTML = "<b>Fill the glowing square.</b> Drag the single stone into the gap.";
  else if (S.tut === 2) hint.innerHTML = "Rows and columns clear too. <b>Tap a piece to rotate it.</b>";
  else if (S.combo > 1) hint.innerHTML = `Combo <b>×${S.combo}</b> · clear again within 3 moves`;
  else if (S.mode === "journey") hint.textContent = goalText(levelDef(S.level));
  else if (S.mode === "daily") hint.textContent = S.practice ? "Practice. Your official score stays." : "Same pieces for everyone today.";
  else hint.textContent = "Fill a row, a column or a 3×3 square.";
}
function pieceEl(sh, color, size, gap) {
  const el = document.createElement("div");
  el.className = "piece";
  el.style.cssText = `--w:${sh.w};--h:${sh.h};--s:${size}px;--g:${gap}px;${colorVars(color)}`;
  sh.grid.forEach(row => [...row].forEach(ch => {
    const i = document.createElement("i");
    if (ch !== "x") i.className = "e";
    el.appendChild(i);
  }));
  return el;
}
function renderTray() {
  const m = metrics();
  const k = prefs.big ? 1 : 0.72, room = prefs.big ? 4.6 : 5.8;
  const s = Math.max(10, Math.min(m.cell * k, slots[0].clientWidth / room, slots[0].clientHeight / room));
  slots.forEach((slot, i) => {
    slot.innerHTML = "";
    slot.className = "slot";
    const p = S.tray[i];
    if (!p) { slot.removeAttribute("aria-label"); return; }
    const sh = parse(p.g);
    const pe = pieceEl(sh, p.c, s, Math.max(2, s * 0.1));
    if (entering.has(i)) pe.classList.add("enter");
    slot.appendChild(pe);
    slot.classList.add("has");
    if (i === hintSlot) slot.classList.add("hinted");
    // Grey out only when no rotation fits; point at the rotate mark when a turn would help
    if (!anyFit(sh)) slot.classList.add(fitsAnyTurn(p.g) ? "turn" : "nofit");
    slot.setAttribute("aria-label", `Piece with ${sh.cells.length} stones. Tap to rotate, drag to place.`);
  });
  entering.clear();
  renderJoker();
}
function renderJoker() {
  if (!S.jokers) S.jokers = [];
  const top = S.jokers[0];
  jokerSlot.className = "slot joker-slot" + (top ? " j-" + top : " empty");
  if (!top) {
    const shop = S.mode === "journey" && !S.tut;
    jokerSlot.innerHTML = '<span class="joker-name">Joker</span>' + (shop ? '<span class="joker-buy">+ Buy</span>' : "");
    jokerSlot.setAttribute("aria-label", shop ? "Joker koi: none yet. Tap to buy one with pearls, or clear two lines at once to earn one." : "Joker koi: none yet. Clear two lines at once to earn one.");
    return;
  }
  const j = JOKERS[top];
  jokerSlot.innerHTML = `<img src="${ALL_KOI[j.koi].img}" alt=""><span class="joker-name">${j.name}</span><span class="joker-does">${j.short}</span>`
    + (S.jokers.length > 1 ? `<span class="joker-count">×${S.jokers.length}</span>` : "");
  jokerSlot.setAttribute("aria-label", `${j.name}: ${j.does}. Drag it onto an empty cell.`);
}
function metrics() {
  const a = cellEls[0].getBoundingClientRect();
  const b = cellEls[1].getBoundingClientRect();
  return { left: a.left, top: a.top, cell: a.width, pitch: b.left - a.left, gap: b.left - a.right };
}
function layout() {
  const app = $("app");
  const cs = getComputedStyle(app);
  const w = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
  const h = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    - $("header").offsetHeight - $("banner").offsetHeight - $("below").offsetHeight - 12 * 4 - 14;
  const size = Math.floor(Math.max(220, Math.min(w, 450, h / 1.36)));
  document.documentElement.style.setProperty("--board", size + "px");
  if (S) renderTray();
  requestAnimationFrame(sizeScene);
}

/* ---------- Preview ---------- */
let previewed = [];
function clearPreview() {
  if (aimEls.length) clearJokerAim();
  previewed.forEach(el => {
    el.classList.remove("ghost", "glow", "rainbow-hit", "aim", "aim-arrow");
    if (!el.classList.contains("filled")) el.style.setProperty("--c", "transparent");
  });
  previewed = [];
}
function showPreview(sh, color, r, c) {
  clearPreview();
  const sim = S.board.slice();
  sh.cells.forEach(([dr, dc]) => {
    const i = (r + dr) * N + c + dc;
    sim[i] = color;
    const el = cellEls[i];
    el.classList.add("ghost");
    el.style.setProperty("--c", `var(--p${color})`);
    el.style.setProperty("--rad", `var(--r${color})`);
    previewed.push(el);
  });
  lineCells(fullLines(sim)).forEach(i => { if (sim[i] !== HOLE) { cellEls[i].classList.add("glow"); previewed.push(cellEls[i]); } });
}

/* ---------- Tap to rotate, drag to place ---------- */
let drag = null;
trayEl.addEventListener("pointerdown", e => {
  const slot = e.target.closest(".slot");
  if (!slot || S.over || !overlay.hidden || drag) return;
  const joker = slot === jokerSlot;
  const i = joker ? -1 : +slot.dataset.i;
  // An empty gold slot in the Journey opens the joker shop
  if (joker && !(S.jokers && S.jokers.length)) { if (S.mode === "journey" && !S.tut) openJokerShop(); return; }
  if (!joker && !S.tray[i]) return;
  audioInit();
  drag = { i, joker, slot, pid: e.pointerId, sx: e.clientX, sy: e.clientY, started: false, pos: null };
  try { slot.setPointerCapture(e.pointerId); } catch (err) {}
});
trayEl.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 7) return;
    beginFloat(e);
  }
  moveDrag(e);
});
function releasePointer(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  if (drag.started) endDrag(true);
  else if (drag.joker) { drag = null; openJokerCard(S.jokers[0]); }
  else { const i = drag.i; drag = null; rotatePiece(i); }
}
// Puts a piece that is being dragged back in the tray
function cancelDrag() {
  if (!drag) return;
  if (drag.started) endDrag(false); else drag = null;
}
trayEl.addEventListener("pointerup", releasePointer);
trayEl.addEventListener("pointercancel", e => { if (drag && e.pointerId === drag.pid) cancelDrag(); });
// iOS can take the finger away mid-drag without a pointerup (a notification, Control Center, a swipe from the edge, a
// second finger). Without these the game kept waiting for the release and ignored every other tap.
window.addEventListener("pointerup", releasePointer);
trayEl.addEventListener("lostpointercapture", e => { if (drag && e.pointerId === drag.pid) cancelDrag(); });
window.addEventListener("pointerdown", e => { if (drag && e.pointerId !== drag.pid) cancelDrag(); }, true);
window.addEventListener("blur", cancelDrag);
document.addEventListener("visibilitychange", () => { if (document.hidden) cancelDrag(); });

function beginFloat(e) {
  if (drag.joker) {
    const m = metrics();
    const fl = document.createElement("div");
    fl.className = "joker-float";
    fl.style.width = fl.style.height = m.cell + "px";
    fl.innerHTML = `<img src="${ALL_KOI[JOKERS[S.jokers[0]].koi].img}" alt="">`;
    document.body.appendChild(fl);
    Object.assign(drag, { started: true, fl, w: m.cell, h: m.cell, m, type: S.jokers[0], lift: e.pointerType === "mouse" ? m.cell / 2 : m.cell + 40 });
    drag.slot.classList.add("picked");
    return;
  }
  const p = S.tray[drag.i];
  const sh = parse(p.g);
  const m = metrics();
  const fl = pieceEl(sh, p.c, m.cell, m.gap);
  fl.classList.add("float");
  document.body.appendChild(fl);
  const w = sh.w * m.pitch - m.gap, h = sh.h * m.pitch - m.gap;
  Object.assign(drag, { started: true, p, sh, fl, w, h, m, lift: e.pointerType === "mouse" ? h / 2 : h + 30 });
  drag.slot.classList.add("picked");
  lift();
}
function moveDrag(e) {
  const x = e.clientX - drag.w / 2, y = e.clientY - drag.lift;
  dragTrail(e.clientX, e.clientY);
  drag.fl.style.transform = `translate(${x}px, ${y}px)`;
  const c = Math.round((x - drag.m.left) / drag.m.pitch);
  const r = Math.round((y - drag.m.top) / drag.m.pitch);
  if (drag.joker) {
    const ok = r >= 0 && c >= 0 && r < N && c < N && !S.board[r * N + c];
    if (ok && (!drag.pos || drag.pos[0] !== r || drag.pos[1] !== c)) showJokerPreview(drag.type, r, c);
    if (!ok && drag.pos) clearPreview();
    drag.pos = ok ? [r, c] : null;
    return;
  }
  if (fits(drag.sh, r, c)) {
    if (!drag.pos || drag.pos[0] !== r || drag.pos[1] !== c) showPreview(drag.sh, drag.p.c, r, c);
    drag.pos = [r, c];
  } else {
    if (drag.pos) clearPreview();
    drag.pos = null;
  }
}
function endDrag(dropIt) {
  const d = drag;
  drag = null;
  clearPreview();
  d.fl.remove();
  d.slot.classList.remove("picked");
  if (dropIt && d.pos) (d.joker ? useJoker(d.pos[0], d.pos[1]) : place(d.i, d.pos[0], d.pos[1]));
  else if (dropIt) nope();
}
function rotatePiece(i) {
  const p = S.tray[i];
  if (!p || S.over) return;
  p.g = rotateGrid(p.g);
  tick();
  render();
  const el = slots[i].querySelector(".piece");
  if (el) el.classList.add("spin");
  if (S.tut === 2) finishTutorial();
}

/* ---------- Moves ---------- */
// Frogs hop and leaves fall on their own count of moves. Neither can be undone away.
function moveTheGarden() {
  const L = levelDef(S.level);
  if (L.hop && S.board.includes(FROG) && --S.hopIn <= 0) {
    S.hopIn = L.hop;
    const hops = KL.hopFrogs(S.board, Math.random);
    if (hops.length) {
      S.prev = null;
      hopTo = new Set(hops.map(h => h[1]));
      setTimeout(() => { hopTo = new Set(); }, 600);
      if (sfxOk()) voice(480, 0, 0.05, 0.035, 620);
    }
  }
  if (L.fall && --S.fallIn <= 0) {
    S.fallIn = L.fall;
    const j = KL.dropLeaf(S.board, Math.random);
    if (j >= 0) {
      S.prev = null;
      leafAt = j;
      setTimeout(() => { leafAt = -1; }, 900);
      rustle();
    }
  }
}
function snapshotMove() {
  return { board: S.board.slice(), tray: S.tray.map(p => p && { g: p.g.slice(), c: p.c }), score: S.score,
    combo: S.combo, miss: S.miss, clears: S.clears, harmony: S.harmony, placed: S.placed,
    dealt: S.dealt, koi: S.koi, preset: S.preset && { ...S.preset }, ice: S.ice && { ...S.ice }, jokers: (S.jokers || []).slice(),
    lotus: S.lotus && { ...S.lotus }, lotusGot: S.lotusGot, growIn: S.growIn,
    blossom: S.blossom && { ...S.blossom }, frogs: S.frogs, hopIn: S.hopIn, fallIn: S.fallIn };
}
// A basket gift is used up once the level is really played
function spendGift() {
  if (S.gift && journey.gift) { journey.gift = ""; saveJourney(); }
  S.gift = "";
}
function place(slot, r, c) {
  if (S.mode !== "daily") S.prev = snapshotMove();
  clearHint();
  spendGift();
  const gains = { pieces: 1 };
  const p = S.tray[slot];
  const sh = parse(p.g);
  const placedIdx = sh.cells.map(([dr, dc]) => (r + dr) * N + c + dc);
  placedIdx.forEach(i => { S.board[i] = p.c; delete clearing[i]; dust(i, 2); });
  justPlaced = new Set(placedIdx);
  setTimeout(() => { justPlaced = new Set(); }, 380);
  nudgeAround(placedIdx);
  S.score += sh.cells.length;
  S.placed++;
  if (S.mode === "journey" && S.placed === 1) track("level_start", { level: S.level });
  knock();
  buzz(8);

  const lines = fullLines(S.board);
  if (lines.length) {
    S.combo++;
    S.miss = 0;
    const n = lines.length;
    const beds = lines.filter(l => l.kind === "bed").length;
    // Harmony: a cleared 3×3 square where all its stones share one of the six colours (water in it does not count)
    const mono = lines.filter(l => {
      if (l.kind !== "bed") return false;
      const stones = l.cells.filter(i => S.board[i] !== HOLE), v0 = S.board[stones[0]];
      return v0 <= COLORS && stones.every(i => S.board[i] === v0);
    });
    const pts = (10 * n * n + 100 * mono.length) * S.combo;
    S.score += pts;
    S.clears += n;
    S.harmony += mono.length;
    clearing = {};
    clearDelay = {};
    // Stones pop one after another along each line
    lines.forEach(l => l.cells.forEach((i, k) => { const d = k * 28; clearDelay[i] = clearDelay[i] === undefined ? d : Math.min(clearDelay[i], d); }));
    let freed = 0, frogsHome = 0;
    const freedAt = [];
    let lotusNow = 0;
    // A blossom stone in a cleared line bursts and takes the stones around it too
    const reach = KL.withBlossoms([...lineCells(lines)], S.board, S.blossom);
    reach.opened.forEach((i, k) => { clearDelay[i] = clearDelay[i] || 0; setTimeout(() => blossomBurst(i), 120 + k * 90); });
    reach.cells.forEach(i => { if (clearDelay[i] === undefined) clearDelay[i] = 160; });
    reach.cells.forEach(i => {
      if (S.board[i] === HOLE) return;
      // A lotus under a cleared line is collected, whatever happens to the stone on it
      if (S.lotus && S.lotus[i]) { delete S.lotus[i]; S.lotusGot++; lotusNow++; pickLotus(i); }
      // Ice breaks on the first clear; the stone itself stays for one more
      if (S.ice && S.ice[i]) { delete S.ice[i]; iceShatter(i); return; }
      if (S.blossom) delete S.blossom[i];
      if (S.board[i] === FROG) { S.frogs = (S.frogs || 0) + 1; frogsHome++; frogHome(i); S.board[i] = 0; return; }
      clearing[i] = S.board[i];
      if (S.board[i] === KOI) { S.koi++; freed++; freedAt.push(i); }
      if (S.preset) delete S.preset[i];
      S.board[i] = 0;
    });
    // Still water: the whole board cleared at once
    const still = !S.tut && S.board.every(v => !v || v === HOLE);
    if (still) S.score += STILL_BONUS;
    const shown = pts + (still ? STILL_BONUS : 0);
    festivalGain({ lines: n, harmony: mono.length, combo: S.combo, stones: Object.keys(clearing).length + frogsHome, koi: freed, lotus: lotusNow, frogs: frogsHome, still });
    Object.assign(gains, { lines: n, harmony: mono.length, koi: freed, combo: S.combo });
    if (S.mode === "journey") S.growIn = levelDef(S.level).grow || 0;
    ripples(lines, mono);
    sweeps(lines);
    shatter(clearing, clearDelay);
    freedAt.forEach(swimAway);
    mono.forEach(sparkle);
    lineKoi(lines);
    comboFx(S.combo);
    if (!reduceMotion && !prefs.calm && (n >= 2 || S.combo >= 3)) restartClass($("boardWrap"), "shake");
    if (!reduceMotion && !prefs.calm && (mono.length || n >= 3 || still)) restartClass($("board"), "flash");
    // Big moments get a koi: one circles the empty pond, or one leaps out of the water
    if (still) setTimeout(stillWater, 250);
    else if (n >= 3 || S.combo >= 3 || mono.length) setTimeout(leap, 180);
    burst(shown, n, mono.length, freed, still);
    flyScore(shown);
    bowl(n + S.combo - 1);
    if (mono.length) bowl(6, 0.04);
    if (S.combo > 1) comboSound(S.combo);
    buzz(S.combo >= 3 ? [16, 30, 16, 30, 22] : [12, 30, 12]);
    const token = clearToken = {};
    setTimeout(() => { if (clearToken === token) { clearing = {}; render(); } }, 700);
    if (S.tut === 1 && beds) S.tut = 2;
    // Bigger moves earn stronger jokers, like special candies
    const earned = mono.length || n >= 3 ? "rainbow" : S.combo === 3 ? "ripple" : n === 2 ? "arrow" : null;
    if (earned) setTimeout(() => grantJoker(earned), 500);
  } else {
    if (++S.miss >= 3) S.combo = 0;
    // Bamboo grows while the player misses
    if (S.mode === "journey" && S.growIn && bambooLeft() && --S.growIn <= 0) {
      S.growIn = levelDef(S.level).grow;
      const j = KL.growBamboo(S.board, Math.random);
      if (j >= 0) {
        if (S.prev) S.prev = null; // growth cannot be undone away
        grewAt = j;
        setTimeout(() => { grewAt = -1; leaves(j); }, 420);
        setTimeout(() => { if (grewAt === -1) render(); }, 900);
        rustle();
      }
    }
  }
  // Frogs hop and maple leaves fall every few moves, clear or not
  if (S.mode === "journey") moveTheGarden();
  // Move the tutorial along even if the player ignores the glowing gap
  if (S.tut === 1 && S.placed >= 3) S.tut = 2;
  if (S.tut === 2 && ++S.tutMoves > 3) finishTutorial();

  // A fresh piece takes the place of the one just used
  S.tray[slot] = dealPiece();
  entering.add(slot);

  if (S.mode === "endless") gains.endless = S.score;
  tasksAdd(gains);
  worldMove(placedIdx, gains);
  if (S.mode === "endless") {
    if (S.score > best) {
      if (!S.newBest && best > 0) { S.newBest = true; setTimeout(() => toast("New personal best"), 500); }
      best = S.score;
      try { localStorage.setItem("mb-best-9", best); } catch (e) {}
    }
    if (S.score >= 800 && S.placed % 8 === 0) setTimeout(dropRock, 450);
  }
  render();

  if (S.mode === "journey") {
    if (goalMet()) { winLevel(); return; }
    if (piecesLeft() === 0 && !S.jokers.length) { S.over = true; setTimeout(() => showFail("out"), 650); return; }
  }
  checkOver();
}
