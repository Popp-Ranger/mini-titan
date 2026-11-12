/* Mini-Titan — direction « c » : illustration moderne douce.
   Formes arrondies sans contour, aplats + dégradés linéaires discrets, ombres internes nettes,
   plaques dorsales en formes pures avec halo. Tout est paramétrique : un « gabarit » par stade,
   des blobs (splines de Catmull-Rom fermées) pour la tête, le corps et la queue, et des plaques
   posées exactement sur le contour du dos.
   API : MT.arts.c = { name, css, monster(skin, opts) } — fonction pure, renvoie une chaîne SVG. */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};
  MT.arts = MT.arts || {};

  var GROUND = 360;
  var MOODS = { neutral: 1, happy: 1, love: 1, sad: 1, angry: 1, sick: 1, sleep: 1, eat: 1, surprised: 1 };

  /* ------------------------------------------------------------------ outils */
  function f(n) { return String(Math.round(n * 10) / 10); }
  function P(p) { return f(p[0]) + ',' + f(p[1]); }
  function rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b), s = '#', i, v;
    for (i = 0; i < 3; i++) {
      v = Math.round(x[i] + (y[i] - x[i]) * t).toString(16);
      s += v.length < 2 ? '0' + v : v;
    }
    return s;
  }
  function hash(str) {
    var h = 7, i;
    for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
    return h;
  }

  /* Spline de Catmull-Rom fermée -> segments de Bézier cubiques [p0, c1, c2, p1]. */
  function blob(pts) {
    var n = pts.length, k = 1 / 6, out = [], i, a, b, c, d;
    for (i = 0; i < n; i++) {
      a = pts[(i - 1 + n) % n]; b = pts[i]; c = pts[(i + 1) % n]; d = pts[(i + 2) % n];
      out.push([b,
        [b[0] + (c[0] - a[0]) * k, b[1] + (c[1] - a[1]) * k],
        [c[0] - (d[0] - b[0]) * k, c[1] - (d[1] - b[1]) * k],
        c]);
    }
    return out;
  }
  function blobD(segs, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    var d = 'M' + f(segs[0][0][0] + dx) + ',' + f(segs[0][0][1] + dy), i, s;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      d += 'C' + f(s[1][0] + dx) + ',' + f(s[1][1] + dy) + ' ' + f(s[2][0] + dx) + ',' + f(s[2][1] + dy) + ' ' + f(s[3][0] + dx) + ',' + f(s[3][1] + dy);
    }
    return d + 'Z';
  }
  /* Point, tangente et normale sortante sur le contour (u = indice de segment + fraction). */
  function at(segs, u, ccw) {
    var n = segs.length, i = Math.floor(u), t = u - i, s = segs[((i % n) + n) % n], v = 1 - t;
    var x = v * v * v * s[0][0] + 3 * v * v * t * s[1][0] + 3 * v * t * t * s[2][0] + t * t * t * s[3][0];
    var y = v * v * v * s[0][1] + 3 * v * v * t * s[1][1] + 3 * v * t * t * s[2][1] + t * t * t * s[3][1];
    var dx = 3 * v * v * (s[1][0] - s[0][0]) + 6 * v * t * (s[2][0] - s[1][0]) + 3 * t * t * (s[3][0] - s[2][0]);
    var dy = 3 * v * v * (s[1][1] - s[0][1]) + 6 * v * t * (s[2][1] - s[1][1]) + 3 * t * t * (s[3][1] - s[2][1]);
    var l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    var nx = ccw ? -dy : dy, ny = ccw ? dx : -dx;
    return { x: x, y: y, tx: dx, ty: dy, nx: nx, ny: ny, a: Math.atan2(nx, -ny) * 180 / Math.PI };
  }
  function tag(name, attrs, inner) {
    var s = '<' + name, k;
    for (k in attrs) if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== '') s += ' ' + k + '="' + attrs[k] + '"';
    return inner === undefined ? s + '/>' : s + '>' + inner + '</' + name + '>';
  }
  function path(d, fill, extra) {
    var a = { d: d, fill: fill }, k;
    if (extra) for (k in extra) a[k] = extra[k];
    return tag('path', a);
  }
  function line(d, stroke, w, extra) {
    var a = { d: d, fill: 'none', stroke: stroke, 'stroke-width': f(w), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, k;
    if (extra) for (k in extra) a[k] = extra[k];
    return tag('path', a);
  }
  function circle(cx, cy, r, fill, extra) {
    var a = { cx: f(cx), cy: f(cy), r: f(r), fill: fill }, k;
    if (extra) for (k in extra) a[k] = extra[k];
    return tag('circle', a);
  }
  function ellipse(cx, cy, rx, ry, fill, extra) {
    var a = { cx: f(cx), cy: f(cy), rx: f(rx), ry: f(ry), fill: fill }, k;
    if (extra) for (k in extra) a[k] = extra[k];
    return tag('ellipse', a);
  }
  function grad(id, c1, c2, x2, y2, o2) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 0) + '" y2="' + (y2 === undefined ? 1 : y2) + '">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"' + (o2 !== undefined ? ' stop-opacity="' + o2 + '"' : '') + '/></linearGradient>';
  }
  function clip(id, d) { return '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>'; }
  function heartD(cx, cy, s) {
    return 'M' + f(cx) + ',' + f(cy + s * .95) +
      'C' + f(cx - s * 1.55) + ',' + f(cy - s * .05) + ' ' + f(cx - s * .78) + ',' + f(cy - s * 1.3) + ' ' + f(cx) + ',' + f(cy - s * .45) +
      'C' + f(cx + s * .78) + ',' + f(cy - s * 1.3) + ' ' + f(cx + s * 1.55) + ',' + f(cy - s * .05) + ' ' + f(cx) + ',' + f(cy + s * .95) + 'Z';
  }
  function dropD(cx, cy, s) { /* goutte, pointe en haut */
    return 'M' + f(cx) + ',' + f(cy - s * 1.5) + 'C' + f(cx + s * .3) + ',' + f(cy - s * .7) + ' ' + f(cx + s) + ',' + f(cy - s * .3) + ' ' + f(cx + s) + ',' + f(cy + s * .25) +
      'A' + f(s) + ',' + f(s) + ' 0 0 1 ' + f(cx - s) + ',' + f(cy + s * .25) + 'C' + f(cx - s) + ',' + f(cy - s * .3) + ' ' + f(cx - s * .3) + ',' + f(cy - s * .7) + ' ' + f(cx) + ',' + f(cy - s * 1.5) + 'Z';
  }

  /* ------------------------------------------------------------------ palette */
  function palette(skin, mood) {
    var s = skin.c, pl = Object.prototype.toString.call(s.plate) === '[object Array]' ? s.plate.slice() : [s.plate], i;
    var c = { body: s.body, shade: s.shade, light: s.light, belly: s.belly, bellyShade: s.bellyShade,
      plates: pl, glow: s.plateGlow, out: s.out, cheek: s.cheek };
    if (mood === 'sick') {
      c.body = mix(s.body, '#9db784', .44); c.shade = mix(s.shade, '#63835a', .44); c.light = mix(s.light, '#d6e6b8', .44);
      c.belly = mix(s.belly, '#e6eed0', .44); c.bellyShade = mix(s.bellyShade, '#bccd9a', .44); c.cheek = '#93cc74';
      for (i = 0; i < pl.length; i++) pl[i] = mix(pl[i], '#b9c4b4', .4);
      c.glow = mix(s.plateGlow, '#d6ddd0', .4);
    }
    c.far = mix(c.body, c.shade, .72);
    c.mouth = mix(c.out, '#6e0f2c', .5);
    c.tongue = '#ff7d96';
    c.shell = mix('#fffaf0', s.light, .22);
    c.shellShade = mix(c.shell, s.shade, .3);
    return c;
  }

  /* ------------------------------------------------------------------ gabarits par stade */
  var RIGS = {
    1: { hx: 206, hy: 276, hr: 47, m: .18, bx: 197, by: 326, brx: 39, bry: 31, tl: 36, tt: 28, leg: 13, arm: 9, ax: .2, ay: .1, np: [2, 0, 0], ps: 11, e: 1.2 },
    2: { hx: 208, hy: 226, hr: 53, m: .26, bx: 197, by: 303, brx: 52, bry: 50, tl: 60, tt: 44, leg: 19, arm: 13, ax: -.02, ay: -.12, np: [1, 3, 2], ps: 21, e: 1.15 },
    3: { hx: 213, hy: 173, hr: 57, m: .34, bx: 197, by: 279, brx: 60, bry: 75, tl: 84, tt: 56, leg: 25, arm: 17, ax: -.1, ay: -.3, np: [2, 3, 3], ps: 30, e: 1.06 },
    4: { hx: 219, hy: 126, hr: 64, m: .4, bx: 197, by: 258, brx: 72, bry: 96, tl: 104, tt: 70, leg: 31, arm: 21, ax: -.12, ay: -.3, np: [2, 4, 3], ps: 43, e: 1.02 },
    5: { hx: 238, hy: 152, hr: 60, m: .44, bx: 194, by: 266, brx: 78, bry: 88, tl: 94, tt: 64, leg: 29, arm: 20, ax: -.04, ay: -.16, np: [2, 4, 3], ps: 29, e: .95, hump: 1 }
  };
  function rig(stage, form, skin) {
    var src = RIGS[stage === 4 && form === 'grognon' ? 5 : stage], R = {}, k;
    for (k in src) R[k] = src[k];
    R.brx *= skin.chub || 1;
    R.tt *= .9 + .1 * (skin.chub || 1);
    if (skin.eyeBig) R.e *= 1.18;
    R.x0 = R.bx - .55 * R.brx;                       /* racine de la queue */
    var left = R.x0 - R.tl, right = R.hx + (1 + R.m) * R.hr;
    var sh = (200 - (left + right) / 2) * .75;       /* recentrage dans le viewBox */
    R.hx += sh; R.bx += sh; R.x0 += sh;
    R.left = left + sh; R.right = right + sh;
    return R;
  }

  /* ------------------------------------------------------------------ plaques dorsales */
  /* Repère local : base centrée en (0,0), pointe vers -y, +x = vers la tête. */
  function plateArt(type, s, c, o) {
    var w, h, b, d, hi, hiFill = c.glow, hiOp = o.titan ? .62 : .45;
    function q(x, y) { return f(x * w) + ',' + f(-y * h); }
    if (type === 'round') {
      w = s * .9; h = s * .7; b = h * .5;
      d = 'M' + q(-.5, 0) + (o.chip ? 'C' + q(-.52, .95) + ' ' + q(.1, 1.08) + ' ' + q(.24, .66) + 'L' + q(.36, .74) + 'C' + q(.46, .5) + ' ' + q(.5, .3) + ' ' + q(.5, 0)
        : 'C' + q(-.5, 1.33) + ' ' + q(.5, 1.33) + ' ' + q(.5, 0));
      hi = tag('ellipse', { cx: f(.13 * w), cy: f(-.55 * h), rx: f(.15 * w), ry: f(.2 * h), fill: hiFill, opacity: hiOp });
    } else if (type === 'crystal') {
      w = s * .74; h = s * 1.15; b = h * .3;
      d = 'M' + q(-.5, 0) + 'L' + q(-.52, .34) + (o.chip ? 'L' + q(-.3, .66) + 'L' + q(-.04, .56) + 'L' + q(.26, .8) : 'L' + q(-.14, 1) + 'L' + q(.3, .74)) + 'L' + q(.5, .12) + 'L' + q(.5, 0);
      hi = path('M' + (o.chip ? q(-.04, .56) + 'L' + q(.26, .8) : q(-.14, 1) + 'L' + q(.3, .74)) + 'L' + q(.5, .12) + 'L' + q(.5, -.3) + 'L' + q(.04, -.3) + 'L' + q(.02, .3) + 'Z', hiFill, { opacity: hiOp }) +
        path('M' + q(-.5, -.3) + 'L' + q(-.52, .34) + 'L' + (o.chip ? q(-.3, .66) : q(-.14, 1)) + 'L' + q(-.22, .2) + 'L' + q(-.2, -.3) + 'Z', c.out, { opacity: .13 });
    } else if (type === 'fin') {
      w = s * .86; h = s * 1.02; b = h * .32;
      d = 'M' + q(-.5, 0) + 'C' + q(-.66, .5) + ' ' + q(-.62, .92) + ' ' + q(-.36, 1.02) +
        (o.chip ? 'C' + q(-.1, .98) + ' ' + q(.02, .8) + ' ' + q(.1, .66) + 'L' + q(.06, .46) + 'L' + q(.26, .5) + 'C' + q(.38, .34) + ' ' + q(.46, .18) + ' ' + q(.5, 0)
          : 'C' + q(.06, .96) + ' ' + q(.4, .5) + ' ' + q(.5, 0));
      hi = line('M' + q(.08, -.1) + 'Q' + q(-.06, .5) + ' ' + q(-.3, .82), hiFill, w * .07, { opacity: hiOp + .15 }) +
        line('M' + q(-.02, .3) + 'L' + q(.14, .42) + 'M' + q(-.12, .52) + 'L' + q(-.34, .5), hiFill, w * .05, { opacity: hiOp });
    } else { /* tri */
      w = s * .82; h = s * 1.12; b = h * .3;
      d = 'M' + q(-.5, 0) + (o.chip ? 'L' + q(-.26, .56) + 'L' + q(-.1, .44) + 'L' + q(.06, .8) + 'L' + q(.14, .7)
        : 'L' + q(-.17, .9) + 'Q' + q(-.11, 1.05) + ' ' + q(.01, .93)) + 'L' + q(.5, 0);
      hi = path('M' + (o.chip ? q(.06, .8) + 'L' + q(.14, .7) : q(-.1, .98) + 'L' + q(.01, .93)) + 'L' + q(.5, 0) + 'L' + q(.5, -.3) + 'L' + q(-.02, -.3) + 'Z', hiFill, { opacity: hiOp });
    }
    d += 'L' + f(w / 2) + ',' + f(b) + 'L' + f(-w / 2) + ',' + f(b) + 'Z';
    return { d: d, hi: hi, h: h };
  }
  function plate(type, p, s, i, c, o) {
    var col = c.plates[i % c.plates.length], art = plateArt(type, s, c, o), k = o.titan ? 1.24 : 1.18, cy = -art.h * .4;
    var tilt = o.chip ? ((i % 2) ? 9 : -7) : 0;
    return '<g transform="translate(' + f(p.x) + ',' + f(p.y) + ') rotate(' + f(p.a + tilt) + ')">' +
      path(art.d, o.ghost ? '#ffffff' : c.glow, { 'class': 'mt-glow', opacity: o.ghost ? .3 : (o.chip ? .28 : .45), transform: 'translate(0,' + f(cy) + ') scale(' + k + ') translate(0,' + f(-cy) + ')', style: 'animation-delay:-' + f(i * .37) + 's' }) +
      path(art.d, col, o.ghost ? { opacity: .6 } : null) + (o.ghost ? '' : art.hi) + '</g>';
  }
  function plateSize(i, n) { /* petit sur la tête, maximal au milieu du dos, décroissant sur la queue */
    var q = (i + .5) / n;
    return .5 + .5 * Math.pow(Math.sin(Math.PI * Math.min(1, q * .92 + .1)), .8);
  }
  var HEAD_U = { 1: [10.35], 2: [10.62, 9.78], 3: [10.75, 10.08, 9.4] };
  var BODY_U = { 2: [8.5, 7.6], 3: [8.62, 7.98, 7.32], 4: [8.72, 8.2, 7.68, 7.14] };
  var TAIL_U = { 1: [1.8], 2: [1.55, 2.3], 3: [1.45, 2.02, 2.55] };

  /* ------------------------------------------------------------------ motifs */
  function stripe(p, len, w, fill, op) {
    var bx = p.x + p.nx * 5, by = p.y + p.ny * 5, mx = p.x - p.nx * len * .5, my = p.y - p.ny * len * .5;
    return path('M' + f(bx + p.tx * w / 2) + ',' + f(by + p.ty * w / 2) +
      'Q' + f(mx + p.tx * w * .42) + ',' + f(my + p.ty * w * .42) + ' ' + f(p.x - p.nx * len) + ',' + f(p.y - p.ny * len) +
      'Q' + f(mx - p.tx * w * .42) + ',' + f(my - p.ty * w * .42) + ' ' + f(bx - p.tx * w / 2) + ',' + f(by - p.ty * w / 2) + 'Z', fill, { opacity: op });
  }

  /* ------------------------------------------------------------------ pattes */
  function legD(x, g, s, dx, dy) {
    x += dx || 0; g += dy || 0;
    return 'M' + f(x - .5 * s) + ',' + f(g) + 'L' + f(x + 1.2 * s) + ',' + f(g) +
      'C' + f(x + 1.68 * s) + ',' + f(g) + ' ' + f(x + 1.68 * s) + ',' + f(g - .72 * s) + ' ' + f(x + 1.16 * s) + ',' + f(g - .74 * s) +
      'C' + f(x + .86 * s) + ',' + f(g - .76 * s) + ' ' + f(x + .66 * s) + ',' + f(g - .84 * s) + ' ' + f(x + .62 * s) + ',' + f(g - 1.1 * s) +
      'C' + f(x + .6 * s) + ',' + f(g - 1.85 * s) + ' ' + f(x - .95 * s) + ',' + f(g - 1.85 * s) + ' ' + f(x - .95 * s) + ',' + f(g - .92 * s) +
      'C' + f(x - .95 * s) + ',' + f(g - .4 * s) + ' ' + f(x - .86 * s) + ',' + f(g) + ' ' + f(x - .5 * s) + ',' + f(g) + 'Z';
  }
  function toes(x, g, s, fill) {
    return ellipse(x + 1.46 * s, g - .25 * s, .15 * s, .22 * s, fill) + ellipse(x + 1.14 * s, g - .22 * s, .15 * s, .22 * s, fill) + ellipse(x + .82 * s, g - .22 * s, .15 * s, .22 * s, fill);
  }

  /* ------------------------------------------------------------------ coquille (œuf + chapeau du bébé) */
  function shellSpots(cx, cy, k, c, seed, n) {
    var S = [[-.52, -.56, .2], [.34, -.86, .13], [.5, -.22, .24], [-.12, -.12, .15], [-.62, .08, .12], [.1, -.5, .1], [.08, .42, .18], [-.4, .5, .1]], s = '', i, col;
    for (i = 0; i < (n || S.length); i++) {
      col = (i + seed) % 3 === 0 ? c.plates[(i + seed) % c.plates.length] : (i % 2 ? c.body : c.light);
      s += circle(cx + S[i][0] * k, cy + S[i][1] * k, S[i][2] * k, col, { opacity: .85 });
    }
    return s;
  }

  /* ------------------------------------------------------------------ visage */
  function eye(cx, cy, rx, ry, kind, c, rot) {
    var sw = Math.max(2.4, rx * .52);
    if (kind === 'arc') return line('M' + f(cx - rx) + ',' + f(cy + ry * .3) + 'Q' + f(cx) + ',' + f(cy - ry * 1.05) + ' ' + f(cx + rx) + ',' + f(cy + ry * .3), c.out, sw);
    if (kind === 'closed') return line('M' + f(cx - rx) + ',' + f(cy) + 'Q' + f(cx) + ',' + f(cy + ry * .85) + ' ' + f(cx + rx) + ',' + f(cy), c.out, sw);
    if (kind === 'heart') return path(heartD(cx, cy, rx * 1.22), '#ff3d6e') + circle(cx - rx * .45, cy - rx * .4, rx * .26, '#ffffff', { opacity: .9 });
    if (kind === 'spiral') {
      var R = rx * 1.05;
      return line('M' + f(cx) + ',' + f(cy) + 'a' + f(R * .25) + ',' + f(R * .25) + ' 0 0 1 ' + f(R * .5) + ',0a' + f(R * .5) + ',' + f(R * .5) + ' 0 0 1 ' + f(-R) + ',0a' + f(R * .75) + ',' + f(R * .75) + ' 0 0 1 ' + f(R * 1.5) + ',0a' + f(R) + ',' + f(R) + ' 0 0 1 ' + f(-R * 1.85) + ',' + f(R * .5), c.out, Math.max(2, rx * .3));
    }
    if (kind === 'wide') return circle(cx, cy, ry * 1.02, '#ffffff') + circle(cx + rx * .12, cy, rx * .5, c.out) + circle(cx + rx * .3, cy - rx * .2, rx * .16, '#ffffff');
    return ellipse(cx, cy, rx, ry, c.out, rot ? { transform: 'rotate(' + rot + ' ' + f(cx) + ' ' + f(cy) + ')' } : null) +
      circle(cx + rx * .3, cy - ry * .38, rx * .34, '#ffffff');
  }

  /* ------------------------------------------------------------------ le monstre */
  function dino(skin, o, uid) {
    var c = palette(skin, o.mood), R = rig(o.stage, o.form, skin), mood = o.mood;
    var grog = o.stage === 4 && o.form === 'grognon', titan = o.stage === 4 && !grog;
    var hr = R.hr, hx = R.hx, hy = R.hy, m = R.m, jaw = mood === 'eat' ? .14 : 0;
    var bx = R.bx, by = R.by, brx = R.brx, bry = R.bry, hump = R.hump || 0;
    function H(x, y) { return [hx + x * hr, hy + y * hr]; }
    function B(x, y) { return [bx + x * brx, by + y * bry]; }
    function id(n) { return uid + n; }
    function url(n) { return 'url(#' + uid + n + ')'; }
    var po = { titan: titan, chip: grog };

    /* --- formes principales --- */
    var headS = blob([H(-.05, -1), H(.6, -.82), H(.97, -.3), H(1 + m * .85, .06), H(1 + m, .4 + jaw * .3), H(.78 + m * .7, .76 + jaw),
      H(.3, .93 + jaw * .8), H(-.45, .86), H(-.94, .44), H(-1.02, -.18), H(-.7, -.76)]);
    var bodyS = blob([B(.1, -1), B(.55, -.72), B(.88, -.08), B(.98, .46), B(.58, .96), B(-.2, 1), B(-.8, .8), B(-1, .25),
      B(-.77 - hump * .13, -.48), B(-.4 - hump * .16, -.9)]);
    var x0 = R.x0, L = R.tl, T = R.tt, yg = GROUND - 3, lift = Math.min(T * .24, 15);
    var tailS = blob([[x0 + .3 * L, yg - T * 1.02], [x0 - .15 * L, yg - T * .9], [x0 - .52 * L, yg - T * .56], [x0 - .84 * L, yg - T * .22 - lift],
      [x0 - L, yg - T * .14 - lift * 1.6], [x0 - .9 * L, yg - T * .01 - lift * .6], [x0 - .5 * L, yg], [x0 - .1 * L, yg + .5], [x0 + .3 * L, yg]]);
    var headD = blobD(headS), bodyD = blobD(bodyS), tailD = blobD(tailS);

    /* --- plaques --- */
    var nh = R.np[0], nb = R.np[1], nt = R.np[2], N = nh + nb + nt, i, u;
    var headPl = '', bodyPl = '', tailPl = '';
    var hu = o.stage === 1 ? [9.95, 9.38] : HEAD_U[nh];   /* bébé : deux bosses sous le chapeau de coquille */
    for (i = 0; i < nh; i++) headPl += plate(skin.plate, at(headS, hu[i]), R.ps * plateSize(i, N), i, c, po);
    for (i = nb - 1; i >= 0; i--) bodyPl += plate(skin.plate, at(bodyS, BODY_U[nb][i]), R.ps * plateSize(nh + i, N), nh + i, c, po);
    for (i = nt - 1; i >= 0; i--) tailPl += plate(skin.plate, at(tailS, TAIL_U[nt][i], true), R.ps * plateSize(nh + nb + i, N), nh + nb + i, c, po);

    /* --- motifs --- */
    var patH = '', patB = '', patT = '', pc = c.shade;
    if (skin.pattern === 'stripes') {
      u = [10.2, 9.45]; for (i = 0; i < u.length; i++) patH += stripe(at(headS, u[i]), hr * .5, hr * .22, pc, .7);
      u = [8.35, 7.82, 7.3, 6.75]; for (i = 0; i < u.length; i++) patB += stripe(at(bodyS, u[i]), brx * (.5 + .12 * (i % 2)), bry * .17, pc, .7);
      u = [1.55, 2.15, 2.75]; for (i = 0; i < u.length; i++) patT += stripe(at(tailS, u[i], true), T * (.62 - i * .12), T * .34, pc, .7);
    } else if (skin.pattern === 'spots') {
      patH = circle(hx - .52 * hr, hy - .5 * hr, .13 * hr, pc, { opacity: .45 }) + circle(hx - .16 * hr, hy - .74 * hr, .08 * hr, pc, { opacity: .45 }) + circle(hx - .76 * hr, hy - .08 * hr, .08 * hr, pc, { opacity: .45 });
      patB = circle(bx - .52 * brx, by - .34 * bry, .14 * brx, pc, { opacity: .45 }) + circle(bx - .74 * brx, by + .12 * bry, .1 * brx, pc, { opacity: .45 }) +
        circle(bx - .36 * brx, by + .04 * bry, .07 * brx, pc, { opacity: .45 }) + circle(bx - .58 * brx, by + .5 * bry, .08 * brx, pc, { opacity: .45 });
      patT = circle(x0 - .42 * L, yg - T * .5, T * .15, pc, { opacity: .45 }) + circle(x0 - .68 * L, yg - T * .46, T * .1, pc, { opacity: .45 });
    }

    /* --- visage : positions --- */
    var e = Math.min(R.e, 1.4), ex1 = .17 - Math.max(0, e - 1.1) * .2, ey1 = -.1, ex2 = .82, ey2 = -.13;
    var rx1 = .18 * e * hr, ry1 = .24 * e * hr, rx2 = .14 * e * hr, ry2 = .21 * e * hr;
    var E1 = H(ex1, ey1), E2 = H(ex2, ey2);
    var kind = { happy: 'arc', eat: 'arc', love: 'heart', sick: 'spiral', sleep: 'closed', surprised: 'wide' }[mood] || 'oval';
    var eyes = eye(E1[0], E1[1], rx1, ry1, kind, c, mood === 'sad' ? -14 : 0) + eye(E2[0], E2[1], rx2, ry2, kind, c, mood === 'sad' ? 14 : 0);
    /* sourcils : [extérieur, intérieur] décalages verticaux en fraction de ry (négatif = haut) */
    var brow = null, lid = false, bw = .085 * hr;
    if (mood === 'angry') { brow = [-.25, .42]; lid = true; bw = .1 * hr; }
    else if (mood === 'sad') brow = [.28, -.3];
    else if (mood === 'surprised') brow = [-.5, -.72];
    else if (grog && mood !== 'sleep' && mood !== 'love') { brow = [-.12, .4]; lid = kind === 'oval'; bw = .1 * hr; }
    else if (o.stage === 3 && (mood === 'neutral')) { brow = [-.12, .12]; bw = .07 * hr; }
    var brows = '', lids = '';
    function browAt(E, rx, ry, a, b2, n) {
      var bl = lid ? 1.15 : .95, y = E[1] - ry * 1.32, x1 = E[0] - rx * bl, x2 = E[0] + rx * bl;
      /* paupière = l'œil est découpé sous la ligne du sourcil (clipPath), aucune pastille de couleur */
      if (lid) lids += clip(id('l' + n), 'M' + f(x1 - 4) + ',' + f(y + a * ry + ry * .42) + 'L' + f(x2 + 4) + ',' + f(y + b2 * ry + ry * .42) + 'L' + f(x2 + 4) + ',' + f(E[1] + ry * 2) + 'L' + f(x1 - 4) + ',' + f(E[1] + ry * 2) + 'Z');
      brows += line('M' + f(x1) + ',' + f(y + a * ry) + 'L' + f(x2) + ',' + f(y + b2 * ry), c.out, bw);
    }
    if (brow) { browAt(E1, rx1, ry1, brow[0], brow[1], 1); browAt(E2, rx2 * .95, ry2, brow[1], brow[0], 2); }
    if (lid) eyes = '<g clip-path="' + url('l1') + '">' + eye(E1[0], E1[1], rx1, ry1, kind, c, 0) + '</g><g clip-path="' + url('l2') + '">' + eye(E2[0], E2[1], rx2, ry2, kind, c, 0) + '</g>';

    /* --- bouche --- */
    var y0 = .47, mx1 = .5, mx2 = 1 + m * .62, mcx = (mx1 + mx2) / 2, mw = .075 * hr, rest = '';
    function M(x, y) { return P(H(x, y)); }
    var frown = 'M' + M(mx1 + .1, y0 + .1) + 'Q' + M(mcx + .05, y0 - .1) + ' ' + M(mx2 - .04, y0 + .08);
    if (mood === 'happy' || mood === 'love') {
      rest = path('M' + M(mx1, y0 - .04) + 'Q' + M(mcx, y0 + .06) + ' ' + M(mx2, y0 - .06) + 'C' + M(mx2 - .02, y0 + .26) + ' ' + M(mcx + .12, y0 + .36) + ' ' + M(mcx - .02, y0 + .34) +
        'C' + M(mx1 + .12, y0 + .32) + ' ' + M(mx1 + .02, y0 + .16) + ' ' + M(mx1, y0 - .04) + 'Z', c.mouth) +
        ellipse(hx + (mcx + .02) * hr, hy + (y0 + .25) * hr, .15 * hr, .065 * hr, c.tongue);
    } else if (mood === 'sad') rest = line(frown, c.out, mw);
    else if (mood === 'angry') {
      rest = line(frown, c.out, mw * 1.1) + path('M' + M(mx2 - .3, y0 + .02) + 'l' + f(.06 * hr) + ',' + f(-.14 * hr) + 'l' + f(.07 * hr) + ',' + f(.13 * hr) + 'Z', '#ffffff');
    } else if (mood === 'sick') {
      rest = line('M' + M(mx1 + .08, y0 + .05) + 'q' + f(.08 * hr) + ',' + f(-.1 * hr) + ' ' + f(.16 * hr) + ',0t' + f(.16 * hr) + ',0t' + f(.16 * hr) + ',0', c.out, mw);
    } else if (mood === 'sleep') rest = line('M' + M(mcx - .12, y0 + .02) + 'Q' + M(mcx + .04, y0 + .12) + ' ' + M(mcx + .2, y0 + .02), c.out, mw);
    else if (mood === 'surprised') rest = ellipse(hx + (mcx + .14) * hr, hy + (y0 + .1) * hr, .1 * hr, .13 * hr, c.mouth);
    else if (mood === 'eat') rest = '';
    else if (grog) rest = line(frown, c.out, mw);
    else rest = line('M' + M(mx1 + .04, y0 - .02) + 'Q' + M(mcx + .02, y0 + .22) + ' ' + M(mx2, y0 - .05), c.out, mw);
    /* bouche ouverte (humeur « eat » et animation de mâche) */
    var yt = y0 - .06, dp = .3 + jaw * .9;
    var open = '<g class="mt-mo">' +
      path('M' + M(mx1 + .04, yt) + 'Q' + M(mcx, yt - .05) + ' ' + M(mx2, yt - .03) + 'C' + M(mx2 + .02, yt + dp * .75) + ' ' + M(mcx + .2, yt + dp * 1.05) + ' ' + M(mcx, yt + dp) +
        'C' + M(mx1 + .16, yt + dp * .95) + ' ' + M(mx1 + .02, yt + dp * .5) + ' ' + M(mx1 + .04, yt) + 'Z', c.mouth) +
      ellipse(hx + (mcx + .02) * hr, hy + (yt + dp * .76) * hr, .15 * hr, dp * .2 * hr, c.tongue) +
      tag('rect', { x: f(hx + (mcx + .08) * hr), y: f(hy + (yt - .05) * hr), width: f(.11 * hr), height: f(.12 * hr), rx: f(.045 * hr), fill: '#ffffff' }) +
      tag('rect', { x: f(hx + (mcx + .26) * hr), y: f(hy + (yt - .05) * hr), width: f(.1 * hr), height: f(.11 * hr), rx: f(.045 * hr), fill: '#ffffff' }) + '</g>';

    /* --- accessoires d'humeur --- */
    var fxHead = '', fx = '', pcol = c.plates[0], zy;
    if (mood === 'sad') fxHead += path(dropD(E1[0] - rx1 * .1, E1[1] + ry1 + .3 * hr, .075 * hr), '#7fd6ff', { 'class': 'mt-fx mt-tear' });
    if (mood === 'sick') {
      var t1 = H(mx2 - .2, y0 + .04), t2 = H(mx2 + .42, y0 - .26);
      fxHead += line('M' + P(t1) + 'L' + P(t2), '#eef2f7', .1 * hr) + line('M' + P(t1) + 'L' + f(t1[0] + (t2[0] - t1[0]) * .55) + ',' + f(t1[1] + (t2[1] - t1[1]) * .55), '#ff5a6a', .045 * hr) +
        circle(t2[0], t2[1], .075 * hr, '#ff5a6a') +
        path(dropD(hx - .45 * hr, hy - .42 * hr, .08 * hr), '#a8e4ff', { 'class': 'mt-fx mt-sweat', opacity: .9 });
    }
    if (mood === 'sleep') {
      var nb2 = H(1 + m * .95, .2);
      fxHead += '<g class="mt-fx mt-bubble">' + circle(nb2[0] + .17 * hr, nb2[1] - .02 * hr, .17 * hr, '#ffffff', { opacity: .5 }) + circle(nb2[0] + .23 * hr, nb2[1] - .09 * hr, .045 * hr, '#ffffff', { opacity: .9 }) + '</g>';
      for (i = 0; i < 3; i++) {
        var zs = hr * (.13 + i * .045), zx = hx + hr * (.95 + i * .34);
        zy = Math.max(14 + zs, hy - hr * (1.02 + i * .36));
        fx += line('M' + f(zx) + ',' + f(zy - zs) + 'h' + f(zs) + 'l' + f(-zs) + ',' + f(zs) + 'h' + f(zs), pcol, zs * .3, { 'class': 'mt-fx mt-zz', style: 'animation-delay:' + f(i * .5) + 's' });
      }
    }
    if (mood === 'love') {
      var hp = [[-.55, -1.22, .13], [1.12, -1.12, .16], [.36, -1.5, .11]];
      for (i = 0; i < 3; i++) fx += path(heartD(hx + hp[i][0] * hr, Math.max(22, hy + hp[i][1] * hr), hp[i][2] * hr), '#ff5d8f', { 'class': 'mt-fx mt-heart', style: 'animation-delay:' + f(i * .45) + 's' });
    }
    if (mood === 'angry') {
      var am = H(1.02, -.92), k = hr / 60;
      fx += '<g class="mt-fx mt-vein"><g transform="translate(' + P(am) + ') scale(' + f(k) + ')">' + line('M-7,-2q5,-1 5,-6M2,-8q0,5 6,5M7,2q-5,1 -5,6M-2,8q0,-5 -6,-5', '#ff4d5e', 3.6) + '</g></g>';
    }
    if (mood === 'surprised') {
      var sm = H(1.0, -.98);
      fx += line('M' + P(sm) + 'l' + f(.06 * hr) + ',' + f(-.2 * hr) + 'M' + f(sm[0] + .2 * hr) + ',' + f(sm[1] + .1 * hr) + 'l' + f(.17 * hr) + ',' + f(-.13 * hr) + 'M' + f(sm[0] + .3 * hr) + ',' + f(sm[1] + .32 * hr) + 'l' + f(.2 * hr) + ',' + f(-.02 * hr), pcol, .06 * hr, { 'class': 'mt-fx mt-pop' });
    }

    /* --- membres --- */
    var ls = R.leg, lx = bx - .1 * brx, fl = bx + .6 * brx;
    var a = R.arm, sx = bx + R.ax * brx, sy = by + R.ay * bry;
    /* bras = capsule qui part de l'épaule (x, y) ; rot = angle vers le bas */
    var ARM = [[-.5, -.22], [.2, -.55], [1.1, -.44], [1.66, -.14], [1.66, .3], [1.1, .52], [.2, .52], [-.45, .3]];
    function arm(x, y, k, rot, fill, dx, dy, op) {
      var cs = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180), pts = [], j;
      x += dx || 0; y += dy || 0;
      for (j = 0; j < ARM.length; j++) pts.push([x + (ARM[j][0] * cs - ARM[j][1] * sn) * a * k, y + (ARM[j][0] * sn + ARM[j][1] * cs) * a * k]);
      return path(blobD(blob(pts)), fill, { opacity: op });
    }
    var armC = [sx, sy];
    var cheekR = (mood === 'love' ? .2 : .16) * hr, CH = H(.06, .36);
    var horn = '';
    if (skin.horn && o.stage >= 3) {
      var hp2 = at(headS, 2.6), hs = hr * (titan ? .52 : grog ? .34 : .28), hw = hs * .74;
      horn = '<g transform="translate(' + f(hp2.x - hp2.nx * 2) + ',' + f(hp2.y - hp2.ny * 2) + ') rotate(' + f(hp2.a - 14) + ')">' +
        path('M' + f(-hw / 2) + ',' + f(hs * .3) + 'L' + f(-hw / 2) + ',0Q' + f(-hw * .34) + ',' + f(-hs * .7) + ' ' + f(hw * .12) + ',' + f(-hs) + 'Q' + f(hw * .42) + ',' + f(-hs * .5) + ' ' + f(hw / 2) + ',0L' + f(hw / 2) + ',' + f(hs * .3) + 'Z', c.glow) +
        path('M' + f(-hw / 2) + ',' + f(hs * .3) + 'L' + f(-hw / 2) + ',0Q' + f(-hw * .34) + ',' + f(-hs * .7) + ' ' + f(hw * .12) + ',' + f(-hs) + 'Q' + f(-hw * .05) + ',' + f(-hs * .4) + ' ' + f(-hw * .1) + ',' + f(hs * .3) + 'Z', c.shade, { opacity: .28 }) + '</g>';
    }
    var cap = '';
    if (o.stage === 1) {
      var cc = H(-.16, -.8), ck = hr * .62;
      cap = '<g transform="translate(' + P(cc) + ') rotate(-13)">' + clip(id('k'), 'M' + f(-ck) + ',0C' + f(-ck) + ',' + f(-ck * 1.18) + ' ' + f(ck) + ',' + f(-ck * 1.18) + ' ' + f(ck) + ',0L' + f(ck * .62) + ',' + f(ck * .24) + 'L' + f(ck * .3) + ',' + f(-ck * .02) + 'L0,' + f(ck * .26) + 'L' + f(-ck * .32) + ',' + f(-ck * .02) + 'L' + f(-ck * .64) + ',' + f(ck * .24) + 'Z') +
        '<g clip-path="' + url('k') + '">' + tag('rect', { x: f(-ck), y: f(-ck), width: f(ck * 2), height: f(ck * 1.4), fill: c.shell }) +
        shellSpots(0, -ck * .16, ck * .92, c, hash(skin.id) % 3, 4) +
        tag('rect', { x: f(-ck), y: f(-ck), width: f(ck * .5), height: f(ck * 1.4), fill: c.shellShade, opacity: .35 }) + '</g></g>';
    }

    /* --- assemblage --- */
    var s = '<defs>' + grad(id('b'), mix(c.body, c.light, .55), c.body) + grad(id('v'), c.belly, c.bellyShade) +
      clip(id('h'), headD) + clip(id('c'), bodyD) + clip(id('t'), tailD) + lids +
      '<clipPath id="' + id('w') + '">' + tag('ellipse', { cx: f(bx + .44 * brx), cy: f(by + .2 * bry), rx: f(.64 * brx), ry: f(.8 * bry) }) + '</clipPath></defs>';
    s += tag('ellipse', { 'class': 'mt-shadow', cx: f((R.left + R.right) / 2 + 6), cy: GROUND + 1, rx: f((R.right - R.left) * .43), ry: f(5 + hr * .09), fill: '#000000', opacity: .16 });
    s += '<g class="mt-all"><g class="mt-br">';
    /* queue */
    s += '<g class="mt-tail">' + tailPl + path(tailD, url('b')) + '<g clip-path="' + url('t') + '">' +
      path(tailD + blobD(tailS, 2, -T * .2), c.shade, { 'fill-rule': 'evenodd', opacity: .4 }) + patT + '</g></g>';
    /* membres du fond */
    s += arm(bx + .62 * brx, sy - .02 * bry, .92, 24, c.far);
    s += path(legD(fl, GROUND - 4, ls * .84), c.far) + toes(fl, GROUND - 4, ls * .84, mix(c.belly, c.shade, .4));
    /* corps */
    s += bodyPl + path(bodyD, url('b')) + '<g clip-path="' + url('c') + '">' +
      path(bodyD + blobD(bodyS, brx * .13, -bry * .06), c.shade, { 'fill-rule': 'evenodd', opacity: .42 }) + patB +
      tag('ellipse', { cx: f(bx + .44 * brx), cy: f(by + .2 * bry), rx: f(.64 * brx), ry: f(.8 * bry), fill: url('v') });
    if (o.stage >= 2) {
      s += '<g clip-path="' + url('w') + '">';
      for (i = 0; i < (o.stage >= 3 ? 3 : 2); i++) {
        u = by + bry * (-.08 + i * .3);
        s += line('M' + f(bx - .3 * brx) + ',' + f(u - bry * .04) + 'Q' + f(bx + .4 * brx) + ',' + f(u + bry * .12) + ' ' + f(bx + 1.1 * brx) + ',' + f(u - bry * .08), c.bellyShade, Math.max(2, bry * .035), { opacity: .75 });
      }
      s += '</g>';
    }
    s += path(blobD(headS, -hr * .03, hr * .09), c.shade, { opacity: .32 }) +
      arm(armC[0], armC[1], 1, 36, c.shade, -a * .12, a * .2, .36) +
      path(legD(lx, GROUND, ls, -ls * .2, 0), c.shade, { opacity: .36 }) + '</g>';
    /* patte et bras du premier plan */
    s += path(legD(lx, GROUND, ls), url('b')) + toes(lx, GROUND, ls, c.belly);
    s += arm(armC[0], armC[1], 1, 36, mix(c.body, c.light, .3));
    /* tête */
    s += '<g class="mt-head">' + (mood === 'sleep' ? '<g transform="rotate(7 ' + f(hx - .1 * hr) + ' ' + f(hy + .8 * hr) + ')">' : '<g>') +
      headPl + horn + path(headD, url('b')) + '<g clip-path="' + url('h') + '">' +
      path(headD + blobD(headS, hr * .13, -hr * .09), c.shade, { 'fill-rule': 'evenodd', opacity: .42 }) + patH +
      ellipse(hx + .36 * hr, hy - .74 * hr, .27 * hr, .09 * hr, c.light, { opacity: .5, transform: 'rotate(17 ' + f(hx + .36 * hr) + ' ' + f(hy - .74 * hr) + ')' }) +
      circle(CH[0], CH[1], cheekR, c.cheek, { opacity: mood === 'love' ? 1 : .88 }) +
      '<g class="mt-eyes' + (kind === 'oval' || kind === 'wide' ? ' mt-blink' : '') + '">' + eyes + '</g>' + open + '</g>' +
      brows + circle(hx + (1 + m * .5) * hr, hy + .16 * hr, .032 * hr, c.out, { opacity: .7 }) + circle(hx + (1 + m * .82) * hr, hy + .2 * hr, .03 * hr, c.out, { opacity: .7 }) +
      '<g class="mt-mr">' + rest + '</g>' + cap + fxHead + '</g></g>';
    s += '</g>' + fx + '</g>';
    return s;
  }

  /* ------------------------------------------------------------------ l'œuf */
  function egg(skin, o, uid) {
    var c = palette(skin, 'neutral'), cx = 200, bot = GROUND - 2, Hh = 134, W = 108, top = bot - Hh, ym = bot - .4 * Hh, crack = o.crack;
    function eggD(dx, dy) {
      var x = cx + (dx || 0), t = top + (dy || 0), b = bot + (dy || 0), y = ym + (dy || 0);
      return 'M' + f(x) + ',' + f(t) + 'C' + f(x + .34 * W) + ',' + f(t) + ' ' + f(x + W / 2) + ',' + f(y - .24 * Hh) + ' ' + f(x + W / 2) + ',' + f(y) +
        'C' + f(x + W / 2) + ',' + f(y + .3 * Hh) + ' ' + f(x + .28 * W) + ',' + f(b) + ' ' + f(x) + ',' + f(b) +
        'C' + f(x - .28 * W) + ',' + f(b) + ' ' + f(x - W / 2) + ',' + f(y + .3 * Hh) + ' ' + f(x - W / 2) + ',' + f(y) +
        'C' + f(x - W / 2) + ',' + f(y - .24 * Hh) + ' ' + f(x - .34 * W) + ',' + f(t) + ' ' + f(x) + ',' + f(t) + 'Z';
    }
    var d = eggD(), yz = bot - .6 * Hh;
    var Z = [[-60, 2], [-42, -9], [-27, 5], [-11, -8], [5, 6], [21, -7], [37, 5], [60, -5]], zp = [], i;
    for (i = 0; i < Z.length; i++) zp.push([cx + Z[i][0], yz + Z[i][1]]);
    function poly(a, b) { var q = 'M' + P(zp[a]); for (var j = a + 1; j <= b; j++) q += 'L' + P(zp[j]); return q; }
    var shell = path(d, 'url(#' + uid + 'g)') + '<g clip-path="url(#' + uid + 'e)">' + shellSpots(cx, ym - 6, 62, c, hash(skin.id) % 3) +
      path(d + eggD(9, -7), c.shade, { 'fill-rule': 'evenodd', opacity: .3 }) +
      ellipse(cx + 20, top + 34, 9, 15, '#ffffff', { opacity: .55, transform: 'rotate(28 ' + (cx + 20) + ' ' + f(top + 34) + ')' }) + '</g>';
    var s = '<defs>' + grad(uid + 'g', c.shell, mix(c.shell, skin.c.light, .35)) + clip(uid + 'e', d);
    if (crack >= 3) s += clip(uid + 'u', poly(0, 7) + 'L400,0L0,0Z') + clip(uid + 'd', poly(0, 7) + 'L400,400L0,400Z');
    s += '</defs>' + tag('ellipse', { 'class': 'mt-shadow', cx: cx, cy: GROUND + 1, rx: 50, ry: 8, fill: '#000000', opacity: .16 });
    s += '<g class="mt-all"><g class="mt-br mt-egg mt-crack' + crack + '">';
    if (crack >= 3) {
      s += '<g clip-path="url(#' + uid + 'e)">' + ellipse(cx + 3, yz - 5, W * .4, 19, mix(c.out, c.shade, .25)) + '</g>' +
        ellipse(cx - 12, yz - 9, 4.2, 5.4, '#ffffff') + ellipse(cx + 12, yz - 10, 4.2, 5.4, '#ffffff') +
        circle(cx - 11, yz - 8.4, 2.3, c.out) + circle(cx + 13, yz - 9.4, 2.3, c.out) +
        '<g clip-path="url(#' + uid + 'd)">' + shell + '</g>' +
        '<g class="mt-lid"><g transform="translate(3,-13) rotate(6 ' + cx + ' ' + f(yz) + ')"><g clip-path="url(#' + uid + 'u)">' + shell + '</g></g></g>';
    } else {
      s += shell;
      if (crack === 1) s += line(poly(2, 5), c.out, 3, { opacity: .75 });
      if (crack === 2) s += line(poly(1, 6) + 'M' + P(zp[3]) + 'l7,-15l-8,-11M' + P(zp[4]) + 'l-5,14l8,10', c.out, 3.2, { opacity: .8 });
    }
    return s + '</g></g>';
  }

  /* ------------------------------------------------------------------ le petit fantôme-ange */
  function ghost(skin, o, uid) {
    var c = palette(skin, 'neutral'), R = rig(o.stage, o.form, skin), hr = R.hr, m = R.m, hx = 204, hy = 320 - 1.92 * hr, i;
    var grog = o.stage === 4 && o.form === 'grognon';
    function H(x, y) { return [hx + x * hr, hy + y * hr]; }
    var white = '#ffffff', tint = mix('#ffffff', skin.c.light, .42), ink = mix(skin.c.out, '#93a3c4', .45);
    var gc = { plates: [mix('#ffffff', c.plates[0], .3)], glow: '#ffffff', out: ink, shade: skin.c.shade };
    var headS = blob([H(-.05, -1), H(.6, -.82), H(.97, -.3), H(1 + m * .85, .06), H(1 + m, .4), H(.78 + m * .7, .76), H(.3, .93), H(-.45, .86), H(-.94, .44), H(-1.02, -.18), H(-.7, -.76)]);
    var bodyS = blob([H(.5, .5), H(.6, 1.1), H(.3, 1.6), H(-.25, 1.88), H(-.85, 1.98), H(-1.3, 1.74), H(-.98, 1.56), H(-.74, 1.22), H(-.84, .7), H(-.7, .2)]);
    var headD = blobD(headS), bodyD = blobD(bodyS);
    var nh = Math.max(1, R.np[0]), pl = '', bp = '', ps = Math.max(R.ps, 14) * .9;
    for (i = 0; i < nh; i++) pl += plate(skin.plate, at(headS, HEAD_U[nh][i]), ps * (.7 + i * .12), i, gc, { ghost: true, chip: grog });
    if (o.stage >= 2) { bp = plate(skin.plate, at(bodyS, 8.75), ps * .95, 2, gc, { ghost: true, chip: grog }) + plate(skin.plate, at(bodyS, 7.9), ps * .8, 3, gc, { ghost: true, chip: grog }); }
    var e = Math.min(R.e, 1.5), E1 = H(.2, -.1), E2 = H(.8, -.13), mcx = (.5 + 1 + m * .62) / 2, k = hr / 60;
    var wing = 'M2,2C-4,-24 -28,-36 -52,-26a9,9 0 0 0 7,14a9,9 0 0 0 9,12a9,9 0 0 0 12,9C-14,13 -4,10 2,2Z';
    var W = H(-.7, .74), HL = H(-.06, -1.3);
    var s = '<defs>' + grad(uid + 'b', white, tint) + '<linearGradient id="' + uid + 'q" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/>' +
      '<stop offset=".5" stop-color="' + tint + '" stop-opacity=".92"/><stop offset="1" stop-color="' + tint + '" stop-opacity=".12"/></linearGradient>' + clip(uid + 'h', headD) + '</defs>';
    s += tag('ellipse', { 'class': 'mt-shadow', cx: 200, cy: GROUND + 1, rx: f(hr * .7), ry: 6, fill: '#000000', opacity: .09 });
    s += '<g class="mt-all"><g class="mt-br mt-float"><g opacity=".93">';
    s += '<g transform="translate(' + P(W) + ') scale(' + f(k) + ') rotate(10)">' + path(wing, white) + path(wing, tint, { opacity: .5, transform: 'translate(3,5) scale(.72)' }) + '</g>';
    s += bp + path(bodyD, 'url(#' + uid + 'q)');
    s += ellipse(hx + .52 * hr, hy + 1.06 * hr, .2 * hr, .11 * hr, white, { transform: 'rotate(28 ' + f(hx + .52 * hr) + ' ' + f(hy + 1.06 * hr) + ')' });
    s += '<g class="mt-head">' + pl + path(headD, 'url(#' + uid + 'b)') + '<g clip-path="url(#' + uid + 'h)">' +
      path(headD + blobD(headS, hr * .13, -hr * .09), mix('#ffffff', skin.c.body, .6), { 'fill-rule': 'evenodd', opacity: .4 }) +
      circle(hx + .06 * hr, hy + .36 * hr, .16 * hr, skin.c.cheek, { opacity: .4 }) + '</g>' +
      '<g class="mt-eyes">' + eye(E1[0], E1[1], .18 * e * hr, .24 * e * hr, 'closed', gc) + eye(E2[0], E2[1], .14 * e * hr, .21 * e * hr, 'closed', gc) + '</g>' +
      line('M' + P(H(mcx - .14, .5)) + 'Q' + P(H(mcx + .04, .64)) + ' ' + P(H(mcx + .24, .48)), ink, .07 * hr) + '</g>';
    s += '<g class="mt-fx mt-halo">' + ellipse(HL[0], HL[1], .5 * hr, .13 * hr, 'none', { stroke: '#ffe58a', 'stroke-width': f(.2 * hr), opacity: .35, 'class': 'mt-glow' }) +
      ellipse(HL[0], HL[1], .5 * hr, .13 * hr, 'none', { stroke: '#ffd24d', 'stroke-width': f(.085 * hr) }) + '</g>';
    return s + '</g></g></g>';
  }

  /* ------------------------------------------------------------------ point d'entrée */
  function monster(skin, opts) {
    opts = opts || {};
    skin = skin && skin.c ? skin : (MT.SKINS && MT.SKINS[0]);
    var stage = Math.max(0, Math.min(4, Math.round(+opts.stage || 0)));
    var o = {
      stage: stage,
      form: stage === 4 ? (opts.form === 'grognon' ? 'grognon' : 'titan') : '',
      mood: MOODS[opts.mood] ? opts.mood : 'neutral',
      dead: opts.dead === true,
      crack: Math.max(0, Math.min(3, Math.round(+opts.crack || 0)))
    };
    var uid = String(opts.uid === undefined || opts.uid === null ? 'mt' : opts.uid).replace(/[^A-Za-z0-9_-]/g, '') || 'mt';
    uid += '-';
    var inner = stage === 0 ? egg(skin, o, uid) : o.dead ? ghost(skin, o, uid) : dino(skin, o, uid);
    var ghostly = o.dead && stage > 0;
    return '<svg class="mt-mon mt-s' + stage + (o.form ? ' mt-f-' + o.form : '') + ' mt-m-' + (ghostly || stage === 0 ? 'neutral' : o.mood) + (ghostly ? ' mt-dead' : '') +
      '" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mini-Titan">' + inner + '</svg>';
  }

  /* ------------------------------------------------------------------ animations */
  var css = [
    '.mt-mon{overflow:visible}',
    '.mt-mon .mt-all,.mt-mon .mt-shadow,.mt-mon .mt-br,.mt-mon .mt-tail,.mt-mon .mt-head,.mt-mon .mt-eyes,.mt-mon .mt-mo,.mt-mon .mt-lid,.mt-mon .mt-fx{transform-box:fill-box}',
    '.mt-mon .mt-all{transform-origin:50% 100%}',
    '.mt-mon .mt-shadow{transform-origin:50% 50%}',
    '.mt-mon .mt-br{transform-origin:50% 100%;animation:mt-breath 3.4s ease-in-out infinite}',
    '.mt-mon.mt-m-sleep .mt-br{animation:mt-breath-sleep 5.4s ease-in-out infinite}',
    '.mt-mon .mt-egg{animation:mt-egg 4s ease-in-out infinite}',
    '.mt-mon .mt-egg.mt-crack2{animation-duration:2.2s}',
    '.mt-mon .mt-egg.mt-crack3{animation-duration:1.5s}',
    '.mt-mon .mt-lid{transform-origin:20% 100%;animation:mt-lid 1.5s ease-in-out infinite}',
    '.mt-mon .mt-float{animation:mt-float 4.2s ease-in-out infinite}',
    '.mt-mon .mt-tail{transform-origin:94% 62%;animation:mt-tail 3.4s ease-in-out infinite}',
    '.mt-mon .mt-head{transform-origin:42% 90%}',
    '.mt-mon .mt-eyes{transform-origin:50% 50%}',
    '.mt-mon .mt-blink{animation:mt-blink 4.8s linear infinite}',
    '.mt-mon .mt-glow{animation:mt-glow 2.8s ease-in-out infinite}',
    '.mt-mon .mt-mo{opacity:0;transform-origin:50% 0}',
    '.mt-mon.mt-m-eat .mt-mo{opacity:1}',
    '.mt-mon .mt-zz{opacity:0;animation:mt-zz 2.4s ease-out infinite}',
    '.mt-mon .mt-tear{animation:mt-tear 2.2s ease-in infinite}',
    '.mt-mon .mt-sweat{animation:mt-tear 2.8s ease-in infinite}',
    '.mt-mon .mt-heart{transform-origin:50% 50%;animation:mt-heart 2.2s ease-in-out infinite}',
    '.mt-mon .mt-bubble{transform-origin:0 60%;animation:mt-bubble 5.4s ease-in-out infinite}',
    '.mt-mon .mt-vein{transform-origin:50% 50%;animation:mt-vein .9s ease-in-out infinite}',
    '.mt-mon .mt-pop{animation:mt-vein 1.2s ease-in-out infinite;transform-origin:0 100%}',
    '.mt-mon .mt-halo{animation:mt-halo 4.2s ease-in-out infinite}',
    '@keyframes mt-breath{0%,100%{transform:scale(1,1)}50%{transform:scale(.992,1.018)}}',
    '@keyframes mt-breath-sleep{0%,100%{transform:scale(1.008,.985)}50%{transform:scale(.99,1.025)}}',
    '@keyframes mt-egg{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}',
    '@keyframes mt-lid{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-5deg)}}',
    '@keyframes mt-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}',
    '@keyframes mt-tail{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-4.5deg)}}',
    '@keyframes mt-blink{0%,93%,100%{transform:scaleY(1)}96.5%{transform:scaleY(.08)}}',
    '@keyframes mt-glow{0%,100%{opacity:.22}50%{opacity:.72}}',
    '@keyframes mt-zz{0%{opacity:0;transform:translate(-6px,8px)}30%{opacity:1}100%{opacity:0;transform:translate(8px,-12px)}}',
    '@keyframes mt-tear{0%{opacity:0;transform:translateY(-4px)}20%{opacity:1}100%{opacity:0;transform:translateY(22px)}}',
    '@keyframes mt-heart{0%,100%{transform:translateY(0) scale(.9)}50%{transform:translateY(-7px) scale(1.12)}}',
    '@keyframes mt-bubble{0%,100%{transform:scale(.45)}50%{transform:scale(1.05)}}',
    '@keyframes mt-vein{0%,100%{transform:scale(.85)}50%{transform:scale(1.12)}}',
    '@keyframes mt-halo{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    /* actions (classe posée sur le parent du svg) */
    '.mt-act-jump .mt-mon .mt-all{animation:mt-jump 1s cubic-bezier(.3,.6,.4,1) both}',
    '.mt-act-jump .mt-mon .mt-shadow{animation:mt-jump-sh 1s ease-in-out both}',
    '.mt-act-hop .mt-mon .mt-all{animation:mt-hop 1s ease-in-out both}',
    '.mt-act-hop .mt-mon .mt-shadow{animation:mt-hop-sh 1s ease-in-out both}',
    '.mt-act-wiggle .mt-mon .mt-all{animation:mt-wiggle 1s ease-in-out both}',
    '.mt-act-no .mt-mon .mt-head{animation:mt-no 1s ease-in-out both}',
    '.mt-act-no .mt-mon.mt-s0 .mt-all,.mt-act-chomp .mt-mon.mt-s0 .mt-all{animation:mt-wiggle 1s ease-in-out both}',
    '.mt-act-chomp .mt-mon .mt-mr{opacity:0}',
    '.mt-act-chomp .mt-mon .mt-mo{animation:mt-chomp 1s ease-in-out both}',
    '.mt-act-chomp .mt-mon.mt-m-eat .mt-mo{animation-name:mt-chomp-eat}',
    '.mt-act-chomp .mt-mon .mt-head{animation:mt-nod 1s ease-in-out both}',
    '@keyframes mt-jump{0%,100%{transform:translateY(0) scale(1,1)}14%{transform:translateY(0) scale(1.07,.9)}42%{transform:translateY(-44px) scale(.96,1.06)}56%{transform:translateY(-48px) scale(1,1)}82%{transform:translateY(0) scale(1.08,.9)}92%{transform:translateY(0) scale(.98,1.03)}}',
    '@keyframes mt-jump-sh{0%,14%,82%,100%{transform:scale(1);opacity:.16}50%{transform:scale(.62);opacity:.08}}',
    '@keyframes mt-hop{0%,50%,100%{transform:translateY(0) rotate(0deg) scale(1,1)}8%,58%{transform:translateY(0) scale(1.04,.95)}25%{transform:translateY(-16px) rotate(-3.5deg) scale(.98,1.03)}75%{transform:translateY(-16px) rotate(3.5deg) scale(.98,1.03)}}',
    '@keyframes mt-hop-sh{0%,50%,100%{transform:scale(1)}25%,75%{transform:scale(.82)}}',
    '@keyframes mt-wiggle{0%,100%{transform:rotate(0deg) scale(1,1)}15%{transform:rotate(-6deg) scale(1.03,.97)}35%{transform:rotate(6deg) scale(.98,1.02)}55%{transform:rotate(-5deg) scale(1.03,.97)}75%{transform:rotate(4deg) scale(.99,1.01)}}',
    '@keyframes mt-no{0%,100%{transform:rotate(0deg)}12%{transform:rotate(-9deg)}32%{transform:rotate(8deg)}52%{transform:rotate(-8deg)}72%{transform:rotate(6deg)}88%{transform:rotate(-2deg)}}',
    '@keyframes mt-chomp{0%,33%,66%,100%{opacity:1;transform:scaleY(.14)}16%,50%,83%{opacity:1;transform:scaleY(1)}}',
    '@keyframes mt-chomp-eat{0%,33%,66%,100%{transform:scaleY(1)}16%,50%,83%{transform:scaleY(.14)}}',
    '@keyframes mt-nod{0%,33%,66%,100%{transform:translateY(0)}16%,50%,83%{transform:translateY(2.5px)}}',
    '@media (prefers-reduced-motion:reduce){.mt-mon .mt-br,.mt-mon .mt-tail,.mt-mon .mt-blink,.mt-mon .mt-glow,.mt-mon .mt-fx,.mt-mon .mt-lid{animation:none!important}.mt-mon .mt-zz{opacity:1}}'
  ].join('\n');

  MT.arts.c = { name: 'Illustration moderne douce', css: css, monster: monster };
})();
