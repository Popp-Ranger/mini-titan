/* Mini-Titan — sons et vibrations.
   Synthèse WebAudio pure (aucun fichier son) : sinus / triangles, enveloppes douces, petits glissandos.

   MT.sfx.names            liste des sons
   MT.sfx.play(nom, opts)  opts facultatif : { volume:0..1.5, pitch:0.25..4, delay:secondes }
                           renvoie le nombre de voix programmées (0 = rien joué). Ne lève jamais d'erreur.
   MT.sfx.mute(bool)       coupe / rétablit le son      MT.sfx.isMuted()
   MT.sfx.unlock()         crée / reprend l'AudioContext : à appeler au premier geste de l'utilisateur
                           (une écoute automatique des gestes le fait aussi, par sécurité)
   MT.sfx.hapticsOff       booléen : true = plus aucune vibration
   MT.haptic(motif)        motif = durée en ms, tableau [vibre, pause, vibre…] ou nom de MT.haptic.presets */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};

  var AC = null;
  try { AC = window.AudioContext || window.webkitAudioContext || null; } catch (e) { AC = null; }

  var MASTER = 0.25;          // gain maître (≤ 0,25)
  var ctx = null, bus = null, master = null, noiseBuf = null;
  var muted = false, primed = false, unlockAt = 0;
  var lastPlay = {};          // anti-rafale : nom -> horodatage
  var T0 = 0, V = 1, P = 1;   // contexte du son en cours : départ, volume, hauteur
  var voices = 0, total = 0;

  /* ---------- moteur ---------- */

  function ensure() {
    if (ctx || !AC) return ctx;
    var c = null;
    try { c = new AC({ latencyHint: 'interactive' }); }
    catch (e) { try { c = new AC(); } catch (e2) { c = null; } }
    if (!c) return null;
    try {
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3;
      comp.attack.value = 0.004; comp.release.value = 0.18;
      master = c.createGain();
      master.gain.value = muted ? 0 : MASTER;
      bus = c.createGain();
      bus.gain.value = 1;
      bus.connect(comp); comp.connect(master); master.connect(c.destination);

      // un soupçon d'espace : écho court, filtré, très discret
      var send = c.createGain(), dl = c.createDelay(0.5), lp = c.createBiquadFilter(), fb = c.createGain();
      send.gain.value = 0.13; dl.delayTime.value = 0.105; fb.gain.value = 0.24;
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      bus.connect(send); send.connect(dl); dl.connect(lp); lp.connect(comp);
      lp.connect(fb); fb.connect(dl);

      // une seconde de bruit blanc, réutilisée par tous les sons « soufflés »
      var n = Math.floor(c.sampleRate), d;
      noiseBuf = c.createBuffer(1, n, c.sampleRate);
      d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      ctx = c;
    } catch (e3) {
      ctx = null; bus = null; master = null; noiseBuf = null;
      try { c.close(); } catch (e4) {}
    }
    return ctx;
  }

  function resume() {
    try {
      if (ctx && ctx.state !== 'running' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }

  function unlock() {
    try {
      if (!ensure()) return false;
      unlockAt = Date.now();
      resume();
      if (!primed) {                      // iOS : un tampon muet joué dans le geste débloque la sortie
        var s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start(0);
        primed = true;
      }
      return true;
    } catch (e) { return false; }
  }

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function envelope(g, t0, a, dur, r, vol, s) {
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.setTargetAtTime(vol * s, t0 + a, Math.max(0.012, (dur - a) / 3));
    g.gain.setTargetAtTime(0, t0 + dur, Math.max(0.008, r / 4));
  }

  function release(src, nodes) {
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} }
    };
  }

  /* Une voix d'oscillateur.
     o : f (Hz), to + glide (glissando), path [[dt, Hz]…], dur, vol, type, a (attaque), r (relâche),
         s (niveau tenu 0..1), vib [Hz, profondeur Hz], lp (passe-bas : Hz ou [de, vers]), trem [Hz, profondeur 0..1] */
  function tone(t, o) {
    var t0 = T0 + t, dur = o.dur || 0.1;
    var a = Math.min(o.a == null ? 0.008 : o.a, dur * 0.5);
    var r = o.r == null ? Math.max(0.05, dur * 0.6) : o.r;
    var vol = (o.vol == null ? 0.4 : o.vol) * V;
    var end = t0 + dur + r * 1.6 + 0.03;
    var osc = ctx.createOscillator(), g = ctx.createGain(), node = osc, all = [g], i;

    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f * P), t0);
    if (o.path) {
      for (i = 0; i < o.path.length; i++) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.path[i][1] * P), t0 + o.path[i][0]);
      }
    } else if (o.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * P), t0 + (o.glide || dur));
    }
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(o.vib[1] * P, t0 + dur * 0.45);
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t0); lfo.stop(end);
      all.push(lg);
    }
    if (o.lp) {
      var flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.Q.value = 0.7;
      if (o.lp.length) {
        flt.frequency.setValueAtTime(o.lp[0], t0);
        flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.lp[1]), t0 + dur);
      } else {
        flt.frequency.value = o.lp;
      }
      node.connect(flt); node = flt; all.push(flt);
    }
    if (o.trem) {
      var tg = ctx.createGain(), lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
      tg.gain.value = 1 - o.trem[1] * 0.5;
      lfo2.frequency.value = o.trem[0];
      lg2.gain.value = o.trem[1] * 0.5;
      lfo2.connect(lg2); lg2.connect(tg.gain);
      lfo2.start(t0); lfo2.stop(end);
      node.connect(tg); node = tg; all.push(tg, lg2);
    }
    envelope(g, t0, a, dur, r, vol, o.s == null ? 0.55 : o.s);
    node.connect(g); g.connect(bus);
    osc.start(t0); osc.stop(end);
    release(osc, all);
    voices++;
  }

  /* Une note « clochette » : fondamentale + un peu d'octave, décroissance naturelle. */
  function bell(t, f, dur, vol) {
    tone(t, { f: f, dur: dur, vol: vol, a: 0.005, s: 0.3, r: Math.max(0.09, dur * 0.9) });
    tone(t, { f: f * 2, dur: dur * 0.55, vol: vol * 0.2, a: 0.004, s: 0.2, r: Math.max(0.05, dur * 0.4) });
  }

  /* Un souffle de bruit filtré. o : dur, vol, type (bandpass…), f, to, q, a, r, s */
  function noise(t, o) {
    var t0 = T0 + t, dur = o.dur || 0.1;
    var a = Math.min(o.a == null ? 0.006 : o.a, dur * 0.5);
    var r = o.r == null ? Math.max(0.04, dur * 0.5) : o.r;
    var vol = (o.vol == null ? 0.2 : o.vol) * V;
    var end = t0 + dur + r * 1.6 + 0.03;
    var src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    flt.type = o.type || 'bandpass';
    flt.Q.value = o.q || 0.8;
    flt.frequency.setValueAtTime(Math.max(40, o.f * P), t0);
    if (o.to) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.to * P), t0 + dur);
    envelope(g, t0, a, dur, r, vol, o.s == null ? 0.7 : o.s);
    src.connect(flt); flt.connect(g); g.connect(bus);
    src.start(t0, Math.random() * 0.8); src.stop(end);
    release(src, [flt, g]);
    voices++;
  }

  /* ---------- les sons ---------- */

  var SOUNDS = {
    // interface
    tap: function () {
      tone(0, { f: 760, to: 540, dur: 0.045, vol: 0.15, a: 0.003, r: 0.05 });
      tone(0, { f: 1520, dur: 0.02, vol: 0.025, a: 0.002, r: 0.03 });
    },
    open: function () {
      tone(0, { f: 440, to: 830, dur: 0.12, glide: 0.11, vol: 0.34, a: 0.01, r: 0.08 });
      bell(0.1, midi(84), 0.16, 0.26);
    },
    close: function () {
      tone(0, { f: 830, to: 440, dur: 0.12, glide: 0.11, vol: 0.32, a: 0.01, r: 0.08 });
      bell(0.1, midi(72), 0.14, 0.24);
    },
    ok: function () {
      bell(0, midi(79), 0.1, 0.4);
      bell(0.085, midi(84), 0.3, 0.44);
    },
    no: function () {
      tone(0, { type: 'triangle', lp: 950, f: 240, to: 200, dur: 0.1, vol: 0.6, a: 0.008, r: 0.07 });
      tone(0.13, { type: 'triangle', lp: 950, f: 190, to: 150, dur: 0.17, vol: 0.6, a: 0.008, r: 0.12 });
    },
    coin: function () {
      tone(0, { f: midi(83), dur: 0.06, vol: 0.34, a: 0.004, s: 0.9, r: 0.05 });
      bell(0.065, midi(88), 0.36, 0.42);
    },
    pop: function () {
      tone(0, { f: 360, to: 1150, dur: 0.06, glide: 0.05, vol: 0.5, a: 0.003, r: 0.05 });
      noise(0, { type: 'highpass', f: 3200, dur: 0.02, vol: 0.07, r: 0.03 });
    },

    // soins
    eat: function () {
      for (var i = 0; i < 3; i++) {
        tone(i * 0.13, { type: 'triangle', lp: 1500, f: 560 - i * 35, to: 290, dur: 0.07, vol: 0.55, a: 0.005, r: 0.05 });
        noise(i * 0.13, { f: 1900, q: 1.1, dur: 0.045, vol: 0.12, r: 0.04 });
      }
      tone(0.42, { f: 250, to: 430, dur: 0.1, vol: 0.34, a: 0.01, r: 0.08 });   // gloups
    },
    wash: function () {
      noise(0, { f: 480, to: 2700, q: 0.8, dur: 0.5, vol: 0.4, a: 0.09, r: 0.2 });
      noise(0.34, { f: 2500, to: 800, q: 0.8, dur: 0.38, vol: 0.3, a: 0.08, r: 0.22 });
      var b = [[0.08, 520], [0.2, 760], [0.31, 610], [0.45, 940], [0.6, 820], [0.72, 1100]];
      for (var i = 0; i < b.length; i++) {
        tone(b[i][0], { f: b[i][1], to: b[i][1] * 2.1, dur: 0.05, glide: 0.045, vol: 0.2, a: 0.004, r: 0.04 });
      }
    },
    heal: function () {
      var n = [72, 76, 79, 83, 86, 91];
      for (var i = 0; i < n.length; i++) bell(i * 0.055, midi(n[i]), i === n.length - 1 ? 0.45 : 0.13, 0.28);
      noise(0, { type: 'highpass', f: 5200, dur: 0.5, vol: 0.035, a: 0.15, r: 0.25 });
    },
    poop: function () {
      tone(0, { f: 330, to: 95, dur: 0.2, glide: 0.18, vol: 0.55, a: 0.006, r: 0.08 });
      noise(0.02, { type: 'lowpass', f: 520, dur: 0.1, vol: 0.16, r: 0.06 });
      tone(0.25, { f: 150, to: 235, dur: 0.09, vol: 0.38, a: 0.008, r: 0.07 });
    },
    sleep: function () {
      var n = [79, 76, 72];
      for (var i = 0; i < 3; i++) {
        tone(i * 0.2, { f: midi(n[i]), dur: i === 2 ? 0.4 : 0.2, vol: 0.3, a: 0.03, s: 0.6, r: i === 2 ? 0.5 : 0.3 });
      }
      tone(0, { f: midi(60), dur: 0.8, vol: 0.12, a: 0.2, r: 0.5 });
    },
    wake: function () {
      tone(0, { f: midi(67), to: midi(72), glide: 0.14, dur: 0.19, vol: 0.34, a: 0.02, r: 0.1 });
      bell(0.2, midi(76), 0.13, 0.32);
      bell(0.32, midi(79), 0.3, 0.36);
    },

    // humeurs
    happy: function () {
      var n = [72, 76, 79, 84];
      for (var i = 0; i < 4; i++) bell(i * 0.065, midi(n[i]), i === 3 ? 0.3 : 0.11, 0.34);
    },
    love: function () {
      tone(0, { f: midi(76), to: midi(81), glide: 0.11, dur: 0.2, vol: 0.38, a: 0.015, vib: [6, 5], r: 0.12 });
      tone(0.21, { f: midi(81), to: midi(88), glide: 0.11, dur: 0.38, vol: 0.4, a: 0.015, vib: [6, 7], r: 0.3 });
      bell(0.38, midi(96), 0.22, 0.1);
      bell(0.48, midi(100), 0.3, 0.08);
    },
    sad: function () {
      tone(0, { f: midi(72), to: midi(69), glide: 0.27, dur: 0.3, vol: 0.38, a: 0.03, vib: [5, 4], r: 0.15 });
      tone(0.33, { f: midi(68), to: midi(63), glide: 0.45, dur: 0.5, vol: 0.38, a: 0.03, vib: [5, 5], r: 0.3 });
    },
    sick: function () {
      tone(0, { type: 'triangle', lp: 1100, f: 330, to: 262, dur: 0.55, vol: 0.42, a: 0.04, vib: [7, 14], r: 0.15 });
      tone(0.02, { f: 349, to: 271, dur: 0.55, vol: 0.2, a: 0.04, vib: [6, 10], r: 0.15 });
      tone(0.62, { f: 205, to: 140, dur: 0.14, vol: 0.38, a: 0.01, r: 0.1 });
    },
    call: function () {
      var seq = [[0, 81, 0.09], [0.14, 81, 0.09], [0.28, 86, 0.32]];
      for (var i = 0; i < 3; i++) {
        var f = midi(seq[i][1]), d = seq[i][2], held = i === 2;
        tone(seq[i][0], { f: f, dur: d, vol: 0.42, a: 0.006, s: 0.75, vib: held ? [7, 9] : null, r: held ? 0.25 : 0.06 });
        tone(seq[i][0], { type: 'triangle', lp: 3200, f: f, dur: d, vol: 0.14, a: 0.006, s: 0.6, r: held ? 0.2 : 0.05 });
      }
    },
    roar: function () {
      var path = [[0.09, 330], [0.52, 105]];
      tone(0, { type: 'sawtooth', lp: [1100, 380], f: 250, path: path, dur: 0.5, vol: 0.5, a: 0.03, s: 0.8, trem: [27, 0.7], r: 0.16 });
      tone(0, { f: 125, path: [[0.09, 165], [0.52, 55]], dur: 0.5, vol: 0.4, a: 0.03, s: 0.8, r: 0.16 });
      noise(0, { f: 780, to: 340, q: 0.9, dur: 0.48, vol: 0.34, a: 0.04, r: 0.18 });
    },

    // grands moments
    hatch: function () {
      noise(0, { type: 'highpass', f: 2600, dur: 0.03, vol: 0.4, a: 0.002, r: 0.03 });
      noise(0.12, { type: 'highpass', f: 3100, dur: 0.025, vol: 0.34, a: 0.002, r: 0.03 });
      noise(0.21, { f: 1900, q: 0.7, dur: 0.06, vol: 0.5, a: 0.003, r: 0.06 });
      tone(0.32, { f: 700, to: 1500, dur: 0.11, vol: 0.36, a: 0.008, r: 0.06 });
      tone(0.46, { f: 900, to: 1750, dur: 0.11, vol: 0.36, a: 0.008, r: 0.06 });
      bell(0.63, midi(79), 0.11, 0.32);
      bell(0.73, midi(84), 0.4, 0.38);
    },
    evolve: function () {
      var up = [72, 76, 79, 84, 88, 91], i;
      for (i = 0; i < up.length; i++) bell(i * 0.1, midi(up[i]), 0.12, 0.3);
      var chord = [84, 88, 91, 96];
      for (i = 0; i < chord.length; i++) bell(0.62, midi(chord[i]), 0.5, i === 3 ? 0.2 : 0.24);
      tone(0, { type: 'triangle', lp: 1400, f: 131, to: 523, glide: 0.6, dur: 0.62, vol: 0.2, a: 0.08, r: 0.1 });
      noise(0, { f: 500, to: 5200, q: 0.9, dur: 0.6, vol: 0.07, a: 0.2, r: 0.1 });
      bell(0.82, midi(103), 0.3, 0.07);
      bell(0.92, midi(108), 0.3, 0.06);
    },
    win: function () {
      var n = [79, 84, 88, 91], i;
      for (i = 0; i < 4; i++) bell(i * 0.08, midi(n[i]), 0.1, 0.32);
      var chord = [84, 88, 96];
      for (i = 0; i < 3; i++) bell(0.36, midi(chord[i]), 0.42, 0.26);
    },
    lose: function () {
      var s = [[0, 67, 66, 0.16], [0.2, 64, 63, 0.16], [0.4, 60, 56, 0.42]];
      for (var i = 0; i < 3; i++) {
        tone(s[i][0], { type: 'triangle', lp: 1300, f: midi(s[i][1]), to: midi(s[i][2]), dur: s[i][3], vol: 0.52,
          a: 0.015, s: 0.7, vib: i === 2 ? [5, 4] : null, r: i === 2 ? 0.3 : 0.08 });
      }
    },
    die: function () {
      tone(0, { f: midi(69), dur: 0.42, vol: 0.34, a: 0.06, s: 0.7, vib: [4.5, 3], r: 0.3 });
      tone(0.46, { f: midi(65), dur: 0.42, vol: 0.34, a: 0.06, s: 0.7, vib: [4.5, 3], r: 0.3 });
      tone(0.92, { f: midi(62), to: midi(57), glide: 0.9, dur: 0.9, vol: 0.34, a: 0.06, s: 0.6, vib: [4, 4], r: 0.6 });
      tone(0, { f: midi(50), dur: 1.7, vol: 0.16, a: 0.25, s: 0.8, r: 0.6 });
    }
  };

  var NAMES = ['tap', 'open', 'close', 'ok', 'no', 'eat', 'happy', 'love', 'sad', 'sick', 'heal', 'wash', 'pop',
    'poop', 'sleep', 'wake', 'call', 'evolve', 'hatch', 'win', 'lose', 'die', 'coin', 'roar'];

  /* ---------- API ---------- */

  function play(name, opts) {
    try {
      if (muted || typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(SOUNDS, name)) return 0;
      if (!ctx) return 0;                                   // pas encore de geste : silence, sans erreur
      var now = Date.now();
      if (ctx.state !== 'running') {
        resume();
        // juste après unlock() la reprise est en cours : on programme quand même (l'horloge est figée,
        // le son partira à la reprise). Sinon on laisse tomber pour ne pas empiler des sons en retard.
        if (now - unlockAt > 600) return 0;
      }
      if (lastPlay[name] && now - lastPlay[name] < 30) return 0;   // anti-rafale
      lastPlay[name] = now;

      var o = opts || {}, v = o.volume != null ? o.volume : o.vol, p = o.pitch != null ? o.pitch : o.rate;
      V = (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1.5, v)) : 1;
      P = (typeof p === 'number' && isFinite(p)) ? Math.max(0.25, Math.min(4, p)) : 1;
      var delay = (typeof o.delay === 'number' && isFinite(o.delay)) ? Math.max(0, Math.min(10, o.delay)) : 0;
      if (V === 0) return 0;
      T0 = ctx.currentTime + 0.012 + delay;
      voices = 0;
      SOUNDS[name]();
      total += voices;
      return voices;
    } catch (e) { return 0; }
  }

  function mute(on) {
    try {
      muted = !!on;
      if (ctx && master) {
        var t = ctx.currentTime;
        try { master.gain.cancelScheduledValues(t); } catch (e1) {}
        master.gain.setTargetAtTime(muted ? 0 : MASTER, t, 0.015);
      }
    } catch (e) {}
    return muted;
  }

  MT.sfx = {
    names: NAMES,
    play: play,
    mute: mute,
    isMuted: function () { return muted; },
    unlock: unlock,
    hapticsOff: !!(MT.sfx && MT.sfx.hapticsOff),
    /* pour les tests / la planche de sons : état du moteur (ne crée rien) */
    debug: function () {
      return { supported: !!AC, state: ctx ? ctx.state : 'none', time: ctx ? ctx.currentTime : 0,
        voices: total, ctx: ctx, out: master };
    }
  };

  /* ---------- vibrations ---------- */

  var PRESETS = {
    tap: 8, ok: [12, 40, 18], no: [28, 50, 28], pop: 12, heavy: 40,
    success: [10, 30, 10, 30, 30], call: [60, 80, 60], roar: [20, 30, 90], sad: [70]
  };

  MT.haptic = function (pattern) {
    try {
      if (MT.sfx.hapticsOff) return false;
      var nav = window.navigator;
      if (!nav || typeof nav.vibrate !== 'function') return false;        // iOS : pas de vibration web
      if (pattern == null) pattern = PRESETS.tap;                         // sans argument : petite touche
      if (typeof pattern === 'string') {
        if (!Object.prototype.hasOwnProperty.call(PRESETS, pattern)) return false;   // nom inconnu : rien
        pattern = PRESETS[pattern];
      }
      if (typeof pattern !== 'number' && !(pattern && pattern.length)) return false;
      // avant le premier geste le navigateur refuse (et le signale en console) : on s'abstient
      if (nav.userActivation && !nav.userActivation.hasBeenActive) return false;
      return !!nav.vibrate(pattern);
    } catch (e) { return false; }
  };
  MT.haptic.presets = PRESETS;
  MT.haptic.supported = (function () {
    try { return typeof window.navigator.vibrate === 'function'; } catch (e) { return false; }
  })();

  /* ---------- déblocage automatique + politesse en arrière-plan ---------- */

  try {
    var onGesture = function () {
      if (!ctx || ctx.state !== 'running') unlock();
    };
    var evs = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown', 'click'];
    for (var k = 0; k < evs.length; k++) {
      window.addEventListener(evs[k], onGesture, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', function () {
      try {
        if (!ctx) return;
        if (document.hidden) {
          if (ctx.state === 'running' && ctx.suspend) {
            var p = ctx.suspend();
            if (p && p.catch) p.catch(function () {});
          }
        } else {
          resume();
        }
      } catch (e) {}
    });
  } catch (e) {}
})();
