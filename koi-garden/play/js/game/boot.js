// Koi Garden: Starts the game. Loaded last, so everything above is defined.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Boot ---------- */
window.addEventListener("resize", () => { layout(); sizeCanvases(); if (!homeEl.hidden) sizeMoon(); });

function start(data) {
  if (nativeApp) {
    document.body.classList.add("native");
    $("remindNote").textContent = "You get a notification at this time on days you have not played the daily yet.";
    // Each native extra is guarded on its own, so none of them can stop the game from starting
    const safely = f => { try { const r = f(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
    if (promised) safely(() => window.MBNative.init({ banner: bannerOn() }));
    safely(syncNativeReminders);
    // A Remove ads purchase made on another device, or before a reinstall
    safely(() => window.MBNative.ownsNoAds().then(owned => { if (owned && !noAds) setNoAds(); }));
    // A new iPhone or a reinstall: bring back the progress saved in iCloud
    safely(() => cloudRestore().then(more => { if (more) reloadOnce(); }));
    safely(() => window.MBNative.cloudOnChange(cloudChanged));
  }
  checkLanternWeek();
  checkStyleUnlocks(true);
  applyLook();
  applyPrefs();
  sizeCanvases();
  startKoi();
  syncAudioUI();
  applyGarden();
  const ok = s => s && Array.isArray(s.board) && s.board.length === N * N && s.mode && typeof s.clears === "number" && typeof s.placed === "number";
  if (data && data.G) {
    if (ok(data.G.journey) && "limit" in data.G.journey) G.journey = data.G.journey;
    if (ok(data.G.endless) && "undoLeft" in data.G.endless) G.endless = data.G.endless;
    if (ok(data.G.daily) && data.G.daily.day === today().key && "practice" in data.G.daily) G.daily = data.G.daily;
  }
  S = G[data && data.mode] || G.journey;
  if (!S) startLevel(currentLevel());
  shownScore = S.score;
  layout();
  render();
  if (grantChapterKoi()) { saveJourney(); initKoi(); }
  syncStatsUI();
  track("session");
  // The very first time, the game opens straight on level 1 with its glowing square: no home screen, no cards
  const fresh = !promised && !tutDone && journey.unlocked <= 1 && !Object.keys(journey.stars).length && S.mode === "journey" && !S.placed;
  if (fresh) { homeEl.hidden = true; closeOverlay(); render(); return; }
  showHome(false);
  if (!promised) openCard("promiseCard");
  else maybeAskStats();
}
start({});
