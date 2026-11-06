// Koi Garden: The rules of placing stones and clearing lines, and how a game is set up.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Rules ---------- */
function fits(sh, r, c, board = S.board) {
  for (const [dr, dc] of sh.cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= N || cc >= N || board[rr * N + cc]) return false;
  }
  return true;
}
function anyFit(sh) {
  for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.w; c++) if (fits(sh, r, c)) return true;
  return false;
}
function fitsAnyTurn(g) {
  let cur = g;
  for (let k = 0; k < 4; k++) { if (anyFit(parse(cur))) return true; cur = rotateGrid(cur); }
  return false;
}
function fullLines(board) { return LINES.filter(l => l.cells.every(i => board[i])); }
function lineCells(lines) { const set = new Set(); lines.forEach(l => l.cells.forEach(i => set.add(i))); return set; }
// In endless, big pieces grow more common and tiny ones rarer as the score climbs
function weightOf(i) {
  const w = WEIGHTS[i];
  if (!S || S.mode !== "endless") return w;
  const n = stonesIn(SHAPE_SRC[i]), k = Math.min(1, S.score / 3000);
  return n >= 5 ? w * (1 + 1.5 * k) : n <= 2 ? w * (1 - 0.7 * k) : w;
}
function pickShape() {
  let total = 0;
  for (let i = 0; i < SHAPE_SRC.length; i++) total += weightOf(i);
  let x = rnd() * total;
  for (let i = 0; i < SHAPE_SRC.length; i++) { x -= weightOf(i); if (x <= 0) return SHAPE_SRC[i]; }
  return SHAPE_SRC[0];
}
const randColor = () => 1 + Math.floor(rnd() * COLORS);
// Try a few random pieces that fit; if none do, optionally fall back to any fitting piece of at least minStones
function fairPiece(tries, minStones) {
  let p;
  for (let t = 0; t < tries; t++) {
    p = { g: pickShape(), c: randColor() };
    if (fitsAnyTurn(p.g)) return p;
  }
  if (minStones) {
    const fitting = SHAPE_SRC.filter(g => stonesIn(g) >= minStones && fitsAnyTurn(g));
    if (fitting.length) return { g: fitting[Math.floor(rnd() * fitting.length)], c: randColor() };
  }
  return p;
}
function dealPiece() {
  if (S.mode === "daily") {
    // Same sequence for everyone, so no re-rolls based on the board
    if (S.dealt >= DAILY_PIECES) return null;
    S.dealt++;
    return { g: pickShape(), c: randColor() };
  }
  if (S.mode === "journey") {
    if (S.dealt >= S.limit) return null;
    S.dealt++;
    return fairPiece(10, 2);
  }
  // Endless: the game helps less as the score climbs
  return S.score < 1500 ? fairPiece(10, 3) : fairPiece(S.score < 3000 ? 4 : 2, 0);
}

/* ---------- Game setup ---------- */
function tutorialBoard() {
  // A centre square with one gap, and a single stone to fill it
  BEDS[4].cells.forEach((i, k) => { if (i !== TUT_GAP) S.board[i] = 1 + (k % COLORS); });
  S.tut = 1;
}
function startLevel(n) {
  const L = levelDef(n);
  S = { mode: "journey", level: n, board: Array(N * N).fill(0), score: 0, combo: 0, miss: 0, over: false, won: false,
    dealt: 0, limit: L.pieces, clears: 0, harmony: 0, koi: 0, preset: {}, ice: {}, lotus: {}, lotusGot: 0, growIn: L.grow || 0, placed: 0,
    extra: false, paidPieces: false, rescued: false, doubled: false, failCounted: false, frogs: 0, blossom: {}, hopIn: L.hop || 0, fallIn: L.fall || 0, undoLeft: UNDO_PER_GAME, prev: null, jokers: [], tut: 0, tutMoves: 0 };
  if (n === 1 && !tutDone) tutorialBoard();
  else {
    // The same layout every time you play this level
    const lay = KL.layout(n, L);
    Object.assign(S, { board: lay.board, preset: lay.preset, ice: lay.ice, lotus: lay.lotus, blossom: lay.blossom || {} });
  }
  S.tray = dealHand();
  if (S.tut === 1) S.tray[0] = { g: ["x"], c: 3 };
  // Jokers waiting at the start: the win streak, plus a gift from the task basket
  if (!S.tut) {
    S.jokers = currentJokers(journey.streak);
    if (journey.gift && S.jokers.length < MAX_JOKERS) { S.jokers.push(journey.gift); S.gift = journey.gift; }
    S.boost = S.jokers.length;
  }
  G.journey = S;
  enterAll();
  shownScore = 0;
}
function startGame(games, level) {
  S = { mode: "endless", level: level || prefs.endless || "normal", board: Array(N * N).fill(0), score: 0, combo: 0, miss: 0, continued: false, over: false,
    games, clears: 0, harmony: 0, placed: 0, newBest: false, undoLeft: UNDO_PER_GAME, prev: null, jokers: [], tut: 0, tutMoves: 0 };
  if (!tutDone) tutorialBoard();
  S.tray = dealHand();
  if (S.tut === 1) S.tray[0] = { g: ["x"], c: 3 };
  G.endless = S;
  enterAll();
  shownScore = 0;
}
function startDaily(practice) {
  const d = today();
  S = { mode: "daily", practice: !!practice, day: d.key, num: d.num, label: d.label, rng: hashSeed("mental-block-" + d.key),
    board: Array(N * N).fill(0), score: 0, combo: 0, miss: 0, over: false, placed: 0,
    dealt: 0, harmony: 0, clears: 0, recorded: false, jokers: [], tut: 0, tutMoves: 0 };
  let n = 10 + Math.floor(rnd() * 6), guard = 0;
  while (n > 0 && guard++ < 500) {
    const i = Math.floor(rnd() * N * N);
    if (S.board[i]) continue;
    S.board[i] = randColor();
    if (fullLines(S.board).length) { S.board[i] = 0; continue; }
    n--;
  }
  S.tray = [dealPiece(), dealPiece()];
  G.daily = S;
  entering.add(0); entering.add(1);
  shownScore = 0;
}
const playedOfficial = () => daily.best[today().key] !== undefined;
const currentLevel = () => journey.unlocked;
function switchMode(mode) {
  if (drag || (S && S.mode === mode)) return;
  if (mode === "daily") {
    if (!G.daily || G.daily.day !== today().key) startDaily(playedOfficial());
    else S = G.daily;
  } else if (mode === "journey") {
    if (G.journey && !G.journey.over) S = G.journey;
    else { startLevel(currentLevel()); shownScore = 0; closeOverlay(); render(); openMap(); return; }
  } else {
    if (G.endless) S = G.endless;
    else { startGame(0); if (tutDone) { closeOverlay(); render(); openCard("endlessCard"); paintEndlessPick(); return; } }
  }
  shownScore = S.score;
  closeOverlay();
  render();
  if (S.over) resumeOverCard();
}
function resumeOverCard() {
  if (S.mode === "daily") finishDaily();
  else if (S.mode === "endless") showOver();
  else if (S.won) showWin();
  else showFail(S.failReason || "stuck");
}
// Ad breaks only between rounds, never in the first rounds of a session, and spaced out
function betweenRounds(go, allowed = true) {
  ads.rounds++;
  const now = Date.now();
  const due = allowed && !noAds && !firstSession() && ads.rounds > FREE_ROUNDS && now - ads.lastBreak > AD_GAP_MS && now - ads.lastReward > AD_AFTER_REWARD_MS;
  if (due) { ads.lastBreak = now; showAd("interstitial", go); }
  else go();
}
function newGame(afterRound, level) {
  const games = (G.endless ? G.endless.games : 0) + 1;
  const go = () => { startGame(games, level); closeOverlay(); render(); };
  if (afterRound) betweenRounds(go); else go();
}
// From the win card the next level starts with one tap; the intro card only comes when there is something new to read
function playLevel(n, afterRound, quick) {
  const L = levelDef(n);
  const intro = !quick || NEW_IN[n] || L.hard || n % PER_CHAPTER === 1;
  const go = () => {
    startLevel(n); closeOverlay(); render();
    if (intro) openLevelIntro(); else setTimeout(() => toast(`Level ${n} · ${goalText(L)}`), 250);
  };
  if (afterRound) betweenRounds(go, n >= 6); else go();
}
