/* =====================================================================
   ODYSSEY — Sound
   All sounds are synthesized with the Web Audio API: no audio files.
   Sound.init() must be called from a user gesture (tap / key press).
   ===================================================================== */

const Sound = (() => {
  let ctx = null;
  let master, musicBus, sfxBus, noiseBuf;
  let muted = false;
  try { muted = localStorage.getItem('odyssey-muted') === '1'; } catch (e) { /* ignore */ }

  /** Create (or resume) the audio context. Safe to call many times. */
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain();   sfxBus.gain.value = 0.6;   sfxBus.connect(master);
    // One second of white noise, reused for hits, swooshes and drums.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingTrack) { const t = pendingTrack; pendingTrack = null; playMusic(t); }
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('odyssey-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
  }

  /** A single oscillator note with a quick envelope (optionally sliding pitch). */
  function tone(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }

  /** A burst of filtered noise. */
  function noise(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.02);
  }

  /** Play a quick sequence of notes: [[freq, dur], ...] */
  function arp(notes, type, vol, step) {
    let d = 0;
    for (const [f, dur] of notes) { tone({ f, dur: dur || step, type, vol, delay: d }); d += step; }
  }

  const N = n => 440 * Math.pow(2, (noteNum(n) - 69) / 12);

  // ---- Sound effects --------------------------------------------------
  const sfx = {
    sword()  { noise({ f: 2500, f2: 600, dur: 0.12, vol: 0.25, q: 0.8 }); },
    spin()   { noise({ f: 800, f2: 3000, dur: 0.35, vol: 0.3, q: 0.7 }); tone({ f: 300, f2: 900, dur: 0.3, vol: 0.05, type: 'triangle' }); },
    beam()   { tone({ f: 1200, f2: 2400, dur: 0.15, vol: 0.07, type: 'square' }); },
    jump()   { tone({ f: 260, f2: 620, dur: 0.16, vol: 0.12, type: 'square' }); },
    land()   { noise({ f: 300, dur: 0.06, vol: 0.15, filter: 'lowpass' }); },
    roll()   { noise({ f: 500, f2: 200, dur: 0.2, vol: 0.2, filter: 'lowpass' }); },
    hit()    { tone({ f: 200, f2: 80, dur: 0.12, vol: 0.25, type: 'square' }); noise({ f: 1200, dur: 0.08, vol: 0.2 }); },
    kill()   { arp([[N('C5')], [N('G4')], [N('C4')]], 'square', 0.1, 0.05); noise({ f: 600, dur: 0.25, vol: 0.2 }); },
    hurt()   { tone({ f: 500, f2: 120, dur: 0.3, vol: 0.2, type: 'sawtooth' }); },
    coin()   { tone({ f: N('B5'), dur: 0.06, vol: 0.1 }); tone({ f: N('E6'), dur: 0.2, vol: 0.1, delay: 0.06 }); },
    heart()  { arp([[N('C6')], [N('E6')], [N('G6')]], 'triangle', 0.18, 0.05); },
    key()    { arp([[N('G5')], [N('C6')], [N('E6')], [N('G6')]], 'square', 0.08, 0.06); },
    cut()    { noise({ f: 3000, dur: 0.1, vol: 0.2, q: 2 }); },
    push()   { noise({ f: 150, dur: 0.25, vol: 0.3, filter: 'lowpass' }); },
    smash()  { noise({ f: 200, f2: 60, dur: 0.5, vol: 0.5, filter: 'lowpass' }); tone({ f: 90, f2: 40, dur: 0.4, vol: 0.2, type: 'triangle' }); },
    door()   { tone({ f: 120, f2: 240, dur: 0.25, vol: 0.15, type: 'square' }); noise({ f: 400, dur: 0.25, vol: 0.15 }); },
    unlock() { arp([[N('E5')], [N('G5')], [N('B5')]], 'square', 0.08, 0.05); sfx.door(); },
    fall()   { tone({ f: 700, f2: 90, dur: 0.6, vol: 0.12, type: 'triangle' }); },
    text()   { tone({ f: 900, dur: 0.025, vol: 0.03, type: 'square' }); },
    menu()   { tone({ f: 660, dur: 0.06, vol: 0.08 }); },
    bump()   { tone({ f: 110, dur: 0.06, vol: 0.12, type: 'square' }); },
    crystal(){ arp([[N('A5')], [N('E6')], [N('A6')]], 'triangle', 0.18, 0.07); },
    throw()  { noise({ f: 900, f2: 400, dur: 0.15, vol: 0.12 }); },
    magic()  { tone({ f: 200, f2: 800, dur: 0.5, vol: 0.08, type: 'sawtooth' }); },
    reflect(){ tone({ f: 1500, f2: 3000, dur: 0.1, vol: 0.12 }); noise({ f: 4000, dur: 0.1, vol: 0.15 }); },
    bossHit(){ tone({ f: 150, f2: 60, dur: 0.2, vol: 0.3, type: 'square' }); noise({ f: 800, dur: 0.15, vol: 0.3 }); },
    stomp()  { noise({ f: 120, f2: 40, dur: 0.45, vol: 0.55, filter: 'lowpass' }); },
    screech(){ tone({ f: 1800, f2: 900, dur: 0.4, vol: 0.06, type: 'sawtooth' }); },
    solved() { arp([[N('G5')], [N('F#5')], [N('D#5')], [N('A4')], [N('G#4')], [N('E5')], [N('G#5')], [N('C6'), 0.3]], 'square', 0.08, 0.08); },
    fanfare(){ arp([[N('C5')], [N('E5')], [N('G5')], [N('C6'), 0.12], [N('G5')], [N('C6'), 0.5]], 'square', 0.1, 0.11);
               arp([[N('C4')], [N('E4')], [N('G4')], [N('C5'), 0.12], [N('G4')], [N('E4'), 0.5]], 'triangle', 0.15, 0.11); },
    heal()   { arp([[N('C5')], [N('E5')], [N('G5')], [N('C6')], [N('E6')], [N('G6')]], 'triangle', 0.15, 0.06); },
    buy()    { sfx.coin(); sfx.heart(); },
    error()  { tone({ f: 180, dur: 0.12, vol: 0.12, type: 'square' }); tone({ f: 140, dur: 0.18, vol: 0.12, type: 'square', delay: 0.12 }); },
  };

  // ---- Music ------------------------------------------------------------
  // Each track lists notes per 8th-note step. "-" holds the previous note,
  // "." is a rest. Tracks loop forever.
  function noteNum(n) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
    return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  }

  const TRACKS = {
    title: { bpm: 92, lead:
      'E5 - G5 - C6 - B5 A5 G5 - - - E5 - - - F5 - A5 - D6 - C6 B5 A5 - - - G5 - - - ' +
      'E5 - G5 - C6 - D6 E6 D6 - C6 - A5 - - - F5 - E5 - D5 - G5 - C5 - - - - - - - ',
      bass:
      'C3 - G3 - C4 - G3 - C3 - G3 - C4 - G3 - F2 - C3 - F3 - C3 - G2 - D3 - G3 - D3 - ' +
      'A2 - E3 - A3 - E3 - F2 - C3 - F3 - C3 - D3 - A3 - G2 - D3 - C3 - G3 - C4 - - - ' },
    village: { bpm: 116, lead:
      'G5 - E5 C5 D5 - E5 - F5 - A5 - G5 - - - E5 - C5 E5 G5 - C6 - B5 A5 G5 - - - . . ' +
      'A5 - F5 A5 G5 - E5 G5 F5 - D5 F5 E5 - C5 - D5 - E5 - F5 - B4 - C5 - - - . - . - ',
      bass:
      'C3 . G3 . E3 . G3 . F3 . A3 . C3 . G3 . C3 . G3 . E3 . G3 . F3 . G3 . C3 . G2 . ' +
      'F3 . C3 . E3 . C3 . D3 . A2 . C3 . G2 . G2 . D3 . G2 . B2 . C3 . G2 . C3 . . . ' },
    field: { bpm: 128, lead:
      'D5 - G5 - - - A5 B5 C6 - B5 - A5 - G5 - E5 - - - G5 - A5 - B5 - - - - - . . ' +
      'D5 - G5 - - - A5 B5 C6 - E6 - D6 - B5 - C6 - B5 - A5 - F#5 - G5 - - - - - . . ',
      bass:
      'G2 G3 G2 G3 G2 G3 G2 G3 C3 C4 C3 C4 C3 C4 C3 C4 E2 E3 E2 E3 C3 C4 C3 C4 D3 D4 D3 D4 D3 D4 D3 D4 ' +
      'G2 G3 G2 G3 G2 G3 G2 G3 C3 C4 C3 C4 C3 C4 C3 C4 E2 E3 E2 E3 D3 D4 D3 D4 G2 G3 G2 G3 G2 . . . ' },
    dungeon: { bpm: 96, lead:
      'A4 . C5 . E5 . D5 . C5 . B4 . A4 - - . G4 . B4 . D5 . C5 . B4 . G#4 . A4 - - . ' +
      'F4 . A4 . C5 . B4 . A4 . G4 . F4 - - . E4 . G#4 . B4 . D5 . C5 - B4 - A4 - - . ',
      bass:
      'A2 - - - E3 - - - A2 - - - E3 - - - G2 - - - D3 - - - E2 - - - E3 - - - ' +
      'F2 - - - C3 - - - F2 - - - C3 - - - E2 - - - B2 - - - A2 - - - E2 - - - ' },
    boss: { bpm: 152, lead:
      'E5 E5 . E5 G5 . E5 . F#5 F#5 . F#5 A5 . F#5 . G5 G5 . G5 B5 . G5 . A5 - G5 - F#5 - D#5 - ',
      bass:
      'E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 D2 D3 D2 D3 D2 D3 C2 C3 C2 C3 C2 C3 C2 C3 B1 B2 B1 B2 B1 B2 B1 B2 ' },
    castle: { bpm: 104, lead:
      'D5 - - - A4 - D5 - F5 - E5 - D5 - C#5 - D5 - - - . . . . A4 - Bb4 - A4 - G4 - ' +
      'F4 - - - A4 - D5 - F5 - G5 - A5 - G5 F5 E5 - - - C#5 - E5 - A5 - G5 - E5 - ',
      bass:
      'D2 - D3 - D2 - D3 - Bb1 - Bb2 - Bb1 - Bb2 - G1 - G2 - G1 - G2 - A1 - A2 - A1 - A2 - ' +
      'D2 - D3 - D2 - D3 - Bb1 - Bb2 - Bb1 - Bb2 - G1 - G2 - A1 - A2 - A1 - A2 - C#2 - E2 - ' },
    final: { bpm: 160, lead:
      'D5 . D5 F5 . D5 A5 . G5 . F5 E5 . C#5 D5 . Bb4 . Bb4 D5 . Bb4 F5 . E5 . D5 C#5 . A4 C#5 E5 ',
      bass:
      'D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 D2 D3 A1 A2 A1 A2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 Bb1 Bb2 A1 A2 A1 A2 A1 A2 C#2 E2 ' },
    ending: { bpm: 84, lead:
      'C5 - E5 - G5 - - - A5 - G5 - E5 - - - F5 - A5 - C6 - - - B5 - G5 - - - - - ' +
      'C6 - B5 - A5 - - - G5 - E5 - C5 - - - D5 - E5 - F5 - - - G5 - - - C6 - - - ',
      bass:
      'C3 - G3 - C4 - - - A2 - E3 - A3 - - - F2 - C3 - F3 - - - G2 - D3 - G3 - - - ' +
      'A2 - E3 - A3 - - - E2 - B2 - E3 - - - F2 - C3 - G2 - D3 - C3 - G3 - C4 - - - ' },
  };

  /** Convert a track string into [{step, freq, len}] events. */
  function parse(str) {
    const toks = str.trim().split(/\s+/);
    const ev = [];
    toks.forEach((tk, i) => {
      if (tk === '-') { if (ev.length && ev[ev.length - 1].end === i) { ev[ev.length - 1].len++; ev[ev.length - 1].end++; } return; }
      if (tk === '.') return;
      ev.push({ step: i, freq: N(tk), len: 1, end: i + 1 });
    });
    return { ev, steps: toks.length };
  }
  const parsed = {};
  for (const k in TRACKS) {
    const t = TRACKS[k];
    parsed[k] = { bpm: t.bpm, lead: parse(t.lead), bass: parse(t.bass) };
  }

  let current = null, pendingTrack = null, timer = null;
  let step = 0, nextTime = 0;

  function playMusic(name) {
    if (!ctx) { pendingTrack = name; return; }
    if (current && current.name === name) return;
    stopMusic();
    const tr = parsed[name];
    if (!tr) return;
    current = { name, tr, gain: ctx.createGain() };
    current.gain.gain.value = 1;
    current.gain.connect(musicBus);
    step = 0; nextTime = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 30);
    schedule();
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
    if (current && ctx) {
      const g = current.gain;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => g.disconnect(), 400);
    }
    current = null;
  }

  function schedule() {
    if (!current) return;
    const tr = current.tr;
    const stepDur = 60 / tr.bpm / 2;
    // If the tab was hidden for a while, skip ahead instead of bursting notes.
    if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.15) {
      voice(tr.lead, step, nextTime, stepDur, 'square', 0.09);
      voice(tr.bass, step, nextTime, stepDur, 'triangle', 0.22);
      nextTime += stepDur;
      step++;
    }
  }

  function voice(part, s, t, stepDur, type, vol) {
    const local = s % part.steps;
    for (const e of part.ev) {
      if (e.step !== local) continue;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = e.freq;
      const dur = e.len * stepDur * 0.92;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.05));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(current.gain);
      osc.start(t); osc.stop(t + dur + 0.02);
    }
  }

  return {
    init, sfx, playMusic, stopMusic,
    get muted() { return muted; },
    setMuted, toggleMute() { setMuted(!muted); return muted; },
  };
})();
