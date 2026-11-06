// Koi Garden: The joker koi (earning them, the card that explains them, what they do), the end-of-round check and undo.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Joker koi ---------- */
function grantJoker(type) {
  if (S.over) return;
  if (!S.jokers) S.jokers = [];
  if (S.jokers.length >= MAX_JOKERS) {
    journey.pearls += 10;
    saveJourney();
    toast("Joker spot full · +10 pearls");
    return;
  }
  S.jokers.push(type);
  renderJoker();
  restartClass(jokerSlot, "gain");
  toast(`${JOKERS[type].name}!`);
  bowl(5, 0.04);
  // The first time each kind is earned, its card shows what it does
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem("mb-joker-seen") || "[]"); } catch (e) {}
  if (!Array.isArray(seen)) seen = [];
  if (!seen.includes(type)) {
    try { localStorage.setItem("mb-joker-seen", JSON.stringify(seen.concat(type))); } catch (e) {}
    setTimeout(() => { if (overlay.hidden && !S.over) openJokerCard(type, true); }, 900);
  }
}
// A card with a small board that shows which stones the joker takes
function openJokerCard(type, earned) {
  const j = JOKERS[type];
  $("jokerEyebrow").textContent = earned ? "New joker koi" : "Joker koi";
  $("jokerTitle").textContent = j.name;
  $("jokerKoi").src = ALL_KOI[j.koi].img;
  $("jokerText").textContent = j.explain;
  $("jokerMore").textContent = earned ? "Drag it from the gold slot onto the board. You can hold three, and unused jokers give 50 points each when you win a level." : "Drag it from the gold slot onto the board.";
  // The example board: scattered stones, the joker's spot, and what it would clear
  const demo = $("jokerDemo"), r0 = 4, c0 = type === "arrow" ? 3 : 4;
  const rnd = seeded(hashSeed("joker-demo"));
  demo.innerHTML = "";
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N), c = i % N, el = document.createElement("i");
    const colour = rnd() < 0.5 ? 1 + Math.floor(rnd() * 4) : 0;
    const spot = r === r0 && c === c0;
    const hit = !spot && colour && (type === "arrow" ? r === r0 || c === c0 : type === "ripple" ? Math.abs(r - r0) <= 2 && Math.abs(c - c0) <= 2 : colour === 1);
    const lane = type === "arrow" ? r === r0 || c === c0 : type === "ripple" ? Math.abs(r - r0) <= 2 && Math.abs(c - c0) <= 2 : false;
    el.className = (spot ? "spot" : colour ? "st" : "") + (hit ? " hit" : "") + (lane ? " lane" : "");
    if (colour && !spot) el.style.setProperty("--c", `var(--p${colour})`);
    if (spot) el.innerHTML = `<img src="${ALL_KOI[j.koi].img}" alt="">`;
    el.style.animationDelay = hit ? Math.hypot(r - r0, c - c0) * 70 + "ms" : "";
    demo.appendChild(el);
  }
  demo.dataset.type = type;
  $("jokerBuyMore").hidden = !(S.mode === "journey" && !S.over && !S.tut && S.jokers.length < MAX_JOKERS);
  openCard("jokerCard");
}
$("jokerDone").addEventListener("click", () => closeOverlay());
$("jokerBuyMore").addEventListener("click", () => openJokerShop());

/* ---------- Joker shop ----------
   Pearls buy a joker koi for the Journey level you are in: it goes straight into the gold slot (three at most).
   Not in the Daily or Endless, so scores there stay fair. A bought joker is spent like any other; one left
   unused when you win gives its 50 points like the rest. */
let shopBack = null;
function openJokerShop(back) {
  if (S.mode !== "journey" || S.over || S.tut) return;
  shopBack = back || null;
  paintJokerShop();
  openCard("shopCard");
}
function paintJokerShop() {
  const full = (S.jokers || []).length >= MAX_JOKERS;
  $("shopBank").querySelector("b").textContent = journey.pearls;
  $("shopNote").textContent = full ? "Your gold slot is full: three jokers is the most you can hold." : "It waits in the gold slot. Drag it onto the board when you need it.";
  $("shopList").innerHTML = Object.keys(JOKER_PRICE).map(type => {
    const j = JOKERS[type], price = JOKER_PRICE[type], can = !full && journey.pearls >= price;
    return `<button class="shop-item" data-type="${type}"${can ? "" : " disabled"} aria-label="${j.name}, ${j.does}, ${price} pearls">`
      + `<img src="${ALL_KOI[j.koi].img}" alt=""><span class="shop-what"><b>${j.name}</b><small>${j.short}</small></span>`
      + `<span class="shop-price"><i class="pearl"></i>${price}</span></button>`;
  }).join("");
}
function buyJoker(type) {
  const price = JOKER_PRICE[type];
  if (!price || S.mode !== "journey" || S.over || journey.pearls < price || (S.jokers || []).length >= MAX_JOKERS) return;
  journey.pearls -= price;
  saveJourney();
  S.jokers.push(type);
  // Undo must not take a paid joker back
  if (S.prev && S.prev.jokers) S.prev.jokers.push(type);
  renderJoker();
  restartClass(jokerSlot, "gain");
  track("buy", { level: S.level, data: { kind: type, pearls: price } });
  chime(true);
  buzz([10, 30, 10]);
  closeJokerShop();
  toast(`${JOKERS[type].name} in the gold slot`);
}
function closeJokerShop() {
  const back = shopBack;
  shopBack = null;
  if (back) back(); else closeOverlay();
}
$("shopList").addEventListener("click", e => { const b = e.target.closest(".shop-item"); if (b && !b.disabled) buyJoker(b.dataset.type); });
$("shopDone").addEventListener("click", closeJokerShop);
// The stones a joker removes when it lands on cell (r, c)
function jokerCells(type, r, c) {
  const out = [];
  if (type === "arrow") {
    for (let k = 0; k < N; k++) { out.push(r * N + k); out.push(k * N + c); }
  } else if (type === "ripple") {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < N && cc < N) out.push(rr * N + cc);
    }
  } else {
    const colour = rainbowColour(r, c);
    for (let i = 0; i < N * N; i++) if (colour && S.board[i] === colour) out.push(i);
  }
  // Water is never cleared; a blossom among the cells bursts and takes its neighbours too
  return KL.withBlossoms([...new Set(out)].filter(i => S.board[i] && S.board[i] !== HOLE), S.board, S.blossom).cells;
}
// Rainbow: the colour most common among its neighbours, or on the whole board
function rainbowColour(r, c) {
  const count = cells => { const m = {}; cells.forEach(i => { const v = S.board[i]; if (v >= 1 && v <= COLORS) m[v] = (m[v] || 0) + 1; }); return m; };
  const near = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && cc >= 0 && rr < N && cc < N) near.push(rr * N + cc);
  }
  let tally = count(near);
  if (!Object.keys(tally).length) tally = count([...Array(N * N).keys()]);
  return +Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 0;
}
// While a joker is dragged, the board shows its shape: beams along the row and column, a ring
// around the 5×5 square, or every stone of one colour. A line above the board says what happens.
let aimEls = [];
function clearJokerAim() { aimEls.forEach(el => el.remove()); aimEls = []; }
function boardBox(cells) {
  const wr = $("boardWrap").getBoundingClientRect();
  const rects = cells.map(i => cellEls[i].getBoundingClientRect());
  const left = Math.min(...rects.map(q => q.left)), top = Math.min(...rects.map(q => q.top));
  return { left: left - wr.left, top: top - wr.top, width: Math.max(...rects.map(q => q.right)) - left, height: Math.max(...rects.map(q => q.bottom)) - top };
}
function aimEl(cls, box, html = "") {
  const el = document.createElement("div");
  el.className = cls;
  if (box) Object.assign(el.style, { left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px" });
  el.innerHTML = html;
  $("boardWrap").appendChild(el);
  aimEls.push(el);
  return el;
}
const COLOUR_NAMES = ["", "red", "yellow", "green", "blue", "pink", "purple"];
function showJokerPreview(type, r, c) {
  clearPreview();
  clearJokerAim();
  const aim = cellEls[r * N + c];
  // The arrow shows its reach with the blue beams alone, so no gold on the board
  aim.classList.add("aim");
  if (type === "arrow") aim.classList.add("aim-arrow");
  previewed.push(aim);
  const cells = jokerCells(type, r, c);
  if (type !== "arrow") cells.forEach(i => { cellEls[i].classList.add("glow"); previewed.push(cellEls[i]); });
  const n = cells.length, stones = `${n} ${n === 1 ? "stone" : "stones"}`;
  let say;
  if (type === "arrow") {
    aimEl("beam h", boardBox([r * N, r * N + N - 1]), "<i></i><i></i>");
    aimEl("beam v", boardBox([c, (N - 1) * N + c]), "<i></i><i></i>");
    say = n ? `clears ${stones} in this row and column` : "nothing to clear in this row or column";
  } else if (type === "ripple") {
    const r1 = Math.max(0, r - 2), r2 = Math.min(N - 1, r + 2), c1 = Math.max(0, c - 2), c2 = Math.min(N - 1, c + 2);
    aimEl("ring5", boardBox([r1 * N + c1, r2 * N + c2]));
    say = n ? `clears ${stones} in this 5×5 area` : "nothing to clear in this area";
  } else {
    const colour = rainbowColour(r, c);
    cells.forEach(i => cellEls[i].classList.add("rainbow-hit"));
    say = n ? `clears all ${n} <i class="dot" style="--c:var(--p${colour});--rad:var(--r${colour})"></i> ${COLOUR_NAMES[colour]} stones` : "no stones of one colour nearby";
  }
  aimEl("joker-tip", null, `<b>${JOKERS[type].name}</b> · ${say}`);
}
function useJoker(r, c) {
  S.jokersUsed = (S.jokersUsed || 0) + 1;
  if (S.mode !== "daily") S.prev = snapshotMove();
  clearHint();
  spendGift();
  const type = S.jokers.shift();
  const j = JOKERS[type];
  const cells = jokerCells(type, r, c);
  // The rainbow's colour, read before its stones are gone
  const colour = type === "rainbow" ? rainbowColour(r, c) : 0;
  clearing = {};
  clearDelay = {};
  let freed = 0, removed = 0;
  const freedAt = [];
  // Stones go in a wave outward from where the koi landed
  cells.forEach(i => {
    clearDelay[i] = Math.round(Math.hypot(Math.floor(i / N) - r, (i % N) - c) * 45);
    if (S.lotus && S.lotus[i]) { delete S.lotus[i]; S.lotusGot++; pickLotus(i); }
    // A joker koi is strong enough to take a frozen stone in one go: the ice breaks and the stone goes with it
    if (S.ice && S.ice[i]) { delete S.ice[i]; iceShatter(i); }
    if (S.blossom && S.blossom[i]) { delete S.blossom[i]; blossomBurst(i); }
    if (S.board[i] === FROG) { S.frogs = (S.frogs || 0) + 1; frogHome(i); S.board[i] = 0; removed++; return; }
    clearing[i] = S.board[i];
    if (S.board[i] === KOI) { S.koi++; freed++; freedAt.push(i); }
    if (S.preset) delete S.preset[i];
    S.board[i] = 0;
    removed++;
  });
  const pts = 15 * removed;
  S.score += pts;
  festivalGain({ lines: Math.max(1, Math.round(removed / 9)), stones: removed, koi: freed, joker: true });
  jokerShow(type, r, c, cells, colour);
  swimAway(r * N + c);
  shatter(clearing, clearDelay);
  freedAt.forEach(swimAway);
  if (!reduceMotion && !prefs.calm) { restartClass($("boardWrap"), "shake"); restartClass($("board"), "flash"); }
  const el = document.createElement("div");
  el.className = "burst gold";
  el.innerHTML = `<b>+${pts}</b><span>${j.name}${freed ? ` · ${freed} koi freed` : ""}</span>`;
  $("boardWrap").appendChild(el);
  setTimeout(() => el.remove(), 1300);
  flyScore(pts);
  bowl(6, 0.05);
  whoosh();
  buzz([20, 40, 20]);
  const token = clearToken = {};
  setTimeout(() => { if (clearToken === token) { clearing = {}; render(); } }, 900);
  if (S.mode === "endless" && S.score > endlessBest()) setEndlessBest(S.score);
  tasksAdd(S.mode === "endless" ? { joker: 1, koi: freed, endless: S.score } : { joker: 1, koi: freed });
  render();
  if (S.mode === "journey") {
    if (goalMet()) { winLevel(); return; }
    if (piecesLeft() === 0 && !S.jokers.length) { S.over = true; setTimeout(() => showFail("out"), 650); return; }
  }
  checkOver();
}
// Endless pressure: a grey rock lands on an empty spot that does not complete a line
function dropRock() {
  if (S.mode !== "endless" || S.over) return;
  const empty = [];
  for (let i = 0; i < N * N; i++) if (!S.board[i]) empty.push(i);
  for (let t = 0; t < 30 && empty.length; t++) {
    const i = empty[Math.floor(Math.random() * empty.length)];
    S.board[i] = ROCK;
    if (fullLines(S.board).length) { S.board[i] = 0; continue; }
    if (S.prev) S.prev = null; // a rock cannot be undone away
    fellAt = i;
    render();
    setTimeout(() => { fellAt = -1; dust(i, 6); if (!prefs.calm) restartClass($("boardWrap"), "shake"); }, 420);
    toast("A rock fell into the pond");
    knock();
    checkOver();
    return;
  }
}
function finishTutorial() {
  S.tut = 0;
  tutDone = true;
  try { localStorage.setItem("mb-tut", "done"); } catch (e) {}
}
// With no pieces left, only the jokers can finish a Journey level. This is the most they could still add to the goal,
// counted generously (each joker at its best spot on today's board; a joker takes frozen stones in one go), so a level only ends early
// when the goal is out of reach for sure.
function jokerReach() {
  const L = levelDef(S.level);
  if (L.goal === "harmony") return 0;
  const gain = i => !S.board[i] || S.board[i] === HOLE ? 0 : L.goal === "score" ? 15 : L.goal === "koi" ? +(S.board[i] === KOI)
    : L.goal === "lotus" ? +!!(S.lotus && S.lotus[i]) : L.goal === "bamboo" ? +(S.board[i] === BAMBOO)
    : L.goal === "frog" ? +(S.board[i] === FROG) : +!!(S.preset && S.preset[i]);
  const sum = cells => cells.reduce((a, i) => a + gain(i), 0);
  return S.jokers.reduce((total, type) => {
    let best = 0;
    if (type === "rainbow") {
      for (let colour = 1; colour <= COLORS; colour++) best = Math.max(best, sum([...Array(N * N).keys()].filter(i => S.board[i] === colour)));
    } else {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cells = [];
        if (type === "arrow") for (let k = 0; k < N; k++) cells.push(r * N + k, k * N + c);
        else for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
          if (r + dr >= 0 && c + dc >= 0 && r + dr < N && c + dc < N) cells.push((r + dr) * N + c + dc);
        }
        best = Math.max(best, sum([...new Set(cells)]));
      }
    }
    return total + best;
  }, 0);
}
function jokersCanStillWin() {
  const L = levelDef(S.level);
  const need = L.goal === "bamboo" ? bambooLeft() : goalTarget(L) - goalProgress();
  return jokerReach() >= need;
}
function checkOver() {
  if (S.over) return;
  // A joker can always make room, as long as there is an empty cell to drop it on. Out of pieces in the Journey,
  // the jokers only count if they could still reach the goal on their own.
  const outOfPieces = S.mode === "journey" && piecesLeft() === 0;
  if (S.jokers && S.jokers.length && S.board.some(v => !v) && !(outOfPieces && !jokersCanStillWin())) return;
  const left = S.tray.filter(Boolean);
  if (!left.length || left.every(p => !fitsAnyTurn(p.g))) {
    S.over = true;
    const next = S.mode === "daily" ? finishDaily : S.mode === "journey" ? () => showFail(left.length ? "stuck" : "out") : showOver;
    setTimeout(next, 650);
  }
}
$("undoBtn").addEventListener("click", () => {
  if (!S.prev || S.undoLeft <= 0 || drag || !overlay.hidden || S.mode === "daily") return;
  showAd("undo", () => {
    Object.assign(S, S.prev);
    S.prev = null;
    clearHint();
    S.undoLeft--;
    S.over = false;
    closeOverlay();
    render();
    tick();
  });
});
