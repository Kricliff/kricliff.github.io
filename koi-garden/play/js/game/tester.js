// Koi Garden: Hidden tester tools. Set TESTER_TOOLS to false before App Store submission.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Tester tools ----------
   Seven quick taps on the logo on the home screen open a card for jumping ahead in the Journey.
   Turn TESTER_TOOLS off before sending a build to App Store review: Apple does not allow hidden
   features in apps on the App Store (guideline 2.3.1). */
const TESTER_TOOLS = false;
let logoTaps = [];
$("homeLogo").addEventListener("click", () => {
  if (!TESTER_TOOLS || !overlay.hidden) return;
  const now = Date.now();
  logoTaps = logoTaps.filter(t => now - t < 3000).concat(now);
  if (logoTaps.length >= 7) { logoTaps = []; buzz([10, 40, 10]); openCard("testerCard"); }
});
function testerOpenTo(n) {
  journey.unlocked = Math.max(journey.unlocked, n);
  journey.mapSeen = journey.unlocked;
  saveJourney();
}
$("testerUnlock").addEventListener("click", () => {
  testerOpenTo(150);
  closeOverlay();
  notify("Tester tools", "Chapters 1–10 are open", true);
});
$("testerPlay").addEventListener("click", () => {
  const n = Math.max(1, Math.min(9999, Math.round(+$("testerLevel").value || 1)));
  testerOpenTo(n);
  closeOverlay();
  const go = () => { startLevel(n); closeOverlay(); render(); openLevelIntro(); };
  if (!homeEl.hidden) enterGame(go); else go();
});
$("testerPearls").addEventListener("click", () => {
  journey.pearls += 1000;
  saveJourney();
  closeOverlay();
  notify("Tester tools", "+1000 pearls", false);
});
// Stars for the garden: three on every level up to the one you are on
$("testerStars").addEventListener("click", () => {
  for (let n = 1; n < journey.unlocked; n++) journey.stars[n] = 3;
  saveJourney();
  closeOverlay();
  notify("Tester tools", `${starsToSpend()} stars to spend in the garden`, false);
});
$("testerDone").addEventListener("click", closeOverlay);
