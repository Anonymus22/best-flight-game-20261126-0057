// Skylark audio: every sound is synthesised live with WebAudio.
// No audio files, no network. Engine hum follows the throttle,
// rings chime, landings thud, crashes crunch. M toggles mute.

var SkyAudio = (function () {
  var ctx = null;
  var engineOsc = null;
  var engineOsc2 = null;
  var engineGain = null;
  var windGain = null;
  var windSrc = null;
  var muted = false;
  var started = false;

  function ensureContext() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch (e) {
      return false;
    }
  }

  function startEngine() {
    if (started || !ensureContext()) return;
    started = true;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'triangle';
      engineOsc2.frequency.value = 110;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();

      // Wind noise: looped filtered noise buffer, gain follows speed.
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      var windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0.0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
    } catch (e) {
      started = false;
    }
  }

  function setEngine(throttle, speed, flying) {
    if (!started || !ctx || muted) return;
    var t = ctx.currentTime;
    var freq = 52 + throttle * 68;
    if (engineOsc) engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    if (engineOsc2) engineOsc2.frequency.setTargetAtTime(freq * 2.02, t, 0.08);
    var vol = flying ? 0.045 + throttle * 0.05 : 0.03 + throttle * 0.02;
    if (engineGain) engineGain.gain.setTargetAtTime(muted ? 0 : vol, t, 0.1);
    if (windGain) windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.09, speed * 0.00035), t, 0.15);
  }

  function blip(freq, dur, type, vol, when) {
    if (!ctx || muted) return;
    try {
      var t = ctx.currentTime + (when || 0);
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* sound is decoration, never fatal */ }
  }

  function ringChime() {
    startEngine();
    blip(880, 0.35, 'sine', 0.22, 0);
    blip(1318, 0.45, 'sine', 0.18, 0.07);
    blip(1760, 0.5, 'sine', 0.12, 0.14);
  }

  function click() {
    startEngine();
    blip(1200, 0.06, 'square', 0.06, 0);
  }

  function thud() {
    if (!ctx || muted) return;
    try {
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.35);
    } catch (e) { /* ignore */ }
  }

  function crash() {
    if (!ctx || muted) return;
    try {
      var len = ctx.sampleRate * 0.6;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      var g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
    thud();
  }

  function fanfare() {
    startEngine();
    var notes = [523, 659, 784, 1046];
    for (var i = 0; i < notes.length; i++) blip(notes[i], 0.4, 'triangle', 0.16, i * 0.12);
  }

  function toggleMute() {
    muted = !muted;
    if (engineGain && ctx) engineGain.gain.setTargetAtTime(muted ? 0 : 0.05, ctx.currentTime, 0.05);
    if (windGain && ctx) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    return muted;
  }

  function isMuted() { return muted; }

  return {
    startEngine: startEngine,
    setEngine: setEngine,
    ringChime: ringChime,
    click: click,
    thud: thud,
    crash: crash,
    fanfare: fanfare,
    toggleMute: toggleMute,
    isMuted: isMuted
  };
})();
