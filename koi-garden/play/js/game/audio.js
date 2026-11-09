// Koi Garden: Sound effects and music, all made with Web Audio.
// Part of the game. All files in js/game/ share one scope and load in the order index.html lists.

/* ---------- Sound & music ----------
   Music, nature sounds and the main effects are recordings made with Everygen (www/audio, made by
   assets/audio/make_audio.sh). Each music mood has its own track and its own nature sound; the tracks loop
   with a crossfade. The smaller effects are synthesised with Web Audio, and so is the old generated music,
   which still plays if a track cannot load. Effects, music and nature each have an on/off switch and a
   volume slider in Settings. */
let audio = { sfx: 0.8, music: 0.5, sfxOn: true, musicOn: true, nature: 0.5, natureOn: true };
try {
  const saved = localStorage.getItem("mb-audio");
  if (saved) audio = Object.assign(audio, JSON.parse(saved));
  // Players who switched the old single Sound switch off keep both off
  else if (muted) audio.sfxOn = audio.musicOn = false;
} catch (e) {}
const saveAudio = () => { try { localStorage.setItem("mb-audio", JSON.stringify(audio)); } catch (e) {} };
let ac = null, sfxBus = null, musicBus = null, natureBus = null, sfxRev = null, musicRev = null, noiseBuf = null, ducked = false;
const sfxLevel = () => audio.sfxOn ? audio.sfx : 0;
const musicLevel = () => audio.musicOn && !ducked ? audio.music * 0.75 : 0;
const natureLevel = () => audio.natureOn && !ducked ? audio.nature * 0.8 : 0;
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
    natureBus = ac.createGain();
    natureBus.gain.value = 0;
    sfxBus.connect(master);
    musicBus.connect(master);
    natureBus.connect(master);
    const room = impulse(2.6);
    sfxRev = ac.createConvolver(); sfxRev.buffer = room; sfxRev.connect(sfxBus);
    musicRev = ac.createConvolver(); musicRev.buffer = room; musicRev.connect(musicBus);
    noiseBuf = makeNoise(2);
    loadSamples();
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
  natureBus.gain.setTargetAtTime(natureLevel(), t, 0.8);
  clearTimeout(musicStopTimer);
  if (audio.musicOn && audio.music > 0) startMusic();
  else musicStopTimer = setTimeout(stopMusic, 2500);
  clearTimeout(natureStopTimer);
  if (audio.natureOn && audio.nature > 0) startNature();
  else natureStopTimer = setTimeout(stopNature, 2500);
}
let natureStopTimer = 0;

/* Recorded effects: decoded once, then played through the effects bus. sample() returns false while a file is
   still loading or could not load, so each effect falls back to its synthesised version. */
const SAMPLE_NAMES = ["place", "clear", "koi", "win", "fail"];
const samples = {};
let samplesAsked = false;
function loadSamples() {
  if (samplesAsked || !ac) return;
  samplesAsked = true;
  SAMPLE_NAMES.forEach(n => fetch(`audio/sfx-${n}.mp3`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => new Promise((ok, fail) => ac.decodeAudioData(b, ok, fail)))
    .then(buf => { samples[n] = buf; })
    .catch(() => {}));
}
function sample(name, vol = 0.3, rate = 1, at = 0) {
  if (!ac || sfxLevel() <= 0 || !samples[name]) return false;
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = samples[name];
  s.playbackRate.value = rate;
  g.gain.value = vol;
  s.connect(g).connect(sfxBus);
  send(g, sfxRev, 0.12);
  s.start(ac.currentTime + at);
  return true;
}

/* A recorded loop played through Web Audio. Two <audio> elements take turns, so the end of the track fades into
   its start instead of stopping. Streaming keeps memory low: a three-minute track decoded whole would take 60 MB.
   onFail runs if the file cannot be played, so the caller can fall back. */
function loopTrack(src, out, onFail) {
  const FADE = 4;
  const els = [new Audio(src), new Audio(src)], gains = [];
  let cur = 0, stopped = false, failed = false;
  els.forEach(el => {
    el.preload = "auto";
    const g = ac.createGain();
    g.gain.value = 0;
    ac.createMediaElementSource(el).connect(g).connect(out);
    gains.push(g);
    el.addEventListener("error", () => { if (!stopped && !failed) { failed = true; onFail && onFail(); } });
  });
  const startOne = i => {
    const el = els[i], g = gains[i], t = ac.currentTime;
    try { el.currentTime = 0; } catch (e) {}
    el.play().catch(() => {});
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + (i === cur && t < 1 ? 0.5 : FADE));
  };
  // iOS lets a page start audio only from a touch; starting and pausing the second element here, inside the
  // same touch, lets it take over later on its own
  els[1].play().then(() => { if (cur !== 1) els[1].pause(); }).catch(() => {});
  startOne(0);
  const timer = setInterval(() => {
    if (stopped || document.hidden) return;
    const el = els[cur];
    if (!el.duration || el.currentTime < el.duration - FADE - 0.3) return;
    const old = cur, t = ac.currentTime;
    cur = 1 - cur;
    startOne(cur);
    gains[old].gain.cancelScheduledValues(t);
    gains[old].gain.setValueAtTime(gains[old].gain.value, t);
    gains[old].gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => { if (cur !== old) els[old].pause(); }, FADE * 1000 + 300);
  }, 250);
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      setTimeout(() => els.forEach(el => { el.pause(); el.removeAttribute("src"); try { el.load(); } catch (e) {} }), 500);
    },
    pause() { els.forEach(el => el.pause()); },
    resume() { if (!stopped) els[cur].play().catch(() => {}); }
  };
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
  const bus = music ? musicOut() : sfxBus, room = music ? musicRoom() : sfxRev;
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
  const bus = music ? musicOut() : sfxBus, room = music ? musicRoom() : sfxRev;
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
function knock() { if (sample("place", 0.32, 0.94 + Math.random() * 0.12)) return; voice(240, 0, 0.14, 0.09, 150); voice(720, 0, 0.05, 0.02); }
function tick() { if (sample("place", 0.16, 1.45)) return; voice(880, 0, 0.06, 0.03, 660); }
// Picking up a piece, and letting go of one that has nowhere to go
function lift() { voice(560, 0, 0.06, 0.02, 700); }
function nope() { voice(150, 0, 0.16, 0.06, 95); }
// A light tap for buttons
function tap() { if (sample("place", 0.09, 1.9)) return; voice(1250, 0, 0.035, 0.012, 950); }
// Singing bowl: a base tone with slightly detuned partials, rising with each step
function bowl(steps, vol = 0.05) {
  // The recorded chime, a step higher with each line or combo
  if (sample("clear", vol * 6, 2 ** (([0, 2, 4, 5, 7, 9, 12][Math.min(steps, 6)] - 4) / 12))) return;
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
// The recorded splash already has the koi leaping out and back in, so only the first of the pair plays it
function sfxSplash(at = 0) { if (samples.koi && sfxLevel() > 0) { if (at < 0.2) sample("koi", 0.3, 0.95 + Math.random() * 0.1, at); return; } swoosh(at, 0.45, 2400, 500, 0.09, 0.7); swoosh(at + 0.02, 0.25, 900, 300, 0.05, 1.2, "lowpass", 0); }
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
  if (!sample("win", 0.34)) [5, 7, 8, 10, 12].forEach((d, k) => pluck(hz(d), t + k * 0.1, 0.06, 2));
  // One bell per star, in time with the stars landing on the card
  for (let k = 0; k < stars; k++) bell(hz(14 + k * 2), t + 0.2 + k * 0.22 + 0.25, 0.05);
}
function starSound(k) { if (sfxOk()) { const t = ac.currentTime; bell(hz(10 + k * 2), t, 0.04); pluck(hz(5 + k * 2), t, 0.05, 1.4); } }
function failSound() { if (sample("fail", 0.3)) return; if (sfxOk()) { const t = ac.currentTime; pluck(hz(5), t, 0.06, 1.6); pluck(hz(3), t + 0.22, 0.06, 2.2); } }
function basketSound() { run([5, 7, 9, 10, 12, 14], 0.08, 0.06, 2); }
function stillSound() { if (sfxOk()) { const t = ac.currentTime; [10, 12, 14, 15, 17].forEach((d, k) => bell(hz(d), t + k * 0.14, 0.035)); } }

/* Music */
const SCALE = [0, 2, 5, 7, 9];  // a Japanese yo scale on D: D E G A B
const ROOT = 146.83;             // D3
const hz = deg => { const o = Math.floor(deg / 5), k = ((deg % 5) + 5) % 5; return ROOT * 2 ** (o + SCALE[k] / 12); };
/* Music moods: the same garden music in other weathers. Koi Garden is free; the others are bought with pearls in
   Settings and kept in journey.owned as "music-<id>", so iCloud keeps them. Each mood sets the chords, the pace
   (one bar is four beats), how high and how busy the koto melody is, how dark the pad, and its own extra layer:
   rain and drips, high night bells, or a soft taiko drum. */
const MOODS = {
  garden: { name: "Koi Garden", about: "Koto and water", price: 0, bar: 4.8, chords: [[0, 3, 6], [2, 5, 7], [-1, 1, 3], [1, 3, 6]],
    melody: [4, 13], density: 0.38, cut: 760, nightCut: 520, padGain: 0.03, root: -5, bells: 0.2 },
  rain: { name: "Rain on the Pond", about: "Slow and soft, with rain", price: 200, bar: 6.4, chords: [[0, 2, 4], [-2, 1, 3], [-1, 2, 4], [-3, 0, 2]],
    melody: [3, 10], density: 0.22, cut: 560, nightCut: 430, padGain: 0.034, root: -5, bells: 0.06, rain: true },
  night: { name: "Moon Night", about: "Deep, with night bells", price: 250, bar: 5.6, chords: [[-2, 1, 3], [-1, 2, 4], [-3, 0, 3], [-2, 0, 2]],
    melody: [2, 9], density: 0.26, cut: 470, nightCut: 400, padGain: 0.036, root: -10, bells: 0.45, highBells: true },
  festival: { name: "Lantern Festival", about: "Bright, with a taiko drum", price: 300, bar: 3.8, chords: [[0, 3, 6], [1, 3, 6], [2, 5, 7], [0, 2, 5]],
    melody: [6, 15], density: 0.5, cut: 940, nightCut: 660, padGain: 0.024, root: -5, bells: 0.15, drum: true }
};
let previewMood = null;
const mood = () => MOODS[previewMood || audio.mood] || MOODS.garden;
let musicTimer = 0, nextBar = 0, bar = 0, melody = 7, water = null;
function pad(chord, t, len) {
  const lp = ac.createBiquadFilter(), g = ac.createGain(), M = mood();
  lp.type = "lowpass";
  lp.frequency.value = isNight() ? M.nightCut : M.cut;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(M.padGain, t + 2.5);
  g.gain.setValueAtTime(M.padGain, t + len - 1);
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
  lp.connect(g).connect(musicOut());
  send(g, musicRoom(), 0.5);
}
// A soft taiko: a low skin tone that drops in pitch, and a little thud of noise
function taiko(t, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.35);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.connect(g).connect(musicOut());
  send(g, musicRoom(), 0.25);
  o.start(t);
  o.stop(t + 0.65);
}
function playBar(t, n) {
  const M = mood(), BAR = M.bar;
  const chord = M.chords[Math.floor(n / 2) % M.chords.length];
  if (n % 2 === 0) pad(chord, t, BAR * 2);
  pluck(hz(chord[0] + M.root), t, 0.05, 3.5, true, 0.3);
  // A short phrase on three bars of four; the fourth rests
  if (n % 4 !== 3) {
    const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3].filter(() => Math.random() < M.density);
    beats.forEach(b => {
      melody = Math.max(M.melody[0], Math.min(M.melody[1], melody + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      pluck(hz(melody), t + b * BAR / 4, 0.045 + Math.random() * 0.02, 2.4, true, 0.5);
    });
  }
  if (Math.random() < M.bells) bell(hz((M.highBells ? 15 : 12) + Math.floor(Math.random() * 5)), t + Math.random() * BAR, 0.012, true);
  // Rain: drops falling off the eaves into the pond, high and quiet
  if (M.rain) for (let k = 0; k < 3; k++) if (Math.random() < 0.6) pluck(hz(16 + Math.floor(Math.random() * 4)), t + Math.random() * BAR, 0.01, 0.5, true, 0.6);
  // The festival drum: on the first and third beat, with a light double hit before the bar ends now and then
  if (M.drum) {
    taiko(t, 0.07);
    taiko(t + BAR / 2, 0.05);
    if (n % 2 === 1) { taiko(t + BAR * 0.875, 0.03); taiko(t + BAR * 0.9375, 0.035); }
  }
}
function scheduleMusic() {
  if (!ac || ac.state !== "running") return;
  if (nextBar < ac.currentTime) nextBar = ac.currentTime + 0.1;
  while (nextBar < ac.currentTime + 1.5) { playBar(nextBar, bar++); nextBar += mood().bar; }
}
// Rain on the pond: a soft hiss that comes and goes, under the music
function startRain(out) {
  const n = ac.createBufferSource(), hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
  n.buffer = noiseBuf;
  n.loop = true;
  n.playbackRate.value = 0.9;
  hp.type = "highpass"; hp.frequency.value = 1800;
  lp.type = "lowpass"; lp.frequency.value = 6500;
  g.gain.value = 0.011;
  lfo.frequency.value = 0.11;
  depth.gain.value = 0.004;
  lfo.connect(depth).connect(g.gain);
  n.connect(hp).connect(lp).connect(g).connect(out || musicOut());
  n.start();
  lfo.start();
  return { stop: () => { try { n.stop(); lfo.stop(); } catch (e) {} } };
}
// Quiet water under everything: low filtered noise that swells and settles
function startWater(out) {
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
  n.buffer = noiseBuf;
  n.loop = true;
  f.type = "lowpass";
  f.frequency.value = 420;
  g.gain.value = 0.014;
  lfo.frequency.value = 0.07;
  depth.gain.value = 0.008;
  lfo.connect(depth).connect(g.gain);
  n.connect(f).connect(g).connect(out || musicOut());
  n.start();
  lfo.start();
  return { stop: () => { try { n.stop(); lfo.stop(); } catch (e) {} } };
}
let rain = null;
/* Each time the music starts it gets its own pair of gains, one to the music bus and one to the room's reverb. Notes
   already scheduled ring out through them, so when the music stops or the mood changes, those two are faded out in a
   moment: the old mood stops at once instead of ringing on under the new one. */
let musicSession = null;
function newMusicSession() {
  endMusicSession();
  const out = ac.createGain(), room = ac.createGain();
  out.connect(musicBus);
  room.connect(musicRev);
  musicSession = { out, room };
}
function endMusicSession() {
  const s = musicSession;
  if (!s) return;
  musicSession = null;
  const t = ac.currentTime;
  [s.out, s.room].forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.25); });
  setTimeout(() => { try { s.out.disconnect(); s.room.disconnect(); } catch (e) {} }, 400);
}
const musicOut = () => (musicSession || (newMusicSession(), musicSession)).out;
const musicRoom = () => (musicSession || (newMusicSession(), musicSession)).room;
const moodId = () => (MOODS[previewMood] ? previewMood : MOODS[audio.mood] ? audio.mood : "garden");
let musicTrack = null, musicFallback = false, natureTrack = null, natureMood = "";
const musicPlaying = () => !!(musicTimer || musicTrack);
function startMusic() {
  if (musicTimer || musicTrack || !ac) return;
  newMusicSession();
  if (!musicFallback) {
    const session = musicSession;
    musicTrack = loopTrack(`audio/music-${moodId()}.mp3`, musicOut(), () => {
      // The track would not play: use the music the game generates instead
      if (musicSession !== session) return;
      musicFallback = true;
      stopMusic();
      if (audio.musicOn && audio.music > 0) startMusic();
    });
    return;
  }
  nextBar = ac.currentTime + 0.3;
  water = startWater();
  if (mood().rain) rain = startRain();
  scheduleMusic();
  musicTimer = setInterval(scheduleMusic, 400);
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (musicTrack) { musicTrack.stop(); musicTrack = null; }
  if (ac) endMusicSession();
  if (water) { water.stop(); water = null; }
  if (rain) { rain.stop(); rain = null; }
}
// A new mood starts on the next bar: what is already sounding rings out
function restartMusic() {
  if (natureTrack && natureMood !== moodId()) { stopNature(); if (audio.natureOn && audio.nature > 0) startNature(); }
  if (!musicPlaying()) return;
  stopMusic();
  melody = Math.round((mood().melody[0] + mood().melody[1]) / 2);
  startMusic();
}
// Nature sounds follow the mood, on their own bus and volume. They are made here in code (water, and rain for
// Rain on the Pond): the recorded ones from Everygen had a voice talking in them, so none of those are used.
function startNature() {
  if (natureTrack || !ac) return;
  natureMood = moodId();
  const layers = [startWater(natureBus)];
  if (MOODS[natureMood].rain) layers.push(startRain(natureBus));
  natureTrack = { stop: () => layers.forEach(l => l.stop()), pause() {}, resume() {} };
}
function stopNature() {
  if (natureTrack) { natureTrack.stop(); natureTrack = null; }
}
const moodOwned = id => !MOODS[id].price || (journey.owned || []).includes("music-" + id);
let moodBuying = null, moodTimer = 0;
function setMood(id) {
  audio.mood = id;
  saveAudio();
  restartMusic();
}
function endPreview() {
  clearTimeout(moodTimer);
  if (!previewMood) return;
  previewMood = null;
  moodBuying = null;
  restartMusic();
  paintMoods();
}
function paintMoods() {
  const row = $("moodRow");
  if (!row) return;
  if (!MOODS[audio.mood] || !moodOwned(audio.mood)) audio.mood = "garden";
  $("moodBank").textContent = journey.pearls;
  row.innerHTML = Object.entries(MOODS).map(([id, M]) => {
    const own = moodOwned(id), on = (audio.mood || "garden") === id && !previewMood, hear = previewMood === id;
    const listen = audio.musicOn ? "tap to listen" : "turn on music to listen";
    const status = on ? (audio.musicOn ? "Playing" : "Chosen") : own ? "Tap to play"
      : hear ? (journey.pearls >= M.price ? `Tap again to buy · ${M.price}` : `${M.price - journey.pearls} more pearls`)
      : `<i class="pearl"></i> ${M.price} · ${listen}`;
    return `<button class="mood${on ? " on" : ""}${hear ? " hear" : ""}${own ? "" : " locked"}" data-id="${id}"><b>${M.name}</b><span>${M.about}</span><small>${status}</small></button>`;
  }).join("");
}
$("moodRow").addEventListener("click", e => {
  const b = e.target.closest(".mood");
  if (!b) return;
  const id = b.dataset.id, M = MOODS[id];
  audioInit();
  if (moodOwned(id)) { clearTimeout(moodTimer); previewMood = null; moodBuying = null; setMood(id); paintMoods(); return; }
  // First tap: listen for a little while. Second tap while it plays: buy it.
  if (previewMood === id && journey.pearls >= M.price) {
    buyMood(id);
    paintMoods();
    const r = b.getBoundingClientRect();
    sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 22);
    bowl(6, 0.05);
    buzz([12, 30, 12]);
    return;
  }
  listenMood(id);
  paintMoods();
});
// Shared with the shop
function buyMood(id) {
  const M = MOODS[id];
  if (moodOwned(id) || journey.pearls < M.price) return false;
  journey.pearls -= M.price;
  if (!journey.owned) journey.owned = [];
  journey.owned.push("music-" + id);
  saveJourney();
  track("buy", { data: { kind: "music", id, pearls: M.price } });
  clearTimeout(moodTimer);
  previewMood = null;
  setMood(id);
  return true;
}
function listenMood(id) {
  audioInit();
  previewMood = id;
  restartMusic();
  if (!musicPlaying() && audio.musicOn) startMusic();
  clearTimeout(moodTimer);
  moodTimer = setTimeout(() => { endPreview(); if (typeof paintShop === "function" && !$("shopView").hidden) paintShop(); }, 16000);
}
// Leaving the app quiets everything; coming back picks up where it was
document.addEventListener("visibilitychange", () => {
  if (!ac) return;
  // Recorded tracks are <audio> elements, which keep going on their own, so pause them too
  [musicTrack, natureTrack].forEach(tr => tr && (document.hidden ? tr.pause() : tr.resume()));
  if (document.hidden) ac.suspend().catch(() => {});
  else ac.resume().catch(() => {});
});

/* Settings: a switch and a slider for effects, and the same for music */
function syncAudioUI() {
  paintMoods();
  [["sfx", "sfxOn", "sfxVol"], ["music", "musicOn", "musicVol"], ["nature", "natureOn", "natureVol"]].forEach(([k, on, vol]) => {
    $(on).checked = audio[k + "On"];
    const r = $(vol);
    r.value = Math.round(audio[k] * 100);
    r.disabled = !audio[k + "On"];
    r.style.setProperty("--fill", r.value + "%");
  });
}
[["sfx", "sfxOn", "sfxVol"], ["music", "musicOn", "musicVol"], ["nature", "natureOn", "natureVol"]].forEach(([k, on, vol]) => {
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
