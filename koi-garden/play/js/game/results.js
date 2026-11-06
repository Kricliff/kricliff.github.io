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
  $("overScore").textContent = S.score;
  $("overEyebrow").textContent = S.newBest ? "New personal best" : "No moves left";
  $("overStats").innerHTML = `${S.level && S.level !== "normal" ? ENDLESS_LEVELS[S.level].name + " · best" : "Best"} <b>${endlessBest()}</b> · <b>${S.clears}</b> clears · <b>${S.harmony}</b> Harmony`;
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
    else if (S.practice) { startDaily(true); render(); }
  } else if (S.mode === "journey") playLevel(S.level, false);
  else newGame(false);
});

/* ---------- Daily result ---------- */
function recordDaily() {
  if (daily.last !== S.day) {
    daily.streak = daily.last === dayOffset(-1) ? daily.streak + 1 : 1;
    daily.last = S.day;
    if (daily.streak % 7 === 0 || RARE_KOI.some(r => r.at === daily.streak)) S.milestone = daily.streak;
  }
  daily.best[S.day] = S.score;
  setTimeout(syncNativeReminders, 0);
  tasksAdd({ daily: 1 });
  setTimeout(() => checkStyleUnlocks(false), 1500);
  daily.stats = Object.assign(daily.stats || {}, { [S.day]: { clears: S.clears, harmony: S.harmony } });
  const keys = Object.keys(daily.best).sort();
  while (keys.length > 30) { const k = keys.shift(); delete daily.best[k]; if (daily.stats) delete daily.stats[k]; }
  saveDaily();
}
function shareText() {
  const day = S.day, st = (daily.stats || {})[day] || { clears: S.clears, harmony: S.harmony };
  const s = liveStreak();
  return `Koi Garden · Daily #${S.num}\n⭐ ${daily.best[day]} points\n✨ ${st.harmony} Harmony · ${st.clears} clears\n🔥 ${s}-day streak`;
}
function finishDaily() {
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
  const allPlaced = S.dealt >= DAILY_PIECES && !S.tray.some(Boolean);
  const official = daily.best[S.day];
  $("dailyEyebrow").textContent = `${S.practice ? "Practice" : "Official"} · Daily #${S.num} · ${allPlaced ? `all ${DAILY_PIECES} pieces placed` : "no moves left"}`;
  $("dailyScore").textContent = S.score;
  const s = liveStreak();
  $("dailyStats").innerHTML = (S.practice ? `Official score today <b>${official}</b><br>` : "")
    + `Streak <b>${s}</b> ${s === 1 ? "day" : "days"}`
    + (() => {
      const next = RARE_KOI.find(r => r.at > s && !journey.koi.includes(rareIndex(r)));
      return next ? ` · ${next.at - s} more ${next.at - s === 1 ? "day" : "days"} for the rare ${next.name}` : "";
    })();
  syncRemind();
  $("shareText").textContent = shareText();
  $("copyBtn").textContent = nativeApp ? "Share result" : "Copy result";
  const mid = new Date(); mid.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((mid - new Date()) / 60000));
  $("nextDaily").textContent = `New challenge in ${Math.floor(mins / 60)} h ${mins % 60} min`;
  $("dailyTasks").innerHTML = tasksLabel();
  openCard("dailyCard");
  bowl(4, 0.05);
}
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
$("dailyAgain").addEventListener("click", () => showAd("practice", () => { startDaily(true); closeOverlay(); render(); }));
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
