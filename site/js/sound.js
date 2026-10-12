// Listen to the migration: each species is a soft voice. Pitch follows how
// far north or south its animals are (snapped to a pentatonic scale so the
// chorus stays consonant); loudness follows how fast they're moving. Land
// animals, sea animals and birds get different registers and timbres.
// Web Audio only, nothing is downloaded. Off until you switch it on.

import { positionAt, recentHeading } from './tracks.js';
import { state, instanceTime } from './store.js';
import { settings } from './settings.js';

const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_MIDI = { marine: 36, land: 48, birds: 60 }; // C2, C3, C4
const TYPICAL_KM_DAY = { land: 15, marine: 60, birds: 250 };

// Latitude −75…75 → a note over two and a half octaves above the group's base, in Hz.
export function latToFreq(lat, group) {
  const k = Math.max(0, Math.min(1, (lat + 75) / 150));
  const steps = Math.round(k * 12); // 12 pentatonic steps ≈ 2.4 octaves
  const midi = BASE_MIDI[group] + 12 * Math.floor(steps / 5) + PENTATONIC[steps % 5];
  return 440 * 2 ** ((midi - 69) / 12);
}

// Speed (km/day) → gain 0…1, relative to what's fast for that kind of animal.
export function speedToLevel(kmPerDay, group) {
  if (!(kmPerDay > 0)) return 0;
  return Math.min(1, (kmPerDay / TYPICAL_KM_DAY[group]) ** 0.6);
}

let ctx = null;
let master = null;
let timer = 0;
const voices = new Map(); // species id → { osc, osc2, filter, gain }

function reverb(ac) {
  // A short generated impulse: soft, airy space without loading a file.
  const len = ac.sampleRate * 2.4;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const c = ac.createConvolver();
  c.buffer = buf;
  return c;
}

function voice(id, group) {
  if (voices.has(id)) return voices.get(id);
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc.type = group === 'land' ? 'triangle' : 'sine';
  osc2.type = 'sine';
  osc2.detune.value = group === 'birds' ? 1200 : 7; // birds: an octave shimmer; others: a slow chorus
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = group === 'birds' ? 3200 : 1400;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const g2 = ctx.createGain();
  g2.gain.value = group === 'birds' ? 0.25 : 0.5;
  osc.connect(filter);
  osc2.connect(g2).connect(filter);
  filter.connect(gain).connect(master);
  if (group === 'marine') { // whales: a slow vibrato
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.18;
    depth.gain.value = 6;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start();
  }
  osc.start();
  osc2.start();
  const v = { osc, osc2, gain };
  voices.set(id, v);
  return v;
}

export async function setSound(on) {
  if (on) {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      const verb = reverb(ctx);
      master.connect(comp).connect(ctx.destination);
      master.connect(verb).connect(wet).connect(ctx.destination);
    }
    await ctx.resume();
    master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.3);
    clearInterval(timer);
    timer = setInterval(update, 150);
  } else if (ctx) {
    clearInterval(timer);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }
}

export function setVolume(v) {
  if (ctx && settings.sound) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
}

// Every 150 ms: retune and re-level each species from where its animals are.
function update() {
  const per = new Map();
  for (const inst of state.instances) {
    const t = instanceTime(inst);
    const p = positionAt(inst.pts, t, inst.gap);
    if (!p) continue;
    if (!per.has(inst.species)) per.set(inst.species, { lat: 0, n: 0, km: 0, k: 0 });
    const s = per.get(inst.species);
    s.lat += p[1];
    s.n++;
    const h = recentHeading(inst.pts, t, 72, inst.gap);
    if (h) { s.km += h.km / 3; s.k++; }
  }
  const voicesOn = Math.max(1, per.size);
  const now = ctx.currentTime;
  for (const sp of state.index?.species || []) {
    const s = per.get(sp.id);
    if (!s || !state.playing) {
      if (voices.has(sp.id)) voices.get(sp.id).gain.gain.setTargetAtTime(0, now, 0.4);
      continue;
    }
    const v = voice(sp.id, sp.group);
    const f = latToFreq(s.lat / s.n, sp.group);
    v.osc.frequency.setTargetAtTime(f, now, 0.35);
    v.osc2.frequency.setTargetAtTime(f, now, 0.35);
    const level = speedToLevel(s.k ? s.km / s.k : 0, sp.group);
    v.gain.gain.setTargetAtTime((0.16 * level) / Math.sqrt(voicesOn), now, 0.4);
  }
}
