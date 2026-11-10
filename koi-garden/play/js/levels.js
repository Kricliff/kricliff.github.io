/* Journey levels, shared by the game and by assets/levels/tune.js, so both play the same boards.

   Chapter 1 is made by hand. Chapters 2-10 come from generate() below; the tuner then plays every
   level many times with a simple bot and sets its number of pieces, so each level can be won but
   asks a little more as the chapters go on. Their tuned values are kept in TUNED. Every level after
   150 reuses a tuned level from chapters 6-10 with a fresh layout, so the journey never runs out. */
(function (root) {
  const N = 9, COLORS = 6, KOI = 7, BAMBOO = 9, PER = 15;
  // Water in a shaped board (never filled, never cleared), a frog, and a fallen maple leaf
  const HOLE = 10, FROG = 11, LEAF = 12;

  // Every line a player can clear: 9 rows, 9 columns and 9 squares of 3×3
  const LINES = [];
  for (let r = 0; r < N; r++) LINES.push([...Array(N)].map((_, c) => r * N + c));
  for (let c = 0; c < N; c++) LINES.push([...Array(N)].map((_, r) => r * N + c));
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const cells = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br * 3 + r) * N + bc * 3 + c);
    LINES.push(cells);
  }
  const anyFull = board => LINES.some(l => l.every(i => board[i]));

  function hashSeed(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h | 0;
  }
  // mulberry32
  function seeded(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Chapter 1, Koi Pond: made by hand ----------
     Most levels are meant to be won on the first try. Every fifth level is Hard: fewer spare
     pieces, double pearls. Koi levels get extra pieces because the koi sit in fixed spots.
     Pieces cut 27 October 2026 (the owner: far too easy): the bot won almost every level with half its pieces
     left. Now it wins about 90 % (97 % on the first three), Hard levels about 70 %.
     More pieces again 10 November 2026 on levels 5-7, 9, 11-13 and 15: those numbers were for a bot that starts with an
     Arrow Koi. Without one (a new player, or the try after a loss) it won levels 13 and 15 about one time in four.
     Now it wins about 85 % with no joker (95 % on the first three), Hard levels about 70 %. The Harmony levels
     8 and 14 ask for one square instead of two and are 20 and 22 pieces long instead of 32 and 30 (the bot wins
     them a little over half the time; more pieces barely helped it with two squares).
     s2 and s3 are the scores for two and three stars (from the bot, as in assets/levels/tune.js; a little kinder on
     the first three levels). */
  const CH1 = [
    { goal: "score", target: 100, pieces: 16, stones: 6, s2: 250, s3: 330 },
    { goal: "koi", target: 3, pieces: 16, stones: 8, koi: 3, s2: 270, s3: 330 },
    { goal: "score", target: 180, pieces: 14, stones: 10, s2: 280, s3: 350 },
    { goal: "harmony", target: 1, pieces: 17, stones: 6, s2: 470, s3: 550 },
    { goal: "koi", target: 6, pieces: 13, stones: 12, koi: 6, hard: true, s2: 280, s3: 320 },
    { goal: "clear", pieces: 18, stones: 10, s2: 350, s3: 390 },
    { goal: "score", target: 300, pieces: 15, stones: 14, s2: 390, s3: 420 },
    { goal: "harmony", target: 1, pieces: 20, stones: 8, s2: 480, s3: 550 },
    { goal: "koi", target: 6, pieces: 17, stones: 14, koi: 6, s2: 350, s3: 390 },
    { goal: "clear", pieces: 18, stones: 16, hard: true, s2: 450, s3: 500 },
    { goal: "clear", pieces: 26, stones: 8, ice: 4, s2: 540, s3: 630 },
    { goal: "koi", target: 5, pieces: 16, stones: 14, koi: 5, ice: 4, s2: 360, s3: 390 },
    { goal: "score", target: 400, pieces: 21, stones: 14, ice: 6, s2: 520, s3: 580 },
    { goal: "harmony", target: 1, pieces: 22, stones: 10, ice: 4, s2: 540, s3: 620 },
    { goal: "clear", pieces: 27, stones: 20, ice: 6, hard: true, s2: 690, s3: 800 }
  ];

  const CHAPTERS = ["Koi Pond", "Bamboo Grove", "Lotus Lake", "Moon Bridge", "Cherry Hill",
    "Mountain Spring", "Tea House", "Maple Valley", "Snow Temple", "Golden Pagoda"];
  const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
  const chapterOf = n => Math.ceil(n / PER);
  // After chapter 10 the names come round again: Bamboo Grove II, Lotus Lake II, and so on
  function chapterName(c) {
    if (c <= CHAPTERS.length) return CHAPTERS[c - 1];
    const loop = CHAPTERS.length - 1, k = (c - 11) % loop + 1, round = Math.floor((c - 11) / loop) + 1;
    return CHAPTERS[k] + ROMAN[Math.min(round, ROMAN.length - 1)];
  }

  /* ---------- Shaped boards (Moon Bridge onwards) ----------
     Some cells are water, so the board takes a shape. Water counts as filled when a line is checked, so lines
     through it are shorter, but it is never cleared. No line is ever all water. */
  const at = (r, c) => r * N + c;
  const SHAPES = {
    // The four corners cut away
    corners: () => [at(0, 0), at(0, 1), at(1, 0), at(0, 7), at(0, 8), at(1, 8), at(7, 0), at(8, 0), at(8, 1), at(7, 8), at(8, 7), at(8, 8)],
    // A river across the middle with a bridge in the centre
    river: () => [at(4, 0), at(4, 1), at(4, 2), at(4, 6), at(4, 7), at(4, 8)],
    // A stream down the middle, crossed twice
    stream: () => [at(0, 4), at(1, 4), at(3, 4), at(5, 4), at(7, 4), at(8, 4)],
    // A pond in the centre
    pond: () => [at(4, 4), at(3, 4), at(5, 4), at(4, 3), at(4, 5)],
    // A diamond: the corners cut deeper
    diamond: () => [at(0, 0), at(0, 1), at(0, 2), at(1, 0), at(1, 1), at(2, 0), at(0, 6), at(0, 7), at(0, 8), at(1, 7), at(1, 8), at(2, 8),
      at(6, 0), at(7, 0), at(7, 1), at(8, 0), at(8, 1), at(8, 2), at(6, 8), at(7, 7), at(7, 8), at(8, 6), at(8, 7), at(8, 8)],
    // Stepping stones: small islands of water
    islands: () => [at(1, 1), at(1, 7), at(4, 4), at(7, 1), at(7, 7), at(2, 4), at(6, 4)]
  };
  const SHAPE_NAMES = Object.keys(SHAPES);

  /* ---------- Chapters 2-10: generated, then tuned ----------
     Each chapter brings something new: 2 bamboo, 3 lotus flowers, 4 shaped boards, 5 blossom stones, 6 frogs,
     8 falling maple leaves. Chapters 7, 9 and 10 mix everything, and Snow Temple has more ice. */
  const ORDER = {
    2: ["bamboo", "score", "koi", "bamboo", "koi", "clear", "bamboo", "harmony", "score", "bamboo", "koi", "clear", "bamboo", "harmony", "bamboo"],
    3: ["lotus", "score", "lotus", "koi", "lotus", "clear", "lotus", "bamboo", "harmony", "lotus", "koi", "lotus", "clear", "bamboo", "lotus"],
    6: ["frog", "score", "frog", "koi", "frog", "clear", "frog", "lotus", "frog", "frog", "bamboo", "frog", "harmony", "koi", "frog"]
  };
  const ALL_GOALS = ["score", "koi", "clear", "harmony", "bamboo", "lotus"];
  function goalOrder(c) {
    if (ORDER[c]) return ORDER[c];
    // A shuffled mix with no goal twice in a row; Hard levels get one of the tougher goals
    const r = seeded(hashSeed("koi-garden-chapter-" + c));
    const goals = c >= 6 ? ALL_GOALS.concat("frog") : ALL_GOALS;
    const out = [];
    for (let i = 1; i <= PER; i++) {
      const pool = (i % 5 === 0 ? ["koi", "clear", "bamboo", "lotus"].concat(c >= 6 ? ["frog"] : []) : goals).filter(g => g !== out[out.length - 1]);
      out.push(pool[Math.floor(r() * pool.length)]);
    }
    return out;
  }
  const round10 = v => Math.round(v / 10) * 10;
  function generate(n) {
    const c = Math.min(chapterOf(n), 10), i = (n - 1) % PER + 1, hard = i % 5 === 0;
    const r = seeded(hashSeed("koi-garden-level-" + n));
    // How far along the journey this level is, from 0 (chapter 2) to about 1 (chapter 10)
    const t = Math.min(1.1, (c - 2) / 8 + (i - 1) / 14 * 0.12);
    const goal = goalOrder(c)[i - 1];
    const L = { goal, pieces: 28 };
    if (goal === "score") { L.target = round10(260 + 240 * t + (hard ? 80 : 0)); L.stones = 10 + Math.round(6 * t); }
    if (goal === "koi") { L.koi = 4 + Math.round(2 * t) + (hard ? 1 : 0); L.target = L.koi; L.stones = L.koi + 6 + Math.round(4 * t); }
    if (goal === "clear") L.stones = 10 + Math.round(7 * t) + (hard ? 3 : 0);
    if (goal === "harmony") { L.target = hard ? 2 : 1; L.stones = 6 + Math.round(4 * t); }
    if (goal === "bamboo") { L.bamboo = 3 + Math.round(3 * t) + (hard ? 1 : 0); L.grow = Math.max(3, 5 - Math.round(2 * t)); L.stones = 4 + Math.round(4 * t); }
    if (goal === "lotus") { L.lotus = 5 + Math.round(3 * t) + (hard ? 1 : 0); L.target = L.lotus; L.stones = 6 + Math.round(5 * t); }
    if (goal === "frog") { L.frogs = 3 + Math.round(2 * t) + (hard ? 1 : 0); L.target = L.frogs; L.hop = Math.max(2, 4 - Math.round(2 * t)); L.stones = 6 + Math.round(4 * t); }
    // Ice on some starting stones once chapter 2 is under way; Snow Temple has more
    if (c > 2 || i > 6) L.ice = Math.round((L.stones - (L.koi || 0)) * (0.12 + 0.2 * t) * (c === 9 ? 1.6 : 1));
    // In later chapters a little bamboo sometimes grows on boards with another goal
    if (c >= 4 && goal !== "bamboo" && r() < 0.35) { L.bamboo = 2; L.grow = 6; }
    // Chapter 4 (Moon Bridge) shapes nearly every board; later chapters shape some
    if (c === 4 ? i !== 2 : c >= 5 && r() < 0.4) L.shape = c === 4 && i === 1 ? "river" : SHAPE_NAMES[Math.floor(r() * SHAPE_NAMES.length)];
    // Harmony needs whole squares to work with, so its boards keep their corners
    if (goal === "harmony" && L.shape === "diamond") L.shape = "pond";
    // Blossom stones: many in Cherry Hill, a few now and then afterwards
    // (Not on score levels: their chain reactions make points far too easy)
    if ((c === 5 ? goal !== "harmony" : c >= 6 && r() < 0.3) && goal !== "score") L.blossom = c === 5 ? 2 + Math.round(r() * 2) : 2;
    // Maple leaves fall in Maple Valley and the chapters after it
    if (c >= 8 && (c === 8 || r() < 0.4)) L.fall = c === 8 && i === 1 ? 6 : 4 + Math.floor(r() * 3);
    // Score levels stay plain: water and leaves count as filled cells, so on them they only hand out free points
    if (goal === "score") { delete L.shape; delete L.fall; }
    if (hard) L.hard = true;
    return L;
  }

  // Written by assets/levels/tune.js: levels 16-150 with their tuned number of pieces
  const TUNED = /*TUNED*/[
    {"goal":"bamboo","pieces":15,"bamboo":3,"grow":5,"stones":4,"s2":270,"s3":310},
    {"goal":"score","pieces":13,"target":260,"stones":10,"s2":340,"s3":370},
    {"goal":"koi","pieces":13,"koi":4,"target":4,"stones":10,"s2":280,"s3":330},
    {"goal":"bamboo","pieces":13,"bamboo":6,"grow":5,"stones":4,"s2":270,"s3":320},
    {"goal":"koi","pieces":13,"koi":6,"target":6,"stones":11,"hard":true,"s2":260,"s3":300},
    {"goal":"clear","pieces":22,"stones":10,"s2":460,"s3":530},
    {"goal":"bamboo","pieces":12,"bamboo":3,"grow":5,"stones":4,"ice":1,"s2":230,"s3":280},
    {"goal":"harmony","pieces":19,"target":1,"stones":6,"ice":1,"s2":470,"s3":520},
    {"goal":"score","pieces":14,"target":280,"stones":10,"ice":1,"s2":350,"s3":380},
    {"goal":"bamboo","pieces":13,"bamboo":4,"grow":5,"stones":4,"ice":1,"hard":true,"s2":250,"s3":290},
    {"goal":"koi","pieces":19,"koi":4,"target":4,"stones":10,"ice":1,"s2":390,"s3":440},
    {"goal":"clear","pieces":23,"stones":11,"ice":2,"s2":480,"s3":550},
    {"goal":"bamboo","pieces":12,"bamboo":3,"grow":5,"stones":4,"ice":1,"s2":240,"s3":290},
    {"goal":"harmony","pieces":16,"target":1,"stones":6,"ice":1,"s2":410,"s3":470},
    {"goal":"bamboo","pieces":12,"bamboo":5,"grow":5,"stones":4,"ice":1,"hard":true,"s2":200,"s3":240},
    {"goal":"lotus","pieces":20,"lotus":5,"target":5,"stones":7,"ice":1,"s2":410,"s3":460},
    {"goal":"score","pieces":14,"target":290,"stones":11,"ice":2,"s2":360,"s3":390},
    {"goal":"lotus","pieces":21,"lotus":5,"target":5,"stones":7,"ice":1,"s2":420,"s3":480},
    {"goal":"koi","pieces":12,"koi":4,"target":4,"stones":11,"ice":1,"s2":240,"s3":270},
    {"goal":"lotus","pieces":15,"lotus":6,"target":6,"stones":7,"ice":1,"hard":true,"s2":290,"s3":350},
    {"goal":"clear","pieces":18,"stones":11,"ice":2,"s2":390,"s3":450},
    {"goal":"lotus","pieces":16,"lotus":6,"target":6,"stones":7,"ice":1,"s2":290,"s3":350},
    {"goal":"bamboo","pieces":12,"bamboo":5,"grow":5,"stones":5,"ice":1,"s2":280,"s3":300},
    {"goal":"harmony","pieces":15,"target":1,"stones":7,"ice":1,"s2":380,"s3":420},
    {"goal":"lotus","pieces":18,"lotus":7,"target":7,"stones":7,"ice":1,"hard":true,"s2":350,"s3":420},
    {"goal":"koi","pieces":14,"koi":4,"target":4,"stones":11,"ice":1,"s2":300,"s3":360},
    {"goal":"lotus","pieces":18,"lotus":6,"target":6,"stones":7,"ice":1,"s2":360,"s3":420},
    {"goal":"clear","pieces":26,"stones":12,"ice":2,"s2":590,"s3":650},
    {"goal":"bamboo","pieces":12,"bamboo":5,"grow":5,"stones":5,"ice":1,"s2":240,"s3":290},
    {"goal":"lotus","pieces":22,"lotus":7,"target":7,"stones":7,"ice":1,"hard":true,"s2":440,"s3":520},
    {"goal":"koi","pieces":18,"koi":5,"target":5,"stones":12,"ice":1,"shape":"river","s2":790,"s3":1100},
    {"goal":"score","pieces":17,"target":320,"stones":12,"ice":2,"bamboo":2,"grow":6,"s2":410,"s3":450},
    {"goal":"harmony","pieces":17,"target":1,"stones":7,"ice":1,"bamboo":2,"grow":6,"shape":"islands","s2":470,"s3":560},
    {"goal":"lotus","pieces":19,"lotus":6,"target":6,"stones":7,"ice":1,"shape":"corners","s2":520,"s3":680},
    {"goal":"bamboo","pieces":12,"bamboo":5,"grow":4,"stones":5,"ice":1,"shape":"river","hard":true,"s2":580,"s3":720},
    {"goal":"score","pieces":16,"target":330,"stones":12,"ice":2,"s2":400,"s3":440},
    {"goal":"lotus","pieces":17,"lotus":6,"target":6,"stones":8,"ice":1,"bamboo":2,"grow":6,"shape":"pond","s2":390,"s3":430},
    {"goal":"harmony","pieces":22,"target":1,"stones":7,"ice":1,"bamboo":2,"grow":6,"shape":"pond","s2":570,"s3":700},
    {"goal":"lotus","pieces":24,"lotus":6,"target":6,"stones":8,"ice":1,"shape":"diamond","p2":4,"p3":8},
    {"goal":"clear","pieces":23,"stones":15,"ice":3,"bamboo":2,"grow":6,"shape":"stream","hard":true,"s2":640,"s3":760},
    {"goal":"bamboo","pieces":9,"bamboo":4,"grow":4,"stones":5,"ice":1,"shape":"corners","s2":260,"s3":300},
    {"goal":"score","pieces":18,"target":340,"stones":12,"ice":2,"s2":440,"s3":490},
    {"goal":"bamboo","pieces":19,"bamboo":4,"grow":4,"stones":5,"ice":1,"shape":"islands","s2":400,"s3":460},
    {"goal":"koi","pieces":32,"koi":5,"target":5,"stones":12,"ice":1,"shape":"diamond","p2":4,"p3":11},
    {"goal":"bamboo","pieces":14,"bamboo":5,"grow":4,"stones":5,"ice":1,"shape":"islands","hard":true,"s2":310,"s3":350},
    {"goal":"bamboo","pieces":12,"bamboo":5,"grow":4,"stones":6,"ice":1,"blossom":2,"s2":250,"s3":300},
    {"goal":"koi","pieces":13,"koi":7,"target":7,"stones":13,"ice":2,"blossom":2,"s2":290,"s3":340},
    {"goal":"clear","pieces":19,"stones":13,"ice":3,"bamboo":2,"grow":6,"blossom":3,"s2":420,"s3":470},
    {"goal":"harmony","pieces":22,"target":1,"stones":8,"ice":2,"bamboo":2,"grow":6,"shape":"river","s2":640,"s3":890},
    {"goal":"lotus","pieces":20,"lotus":7,"target":7,"stones":8,"ice":2,"blossom":3,"hard":true,"s2":390,"s3":460},
    {"goal":"score","pieces":18,"target":360,"stones":13,"ice":3,"s2":460,"s3":490},
    {"goal":"harmony","pieces":14,"target":1,"stones":8,"ice":2,"s2":370,"s3":410},
    {"goal":"lotus","pieces":19,"lotus":6,"target":6,"stones":8,"ice":2,"blossom":2,"s2":380,"s3":440},
    {"goal":"bamboo","pieces":13,"bamboo":5,"grow":4,"stones":6,"ice":1,"blossom":3,"s2":250,"s3":300},
    {"goal":"clear","pieces":23,"stones":16,"ice":3,"bamboo":2,"grow":6,"shape":"stream","blossom":4,"hard":true,"s2":630,"s3":710},
    {"goal":"lotus","pieces":31,"lotus":6,"target":6,"stones":8,"ice":2,"shape":"diamond","blossom":3,"p2":4,"p3":11},
    {"goal":"harmony","pieces":9,"target":1,"stones":8,"ice":2,"bamboo":2,"grow":6,"shape":"corners","s2":380,"s3":490},
    {"goal":"clear","pieces":23,"stones":13,"ice":3,"blossom":4,"s2":510,"s3":600},
    {"goal":"lotus","pieces":16,"lotus":6,"target":6,"stones":8,"ice":2,"blossom":3,"s2":310,"s3":360},
    {"goal":"clear","pieces":21,"stones":16,"ice":4,"shape":"islands","blossom":2,"hard":true,"s2":600,"s3":700},
    {"goal":"frog","pieces":17,"frogs":4,"target":4,"hop":3,"stones":8,"ice":2,"s2":370,"s3":410},
    {"goal":"score","pieces":18,"target":380,"stones":13,"ice":3,"s2":480,"s3":510},
    {"goal":"frog","pieces":10,"frogs":4,"target":4,"hop":3,"stones":8,"ice":2,"bamboo":2,"grow":6,"shape":"river","s2":360,"s3":530},
    {"goal":"koi","pieces":16,"koi":5,"target":5,"stones":13,"ice":2,"bamboo":2,"grow":6,"blossom":2,"s2":340,"s3":400},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":3,"stones":8,"ice":2,"bamboo":2,"grow":6,"shape":"pond","blossom":2,"hard":true,"s2":290,"s3":330},
    {"goal":"clear","pieces":23,"stones":14,"ice":3,"bamboo":2,"grow":6,"s2":530,"s3":610},
    {"goal":"frog","pieces":16,"frogs":4,"target":4,"hop":3,"stones":8,"ice":2,"bamboo":2,"grow":6,"s2":350,"s3":390},
    {"goal":"lotus","pieces":20,"lotus":7,"target":7,"stones":9,"ice":2,"shape":"river","s2":550,"s3":740},
    {"goal":"frog","pieces":9,"frogs":4,"target":4,"hop":3,"stones":8,"ice":2,"shape":"diamond","s2":1170,"s3":1880},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":3,"stones":8,"ice":2,"hard":true,"s2":280,"s3":310},
    {"goal":"bamboo","pieces":16,"bamboo":5,"grow":4,"stones":6,"ice":1,"s2":340,"s3":390},
    {"goal":"frog","pieces":15,"frogs":4,"target":4,"hop":3,"stones":8,"ice":2,"s2":320,"s3":360},
    {"goal":"harmony","pieces":15,"target":1,"stones":8,"ice":2,"s2":410,"s3":470},
    {"goal":"koi","pieces":15,"koi":7,"target":7,"stones":13,"ice":2,"blossom":2,"s2":300,"s3":330},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":3,"stones":8,"ice":2,"shape":"river","hard":true,"s2":440,"s3":750},
    {"goal":"harmony","pieces":12,"target":1,"stones":9,"ice":2,"s2":340,"s3":390},
    {"goal":"frog","pieces":13,"frogs":4,"target":4,"hop":3,"stones":9,"ice":2,"blossom":2,"s2":300,"s3":330},
    {"goal":"bamboo","pieces":13,"bamboo":5,"grow":4,"stones":7,"ice":2,"s2":280,"s3":330},
    {"goal":"clear","pieces":27,"stones":15,"ice":4,"blossom":2,"s2":620,"s3":690},
    {"goal":"koi","pieces":13,"koi":6,"target":6,"stones":15,"ice":2,"blossom":2,"hard":true,"s2":280,"s3":320},
    {"goal":"clear","pieces":29,"stones":15,"ice":4,"shape":"river","blossom":2,"p2":3,"p3":9},
    {"goal":"frog","pieces":12,"frogs":4,"target":4,"hop":3,"stones":9,"ice":2,"bamboo":2,"grow":6,"blossom":2,"s2":280,"s3":320},
    {"goal":"clear","pieces":25,"stones":15,"ice":4,"bamboo":2,"grow":6,"blossom":2,"s2":610,"s3":680},
    {"goal":"lotus","pieces":22,"lotus":7,"target":7,"stones":9,"ice":2,"shape":"stream","blossom":2,"s2":520,"s3":660},
    {"goal":"clear","pieces":8,"stones":22,"ice":5,"shape":"diamond","blossom":2,"hard":true,"p2":1,"p3":2},
    {"goal":"koi","pieces":13,"koi":7,"target":7,"stones":14,"ice":2,"bamboo":2,"grow":6,"s2":340,"s3":370},
    {"goal":"frog","pieces":14,"frogs":4,"target":4,"hop":3,"stones":9,"ice":2,"s2":290,"s3":330},
    {"goal":"lotus","pieces":27,"lotus":7,"target":7,"stones":10,"ice":3,"shape":"diamond","p2":1,"p3":6},
    {"goal":"score","pieces":18,"target":440,"stones":14,"ice":4,"bamboo":2,"grow":6,"s2":520,"s3":550},
    {"goal":"bamboo","pieces":10,"bamboo":6,"grow":4,"stones":7,"ice":2,"shape":"stream","blossom":2,"hard":true,"s2":240,"s3":270},
    {"goal":"clear","pieces":17,"stones":15,"ice":4,"shape":"islands","fall":6,"s2":450,"s3":510},
    {"goal":"koi","pieces":13,"koi":7,"target":7,"stones":15,"ice":2,"fall":6,"s2":300,"s3":350},
    {"goal":"frog","pieces":13,"frogs":5,"target":5,"hop":2,"stones":9,"ice":2,"bamboo":2,"grow":6,"shape":"islands","fall":6,"s2":310,"s3":360},
    {"goal":"score","pieces":19,"target":450,"stones":15,"ice":4,"s2":540,"s3":570},
    {"goal":"frog","pieces":14,"frogs":6,"target":6,"hop":2,"stones":9,"ice":2,"fall":4,"hard":true,"s2":320,"s3":360},
    {"goal":"harmony","pieces":22,"target":1,"stones":9,"ice":3,"shape":"river","fall":5,"s2":640,"s3":910},
    {"goal":"clear","pieces":22,"stones":16,"ice":4,"fall":6,"s2":550,"s3":610},
    {"goal":"harmony","pieces":16,"target":1,"stones":9,"ice":3,"fall":4,"s2":420,"s3":480},
    {"goal":"bamboo","pieces":13,"bamboo":5,"grow":3,"stones":7,"ice":2,"shape":"pond","fall":6,"s2":300,"s3":350},
    {"goal":"clear","pieces":20,"stones":19,"ice":5,"bamboo":2,"grow":6,"blossom":2,"fall":6,"hard":true,"s2":540,"s3":620},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":2,"stones":9,"ice":3,"bamboo":2,"grow":6,"shape":"stream","fall":5,"s2":300,"s3":340},
    {"goal":"lotus","pieces":15,"lotus":8,"target":8,"stones":10,"ice":3,"fall":4,"s2":330,"s3":390},
    {"goal":"koi","pieces":12,"koi":6,"target":6,"stones":15,"ice":3,"bamboo":2,"grow":6,"shape":"islands","fall":5,"s2":280,"s3":350},
    {"goal":"clear","pieces":21,"stones":16,"ice":5,"bamboo":2,"grow":6,"shape":"corners","fall":6,"s2":790,"s3":1060},
    {"goal":"frog","pieces":14,"frogs":6,"target":6,"hop":2,"stones":9,"ice":3,"fall":6,"hard":true,"s2":310,"s3":360},
    {"goal":"score","pieces":20,"target":470,"stones":15,"ice":7,"s2":560,"s3":600},
    {"goal":"clear","pieces":27,"stones":16,"ice":8,"s2":640,"s3":730},
    {"goal":"frog","pieces":13,"frogs":5,"target":5,"hop":2,"stones":10,"ice":5,"blossom":2,"fall":5,"s2":300,"s3":330},
    {"goal":"score","pieces":20,"target":480,"stones":15,"ice":7,"s2":570,"s3":610},
    {"goal":"clear","pieces":22,"stones":19,"ice":9,"blossom":2,"fall":6,"hard":true,"s2":600,"s3":670},
    {"goal":"bamboo","pieces":15,"bamboo":6,"grow":3,"stones":8,"ice":4,"shape":"diamond","blossom":2,"p2":1,"p3":2},
    {"goal":"clear","pieces":27,"stones":16,"ice":8,"fall":4,"s2":700,"s3":840},
    {"goal":"lotus","pieces":21,"lotus":8,"target":8,"stones":11,"ice":5,"bamboo":2,"grow":6,"blossom":2,"s2":470,"s3":560},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":2,"stones":10,"ice":5,"shape":"stream","blossom":2,"s2":290,"s3":320},
    {"goal":"lotus","pieces":20,"lotus":9,"target":9,"stones":11,"ice":5,"bamboo":2,"grow":6,"shape":"pond","hard":true,"s2":540,"s3":590},
    {"goal":"score","pieces":22,"target":490,"stones":16,"ice":8,"s2":630,"s3":660},
    {"goal":"lotus","pieces":24,"lotus":8,"target":8,"stones":11,"ice":6,"shape":"corners","blossom":2,"s2":670,"s3":920},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":2,"stones":10,"ice":5,"blossom":2,"s2":270,"s3":310},
    {"goal":"harmony","pieces":20,"target":1,"stones":10,"ice":5,"s2":510,"s3":600},
    {"goal":"frog","pieces":14,"frogs":6,"target":6,"hop":2,"stones":10,"ice":5,"shape":"pond","hard":true,"s2":350,"s3":400},
    {"goal":"score","pieces":19,"target":500,"stones":16,"ice":5,"bamboo":2,"grow":6,"s2":570,"s3":600},
    {"goal":"frog","pieces":14,"frogs":5,"target":5,"hop":2,"stones":10,"ice":3,"s2":320,"s3":360},
    {"goal":"lotus","pieces":22,"lotus":8,"target":8,"stones":11,"ice":4,"blossom":2,"s2":450,"s3":530},
    {"goal":"koi","pieces":26,"koi":6,"target":6,"stones":16,"ice":3,"bamboo":2,"grow":6,"shape":"diamond","p2":3,"p3":8},
    {"goal":"frog","pieces":10,"frogs":6,"target":6,"hop":2,"stones":10,"ice":3,"shape":"river","hard":true,"s2":420,"s3":660},
    {"goal":"lotus","pieces":19,"lotus":8,"target":8,"stones":11,"ice":4,"fall":5,"s2":470,"s3":520},
    {"goal":"harmony","pieces":21,"target":1,"stones":10,"ice":3,"bamboo":2,"grow":6,"shape":"islands","fall":6,"s2":530,"s3":630},
    {"goal":"lotus","pieces":21,"lotus":8,"target":8,"stones":11,"ice":4,"bamboo":2,"grow":6,"shape":"river","blossom":2,"fall":6,"s2":790,"s3":980},
    {"goal":"frog","pieces":12,"frogs":5,"target":5,"hop":2,"stones":10,"ice":3,"shape":"islands","fall":6,"s2":310,"s3":350},
    {"goal":"koi","pieces":14,"koi":7,"target":7,"stones":17,"ice":3,"bamboo":2,"grow":6,"shape":"corners","fall":4,"hard":true,"s2":430,"s3":490},
    {"goal":"frog","pieces":18,"frogs":5,"target":5,"hop":2,"stones":10,"ice":3,"s2":420,"s3":460},
    {"goal":"harmony","pieces":12,"target":1,"stones":10,"ice":3,"blossom":2,"fall":5,"s2":340,"s3":370},
    {"goal":"koi","pieces":14,"koi":9,"target":9,"stones":16,"ice":3,"s2":330,"s3":370},
    {"goal":"lotus","pieces":19,"lotus":8,"target":8,"stones":12,"ice":4,"bamboo":2,"grow":6,"fall":6,"s2":450,"s3":510},
    {"goal":"clear","pieces":27,"stones":21,"ice":7,"bamboo":2,"grow":6,"hard":true,"s2":720,"s3":820}
  ]/*END*/;

  function levelDef(n) {
    if (n <= PER) return CH1[n - 1];
    if (n - PER <= TUNED.length) return TUNED[n - PER - 1];
    // Past the tuned levels: a tuned level from chapters 6-10 again, on a new layout
    // These levels are on the lotus trail: lotus flowers float on every pond, three where lotus is not the goal.
    // The flowers lie on empty cells, so the board is as hard as before.
    if (TUNED.length >= 135) {
      const L = Object.assign({}, TUNED[60 + (n - 151) % 75], { trail: true });
      if (!L.lotus) L.lotus = 3;
      return L;
    }
    return generate(n);
  }
  const goalTarget = L => L.goal === "clear" ? L.stones : L.goal === "bamboo" ? L.bamboo : L.goal === "frog" ? L.frogs : L.target;

  // The starting board: the same every time the level is played
  function layout(n, L) {
    const board = Array(N * N).fill(0), preset = {}, ice = {}, lotus = {}, blossom = {};
    const r = seeded(hashSeed("mental-block-level-" + n));
    // Water first, so nothing is placed on it (it uses no random numbers, so boards without a shape stay as they were)
    if (L.shape && SHAPES[L.shape]) SHAPES[L.shape]().forEach(i => { board[i] = HOLE; });
    let left = L.stones || 0, koi = L.koi || 0, iceLeft = L.ice || 0, guard = 0;
    while (left > 0 && guard++ < 3000) {
      const i = Math.floor(r() * N * N);
      if (board[i]) continue;
      const isKoi = koi > 0;
      board[i] = isKoi ? KOI : 1 + Math.floor(r() * COLORS);
      if (anyFull(board)) { board[i] = 0; continue; }
      preset[i] = true;
      if (isKoi) koi--;
      else if (iceLeft > 0) { ice[i] = true; iceLeft--; }
      left--;
    }
    // Bamboo and lotus come last, so chapter 1 keeps the layouts it always had
    let bamboo = L.bamboo || 0;
    guard = 0;
    while (bamboo > 0 && guard++ < 3000) {
      const i = Math.floor(r() * N * N);
      if (board[i]) continue;
      board[i] = BAMBOO;
      if (anyFull(board)) { board[i] = 0; continue; }
      bamboo--;
    }
    let lo = L.lotus || 0;
    guard = 0;
    while (lo > 0 && guard++ < 3000) {
      const i = Math.floor(r() * N * N);
      if (board[i] || lotus[i]) continue;
      lotus[i] = true;
      lo--;
    }
    // Frogs sit on empty cells
    let fr = L.frogs || 0;
    guard = 0;
    while (fr > 0 && guard++ < 3000) {
      const i = Math.floor(r() * N * N);
      if (board[i] || lotus[i]) continue;
      board[i] = FROG;
      if (anyFull(board)) { board[i] = 0; continue; }
      fr--;
    }
    // Blossoms open on some ordinary starting stones (not koi, not ice)
    const plain = Object.keys(preset).map(Number).filter(i => board[i] >= 1 && board[i] <= COLORS && !ice[i]);
    for (let k = 0; k < (L.blossom || 0) && plain.length; k++) blossom[plain.splice(Math.floor(r() * plain.length), 1)[0]] = true;
    return { board, preset, ice, lotus, blossom };
  }

  // A cell next to (r, c) that is empty, within `reach`, and would not finish a line. -1 if none.
  function freeNear(board, i, reach, rnd) {
    const r = Math.floor(i / N), c = i % N, spots = [];
    for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < N && cc < N && !board[rr * N + cc]) spots.push(rr * N + cc);
    }
    while (spots.length) {
      const j = spots.splice(Math.floor(rnd() * spots.length), 1)[0];
      board[j] = FROG;
      const full = anyFull(board);
      board[j] = 0;
      if (!full) return j;
    }
    return -1;
  }
  // Every frog hops to a free cell up to two away. Returns the hops as [from, to].
  function hopFrogs(board, rnd) {
    const hops = [];
    board.forEach((v, i) => { if (v === FROG) hops.push(i); });
    return hops.map(i => {
      const j = freeNear(board, i, 2, rnd);
      if (j < 0) return null;
      board[i] = 0;
      board[j] = FROG;
      return [i, j];
    }).filter(Boolean);
  }
  // A maple leaf drifts down onto an empty cell that would not finish a line. Returns the cell, or -1.
  function dropLeaf(board, rnd) {
    const empty = [];
    board.forEach((v, i) => { if (!v) empty.push(i); });
    while (empty.length) {
      const j = empty.splice(Math.floor(rnd() * empty.length), 1)[0];
      board[j] = LEAF;
      if (!anyFull(board)) return j;
      board[j] = 0;
    }
    return -1;
  }
  // Cleared cells, plus everything around each blossom stone among them (and around blossoms that reaches, in turn)
  function withBlossoms(cells, board, blossom) {
    const out = new Set(cells), queue = [...out].filter(i => blossom && blossom[i]);
    const opened = new Set();
    while (queue.length) {
      const i = queue.shift();
      if (opened.has(i)) continue;
      opened.add(i);
      const r = Math.floor(i / N), c = i % N;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc, j = rr * N + cc;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N || !board[j] || board[j] === HOLE || out.has(j)) continue;
        out.add(j);
        if (blossom[j]) queue.push(j);
      }
    }
    return { cells: [...out], opened: [...opened] };
  }

  // Bamboo spreads into an empty cell next to it, never one that would finish a line.
  // Returns the new cell, or -1 when there is nowhere to grow.
  function growBamboo(board, rnd) {
    const spots = [];
    board.forEach((v, i) => {
      if (v !== BAMBOO) return;
      const r = Math.floor(i / N), c = i % N;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => {
        const rr = r + a, cc = c + b;
        if (rr >= 0 && cc >= 0 && rr < N && cc < N && !board[rr * N + cc]) spots.push(rr * N + cc);
      });
    });
    while (spots.length) {
      const j = spots.splice(Math.floor(rnd() * spots.length), 1)[0];
      if (board[j]) continue;
      board[j] = BAMBOO;
      if (!anyFull(board)) return j;
      board[j] = 0;
    }
    return -1;
  }

  const api = { PER, BAMBOO, HOLE, FROG, LEAF, SHAPES, CHAPTERS, chapterOf, chapterName, generate, levelDef, goalTarget, layout, growBamboo,
    hopFrogs, dropLeaf, withBlossoms, TUNED };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KoiLevels = api;
})(typeof window !== "undefined" ? window : globalThis);
