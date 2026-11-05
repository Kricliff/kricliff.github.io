// Koi Garden: The shop, where pearls buy boards, stones, decorations for the koi pond and music moods.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Shop ----------
   One page for everything pearls can buy, in four tabs. Every tab shows how many of its things you own, and every
   thing shows its price or what it is waiting for (stars, a streak). Buying takes two taps: the first says
   "Tap again to buy", the second buys. Owned things are used with one tap: a board or stones go on, a decoration
   is shown or hidden in the pond, a music mood starts playing. A mood you do not own plays for a little while on the
   first tap, so you can listen before you buy. The buying itself lives with each thing (buyStyle in ui.js, buyDecor
   in pond.js, buyMood in audio.js), shared with the pond's own Decorate sheet and Settings. */
const SHOP_TABS = {
  board: { intro: "The board your stones are played on. Each has a day and a night look." },
  stones: { intro: "Every colour keeps its own stone shape in every style, so colour-blind players can still match." },
  pond: { intro: "Decorations for your koi pond. Tap one you own to show or hide it." },
  music: { intro: "The music is made as you play. Tap a mood to listen before you buy it." }
};
let shopTab = "board", shopReturn = null, shopBuying = null, shopTimer = 0;
const shopView = $("shopView");
function shopCounts() {
  const n = list => list.filter(Boolean).length;
  return {
    board: [n(BOARDS.map(ownsStyle)), BOARDS.length],
    stones: [n(STONES.map(ownsStyle)), STONES.length],
    pond: [pondState().owned.length, POND_DECOR.length],
    music: [n(Object.keys(MOODS).map(moodOwned)), Object.keys(MOODS).length]
  };
}
const price = p => `<i class="pearl"></i> ${p}`;
function shopTile(tab, id) {
  const confirm = shopBuying === `${tab}:${id}`;
  if (tab === "board" || tab === "stones") {
    // The same preview as the board itself: four beds with stones on them
    const item = STYLE_KINDS[tab].find(x => x.id === id);
    buying = confirm ? id : null;
    return styleTile(tab, item).replace("style-tile", "style-tile shop-item");
  }
  if (tab === "pond") {
    const d = POND_DECOR.find(x => x.id === id), owned = decorOwned(d), shown = decorShown(d);
    const status = owned ? (shown ? "In your pond" : "Hidden · tap to show") : confirm ? "Tap again to buy" : price(d.price);
    return `<button class="shop-item pond-tile${owned ? " owned" : ""}${shown ? " on" : ""}${confirm ? " confirm" : ""}${!owned && journey.pearls < d.price ? " short" : ""}" data-id="${id}">`
      + `<span class="pic"><img src="${d.img}" alt=""></span><b>${d.name}</b><small>${status}</small></button>`;
  }
  const M = MOODS[id], own = moodOwned(id), on = (audio.mood || "garden") === id && !previewMood, hear = previewMood === id;
  const status = on ? (audio.musicOn ? "Playing" : "Chosen · music is off") : own ? "Tap to play"
    : hear ? (journey.pearls >= M.price ? "Listening · tap again to buy" : `Listening · ${M.price - journey.pearls} more pearls`)
    : `${price(M.price)} · tap to listen`;
  return `<button class="shop-item music-tile${own ? " owned" : ""}${on ? " on" : ""}${hear ? " confirm hear" : ""}" data-id="${id}">`
    + `<span class="note" aria-hidden="true">♪</span><b>${M.name}</b><span class="about">${M.about}</span><small>${status}</small></button>`;
}
function paintShop() {
  $("shopPearls").querySelector("b").textContent = journey.pearls;
  const counts = shopCounts();
  shopView.querySelectorAll(".shop-tab").forEach(t => {
    const [got, all] = counts[t.dataset.tab];
    t.setAttribute("aria-selected", String(t.dataset.tab === shopTab));
    t.querySelector("small").textContent = `${got}/${all}`;
  });
  const ids = shopTab === "board" ? BOARDS.map(b => b.id) : shopTab === "stones" ? STONES.map(s => s.id)
    : shopTab === "pond" ? POND_DECOR.map(d => d.id) : Object.keys(MOODS);
  const extra = shopTab === "pond" ? '<button class="btn shop-visit" id="shopVisitPond">Visit your koi pond</button>'
    : shopTab === "music" && !audio.musicOn ? '<p class="note shop-warn">Music is off in Settings, so you will not hear the moods.</p>' : "";
  $("shopBody").innerHTML = `<p class="shop-intro">${SHOP_TABS[shopTab].intro}</p>`
    + `<div class="shop-grid grid-${shopTab}">${ids.map(id => shopTile(shopTab, id)).join("")}</div>${extra}`;
  buying = null;
}
function openShop(tab, back) {
  shopTab = tab || shopTab;
  shopReturn = back || null;
  shopBuying = null;
  checkStyleUnlocks(true);
  paintShop();
  shopView.hidden = false;
  $("shopBody").scrollTop = 0;
}
function closeShop() {
  shopView.hidden = true;
  clearTimeout(shopTimer);
  shopBuying = null;
  if (!homeEl.hidden) paintHome();
  const b = shopReturn;
  shopReturn = null;
  if (b) b();
}
$("shopClose").addEventListener("click", closeShop);
$("shopTabs").addEventListener("click", e => {
  const t = e.target.closest(".shop-tab");
  if (!t || t.dataset.tab === shopTab) return;
  shopTab = t.dataset.tab;
  shopBuying = null;
  tick();
  paintShop();
  $("shopBody").scrollTop = 0;
});
// A bought thing: a burst of gold on its tile and a pulse of the pearl count
function shopCelebrate(tab, id) {
  paintShop();
  const tile = $("shopBody").querySelector(`.shop-item[data-id="${id}"]`);
  if (tile) { const r = tile.getBoundingClientRect(); sparkBurst(r.left + r.width / 2, r.top + r.height * 0.4, 26); }
  restartClass($("shopPearls"), "bump");
  bowl(6, 0.05);
  buzz([12, 30, 12]);
}
function shopShort(id, need) {
  paintShop();
  const tile = $("shopBody").querySelector(`.shop-item[data-id="${id}"]`);
  if (!tile) return;
  if (need > 0) tile.querySelector("small").textContent = `${need} more pearls needed`;
  restartClass(tile, "nope");
  knock();
}
// The first tap on something you can afford asks to confirm; the confirmation lapses after a few seconds
function shopAsk(key) {
  shopBuying = key;
  clearTimeout(shopTimer);
  shopTimer = setTimeout(() => { shopBuying = null; if (!shopView.hidden) paintShop(); }, 3500);
  tick();
  paintShop();
}
$("shopBody").addEventListener("click", e => {
  if (e.target.closest("#shopVisitPond")) { shopView.hidden = true; openPond(() => openShop("pond", shopReturn)); return; }
  const t = e.target.closest(".shop-item");
  if (!t) return;
  const id = t.dataset.id, key = `${shopTab}:${id}`, again = shopBuying === key;
  if (shopTab === "board" || shopTab === "stones") {
    const item = STYLE_KINDS[shopTab].find(x => x.id === id);
    if (ownsStyle(item)) { shopBuying = null; useStyle(shopTab, id); paintShop(); return; }
    if (!item.price) { shopShort(id, 0); return; }
    if (journey.pearls < item.price) { shopShort(id, item.price - journey.pearls); return; }
    if (!again) { shopAsk(key); return; }
    shopBuying = null;
    if (buyStyle(shopTab, item)) shopCelebrate(shopTab, id);
    return;
  }
  if (shopTab === "pond") {
    const d = POND_DECOR.find(x => x.id === id);
    if (decorOwned(d)) { shopBuying = null; toggleDecor(d); paintShop(); return; }
    if (journey.pearls < d.price) { shopShort(id, d.price - journey.pearls); return; }
    if (!again) { shopAsk(key); return; }
    shopBuying = null;
    if (buyDecor(d)) shopCelebrate(shopTab, id);
    return;
  }
  // Music: owned moods play; the first tap on another one plays it for a while, the second buys it
  const M = MOODS[id];
  if (moodOwned(id)) { shopBuying = null; endPreview(); setMood(id); audioInit(); paintShop(); return; }
  if (again && previewMood === id) {
    if (journey.pearls < M.price) { shopShort(id, M.price - journey.pearls); return; }
    shopBuying = null;
    if (buyMood(id)) shopCelebrate(shopTab, id);
    return;
  }
  listenMood(id);
  shopBuying = key;
  clearTimeout(shopTimer);
  paintShop();
});
