// Koi Garden: Sound effects and music, all made with Web Audio.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Sound & music ----------
   Everything is synthesised with Web Audio, so the app carries no sound files. Effects and music
   each run through their own volume, with a soft room reverb, and both have an on/off switch and a
   volume slider in Settings. The music is generated as it plays: koto-like plucks in a Japanese
   pentatonic scale over a slow pad, a low root note, the odd wind chime and quiet water. */
let audio = { sfx: 0.8, music: 0.5, sfxOn: true, musicOn: true };
try {
  const saved = localStorage.getItem("mb-audio");
  if (saved) audio = Object.assign(audio, JSON.parse(saved));
  // Players who switched the old single Sound switch off keep both off
  else if (muted) audio.sfxOn = audio.musicOn = false;
} catch (e) {}
const saveAudio = () => { try { localStorage.setItem("mb-audio", JSON.stringify(audio)); } catch (e) {} };
let ac = null, sfxBus = null, musicBus = null, sfxRev = null, musicRev = null, noiseBuf = null, ducked = false;
const sfxLevel = () => audio.sfxOn ? audio.sfx : 0;
const musicLevel = () => audio.musicOn && !ducked ? audio.music * 0.75 : 0;
function makeNoise(secs) {
  const b = ac.createBuffer(1, ac.sampleRate * secs, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// A room: decaying stereo noise used as the reverb's impulse
function impulse(secs) {
  const n = ac.sampleRate * secs, b = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  }
  return b;
}
function audioInit() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    // A gentle compressor keeps stacked sounds from clipping
    const master = ac.createDynamicsCompressor();
    master.threshold.value = -16;
    master.ratio.value = 3;
    // and makes up the level afterwards, so the phone speaker is loud enough
    const makeup = ac.createGain();
    makeup.gain.value = 2.5;
    master.connect(makeup).connect(ac.destination);
    sfxBus = ac.createGain();
    musicBus = ac.createGain();
    sfxBus.gain.value = 0;
    musicBus.gain.value = 0;
    sfxBus.connect(master);
    musicBus.connect(master);
    const room = impulse(2.6);
    sfxRev = ac.createConvolver(); sfxRev.buffer = room; sfxRev.connect(sfxBus);
    musicRev = ac.createConvolver(); musicRev.buffer = room; musicRev.connect(musicBus);
    noiseBuf = makeNoise(2);
  }
  if (ac.state !== "running" && !document.hidden) ac.resume().catch(() => {});
  applyAudio();
}
let musicStopTimer = 0;
function applyAudio() {
  if (!ac) return;
  const t = ac.currentTime;
  sfxBus.gain.setTargetAtTime(sfxLevel(), t, 0.05);
  musicBus.gain.setTargetAtTime(musicLevel(), t, 0.8);
  clearTimeout(musicStopTimer);
  if (audio.musicOn && audio.music > 0) startMusic();
  else musicStopTimer = setTimeout(stopMusic, 2500);
}
// Music fades out while an ad plays and comes back after
function duck(on) { ducked = on; applyAudio(); }
// The first touch anywhere starts the sound (iOS only allows audio after one)
document.addEventListener("pointerdown", audioInit, { capture: true, once: true });

function send(node, rev, amount) {
  if (!amount) return;
  const s = ac.createGain();
  s.gain.value = amount;
  node.connect(s).connect(rev);
}
function voice(f, t0, d, v, glideTo, type = "sine", rev = 0) {
  if (!ac || !sfxLevel()) return;
  const o = ac.createOscillator(), g = ac.createGain();
  const t = ac.currentTime + t0;
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + d * 0.6);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(sfxBus);
  send(g, sfxRev, rev);
  o.start(t);
  o.stop(t + d + 0.03);
}
// A koto-like pluck: a few partials through a closing filter, with a tiny noise click for the pick
function pluck(f, t, vol, decay = 1.8, music = false, rev = 0.4) {
  const bus = music ? musicBus : sfxBus, room = music ? musicRev : sfxRev;
  const g = ac.createGain(), lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(12000, f * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.4), t + decay * 0.7);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  [[1, 1, "triangle"], [2, 0.45, "sine"], [3, 0.2, "sine"], [4.03, 0.1, "sine"]].forEach(([m, a, type]) => {
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = type;
    o.frequency.value = f * m;
    og.gain.value = a;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + decay + 0.05);
  });
  const n = ac.createBufferSource(), ng = ac.createGain(), bp = ac.createBiquadFilter();
  n.buffer = noiseBuf;
  bp.type = "bandpass";
  bp.frequency.value = Math.min(9000, f * 3);
  ng.gain.setValueAtTime(vol * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  n.connect(bp).connect(ng).connect(lp);
  n.start(t, Math.random(), 0.04);
  lp.connect(g).connect(bus);
  send(g, room, rev);
}
// A small bell or wind chime: inharmonic partials with a long ring
function bell(f, t, vol, music = false) {
  const bus = music ? musicBus : sfxBus, room = music ? musicRev : sfxRev;
  [[1, 1, 3.2], [2.76, 0.4, 1.8], [5.4, 0.18, 1.0]].forEach(([m, a, d]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f * m;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * a, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus);
    send(g, room, 0.6);
    o.start(t);
    o.stop(t + d + 0.05);
  });
}
// Filtered noise that sweeps from one pitch to another: water, wind, sliding wood
function swoosh(t0, dur, from, to, vol, q = 0.9, type = "bandpass", rev = 0.2) {
  if (!ac || !sfxLevel()) return;
  const t = ac.currentTime + t0;
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  n.buffer = noiseBuf;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(sfxBus);
  send(g, sfxRev, rev);
  n.start(t, Math.random(), dur + 0.05);
}

/* Sound effects */
// Stone set on sand: a soft wooden knock
function knock() { voice(240, 0, 0.14, 0.09, 150); voice(720, 0, 0.05, 0.02); }
function tick() { voice(880, 0, 0.06, 0.03, 660); }
// Picking up a piece, and letting go of one that has nowhere to go
function lift() { voice(560, 0, 0.06, 0.02, 700); }
function nope() { voice(150, 0, 0.16, 0.06, 95); }
// A light tap for buttons
function tap() { voice(1250, 0, 0.035, 0.012, 950); }
// Singing bowl: a base tone with slightly detuned partials, rising with each step
function bowl(steps, vol = 0.05) {
  const base = [196, 220, 247, 262, 294, 330, 392][Math.min(steps, 6)];
  voice(base, 0, 2.4, vol, 0, "sine", 0.35);
  voice(base * 2.01, 0, 1.8, vol * 0.5, 0, "sine", 0.35);
  voice(base * 2.98, 0.02, 1.2, vol * 0.25, 0, "sine", 0.35);
}
const sfxOk = () => ac && sfxLevel() > 0;
// Plucks climbing the scale, one after another
function run(degs, gap = 0.09, vol = 0.07, decay = 1.6) {
  if (!sfxOk()) return;
  const t = ac.currentTime + 0.02;
  degs.forEach((d, k) => pluck(hz(d), t + k * gap, vol, decay));
}
function comboSound(c) { run([...Array(Math.min(c, 5))].map((_, k) => 7 + k), 0.07, 0.05, 1.2); }
function chime(gold) { run(gold ? [9, 11, 14] : [9, 11], 0.11, 0.05, 1.8); }
function sfxSplash(at = 0) { swoosh(at, 0.45, 2400, 500, 0.09, 0.7); swoosh(at + 0.02, 0.25, 900, 300, 0.05, 1.2, "lowpass", 0); }
function rustle() { swoosh(0, 0.35, 2600, 1400, 0.035, 1.5); voice(330, 0.05, 0.12, 0.03, 440); }
function whoosh() { swoosh(0, 0.45, 300, 3200, 0.06, 1.1); }
// Shoji doors: wood sliding on wood, then a soft bump as they meet or stop
function doors(open) {
  if (!sfxOk()) return;
  swoosh(0.05, 0.75, open ? 260 : 700, open ? 700 : 260, 0.045, 0.6, "lowpass", 0.1);
  voice(open ? 130 : 110, open ? 0.72 : 0.68, 0.18, 0.06, 80);
}
function winSound(stars) {
  if (!sfxOk()) return;
  const t = ac.currentTime;
  [5, 7, 8, 10, 12].forEach((d, k) => pluck(hz(d), t + k * 0.1, 0.06, 2));
  // One bell per star, in time with the stars landing on the card
  for (let k = 0; k < stars; k++) bell(hz(14 + k * 2), t + 0.2 + k * 0.22 + 0.25, 0.05);
}
function starSound(k) { if (sfxOk()) { const t = ac.currentTime; bell(hz(10 + k * 2), t, 0.04); pluck(hz(5 + k * 2), t, 0.05, 1.4); } }
function failSound() { if (sfxOk()) { const t = ac.currentTime; pluck(hz(5), t, 0.06, 1.6); pluck(hz(3), t + 0.22, 0.06, 2.2); } }
function basketSound() { run([5, 7, 9, 10, 12, 14], 0.08, 0.06, 2); }
function stillSound() { if (sfxOk()) { const t = ac.currentTime; [10, 12, 14, 15, 17].forEach((d, k) => bell(hz(d), t + k * 0.14, 0.035)); } }

/* Music */
const SCALE = [0, 2, 5, 7, 9];  // a Japanese yo scale on D: D E G A B
const ROOT = 146.83;             // D3
const hz = deg => { const o = Math.floor(deg / 5), k = ((deg % 5) + 5) % 5; return ROOT * 2 ** (o + SCALE[k] / 12); };
const CHORDS = [[0, 3, 6], [2, 5, 7], [-1, 1, 3], [1, 3, 6]];
const BAR = 4.8;                 // four slow beats
let musicTimer = 0, nextBar = 0, bar = 0, melody = 7, water = null;
function pad(chord, t, len) {
  const lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = "lowpass";
  lp.frequency.value = isNight() ? 520 : 760;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.03, t + 2.5);
  g.gain.setValueAtTime(0.03, t + len - 1);
  g.gain.linearRampToValueAtTime(0, t + len + 2);
  chord.forEach(d => [-4, 4].forEach(cents => {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.value = hz(d);
    o.detune.value = cents;
    o.connect(lp);
    o.start(t);
    o.stop(t + len + 2.1);
  }));
  lp.connect(g).connect(musicBus);
  send(g, musicRev, 0.5);
}
function playBar(t, n) {
  const chord = CHORDS[Math.floor(n / 2) % CHORDS.length];
  if (n % 2 === 0) pad(chord, t, BAR * 2);
  pluck(hz(chord[0] - 5), t, 0.05, 3.5, true, 0.3);
  // A short phrase on three bars of four; the fourth rests
  if (n % 4 !== 3) {
    const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3].filter(() => Math.random() < 0.38);
    beats.forEach(b => {
      melody = Math.max(4, Math.min(13, melody + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      pluck(hz(melody), t + b * BAR / 4, 0.045 + Math.random() * 0.02, 2.4, true, 0.5);
    });
  }
  if (Math.random() < 0.2) bell(hz(12 + Math.floor(Math.random() * 5)), t + Math.random() * BAR, 0.012, true);
}
function scheduleMusic() {
  if (!ac || ac.state !== "running") return;
  if (nextBar < ac.currentTime) nextBar = ac.currentTime + 0.1;
  while (nextBar < ac.currentTime + 1.5) { playBar(nextBar, bar++); nextBar += BAR; }
}
// Quiet water under everything: low filtered noise that swells and settles
function startWater() {
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
  n.buffer = noiseBuf;
  n.loop = true;
  f.type = "lowpass";
  f.frequency.value = 420;
  g.gain.value = 0.014;
  lfo.frequency.value = 0.07;
  depth.gain.value = 0.008;
  lfo.connect(depth).connect(g.gain);
  n.connect(f).connect(g).connect(musicBus);
  n.start();
  lfo.start();
  return { stop: () => { try { n.stop(); lfo.stop(); } catch (e) {} } };
}
function startMusic() {
  if (musicTimer || !ac) return;
  nextBar = ac.currentTime + 0.3;
  water = startWater();
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 400);
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (water) { water.stop(); water = null; }
}
// Leaving the app quiets everything; coming back picks up where it was
document.addEventListener("visibilitychange", () => {
  if (!ac) return;
  if (document.hidden) ac.suspend().catch(() => {});
  else ac.resume().catch(() => {});
});

/* Settings: a switch and a slider for effects, and the same for music */
function syncAudioUI() {
  [["sfx", "sfxOn", "sfxVol"], ["music", "musicOn", "musicVol"]].forEach(([k, on, vol]) => {
    $(on).checked = audio[k + "On"];
    const r = $(vol);
    r.value = Math.round(audio[k] * 100);
    r.disabled = !audio[k + "On"];
    r.style.setProperty("--fill", r.value + "%");
  });
}
[["sfx", "sfxOn", "sfxVol"], ["music", "musicOn", "musicVol"]].forEach(([k, on, vol]) => {
  $(on).addEventListener("change", e => {
    audio[k + "On"] = e.target.checked;
    saveAudio();
    audioInit();
    syncAudioUI();
    if (k === "sfx" && audio.sfxOn) tick();
  });
  $(vol).addEventListener("input", e => {
    audio[k] = e.target.value / 100;
    e.target.style.setProperty("--fill", e.target.value + "%");
    audioInit();
  });
  $(vol).addEventListener("change", () => { saveAudio(); if (k === "sfx") tick(); });
});
// Buttons answer with a light tap
document.addEventListener("click", e => { if (e.target.closest(".btn, .hb, .home-link, .icon-btn, .mode, .style-tile, .node")) tap(); });

function buzz(p) {
  if (nativeApp) { window.MBNative.haptic(p); return; }
  try { navigator.vibrate && navigator.vibrate(p); } catch (e) {}
}
