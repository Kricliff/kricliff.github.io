// Bridge between the game and the iPhone app (Capacitor).
// In a normal browser every call falls back to the web version, so the game still runs there.
(() => {
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const P = isNative ? Cap.Plugins : {};

  // Koi Garden's AdMob ad units. Set testing to true to get Google's test ads while developing.
  const ADS = {
    testing: false,
    banner: "ca-app-pub-5320743097459583/5228700890",
    interstitial: "ca-app-pub-5320743097459583/2454278023",
    rewarded: "ca-app-pub-5320743097459583/7993545167"
  };
  const REMINDER_DAYS = 7;
  // Non-consumable in-app purchase. Create it in App Store Connect with exactly this product ID.
  const NO_ADS_ID = "com.kricliff.mentalblock.removeads";

  let adsReady = false, rewardedReady = false, interReady = false;

  // In the app, Capacitor's addListener hands back a plain { remove } handle, not a promise,
  // so always wrap it. Resolves the handle, or null when the plugin is missing.
  function listen(plugin, event, cb) {
    try { return Promise.resolve(plugin.addListener(event, cb)).catch(() => null); }
    catch (e) { return Promise.resolve(null); }
  }

  async function prepRewarded() {
    try { await P.AdMob.prepareRewardVideoAd({ adId: ADS.rewarded, isTesting: ADS.testing }); rewardedReady = true; }
    catch (e) { rewardedReady = false; }
  }
  async function prepInterstitial() {
    try { await P.AdMob.prepareInterstitial({ adId: ADS.interstitial, isTesting: ADS.testing }); interReady = true; }
    catch (e) { interReady = false; }
  }

  // Order matters: Google's consent form (GDPR) first, then Apple's tracking prompt, then ads
  async function setupAds(showBanner) {
    const AdMob = P.AdMob;
    if (!AdMob) return;
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === "REQUIRED") await AdMob.showConsentForm();
    } catch (e) {}
    try {
      const st = await AdMob.trackingAuthorizationStatus();
      if (st.status === "notDetermined") await AdMob.requestTrackingAuthorization();
    } catch (e) {}
    try {
      // Keep ads family-friendly so they match the App Store age rating
      await AdMob.initialize({ initializeForTesting: ADS.testing, maxAdContentRating: "ParentalGuidance" });
      adsReady = true;
    } catch (e) { return; }
    prepRewarded();
    prepInterstitial();
    if (!showBanner) return;
    try {
      await AdMob.showBanner({ adId: ADS.banner, adSize: "ADAPTIVE_BANNER", position: "BOTTOM_CENTER", margin: 0, isTesting: ADS.testing });
    } catch (e) {}
  }

  // Resolves "rewarded", "dismissed" (closed before the reward) or "unavailable" (no ad to show)
  async function showRewarded() {
    if (!adsReady) return "unavailable";
    if (!rewardedReady) await prepRewarded();
    if (!rewardedReady) return "unavailable";
    rewardedReady = false;
    return new Promise(resolve => {
      let done = false, rewarded = false, handle = null;
      const finish = result => {
        if (done) return;
        done = true;
        if (handle) handle.remove();
        prepRewarded();
        resolve(result);
      };
      // The plugin only resolves when the reward is earned, so listen for the close as well
      listen(P.AdMob, "onRewardedVideoAdDismissed", () => setTimeout(() => finish(rewarded ? "rewarded" : "dismissed"), 400))
        .then(h => { handle = h; if (done && h) h.remove(); });
      P.AdMob.showRewardVideoAd()
        .then(() => { rewarded = true; finish("rewarded"); })
        .catch(() => finish("unavailable"));
    });
  }

  // Resolves once the ad break is over, or straight away when no ad is ready
  async function showInterstitial() {
    if (!adsReady || !interReady) { if (adsReady) prepInterstitial(); return false; }
    interReady = false;
    return new Promise(resolve => {
      let done = false, handle = null;
      const finish = shown => {
        if (done) return;
        done = true;
        if (handle) handle.remove();
        prepInterstitial();
        resolve(shown);
      };
      listen(P.AdMob, "interstitialAdDismissed", () => finish(true)).then(h => { handle = h; if (done && h) h.remove(); });
      P.AdMob.showInterstitial().catch(() => finish(false));
    });
  }

  // Map the game's vibration patterns onto iPhone haptics
  function haptic(pattern) {
    const H = P.Haptics;
    if (!H) return;
    if (Array.isArray(pattern)) H.notification({ type: "SUCCESS" }).catch(() => {});
    else H.impact({ style: pattern >= 12 ? "MEDIUM" : "LIGHT" }).catch(() => {});
  }

  // Daily reminders: one notification per day for the next week, skipping days already played
  async function scheduleReminders({ on, time, text, playedToday }) {
    const LN = P.LocalNotifications;
    if (!LN) return false;
    try {
      const pending = await LN.getPending();
      if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      if (!on) return true;
      let perm = await LN.checkPermissions();
      if (perm.display !== "granted") perm = await LN.requestPermissions();
      if (perm.display !== "granted") return false;
      const [h, m] = time.split(":").map(Number);
      const now = new Date(), list = [];
      for (let d = 0; d < REMINDER_DAYS; d++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m);
        if (at <= now || (d === 0 && playedToday)) continue;
        list.push({ id: 1000 + d, title: "Koi Garden", body: text, schedule: { at, allowWhileIdle: true } });
      }
      if (list.length) await LN.schedule({ notifications: list });
      return true;
    } catch (e) { return false; }
  }

  async function removeBanner() {
    try { await P.AdMob.removeBanner(); } catch (e) {}
  }

  // Remove ads purchase (StoreKit 2 through @capgo/native-purchases)
  async function noAdsPrice() {
    try {
      const { products } = await P.NativePurchases.getProducts({ productIdentifiers: [NO_ADS_ID], productType: "inapp" });
      return products && products[0] ? products[0].priceString : "";
    } catch (e) { return ""; }
  }
  const ownsIn = purchases => (purchases || []).some(p => p.productIdentifier === NO_ADS_ID && !p.revocationDate);
  async function ownsNoAds() {
    try {
      const { purchases } = await P.NativePurchases.getPurchases({ productType: "inapp" });
      return ownsIn(purchases);
    } catch (e) { return false; }
  }
  // Resolves "purchased", "cancelled" or "failed"
  async function buyNoAds() {
    try {
      const tx = await P.NativePurchases.purchaseProduct({ productIdentifier: NO_ADS_ID, productType: "inapp", quantity: 1 });
      return tx && tx.productIdentifier === NO_ADS_ID ? "purchased" : "failed";
    } catch (e) {
      const msg = String((e && (e.message || e.code)) || e).toLowerCase();
      return msg.includes("cancel") ? "cancelled" : "failed";
    }
  }
  async function restoreNoAds() {
    try { await P.NativePurchases.restorePurchases(); } catch (e) {}
    return ownsNoAds();
  }

  // Game progress in iCloud, so it follows the player to a new iPhone. Resolves null when
  // iCloud is not available (not signed in, or the plugin is missing).
  const CLOUD_KEY = "progress";
  async function cloudLoad() {
    if (!P.KoiCloud) return null;
    try {
      const r = await P.KoiCloud.get({ key: CLOUD_KEY });
      if (!r.available) return null;
      return r.value ? JSON.parse(r.value) : {};
    } catch (e) { return null; }
  }
  async function cloudSave(data) {
    if (!P.KoiCloud) return;
    try { await P.KoiCloud.set({ key: CLOUD_KEY, value: JSON.stringify(data) }); } catch (e) {}
  }

  // Called when iCloud brings in a newer copy, for example from another device
  function cloudOnChange(cb) {
    if (P.KoiCloud) listen(P.KoiCloud, "change", () => cb());
  }

  // Game Center leaderboards. Everything resolves quietly when Game Center is missing or the player says no.
  const hasGames = !!P.KoiGames;
  async function gcSignIn() {
    if (!hasGames) return false;
    try { return !!(await P.KoiGames.signIn()).signedIn; } catch (e) { return false; }
  }
  async function gcSubmit(board, score) {
    if (!hasGames) return false;
    try { return !!(await P.KoiGames.submit({ board, score: Math.max(0, Math.round(score)) })).sent; } catch (e) { return false; }
  }
  async function gcPlace(board) {
    if (!hasGames) return null;
    try { return await P.KoiGames.place({ board }); } catch (e) { return null; }
  }
  async function gcShow(board) {
    if (!hasGames) return;
    try { await P.KoiGames.show({ board, friends: true }); } catch (e) {}
  }

  // Universal Links: the app was opened by a link to the web version (a friend's challenge). Both the link that started
  // the app and links that bring it back from the background.
  function onOpenUrl(cb) {
    if (!P.App) return;
    listen(P.App, "appUrlOpen", e => { if (e && e.url) cb(e.url); });
    try { P.App.getLaunchUrl().then(r => { if (r && r.url) cb(r.url); }).catch(() => {}); } catch (e) {}
  }

  async function init(opts = {}) {
    document.body.classList.add("native");
    try { await P.StatusBar.setStyle({ style: "DARK" }); } catch (e) {}
    try { await P.SplashScreen.hide(); } catch (e) {}
    setupAds(opts.banner !== false);
  }

  window.MBNative = { isNative, init, haptic, showRewarded, showInterstitial, scheduleReminders,
    removeBanner, noAdsPrice, ownsNoAds, buyNoAds, restoreNoAds, cloudLoad, cloudSave, cloudOnChange,
    hasGames, gcSignIn, gcSubmit, gcPlace, gcShow, onOpenUrl };
})();
