/* Mini-Titan — décors (habitats) et objets HD, en SVG vectoriel.
   MT.scenes.render(skin, {night, uid}) -> chaîne <svg class="mt-scene" viewBox="0 0 400 600">
   MT.scenes.css                         -> keyframes d'ambiance à injecter une fois
   MT.props.svg(id, uid)                 -> chaîne <svg class="mt-prop" viewBox="0 0 100 100">
   Repères du décor : sol du monstre à y = 470, zone calme x 90–310 / y 220–480, rognage par le haut. */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};

  /* ------------------------------------------------------------------ couleurs */
  function rgb(h) {
    h = String(h || '#888888').replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16) || 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function hex(a) {
    var s = '#', i, v;
    for (i = 0; i < 3; i++) { v = Math.max(0, Math.min(255, Math.round(a[i]))); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  function mix(a, b, t) { a = rgb(a); b = rgb(b); return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  function lite(c, t) { return mix(c, '#ffffff', t); }
  function dark(c, t) { return mix(c, '#000000', t); }
  function desat(c, t) { var a = rgb(c), g = a[0] * .3 + a[1] * .59 + a[2] * .11; return hex([a[0] + (g - a[0]) * t, a[1] + (g - a[1]) * t, a[2] + (g - a[2]) * t]); }
  /* même matière vue de nuit : désaturée, refroidie, assombrie */
  var NT0 = { m: [.33, .41, .68], b: '#232a6a', k: .12, s: .35 };
  function nightTone(c, nt) {
    nt = nt || NT0;
    var a = rgb(desat(c, nt.s));
    return mix(hex([a[0] * nt.m[0], a[1] * nt.m[1], a[2] * nt.m[2]]), nt.b, nt.k);
  }
  function plateOf(c) { var p = c && c.plate; return (p && typeof p !== 'string') ? p[0] : (p || '#38e8ff'); }

  /* ------------------------------------------------------------------ outils */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  if (!Math.imul) Math.imul = function (a, b) { var ah = a >>> 16 & 0xffff, al = a & 0xffff, bh = b >>> 16 & 0xffff, bl = b & 0xffff; return (al * bl + ((ah * bl + al * bh) << 16 >>> 0)) | 0; };
  function n1(v) { return Math.round(v * 10) / 10; }
  function R(x, y, w, h, fill, ex) { return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function C(x, y, r, fill, ex) { return '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(r) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function E(x, y, rx, ry, fill, ex) { return '<ellipse cx="' + n1(x) + '" cy="' + n1(y) + '" rx="' + n1(rx) + '" ry="' + n1(ry) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function S(d, col, w, ex) {
    ex = ex || '';
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (ex.indexOf('stroke-linecap') < 0 ? ' stroke-linecap="round"' : '') + ' stroke-linejoin="round"' + (ex ? ' ' + ex : '') + '/>';
  }
  function G(inner, ex) { return '<g' + (ex ? ' ' + ex : '') + '>' + inner + '</g>'; }
  function op(v) { return 'opacity="' + v + '"'; }
  /* attributs d'animation : classe + décalage (négatif = déjà en cours) + durée éventuelle */
  function an(cls, delay, dur) {
    var st = '';
    if (delay) st += 'animation-delay:-' + n1(delay) + 's;';
    if (dur) st += 'animation-duration:' + n1(dur) + 's;';
    return 'class="mt-a-' + cls + '"' + (st ? ' style="' + st + '"' : '');
  }
  function stopsOf(stops) {
    var s = '', i, a;
    for (i = 0; i < stops.length; i++) { a = stops[i]; s += '<stop offset="' + a[0] + '" stop-color="' + a[1] + '"' + (a[2] != null ? ' stop-opacity="' + a[2] + '"' : '') + '/>'; }
    return s;
  }
  function mkCtx(skin, opts, seed) {
    opts = opts || {};
    var K = { s: skin, c: skin.c || {}, ui: skin.ui || {}, n: !!opts.night, u: String(opts.uid == null ? 'mts' : opts.uid) + '-', defs: '', r: rng(seed), _h: {} };
    /* t(jour[, nuit]) : couleur de matière ; la nuit, teinte automatique (réglée par K.tone) ou valeur explicite */
    K.t = function (col, night) { return K.n ? (night || nightTone(col, K.nt)) : col; };
    K.tone = function (m0, m1, m2, b, k, s) { K.nt = { m: [m0, m1, m2], b: b || '#232a6a', k: k == null ? .12 : k, s: s == null ? .2 : s }; };
    /* lumière douce au sol, sous le monstre */
    K.stage = function (col, o) { return E(200, 484, 205, 42, K.halo(col), op(o == null ? .8 : o)); };
    K.dn = function (d, n) { return K.n ? n : d; };
    K.lg = function (name, stops, d) {
      d = d || [0, 0, 0, 1];
      K.defs += '<linearGradient id="' + K.u + name + '" x1="' + d[0] + '" y1="' + d[1] + '" x2="' + d[2] + '" y2="' + d[3] + '">' + stopsOf(stops) + '</linearGradient>';
      return 'url(#' + K.u + name + ')';
    };
    K.rg = function (name, stops, cx, cy, r) {
      K.defs += '<radialGradient id="' + K.u + name + '" cx="' + (cx == null ? .5 : cx) + '" cy="' + (cy == null ? .5 : cy) + '" r="' + (r == null ? .5 : r) + '">' + stopsOf(stops) + '</radialGradient>';
      return 'url(#' + K.u + name + ')';
    };
    /* halo doux d'une couleur (dégradé radial mis en cache) */
    K.halo = function (col) {
      var k = 'h' + String(col).replace('#', '');
      if (!K._h[k]) K._h[k] = K.rg(k, [[0, col, 1], [.3, col, .5], [1, col, 0]]);
      return K._h[k];
    };
    return K;
  }
  /* courbe lisse passant par des points ; fermée jusqu'à « base » si fourni */
  function ridge(pts, base) {
    var d = 'M' + n1(pts[0][0]) + ' ' + n1(pts[0][1]), i, L = pts.length;
    for (i = 1; i < L - 1; i++) d += 'Q' + n1(pts[i][0]) + ' ' + n1(pts[i][1]) + ' ' + n1((pts[i][0] + pts[i + 1][0]) / 2) + ' ' + n1((pts[i][1] + pts[i + 1][1]) / 2);
    d += 'L' + n1(pts[L - 1][0]) + ' ' + n1(pts[L - 1][1]);
    if (base != null) d += 'V' + base + 'H' + n1(pts[0][0]) + 'Z';
    return d;
  }
  /* ruban de largeur variable autour d'une ligne [[x, y, demi-largeur], ...] (rivière, coulée) */
  function ribbon(pts, k) {
    var L = [], Rr = [], i, a, b, tx, ty, l, n = pts.length;
    for (i = 0; i < n; i++) {
      a = pts[Math.max(0, i - 1)]; b = pts[Math.min(n - 1, i + 1)];
      tx = b[0] - a[0]; ty = b[1] - a[1]; l = Math.sqrt(tx * tx + ty * ty) || 1;
      L.push([pts[i][0] - ty / l * pts[i][2] * k, pts[i][1] + tx / l * pts[i][2] * k]);
      Rr.unshift([pts[i][0] + ty / l * pts[i][2] * k, pts[i][1] - tx / l * pts[i][2] * k]);
    }
    return ridge(L) + ridge(Rr).replace('M', 'L') + 'Z';
  }
  /* 0 au centre (x = 200), « a » sur les bords : garde le milieu bas et dégagé */
  function valley(x, a, p) { return Math.pow(Math.min(1, Math.abs(x - 200) / 200), p || 1.3) * a; }
  function hillPts(K, y0, vamp, amp, step, p) {
    var pts = [], x;
    for (x = -24; x <= 424; x += step) pts.push([x, y0 - valley(x, vamp, p) - (K.r() - .5) * amp]);
    return pts;
  }
  function starPts(cx, cy, ro, ri, n, rot) {
    var s = '', i, a, rr;
    for (i = 0; i < n * 2; i++) { a = (rot || 0) + Math.PI * i / n - Math.PI / 2; rr = i % 2 ? ri : ro; s += (i ? ' ' : '') + n1(cx + Math.cos(a) * rr) + ',' + n1(cy + Math.sin(a) * rr); }
    return s;
  }
  function poly(pts, fill, ex) { return '<polygon points="' + pts + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function stars(K, n, yMax, col) {
    /* points = sous-chemins de longueur quasi nulle à bouts ronds (très compact) ; quelques-unes scintillent */
    var a = ['', '', ''], o = '', i, x, y;
    col = col || '#ffffff';
    for (i = 0; i < n; i++) {
      x = K.r() * 400; y = K.r() * yMax;
      if (i % 7 === 0) o += C(x, y, 1.3, col, an('tw', K.r() * 4)); else a[i % 3] += 'M' + n1(x) + ' ' + n1(y) + 'h.01';
    }
    return S(a[0], col, 1.4, op(.5)) + S(a[1], col, 2, op(.7)) + S(a[2], col, 2.7, op(.85)) + o;
  }
  function moon(K, x, y, r, col) {
    return C(x, y, r * 3.4, K.halo(col), op(.55)) + C(x, y, r, col) +
      C(x - r * .3, y - r * .25, r * .22, dark(col, .1), op(.6)) + C(x + r * .32, y + r * .2, r * .16, dark(col, .1), op(.6)) + C(x - r * .1, y + r * .45, r * .12, dark(col, .1), op(.6));
  }
  function sun(K, x, y, r, col, halo) { return C(x, y, r * 3.2, K.halo(halo || col), op(.8)) + C(x, y, r, col); }
  function cloud(x, y, s, fill, ex) {
    return '<g transform="translate(' + n1(x) + ' ' + n1(y) + ') scale(' + s + ')" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '><rect x="-34" y="-9" width="68" height="18" rx="9"/><circle cx="-13" cy="-9" r="12"/><circle cx="5" cy="-14" r="15"/><circle cx="20" cy="-6" r="9"/></g>';
  }

  /* ------------------------------------------------------------------ immeubles (ville, néon) */
  function skyline(K, base, hmin, hvar, vamp, vp, wmin, wvar) {
    var x = -8, d = 'M-8 ' + (base + 6), w, h;
    while (x < 408) { w = wmin + K.r() * wvar; h = hmin + valley(x + w / 2, vamp, vp) + K.r() * hvar; d += 'V' + n1(base - h) + 'H' + n1(x + w); x += w; }
    return d + 'V' + (base + 6) + 'Z';
  }
  function bld(K, x, w, top, base, col, o) {
    o = o || {};
    /* fenêtres = traits verticaux : une trame en pointillés (w0), puis les exceptions (w1, w2) par-dessus */
    var h = base - top, s = '', all = '', lit = '', acc = '', cw = o.cw || 4, ch = o.ch || 5, gx = o.gx || 7, gy = o.gy || 9,
      cols = Math.max(1, Math.floor((w - 4) / gx)), rows = Math.max(1, Math.floor((h - 9) / gy)),
      x0 = x + (w - (cols * gx - (gx - cw))) / 2 + cw / 2, i, j, v, seg, p1 = o.p1 == null ? .5 : o.p1, p2 = o.p2 || 0;
    s += R(x, top, w, h, col);
    if (o.side) s += R(x + w * .7, top, w * .3, h, o.side);
    if (o.cap) s += R(x - 1, top - 2, w + 2, 3.5, o.cap, 'rx="1"');
    for (i = 0; i < cols; i++) {
      all += 'M' + n1(x0 + i * gx) + ' ' + n1(top + 7) + 'v' + (rows * gy - (gy - ch));
      for (j = 0; j < rows; j++) {
        v = K.r(); seg = 'M' + n1(x0 + i * gx) + ' ' + n1(top + 7 + j * gy) + 'v' + ch;
        if (v < p1) lit += seg; else if (v < p1 + p2) acc += seg;
      }
    }
    s += '<path d="' + all + '" fill="none" stroke="' + o.w0 + '" stroke-width="' + cw + '" stroke-dasharray="' + ch + ' ' + (gy - ch) + '"/>';
    if (lit) s += '<path d="' + lit + '" fill="none" stroke="' + o.w1 + '" stroke-width="' + cw + '"/>';
    if (acc) s += '<path d="' + acc + '" fill="none" stroke="' + o.w2 + '" stroke-width="' + cw + '"/>';
    return s;
  }
  function tree(x, y, r, col, hl, trunk) {
    return R(x - 1, y - r * .5, 2, r * .5 + 1, trunk) + C(x, y - r * 1.2, r, col) + C(x - r * .3, y - r * 1.5, r * .45, hl, op(.5));
  }
  function car(x, y, col, n) {
    return R(x, y + 4, 20, 7, col, 'rx="3"') + P('M' + (x + 4) + ' ' + (y + 4.5) + 'q1.5-4.5 5-4.5h3.5q3.5 0 5 4.5z', lite(col, .3)) +
      C(x + 5, y + 11, 2.4, '#27323a') + C(x + 15, y + 11, 2.4, '#27323a') + (n ? E(x + 22, y + 8, 5, 2, '#fff3b0', op(.7)) : '');
  }

  var SC = {};

  /* ================================================================== 1. VILLE ATOMIQUE */
  SC.city = function (K) {
    K.tone(.24, .42, .46, '#0c2f33', .14, .15);
    var n = K.n, c = K.c, t = K.t, r = K.r, o = '', i, x, d, hz = n ? '#2a8262' : '#fbf8cf', pl = plateOf(c);
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#04111a'], [.45, '#0a2a30'], [.78, '#145246'], [1, hz]] : [[0, '#86d8ca'], [.45, '#bdeeda'], [.78, '#e9f8da'], [1, hz]]));
    if (n) o += stars(K, 46, 390);
    o += n ? moon(K, 326, 292, 15, '#eafff0') : sun(K, 326, 296, 17, '#fffff2', '#ffffd8');
    /* nuages */
    var cl = n ? '#2c7468' : '#ffffff';
    o += G(cloud(70, 316, .95, cl, op(n ? .45 : .85)), an('drift'));
    o += G(cloud(292, 258, .7, cl, op(n ? .35 : .7)), an('drift', 20, 80));
    o += G(cloud(150, 150, 1.2, cl, op(n ? .3 : .6)), an('drift', 40, 90));
    o += G(cloud(320, 90, 1, cl, op(n ? .3 : .55)), an('drift', 10, 70));
    /* lointain : deux rangées de silhouettes pâles, basses au centre */
    var far1 = n ? '#1c5a50' : '#c3e8d5', far2 = n ? '#174a46' : '#a6d8c7';
    o += P(skyline(K, 446, 12, 22, 92, 1.5, 12, 15), far1);
    /* tour de refroidissement + panache */
    o += P('M106 450q8-30 4-54h26q-4 24 4 54z', far2) + E(123, 396, 13, 2.6, lite(far2, .25));
    o += G(C(120, 384, 9, n ? '#3c9a7e' : '#f4fff0') + C(111, 370, 12, n ? '#3c9a7e' : '#f4fff0') + C(98, 352, 15, n ? '#3c9a7e' : '#f4fff0') + C(82, 338, 12, n ? '#3c9a7e' : '#f4fff0'), op(n ? .5 : .8) + ' ' + an('bob', 0, 7));
    o += P(skyline(K, 450, 8, 18, 104, 1.25, 14, 16), far2);
    if (n) { d = ''; for (i = 0; i < 30; i++) { x = r() * 400; d += 'M' + n1(x) + ' ' + n1(445 - r() * (6 + valley(x, 90, 1.3))) + 'v2.4'; } o += '<path d="' + d + '" fill="none" stroke="#ffe9a6" stroke-width="2" opacity=".75"/>'; }
    /* plan moyen : petits immeubles sur les côtés (les plus utiles restent dans x 36–364) */
    var pal = ['#6fb3a6', '#5fa3a2', '#7cc0ac', '#69adb2', '#5a9b95'], B = [[-12, 44, 286], [30, 30, 334], [58, 32, 366], [88, 22, 404], [290, 22, 408], [310, 32, 362], [340, 30, 322], [368, 44, 278]], b, col;
    for (i = 0; i < B.length; i++) {
      b = B[i]; col = t(pal[i % pal.length]);
      o += bld(K, b[0], b[1], b[2], 454, K.lg('b' + i, [[0, col], [1, mix(col, n ? '#1f6a58' : '#d6f0de', .45)]]), {
        side: dark(col, .1), cap: lite(col, n ? .12 : .3), p1: n ? .34 : .3, p2: n ? .1 : 0,
        w0: n ? dark(col, .32) : lite(col, .5), w1: n ? '#ffe9a6' : dark(col, .12), w2: pl
      });
    }
    /* détails de toit : antennes, citerne, édicule */
    o += R(40, 312, 1.6, 22, t('#4d8f8a')) + C(40.8, 311, 2.6, '#ff6b6b', an('glow', 0, 2.2));
    o += R(358, 300, 1.6, 22, t('#4d8f8a')) + C(358.8, 299, 2.6, pl, an('glow', 1.1, 2.2));
    o += R(316, 351, 10, 9, t('#4f8f8c'), 'rx="2"') + R(318, 348, 6, 3, t('#7cc0ac'), 'rx="1.5"');
    o += R(63, 358, 8, 6, t('#4f8f8c'), 'rx="1"') + R(76, 354, 3, 10, t('#4f8f8c'));
    /* sol : esplanade claire puis avenue miniature */
    o += R(0, 440, 400, 160, K.lg('gr', n ? [[0, '#1f4f4a'], [.42, '#183f40'], [1, '#123035']] : [[0, '#e3f1e2'], [.42, '#cfe6d6'], [1, '#a8ccbc']]));
    o += K.stage(n ? '#3f9a78' : '#fbfff0', n ? .45 : .9);
    var tc = t('#63c279'), th = t('#b4f0b0'), tk = t('#6d7f68');
    var T = [[14, 452, 8], [44, 449, 6], [108, 448, 5], [128, 447, 4], [276, 447, 4], [296, 448, 5], [356, 449, 6], [388, 452, 8]];
    for (i = 0; i < T.length; i++) o += tree(T[i][0], T[i][1], T[i][2], tc, th, tk);
    /* réverbères */
    for (i = 0; i < 4; i++) { x = [62, 146, 254, 338][i]; o += R(x, 490, 1.6, 16, t('#7c9390')) + C(x + .8, 489, 2.6, n ? '#fff3b0' : t('#f4fbea')) + (n ? C(x + .8, 489, 13, K.halo('#fff3b0'), op(.6)) : ''); }
    o += R(0, 506, 400, 3.5, t('#f1f7ea', '#3d6d68')) + R(0, 509, 400, 40, K.lg('rd', n ? [[0, '#22383f'], [1, '#1b2f37']] : [[0, '#88a3a0'], [1, '#7a9694']])) + R(0, 549, 400, 3.5, t('#eef5e6', '#3d6d68'));
    o += '<path d="M6 529H400" fill="none" stroke="' + t('#f3f7e3', '#6d9a94') + '" stroke-width="3" stroke-dasharray="17 17"/>';
    o += car(46, 511, t('#ff8f7a', '#a8504f'), n) + car(226, 512, t('#ffd76a', '#a88a48'), n) + '<g transform="translate(720 0) scale(-1 1)">' + car(380, 532, t('#7fd6f2', '#3f8aa8'), n) + car(590, 533, t('#f3f7f2', '#7f9a9c'), n) + '</g>';
    /* premier plan : toits miniatures dans les coins */
    o += R(0, 552.5, 400, 48, K.lg('fg', n ? [[0, '#174045'], [1, '#12333a']] : [[0, '#9cc7b4'], [1, '#86b5a3']]));
    var F = [[-6, 60, 562, '#3f8a84'], [50, 44, 578, '#4d9a8c'], [306, 44, 576, '#4d9a8c'], [346, 62, 560, '#3a8480']];
    for (i = 0; i < F.length; i++) {
      col = t(F[i][3]);
      o += bld(K, F[i][0], F[i][1], F[i][2], 604, col, { side: dark(col, .12), cap: lite(col, n ? .12 : .3), p1: n ? .4 : .3, p2: n ? .12 : 0, w0: n ? dark(col, .3) : lite(col, .45), w1: n ? '#ffe9a6' : dark(col, .15), w2: pl, gx: 9, gy: 11, cw: 5, ch: 6 });
    }
    o += R(60, 569, 12, 9, t('#2f7672'), 'rx="2"') + R(352, 548, 2.6, 12, t('#2f7672')) + C(353.3, 547, 3, n ? '#ff6b6b' : t('#ff9f8f'));
    for (i = 0; i < 4; i++) { x = [106, 124, 280, 296][i]; o += tree(x, 602, 9 + (i % 2) * 3, t('#4fae6c'), t('#9be6a0'), tk); }
    return o;
  };

  /* ================================================================== 2. PAYS BONBON */
  function domePath(cx, base, rx, ry) { return 'M' + n1(cx - rx) + ' ' + base + 'A' + rx + ' ' + ry + ' 0 0 1 ' + n1(cx + rx) + ' ' + base + 'Z'; }
  /* nappage : calotte du dôme avec des coulures */
  function icing(K, cx, base, rx, ry, fill) {
    var pts = [], a, k, i = 0;
    for (a = 158; a >= 22; a -= 8) pts.push([cx + Math.cos(a * Math.PI / 180) * (rx + 1), base - Math.sin(a * Math.PI / 180) * (ry + 1)]);
    for (a = 22; a <= 158; a += 8) { k = (i++ % 2) ? .86 : .68 + K.r() * .08; pts.push([cx + Math.cos(a * Math.PI / 180) * rx * (k + .08), base - Math.sin(a * Math.PI / 180) * ry * k]); }
    pts.push(pts[0]);
    return P(ridge(pts) + 'Z', fill);
  }
  function lolli(K, x, y, r, base, col) {
    var d = '', a, rr, i, w = K.t('#ffffff');
    for (i = 0; i <= 44; i++) { a = i / 44 * Math.PI * 5.2; rr = r * .9 * i / 44; d += (i ? 'L' : 'M') + n1(x + Math.cos(a) * rr) + ' ' + n1(y + Math.sin(a) * rr); }
    return R(x - r * .08, y, r * .16, base - y, K.t('#fff8ee'), 'rx="' + n1(r * .08) + '"') + R(x + r * .02, y, r * .06, base - y, K.t('#e9d6cf')) + C(x, y, r, col) +
      S(d, w, n1(r * .2), op(.8)) + C(x, y, r, 'none', 'stroke="' + dark(col, .12) + '" stroke-width="1.2" opacity=".5"') +
      E(x - r * .36, y - r * .46, r * .3, r * .15, w, op(.6) + ' transform="rotate(-35 ' + n1(x - r * .36) + ' ' + n1(y - r * .46) + ')"');
  }
  function gumdrop(K, name, cx, base, rx, ry, col) {
    var g = K.lg(name, [[0, lite(col, .3)], [1, dark(col, .08)]]), o = P(domePath(cx, base, rx, ry), g), i, a, d;
    for (i = 0; i < 14; i++) { a = (20 + K.r() * 140) * Math.PI / 180; d = .3 + K.r() * .6; o += C(cx + Math.cos(a) * rx * d, base - Math.sin(a) * ry * d, .9 + K.r() * .7, K.t('#ffffff'), op(.7)); }
    return o + E(cx - rx * .35, base - ry * .7, rx * .22, ry * .1, K.t('#ffffff'), op(.5) + ' transform="rotate(-28 ' + n1(cx - rx * .35) + ' ' + n1(base - ry * .7) + ')"');
  }
  SC.candy = function (K) {
    K.tone(.56, .44, .78, '#2a1a5e', .12, .05);
    var n = K.n, t = K.t, r = K.r, o = '', i, x, y, a, cl, d, w = t('#ffffff', '#a99be6'), sp, SPD = ['', '', '', '', '', ''];
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#150d3d'], [.45, '#31195f'], [.8, '#5d3384'], [1, '#93578f']] : [[0, '#b7dcff'], [.45, '#dfe3ff'], [.8, '#ffe8f2'], [1, '#fff6dc']]));
    if (n) o += stars(K, 50, 400, '#fff3d6');
    o += n ? moon(K, 70, 292, 15, '#fff1d0') : sun(K, 70, 296, 18, '#fffdf0', '#fff3c4');
    /* barbe à papa */
    cl = n ? ['#6f4a98', '#5a4a9a', '#7a4f95'] : ['#ffffff', '#e9f6ff', '#ffe6f1'];
    o += G(cloud(310, 296, 1, cl[0], op(n ? .55 : .9)), an('drift'));
    o += G(cloud(120, 250, .7, cl[1], op(n ? .45 : .8)), an('drift', 25, 80));
    o += G(cloud(250, 130, 1.3, cl[2], op(n ? .4 : .75)), an('drift', 12, 95));
    o += G(cloud(80, 70, 1, cl[0], op(n ? .35 : .7)), an('drift', 40, 70));
    /* collines de guimauve : lointain pâle */
    o += P(domePath(200, 476, 190, 78), t('#f3ecff', '#6a4696'));
    o += P(domePath(52, 470, 128, 142), K.lg('d1', n ? [[0, '#3a6a9a'], [1, '#4a4f9c']] : [[0, '#dcf5ea'], [1, '#c6ecdf']])) + icing(K, 52, 470, 128, 142, w);
    o += P(domePath(356, 470, 120, 128), K.lg('d2', n ? [[0, '#5a45a8'], [1, '#5a3f96']] : [[0, '#ebe0ff'], [1, '#d8cafa']])) + icing(K, 356, 470, 120, 128, w);
    o += P(domePath(170, 470, 96, 44), t('#fff3e4', '#7a4f9c')) + P(domePath(262, 472, 84, 36), t('#ffeedd', '#74499a'));
    /* sucettes et sucres d'orge */
    o += G(lolli(K, 46, 318, 27, 462, t('#8fe3cf', '#3fa8a8')), an('sway', 0, 9));
    o += lolli(K, 92, 392, 15, 458, t('#c7b3ff', '#8a6fe0'));
    o += G(lolli(K, 354, 310, 25, 462, t('#ffc59c', '#d9828a')), an('sway', 3, 10));
    o += lolli(K, 310, 396, 14, 458, t('#9fd3ff', '#5a8fe0'));
    for (i = 0; i < 2; i++) {
      x = i ? 384 : 14; y = i ? 388 : 398; d = 'M' + x + ' 460V' + y + 'q0-12 ' + (i ? -11 : 11) + '-12t' + (i ? -11 : 11) + ' 11';
      o += S(d, w, 6.5) + S(d, t('#ff9db8', '#c85f9a'), 6.5, 'stroke-dasharray="6 8" stroke-linecap="butt"');
    }
    /* sol : crème vanille, bord festonné, vermicelles */
    d = 'M-10 452';
    for (x = -10; x < 410; x += 28) d += 'q14-' + n1(10 + valley(x + 14, 6)) + ' 28 0';
    o += P(d + 'V600H-10Z', K.lg('gr', n ? [[0, '#7b5aa8'], [.3, '#644690'], [1, '#49317a']] : [[0, '#fffaf0'], [.3, '#fff0dc'], [1, '#ffd9d2']]));
    o += K.stage(n ? '#9a78c8' : '#ffffff', n ? .5 : .85);
    sp = ['#8fe3cf', '#c7b3ff', '#ffc59c', '#9fd3ff', '#ffe58a', '#ff9db8'];
    for (i = 0; i < 54; i++) {
      x = r() * 400; y = 468 + r() * 128; a = r() * 6.3;
      if (Math.abs(x - 200) < 100 && y < 502) y += 40;
      SPD[i % 6] += 'M' + n1(x) + ' ' + n1(y) + 'l' + n1(Math.cos(a) * 5.5) + ' ' + n1(Math.sin(a) * 5.5);
    }
    for (i = 0; i < 6; i++) o += S(SPD[i], t(sp[i]), 3, n ? op(.8) : '');
    /* premier plan : gommes sucrées */
    o += gumdrop(K, 'g1', 30, 604, 50, 62, t('#5fd6bb', '#2f9aa0')) + gumdrop(K, 'g2', 92, 606, 28, 34, t('#b79cf5', '#7a5fd6'));
    o += gumdrop(K, 'g3', 372, 604, 52, 66, t('#ffab7a', '#c8607a')) + gumdrop(K, 'g4', 310, 606, 27, 32, t('#7fc2f5', '#4a7fd6'));
    o += C(144, 588, 9, t('#ff8fb0', '#c05a9a')) + C(141, 585, 3, w, op(.6)) + C(258, 592, 7, t('#ffe58a', '#c8a86a')) + C(256, 590, 2.4, w, op(.6));
    return o;
  };

  /* ================================================================== 3. TOITS NÉON */
  function neonSign(K, x, y, w, h, col, kind, blink) {
    var o = R(x - 3, y - 3, w + 6, h + 6, col, 'rx="6" opacity=".22"') + R(x, y, w, h, '#170b3a', 'rx="3"') + R(x, y, w, h, 'none', 'rx="3" stroke="' + col + '" stroke-width="2"'), i, cy, g = '';
    if (kind === 'v') { /* glyphes abstraits empilés */
      for (i = 0; i < Math.floor((h - 6) / 11); i++) {
        cy = y + 9 + i * 11;
        g += i % 3 === 0 ? C(x + w / 2, cy, 2.8, 'none', 'stroke="' + lite(col, .5) + '" stroke-width="1.6"') : i % 3 === 1 ? R(x + 3.5, cy - 1, w - 7, 2, lite(col, .5), 'rx="1"') + R(x + w / 2 - 1, cy - 3.5, 2, 7, lite(col, .5), 'rx="1"') : P('M' + n1(x + 3.5) + ' ' + n1(cy + 3) + 'l' + n1((w - 7) / 2) + '-6l' + n1((w - 7) / 2) + ' 6z', 'none', 'stroke="' + lite(col, .5) + '" stroke-width="1.5" stroke-linejoin="round"');
      }
    } else { /* zigzag horizontal */
      g = S('M' + (x + 5) + ' ' + (y + h - 5) + 'l' + n1((w - 10) / 4) + ' -' + (h - 10) + 'l' + n1((w - 10) / 4) + ' ' + (h - 10) + 'l' + n1((w - 10) / 4) + ' -' + (h - 10) + 'l' + n1((w - 10) / 4) + ' ' + (h - 10), lite(col, .5), 1.8);
    }
    return G(o + g, blink ? an('blink', blink, 5 + blink) : '');
  }
  SC.neon = function (K) {
    var n = K.n, r = K.r, o = '', i, x, d, col, mag = '#ff2bd6', cy = '#20e3ff', yel = '#ffe66b';
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#07031c'], [.4, '#1d0b4a'], [.72, '#5a1a80'], [1, '#d9469c']] : [[0, '#3f3aa8'], [.38, '#8d5ccc'], [.7, '#f78bb6'], [1, '#ffd2a2']]));
    o += stars(K, n ? 64 : 24, n ? 380 : 230);
    /* soleil synthwave : disque rayé, bas caché par les toits */
    var sy = n ? 428 : 410, bands = '', BD = [[-112, 98], [-9, 12], [9, 10], [26, 8], [42, 6], [57, 4], [71, 2.5]];
    for (i = 0; i < BD.length; i++) bands += R(80, sy + BD[i][0], 240, BD[i][1], '#fff');
    K.defs += '<clipPath id="' + K.u + 'sc">' + bands + '</clipPath>';
    o += C(200, sy, 200, K.halo(n ? '#ff4fb0' : '#ffd8b0'), op(n ? .5 : .7));
    o += C(200, sy, 102, K.lg('sun', n ? [[0, '#ffb86b'], [.45, '#ff5fa8'], [1, '#a82bd6']] : [[0, '#fff0b6'], [.5, '#ffb48a'], [1, '#ff6fb8']]), 'clip-path="url(#' + K.u + 'sc)" opacity="' + (n ? .8 : .9) + '"');
    /* lointain */
    var far1 = n ? '#4a2284' : '#c084c9', far2 = n ? '#301663' : '#9163c2';
    o += P(skyline(K, 440, 10, 20, 96, 1.5, 11, 14), far1);
    o += P(skyline(K, 444, 6, 16, 110, 1.25, 13, 16), far2);
    d = ['', '', ''];
    for (i = 0; i < 36; i++) { x = r() * 400; d[i % 3] += 'M' + n1(x) + ' ' + n1(440 - r() * (6 + valley(x, 92, 1.3))) + 'v2.4'; }
    for (i = 0; i < 3; i++) o += '<path d="' + d[i] + '" fill="none" stroke="' + [yel, cy, mag][i] + '" stroke-width="2" opacity="' + (n ? .8 : .55) + '"/>';
    /* plan moyen : immeubles et enseignes */
    var pal = n ? ['#1f1150', '#27155e', '#1a0e47'] : ['#4b3b9c', '#5a45ab', '#43358f'], B = [[-12, 46, 262], [32, 30, 326], [60, 32, 362], [308, 32, 356], [338, 30, 314], [366, 46, 256]], b;
    for (i = 0; i < B.length; i++) {
      b = B[i]; col = pal[i % 3];
      o += bld(K, b[0], b[1], b[2], 446, K.lg('b' + i, [[0, col], [1, mix(col, n ? '#5a1a80' : '#b877c4', .4)]]), { side: dark(col, .16), cap: lite(col, .16), p1: n ? .3 : .22, p2: .14, w0: dark(col, .22), w1: yel, w2: i % 2 ? cy : mag, gy: 10 });
    }
    o += R(46, 304, 1.6, 22, pal[0]) + C(46.8, 303, 2.8, '#ff5f6b', an('glow', 0, 2)) + R(352, 292, 1.6, 22, pal[0]) + C(352.8, 291, 2.8, cy, an('glow', 1, 2));
    /* château d'eau */
    o += R(64, 342, 2, 20, pal[2]) + R(82, 342, 2, 20, pal[2]) + R(60, 324, 28, 20, pal[1], 'rx="3"') + P('M58 325l16-9l16 9z', pal[0]);
    o += neonSign(K, 38, 342, 14, 62, mag, 'v', 1.5) + neonSign(K, 346, 330, 14, 74, cy, 'v', 0) + neonSign(K, 306, 338, 30, 15, yel, 'h', 2.6) + neonSign(K, 4, 300, 26, 15, cy, 'h', 0);
    /* toit : acrotère, dalle, reflets */
    o += R(0, 432, 400, 16, K.lg('pa', [[0, n ? '#4a3396' : '#8c6fd0'], [1, n ? '#2c1a66' : '#6650b4']])) + R(0, 432, 400, 2.5, n ? '#7a5fd0' : '#c3a8ef');
    for (x = 20; x < 400; x += 60) o += R(x, 434.5, 1.5, 13.5, n ? '#22145a' : '#5a46a8', op(.6));
    o += R(0, 448, 400, 152, K.lg('gr', n ? [[0, '#2c1e66'], [.5, '#1f1450'], [1, '#150c3a']] : [[0, '#6a57b6'], [.5, '#55449e'], [1, '#3f3182']]));
    o += K.stage(n ? '#5a40b8' : '#9a86e0', .75);
    o += E(66, 504, 90, 16, K.halo(mag), op(n ? .3 : .22)) + E(338, 500, 86, 15, K.halo(cy), op(n ? .3 : .22)) + E(206, 566, 150, 18, K.halo(n ? '#ff5fa8' : '#ffd2a2'), op(.2));
    for (i = 0; i < 5; i++) o += R(0, 470 + i * i * 7 + i * 12, 400, 1.2, n ? '#3a2880' : '#7a66c4', op(.5));
    /* équipements de toit */
    col = n ? '#3b2a86' : '#7663c2';
    o += R(36, 448, 48, 28, K.lg('ac', [[0, lite(col, .12)], [1, dark(col, .12)]]), 'rx="4"') + C(53, 462, 9.5, dark(col, .3)) + C(53, 462, 6.5, 'none', 'stroke="' + lite(col, .25) + '" stroke-width="1.5"') + C(53, 462, 2, lite(col, .3)) + S('M69 454h10M69 459h10M69 464h10', dark(col, .3), 2);
    o += S('M330 480V458q0-8 8-8h16', col, 10, 'stroke-linecap="butt"') + R(352, 443, 8, 14, lite(col, .15), 'rx="2"') + R(324, 476, 12, 5, lite(col, .15), 'rx="2"');
    o += R(102, 420, 2, 28, dark(col, .1)) + S('M94 424q9 8 18 0', lite(col, .2), 2.5) + C(103, 419, 2, mag, an('glow', .5, 3));
    /* premier plan : verrière lumineuse, néon rond, câbles */
    col = n ? '#170e40' : '#372a78';
    o += C(322, 566, 64, K.halo(cy), op(.26));
    o += P('M272 604l14-42h72l16 32v10z', col) + P('M284 600l8-30h60l10 22v8z', K.lg('vr', [[0, cy, .85], [1, mix(cy, '#ffffff', .4), .5]])) + R(320, 570, 2.5, 32, col) + P('M288 584h72l1 2.5h-74z', col);
    o += R(64, 552, 5, 52, n ? '#120a34' : '#2f2468') + C(66, 542, 44, K.halo(mag), op(.3)) + G(C(66, 542, 24, 'none', 'stroke="' + mag + '" stroke-width="3.5"') + C(66, 542, 24, 'none', 'stroke="#ffd0f6" stroke-width="1.2"') + S('M55 542h22M66 531v22', lite(mag, .4), 3), an('blink', 3, 7));
    o += S('M-4 590q70 14 120 6t90 6', n ? '#0f082c' : '#2a205e', 3) + S('M96 604q30-12 70-8', n ? '#0f082c' : '#2a205e', 2.4);
    return o;
  };

  /* ================================================================== 4. VOLCAN */
  SC.volcano = function (K) {
    K.tone(.5, .3, .36, '#2a0f18', .14, .1);
    var n = K.n, t = K.t, r = K.r, o = '', i, x, y, lava = K.ui.accent || '#ff6a1f', hot = '#ffd23f', cl, d;
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#0b0612'], [.45, '#2a0e1c'], [.78, '#6b1b18'], [1, '#c2461c']] : [[0, '#5b3a5e'], [.4, '#b4566b'], [.7, '#f38c56'], [.9, '#ffc67a'], [1, '#ffe2a4']]));
    if (n) o += stars(K, 32, 300, '#ffd9c0');
    o += n ? moon(K, 318, 296, 14, '#ffd2b0') : sun(K, 318, 300, 16, '#fff3cf', '#ffe6a8');
    cl = n ? '#3a1820' : '#8a5568';
    o += G(cloud(280, 240, 1.1, cl, op(.4)), an('drift', 0, 80)) + G(cloud(210, 110, 1.6, cl, op(.4)), an('drift', 30, 100)) + G(cloud(330, 40, 1.2, cl, op(.35)), an('drift', 12, 90));
    /* lointain : crêtes pâles + petit volcan (la nuit, une lueur de braise détache le monstre) */
    if (n) o += E(200, 440, 220, 130, K.halo('#ff7a3c'), op(.4));
    o += P(ridge(hillPts(K, 438, 66, 24, 34, 1.4), 600), n ? '#5a1f22' : '#efaa80');
    var far2 = n ? '#48181f' : '#dc8c6e';
    o += C(326, 364, 22, K.halo(lava), an('glow', 1, 4));
    o += P('M250 458L310 376q6-8 16-6h12q9 0 14 8L418 458Z', K.lg('v2', [[0, far2], [1, n ? '#5a1f22' : '#eba27c']])) + E(326, 371.5, 11, 2.6, hot);
    o += S('M322 373q-5 18 3 34t-3 44', lava, 3) + S('M322 373q-5 18 3 34', hot, 1.2);
    /* grand volcan, panache, coulées */
    var sm = n ? '#2c1420' : '#7a5166', v = '';
    v += G(C(60, 284, 10, sm) + C(53, 266, 14, sm) + C(44, 242, 18, sm) + C(30, 214, 22, sm) + C(14, 180, 26, sm) + C(-4, 140, 30, sm), op(.62) + ' ' + an('bob', 0, 9));
    v += C(59, 288, 40, K.halo(lava), an('glow', 0, 3.4));
    v += P('M-80 458L28 304q6-9 16-8l30-2q10 0 16 9l24 46q26 60 70 109Z', K.lg('vol', [[0, t('#6d3f4e', '#3a1722')], [.55, t('#93545a', '#4f1d24')], [1, n ? '#5a2226' : '#d48e6e']]));
    v += P('M90 303l24 46q26 60 70 109h-40q-30-60-44-120z', '#ffffff', op(n ? .04 : .09));
    v += E(59, 297, 21, 4.2, hot) + E(59, 297.6, 14, 2.4, '#fff3b0');
    d = 'M50 299q-6 34-22 56t-8 58q4 22-10 44';
    v += S(d, lava, 7) + S(d, hot, 2.4, an('glow', .6, 2.6));
    d = 'M70 299q10 30 4 52t14 50q10 24-2 56';
    v += S(d, lava, 5) + S(d, hot, 1.8, an('glow', 1.6, 3));
    o += G(v, 'transform="translate(18 0)"');
    /* orgues basaltiques à droite */
    var bs = K.lg('bs', [[0, t('#6b4352', '#33151f')], [1, t('#8a5458', '#4a1c22')]]);
    o += P('M336 458v-30l8-7l8 7v-18l9-7l9 7v-26l10-8l10 8v14l10-6v66z', bs) + P('M352 428l9-7v37h-9zM380 392l10-8v74h-10z', '#000', op(.13));
    /* sol de cendre */
    o += P('M-10 448q105-9 210-4t210 4V600H-10Z', K.lg('gr', n ? [[0, '#6a2f2e'], [.4, '#4f2229'], [1, '#2e131d']] : [[0, '#dba07e'], [.4, '#bb7d69'], [1, '#8b5257']]));
    o += K.stage(n ? '#a8503c' : '#ffe0b8', n ? .5 : .8);
    /* fissures, cailloux */
    o += S('M286 476l14 9l-6 12l18 9l-4 12M118 504l-12 10l8 12l-14 10M330 540l-12 8l6 10', lava, 2.2, an('glow', 1, 3.2));
    for (i = 0; i < 10; i++) { x = 110 + r() * 190; y = 522 + r() * 70; o += E(x, y, 3 + r() * 4, 1.6 + r() * 1.6, t('#8b5257', '#241018'), op(.6)); }
    /* rivière de lave qui serpente vers le premier plan */
    var crust = t('#4f2c38', '#1d0c14');
    var LV = [[66, 455, 2.5], [84, 466, 4], [86, 482, 6], [70, 498, 8], [54, 516, 10], [56, 538, 12.5], [76, 558, 15.5], [90, 582, 19], [84, 612, 23]];
    o += C(66, 536, 84, K.halo(lava), op(n ? .5 : .26));
    o += P(ribbon(LV, 1), K.lg('lv', [[0, lava], [1, '#f0481c']]), 'stroke="' + crust + '" stroke-width="3.2" stroke-linejoin="round"') + P(ribbon(LV, .5), hot, an('glow', 0, 2.8)) + P(ribbon(LV, .16), '#fff3b0', op(.7));
    o += E(352, 596, 54, 20, lava, 'stroke="' + crust + '" stroke-width="5"') + E(354, 596, 36, 11, hot, an('glow', 1.4, 3));
    /* premier plan : blocs de basalte */
    var rk = K.lg('rk', [[0, t('#6b4350', '#3a1822')], [1, t('#432733', '#1d0b12')]]);
    o += P('M150 604l-10-26l-24-12l-22 8l-10 30z', rk) + P('M116 566l24 12l-6 2l-20-8z', lava, op(.75));
    o += P('M236 604l8-22l22-10l18 10l8 22z', rk) + P('M244 582l22-10l-16 12z', '#ffffff', op(.12));
    o += P('M-6 604v-40l16-10l16 12l6 38z', rk);
    /* braises */
    for (i = 0; i < 9; i++) {
      x = i % 2 ? 290 + r() * 80 : 30 + r() * 80; y = 420 + r() * 150;
      o += C(x, y, 1.1 + r() * 1.5, i % 3 ? hot : lava, an('rise', r() * 8, 6 + r() * 5));
    }
    return o;
  };

  /* ================================================================== 5. FOND MARIN */
  function coralRec(K, x, y, len, ang, depth, acc) {
    var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    acc[depth] = (acc[depth] || '') + 'M' + n1(x) + ' ' + n1(y) + 'L' + n1(x2) + ' ' + n1(y2);
    if (depth < 3) {
      coralRec(K, x2, y2, len * .72, ang - .42 - K.r() * .25, depth + 1, acc);
      coralRec(K, x2, y2, len * .7, ang + .4 + K.r() * .25, depth + 1, acc);
    }
  }
  function coral(K, x, y, len, w, col) {
    var acc = [], o = '', i;
    coralRec(K, x, y, len, -Math.PI / 2, 0, acc);
    for (i = 0; i < acc.length; i++) o += S(acc[i], i > 1 ? lite(col, .16) : col, n1(w * Math.pow(.74, i)));
    return o;
  }
  function weed(x, y, h, col, w, delay) {
    var k = n1(h / 4);
    return G(S('M' + x + ' ' + y + 'q-' + n1(w * 1.7) + ' -' + k + ' 0 -' + n1(k * 2) + 't0 -' + n1(k * 2), col, w), an('sway', delay, 6 + (delay % 3)));
  }
  function fish(x, y, s, col, flip) { var k = flip ? -1 : 1; return E(x, y, 5 * s, 2.3 * s, col) + P('M' + n1(x - 4 * s * k) + ' ' + n1(y) + 'l' + n1(-4.5 * s * k) + ' ' + n1(-2.8 * s) + 'v' + n1(5.6 * s) + 'z', col); }
  SC.sea = function (K) {
    K.tone(.3, .42, .74, '#0a1c4a', .14, .1);
    var n = K.n, c = K.c, t = K.t, r = K.r, o = '', i, x, y, g = '', cor = mix(plateOf(c), '#ffd9cf', .25), glowDot = c.plateGlow || '#ffd2bd';
    o += R(0, 0, 400, 600, K.lg('sky', n ? [[0, '#0c3264'], [.45, '#0a2452'], [1, '#07163a']] : [[0, '#d6f7ff'], [.35, '#a6e3f7'], [.75, '#7bcbee'], [1, '#66b9e6']]));
    /* rayons de lumière */
    var ray = K.lg('ray', [[0, '#ffffff', n ? .14 : .5], [.7, '#ffffff', n ? .04 : .15], [1, '#ffffff', 0]]), RY = [[30, 34, -30, 70], [112, 26, 76, 58], [196, 30, 186, 70], [270, 22, 300, 56], [338, 32, 392, 76]];
    for (i = 0; i < RY.length; i++) g += P('M' + RY[i][0] + ' -10h' + RY[i][1] + 'L' + (RY[i][2] + RY[i][3]) + ' 478H' + RY[i][2] + 'Z', ray);
    o += G(g, an('glow', 0, 8)); g = '';
    /* lointain : récifs pâles, banc de poissons */
    o += P(ridge(hillPts(K, 440, 84, 30, 30, 1.6), 600), n ? '#12407a' : '#93d5f0');
    for (i = 0; i < 7; i++) g += fish(58 + (i % 4) * 17 + (i > 3 ? 8 : 0), 300 + (i > 3 ? 14 : 0) + (i % 2) * 5, 1, n ? '#3f78b8' : '#f2fcff');
    for (i = 0; i < 5; i++) g += fish(306 + (i % 3) * 16, 262 + (i > 2 ? 12 : 0) + (i % 2) * 4, .8, n ? '#3f78b8' : '#f2fcff', true);
    o += G(G(g, op(.75)), an('drift', 5, 46));
    o += P(ridge(hillPts(K, 448, 108, 22, 26, 1.2), 600), n ? '#0f3468' : '#7cc5e8');
    /* plan moyen : rochers, coraux, algues */
    o += weed(20, 456, 124, t('#58cfa6', '#1f8f8a'), 7, 0) + weed(380, 456, 132, t('#58cfa6', '#1f8f8a'), 7, 2);
    var rk = n ? [[0, '#2a4f8e'], [1, '#1c3a78']] : [[0, '#7fa9d6'], [1, '#6690c6']];
    o += P('M-10 462V396q12-26 40-22t38 30q20-8 34 10t10 48z', K.lg('r1', rk)) + P('M-10 396q12-26 40-22t38 30q-30-14-50-4t-28 14z', '#ffffff', op(n ? .06 : .22));
    o += P('M410 462V388q-16-24-42-16t-32 32q-22-4-34 14t-6 44z', K.lg('r2', rk)) + P('M410 388q-16-24-42-16t-32 32q26-18 46-12t28 14z', '#ffffff', op(n ? .06 : .22));
    o += coral(K, 44, 392, 26, 7.5, t(cor, '#b8607a')) + coral(K, 362, 386, 28, 7.5, t('#ffa6c4', '#a85aa8'));
    /* corail en tubes */
    for (i = 0; i < 5; i++) { x = 68 + i * 9.5; y = [418, 404, 396, 410, 424][i]; o += R(x, y, 8.5, 454 - y, t('#b9a4ee', '#6a5ac8'), 'rx="4.2"') + E(x + 4.2, y + 2.8, 2.8, 1.7, t('#7c66c4', '#3a2f8a')); }
    /* corail cerveau + éventails */
    o += P(domePath(112, 458, 16, 14), t('#ffb0c8', '#a85a9a')) + S('M101 452q4-6 8 0t8 0M105 446q4-5 9 0', t('#ff8fb0', '#c87ab8'), 1.6);
    o += P('M322 458q-22-40 0-62q22 22 0 62z', t('#ffbe8a', '#b8707a')) + P('M306 458q-26-26-14-50q24 14 14 50z', t('#ffa970', '#a8607a')) + S('M322 456v-52M312 452q-10-16-14-30', t('#ffe0c0', '#d89aa8'), 1.2, op(.7));
    o += weed(34, 458, 84, t('#3fb393', '#1a7a80'), 6, 1) + weed(368, 458, 88, t('#3fb393', '#1a7a80'), 6, 3.5) + weed(126, 458, 34, t('#58cfa6', '#1f8f8a'), 4.5, 2) + weed(290, 458, 38, t('#58cfa6', '#1f8f8a'), 4.5, 4);
    /* sable */
    o += P(ridge([[-24, 454], [40, 446], [110, 452], [200, 448], [290, 453], [360, 446], [424, 454]], 600), K.lg('gr', n ? [[0, '#3a5a94'], [.35, '#2f4c86'], [1, '#1f3568']] : [[0, '#fff7dc'], [.35, '#f9e8bc'], [1, '#e8cc94']]));
    o += K.stage(n ? '#5a80c0' : '#ffffff', n ? .4 : .8);
    o += S('M24 506q36-8 72 0t72 0M214 532q40-8 80 0t80 0M70 566q44-8 88 0M250 584q36-7 72 0', t('#fffbe8', '#4a6aa8'), 2.2, op(.7));
    /* premier plan : étoile de mer, coquillage, grand corail, algues */
    var sf = t('#ff9a7a', '#b0607a'), sd = t('#ffd0bd', '#e09aa8');
    o += poly(starPts(104, 568, 17, 7.5, 5, .3), sf, 'stroke="' + sf + '" stroke-width="5" stroke-linejoin="round"') + C(104, 568, 2.4, sd) + C(104, 558, 1.5, sd) + C(113, 565, 1.5, sd) + C(95, 565, 1.5, sd) + C(110, 576, 1.5, sd) + C(98, 576, 1.5, sd);
    o += P('M276 588q-17-2-17-15a17 15 0 0 1 34 0q0 13-17 15z', t('#fff1f4', '#8f8fd0'), 'stroke="' + t('#ffb9cc', '#6a6ab8') + '" stroke-width="1.6"') + S('M276 586v-26M269 585l-6-21M283 585l6-21', t('#ffb9cc', '#6a6ab8'), 1.4);
    for (i = 0; i < 8; i++) { x = 130 + r() * 150; y = 520 + r() * 70; o += E(x, y, 2.5 + r() * 3, 1.4 + r() * 1.4, t('#dcbf88', '#1c2f60'), op(.7)); }
    o += coral(K, 40, 612, 38, 10.5, t(mix(plateOf(c), '#ff6f7a', .35), '#a04a78')) + coral(K, 74, 612, 22, 6.5, t('#c79cf2', '#6f5ad0'));
    o += weed(366, 606, 100, t('#2fa58a', '#12707a'), 9, 1.5) + weed(350, 606, 62, t('#49c79c', '#1f8f8a'), 7, 3) + weed(384, 606, 74, t('#49c79c', '#1f8f8a'), 7, .5);
    o += P(domePath(322, 606, 20, 22), t('#ffb0c8', '#a85a9a')) + S('M310 596q5-7 10 0t10 0M314 588q4-5 9 0', t('#ff8fb0', '#c87ab8'), 1.8);
    /* bulles */
    var BU = [[66, 430], [340, 440], [136, 452], [300, 418]];
    for (i = 0; i < 9; i++) {
      x = BU[i % 4][0] + (r() - .5) * 16; y = BU[i % 4][1] - r() * 40;
      o += C(x, y, 1.8 + r() * 3, '#ffffff', 'fill-opacity=".2" stroke="#ffffff" stroke-opacity=".85" stroke-width="1" ' + an('rise', r() * 9, 6 + r() * 5));
    }
    /* la nuit : plancton lumineux */
    if (n) for (i = 0; i < 16; i++) { x = i % 2 ? 290 + r() * 80 : 30 + r() * 80; o += C(x, 370 + r() * 210, 1.2 + r() * 1.4, i % 3 ? '#8ff5ff' : glowDot, i % 2 ? an('tw', r() * 4) : op(.7)); }
    return o;
  };

  /* ================================================================== 6. RÉTRO MEMPHIS */
  SC.retro = function (K) {
    K.tone(.74, .68, .94, '#262b6a', .1, 0);
    var n = K.n, t = K.t, r = K.r, o = '', i, x, y, k, a, d,
      ink = n ? '#aab2ff' : '#2f3478', red = t('#f0606a'), yel = t('#ffd447'), tur = t('#35c9bb'), pink = t('#ff9fc0'), lil = t('#c9b8ff'), pale = t('#fff6e6'),
      pal = [red, yel, tur, pink, lil, ink], LN = ['', '', '', '', '', ''], DT = ['', '', '', '', '', ''];
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#151941'], [1, '#2a2f6c']] : [[0, '#b5ebe2'], [1, '#daf6ee']]));
    if (n) o += stars(K, 34, 420);
    /* haut de l'affiche (visible sur grand écran) */
    o += C(292, 112, 44, 'none', 'stroke="' + lil + '" stroke-width="9"') + poly('70,150 110,84 150,150', 'none', 'stroke="' + red + '" stroke-width="6" stroke-linejoin="round"');
    o += S('M40 196q10-14 20 0t20 0t20 0t20 0', tur, 5.5) + P('M20 30a44 44 0 0 0 88 0z', pink) + R(196, 40, 9, 34, yel, 'rx="2"') + R(183.5, 52.5, 34, 9, yel, 'rx="2"');
    d = ''; for (y = 0; y < 4; y++) d += 'M222 ' + (172 + y * 15) + 'h60.1';
    o += S(d, ink, 6, 'stroke-dasharray="0 15" opacity=".8"');
    /* disque rayé + zigzags + grille de points */
    K.defs += '<clipPath id="' + K.u + 'cd"><circle cx="334" cy="280" r="30"/></clipPath>';
    d = ''; for (i = -4; i < 6; i++) d += 'M' + (282 + i * 14) + ' 318l70-80';
    o += G(C(334, 280, 30, n ? t('#ffd447') : '#ffe27a') + G(S(d, red, 5, 'stroke-linecap="butt"'), 'clip-path="url(#' + K.u + 'cd)"'), an('bob', 0, 5));
    o += G(S('M38 302l13-13l13 13l13-13l13 13', ink, 5), an('drift', 8, 9)) + G(S('M306 222l11 11l11-11l11 11l11-11l11 11', tur, 5), an('drift', 3, 11));
    d = ''; for (y = 0; y < 3; y++) d += 'M42 ' + (238 + y * 14) + 'h42.1';
    o += S(d, red, 5.6, 'stroke-dasharray="0 14" opacity=".85"');
    /* grandes formes des côtés */
    o += C(44, 448, 80, t('#ff9486')) + C(44, 448, 54, t('#ffd9a8')) + C(44, 448, 28, tur);
    o += R(316, 336, 70, 112, lil);
    d = ''; for (i = 1; i < 5; i++) d += 'M' + (316 + i * 14) + ' 336v112'; for (i = 1; i < 8; i++) d += 'M316 ' + (336 + i * 14) + 'h70';
    o += S(d, pale, 1.6, op(.75));
    o += poly('286,448 320,390 354,448', tur) + poly('320,390 354,448 337,448', '#000', op(.08)) + P('M350 336a36 36 0 0 1 36 36v-36z', pink);
    o += R(108, 418, 12, 30, yel, 'rx="6"') + R(92, 428, 10, 20, pink, 'rx="5"');
    /* confettis (aucun au centre) : traits, points, triangles, anneaux */
    for (i = 0; i < 84; i++) {
      x = r() * 400; y = 8 + r() * 430; k = r(); a = k * 6.3;
      if (x > 96 && x < 304 && y > 226) continue;
      if (i % 4 === 0) LN[i % 6] += 'M' + n1(x) + ' ' + n1(y) + 'l' + n1(Math.cos(a) * 7) + ' ' + n1(Math.sin(a) * 7);
      else if (i % 4 === 2) DT[i % 6] += 'M' + n1(x) + ' ' + n1(y) + 'h.01';
      else if (i % 4 === 1) o += poly(starPts(x, y, 4.5, 2.2, 3, a), pal[i % 6]);
      else o += C(x, y, 3.2, 'none', 'stroke="' + pal[i % 6] + '" stroke-width="1.8"');
    }
    /* sol terrazzo */
    o += R(0, 446, 400, 154, K.lg('gr', n ? [[0, '#444a9a'], [1, '#30357a']] : [[0, '#ffe6dc'], [1, '#ffc9c6']])) + R(0, 446, 400, 5, t('#ffb9b4', '#585eb4'), op(.6));
    o += K.stage(n ? '#6a70c8' : '#fffaf0', n ? .5 : .85);
    for (i = 0; i < 60; i++) {
      x = r() * 400; y = 462 + r() * 134; a = r() * 6.3;
      if (Math.abs(x - 200) < 120 && y < 506) continue;
      if (i % 3) LN[i % 6] += 'M' + n1(x) + ' ' + n1(y) + 'l' + n1(Math.cos(a) * 4.5) + ' ' + n1(Math.sin(a) * 4.5); else DT[i % 6] += 'M' + n1(x) + ' ' + n1(y) + 'h.01';
    }
    for (i = 0; i < 6; i++) o += S(LN[i], pal[i], 3.2, 'stroke-linecap="butt"') + S(DT[i], pal[i], 5);
    /* premier plan */
    o += C(0, 604, 86, red) + C(0, 604, 60, yel) + C(0, 604, 34, tur);
    o += poly('404,604 404,516 312,604', tur) + S('M290 580l12-12l12 12l12-12l12 12l12-12', ink, 5.5) + C(368, 580, 9, pale);
    o += R(104, 574, 46, 13, lil, 'rx="6.5" transform="rotate(-14 127 580)"') + C(262, 592, 8, 'none', 'stroke="' + pink + '" stroke-width="4"');
    return o;
  };

  /* ================================================================== 7. PRAIRIE ARC-EN-CIEL */
  function flower(x, y, r, col, mid) {
    var o = '', k;
    for (k = 0; k < 6; k++) o += E(x, y - r * .62, r * .34, r * .5, col, 'transform="rotate(' + k * 60 + ' ' + n1(x) + ' ' + n1(y) + ')"');
    return o + C(x, y, r * .36, mid);
  }
  SC.rainbow = function (K) {
    K.tone(.3, .44, .66, '#1a2460', .12, .1);
    var n = K.n, c = K.c, t = K.t, r = K.r, o = '', i, x, y, g = '', w = n ? '#6f78c8' : '#ffffff',
      RB = (c.plate && typeof c.plate !== 'string') ? c.plate : ['#ff5d8f', '#ffb703', '#ffe45c', '#06d6a0', '#4cc9f0', '#9b5de5'];
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#121848'], [.5, '#272c74'], [.85, '#574892'], [1, '#8667a8']] : [[0, '#86c4ff'], [.5, '#bbe1ff'], [.82, '#e4f4ff'], [1, '#fff7e0']]));
    if (n) o += stars(K, 56, 400);
    o += n ? moon(K, 70, 288, 15, '#fff6dc') : sun(K, 70, 290, 17, '#fffbe6', '#fff0b0');
    /* grand arc-en-ciel pastel, autour du monstre */
    for (i = 0; i < RB.length; i++) g += C(200, 506, 254 - i * 9.5, 'none', 'stroke="' + lite(RB[i], .3) + '" stroke-width="10"');
    o += G(g, op(n ? .34 : .8));
    o += G(cloud(112, 196, .8, w, op(n ? .4 : .85)), an('drift', 0, 70)) + G(cloud(296, 140, 1.1, w, op(n ? .35 : .8)), an('drift', 22, 90)) + G(cloud(190, 52, 1.3, w, op(n ? .3 : .75)), an('drift', 40, 100));
    /* lointain */
    o += P(ridge(hillPts(K, 440, 62, 16, 44, 1.5), 600), t('#cdeed6', '#3a5a8a'));
    /* nuages aux pieds de l'arc */
    o += cloud(36, 408, 1.35, w, op(n ? .6 : .95)) + cloud(366, 402, 1.3, w, op(n ? .6 : .95));
    /* collines et bosquets */
    o += P(ridge([[-24, 432], [30, 414], [92, 438], [150, 450], [200, 452], [250, 450], [308, 438], [370, 412], [424, 430]], 600), K.lg('h2', n ? [[0, '#2f6a78'], [1, '#2a5f70']] : [[0, '#b0e6a2'], [1, '#97da8a']]));
    var TR = [[40, 428, 17], [70, 440, 12], [14, 430, 13], [362, 426, 18], [332, 440, 12], [390, 428, 13]], tc = t('#7fcf86', '#2f7f7a'), th = t('#b8efb0', '#4fa398'), tk = t('#9a8a6a', '#3a4a6a');
    for (i = 0; i < TR.length; i++) o += R(TR[i][0] - 1.5, TR[i][1] - 4, 3, 22, tk) + E(TR[i][0], TR[i][1] - TR[i][2] * .9, TR[i][2] * .86, TR[i][2], tc) + E(TR[i][0] - TR[i][2] * .25, TR[i][1] - TR[i][2] * 1.25, TR[i][2] * .4, TR[i][2] * .45, th, op(.6));
    o += P('M-10 454q105-12 210-6t210 6V600H-10Z', K.lg('gr', n ? [[0, '#2f6f72'], [.4, '#265d68'], [1, '#1b4458']] : [[0, '#bdf09a'], [.4, '#9bde7f'], [1, '#74c96a']]));
    o += K.stage(n ? '#4f9a8a' : '#eaffc8', n ? .45 : .8);
    /* herbes et fleurs */
    g = '';
    for (i = 0; i < 30; i++) {
      x = r() * 400; y = 468 + r() * 126;
      if (Math.abs(x - 200) < 110 && y < 506) continue;
      g += 'M' + n1(x - 3) + ' ' + n1(y) + 'l1-7M' + n1(x) + ' ' + n1(y) + 'v-9M' + n1(x + 3) + ' ' + n1(y) + 'l-1-7';
    }
    o += S(g, t('#62ba5c', '#3f8f88'), 1.8, op(.8));
    var FL = [[28, 472, 4.5, '#ffffff'], [62, 486, 4, '#ffd6e8'], [90, 468, 3.5, '#ffffff'], [312, 470, 3.5, '#fff3b0'], [340, 486, 4.5, '#ffffff'], [374, 472, 4, '#ffd6e8'], [134, 540, 4.5, '#ffffff'], [262, 548, 4.5, '#ffd6e8'], [196, 580, 4, '#fff3b0']];
    for (i = 0; i < FL.length; i++) o += flower(FL[i][0], FL[i][1], FL[i][2], t(FL[i][3]), t('#ffc93c'));
    /* premier plan : buissons et grandes fleurs */
    var b1 = t('#58b862', '#1f5f66'), b2 = t('#66c46a', '#27706f'), stc = t('#3f9a50', '#2a7a70');
    o += C(4, 600, 40, b1) + C(48, 612, 34, b2) + C(396, 600, 42, b1) + C(352, 614, 34, b2);
    o += G(S('M42 600q-4-20 0-36', stc, 3) + flower(42, 556, 15, t('#ffffff'), t('#ffc93c')), an('sway', 0, 8));
    o += S('M82 604q2-12 0-22', stc, 2.6) + flower(82, 576, 10, t('#ffb9d6'), t('#fff3b0'));
    o += G(S('M358 600q4-20 0-34', stc, 3) + flower(358, 558, 16, t('#ffb9d6'), t('#fff3b0')), an('sway', 3, 9));
    o += S('M316 604q-2-12 0-20', stc, 2.6) + flower(316, 578, 10, t('#ffffff'), t('#ffc93c'));
    /* papillons le jour, lucioles la nuit */
    if (n) { for (i = 0; i < 14; i++) { x = i % 2 ? 290 + r() * 80 : 30 + r() * 80; o += C(x, 380 + r() * 170, 1.7, '#f4ffa6', i % 2 ? an('tw', r() * 4) : op(.75)); } }
    else o += G(P('M96 372q-9-9-11 0t11 5q9 4 11-5t-11 0z', '#ff9fc8'), an('bob', 0, 3)) + G(P('M312 352q-8-8-10 0t10 4q8 4 10-4t-10 0z', '#ffd35c'), an('bob', 1.2, 3.4));
    return o;
  };

  /* ================================================================== 8. JUNGLE */
  function leaf(x, y, len, wid, ang, col, rib) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')">' + P('M0 0Q' + wid + ' ' + n1(-len * .45) + ' 0 ' + (-len) + 'Q' + (-wid) + ' ' + n1(-len * .45) + ' 0 0Z', col) +
      S('M0 -2V' + n1(-len * .9) + 'M0 ' + n1(-len * .25) + 'l' + n1(wid * .36) + ' ' + n1(-len * .12) + 'M0 ' + n1(-len * .25) + 'l' + n1(-wid * .36) + ' ' + n1(-len * .12) + 'M0 ' + n1(-len * .5) + 'l' + n1(wid * .34) + ' ' + n1(-len * .12) + 'M0 ' + n1(-len * .5) + 'l' + n1(-wid * .34) + ' ' + n1(-len * .12), rib, 1.4, op(.55)) + '</g>';
  }
  function frond(x, y, len, ang, col) {
    var d = '', i, k, l;
    for (i = 1; i < 9; i++) { k = -len * i / 9; l = len * .3 * (1 - i / 12); d += 'M0 ' + n1(k) + 'q' + n1(l * .6) + ' ' + n1(-l * .9) + ' ' + n1(l) + ' ' + n1(-l * .5) + 'M0 ' + n1(k) + 'q' + n1(-l * .6) + ' ' + n1(-l * .9) + ' ' + n1(-l) + ' ' + n1(-l * .5); }
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + ang + ')">' + S('M0 0V' + (-len), col, 2.4) + S(d, col, 4.2) + '</g>';
  }
  /* cime d'arbres : suite de bosses rondes qui suit le profil « vallée » */
  function canopy(K, y0, vamp, p, rmin, rvar) {
    var x = -30, d = 'M-30 600V' + n1(y0 - valley(-30, vamp, p)), rr, y;
    while (x < 430) { rr = rmin + K.r() * rvar; y = y0 - valley(x + rr * 2, vamp, p) - (K.r() - .5) * 14; d += 'A' + n1(rr) + ' ' + n1(rr * .9) + ' 0 0 1 ' + n1(x + rr * 2) + ' ' + n1(y); x += rr * 2; }
    return d + 'V600Z';
  }
  function liana(x, len, col, lc, delay) {
    var d = 'M' + x + ' -10q9 ' + n1(len * .5) + ' -1 ' + (len + 10), g = '', y;
    for (y = 180; y < len - 8; y += 28) g += 'M' + (x + 3) + ' ' + y + 'l8 4M' + (x - 2) + ' ' + (y + 14) + 'l-8 4';
    return G(S(d, col, 2.6) + S(g, lc, 6), an('hang', delay, 9 + delay));
  }
  SC.jungle = function (K) {
    K.tone(.26, .46, .44, '#0a2a2c', .14, .1);
    var n = K.n, t = K.t, r = K.r, o = '', i, x, y, st, sd;
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#04161a'], [.45, '#0b2e2c'], [.8, '#1a5446'], [1, '#3a7a5c']] : [[0, '#6cc48e'], [.4, '#a8e0a3'], [.72, '#e0f3b6'], [1, '#fbf7cc']]));
    if (n) o += stars(K, 26, 300) + moon(K, 312, 290, 14, '#f0ffe0');
    else o += C(200, 380, 210, K.halo('#fffbd0'), op(.7));
    /* rais de lumière */
    var sh = K.lg('sh', [[0, n ? '#bfe9ff' : '#fffde0', n ? .1 : .26], [1, n ? '#bfe9ff' : '#fffde0', 0]]);
    o += P('M40 -10h46L250 478h-90Z', sh) + P('M150 -10h30L330 478h-56Z', sh) + P('M-30 -10h30L120 478H60Z', sh);
    /* lointain : cimes pâles, troncs fins, pyramide perdue */
    o += P(canopy(K, 388, 104, 1.3, 13, 12), n ? '#14463e' : '#c2e8ae');
    o += S('M112 400v50M276 404v46M306 392v60M92 396v56', n ? '#113c38' : '#a9d99c', 3, 'stroke-linecap="butt"');
    o += P(canopy(K, 424, 120, 1.15, 11, 10), n ? '#103a36' : '#9bd593');
    var tp = n ? '#1d5a4c' : '#d3e8b6', ts = n ? '#17493f' : '#bcd9a0';
    o += R(108, 432, 88, 22, tp) + R(118, 419, 68, 14, tp) + R(129, 407, 46, 13, tp) + R(140, 396, 24, 12, tp) + R(108, 451, 88, 3, ts) + R(118, 430, 68, 2.5, ts) + R(129, 417, 46, 2.5, ts) + R(140, 405, 24, 2.5, ts) + R(147, 420, 10, 34, ts);
    /* troncs et lianes */
    var tk = K.lg('tk', [[0, t('#57764a')], [1, t('#78895c')]], [0, 0, 1, 0]);
    o += P('M-12 -10h56q-10 210 0 344q6 68 36 126H-12Z', tk) + S('M10 60q6 150 2 300M28 200q0 90 12 170', t('#48653e'), 2, op(.5));
    o += P('M412 -10h-54q12 226 2 348q-6 64-36 122h88Z', tk) + S('M392 80q-6 150-2 290M374 220q0 80-10 150', t('#48653e'), 2, op(.5));
    o += liana(72, 322, t('#4f8f4a'), t('#6fbf62'), 0) + liana(98, 262, t('#5a9a50'), t('#7fcc6c'), 2) + liana(330, 334, t('#4f8f4a'), t('#6fbf62'), 1) + liana(304, 250, t('#5a9a50'), t('#7fcc6c'), 3);
    /* ruines : totem moussu, colonne brisée */
    st = K.lg('st', [[0, t('#c3c8ae')], [1, t('#9eaa90')]]); sd = t('#8c987f');
    o += R(54, 378, 42, 82, st) + R(50, 368, 50, 13, t('#b3baa0'), 'rx="2"') + R(86, 378, 10, 82, '#000', op(.08));
    o += S('M54 404h42M54 432h42M64 444h22', sd, 1.8, 'stroke-linecap="butt"') + R(60, 384, 10, 10, 'none', 'stroke="' + sd + '" stroke-width="2"') + R(80, 384, 10, 10, 'none', 'stroke="' + sd + '" stroke-width="2"') + C(65, 389, 1.6, sd) + C(85, 389, 1.6, sd) + S('M62 420l5-5l5 5l5-5l5 5l5-5', sd, 2);
    o += P('M48 370q6-8 14-5t12-2t12 3t16 0v8q-5 6-10 2t-9 3t-11-2t-10 4t-14-3z', t('#72c266'));
    o += R(308, 410, 30, 46, st) + S('M315 412v44M323 412v44M331 412v44', sd, 1.4, op(.7)) + poly('308,410 308,398 316,404 324,394 332,402 338,396 338,410', t('#b3baa0')) + R(302, 452, 42, 9, t('#b3baa0'), 'rx="2"');
    o += R(344, 450, 30, 20, st, 'rx="5" transform="rotate(-12 359 460)"') + P('M304 452q8-6 14-2t12-2t14 3v4h-40z', t('#72c266'));
    /* sol : mousse et sentier */
    o += P('M-10 450q105-10 210-5t210 5V600H-10Z', K.lg('gr', n ? [[0, '#2a6a58'], [.4, '#20564c'], [1, '#143c3a']] : [[0, '#d6e8a2'], [.4, '#b7d386'], [1, '#88b264']]));
    o += K.stage(n ? '#4f9a78' : '#fbf5c8', n ? .45 : .85);
    for (i = 0; i < 10; i++) { x = 110 + r() * 180; y = 520 + r() * 72; o += E(x, y, 3 + r() * 4, 1.6 + r() * 1.6, t('#9cbd72', '#184840'), op(.7)); }
    o += frond(40, 468, 32, -24, t('#6dbb5e')) + frond(112, 462, 20, 16, t('#7cc86a')) + frond(366, 468, 32, 22, t('#6dbb5e')) + frond(290, 462, 20, -14, t('#7cc86a'));
    /* premier plan : grandes feuilles */
    var l1 = t('#2e9a58'), l2 = t('#3bab62'), l3 = t('#25864e'), rb = t('#9fe6a0');
    o += G(leaf(14, 604, 96, 30, 58, l3, rb) + leaf(28, 612, 128, 38, 26, l1, rb) + leaf(62, 614, 98, 28, 4, l2, rb), an('sway', 0, 9));
    o += frond(108, 610, 66, 20, t('#49b868'));
    o += G(leaf(386, 604, 96, 30, -58, l3, rb) + leaf(372, 612, 130, 38, -26, l1, rb) + leaf(338, 614, 100, 28, -4, l2, rb), an('sway', 3, 10));
    o += frond(292, 610, 62, -20, t('#49b868'));
    o += flower(118, 566, 9, t('#ff8f7a', '#c8607a'), t('#ffe08a', '#d8b86a')) + flower(284, 570, 8, t('#ff9fc0', '#b86aa8'), t('#ffe08a', '#d8b86a'));
    if (n) for (i = 0; i < 14; i++) { x = i % 2 ? 290 + r() * 80 : 30 + r() * 80; o += C(x, 330 + r() * 220, 1.7, '#eaff9a', i % 2 ? an('tw', r() * 4) : op(.75)); }
    return o;
  };

  /* ================================================================== 9. BANQUISE */
  function crystal(x, base, w, h, tilt, c1, c2, c3) {
    return '<g transform="translate(' + x + ' ' + base + ') rotate(' + tilt + ')">' + poly(n1(-w / 2) + ',0 ' + n1(-w / 2) + ',' + n1(-h * .76) + ' 0,' + (-h) + ' 0,0', c1) + poly('0,0 0,' + (-h) + ' ' + n1(w / 2) + ',' + n1(-h * .76) + ' ' + n1(w / 2) + ',0', c2) +
      poly(n1(-w / 2) + ',' + n1(-h * .76) + ' 0,' + (-h) + ' ' + n1(-w * .12) + ',' + n1(-h * .66), c3) + '</g>';
  }
  /* ruban d'aurore : même courbe tracée trois fois, de plus en plus large et pâle vers le haut */
  function aurora(d, col, lightCol) {
    return G(S(d, col, 84, op(.08)), 'transform="translate(0 -46)"') + G(S(d, col, 54, op(.13)), 'transform="translate(0 -29)"') + G(S(d, col, 28, op(.24)), 'transform="translate(0 -14)"') + S(d, lightCol, 6, op(.8));
  }
  SC.ice = function (K) {
    K.tone(.42, .54, .86, '#12265a', .12, .05);
    var n = K.n, t = K.t, r = K.r, o = '', i, x, y;
    o += R(0, 0, 400, 482, K.lg('sky', n ? [[0, '#050b2a'], [.5, '#0c1c4a'], [.85, '#173a6a'], [1, '#2c5c8c']] : [[0, '#7b97e6'], [.4, '#b6b3ee'], [.7, '#f3c7de'], [.9, '#ffe2d0'], [1, '#fff1de']]));
    if (n) o += stars(K, 60, 400);
    /* aurore (vive la nuit, voile pastel le jour) */
    o += G(G(aurora('M-30 296Q30 230 100 250T206 186T316 244T430 280', '#b58cff', '#e2c8ff') + aurora('M-30 350Q40 290 96 298T200 226T304 292T430 338', '#5dffb0', '#c8ffe6'), op(n ? .8 : .42)), an('glow', 0, 7));
    o += n ? moon(K, 70, 296, 14, '#f3fbff') : sun(K, 322, 330, 15, '#fffaf0', '#fff0d8');
    /* lointain : montagnes de glace, mer */
    var pk = [[-24, 424], [10, 372], [34, 398], [70, 356], [100, 402], [140, 414], [200, 420], [262, 414], [300, 396], [330, 366], [362, 400], [392, 370], [424, 424]], d = 'M-24 430';
    for (i = 0; i < pk.length; i++) d += 'L' + pk[i][0] + ' ' + pk[i][1];
    o += P(d + 'V430Z', n ? '#27467e' : '#dcd2f2') + P('M70 356l30 46l-22-10zM330 366l32 34l-24-8zM10 372l24 26l-18-6z', '#ffffff', op(n ? .1 : .55));
    o += R(0, 418, 400, 40, K.lg('sea', n ? [[0, '#2a5a9a'], [1, '#1c3f80']] : [[0, '#9fd4ee'], [1, '#62abde']]));
    o += S('M120 428h30M170 436h44M236 427h26M150 444h20M250 441h34', t('#eafaff', '#7fb0e6'), 1.6, op(.7));
    o += P('M150 440l10-7l14 2l6 5zM238 446l8-5l12 1l5 4z', t('#ffffff', '#a8c8f5'));
    /* icebergs des côtés */
    var f1 = K.lg('f1', n ? [[0, '#a8c4f5'], [1, '#6f90d8']] : [[0, '#ffffff'], [1, '#d9efff']]), f2 = t('#bfe2f8', '#5a7cc8'), f3 = t('#a2d1f2', '#4a6ab8'), f0 = t('#ffffff', '#c8dcff');
    o += poly('-10,456 -10,372 20,334 46,326 64,350 82,346 102,388 110,456', f1) + poly('46,326 64,350 68,456 40,456 36,378', f2) + poly('82,346 102,388 110,456 86,456', f3) + poly('20,334 46,326 36,378 10,382', f0);
    o += poly('410,456 410,360 380,334 358,344 346,380 326,376 308,410 302,456', f1) + poly('380,334 358,344 364,456 388,456 392,380', f2) + poly('326,376 308,410 302,456 330,456 336,400', f3) + poly('380,334 410,360 392,380', f0);
    /* banquise */
    o += P('M-10 450q105-10 210-5t210 5V600H-10Z', K.lg('gr', n ? [[0, '#8fa8ea'], [.4, '#6c86d2'], [1, '#4862b4']] : [[0, '#ffffff'], [.4, '#e8f5ff'], [1, '#c6e3fa']]));
    o += E(62, 455, 46, 9, t('#ffffff', '#9db4ee')) + E(340, 455, 50, 9, t('#ffffff', '#9db4ee')) + K.stage(n ? '#b8d0ff' : '#ffffff', n ? .45 : .9);
    o += S('M40 506l22 8l-6 12l26 9M362 498l-20 10l8 10l-22 10M150 560l20 6l-4 10', t('#b7dbf5', '#4a66b8'), 1.6) + S('M96 536q40-7 80 0M230 512q36-6 72 0', t('#d6ebfb', '#7f98dc'), 2);
    /* trou d'eau */
    o += E(266, 574, 40, 12, t('#a6d6f5', '#3f5aa8')) + E(266, 577, 36, 9.5, K.lg('wh', n ? [[0, '#1c3a80'], [1, '#2a4f98']] : [[0, '#4f9ad6'], [1, '#6cb6e6']])) + poly('252,574 266,570 276,576 262,580', f0) + S('M242 580q8-3 16 0', t('#cfeaff', '#7f98dc'), 1.4);
    /* premier plan : cristaux */
    var k1 = t('#eefcff', '#b8d0ff'), k2 = t('#9fd6fb', '#5f7fd6'), k3 = t('#ffffff', '#e0ecff'), k4 = t('#86c6f5', '#4a6ac8');
    o += G(crystal(20, 608, 24, 64, -26, k1, k2, k3) + crystal(48, 610, 34, 104, -9, k1, k2, k3) + crystal(80, 610, 24, 62, 13, k1, k4, k3), op(.95));
    o += G(crystal(382, 608, 24, 66, 26, k1, k2, k3) + crystal(354, 610, 34, 108, 8, k1, k2, k3) + crystal(322, 610, 24, 60, -14, k1, k4, k3), op(.95));
    o += poly(starPts(56, 516, 7, 1.6, 4), '#ffffff', an('tw', 0)) + poly(starPts(346, 512, 7, 1.6, 4), '#ffffff', an('tw', 2)) + poly(starPts(40, 346, 6, 1.4, 4), '#ffffff', an('tw', 1));
    /* neige */
    for (i = 0; i < 12; i++) { x = 10 + r() * 380; y = 250 + r() * 190; o += C(x, y, 1.1 + r() * 1.5, '#ffffff', an('fall', r() * 10, 8 + r() * 5)); }
    return o;
  };

  /* ================================================================== 10. POP ART */
  function burst(cx, cy, ro, n, c1, c2, sh) {
    return poly(starPts(cx + 4, cy + 5, ro, ro * .68, n, .2), sh[0], op(sh[1])) + poly(starPts(cx, cy, ro, ro * .68, n, .2), c1) + poly(starPts(cx, cy, ro * .74, ro * .5, n, .45), c2);
  }
  SC.pop = function (K) {
    K.tone(.66, .5, .86, '#2a1870', .14, 0);
    var n = K.n, t = K.t, o = '', i, a, y, w, d, sh = n ? ['#0b0528', .5] : ['#3b3fc4', .22],
      red = t('#ff4d4d', '#e0407a'), yel = t('#ffe24a', '#f7c94c'), wh = t('#ffffff', '#d6c8ff'), cy = t('#5ad1f0', '#4aa6e8'), pk = t('#ff6fa5', '#d957b0'), vio = n ? '#3a1c8a' : '#5a2bb8';
    o += R(0, 0, 400, 482, n ? '#281963' : '#97def4');
    /* rayons */
    d = '';
    for (i = 0; i < 12; i++) { a = (i * 30 - 7) * Math.PI / 180; d += 'M200 440L' + n1(200 + Math.cos(a) * 700) + ' ' + n1(440 + Math.sin(a) * 700) + 'L' + n1(200 + Math.cos(a + .26) * 700) + ' ' + n1(440 + Math.sin(a + .26) * 700) + 'Z'; }
    o += P(d, n ? '#33227c' : '#b3e8f8');
    /* trame de points : gros en haut, de plus en plus fins vers l'horizon */
    for (i = 0, y = 6; y < 372; y += 15, i++) {
      w = n1(9.5 * Math.pow(1 - y / 380, .9));
      if (w < 1.2) break;
      o += '<path d="M' + (i % 2 ? -7.5 : 0) + ' ' + y + 'H410" fill="none" stroke="' + (n ? '#ff6fb5' : '#ffffff') + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="0 15" opacity="' + (n ? .32 : .6) + '"/>';
    }
    o += C(200, 420, 250, K.halo(n ? '#4a31a4' : '#eafaff'), op(.85));
    if (n) o += moon(K, 318, 232, 15, '#fff6c8') + stars(K, 26, 380);
    /* nuages BD */
    o += cloud(77, 378, 1.25, sh[0], op(sh[1])) + G(cloud(72, 372, 1.25, wh), an('drift', 0, 50));
    o += cloud(339, 332, 1, sh[0], op(sh[1])) + G(cloud(334, 326, 1, wh), an('drift', 14, 60));
    /* éclats façon onomatopée, sans lettres */
    o += burst(64, 304, 40, 12, red, yel, sh) + poly(starPts(64, 304, 14, 6, 5, .2), wh);
    o += burst(340, 408, 32, 11, yel, wh, sh) + S('M326 414l8-12l7 9l8-12', red, 4.5);
    d = '330,262 354,262 343,290 360,290 322,340 333,304 315,304';
    o += poly(d, sh[0], op(sh[1]) + ' transform="translate(4 5)"') + poly(d, yel, 'stroke="' + yel + '" stroke-width="3" stroke-linejoin="round"');
    /* bulle sans paroles */
    d = 'M40 398h54q9 0 9 9v20q0 9-9 9H76l-12 13l1-13H40q-9 0-9-9v-20q0-9 9-9z';
    o += P(d, sh[0], op(sh[1]) + ' transform="translate(4 5)"') + P(d, wh) + C(52, 417, 4, vio) + C(67, 417, 4, pk) + C(82, 417, 4, cy);
    /* traits de vitesse, étincelles */
    o += S('M112 250l18 10M106 276l20 4M296 300l-18 8M292 356l-16 2M36 346l12 6M368 300l-10 8', wh, 3.5, op(.85));
    o += poly(starPts(122, 330, 9, 2.4, 4), wh) + poly(starPts(290, 244, 8, 2.2, 4), wh) + poly(starPts(40, 222, 7, 2, 4), yel) + poly(starPts(372, 372, 7, 2, 4), wh) + C(110, 372, 4, pk) + C(298, 388, 3.5, red);
    o += poly(starPts(150, 120, 20, 9, 5, .3), yel) + burst(296, 96, 36, 12, pk, wh, sh) + C(76, 130, 16, 'none', 'stroke="' + red + '" stroke-width="7"') + poly(starPts(220, 40, 9, 2.6, 4), wh);
    /* sol tramé (jaune le jour, violet la nuit) */
    o += R(0, 444, 400, 156, K.lg('gr', n ? [[0, '#6a3fc0'], [1, '#43249a']] : [[0, '#ffe873'], [1, '#ffbd3d']])) + R(0, 444, 400, 5, n ? '#8a5fe0' : '#ff9d3c', op(.75));
    o += K.stage(n ? '#9a78f0' : '#fffbd0', n ? .5 : .85);
    for (i = 0, y = 520; y < 604; y += 14, i++) o += '<path d="M' + (i % 2 ? -7 : 0) + ' ' + y + 'H410" fill="none" stroke="' + (n ? '#ff5fb5' : '#ff7f3c') + '" stroke-width="' + n1(2 + i * 1.25) + '" stroke-linecap="round" stroke-dasharray="0 14" opacity="' + (n ? .4 : .5) + '"/>';
    /* premier plan */
    o += burst(34, 598, 70, 14, red, yel, sh) + poly(starPts(34, 598, 24, 10, 5, .4), wh);
    o += C(372, 590, 36, sh[0], op(sh[1])) + C(368, 586, 36, pk) + C(368, 586, 22, 'none', 'stroke="' + wh + '" stroke-width="5" stroke-dasharray="0 11.5" stroke-linecap="round"') + C(318, 602, 17, cy) + poly(starPts(292, 566, 11, 3, 4), wh);
    return o;
  };

  /* ================================================================== API décors */
  var SEEDS = { city: 11, candy: 23, neon: 37, volcano: 41, sea: 53, retro: 67, rainbow: 71, jungle: 83, ice: 97, pop: 101 };
  MT.scenes = {
    ids: ['city', 'candy', 'neon', 'volcano', 'sea', 'retro', 'rainbow', 'jungle', 'ice', 'pop'],
    css: [
      '.mt-a-drift{animation:mt-drift 60s ease-in-out infinite alternate}',
      '@keyframes mt-drift{from{transform:translateX(-18px)}to{transform:translateX(18px)}}',
      '.mt-a-bob{animation:mt-bob 6s ease-in-out infinite alternate}',
      '@keyframes mt-bob{from{transform:translateY(3px)}to{transform:translateY(-4px)}}',
      '.mt-a-tw{animation:mt-tw 3.4s ease-in-out infinite alternate}',
      '@keyframes mt-tw{from{opacity:.15}to{opacity:1}}',
      '.mt-a-glow{animation:mt-scene-glow 3s ease-in-out infinite alternate}',
      '@keyframes mt-scene-glow{from{opacity:.5}to{opacity:1}}',
      '.mt-a-blink{animation:mt-neon-blink 6s linear infinite}',
      '@keyframes mt-neon-blink{0%,42%,50%,58%,100%{opacity:1}46%{opacity:.5}54%{opacity:.72}}',
      '.mt-a-rise{animation:mt-rise 7s linear infinite}',
      '@keyframes mt-rise{0%{transform:translateY(0);opacity:0}12%{opacity:.9}80%{opacity:.7}100%{transform:translateY(-170px);opacity:0}}',
      '.mt-a-fall{animation:mt-fall 9s linear infinite}',
      '@keyframes mt-fall{0%{transform:translate(0,-30px);opacity:0}12%{opacity:.9}85%{opacity:.8}100%{transform:translate(-14px,190px);opacity:0}}',
      '.mt-a-sway,.mt-a-hang{transform-box:fill-box;transform-origin:50% 100%;animation:mt-sway 7s ease-in-out infinite alternate}',
      '.mt-a-hang{transform-origin:50% 0}',
      '@keyframes mt-sway{from{transform:rotate(-2.2deg)}to{transform:rotate(2.2deg)}}',
      '@media (prefers-reduced-motion:reduce){.mt-scene [class^="mt-a-"]{animation:none}}'
    ].join('\n'),
    render: function (skin, opts) {
      skin = skin || {};
      var name = SC[skin.scene] ? skin.scene : 'city', K = mkCtx(skin, opts, SEEDS[name]), body = SC[name](K);
      return '<svg class="mt-scene" data-scene="' + name + '"' + (K.n ? ' data-night="1"' : '') + ' viewBox="0 0 400 600" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>' + K.defs + '</defs>' + body + '</svg>';
    }
  };

  /* ================================================================== OBJETS HD (viewBox 100×100) */
  /* liseré fin, teinté selon l'objet */
  function sk(col, w) { return 'stroke="' + col + '" stroke-width="' + (w || 2.5) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  /* reflet blanc ovale */
  function shine(x, y, rx, ry, rot, o) { return E(x, y, rx, ry, '#ffffff', op(o == null ? .55 : o) + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '')); }
  function spark(x, y, s, col) { return poly(starPts(x, y, s, s * .26, 4), col || '#ffffff'); }
  var PR = {};

  PR.steak = function (K) {
    var fat = K.lg('a', [[0, '#fff6e6'], [1, '#f3d5b2']]), meat = K.rg('b', [[0, '#ff7868'], [.6, '#e23c4c'], [1, '#c4283c']], .4, .35, .75);
    return P('M24 28C38 10 72 12 84 34C94 54 86 80 62 86C44 91 28 82 20 68C11 54 13 40 24 28Z', fat, sk('#b85a3c')) +
      P('M29 34C40 21 67 22 76 38C84 54 78 73 60 78C46 82 34 75 28 65C21 54 22 43 29 34Z', meat) +
      S('M42 36q11 9 6 22M58 32q7 10 14 12M36 62q11 3 19-4', '#ffe3cf', 2.4, op(.9)) +
      C(61, 60, 8.5, '#fff8ec', sk('#e8c39c', 1.6)) + C(61, 60, 3.4, '#f2b9a2') + shine(40, 30, 11, 3.6, -32, .6);
  };
  PR.poisson = function (K) {
    var body = K.lg('a', [[0, '#4fb6ee'], [.55, '#8fd8fb'], [1, '#eafaff']]);
    return P('M70 44L90 28Q84 52 90 76L70 60Z', '#3a9fde', sk('#2a78b4')) + P('M34 34Q48 16 62 36Z', '#3a9fde', sk('#2a78b4')) +
      P('M10 52C22 30 56 26 72 46Q76 52 72 58C56 78 22 74 10 52Z', body, sk('#2a78b4')) +
      P('M44 58q12 0 13 12q-11 1-13-12z', '#3a9fde', sk('#2a78b4', 1.6)) + S('M33 40q8 12 0 24', '#2a8fcb', 2, op(.7)) +
      S('M46 44q4 3 4 7M56 46q4 3 4 7M51 53q4 3 4 7', '#ffffff', 1.8, op(.7)) +
      C(23, 47, 5.4, '#ffffff') + C(24, 47.5, 2.9, '#16345c') + C(25.2, 46.3, 1.1, '#ffffff') + shine(42, 36, 12, 2.6, -8, .5);
  };
  PR.ramen = function (K) {
    var bowl = K.lg('a', [[0, '#ff6f5e'], [1, '#c92f3c']]), soup = K.lg('b', [[0, '#ffd98a'], [1, '#f5b44a']]);
    return S('M60 44L88 10M67 46L95 16', '#b9773f', 3.6) + R(38, 84, 24, 7, '#a82835', 'rx="2.5"') +
      P('M10 48H90Q90 86 50 88Q10 86 10 48Z', bowl, sk('#8a1f2c')) + S('M18 62q5.4-5 10.8 0t10.8 0t10.8 0t10.8 0t10.8 0t10.8 0', '#ffd9c9', 2.2, op(.85)) +
      E(50, 48, 40, 10, soup, sk('#8a1f2c')) +
      S('M20 47q6-5 12 0t12 0M28 52q6-5 12 0t12 0t12 0M48 44q6-4 12 0', '#fff3c4', 3) +
      R(64, 32, 14, 17, '#2f5a45', 'rx="2" transform="rotate(8 71 40)"') +
      E(33, 46, 9.5, 6.6, '#ffffff', sk('#e9d9c0', 1.2)) + C(33, 46.6, 3.8, '#ffb52e') +
      C(55, 51, 6.4, '#ffffff', sk('#ffb9cc', 1.4)) + S('M55 51q3-3 0-4.5q-4 0-3 4.5q2 4 6 1', '#ff7fa8', 1.5) +
      R(42, 41, 5, 2.6, '#5fcf7a', 'rx="1.3" transform="rotate(-20 44 42)"') + R(70, 51, 5, 2.6, '#5fcf7a', 'rx="1.3" transform="rotate(25 72 52)"') +
      S('M24 30q-5-6 0-11t0-11M38 26q-4-5 0-9', '#cfe3f2', 3, op(.9)) + shine(26, 66, 4, 9, 18, .35);
  };
  PR.pomme = function (K) {
    var g = K.rg('a', [[0, '#ff8a7a'], [.6, '#f2414f'], [1, '#c9263a']], .36, .32, .8);
    return S('M50 32q0-11 7-17', '#7a4a2a', 4.4) + P('M57 20q11-13 25-7q-6 15-25 7z', '#63c85a', sk('#2f8f3a', 2)) + S('M60 19q9-5 18-5', '#2f8f3a', 1.4, op(.7)) +
      P('M50 30C62 20 87 26 87 52C87 75 69 91 58 89Q50 86 42 89C31 91 13 75 13 52C13 26 38 20 50 30Z', g, sk('#9c1d2e')) +
      S('M41 30q9 6 18 0', '#a81c30', 2.4, op(.55)) + shine(30, 48, 6, 12, 18, .5) + C(27, 66, 2.4, '#ffffff', op(.35));
  };
  PR.glace = function (K) {
    var cone = K.lg('a', [[0, '#f8c274'], [1, '#d98a3a']]), s1 = K.rg('b', [[0, '#ffd0e4'], [1, '#ff7fae']], .35, .3, .8), s2 = K.rg('c', [[0, '#dcfff3'], [1, '#5fdcbc']], .35, .3, .8);
    return poly('31,54 69,54 50,96', cone, sk('#a8642a')) + S('M38 62l15 24M47 57l13 20M62 57L45 80M54 56L37 70', '#b9732e', 1.5, op(.6)) +
      C(50, 44, 21.5, s1, sk('#d9578f')) + P('M29 49q4 9 9 2q3 8 8 1q4 8 9 0q4 8 8 1q5 5 8-4q-20 8-42 0z', '#ff7fae', sk('#d9578f', 1.6)) +
      C(50, 25, 16.5, s2, sk('#35b598')) + S('M35 30q4 6 8 1q3 6 8 1q4 6 8 0q3 5 6 0', '#35b598', 1.6, op(.6)) +
      S('M50 9q1-5 6-7', '#7a2a3a', 1.8) + C(50, 10, 5.4, '#f2414f', sk('#a81c30', 1.6)) + C(48.4, 8.4, 1.5, '#ffffff', op(.7)) +
      shine(42, 18, 5, 2.4, -30, .7) + shine(38, 38, 6, 2.8, -30, .6) + S('M60 40l3 3M62 22l2-3M40 48l-3 2', '#ffe58a', 2.2);
  };
  PR.donut = function (K) {
    var dough = K.lg('a', [[0, '#f8cf8a'], [1, '#d99445']]), ic = K.lg('b', [[0, '#ffa6d4'], [1, '#ff5fa8']]), hole = 'M38 47a12 7.5 0 1 0 24 0a12 7.5 0 1 0-24 0Z';
    return P('M10 54a40 34 0 1 0 80 0a40 34 0 1 0-80 0Z' + hole, dough, 'fill-rule="evenodd" ' + sk('#a8662a')) +
      P('M13 50C13 29 31 18 50 18C69 18 87 29 87 50q-1 9-7 6q-3 8-10 3q-6 10-13 3q-7 9-14 2q-6 8-12 1q-6 7-10-1q-7 2-8-14Z' + hole, ic, 'fill-rule="evenodd" ' + sk('#d93f8f', 2)) +
      P('M38 47a12 7.5 0 0 1 24 0a12 5 0 0 0-24 0Z', '#b06a2c', op(.55)) + S('M22 38q8-12 24-15', '#ffffff', 3.4, op(.55)) +
      S('M30 30l5 3', '#fff3b0', 3.2) + S('M62 26l5-2', '#7fe0ff', 3.2) + S('M74 40l4 4', '#ffffff', 3.2) + S('M24 50l2 5', '#9fffd6', 3.2) + S('M50 28l1 5', '#c9a8ff', 3.2) + S('M66 54l5 1', '#fff3b0', 3.2) + S('M38 58l4-3', '#7fe0ff', 3.2) + S('M78 52l1-5', '#9fffd6', 3.2);
  };
  PR.sucette = function (K) {
    var g = K.rg('a', [[0, '#ffb3dc'], [1, '#ff5fb0']], .38, .32, .8), d = '', i, a, rr;
    for (i = 0; i <= 44; i++) { a = i / 44 * Math.PI * 5; rr = 26 * i / 44; d += (i ? 'L' : 'M') + n1(50 + Math.cos(a) * rr) + ' ' + n1(38 + Math.sin(a) * rr); }
    return R(46.5, 56, 7, 40, K.lg('b', [[0, '#ffffff'], [1, '#e8ddca']], [0, 0, 1, 0]), 'rx="3.5" ' + sk('#c9b99c', 1.6)) +
      C(50, 38, 31, g, sk('#d9408f')) + S(d, '#ffffff', 6, op(.88)) + C(50, 38, 31, 'none', sk('#d9408f')) + shine(36, 22, 9, 4, -35, .65);
  };
  PR.crotte = function (K) {
    var g = K.lg('a', [[0, '#c99468'], [1, '#8f5a38']]), st = sk('#5e3622');
    return E(50, 78, 35, 15, g, st) + E(50, 61, 26.5, 13.5, g, st) + E(50, 46, 18, 11.5, g, st) + P('M40 42q0-14 12-20q8-3 6 2q-3 6 4 12q4 6-2 10z', g, st) +
      shine(34, 73, 8, 3, -12, .3) + shine(38, 56, 6, 2.6, -14, .32) + shine(43, 41, 4, 2, -20, .35) +
      E(40, 66, 5, 6, '#ffffff') + E(60, 66, 5, 6, '#ffffff') + C(41, 67, 2.8, '#3a2014') + C(61, 67, 2.8, '#3a2014') + C(42, 65.8, 1, '#ffffff') + C(62, 65.8, 1, '#ffffff') +
      S('M45 76q5 4.5 10 0', '#3a2014', 2.2) + E(31, 74, 4, 2.4, '#ff9db0', op(.7)) + E(69, 74, 4, 2.4, '#ff9db0', op(.7));
  };
  PR.pilule = function (K) {
    var a = K.lg('a', [[0, '#ff7f8a'], [1, '#d9304a']]), b = K.lg('b', [[0, '#ffffff'], [1, '#d9e4f2']]);
    return G(P('M50 31H32a19 19 0 0 0 0 38H50Z', a, sk('#9c1d38')) + P('M50 31H68a19 19 0 0 1 0 38H50Z', b, sk('#8f9fb8')) +
      R(23, 37, 54, 6.5, '#ffffff', 'rx="3.2" opacity=".55"') + R(48.6, 31, 2.8, 38, '#7a1a30', op(.35)), 'transform="rotate(-38 50 50)"');
  };
  PR.seringue = function (K) {
    var liq = K.lg('a', [[0, '#7ff0e0'], [1, '#2fbfc0']]);
    return G(R(3, 48.8, 20, 2.6, '#8fa3b8', 'rx="1.3"') + R(20, 45, 9, 10, '#a6b8cc', 'rx="2" ' + sk('#5f7690', 1.6)) +
      R(72, 46.5, 17, 7, '#c3cfdc', sk('#5f7690', 1.6)) + R(87, 37, 6, 26, '#7f93ab', 'rx="3" ' + sk('#4f6580', 1.6)) +
      R(28, 39, 46, 22, '#eefaff', 'rx="4" ' + sk('#4f8fb8')) + R(30.5, 41.5, 27, 17, liq, 'rx="2.5"') + R(56, 41.5, 5.5, 17, '#4a6078', 'rx="1.5"') +
      S('M36 39v6M43 39v4M50 39v6M64 39v4', '#4f8fb8', 1.6, op(.8)) + R(70, 35, 4.6, 30, '#7f93ab', 'rx="2.3" ' + sk('#4f6580', 1.6)) +
      R(31, 43, 40, 3.4, '#ffffff', 'rx="1.7" opacity=".6"'), 'transform="rotate(-45 50 50)"') +
      P('M9 84q4 5 0 8.4q-4-3.4 0-8.4z', '#4fd6d8', sk('#2a9fa8', 1.2));
  };
  PR.eponge = function (K) {
    var g = K.lg('a', [[0, '#ffe680'], [1, '#ffbe2e']]), bub = 'fill-opacity=".85" ' + sk('#8fcdf5', 1.6);
    return G(R(14, 38, 70, 44, g, 'rx="11" ' + sk('#d18f12')) +
      P('M14 54V49a11 11 0 0 1 11-11h48a11 11 0 0 1 11 11v5Z', K.lg('b', [[0, '#7fe08f'], [1, '#45b862']]), sk('#2f9a4f')) + R(21, 42, 44, 4, '#ffffff', 'rx="2" opacity=".5"') +
      S('M27 62h.01M41 60h.01M56 63h.01M70 61h.01M34 71h.01M49 72h.01M64 73h.01M24 75h.01M75 71h.01', '#e09a14', 4.6) + S('M48 66h.01M32 66h.01M61 68h.01', '#e09a14', 3), 'transform="rotate(-8 50 58)"') +
      C(70, 28, 12, '#ffffff', bub) + C(52, 24, 8.5, '#ffffff', bub) + C(84, 42, 7, '#ffffff', bub) + C(38, 30, 5, '#ffffff', bub) +
      S('M63 25q2-5 7-5M47.500 22q1-3 4-3', '#ffffff', 2, op(.95));
  };
  PR.savon = function (K) {
    var g = K.lg('a', [[0, '#d6c6ff'], [1, '#9c84f0']]), bub = 'fill-opacity=".8" ' + sk('#8fcdf5', 1.6);
    return G(R(12, 42, 76, 42, '#7a62d6', 'rx="16"') + R(12, 37, 76, 42, g, 'rx="16" ' + sk('#6a50c8')) +
      R(22, 46, 56, 24, 'none', 'rx="10" stroke="#ffffff" stroke-opacity=".45" stroke-width="2.4"') + poly(starPts(50, 58, 8, 3.6, 5), '#ffffff', op(.6)) +
      R(22, 41, 40, 4.4, '#ffffff', 'rx="2.2" opacity=".55"'), 'transform="rotate(-6 50 60)"') +
      C(26, 26, 10, '#ffffff', bub) + C(44, 16, 6.5, '#ffffff', bub) + C(78, 26, 8, '#ffffff', bub) + C(64, 14, 4, '#ffffff', bub) + S('M20.500 23q2-4 6-4M73.500 23q2-3 5-3', '#ffffff', 1.8, op(.95));
  };
  PR.bulle = function (K) {
    var g = K.rg('a', [[0, '#e6f8ff', .25], [.65, '#a8e0ff', .45], [1, '#6fc4ff', .8]]), rim = K.lg('b', [[0, '#ff8fd0'], [.5, '#5fc4ff'], [1, '#a88cff']], [0, 0, 1, 1]);
    return C(48, 54, 38, g, 'stroke="' + rim + '" stroke-width="4"') + S('M24 44q5-15 19-20', '#ffffff', 5.5, op(.9)) + C(22, 54, 2.6, '#ffffff', op(.85)) + S('M62 80q10-4 14-14', '#ffffff', 2.6, op(.55)) +
      C(84, 20, 9, g, 'stroke="' + rim + '" stroke-width="2.4"') + S('M79.500 17q1.500-3 4.500-3.500', '#ffffff', 2.2, op(.9));
  };
  PR.coeur = function (K) {
    var g = K.rg('a', [[0, '#ff9db4'], [.6, '#ff4f78'], [1, '#e6285a']], .36, .3, .8);
    return P('M50 88C20 66 8 48 13 31C19 13 42 13 50 30C58 13 81 13 87 31C92 48 80 66 50 88Z', g, sk('#b81f4a')) + shine(30, 31, 9, 5, -35, .65) + C(23, 45, 2.4, '#ffffff', op(.5));
  };
  PR.zzz = function (K) {
    var g = K.lg('a', [[0, '#a6c4ff'], [1, '#6a6cf0']]), o = '', Z = [[12, 62, 20], [38, 36, 26], [60, 8, 31]], i, z, d;
    for (i = 0; i < 3; i++) { z = Z[i]; d = 'M' + z[0] + ' ' + z[1] + 'h' + z[2] + 'l-' + z[2] + ' ' + z[2] + 'h' + z[2]; o += S(d, '#3b3fb0', n1(z[2] * .44)) + S(d, g, n1(z[2] * .28)); }
    return o;
  };
  PR.crane = function (K) {
    var g = K.lg('a', [[0, '#ffffff'], [1, '#dfe1f4']]), ink = '#3a3560';
    return P('M50 10C75 10 90 27 90 48C90 60 84 69 75 73V82Q75 90 67 90H33Q25 90 25 82V73C16 69 10 60 10 48C10 27 25 10 50 10Z', g, sk('#7f7fb0')) +
      E(34, 50, 10.5, 12, ink) + E(66, 50, 10.5, 12, ink) + C(37, 46, 3, '#ffffff') + C(69, 46, 3, '#ffffff') + C(31.5, 54, 1.4, '#ffffff', op(.8)) + C(63.500, 54, 1.4, '#ffffff', op(.8)) +
      P('M50 61q-5 6-3.500 8.500q3.500 2 7 0q1.500-2.500-3.500-8.500z', ink) + S('M40 78v12M50 78v12M60 78v12', '#9697c4', 2.2) + S('M33 78h34', '#9697c4', 2.2) +
      E(21, 62, 5, 3, '#ffb3c6', op(.75)) + E(79, 62, 5, 3, '#ffb3c6', op(.75)) + shine(34, 22, 10, 4.4, -28, .8);
  };
  PR.etoile = function (K) {
    var g = K.lg('a', [[0, '#fff58a'], [1, '#ffb52e']]);
    return poly(starPts(50, 54, 38, 18, 5), g, sk('#e08a12', 7)) + poly(starPts(50, 54, 38, 18, 5), g, 'stroke="' + g + '" stroke-width="3" stroke-linejoin="round"') +
      poly(starPts(50, 54, 20, 9.500, 5), '#ffffff', op(.3)) + shine(38, 40, 7, 3, -35, .7) + spark(86, 18, 8, '#ffe58a') + spark(12, 80, 6, '#ffe58a');
  };
  PR.eclair = function (K) {
    var g = K.lg('a', [[0, '#fff58a'], [1, '#ffa51e']]), d = '62,6 24,54 45,54 35,94 78,42 55,42 71,6';
    return poly(d, g, sk('#d97a0a', 7)) + poly(d, g, 'stroke="' + g + '" stroke-width="2.6" stroke-linejoin="round"') + S('M58 14L36 46', '#ffffff', 3.4, op(.65));
  };
  PR.goutte = function (K) {
    var g = K.rg('a', [[0, '#b8efff'], [.6, '#4fb8f2'], [1, '#2a8fdc']], .38, .45, .75);
    return P('M50 8C50 8 19 44 19 62A31 31 0 0 0 81 62C81 44 50 8 50 8Z', g, sk('#1f77c2')) + S('M32 60q0 15 13 22', '#ffffff', 5.5, op(.65)) + shine(44, 34, 3, 7, 22, .6);
  };
  PR.tombe = function (K) {
    var g = K.lg('a', [[0, '#d6dbe6'], [1, '#9aa3b5']]), en = '#737c92';
    return P('M24 88V40A26 26 0 0 1 76 40V88Z', g, sk('#646c82')) + P('M30 86V41A20 20 0 0 1 70 41V86', 'none', 'stroke="#ffffff" stroke-opacity=".45" stroke-width="2.2"') +
      P('M50 53c-9-6.500-10-14-4-16c3-1 4 2 4 3c0-1 1-4 4-3c6 2 5 9.500-4 16z', en) + S('M39 63h22M43 71h14', en, 2.8) +
      E(50, 89, 42, 8, '#6fcf73', sk('#3f9f4f', 2)) + S('M16 87l2-8M22 88l-1-7M80 87l-2-8M74 88l1-6', '#3f9f4f', 2.4) +
      flower(84, 76, 7, '#ffffff', '#ffc93c') + shine(36, 30, 3.4, 9, 24, .5);
  };
  PR.ampoule = function (K) {
    var g = K.rg('a', [[0, '#fffde0'], [.6, '#ffe46a'], [1, '#ffc22e']], .42, .36, .7);
    return S('M8 40h7M92 40h-7M19 12l5 5M81 12l-5 5M50 2v5', '#ffc12e', 4) +
      P('M50 12A27 27 0 0 1 68 59Q64 63 64 69H36Q36 63 32 59A27 27 0 0 1 50 12Z', g, sk('#e09a12')) +
      S('M43 68V54l3.500-6l3.500 6l3.500-6l3.500 6V68', '#e08a12', 2.2) +
      R(36, 68, 28, 7, '#b4bfcf', 'rx="2.5" ' + sk('#6f7b92', 1.6)) + R(37.500, 75.500, 25, 6.500, '#98a5ba', 'rx="2.5" ' + sk('#6f7b92', 1.6)) + R(42, 82.500, 16, 7, '#6f7b92', 'rx="3.5"') + shine(39, 28, 5, 9, 28, .75);
  };
  PR.ballon = function (K) {
    var cols = ['#ff5d6c', '#ffffff', '#3fa9f5', '#ffffff', '#ffd23f', '#ffffff'], o = '', i, a, b;
    K.defs += '<clipPath id="' + K.u + 'c"><circle cx="50" cy="52" r="39"/></clipPath>';
    for (i = 0; i < 6; i++) { a = (i * 60 - 20) * Math.PI / 180; b = a + Math.PI / 3; o += P('M38 36L' + n1(38 + Math.cos(a) * 120) + ' ' + n1(36 + Math.sin(a) * 120) + 'L' + n1(38 + Math.cos(b) * 120) + ' ' + n1(36 + Math.sin(b) * 120) + 'Z', cols[i]); }
    return G(o + C(50, 52, 39, K.rg('a', [[0, '#000000', 0], [.7, '#000000', 0], [1, '#1a2a5a', .28]], .38, .32, .75)), 'clip-path="url(#' + K.u + 'c)"') +
      C(50, 52, 39, 'none', sk('#56669a')) + C(38, 36, 5.500, '#ffffff', sk('#c3cbe0', 1.4)) + shine(30, 28, 9, 4.4, -38, .6);
  };
  PR.megaphone = function (K) {
    var g = K.lg('a', [[0, '#ff8a78'], [1, '#e0344a']]);
    return R(28, 58, 11, 26, '#5b6478', 'rx="4.5" transform="rotate(12 33 70)" ' + sk('#3a4258', 1.8)) +
      R(8, 38, 18, 24, K.lg('b', [[0, '#fff3e6'], [1, '#f0d2bc']]), 'rx="5" ' + sk('#b98f78', 2)) +
      P('M22 39L66 17Q72 15 72 22V78Q72 85 66 83L22 61Z', g, sk('#a81f38')) + P('M26 42L66 22v10L26 48Z', '#ffffff', op(.3)) +
      R(67, 14, 10, 72, K.lg('c', [[0, '#ffffff'], [1, '#ffd6cc']]), 'rx="5" ' + sk('#a81f38', 2)) +
      S('M84 36q6 14 0 28M91 27q10 23 0 46', '#ffb52e', 4.4);
  };
  PR.main = function (K) {
    /* la même silhouette deux fois : d'abord épaissie (liseré), puis pleine */
    var h = '<rect x="24" y="46" width="46" height="46" rx="17"/><rect x="24" y="26" width="11" height="40" rx="5.5"/><rect x="35.7" y="16" width="11" height="50" rx="5.5"/><rect x="47.4" y="18" width="11" height="48" rx="5.5"/><rect x="59" y="28" width="11" height="40" rx="5.5"/><rect x="6" y="50" width="13" height="32" rx="6.5" transform="rotate(-32 12 80)"/>';
    return G(h, 'fill="#d18f1e" stroke="#d18f1e" stroke-width="5" stroke-linejoin="round"') + G(h, 'fill="#ffd464"') +
      E(47, 78, 19, 11, '#ffbe45', op(.6)) + E(40, 58, 14, 8, '#ffe9a6', op(.6)) +
      S('M35.4 44v18M47 44v18M58.7 46v16', '#e0a030', 1.8, op(.7)) + S('M36 74q10 7 22 1', '#e0a030', 2, op(.6)) + shine(41, 23, 2.2, 5, 0, .6) + shine(29.5, 33, 2, 4.5, 0, .5) +
      P('M84 28c-9-6.5-10-14-4-16c3-1 4 2 4 3c0-1 1-4 4-3c6 2 5 9.5-4 16z', '#ff5d8f', sk('#d93a70', 1.6)) +
      S('M79 46q5 6 3.500 14M88 42q6 9 3.500 20', '#ffb0c8', 3.2);
  };
  PR.oeuf = function (K) {
    var g = K.rg('a', [[0, '#ffffff'], [.6, '#fff4dc'], [1, '#ecd9b4']], .38, .34, .78), d = 'M50 8C70 8 84 38 84 59A34 33 0 0 1 16 59C16 38 30 8 50 8Z';
    K.defs += '<clipPath id="' + K.u + 'c"><path d="' + d + '"/></clipPath>';
    return P(d, g) + G(C(30, 40, 9, '#7fdc8f') + C(66, 30, 7, '#5fd0e6') + C(72, 62, 11, '#7fdc8f') + C(42, 72, 8, '#5fd0e6') + C(20, 68, 7, '#ffc86a') + C(52, 48, 5, '#ffc86a') + C(56, 90, 8, '#7fdc8f'), 'clip-path="url(#' + K.u + 'c)" opacity=".85"') +
      P(d, 'none', sk('#b89a6c')) + shine(36, 26, 6, 11, 24, .7);
  };
  PR._inconnu = function (K) {
    return C(50, 50, 40, K.lg('a', [[0, '#e3e7ef'], [1, '#b9c0cf']]), sk('#8f97a8')) + S('M38 40q0-13 12-13t12 12q0 7-8 11q-4 3-4 8', '#5b6478', 7) + C(50, 72, 4.6, '#5b6478');
  };

  MT.props = {
    ids: ['steak', 'poisson', 'ramen', 'pomme', 'glace', 'donut', 'sucette', 'crotte', 'pilule', 'seringue', 'eponge', 'savon', 'bulle', 'coeur', 'zzz', 'crane', 'etoile', 'eclair', 'goutte', 'tombe', 'ampoule', 'ballon', 'megaphone', 'main', 'oeuf'],
    svg: function (id, uid) {
      var known = Object.prototype.hasOwnProperty.call(PR, id) && id.charAt(0) !== '_', name = known ? id : 'inconnu',
        K = mkCtx({}, { uid: String(uid == null ? 'mtp' : uid) + '-' + name }, 7), body = (known ? PR[id] : PR._inconnu)(K);
      return '<svg class="mt-prop" data-prop="' + name + '" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>' + K.defs + '</defs>' + body + '</svg>';
    }
  };
})();
