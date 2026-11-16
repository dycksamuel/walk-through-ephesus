// All sound is made by the browser itself (the Web Audio API). There are no sound files to download.
// Layers: market murmur, sea and gulls, a silversmith's hammer, hillside wind, and the theatre crowd.
// Each layer gets louder as you walk toward where it belongs.

export function createAudio() {
  let ctx = null, master = null, on = true;
  const layers = {};
  let nextGull = 0, nextTink = 0, chantOn = false, nextBeat = 0, beat = 0;

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2; }   // soft "brown" noise
    return buf;
  }
  // A looping band of noise with its own volume control.
  function layer(name, type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = layers.noise; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master); src.start(0, Math.random() * 3);
    layers[name] = { gain, filter };
  }
  function blip(freq0, freq1, dur, vol, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq0, t); o.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  // Browsers only allow sound after a tap or click, so this is called from the Start button.
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ctx.destination);
      layers.noise = noiseBuffer(4);
      layer('market', 'bandpass', 520, 0.7);     // many voices talking at once
      layer('sea', 'lowpass', 380, 0.3);         // slow wash of waves
      layer('wind', 'bandpass', 900, 0.4);
      layer('crowd', 'bandpass', 420, 0.5);      // the theatre crowd in the riot scene
    } catch (e) { ctx = null; }                  // no sound available: the game carries on silently
  }

  const near = (px, pz, x, z, r) => Math.max(0, 1 - Math.hypot(px - x, pz - z) / r);
  const set = (name, v) => { if (layers[name]) layers[name].gain.gain.setTargetAtTime(v, ctx.currentTime, 0.5); };

  // Called every frame with where the player is standing.
  function update(player, t, riotLevel) {
    if (!ctx || ctx.state !== 'running') return;
    const market = Math.max(near(player.x, player.z, -91, 75, 85), near(player.x, player.z, 152, 172, 60) * 0.5);
    const sea = near(player.x, player.z, -200, 0, 110);
    const high = Math.min(1, Math.max(0, (player.y - 8) / 25));
    const quiet = riotLevel > 0 ? 0.25 : 1;
    set('market', market * 0.16 * quiet * (0.85 + 0.15 * Math.sin(t * 0.7)));
    set('sea', sea * 0.22 * quiet * (0.7 + 0.3 * Math.sin(t * 0.45)));
    set('wind', (0.02 + high * 0.1) * (0.7 + 0.3 * Math.sin(t * 0.3)));
    // the crowd: a steady roar, with a five-beat pulse under the chant
    let crowd = riotLevel * 0.3;
    if (chantOn && riotLevel > 0) {
      if (t > nextBeat) { beat = (beat + 1) % 8; nextBeat = t + 0.34; if (beat < 5) blip(150 + (beat === 0 ? 30 : 0), 110, 0.26, 0.11 * riotLevel, 'sawtooth'); }
      crowd *= beat < 5 ? 1.5 : 0.6;
    }
    if (layers.crowd) layers.crowd.gain.gain.setTargetAtTime(crowd, ctx.currentTime, 0.08);
    if (riotLevel > 0) return;
    // gulls by the water
    if (sea > 0.25 && t > nextGull) { nextGull = t + 3 + Math.random() * 7; const f = 1500 + Math.random() * 500; blip(f, f * 0.7, 0.28, 0.035 * sea); setTimeout(() => ctx && blip(f * 1.05, f * 0.72, 0.24, 0.03 * sea), 320); }
    // the silversmith's hammer
    const smith = near(player.x, player.z, -128, 62, 26);
    if (smith > 0 && t > nextTink) { nextTink = t + (Math.random() < 0.3 ? 1.6 + Math.random() * 2 : 0.42); blip(2300 + Math.random() * 300, 1900, 0.09, 0.05 * smith, 'triangle'); }
  }

  return {
    start, update,
    setOn(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.1); },
    isOn: () => on,
    chant(v) { chantOn = v; },
    chime() { if (ctx && on) { blip(880, 880, 0.5, 0.08); setTimeout(() => ctx && blip(1320, 1320, 0.7, 0.06), 140); } },   // a fragment is found
  };
}
