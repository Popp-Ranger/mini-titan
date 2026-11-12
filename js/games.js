/* Mini-Titan — mini-jeux tactiles.

   MT.games.css                    tout le CSS (classes mtg-), à injecter une fois
   MT.games.list                   [{ id, name, desc, icon, goal }]  (icon = identifiant MT.props, goal = score à atteindre pour gagner)
   MT.games.start(id, host, ctx)   -> Promise<{ win, score, quit? }>   (ne rejette jamais)
   MT.games.stop()                 interrompt la partie en cours : sa promesse se résout avec { win:false, score, quit:true }
   MT.games.running()              id de la partie en cours, ou null

   Les trois jeux : 'cote' (Gauche ou droite ?), 'festin' (Festin tombé du ciel), 'memo' (Rugi-mémo).

   host = élément vide et positionné, fourni par l'appli. Le jeu y ajoute UN élément (.mtg-root) et le retire à la fin.
   ctx  = { skin, stage, form, monster(opts), prop(id), sfx(nom), haptic(motif), uid() } — tout est facultatif :
          ce qui manque est remplacé (MT.art / MT.props / MT.scenes s'ils existent, sinon un dessin de secours ; sons et vibrations muets).
          Facultatifs en plus : ctx.scene({uid}) -> svg du décor, ctx.night (booléen).
          Les notes du Rugi-mémo appellent ctx.sfx('coin', { pitch }) : si l'appli transmet le 2e argument à MT.sfx.play,
          chaque plaque a sa note ; sinon elles sonnent toutes pareil (le jeu reste jouable).

   Horloge : une seule boucle requestAnimationFrame fait avancer TOUT le jeu (delta de temps borné à 100 ms).
   Aucun setTimeout / setInterval. Page cachée -> la boucle s'arrête, donc la partie est en pause, puis reprend.
   Fin de partie ou stop() : rAF annulé, écouteurs retirés (window et document compris), tâches vidées, DOM retiré.

   Pour les tests uniquement : MT.games._test = { advance(ms), state() } (fait avancer l'horloge à la main, lit l'état). */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};

  /* ------------------------------------------------------------------ outils */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length) % a.length]; }
  function px(n) { return (Math.round(n * 10) / 10) + 'px'; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  /* typographie française : espace insécable avant ? ! ; : (texte seul, jamais du HTML) */
  function fr(s) { return String(s).replace(/ ([?!;])/g, '\u202f$1').replace(/ :/g, '\u00a0:'); }
  function esc(s) { return fr(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function rgb(h) {
    h = String(h || '#888888').replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16) || 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function hex(a) {
    var s = '#', i, v;
    for (i = 0; i < 3; i++) { v = clamp(Math.round(a[i]), 0, 255); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  function mix(a, b, t) { a = rgb(a); b = rgb(b); return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  function rgba(c, a) { c = rgb(c); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lum(c) { c = rgb(c); return (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255; }
  function onColor(c) { return lum(c) > 0.6 ? '#1b1420' : '#ffffff'; }
  function toHsl(c) {
    c = rgb(c);
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d > 0.0001) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return hex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
  }
  function hueGap(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  /* petites icônes au trait (aucun emoji) */
  var ICO = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ko: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 9v4.2l2.6 1.6M9.5 3h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    slide: '<svg viewBox="0 0 48 24" aria-hidden="true"><path d="M11 6 5 12l6 6M37 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="12" r="4.5" fill="currentColor"/></svg>'
  };

  /* ------------------------------------------------------------------ contexte (tout est facultatif) */
  var DEFSKIN = {
    id: 'defaut',
    c: { body: '#3fae52', shade: '#237a38', light: '#7fe08a', belly: '#f6eea6', bellyShade: '#e0cf74', plate: '#38e8ff', plateGlow: '#b6fbff', out: '#0c2b17', cheek: '#ff9db0' },
    plate: 'tri',
    ui: { accent: '#22c55e', accent2: '#38e8ff', bgTop: '#12432f', bgBot: '#061f16', ink: '#eafff0' }
  };
  var SEQ = 0;

  function fallbackMonster(skin) {
    var c = skin.c;
    return '<svg class="mt-mon" viewBox="0 0 400 400" role="img" aria-label="Mini-Titan"><ellipse class="mt-shadow" cx="200" cy="358" rx="84" ry="12" fill="rgba(0,0,0,.22)"/>' +
      '<g class="mt-all"><path d="M150 215 124 180 168 196 190 150 214 196 262 176 246 222Z" fill="' + c.plate + '"/>' +
      '<g class="mt-head"><ellipse cx="200" cy="278" rx="92" ry="82" fill="' + c.body + '"/><ellipse cx="206" cy="312" rx="56" ry="40" fill="' + c.belly + '"/>' +
      '<circle cx="172" cy="262" r="12" fill="' + c.out + '"/><circle cx="234" cy="262" r="12" fill="' + c.out + '"/><circle cx="176" cy="258" r="4" fill="#fff"/><circle cx="238" cy="258" r="4" fill="#fff"/>' +
      '<path class="mt-mouth" d="M186 296q17 14 34 0" fill="none" stroke="' + c.out + '" stroke-width="6" stroke-linecap="round"/></g></g></svg>';
  }
  function fallbackProp(id, skin) {
    var bad = id === 'crotte', col = bad ? '#8a5a2b' : (id === 'etoile' ? '#ffd23f' : skin.ui.accent2);
    return '<svg class="mt-prop" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="54" r="36" fill="' + col + '"/><ellipse cx="38" cy="40" rx="12" ry="8" fill="rgba(255,255,255,.45)"/></svg>';
  }

  function normCtx(raw) {
    raw = raw || {};
    var skin = raw.skin && raw.skin.c ? raw.skin : ((MT.SKINS && MT.SKINS[0]) || DEFSKIN), k;
    var sk = { id: skin.id, plate: skin.plate || 'tri', c: {}, ui: {} };
    for (k in DEFSKIN.c) sk.c[k] = (skin.c && skin.c[k]) || DEFSKIN.c[k];
    for (k in DEFSKIN.ui) sk.ui[k] = (skin.ui && skin.ui[k]) || DEFSKIN.ui[k];
    var stage = Math.round(+raw.stage);
    if (!(stage >= 0 && stage <= 4)) stage = 2;
    var form = raw.form === 'grognon' ? 'grognon' : (raw.form === 'titan' ? 'titan' : '');
    var pre = 'mtg' + (++SEQ) + 'x', n = 0;
    function uid() {
      var base = '';
      try { if (typeof raw.uid === 'function') base = String(raw.uid() || ''); } catch (e) { base = ''; }
      return (base + pre + (n++)).replace(/[^\w-]/g, '_');
    }
    function str(v) { return typeof v === 'string' && v.indexOf('<svg') >= 0 ? v : ''; }
    return {
      skin: sk, stage: stage, form: form, night: raw.night === true, uid: uid,
      monster: function (o) {
        o = o || {};
        var s = '', u = o.uid || uid();
        try { if (typeof raw.monster === 'function') s = str(raw.monster({ mood: o.mood, uid: u })); } catch (e) { s = ''; }
        if (!s) { try { if (MT.art && MT.art.monster) s = str(MT.art.monster(skin, { stage: stage, form: form, mood: o.mood, uid: u })); } catch (e2) { s = ''; } }
        return s || fallbackMonster(sk);
      },
      prop: function (id) {
        var s = '', u = uid();
        try { if (typeof raw.prop === 'function') s = str(raw.prop(id, u)); } catch (e) { s = ''; }
        if (!s) { try { if (MT.props && MT.props.svg) s = str(MT.props.svg(id, u)); } catch (e2) { s = ''; } }
        return s || fallbackProp(id, sk);
      },
      scene: function () {
        var s = '', u = uid();
        try { if (typeof raw.scene === 'function') s = str(raw.scene({ uid: u, night: raw.night === true })); } catch (e) { s = ''; }
        if (!s) { try { if (MT.scenes && MT.scenes.render) s = str(MT.scenes.render(skin, { night: raw.night === true, uid: u })); } catch (e2) { s = ''; } }
        return s;
      },
      sfx: function (name, opts) { try { if (typeof raw.sfx === 'function') raw.sfx(name, opts); } catch (e) {} },
      haptic: function (p) { try { if (typeof raw.haptic === 'function') raw.haptic(p); } catch (e) {} }
    };
  }

  /* ------------------------------------------------------------------ moteur : une partie à la fois */
  var cur = null;

  function Game(id, host, ctx, resolve) {
    this.id = id; this.host = host; this.ctx = ctx; this.resolve = resolve;
    this.t = 0; this.tasks = []; this.listeners = []; this.raf = 0; this.last = 0; this.over = false;
    this.score = 0; this.update = null; this.layout = null; this.szT = 0; this.W = 0; this.H = 0;
    this.phase = 'intro'; this.info = null;
  }
  Game.prototype.after = function (ms, fn) {
    var tk = { at: this.t + ms, fn: fn };
    this.tasks.push(tk);
    return tk;
  };
  Game.prototype.cancel = function (tk) {
    var i = tk ? this.tasks.indexOf(tk) : -1;
    if (i >= 0) this.tasks.splice(i, 1);
  };
  Game.prototype.on = function (target, type, fn, opts) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, fn, opts || false);
    this.listeners.push([target, type, fn, opts || false]);
  };
  Game.prototype.measure = function () {
    var w = this.host.clientWidth || 0, h = this.host.clientHeight || 0;
    if (w < 40) w = 360;
    if (h < 40) h = 560;
    if (w === this.W && h === this.H) return false;
    this.W = w; this.H = h;
    this.root.style.setProperty('--mtg-w', w + 'px');
    this.root.style.setProperty('--mtg-h', h + 'px');
    this.root.classList.toggle('mtg-short', h < 470);
    this.root.classList.toggle('mtg-narrow', w < 356);
    return true;
  };
  Game.prototype.advance = function (dt) {
    var i, tk, due;
    this.t += dt;
    for (;;) {
      due = null;
      for (i = 0; i < this.tasks.length; i++) { tk = this.tasks[i]; if (tk.at <= this.t && (!due || tk.at < due.at)) due = tk; }
      if (!due) break;
      this.tasks.splice(this.tasks.indexOf(due), 1);
      due.fn();
      if (this.over) return;
    }
    this.szT += dt;
    if (this.szT >= 350) { this.szT = 0; if (this.measure() && this.layout) this.layout(); }
    if (this.update) this.update(dt);
  };
  Game.prototype.loop = function () {
    var g = this;
    if (g.over || g.raf) return;
    g.raf = requestAnimationFrame(function frame(now) {
      g.raf = 0;
      if (g.over) return;
      if (!g.root.parentNode || (g.root.isConnected === false)) { finish(g, { win: false, quit: true }); return; }   // l'appli a retiré l'hôte sans prévenir
      var dt = g.last ? now - g.last : 16;
      g.last = now;
      if (dt < 0) dt = 0;
      if (dt > 100) dt = 100;
      try { g.advance(dt); } catch (e) { fail(g, e); return; }
      if (!g.over && !document.hidden) g.raf = requestAnimationFrame(frame);
    });
  };
  Game.prototype.setScore = function (n) {
    this.score = n;
    if (this.hud) this.hud.score(n);
  };

  function fail(g, e) {
    try { if (window.console && console.error) console.error('MT.games : partie interrompue', e); } catch (e2) {}
    finish(g, { win: false, quit: true });
  }

  function finish(g, res) {
    if (!g || g.over) return;
    g.over = true;
    if (g.raf) { try { cancelAnimationFrame(g.raf); } catch (e) {} g.raf = 0; }
    var i, l;
    for (i = 0; i < g.listeners.length; i++) { l = g.listeners[i]; try { l[0].removeEventListener(l[1], l[2], l[3]); } catch (e2) {} }
    g.listeners = []; g.tasks = []; g.update = null; g.layout = null; g.info = null;
    if (cur === g) cur = null;
    try { if (g.root && g.root.parentNode) g.root.parentNode.removeChild(g.root); } catch (e3) {}
    var out = { win: !!res.win, score: Math.max(0, Math.round(g.score) || 0) };
    if (res.quit) { out.win = false; out.quit = true; }
    g.root = null; g.host = null;
    var r = g.resolve; g.resolve = null;
    if (r) r(out);
  }

  function stop() { if (cur) finish(cur, { win: false, quit: true }); }

  function start(id, host, rawCtx) {
    stop();
    var def = GAMES[id];
    if (!def || !host || !host.appendChild || typeof Promise === 'undefined') {
      var quit = { win: false, score: 0, quit: true };
      return typeof Promise === 'undefined' ? { then: function (f) { if (f) f(quit); return this; } } : Promise.resolve(quit);
    }
    return new Promise(function (resolve) {
      var g = new Game(id, host, normCtx(rawCtx), resolve);
      cur = g;
      try {
        buildShell(g, def);
        def.run(g);
        if (g.over) return;
        g.on(document, 'visibilitychange', function () {
          if (document.hidden) { if (g.raf) { cancelAnimationFrame(g.raf); g.raf = 0; } }
          else { g.last = 0; g.loop(); }
        });
        g.on(window, 'resize', function () { g.szT = 999; });
        g.loop();
      } catch (e) { fail(g, e); }
    });
  }

  /* ------------------------------------------------------------------ habillage commun */
  function buildShell(g, def) {
    var ui = g.ctx.skin.ui, c = g.ctx.skin.c, lightInk = lum(ui.ink) > 0.55;
    var root = el('div', 'mtg-root mtg-g-' + g.id + (lightInk ? ' mtg-dark' : ' mtg-clear'));
    var st = root.style;
    st.setProperty('--mtg-ink', ui.ink);
    st.setProperty('--mtg-bg1', ui.bgTop);
    st.setProperty('--mtg-bg2', ui.bgBot);
    st.setProperty('--mtg-accent', ui.accent);
    st.setProperty('--mtg-accent-d', mix(ui.accent, '#000000', 0.3));
    st.setProperty('--mtg-accent-l', mix(ui.accent, '#ffffff', 0.28));
    st.setProperty('--mtg-on-accent', onColor(ui.accent));
    st.setProperty('--mtg-accent2', ui.accent2);
    st.setProperty('--mtg-accent2-d', mix(ui.accent2, '#000000', 0.3));
    st.setProperty('--mtg-accent2-l', mix(ui.accent2, '#ffffff', 0.28));
    st.setProperty('--mtg-on-accent2', onColor(ui.accent2));
    st.setProperty('--mtg-panel', lightInk ? rgba(mix(ui.bgBot, '#000000', 0.45), 0.62) : 'rgba(255,255,255,.82)');
    st.setProperty('--mtg-line', lightInk ? 'rgba(255,255,255,.16)' : 'rgba(20,10,30,.12)');
    st.setProperty('--mtg-veil', rgba(mix(ui.bgBot, lightInk ? '#000000' : '#ffffff', 0.35), 0.8));
    st.setProperty('--mtg-body', c.body);
    st.setProperty('--mtg-plate', typeof c.plate === 'string' ? c.plate : c.plate[0]);
    root.setAttribute('data-game', g.id);

    var hud = el('div', 'mtg-hud');
    var chip = el('div', 'mtg-chip mtg-score',
      '<span class="mtg-chip-ic">' + g.ctx.prop('etoile') + '</span><b>0</b><i>objectif ' + def.goal + '</i>');
    var side = el('div', 'mtg-side');
    hud.appendChild(chip); hud.appendChild(side);
    var stage = el('div', 'mtg-stage');
    var world = el('div', 'mtg-world');
    stage.appendChild(world);
    var say = el('div', 'mtg-say');
    say.setAttribute('aria-live', 'polite');
    stage.appendChild(say);
    var pad = el('div', 'mtg-pad');
    root.appendChild(hud); root.appendChild(stage); root.appendChild(pad);
    g.host.appendChild(root);

    g.root = root; g.stage = stage; g.world = world; g.pad = pad; g.side = side; g.sayEl = say;
    var num = chip.querySelector('b'), reached = false;
    g.hud = {
      score: function (n) {
        num.textContent = String(n);
        var r = n >= def.goal;
        if (r !== reached) { reached = r; chip.classList.toggle('mtg-reached', r); }
        pulse(chip, 1.14, 260);
      }
    };
    g.goal = def.goal;
    /* filet de sécurité : si l'appli n'a pas injecté MT.games.css, on le fait ici (une seule fois) */
    try {
      if (!document.getElementById('mtg-css') && window.getComputedStyle && getComputedStyle(root).position !== 'absolute') {
        var tag = el('style');
        tag.id = 'mtg-css';
        tag.textContent = css;
        (document.head || document.documentElement).appendChild(tag);
      }
    } catch (e) {}
    g.measure();
  }

  function pulse(e, scale, ms) {
    try { if (e.animate) e.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + scale + ')' }, { transform: 'scale(1)' }], { duration: ms, easing: 'ease-out' }); } catch (err) {}
  }

  /* bulle de texte en haut de la scène ; tone = '' | 'good' | 'bad' ; ms = durée (0 = reste) */
  function say(g, text, tone, ms) {
    var s = g.sayEl;
    if (g.sayTk) { g.cancel(g.sayTk); g.sayTk = null; }
    if (!text) { s.classList.remove('mtg-in'); return; }
    s.textContent = fr(text);
    s.className = 'mtg-say mtg-in' + (tone ? ' mtg-' + tone : '');
    pulse(s, 1.08, 240);
    if (ms) g.sayTk = g.after(ms, function () { g.sayTk = null; s.classList.remove('mtg-in'); });
  }

  /* consigne + compte à rebours 3-2-1, puis go() */
  function intro(g, def, go) {
    var ov = el('div', 'mtg-intro',
      '<div class="mtg-card"><div class="mtg-card-ic">' + g.ctx.prop(def.icon) + '</div>' +
      '<p class="mtg-consigne">' + esc(def.rule) + '</p>' +
      '<p class="mtg-but">' + esc(def.aim) + '</p>' +
      '<div class="mtg-count"><span class="mtg-ready">Prêt ?</span></div></div>');
    g.root.appendChild(ov);
    var box = ov.querySelector('.mtg-count');
    function show(n, pitch) {
      return function () {
        box.innerHTML = '<span class="mtg-num">' + n + '</span>';
        g.ctx.sfx('tap', { pitch: pitch, volume: 1.4 });
        g.ctx.haptic('tap');
      };
    }
    g.after(850, show(3, 0.8));
    g.after(1600, show(2, 0.9));
    g.after(2350, show(1, 1));
    g.after(3100, function () {
      ov.classList.add('mtg-out');
      g.ctx.sfx('pop');
      g.after(260, function () { if (ov.parentNode) ov.parentNode.removeChild(ov); });
      g.phase = 'play';
      go();
    });
  }

  /* décor : le sol (y = 470 sur 600) est posé à gfb pixels du bas de la scène, le reste déborde */
  function addScene(g) {
    var html = g.ctx.scene();
    if (!html) { g.stage.classList.add('mtg-noscene'); return null; }
    var d = el('div', 'mtg-scene', html);
    g.world.appendChild(d);
    return d;
  }
  function layoutScene(d, W, H, gfb) {
    if (!d) return;
    var s = Math.max(W / 400, (H - gfb) / 470, gfb / 130) * 1.001;
    d.style.width = px(400 * s); d.style.height = px(600 * s);
    d.style.left = px((W - 400 * s) / 2); d.style.top = px(H - gfb - 470 * s);
  }

  /* le monstre du joueur : boîte carrée (viewBox 400, sol à y = 360), retournable, avec ses actions */
  var BB_ALL = [[140, 224, 120, 139], [133, 223, 137, 144], [101, 172, 193, 193], [68, 114, 245, 246], [40, 53, 303, 309]];
  var BB_HEAD = [[145, 226, 115, 134], [157, 223, 112, 110], [140, 172, 153, 119], [133, 114, 179, 135], [108, 53, 234, 170]];
  var GROW = [0.66, 0.7, 0.82, 0.92, 1];

  function Monster(g, parent, mood) {
    var box = el('div', 'mtg-mon'), flip = el('div', 'mtg-flip'), act = el('div', 'mtg-act');
    flip.appendChild(act); box.appendChild(flip); parent.appendChild(box);
    var st = g.ctx.stage, actTk = null, actAt = -9999, curAct = '';
    var m = {
      box: box, flip: flip, act: act, dir: 1, mood: '', B: 200, k: 0.5, x: 0, gy: 0,
      all: BB_ALL[st], head: BB_HEAD[st],
      set: function (md) {
        if (md === m.mood) return;
        m.mood = md;
        act.innerHTML = g.ctx.monster({ mood: md });
      },
      face: function (d) {
        d = d < 0 ? -1 : 1;
        if (d === m.dir) return;
        m.dir = d;
        flip.style.transform = d < 0 ? 'scaleX(-1)' : 'scaleX(1)';
      },
      /* joue une action d'art.js (jump, chomp, no, wiggle, hop) ; minGap = ne relance pas si la précédente est plus récente */
      play: function (name, minGap) {
        if (st === 0 && name !== 'jump') name = 'wiggle';
        var cls = 'mt-act-' + name;
        if (minGap && g.t - actAt < minGap && curAct === cls) return;
        actAt = g.t;
        if (actTk) g.cancel(actTk);
        if (curAct) act.classList.remove(curAct);
        void act.offsetWidth;                       // relance l'animation CSS
        curAct = cls;
        act.classList.add(cls);
        actTk = g.after(1250, function () { actTk = null; act.classList.remove(curAct); curAct = ''; });
      },
      /* visH = hauteur visible voulue pour un adulte (les plus jeunes sont plus petits), maxW = largeur visible maxi */
      fit: function (visH, maxW) {
        var a = m.all, B = visH * GROW[st] * 400 / a[3];
        if (maxW && a[2] * B / 400 > maxW) B = maxW * 400 / a[2];
        m.B = B; m.k = B / 400;
        box.style.width = box.style.height = px(B);
      },
      at: function (x, gy) {
        m.x = x; m.gy = gy;
        box.style.transform = 'translate3d(' + px(x - m.B / 2) + ',' + px(gy - m.B * 0.9) + ',0)';
      },
      headDx: function () { return (m.head[0] + m.head[2] / 2 - 200) * m.k; },      // centre de la tête par rapport au centre de la boîte (tourné vers la droite)
      headTop: function () { return m.gy - (360 - m.head[1]) * m.k; }
    };
    m.set(mood || 'neutral');
    /* mesure réelle du dessin (les tailles varient selon le stade) */
    try {
      var svg = act.querySelector('svg'), a = svg && svg.querySelector('.mt-all'), h = svg && (svg.querySelector('.mt-head') || svg.querySelector('.mt-egg')), b;
      if (a && a.getBBox) { b = a.getBBox(); if (b.width > 30 && b.height > 30) m.all = [b.x, b.y, b.width, b.height]; }
      if (h && h.getBBox) { b = h.getBBox(); if (b.width > 20 && b.height > 20) m.head = [b.x, b.y, b.width, b.height]; }
    } catch (e) {}
    return m;
  }

  /* ------------------------------------------------------------------ 1. Gauche ou droite ? */
  function runCote(g) {
    var ROUNDS = 5, CHOICE_MS = 5000;
    var def = GAMES.cote, c = g.ctx;
    var scene = addScene(g);
    var arrow = el('div', 'mtg-arrow');
    g.world.appendChild(arrow);
    var mon = Monster(g, g.world, 'neutral');
    var think = el('div', 'mtg-think', '<span>?</span>');
    g.world.appendChild(think);

    var pips = [], i, p;
    var row = el('div', 'mtg-pips');
    row.setAttribute('aria-label', 'Manches');
    for (i = 0; i < ROUNDS; i++) { p = el('span', 'mtg-pip'); row.appendChild(p); pips.push(p); }
    g.side.appendChild(row);

    var bar = el('div', 'mtg-wait', '<i></i>');
    g.pad.appendChild(bar);
    var barFill = bar.firstChild;
    var btns = el('div', 'mtg-btns');
    var bL = el('button', 'mtg-btn mtg-btn-l', '<span class="mtg-btn-ic">' + ICO.left + '</span><span>Gauche</span>');
    var bR = el('button', 'mtg-btn mtg-btn-r', '<span>Droite</span><span class="mtg-btn-ic">' + ICO.right + '</span>');
    bL.type = 'button'; bR.type = 'button';
    btns.appendChild(bL); btns.appendChild(bR);
    g.pad.appendChild(btns);

    var round = -1, hits = 0, answer = 1, wait = 0, flipT = 0, canPick = false;
    g.phase = 'intro';

    function enable(on) {
      canPick = on;
      bL.disabled = bR.disabled = !on;
      btns.classList.toggle('mtg-off', !on);
    }
    function layout() {
      var W = g.stage.clientWidth || g.W, H = g.stage.clientHeight || 240;
      var gfb = Math.max(30, H * 0.17);
      layoutScene(scene, W, H, gfb);
      mon.fit(clamp((H - gfb - 64) * 0.92, 70, 250), W * 0.66);
      mon.at(W / 2, H - gfb);
      var top = mon.gy - (360 - mon.all[1]) * mon.k;
      think.style.transform = 'translate3d(' + px(W / 2 + mon.all[2] * mon.k * 0.36) + ',' + px(Math.max(46, top - 6)) + ',0)';
      arrow.style.top = px(clamp(top + mon.all[3] * mon.k * 0.42, 60, H - gfb - 30));
    }
    g.layout = layout;
    layout();
    enable(false);

    function nextRound() {
      round++;
      if (round >= ROUNDS) return end();
      answer = Math.random() < 0.5 ? -1 : 1;
      g.phase = 'hesite';
      pips[round].className = 'mtg-pip mtg-now';
      arrow.className = 'mtg-arrow';
      bL.classList.remove('mtg-picked', 'mtg-right', 'mtg-wrong');
      bR.classList.remove('mtg-picked', 'mtg-right', 'mtg-wrong');
      mon.set('neutral');
      think.classList.add('mtg-in');
      say(g, 'Manche ' + (round + 1) + ' sur ' + ROUNDS, '', 0);
      flipT = 0;
      barFill.style.transform = 'scaleX(1)';
      bar.classList.remove('mtg-in');
      g.after(650, function () {
        g.phase = 'choix';
        wait = CHOICE_MS;
        say(g, 'À gauche ou à droite ?', '', 0);
        bar.classList.add('mtg-in');
        enable(true);
      });
    }

    function choose(side) {
      if (!canPick || g.phase !== 'choix') return;
      enable(false);
      g.phase = 'suspense';
      c.sfx('tap'); c.haptic('tap');
      (side < 0 ? bL : bR).classList.add('mtg-picked');
      bar.classList.remove('mtg-in');
      g.after(520, function () { reveal(side); });
    }

    function reveal(side) {
      g.phase = 'reponse';
      think.classList.remove('mtg-in');
      var ok = side === answer;
      mon.face(answer);
      arrow.innerHTML = answer < 0 ? ICO.left : ICO.right;
      arrow.className = 'mtg-arrow mtg-in ' + (answer < 0 ? 'mtg-to-l' : 'mtg-to-r');
      (answer < 0 ? bL : bR).classList.add('mtg-right');
      if (side && !ok) (side < 0 ? bL : bR).classList.add('mtg-wrong');
      if (ok) {
        hits++;
        g.setScore(hits);
        mon.set('happy'); mon.play('jump');
        c.sfx('ok'); c.haptic('ok');
        say(g, pick(['Bien vu !', 'Bravo !', 'Dans le mille !']), 'good', 0);
        pips[round].className = 'mtg-pip mtg-ok';
        pips[round].innerHTML = ICO.ok;
      } else {
        mon.set('sad'); mon.play('no');
        c.sfx('no'); c.haptic('no');
        say(g, side ? (answer < 0 ? 'Raté, c\'était à gauche.' : 'Raté, c\'était à droite.') : 'Trop tard !', 'bad', 0);
        pips[round].className = 'mtg-pip mtg-ko';
        pips[round].innerHTML = ICO.ko;
      }
      g.after(1450, nextRound);
    }

    function end() {
      g.phase = 'fin';
      var win = hits >= def.goal;
      arrow.className = 'mtg-arrow';
      think.classList.remove('mtg-in');
      bL.classList.remove('mtg-picked', 'mtg-right', 'mtg-wrong');
      bR.classList.remove('mtg-picked', 'mtg-right', 'mtg-wrong');
      pips[ROUNDS - 1].classList.remove('mtg-now');
      mon.face(1);
      mon.set(win ? 'love' : 'sad');
      if (win) mon.play('hop');
      say(g, hits + ' sur ' + ROUNDS + (win ? ' : gagné !' : ' : perdu…'), win ? 'good' : 'bad', 0);
      g.after(1200, function () { finish(g, { win: win }); });
    }

    g.update = function (dt) {
      if (g.phase === 'hesite' || g.phase === 'choix' || g.phase === 'suspense') {
        flipT -= dt;
        if (flipT <= 0) { mon.face(-mon.dir); flipT = g.phase === 'suspense' ? 120 : (g.phase === 'hesite' ? 210 : 360); }
      }
      if (g.phase === 'choix') {
        wait -= dt;
        barFill.style.transform = 'scaleX(' + clamp(wait / CHOICE_MS, 0, 1).toFixed(3) + ')';
        if (wait <= 0) { enable(false); bar.classList.remove('mtg-in'); reveal(0); }
      }
    };
    g.info = function () { return { round: round, hits: hits, answer: answer, canPick: canPick }; };

    g.on(bL, 'click', function () { choose(-1); });
    g.on(bR, 'click', function () { choose(1); });
    g.on(window, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') choose(-1); else if (e.key === 'ArrowRight') choose(1); else return;
      e.preventDefault();
    });

    intro(g, def, nextRound);
  }

  /* ------------------------------------------------------------------ 2. Festin tombé du ciel */
  var FOODS = ['steak', 'poisson', 'ramen', 'pomme', 'glace', 'donut', 'sucette'];

  function runFestin(g) {
    var DUR = 30000;
    var def = GAMES.festin, c = g.ctx;
    var scene = addScene(g);
    g.root.classList.add('mtg-full');

    /* minuteur */
    var timer = el('div', 'mtg-timer', '<span class="mtg-timer-ic">' + ICO.clock + '</span><span class="mtg-bar"><i></i></span><b>30 s</b>');
    g.side.appendChild(timer);
    var tFill = timer.querySelector('i'), tNum = timer.querySelector('b'), shownSec = 30;

    var shadows = el('div', 'mtg-shadows');
    g.world.appendChild(shadows);
    var mon = Monster(g, g.world, 'happy');
    var yuck = el('div', 'mtg-yuck', c.monster({ mood: 'sick' }));      // seconde tête « beurk », montrée après une crotte
    mon.act.appendChild(yuck);
    var layer = el('div', 'mtg-items');
    g.world.appendChild(layer);
    var flash = el('div', 'mtg-flash');
    g.stage.appendChild(flash);
    var track = el('div', 'mtg-track', '<div class="mtg-knob">' + ICO.slide + '</div><span class="mtg-hint">Glisse ici</span>');
    g.stage.appendChild(track);
    var knob = track.firstChild;

    var sw = 360, sh = 480, gy = 400, size = 52, rect = null, edge = 30;
    var tx = 180, hx = 180, faceRef = 180, keyDir = 0, moved = false, drag = false;
    var elapsed = 0, nextSpawn = 350, spawned = 0, poopRun = 0, lastX = -1, running = false, yuckUntil = 0, lastEat = -9999;
    var items = [], pool = {}, fxPool = [], fxN = 0;

    function layout() {
      sw = g.stage.clientWidth || g.W; sh = g.stage.clientHeight || 400;
      var gfb = clamp(sh * 0.17, 72, 96);
      gy = sh - gfb;
      size = clamp(sw * 0.14, 44, 60);
      layoutScene(scene, sw, sh, gfb);
      mon.fit(clamp(sh * 0.27, 90, 156), sw * 0.46);
      edge = Math.max(30, mon.head[2] * mon.k * 0.5 + 4);
      track.style.height = px(Math.min(56, gfb - 16));
      rect = null;
      tx = clamp(tx, edge, sw - edge);
      place();
    }
    function place() {
      mon.at(hx - mon.dir * mon.headDx(), gy);
      knob.style.transform = 'translate3d(' + px(tx - 32) + ',0,0)';
    }
    g.layout = layout;
    hx = tx = faceRef = (g.stage.clientWidth || g.W) / 2;
    layout();

    function getItem(kind) {
      var list = pool[kind] || (pool[kind] = []), it = list.pop();
      if (!it) {
        it = { kind: kind, poop: kind === 'crotte', el: el('div', 'mtg-item' + (kind === 'crotte' ? ' mtg-bad' : ''), c.prop(kind)), sh: el('div', 'mtg-ish') };
        layer.appendChild(it.el); shadows.appendChild(it.sh);
      }
      it.el.style.width = it.el.style.height = px(size);
      it.sh.style.width = px(size * 0.9);
      it.el.style.opacity = '1';
      it.fade = 0; it.state = 'fall';
      return it;
    }
    function freeItem(it) {
      it.el.style.opacity = '0'; it.sh.style.opacity = '0';
      it.el.style.transform = 'translate3d(-200px,-200px,0)';
      (pool[it.kind] || (pool[it.kind] = [])).push(it);
    }
    function spawn(p) {
      var poop = false;
      if (spawned >= 2 && poopRun < 2 && Math.random() < lerp(0.2, 0.34, p)) poop = true;
      poopRun = poop ? poopRun + 1 : 0;
      var it = getItem(poop ? 'crotte' : pick(FOODS));
      var lo = size * 0.62, hi = sw - size * 0.62, x = rnd(lo, hi), span = sw * 0.62;
      if (lastX >= 0) x = clamp(x, lastX - span, lastX + span);
      it.x = lastX = clamp(x, lo, hi);
      it.y = -size * 0.6;
      it.vy = sh / lerp(3.0, 1.55, p) * rnd(0.92, 1.1);
      it.rot = rnd(-18, 18); it.vr = rnd(-70, 70);
      items.push(it);
      spawned++;
    }
    function fx(text, x, y, bad) {
      var f = fxPool[fxN % 6];
      if (!f) { f = fxPool[fxN % 6] = el('div', 'mtg-fx'); layer.appendChild(f); }
      fxN++;
      f.textContent = text;
      f.className = 'mtg-fx' + (bad ? ' mtg-fx-bad' : '');
      f.style.left = px(clamp(x, 26, sw - 26)); f.style.top = px(y);
      try {
        if (f.animate) f.animate([{ opacity: 0, transform: 'translate(-50%,0) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-18px) scale(1.15)', offset: 0.25 },
          { opacity: 1, transform: 'translate(-50%,-34px) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-52px) scale(1)' }], { duration: 760, easing: 'ease-out' });
      } catch (e) {}
    }
    function caught(it) {
      var hy = mon.headTop() + 4;
      if (it.poop) {
        g.setScore(Math.max(0, g.score - 2));
        fx('−2', hx, hy, true);
        c.sfx('no'); c.haptic('no');
        yuckUntil = g.t + 900;
        mon.act.classList.add('mtg-beurk');
        try {
          if (g.world.animate) g.world.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-6px)' },
            { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'ease-out' });
          if (flash.animate) flash.animate([{ opacity: 0 }, { opacity: 0.5 }, { opacity: 0 }], { duration: 420 });
        } catch (e) {}
      } else {
        g.setScore(g.score + 1);
        fx('+1', hx, hy, false);
        if (g.t - lastEat > 520) { c.sfx('eat'); lastEat = g.t; } else c.sfx('pop', { pitch: 1.15 });
        c.haptic('tap');
        mon.play('chomp', 420);
      }
      it.state = 'gone'; it.fade = 120;
      it.el.style.opacity = '0'; it.sh.style.opacity = '0';
    }

    g.update = function (dt) {
      var i, it, p, s, k = mon.k, hw, top, hh;
      /* le monstre suit le doigt (même pendant la consigne : on peut s'échauffer) */
      if (keyDir) { tx = clamp(tx + keyDir * 620 * dt / 1000, edge, sw - edge); moved = true; }
      hx += (tx - hx) * (1 - Math.exp(-dt / 42));
      if (tx - faceRef > 14) { mon.face(1); faceRef = tx; }
      else if (tx - faceRef < -14) { mon.face(-1); faceRef = tx; }
      else if (mon.dir > 0 ? tx > faceRef : tx < faceRef) faceRef = tx;
      place();
      if (yuckUntil && g.t >= yuckUntil) { yuckUntil = 0; mon.act.classList.remove('mtg-beurk'); }
      if (!running) return;

      elapsed += dt;
      p = clamp(elapsed / DUR, 0, 1);
      tFill.style.transform = 'scaleX(' + (1 - p).toFixed(4) + ')';
      s = Math.ceil((DUR - elapsed) / 1000);
      if (s < 0) s = 0;
      if (s !== shownSec) {
        shownSec = s; tNum.textContent = s + ' s';
        if (s <= 5 && s > 0) { timer.classList.add('mtg-hurry'); c.sfx('tap', { pitch: 1.3 }); }
      }
      nextSpawn -= dt;
      while (nextSpawn <= 0 && elapsed < DUR - 900) { spawn(p); nextSpawn += lerp(840, 410, p) * rnd(0.86, 1.14); }

      hw = mon.head[2] * k * 0.33 + size * 0.16; top = mon.headTop(); hh = mon.head[3] * k;
      for (i = items.length - 1; i >= 0; i--) {
        it = items[i];
        if (it.state === 'fall') {
          it.y += it.vy * dt / 1000; it.rot += it.vr * dt / 1000;
          if (Math.abs(it.x - hx) < hw && it.y + size * 0.3 >= top + hh * 0.12 && it.y <= top + hh * 0.72) caught(it);
          else if (it.y >= gy - size * 0.28) { it.state = 'land'; it.fade = 300; it.y = gy - size * 0.28; }
        } else {
          it.fade -= dt;
          if (it.fade <= 0) { items.splice(i, 1); freeItem(it); continue; }
          if (it.state === 'land') it.el.style.opacity = String(clamp(it.fade / 300, 0, 1));
        }
        if (it.state !== 'gone') {
          it.el.style.transform = 'translate3d(' + px(it.x - size / 2) + ',' + px(it.y - size / 2) + ',0) rotate(' + it.rot.toFixed(1) + 'deg)';
          s = clamp(it.y / Math.max(1, gy), 0, 1);
          it.sh.style.transform = 'translate3d(' + px(it.x - size * 0.45) + ',' + px(gy - 5) + ',0) scale(' + (0.45 + s * 0.6).toFixed(2) + ')';
          it.sh.style.opacity = it.state === 'land' ? String(clamp(it.fade / 300, 0, 1) * 0.5) : (0.12 + s * 0.4).toFixed(2);
        }
      }
      if (elapsed >= DUR) end();
    };

    function end() {
      running = false;
      g.phase = 'fin';
      var win = g.score >= def.goal, i;
      for (i = 0; i < items.length; i++) { items[i].el.style.opacity = '0'; items[i].sh.style.opacity = '0'; }
      items = [];
      tNum.textContent = '0 s';
      mon.act.classList.remove('mtg-beurk');
      mon.set(win ? 'love' : 'sad');
      mon.play(win ? 'jump' : 'no');
      say(g, win ? 'Quel festin !' : 'Terminé !', win ? 'good' : '', 0);
      g.after(1150, function () { finish(g, { win: win }); });
    }

    function toX(e) {
      if (!rect) rect = g.stage.getBoundingClientRect();
      var sc = rect.width > 0 ? sw / rect.width : 1;
      return clamp((e.clientX - rect.left) * sc, edge, sw - edge);
    }
    function grab(e) {
      tx = toX(e);
      if (!moved) { moved = true; track.classList.add('mtg-used'); }
    }
    g.on(g.root, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button > 0) return;
      rect = null; drag = true;
      try { if (g.root.setPointerCapture) g.root.setPointerCapture(e.pointerId); } catch (err) {}
      grab(e);
      if (e.cancelable) e.preventDefault();
    });
    g.on(g.root, 'pointermove', function (e) {
      if (drag || e.pointerType === 'mouse') grab(e);
    });
    function drop() { drag = false; }
    g.on(g.root, 'pointerup', drop);
    g.on(g.root, 'pointercancel', drop);
    g.on(g.root, 'contextmenu', function (e) { e.preventDefault(); });
    g.on(window, 'scroll', function () { rect = null; }, true);
    g.on(window, 'keydown', function (e) {
      if (e.key === 'ArrowLeft') keyDir = -1; else if (e.key === 'ArrowRight') keyDir = 1; else return;
      e.preventDefault();
      if (!moved) { moved = true; track.classList.add('mtg-used'); }
    });
    g.on(window, 'keyup', function (e) {
      if ((e.key === 'ArrowLeft' && keyDir < 0) || (e.key === 'ArrowRight' && keyDir > 0)) keyDir = 0;
    });
    g.on(window, 'blur', function () { keyDir = 0; drag = false; });

    g.info = function () {
      var a = [], i;
      for (i = 0; i < items.length; i++) if (items[i].state === 'fall') a.push({ x: items[i].x, y: items[i].y, poop: items[i].poop });
      return { elapsed: elapsed, running: running, sw: sw, sh: sh, gy: gy, hx: hx, tx: tx, items: a, pooled: layer.children.length };
    };

    intro(g, def, function () {
      running = true;
      say(g, 'C\'est parti !', '', 900);
    });
  }

  /* ------------------------------------------------------------------ 3. Rugi-mémo */
  var PLATE_PATH = {
    tri: 'M50 9c5 0 9 3 12 9l28 52c6 11 0 21-12 21H22c-12 0-18-10-12-21l28-52c3-6 7-9 12-9z',
    round: 'M50 10c26 0 44 22 44 50 0 20-9 31-24 31H30C15 91 6 80 6 60 6 32 24 10 50 10z',
    crystal: 'M50 7c3 0 5 1 7 4l28 34c3 4 4 7 3 11L78 85c-1 4-4 6-9 6H31c-5 0-8-2-9-6L12 56c-1-4 0-7 3-11L43 11c2-3 4-4 7-4z',
    fin: 'M26 91C11 91 4 80 10 65 21 37 43 16 77 9c10-2 15 4 12 13-6 18-4 36 3 53 4 9-2 16-13 16z'
  };
  var PLATE_FACET = {
    tri: 'M50 9c5 0 9 3 12 9l28 52c6 11 0 21-12 21H56z',
    round: 'M50 10c26 0 44 22 44 50 0 20-9 31-24 31H56z',
    crystal: 'M50 7c3 0 5 1 7 4l28 34c3 4 4 7 3 11L78 85c-1 4-4 6-9 6H56L50 48z',
    fin: 'M77 9c10-2 15 4 12 13-6 18-4 36 3 53 4 9-2 16-13 16H58C52 62 60 34 77 9z'
  };

  /* quatre teintes bien distinctes, tirées du look */
  function padColors(skin) {
    var c = skin.c, ui = skin.ui, cand = [].concat(c.plate, ui.accent2, ui.accent, c.cheek, c.body, c.belly), hues = [], i, j, h, ok;
    for (i = 0; i < cand.length && hues.length < 4; i++) {
      h = toHsl(cand[i]);
      if (h[1] < 0.22) continue;
      ok = true;
      for (j = 0; j < hues.length; j++) if (hueGap(hues[j], h[0]) < 48) ok = false;
      if (ok) hues.push(h[0]);
    }
    if (!hues.length) hues.push(190);
    while (hues.length < 4) {                 // on complète au milieu du plus grand vide du cercle des teintes
      var s = hues.slice().sort(function (a, b) { return a - b; }), best = 0, at = 0, gap;
      for (i = 0; i < s.length; i++) {
        gap = (i + 1 < s.length ? s[i + 1] : s[0] + 360) - s[i];
        if (gap > best) { best = gap; at = s[i] + gap / 2; }
      }
      hues.push(at % 360);
    }
    var out = [];
    for (i = 0; i < 4; i++) {
      h = hues[i];
      out.push(fromHsl(h, 0.82, (h > 45 && h < 195) ? 0.5 : 0.6));   // jaunes et verts un peu plus denses
    }
    return out;
  }

  function plateSvg(type, col, id) {
    var d = PLATE_PATH[type] || PLATE_PATH.tri, f = PLATE_FACET[type] || PLATE_FACET.tri;
    var dim1 = mix(col, '#ffffff', 0.12), dim2 = mix(col, '#000000', 0.22), hi = mix(col, '#ffffff', 0.62), lo = mix(col, '#000000', 0.16);
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + 'a" x1=".2" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="' + dim1 + '"/><stop offset="1" stop-color="' + dim2 + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'b" x1=".2" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="' + hi + '"/><stop offset=".45" stop-color="' + col + '"/><stop offset="1" stop-color="' + lo + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="' + col + '" stop-opacity=".85"/><stop offset=".6" stop-color="' + col + '" stop-opacity=".3"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></radialGradient></defs>' +
      '<g class="mtg-pl-off" opacity=".56"><path d="' + d + '" fill="url(#' + id + 'a)"/><path d="' + f + '" fill="#000" opacity=".14"/>' +
      '<path d="' + d + '" fill="none" stroke="' + mix(col, '#ffffff', 0.25) + '" stroke-width="2"/></g>' +
      '<g class="mtg-pl-on"><circle cx="50" cy="54" r="70" fill="url(#' + id + 'g)"/><path d="' + d + '" fill="url(#' + id + 'b)"/><path d="' + f + '" fill="#000" opacity=".1"/>' +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.5"/></g>' +
      '<ellipse cx="41" cy="40" rx="7" ry="13" fill="#fff" opacity=".28" transform="rotate(24 41 40)"/></svg>';
  }

  function runMemo(g) {
    var MAXLEN = 8, INPUT_MS = 6000;
    var def = GAMES.memo, c = g.ctx;
    var scene = addScene(g);
    var mon = Monster(g, g.world, 'neutral');
    var cols = padColors(c.skin), NOTES = [0.5, 0.63, 0.75, 1];
    var grid = el('div', 'mtg-grid'), pads = [], i, b;
    for (i = 0; i < 4; i++) {
      b = el('button', 'mtg-plate', plateSvg(c.skin.plate, cols[i], c.uid()));
      b.type = 'button';
      b.setAttribute('aria-label', 'Plaque ' + (i + 1));
      b.style.setProperty('--mtg-pc', cols[i]);
      grid.appendChild(b); pads.push(b);
    }
    g.pad.appendChild(grid);
    var dots = el('div', 'mtg-dots');
    dots.setAttribute('aria-hidden', 'true');
    g.side.appendChild(dots);

    var seq = [], pos = 0, wait = 0, offTk = [null, null, null, null];

    function layout() {
      var W = g.stage.clientWidth || g.W, H = g.stage.clientHeight || 160;
      var gfb = Math.max(18, H * 0.14);
      layoutScene(scene, W, H, gfb);
      mon.fit(clamp((H - gfb - (H < 150 ? 38 : 48)) * 0.95, 56, 200), W * 0.5);
      mon.at(W / 2, H - gfb);
    }
    g.layout = layout;
    layout();

    function light(i, ms, quiet) {
      var p = pads[i];
      if (offTk[i]) g.cancel(offTk[i]);
      p.classList.add('mtg-lit');
      offTk[i] = g.after(ms, function () { offTk[i] = null; p.classList.remove('mtg-lit'); });
      if (!quiet) c.sfx('coin', { pitch: NOTES[i], volume: 1.1 });
    }
    function enable(on) { grid.classList.toggle('mtg-off', !on); }
    function drawDots() {
      var s = '', i;
      for (i = 0; i < seq.length; i++) s += '<span class="mtg-dot' + (g.phase === 'input' && i < pos ? ' mtg-done' : '') + '"></span>';
      dots.innerHTML = s;
    }

    function nextRound() {
      var n;
      do { n = Math.floor(Math.random() * 4) % 4; }
      while (seq.length >= 2 && seq[seq.length - 1] === n && seq[seq.length - 2] === n);
      seq.push(n);
      pos = 0;
      g.phase = 'show';
      enable(false);
      drawDots();
      mon.set(seq.length >= 4 ? 'surprised' : 'neutral');
      say(g, 'Regarde bien…', '', 0);
      var step = Math.max(310, 560 - 35 * (seq.length - 1)), k;
      for (k = 0; k < seq.length; k++) (function (k) {
        g.after(520 + k * step, function () { light(seq[k], step * 0.62); });
      })(k);
      g.after(520 + seq.length * step + 80, function () {
        g.phase = 'input';
        wait = INPUT_MS;
        enable(true);
        say(g, 'À toi !', '', 0);
        drawDots();
      });
    }

    function press(i) {
      if (g.phase !== 'input') return;
      wait = INPUT_MS;
      if (seq[pos] !== i) { light(i, 240, true); return wrong(false); }
      light(i, 240);
      c.haptic('tap');
      pos++;
      drawDots();
      if (pos < seq.length) return;
      g.phase = 'bravo';
      enable(false);
      g.setScore(seq.length);
      mon.set('happy'); mon.play('hop');
      g.after(260, function () { c.sfx('ok'); c.haptic('ok'); });
      if (seq.length >= MAXLEN) {
        say(g, 'Mémoire de titan !', 'good', 0);
        g.after(1300, function () { finish(g, { win: true }); });
      } else {
        say(g, pick(['Bravo !', 'Parfait !', 'Bien joué !']), 'good', 0);
        g.after(950, nextRound);
      }
    }

    function wrong(late) {
      g.phase = 'fin';
      enable(false);
      c.sfx('no'); c.haptic('no');
      mon.set('sad'); mon.play('no');
      say(g, late ? 'Trop tard !' : 'Oups, ce n\'était pas celle-là.', 'bad', 0);
      var good = seq[pos], k;
      for (k = 0; k < 3; k++) (function (k) { g.after(300 + k * 300, function () { light(good, 170, true); }); })(k);
      var win = g.score >= def.goal;
      g.after(1500, function () { finish(g, { win: win }); });
    }

    g.update = function (dt) {
      if (g.phase !== 'input') return;
      wait -= dt;
      if (wait <= 0) wrong(true);
    };
    g.info = function () { return { seq: seq.slice(), pos: pos, colors: cols.slice() }; };

    for (i = 0; i < 4; i++) (function (i) {
      g.on(pads[i], 'pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button > 0) return;
        if (e.cancelable) e.preventDefault();
        press(i);
      });
      g.on(pads[i], 'click', function (e) { if (e.detail === 0) press(i); });   // clavier / lecteur d'écran
    })(i);
    g.on(g.root, 'contextmenu', function (e) { e.preventDefault(); });

    intro(g, def, nextRound);
  }

  /* ------------------------------------------------------------------ catalogue */
  var GAMES = {
    cote: {
      id: 'cote', name: 'Gauche ou droite ?', desc: 'Devine de quel côté il va se tourner.', icon: 'main', goal: 3,
      rule: 'Devine de quel côté ton monstre va se tourner !', aim: 'Objectif : 3 bonnes réponses sur 5', run: runCote
    },
    festin: {
      id: 'festin', name: 'Festin tombé du ciel', desc: 'Gobe les plats, évite les crottes.', icon: 'steak', goal: 12,
      rule: 'Glisse ton doigt pour gober les plats, et évite les crottes !', aim: 'Objectif : 12 points en 30 secondes', run: runFestin
    },
    memo: {
      id: 'memo', name: 'Rugi-mémo', desc: 'Retiens la suite des plaques qui s\'allument.', icon: 'eclair', goal: 5,
      rule: 'Regarde les plaques s\'allumer, puis refais la même suite.', aim: 'Objectif : une suite de 5 plaques', run: runMemo
    }
  };

  /* ------------------------------------------------------------------ CSS */
  var css = [
    '.mtg-root{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;padding:10px 12px 12px;gap:10px;',
    'color:var(--mtg-ink);background:linear-gradient(180deg,var(--mtg-bg1),var(--mtg-bg2));border-radius:inherit;',
    'font-family:var(--font,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);font-size:16px;font-weight:600;line-height:1.25;font-style:normal;letter-spacing:normal;text-align:left;',
    '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:none;contain:layout paint}',
    '.mtg-root *,.mtg-root *::before,.mtg-root *::after{box-sizing:border-box}',
    '.mtg-root svg{display:block}',
    '.mtg-root .mt-mon,.mtg-root .mt-prop,.mtg-root .mt-scene{display:block;width:100%;height:100%}',
    '.mtg-root button{font:inherit;color:inherit;margin:0;border:0;background:none;padding:0;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none;outline:none}',
    '.mtg-root button:focus-visible{outline:3px solid var(--mtg-ink);outline-offset:2px}',

    /* bandeau : score + infos du jeu */
    '.mtg-hud{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px}',
    '.mtg-chip{display:flex;align-items:center;gap:7px;height:44px;padding:0 14px 0 8px;border-radius:22px;background:var(--mtg-panel);border:1px solid var(--mtg-line);transition:background-color .25s,color .25s;white-space:nowrap}',
    '.mtg-chip-ic{width:28px;height:28px;flex:none}',
    '.mtg-chip b{font-size:22px;font-weight:800;min-width:.7em;text-align:center;font-variant-numeric:tabular-nums;letter-spacing:-.01em}',
    '.mtg-chip i{font-style:normal;font-size:12.5px;font-weight:600;opacity:.78}',
    '.mtg-chip.mtg-reached{background:var(--mtg-accent2);color:var(--mtg-on-accent2);border-color:transparent}',
    '.mtg-chip.mtg-reached i{opacity:.9}',
    '.mtg-side{display:flex;align-items:center;justify-content:flex-end;min-width:0;flex:1 1 auto}',

    /* scène */
    '.mtg-stage{position:relative;flex:1 1 auto;min-height:0;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04));',
    'box-shadow:0 0 0 1px var(--mtg-line),0 10px 24px rgba(0,0,0,.22);isolation:isolate}',
    '.mtg-stage.mtg-noscene{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.05) 62%,rgba(0,0,0,.16) 62%,rgba(0,0,0,.24))}',
    '.mtg-world{position:absolute;left:0;top:0;right:0;bottom:0}',
    '.mtg-scene{position:absolute;pointer-events:none}',
    '.mtg-mon{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}',
    '.mtg-flip{width:100%;height:100%;transition:transform .13s ease-in-out;transform-origin:50% 50%}',
    '.mtg-act{position:relative;width:100%;height:100%}',
    '.mtg-say{position:absolute;left:12px;right:12px;top:12px;width:-webkit-fit-content;width:fit-content;max-width:calc(100% - 24px);margin:0 auto;padding:9px 16px;border-radius:999px;background:var(--mtg-panel);border:1px solid var(--mtg-line);',
    'font-size:16px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:translateY(-8px);opacity:0;transition:opacity .18s,transform .18s;pointer-events:none;z-index:5}',
    '.mtg-say.mtg-in{opacity:1;transform:none}',
    '.mtg-say.mtg-good{background:#1fae63;color:#fff;border-color:transparent}',
    '.mtg-say.mtg-bad{background:#e5484d;color:#fff;border-color:transparent}',
    '.mtg-short .mtg-say{top:7px;padding:6px 14px;font-size:14.5px}',
    '.mtg-pad{flex:none;display:flex;flex-direction:column;gap:8px}',
    '.mtg-pad:empty{display:none}',

    /* consigne + compte à rebours */
    '.mtg-intro{position:absolute;left:0;top:0;right:0;bottom:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:18px;background:var(--mtg-veil);transition:opacity .24s;animation:mtg-fade .22s ease-out}',
    '.mtg-intro.mtg-out{opacity:0;pointer-events:none}',
    '.mtg-card{width:100%;max-width:330px;padding:20px 20px 18px;border-radius:28px;text-align:center;background:var(--mtg-panel);border:1px solid var(--mtg-line);box-shadow:0 18px 40px rgba(0,0,0,.3);animation:mtg-pop .32s cubic-bezier(.2,1.3,.4,1)}',
    '.mtg-card-ic{width:68px;height:68px;margin:0 auto 10px}',
    '.mtg-consigne{margin:0;font-size:19px;font-weight:800;line-height:1.28;letter-spacing:-.01em;text-wrap:balance}',
    '.mtg-but{margin:8px 0 0;font-size:14px;font-weight:600;opacity:.8}',
    '.mtg-count{height:84px;margin-top:12px;display:flex;align-items:center;justify-content:center}',
    '.mtg-ready{font-size:20px;font-weight:700;opacity:.85}',
    '.mtg-num{display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;font-size:46px;font-weight:800;line-height:1;color:var(--mtg-on-accent);',
    'background:linear-gradient(180deg,var(--mtg-accent-l),var(--mtg-accent));box-shadow:0 6px 0 var(--mtg-accent-d),0 12px 22px rgba(0,0,0,.25);animation:mtg-num .7s cubic-bezier(.2,1.4,.4,1)}',
    '.mtg-short .mtg-card{padding:14px 16px 12px}.mtg-short .mtg-card-ic{width:48px;height:48px;margin-bottom:6px}.mtg-short .mtg-consigne{font-size:17px}.mtg-short .mtg-count{height:70px;margin-top:8px}',
    '.mtg-short .mtg-num{width:64px;height:64px;font-size:38px}',

    /* 1. gauche ou droite */
    '.mtg-pips{display:flex;gap:7px}',
    '.mtg-pip{width:30px;height:30px;border-radius:50%;background:var(--mtg-panel);border:2px solid var(--mtg-line);display:flex;align-items:center;justify-content:center;color:#fff;transition:background-color .2s,border-color .2s,transform .2s}',
    '.mtg-pip svg{width:18px;height:18px}',
    '.mtg-pip.mtg-now{border-color:var(--mtg-ink);transform:scale(1.12)}',
    '.mtg-narrow .mtg-pips{gap:5px}.mtg-narrow .mtg-pip{width:24px;height:24px}.mtg-narrow .mtg-pip svg{width:14px;height:14px}',
    '.mtg-narrow .mtg-chip{padding:0 11px 0 6px;gap:5px}.mtg-narrow .mtg-chip i{font-size:11.5px}.mtg-narrow .mtg-chip-ic{width:24px;height:24px}',
    '.mtg-pip.mtg-ok{background:#1fae63;border-color:transparent;animation:mtg-pop .3s cubic-bezier(.2,1.4,.4,1)}',
    '.mtg-pip.mtg-ko{background:#e5484d;border-color:transparent;animation:mtg-pop .3s cubic-bezier(.2,1.4,.4,1)}',
    '.mtg-think{position:absolute;left:0;top:0;width:0;height:0;opacity:0;transition:opacity .16s;pointer-events:none;z-index:3}',
    '.mtg-think.mtg-in{opacity:1}',
    '.mtg-think span{position:absolute;left:-23px;top:-23px;width:46px;height:46px;border-radius:50% 50% 50% 14px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;',
    'background:#fff;color:#1b1420;box-shadow:0 4px 12px rgba(0,0,0,.25);animation:mtg-bob 1s ease-in-out infinite}',
    '.mtg-arrow{position:absolute;left:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;color:#1b1420;',
    'box-shadow:0 6px 16px rgba(0,0,0,.3);opacity:0;transform:scale(.4);transition:opacity .16s,transform .24s cubic-bezier(.2,1.4,.4,1);pointer-events:none;z-index:3}',
    '.mtg-arrow svg{width:34px;height:34px}',
    '.mtg-arrow.mtg-in.mtg-to-l{opacity:1;transform:translateX(calc(var(--mtg-w) * -.34)) scale(1)}',
    '.mtg-arrow.mtg-in.mtg-to-r{opacity:1;transform:translateX(calc(var(--mtg-w) * .34)) scale(1)}',
    '.mtg-wait{height:6px;border-radius:3px;background:var(--mtg-panel);overflow:hidden;opacity:0;transition:opacity .2s}',
    '.mtg-wait.mtg-in{opacity:1}',
    '.mtg-wait i{display:block;height:100%;border-radius:3px;background:var(--mtg-ink);transform-origin:0 50%;will-change:transform}',
    '.mtg-btns{display:flex;gap:12px;padding-bottom:6px;transition:opacity .2s}',
    '.mtg-btn{position:relative;flex:1 1 0;min-width:0;height:clamp(64px,calc(var(--mtg-h) * .15),88px);border-radius:24px;display:flex;align-items:center;justify-content:center;gap:6px;',
    'font-size:20px;font-weight:800;letter-spacing:-.01em;transition:transform .08s,box-shadow .08s,filter .2s,opacity .2s}',
    '.mtg-root .mtg-btn-l{background:linear-gradient(180deg,var(--mtg-accent-l),var(--mtg-accent));color:var(--mtg-on-accent);box-shadow:0 6px 0 var(--mtg-accent-d)}',
    '.mtg-root .mtg-btn-r{background:linear-gradient(180deg,var(--mtg-accent2-l),var(--mtg-accent2));color:var(--mtg-on-accent2);box-shadow:0 6px 0 var(--mtg-accent2-d)}',
    '.mtg-btn-ic{width:30px;height:30px;flex:none}',
    '.mtg-btn-ic svg{width:100%;height:100%}',
    '.mtg-root .mtg-btn:active:not(:disabled),.mtg-root .mtg-btn.mtg-picked{transform:translateY(4px);box-shadow:0 2px 0 rgba(0,0,0,.35)}',
    '.mtg-btns.mtg-off .mtg-btn{opacity:.5;filter:saturate(.6)}',
    '.mtg-btns.mtg-off .mtg-btn.mtg-picked{opacity:.9;filter:none}',
    '.mtg-btns.mtg-off .mtg-btn.mtg-right{opacity:1;filter:none;outline:4px solid #1fae63;outline-offset:2px}',
    '.mtg-btns.mtg-off .mtg-btn.mtg-wrong{outline:4px solid #e5484d;outline-offset:2px}',

    /* 2. festin */
    '.mtg-full.mtg-root{padding:10px 8px 8px}',
    '.mtg-g-festin .mtg-stage{cursor:grab}',
    '.mtg-g-festin .mtg-scene *{animation-play-state:paused !important}',
    '.mtg-timer{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px 0 10px;border-radius:22px;background:var(--mtg-panel);border:1px solid var(--mtg-line);flex:1 1 auto;max-width:210px;min-width:0}',
    '.mtg-timer-ic{width:22px;height:22px;flex:none;opacity:.9}',
    '.mtg-bar{flex:1 1 auto;height:8px;border-radius:4px;background:rgba(127,127,127,.35);overflow:hidden;min-width:20px}',
    '.mtg-bar i{display:block;height:100%;border-radius:4px;background:var(--mtg-accent2);transform-origin:0 50%;will-change:transform}',
    '.mtg-timer b{font-size:16px;font-weight:800;min-width:2.5em;text-align:right;font-variant-numeric:tabular-nums}',
    '.mtg-timer.mtg-hurry .mtg-bar i{background:#ff5a5f}',
    '.mtg-timer.mtg-hurry b{animation:mtg-blink .5s ease-in-out infinite alternate}',
    '.mtg-items,.mtg-shadows{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none}',
    '.mtg-item{position:absolute;left:0;top:0;will-change:transform,opacity;filter:drop-shadow(0 3px 3px rgba(0,0,0,.28))}',
    '.mtg-ish{position:absolute;left:0;top:0;height:10px;border-radius:50%;background:rgba(0,0,0,.5);opacity:0;will-change:transform,opacity}',
    '.mtg-fx{position:absolute;left:0;top:0;opacity:0;font-size:26px;font-weight:900;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 10px rgba(0,0,0,.35);transform:translate(-50%,0);white-space:nowrap}',
    '.mtg-fx.mtg-fx-bad{color:#ff6b6b}',
    '.mtg-yuck{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0}',
    '.mtg-act.mtg-beurk>.mt-mon{opacity:0}',
    '.mtg-act.mtg-beurk>.mtg-yuck{opacity:1}',
    '.mtg-flash{position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 60%,rgba(229,72,77,0) 35%,rgba(229,72,77,.85));opacity:0;pointer-events:none;z-index:4}',
    '.mtg-track{position:absolute;left:10px;right:10px;bottom:8px;border-radius:20px;background:var(--mtg-panel);border:1px solid var(--mtg-line);overflow:hidden;z-index:4;pointer-events:none}',
    '.mtg-knob{position:absolute;left:-10px;top:50%;width:64px;height:40px;margin-top:-20px;border-radius:20px;display:flex;align-items:center;justify-content:center;',
    'background:linear-gradient(180deg,var(--mtg-accent-l),var(--mtg-accent));color:var(--mtg-on-accent);box-shadow:0 3px 0 var(--mtg-accent-d);will-change:transform}',
    '.mtg-knob svg{width:44px;height:22px}',
    '.mtg-hint{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:13.5px;font-weight:700;opacity:.8;transition:opacity .4s;animation:mtg-blink .8s ease-in-out infinite alternate}',
    '.mtg-track.mtg-used .mtg-hint{opacity:0;animation:none}',

    /* 3. mémo */
    '.mtg-g-memo .mtg-stage{flex:0 0 34%;min-height:112px}',
    '.mtg-g-memo .mtg-pad{flex:1 1 auto;min-height:0}',
    '.mtg-grid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:12px;transition:opacity .2s}',
    '.mtg-root .mtg-plate{position:relative;min-height:56px;border-radius:28px;background:var(--mtg-panel);border:1px solid var(--mtg-line);display:flex;align-items:center;justify-content:center;padding:8px;overflow:hidden;transition:transform .09s}',
    '.mtg-plate svg{height:100%;width:auto;max-width:100%;overflow:visible;pointer-events:none;transition:transform .09s}',
    '.mtg-plate::after{content:"";position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;background:var(--mtg-pc);opacity:0;transition:opacity .09s;pointer-events:none}',
    '.mtg-pl-on{opacity:0;transition:opacity .09s}',
    '.mtg-plate.mtg-lit .mtg-pl-on{opacity:1}',
    '.mtg-plate.mtg-lit::after{opacity:.28}',
    '.mtg-plate.mtg-lit svg{transform:scale(1.07)}',
    '.mtg-root .mtg-plate:active{transform:scale(.97)}',
    '.mtg-grid.mtg-off .mtg-plate{cursor:default}',
    '.mtg-dots{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;height:44px;padding:0 14px;border-radius:22px;background:var(--mtg-panel);border:1px solid var(--mtg-line)}',
    '.mtg-dots:empty{display:none}',
    '.mtg-dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--mtg-ink);opacity:.55;transition:background-color .12s,opacity .12s}',
    '.mtg-dot.mtg-done{background:var(--mtg-ink);opacity:1}',

    '@keyframes mtg-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes mtg-pop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}',
    '@keyframes mtg-num{0%{transform:scale(1.7);opacity:0}45%{transform:scale(.92);opacity:1}100%{transform:scale(1)}}',
    '@keyframes mtg-bob{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-5px) rotate(6deg)}}',
    '@keyframes mtg-blink{from{opacity:.45}to{opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.mtg-think span,.mtg-hint,.mtg-timer.mtg-hurry b{animation:none}.mtg-flip{transition:none}}'
  ].join('');

  /* ------------------------------------------------------------------ API */
  var list = [], k;
  for (k in GAMES) list.push({ id: GAMES[k].id, name: GAMES[k].name, desc: GAMES[k].desc, icon: GAMES[k].icon, goal: GAMES[k].goal });

  MT.games = {
    css: css,
    list: list,
    start: start,
    stop: stop,
    running: function () { return cur ? cur.id : null; },
    /* tests uniquement : avance l'horloge à la main (par pas de 16 ms, ou de `step` ms) et expose l'état de la partie */
    _test: {
      advance: function (ms, step) {
        var g = cur, left = +ms || 0, d;
        step = clamp(+step || 16, 1, 100);
        while (g && !g.over && left > 0) { d = Math.min(step, left); left -= d; try { g.advance(d); } catch (e) { fail(g, e); } }
        return cur ? cur.t : -1;
      },
      state: function () {
        var g = cur, o, x, k2;
        if (!g) return null;
        o = { id: g.id, t: g.t, phase: g.phase, score: g.score, tasks: g.tasks.length, listeners: g.listeners.length, raf: g.raf, W: g.W, H: g.H };
        if (g.info) { x = g.info(); for (k2 in x) o[k2] = x[k2]; }
        return o;
      }
    }
  };
})();
