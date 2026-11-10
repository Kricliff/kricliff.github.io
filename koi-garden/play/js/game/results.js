// Koi Garden: The breathing break, game over, the daily result card and the ad breaks.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Breathing break and game over ---------- */
let breathTimer = null, breathAfter = null;
function showBreak(after) {
  breathAfter = after;
  $("tip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  openCard("breakCard");
  const ring = $("ring"), text = $("breathText"), count = $("breathCount");
  const steps = [];
  for (let k = 0; k < 3; k++) steps.push(["Breathe in", 4, true], ["Hold", 2, true], ["Breathe out", 6, false]);
  let idx = 0;
  const run = () => {
    if (idx >= steps.length) { text.textContent = "Well done"; count.textContent = ""; ring.classList.remove("in"); return; }
    const [label, secs, inhale] = steps[idx++];
    text.textContent = label;
    count.textContent = `breath ${Math.floor((idx - 1) / 3) + 1} of 3`;
    ring.style.transitionDuration = secs + "s";
    ring.classList.toggle("in", inhale);
    if (label === "Breathe in") bowl(0, 0.03);
    breathTimer = setTimeout(run, secs * 1000);
  };
  clearTimeout(breathTimer);
  text.textContent = "Get ready";
  count.textContent = "";
  breathTimer = setTimeout(run, 600);
}
$("breakDone").addEventListener("click", () => {
  clearTimeout(breathTimer);
  $("ring").classList.remove("in");
  closeOverlay();
  const f = breathAfter; breathAfter = null;
  if (f) f();
});

function showOver() {
  if (!S.statsSent) { S.statsSent = true; track("endless_end", { data: { score: S.score, level: S.level || "normal" } }); }
  paintEndlessPick();
  gcPost(GC_BOARDS[S.level] || GC_BOARDS.normal, S.score, "overRank");
  $("overScore").textContent = S.score;
  $("overEyebrow").textContent = S.newBest ? "New personal best" : "No moves left";
  $("overStats").innerHTML = `${S.level && S.level !== "normal" ? ENDLESS_LEVELS[S.level].name + " · best" : "Best"} <b>${endlessBest()}</b> · <b>${S.clears}</b> clears · <b>${S.harmony}</b> Harmony`
    + (S.pearls ? ` · <b>+${S.pearls}</b> pearls` : "");
  $("overQuote").textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  $("continueBtn").hidden = S.continued;
  $("overTasks").innerHTML = tasksLabel();
  openCard("overCard");
}
$("continueBtn").addEventListener("click", () => {
  showAd("continue", () => {
    // Reward: rake the centre 5×5 clear and deal two fresh pieces
    for (let r = 2; r < 7; r++) for (let c = 2; c < 7; c++) S.board[r * N + c] = 0;
    S.continued = true;
    S.over = false;
    S.prev = null;
    S.tray = dealHand();
    closeOverlay();
    render();
    bowl(3);
  });
});
$("againBtn").addEventListener("click", () => newGame(true, prefs.endless));
$("overTasks").addEventListener("click", () => openTasks(showOver));
$("dailyTasks").addEventListener("click", () => openTasks(showDailyCard));
$("overBreathe").addEventListener("click", () => showBreak(showOver));
$("restart").addEventListener("click", () => {
  if (!overlay.hidden || drag) return;
  if (S.mode === "daily") {
    if (S.over) finishDaily();
    else if (S.practice) { if (S.weekly) startWeekly(true); else startDaily(true); render(); }
  } else if (S.mode === "journey") playLevel(S.level, false);
  else newGame(false);
});

/* ---------- Daily result ---------- */
function recordDaily() {
  if (daily.last !== S.day) {
    daily.streak = daily.last === dayOffset(-1) ? daily.streak + 1 : 1;
    daily.last = S.day;
    daily.longest = Math.max(daily.longest || 0, daily.streak);
    if (daily.streak % 7 === 0 || RARE_KOI.some(r => r.at === daily.streak)) S.milestone = daily.streak;
  }
  // Pearls for the day's official Daily, once a day
  if (daily.best[S.day] === undefined) { journey.pearls += DAILY_PEARLS; S.pearls = DAILY_PEARLS; saveJourney(); }
  daily.best[S.day] = S.score;
  setTimeout(syncNativeReminders, 0);
  tasksAdd({ daily: 1 });
  setTimeout(() => checkStyleUnlocks(false), 1500);
  daily.stats = Object.assign(daily.stats || {}, { [S.day]: { clears: S.clears, harmony: S.harmony } });
  const keys = Object.keys(daily.best).sort();
  while (keys.length > 30) { const k = keys.shift(); delete daily.best[k]; if (daily.stats) delete daily.stats[k]; }
  saveDaily();
}
// The official score of the week's challenge: pearls the first time, and the last twelve weeks are kept
function recordWeekly() {
  if (weekly.best[S.day] === undefined) { journey.pearls += WEEKLY_PEARLS; S.pearls = WEEKLY_PEARLS; saveJourney(); }
  weekly.best[S.day] = S.score;
  const keys = Object.keys(weekly.best).sort();
  while (keys.length > 12) delete weekly.best[keys.shift()];
  saveWeekly();
}
// The score a friend sent along in a challenge link, when it is for the board just played
const friendScore = () => challenge && challenge.day === S.day && !!challenge.weekly === !!S.weekly ? challenge.score : 0;
function shareText() {
  if (S.weekly) return `Koi Garden · Weekly #${S.num}\n⭐ ${weekly.best[S.day]} points\n✨ ${S.harmony} Harmony · ${S.clears} clears`;
  const day = S.day, st = (daily.stats || {})[day] || { clears: S.clears, harmony: S.harmony };
  const s = liveStreak();
  return `Koi Garden · Daily #${S.num}\n⭐ ${daily.best[day]} points\n✨ ${st.harmony} Harmony · ${st.clears} clears\n🔥 ${s}-day streak`;
}
function finishDaily() {
  if (S.weekly) {
    if (!S.practice && !S.recorded) { recordWeekly(); S.recorded = true; }
    showDailyCard();
    return;
  }
  if (!S.statsSent) { S.statsSent = true; track("daily_end", { data: { score: S.score, practice: !!S.practice } }); }
  if (!S.practice && !S.recorded) { recordDaily(); S.recorded = true; }
  if (S.milestone) {
    const m = S.milestone;
    S.milestone = 0;
    const rare = RARE_KOI.find(r => r.at === m);
    const isNew = rare && !journey.koi.includes(rareIndex(rare));
    if (isNew) { journey.koi.push(rareIndex(rare)); saveJourney(); initKoi(); }
    $("rewardEyebrow").textContent = `${m}-day streak`;
    $("rewardNum").textContent = m;
    $("rewardKoi").hidden = !isNew;
    if (isNew) $("rewardKoi").src = rare.img;
    $("rewardTitle").textContent = isNew ? `${rare.name} joins your pond` : `${m} calm days in a row`;
    $("rewardText").textContent = isNew
      ? `A rare koi, given only for showing up ${m} days in a row. You will find it in your collection and in your pond.`
      : "You have shown up for yourself every day. That habit is the real reward.";
    openCard("rewardCard");
    bowl(6, 0.05);
    return;
  }
  showDailyCard();
}
$("rewardUse").addEventListener("click", () => openPond(showDailyCard));
$("rewardLater").addEventListener("click", showDailyCard);
function showDailyCard() {
  const W = S.weekly, store = W ? weekly : daily, name = W ? "Weekly" : "Daily";
  const allPlaced = S.dealt >= piecesTotal() && !S.tray.some(Boolean);
  const official = store.best[S.day];
  $("dailyEyebrow").textContent = `${S.practice ? "Practice" : "Official"} · ${name} #${S.num} · ${allPlaced ? `all ${piecesTotal()} pieces placed` : "no moves left"}`;
  $("dailyScore").textContent = S.score;
  // A friend's score from a challenge link, set against the official score
  const friend = friendScore(), diff = official - friend;
  const versus = !friend || official === undefined ? "" : (diff > 0 ? `You beat your friend’s <b>${friend}</b> by <b>${diff}</b>`
    : diff < 0 ? `<b>${-diff}</b> short of your friend’s <b>${friend}</b>` : `Level with your friend at <b>${friend}</b>`) + "<br>";
  let line;
  if (W) {
    const top = Math.max(0, ...Object.values(weekly.best).map(v => +v || 0));
    line = `Your best week <b>${top}</b>`;
  } else {
    const s = liveStreak();
    const next = RARE_KOI.find(r => r.at > s && !journey.koi.includes(rareIndex(r)));
    line = `Streak <b>${s}</b> ${s === 1 ? "day" : "days"}` + (next ? ` · ${next.at - s} more ${next.at - s === 1 ? "day" : "days"} for the rare ${next.name}` : "");
  }
  $("dailyStats").innerHTML = (S.practice ? `Official score ${W ? "this week" : "today"} <b>${official}</b><br>` : "")
    + (S.pearls ? `<b>+${S.pearls}</b> pearls for ${W ? "this week’s challenge" : "today’s Daily"}<br>` : "") + versus + line;
  syncRemind();
  $("dailyRemind").hidden = W;
  $("shareText").textContent = shareText();
  $("copyBtn").textContent = nativeApp ? "Share result" : "Copy result";
  $("dailyChallenge").hidden = official === undefined;
  $("dailyChallenge").textContent = "Challenge a friend";
  $("dailyAgain").innerHTML = `<span class="tag">Ad</span>Practise ${W ? "this week’s" : "today’s"} board`;
  const until = W ? thisWeek().end : (() => { const m = new Date(); m.setHours(24, 0, 0, 0); return m; })();
  const mins = Math.max(1, Math.round((until - new Date()) / 60000)), days = Math.floor(mins / 1440);
  $("nextDaily").textContent = days ? `New challenge in ${days} d ${Math.floor((mins % 1440) / 60)} h` : `New challenge in ${Math.floor(mins / 60)} h ${mins % 60} min`;
  $("dailyTasks").innerHTML = tasksLabel();
  openCard("dailyCard");
  bowl(4, 0.05);
  // Only the official score goes to the leaderboard
  if (!S.practice) gcPost(W ? GC_BOARDS.weekly : GC_BOARDS.daily, official, "dailyRank"); else $("dailyRank").hidden = true;
}
// "Challenge a friend": a link to the same board with the score to beat
function challengeLink() {
  const score = (S.weekly ? weekly : daily).best[S.day];
  return `${CHALLENGE_URL}?d=${S.day}&s=${score}${S.weekly ? "&w=1" : ""}`;
}
$("dailyChallenge").addEventListener("click", () => {
  const btn = $("dailyChallenge"), score = (S.weekly ? weekly : daily).best[S.day];
  const text = `I scored ${score} on Koi Garden ${S.weekly ? "Weekly" : "Daily"} #${S.num}. Same board for you: can you beat it?`, url = challengeLink();
  if (nativeApp && window.Capacitor.Plugins.Share) { window.Capacitor.Plugins.Share.share({ text, url }).catch(() => {}); return; }
  try { navigator.clipboard.writeText(`${text} ${url}`).then(() => { btn.textContent = "Link copied"; }, () => { btn.textContent = url; }); }
  catch (e) { btn.textContent = url; }
});
$("copyBtn").addEventListener("click", () => {
  const btn = $("copyBtn"), txt = shareText();
  if (nativeApp && window.Capacitor.Plugins.Share) { window.Capacitor.Plugins.Share.share({ text: txt }).catch(() => {}); return; }
  const selectIt = () => {
    const r = document.createRange();
    r.selectNodeContents($("shareText"));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    btn.textContent = "Text selected. Copy it from your menu";
  };
  try {
    navigator.clipboard.writeText(txt).then(() => { btn.textContent = "Copied"; }, selectIt);
  } catch (e) { selectIt(); }
});
$("dailyRemind").addEventListener("click", () => openRemind(() => openCard("dailyCard")));
$("dailyAgain").addEventListener("click", () => showAd("practice", () => { if (S.weekly) startWeekly(true); else startDaily(true); closeOverlay(); render(); }));
$("dailyJourney").addEventListener("click", () => switchMode("journey"));

/* ---------- Ads (placeholders) ---------- */
let adTimer = null;
const AD_COPY = {
  continue: ["Rewarded video · placeholder", "A 15–30 second video plays here in the real app. When it ends, the centre of your pond is cleared and you can keep going."],
  pieces: ["Rewarded video · placeholder", "A short video plays here in the real app. When it ends, you get 10 extra pieces for this level. Finishing with extra pieces gives 1 star."],
  skip: ["Rewarded video · placeholder", "A short video plays here in the real app. When it ends, this level counts as passed and the next one opens."],
  double: ["Rewarded video · placeholder", "A short video plays here in the real app. When it ends, the pearls from this level are doubled."],
  hint: ["Rewarded video · placeholder", "Not enough pearls. A short video plays here in the real app, then the best spot lights up."],
  swap: ["Rewarded video · placeholder", "Not enough pearls. A short video plays here in the real app, then both pieces are swapped for new ones."],
  undo: ["Rewarded video · placeholder", "A short video plays here in the real app. When it ends, your last move is undone."],
  practice: ["Rewarded video · placeholder", "A short video plays here in the real app. Then you can practise today’s board. Your official score stays the same."],
  streak: ["Rewarded video · placeholder", "A short video plays here in the real app. When it ends, your streak is saved. You can do this once a week."],
  interstitial: ["Ad break · placeholder", "Between rounds, at most every few minutes and never in your first rounds. Skippable after 5 seconds in the real app."]
};
// In the iPhone app the real AdMob ads play instead of the placeholder card
async function nativeAd(kind, onDone) {
  duck(true);
  if (kind === "interstitial") { await window.MBNative.showInterstitial(); duck(false); onDone(); return; }
  const result = await window.MBNative.showRewarded();
  duck(false);
  // If no video can be loaded, the player still gets the reward rather than a button that does nothing
  if (result === "rewarded" || result === "unavailable") { ads.lastReward = Date.now(); track("ad", { data: { kind } }); onDone(); }
}
function showAd(kind, onDone) {
  if (nativeApp) { nativeAd(kind, onDone); return; }
  const rewarded = kind !== "interstitial";
  $("adKind").textContent = AD_COPY[kind][0];
  $("adText").textContent = AD_COPY[kind][1];
  const btn = $("adBtn");
  let left = rewarded ? 5 : 3;
  btn.disabled = true;
  btn.textContent = rewarded ? "Wait…" : "Skip in 3";
  $("adCount").textContent = left;
  openCard("adCard");
  clearInterval(adTimer);
  adTimer = setInterval(() => {
    left--;
    $("adCount").textContent = Math.max(left, 0);
    if (!rewarded && left > 0) btn.textContent = `Skip in ${left}`;
    if (left <= 0) {
      clearInterval(adTimer);
      btn.disabled = false;
      btn.textContent = rewarded ? "Claim reward" : "Continue";
      btn.focus({ preventScroll: true });
    }
  }, 1000);
  duck(true);
  btn.onclick = () => {
    btn.onclick = null;
    duck(false);
    if (rewarded) { ads.lastReward = Date.now(); track("ad", { data: { kind } }); }
    onDone();
  };
}

/* ---------- Game Center leaderboards (in the app only) ----------
   One board for each Endless level and one for the Daily, set up in App Store Connect with these IDs.
   The cards show the player's place among friends and roughly among everyone, not a long list:
   a calm game should not make most players feel far behind. Apple's own screen has the full lists. */
const GC_BOARDS = { easy: "koigarden.endless.easy", normal: "koigarden.endless.normal", hard: "koigarden.endless.hard", daily: "koigarden.daily.board", weekly: "koigarden.weekly.board" };
const gcOn = () => nativeApp && window.MBNative && window.MBNative.hasGames;
let gcSigned = null;
function gcReady() {
  if (!gcOn()) return Promise.resolve(false);
  if (!gcSigned) gcSigned = window.MBNative.gcSignIn().then(ok => { if (!ok) gcSigned = null; return ok; });
  return gcSigned;
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
function placeText(p) {
  if (!p || !p.rank) return "";
  const parts = [];
  if (p.friendTotal > 1 && p.friendRank) parts.push(`${ordinal(p.friendRank)} of ${p.friendTotal} friends`);
  // With few players a share means little, so show the place itself
  if (p.total >= 20) parts.push(`top ${Math.max(1, Math.ceil((p.rank / p.total) * 100))} % of players`);
  else if (p.total > 1) parts.push(`${ordinal(p.rank)} of ${p.total} players`);
  return parts.join(" · ");
}
// Send the score, then show the place on the card once Game Center answers
function gcPost(board, score, rowId) {
  const row = $(rowId);
  row.hidden = true;
  if (!gcOn()) return;
  row.dataset.board = board;
  gcReady().then(ok => {
    if (!ok) return;
    window.MBNative.gcSubmit(board, score)
      .then(() => window.MBNative.gcPlace(board))
      .then(p => {
        if (row.dataset.board !== board) return;
        row.querySelector("span").textContent = placeText(p) || "Your score is on the leaderboard";
        row.hidden = false;
      });
  });
}
$("overBoard").addEventListener("click", () => window.MBNative && window.MBNative.gcShow($("overRank").dataset.board));
$("dailyBoard").addEventListener("click", () => window.MBNative && window.MBNative.gcShow($("dailyRank").dataset.board));

/* ---------- Records: the player's own bests, on the phone, with or without Game Center ---------- */
let recordsBack = null;
const recTile = (label, value, sub) => `<div class="rec-tile"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
function openRecords(back) {
  recordsBack = back || null;
  $("recEndless").innerHTML = recTile("Easy", bestEasy || "–", "3 pieces") + recTile("Normal", best || "–", "2 pieces") + recTile("Hard", bestHard || "–", "1 piece");
  // The Daily: what is kept on the phone (the last 30 days)
  const days = Object.entries(daily.best || {}).sort(([a], [b]) => a < b ? -1 : 1);
  const scores = days.map(([, v]) => +v || 0);
  const top = scores.length ? Math.max(...scores) : 0;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const longest = Math.max(daily.longest || 0, liveStreak());
  $("recDailySub").textContent = days.length ? `· ${days.length} ${days.length === 1 ? "day" : "days"} played` : "";
  $("recDaily").innerHTML = recTile("Best day", top || "–") + recTile("Average", avg || "–") + recTile("Streak", liveStreak(), longest > liveStreak() ? `longest ${longest}` : "");
  // The last 14 days as small bars; days not played stay empty
  const bars = [];
  for (let k = 13; k >= 0; k--) {
    const key = dayOffset(-k), v = +(daily.best || {})[key] || 0;
    bars.push(`<i class="${v ? "" : "none"}${k === 0 ? " today" : ""}" style="--h:${top ? Math.max(6, Math.round(v / top * 100)) : 6}%"></i>`);
  }
  $("recBars").innerHTML = bars.join("");
  $("recBarsNote").textContent = days.length ? "The last 14 days" : "Play the Daily to start your record";
  const weeks = Object.values(weekly.best || {}).map(v => +v || 0), wk = thisWeek();
  $("recWeekly").innerHTML = recTile("This week", weekly.best[wk.key] !== undefined ? weekly.best[wk.key] : "–", `week ${wk.num}`)
    + recTile("Best week", weeks.length ? Math.max(...weeks) : "–") + recTile("Weeks played", weeks.length);
  const stars = Object.values(journey.stars).reduce((a, b) => a + (+b || 0), 0);
  const threes = Object.values(journey.stars).filter(v => +v === 3).length;
  $("recJourney").innerHTML = recTile("Level", currentLevel()) + recTile("Stars", stars, `${threes} with 3★`) + recTile("Koi", journey.koi.length, `of ${ALL_KOI.length}`);
  openCard("recordsCard");
}
$("recordsDone").addEventListener("click", () => { const b = recordsBack; recordsBack = null; if (b) b(); else closeOverlay(); });
$("homeRecords").addEventListener("click", () => { if (overlay.hidden) openRecords(closeOverlay); });
$("overRecords").addEventListener("click", () => openRecords(resumeOverCard));
$("dailyRecords").addEventListener("click", () => openRecords(showDailyCard));
