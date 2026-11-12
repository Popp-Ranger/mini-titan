/* Mini-Titan — direction graphique « a » : JOUET VINYLE 3D.
   Figurine de designer : aucun contour, volumes modelés par dégradés (lumière en haut à gauche),
   reflets nets, occlusion douce aux jonctions, lumière de contour côté ombre, plaques en résine lumineuse.
   Fonction pure : MT.arts.a.monster(skin, opts) renvoie une chaîne SVG (viewBox 400×400, sol à y = 360). */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};
  MT.arts = MT.arts || {};

  /* ------------------------------------------------------------------ outils */
  var OX = 200, OY = 360;                       // origine locale : centre du personnage, au sol
  function r1(n) { return Math.round(n * 10) / 10; }
  function X(x) { return r1(OX + x); }
  function Y(y) { return r1(OY + y); }
  function XY(x, y) { return X(x) + ' ' + Y(y); }

  function rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b), s = '#', i, v;
    for (i = 0; i < 3; i++) { v = Math.round(A[i] + (B[i] - A[i]) * t).toString(16); s += v.length < 2 ? '0' + v : v; }
    return s;
  }
  function hash(str) { var h = 2166136261, i; for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* courbe fermée lisse passant par des points (Catmull-Rom → Bézier) */
  function blob(pts) {
    var n = pts.length, d = 'M' + XY(pts[0][0], pts[0][1]), i, p0, p1, p2, p3;
    for (i = 0; i < n; i++) {
      p0 = pts[(i + n - 1) % n]; p1 = pts[i]; p2 = pts[(i + 1) % n]; p3 = pts[(i + 2) % n];
      d += 'C' + XY(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        XY(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6) + ' ' + XY(p2[0], p2[1]);
    }
    return d + 'Z';
  }
  /* point + tangente du segment i → i+1 d'une courbe fermée lisse */
  function blobAt(pts, i, t) {
    var n = pts.length, p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return bez([p1, c1, c2, p2], t);
  }
  function bez(p, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return {
      x: a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
      y: a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1],
      dx: 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]),
      dy: 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1])
    };
  }

  function stops(a) {
    var s = '', i;
    for (i = 0; i < a.length; i++) s += '<stop offset="' + z(a[i][0]) + '" stop-color="' + a[i][1] + '"' + (a[i][2] != null ? ' stop-opacity="' + z(a[i][2]) + '"' : '') + '/>';
    return s;
  }
  function z(n) { return String(n).replace(/^0\./, '.'); }      // .45 plutôt que 0.45 (poids)
  function rad(id, g, a) {
    return '<radialGradient id="' + id + '" cx="' + z(g[0]) + '" cy="' + z(g[1]) + '" r="' + z(g[2]) + '"' +
      (g.length > 3 ? ' fx="' + z(g[3]) + '" fy="' + z(g[4]) + '"' : '') + '>' + stops(a) + '</radialGradient>';
  }
  function lin(id, g, a) {
    return '<linearGradient id="' + id + '" x1="' + z(g[0]) + '" y1="' + z(g[1]) + '" x2="' + z(g[2]) + '" y2="' + z(g[3]) + '">' + stops(a) + '</linearGradient>';
  }
  function E(cx, cy, rx, ry, fill, more) {
    return '<ellipse cx="' + X(cx) + '" cy="' + Y(cy) + '" rx="' + r1(Math.max(rx, 0.1)) + '" ry="' + r1(Math.max(ry, 0.1)) + '" fill="' + fill + '"' + (more || '') + '/>';
  }
  function C(cx, cy, r, fill, more) {
    return '<circle cx="' + X(cx) + '" cy="' + Y(cy) + '" r="' + r1(Math.max(r, 0.1)) + '" fill="' + fill + '"' + (more || '') + '/>';
  }
  function Pa(d, fill, more) { return '<path d="' + d + '" fill="' + fill + '"' + (more || '') + '/>'; }
  function line(d, col, w, more) {
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + r1(w) + '"' + (more || '') + '/>';   // bouts ronds hérités du <svg>
  }
  function rot(a, x, y) { return ' transform="rotate(' + r1(a) + ' ' + X(x) + ' ' + Y(y) + ')"'; }
  function org(x, y) { return ' style="transform-origin:' + X(x) + 'px ' + Y(y) + 'px"'; }
  function op(v) { return ' opacity="' + v + '"'; }

  /* ------------------------------------------------------------------ palette */
  function palette(sk, sick) {
    var s = sk.c, c = {
      body: s.body, shade: s.shade, light: s.light, belly: s.belly, bellyShade: s.bellyShade,
      plates: [].concat(s.plate), glow: s.plateGlow, out: s.out, cheek: s.cheek
    };
    if (sick) {                                  // teint pâle et verdâtre
      c.body = mix(s.body, '#b4c79a', 0.5); c.shade = mix(s.shade, '#74896a', 0.5); c.light = mix(s.light, '#e9f2cf', 0.55);
      c.belly = mix(s.belly, '#e2ead0', 0.4); c.bellyShade = mix(s.bellyShade, '#b9c7a0', 0.4); c.cheek = '#8fc56b';
    }
    return c;
  }

  function defs(c, uid, horn) {
    var u = uid, d = '', i, pc, rimc = mix(c.light, '#ffffff', 0.5);
    d += rad(u + 'sk', [0.36, 0.28, 0.82, 0.3, 0.2], [[0, c.light], [0.45, c.body], [1, c.shade]]);
    d += rad(u + 'sd', [0.36, 0.28, 0.85, 0.3, 0.2], [[0, mix(c.body, c.light, 0.15)], [0.5, mix(c.body, c.shade, 0.7)], [1, mix(c.shade, c.out, 0.35)]]);
    d += lin(u + 'tl', [0.3, 0, 0.45, 1], [[0, mix(c.body, c.light, 0.6)], [0.38, c.body], [1, c.shade]]);
    d += rad(u + 'be', [0.42, 0.3, 0.8], [[0, mix(c.belly, '#ffffff', 0.55)], [0.5, c.belly], [1, c.bellyShade]]);
    d += lin(u + 'rm', [0.25, 0.1, 0.92, 0.95], [[0, rimc, 0], [0.68, rimc, 0], [1, rimc, 0.6]]);
    d += rad(u + 'ao', [0.5, 0.5, 0.5], [[0, c.out, 0.42], [0.55, c.out, 0.2], [1, c.out, 0]]);
    d += rad(u + 'sh', [0.5, 0.5, 0.5], [[0, '#000', 0.34], [0.55, '#000', 0.17], [1, '#000', 0]]);
    d += rad(u + 'gl', [0.5, 0.5, 0.5], [[0, c.glow, 0.62], [0.45, c.glow, 0.22], [1, c.glow, 0]]);
    d += rad(u + 'sp', [0.5, 0.5, 0.5], [[0, '#fff', 0.75], [1, '#fff', 0]]);
    var ckc = mix(c.cheek, '#ff7d9d', 0.25);
    d += rad(u + 'ck', [0.5, 0.5, 0.5], [[0, ckc, 1], [0.55, ckc, 0.9], [1, ckc, 0]]);
    d += rad(u + 'ey', [0.4, 0.34, 0.78], [[0, '#ffffff'], [0.68, '#f6f8ff'], [1, mix('#c5cfe8', c.body, 0.18)]]);
    d += rad(u + 'pu', [0.5, 0.26, 0.86], [[0, c.out], [0.52, c.out], [1, mix(c.out, c.plates[0], 0.62)]]);
    d += lin(u + 'mo', [0.5, 0, 0.5, 1], [[0, mix(c.out, '#4a0c22', 0.65)], [1, '#a82a50']]);
    if (horn) d += lin(u + 'hn', [0.2, 1, 0.6, 0], [[0, c.bellyShade], [0.5, c.belly], [1, mix(c.belly, '#ffffff', 0.7)]]);
    for (i = 0; i < c.plates.length; i++) {
      pc = c.plates[i];
      d += lin(u + 'p' + i, [0.5, 1, 0.5, 0], [[0, mix(pc, c.shade, 0.6)], [0.4, pc], [0.8, mix(pc, c.glow, 0.6)], [1, c.glow]]);
    }
    return d;
  }

  /* ------------------------------------------------------------------ plaques dorsales (résine lumineuse) */
  function plateShape(type, w, h, chip) {
    var a = r1;
    if (chip) {                                  // plaque ébréchée (forme grognon)
      if (type === 'round') return 'M' + a(-w / 2) + ' 6V0C' + a(-w / 2) + ' ' + a(-h * 0.95) + ' ' + a(-w * 0.12) + ' ' + a(-h * 1.02) + ' ' + a(-w * 0.04) + ' ' + a(-h * 0.9) +
        'L' + a(w * 0.06) + ' ' + a(-h * 0.58) + 'L' + a(w * 0.2) + ' ' + a(-h * 0.8) + 'C' + a(w * 0.4) + ' ' + a(-h * 0.6) + ' ' + a(w / 2) + ' ' + a(-h * 0.3) + ' ' + a(w / 2) + ' 0V6Z';
      return 'M' + a(-w / 2) + ' 6V0L' + a(-w * 0.3) + ' ' + a(-h * 0.7) + 'L' + a(-w * 0.1) + ' ' + a(-h * 0.54) + 'L' + a(w * 0.06) + ' ' + a(-h * 0.82) +
        'L' + a(w * 0.24) + ' ' + a(-h * 0.5) + 'L' + a(w / 2) + ' 0V6Z';
    }
    if (type === 'round') return 'M' + a(-w / 2) + ' 6V0C' + a(-w / 2) + ' ' + a(-h * 1.32) + ' ' + a(w / 2) + ' ' + a(-h * 1.32) + ' ' + a(w / 2) + ' 0V6Z';
    if (type === 'crystal') return 'M' + a(-w * 0.42) + ' 6L' + a(-w * 0.5) + ' ' + a(-h * 0.48) + 'L' + a(-w * 0.1) + ' ' + a(-h) + 'L' + a(w * 0.36) + ' ' + a(-h * 0.6) + 'L' + a(w * 0.42) + ' 6Z';
    if (type === 'fin') return 'M' + a(-w * 0.5) + ' 6V0C' + a(-w * 0.66) + ' ' + a(-h * 0.5) + ' ' + a(-w * 0.52) + ' ' + a(-h * 0.96) + ' ' + a(-w * 0.26) + ' ' + a(-h) +
      'C' + a(0) + ' ' + a(-h * 1.0) + ' ' + a(w * 0.34) + ' ' + a(-h * 0.5) + ' ' + a(w * 0.5) + ' 0V6Z';
    /* tri : triangle à pointe arrondie, légèrement couché vers la queue */
    return 'M' + a(-w / 2) + ' 6V0C' + a(-w * 0.47) + ' ' + a(-h * 0.5) + ' ' + a(-w * 0.3) + ' ' + a(-h * 0.88) + ' ' + a(-w * 0.13) + ' ' + a(-h * 0.98) +
      'Q' + a(-w * 0.04) + ' ' + a(-h * 1.03) + ' ' + a(w * 0.05) + ' ' + a(-h * 0.95) + 'C' + a(w * 0.27) + ' ' + a(-h * 0.76) + ' ' + a(w * 0.45) + ' ' + a(-h * 0.4) + ' ' + a(w / 2) + ' 0V6Z';
  }
  /* une plaque posée en (x,y), orientée selon la normale (nx,ny).
     B = { g: halos, s: plaques, c: cœurs lumineux } : trois couches par zone, pour n'animer que deux groupes */
  function plate(G, B, x, y, nx, ny, w, h, idx, chip) {
    var c = G.c, type = G.sk.plate, ci = idx % c.plates.length, pc = c.plates[ci];
    if (type === 'round') { w *= 1.18; h *= 0.74; }   // bosses : plus larges que hautes
    var ang = Math.atan2(nx, -ny) * 180 / Math.PI, a = r1, d = plateShape(type, w, h, chip), s, k = 0.5, l = Math.sqrt(nx * nx + ny * ny) || 1;
    var pid = G.uid + 'q' + idx, pg = 'url(#' + G.uid + 'p' + ci + ')', tf = 'translate(' + XY(x, y) + ') rotate(' + a(ang) + ')';
    if (!G.ghost) B.g += C(x + nx / l * h * 0.5, y + ny / l * h * 0.5, h * (G.big ? 0.95 : 0.8), 'url(#' + G.uid + 'gl)');
    s = '<g transform="' + tf + '" fill="' + pg + '"><path id="' + pid + '" d="' + d + '"' + (type === 'crystal' ? ' stroke="' + pg + '" stroke-width="2"' : '') + '/>';
    if (type === 'crystal' && !chip) {
      s += '<path d="M' + a(-w * 0.42) + ' 6L' + a(-w * 0.5) + ' ' + a(-h * 0.48) + 'L' + a(-w * 0.1) + ' ' + a(-h) + 'L' + a(-w * 0.04) + ' ' + a(-h * 0.34) + 'L' + a(-w * 0.02) + ' 6Z" fill="#fff" opacity=".34"/>';
      s += '<path d="M' + a(w * 0.42) + ' 6L' + a(w * 0.36) + ' ' + a(-h * 0.6) + 'L' + a(-w * 0.1) + ' ' + a(-h) + 'L' + a(-w * 0.04) + ' ' + a(-h * 0.34) + 'L' + a(-w * 0.02) + ' 6Z" fill="' + mix(pc, c.out, 0.45) + '" opacity=".22"/>';
      B.c += '<path transform="' + tf + '" d="M' + a(-w * 0.1) + ' ' + a(-h) + 'L' + a(-w * 0.04) + ' ' + a(-h * 0.34) + 'L' + a(-w * 0.02) + ' 2" fill="none" stroke="' + c.glow + '" stroke-width="' + a(Math.max(1.2, w * 0.07)) + '"/>';
    } else {
      /* cœur lumineux : même forme réduite, vers la base */
      B.c += '<use href="#' + pid + '" transform="' + tf + ' translate(0 ' + a(-h * 0.26 * (1 - k)) + ') scale(' + k + ')" fill="' + c.glow + '"/>';
      if (type === 'fin' && !chip) {
        s += '<path d="M' + a(-w * 0.14) + ' 0Q' + a(-w * 0.36) + ' ' + a(-h * 0.5) + ' ' + a(-w * 0.3) + ' ' + a(-h * 0.84) + 'M' + a(w * 0.16) + ' 0Q' + a(0) + ' ' + a(-h * 0.4) + ' ' + a(-w * 0.04) + ' ' + a(-h * 0.72) +
          '" fill="none" stroke="' + c.glow + '" stroke-width="' + a(Math.max(1, w * 0.05)) + '" opacity=".65"/>';
      }
    }
    /* reflet net sur le flanc éclairé */
    if (h > 18 && (chip || type !== 'crystal')) s += '<ellipse cx="' + a(-w * (type === 'round' ? 0.17 : 0.15)) + '" cy="' + a(-h * (type === 'round' ? 0.62 : 0.5)) + '" rx="' + a(w * (type === 'round' ? 0.1 : 0.055)) + '" ry="' + a(h * (type === 'round' ? 0.1 : 0.17)) +
      '" transform="rotate(' + (type === 'round' ? -35 : 14) + ' ' + a(-w * 0.15) + ' ' + a(-h * 0.5) + ')" fill="#fff" opacity=".7"/>';
    B.s += s + '</g>';
  }
  /* assemble une zone de plaques ; delay décale la pulsation (vague lumineuse de la tête vers la queue) */
  function plateLayer(B, delay) {
    var st = ' style="--d:' + delay + 's"';
    return (B.g ? '<g class="mt-glow"' + st + '>' + B.g + '</g>' : '') + B.s + (B.c ? '<g class="mt-core"' + st + '>' + B.c + '</g>' : '');
  }

  /* ------------------------------------------------------------------ gabarits par stade (px, origine au sol) */
  function rig(st, form, sk) {
    var R;
    if (st === 1) R = {
      dx: 3, h: { x: 6, y: -74, rx: 52, ry: 47, sn: 1.15 }, n: { x: 0, y: -40, w: 25 }, b: { x: -3, y: -25, w: 35, yb: -5, hump: 0 },
      leg: { x: -13, y: -13, r: 12, fl: 30, fh: 14 }, legF: { x: 13, y: -12, r: 11, fl: 27, fh: 13 },
      arm: { x: 14, y: -30, len: 8, th: 12 }, armF: { x: 34, y: -32, len: 7, th: 10 },
      tail: { p: [[-22, -24], [-40, -26], [-52, 2], [-66, -16]], w0: 14, w1: 4 },
      pl: { w: 14, h: 9, head: [], body: [], tail: [[0.42, 1], [0.7, 0.75]] }
    };
    else if (st === 2) R = {
      dx: 12, h: { x: 10, y: -121, rx: 58, ry: 52, sn: 1.22 }, n: { x: 0, y: -80, w: 30 }, b: { x: -6, y: -46, w: 44, yb: -16, hump: 0 },
      leg: { x: -14, y: -27, r: 20, fl: 45, fh: 18 }, legF: { x: 16, y: -24, r: 17, fl: 40, fh: 16 },
      arm: { x: 10, y: -63, len: 18, th: 18 }, armF: { x: 35, y: -65, len: 15, th: 15 },
      tail: { p: [[-28, -36], [-60, -40], [-84, 10], [-106, -24]], w0: 23, w1: 4.5 },
      pl: { w: 23, h: 21, head: [[104, 0.72], [142, 0.95], [178, 1]], body: [[0.7, 1]], tail: [[0.3, 0.76], [0.56, 0.54]] }
    };
    else if (st === 3) R = {
      dx: 20, h: { x: 14, y: -166, rx: 61, ry: 55, sn: 1.27 }, n: { x: -2, y: -122, w: 33 }, b: { x: -10, y: -66, w: 48, yb: -26, hump: 0 },
      leg: { x: -16, y: -40, r: 25, fl: 57, fh: 22 }, legF: { x: 20, y: -36, r: 21, fl: 50, fh: 19 },
      arm: { x: 10, y: -102, len: 25, th: 20 }, armF: { x: 36, y: -105, len: 21, th: 17 },
      tail: { p: [[-36, -50], [-78, -54], [-112, 12], [-146, -32]], w0: 29, w1: 5 },
      pl: { w: 30, h: 34, head: [[100, 0.66], [136, 0.9], [172, 1]], body: [[0.9, 1], [0.4, 0.92]], tail: [[0.24, 0.74], [0.47, 0.54], [0.68, 0.38]] }
    };
    else if (form === 'grognon') R = {
      dx: 22, h: { x: 36, y: -174, rx: 70, ry: 62, sn: 1.3 }, n: { x: 6, y: -124, w: 46 }, b: { x: -16, y: -76, w: 68, yb: -28, hump: 16 },
      leg: { x: -22, y: -48, r: 33, fl: 76, fh: 27 }, legF: { x: 28, y: -43, r: 28, fl: 66, fh: 24 },
      arm: { x: 28, y: -104, len: 34, th: 26 }, armF: { x: 60, y: -108, len: 28, th: 22 },
      tail: { p: [[-52, -56], [-104, -54], [-136, 12], [-176, -14]], w0: 34, w1: 5.5 },
      pl: { w: 36, h: 38, head: [[100, 0.6], [130, 0.8], [160, 0.95], [190, 1]], body: [[0.9, 1], [0.42, 0.92]], tail: [[0.22, 0.76], [0.45, 0.58], [0.66, 0.42]], chip: true }
    };
    else R = {
      dx: 30, h: { x: 18, y: -203, rx: 72, ry: 65, sn: 1.3 }, n: { x: -4, y: -150, w: 42 }, b: { x: -14, y: -80, w: 64, yb: -30, hump: 0 },
      leg: { x: -24, y: -48, r: 31, fl: 76, fh: 29 }, legF: { x: 26, y: -44, r: 27, fl: 66, fh: 25 },
      arm: { x: 14, y: -126, len: 34, th: 26 }, armF: { x: 46, y: -130, len: 28, th: 22 },
      tail: { p: [[-46, -60], [-96, -60], [-142, 14], [-182, -40]], w0: 36, w1: 6 },
      pl: { w: 40, h: 50, head: [[96, 0.58], [126, 0.8], [156, 0.98], [186, 1]], body: [[0.93, 1], [0.48, 0.95]], tail: [[0.2, 0.8], [0.41, 0.62], [0.6, 0.46], [0.77, 0.32]], big: true }
    };
    var ch = sk.chub || 1;
    R.b.w *= ch; R.n.w *= 1 + (ch - 1) * 0.6; R.h.rx *= 1 + (ch - 1) * 0.3;
    R.leg.r *= 1 + (ch - 1) * 0.5; R.legF.r *= 1 + (ch - 1) * 0.5; R.legF.x += (ch - 1) * R.b.w * 0.5; R.leg.x -= (ch - 1) * R.b.w * 0.3;
    return R;
  }

  function headPts(h, jaw) {
    var x = h.x, y = h.y, a = h.rx, b = h.ry, s = h.sn, j = (jaw || 0) * b;
    return [
      [x - 0.06 * a, y - b], [x + 0.6 * a, y - 0.78 * b], [x + 0.95 * a, y - 0.27 * b], [x + (s - 0.05) * a, y + 0.1 * b], [x + s * a, y + 0.42 * b],
      [x + (s - 0.24) * a, y + 0.8 * b + j], [x + 0.36 * a, y + 0.99 * b + j], [x - 0.48 * a, y + 0.9 * b], [x - 0.97 * a, y + 0.28 * b], [x - 0.8 * a, y - 0.56 * b]
    ];
  }
  function bodyPts(R) {
    var n = R.n, b = R.b, my = n.y + (b.y - n.y) * 0.3;
    return [
      [n.x, n.y - 10], [n.x + n.w, my], [b.x + b.w * 0.98, b.y], [b.x + b.w * 0.7, b.yb], [b.x, b.yb + 4],
      [b.x - b.w * 0.75, b.yb], [b.x - b.w, b.y], [n.x - n.w - b.hump, my - b.hump * 0.4]
    ];
  }
  /* queue : ligne centrale de Bézier + épaisseur décroissante */
  function tailGeom(T) {
    var N = 8, top = [], bot = [], i, t, q, l, w, nx, ny, pts;
    for (i = 0; i <= N; i++) {
      t = i / N; q = bez(T.p, t); l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1; nx = -q.dy / l; ny = q.dx / l;
      w = T.w1 + (T.w0 - T.w1) * Math.pow(1 - t, 0.85);
      top.push([q.x + nx * w, q.y + ny * w]); bot.push([q.x - nx * w, Math.min(q.y - ny * w, -0.5)]);
    }
    q = bez(T.p, 1); l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1;
    pts = top.concat([[q.x + q.dx / l * T.w1 * 1.1, q.y + q.dy / l * T.w1 * 1.1]], bot.reverse());
    return {
      d: blob(pts),
      at: function (t) {
        var q = bez(T.p, t), l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1, w = T.w1 + (T.w0 - T.w1) * Math.pow(1 - t, 0.85);
        return { x: q.x, y: q.y, nx: -q.dy / l, ny: q.dx / l, w: w };
      }
    };
  }

  /* ------------------------------------------------------------------ humeurs */
  var MOODS = {
    neutral: { eyes: 'open', look: [0.25, 0.05], mouth: 'smile', arm: -56 },
    happy: { eyes: 'arcUp', mouth: 'open', arm: -84, blush: 1.15 },
    love: { eyes: 'open', heart: true, look: [0.1, 0], mouth: 'open', arm: -78, blush: 1.5, hearts: true },
    sad: { eyes: 'open', lid: [0.08, -0.5], look: [0.05, 0.75], brow: 'sad', mouth: 'frown', tear: true, arm: -14 },
    angry: { eyes: 'open', lid: [-0.78, -0.02], look: [0.4, 0.15], brow: 'angry', mouth: 'grit', mark: true, arm: -62 },
    sick: { eyes: 'open', lid: [0.14, 0.14], look: [0, 0.55], pup: 0.82, brow: 'sad', mouth: 'wavy', thermo: true, arm: -12 },
    sleep: { eyes: 'arcDown', mouth: 'tiny', zzz: true, tilt: 8, arm: -10 },
    eat: { eyes: 'open', look: [0.5, 0.6], mouth: 'big', jaw: 0.1, arm: -76, blush: 0.9 },
    surprised: { eyes: 'open', big: 1.15, pup: 0.6, look: [0.15, 0], brow: 'up', mouth: 'o', arm: -92, spark: true }
  };

  /* ------------------------------------------------------------------ visage */
  function eye(G, e, m) {
    var c = G.c, s = '', k, y0, px, py, prx, pry, big = m.big || 1, ex = e.rx * big, ey = e.ry * big, lidc = mix(c.body, c.shade, 0.32), dark = c.out;
    if (m.eyes === 'arcUp' || m.eyes === 'arcDown') {
      k = m.eyes === 'arcUp' ? -1 : 1; y0 = e.y - k * e.ry * 0.3;
      return line('M' + XY(e.x - e.rx * 0.95, y0) + 'Q' + XY(e.x, y0 + k * e.ry * 1.25) + ' ' + XY(e.x + e.rx * 0.95, y0), dark, e.rx * 0.4);
    }
    var pad = e.rx * 0.15;
    s += E(e.x, e.y + ey * 0.05, ex + pad, ey + pad, mix(c.shade, c.out, 0.3), op(0.5));
    s += E(e.x, e.y, ex, ey, 'url(#' + G.uid + 'ey)');
    prx = ex * 0.74 * (m.pup || 1); pry = ey * 0.76 * (m.pup || 1);
    px = e.x + m.look[0] * (ex - prx) * 0.9; py = e.y + m.look[1] * (ey - pry) * 0.9;
    if (m.heart) {
      s += Pa(heart(px, py, prx * 1.12), '#ff3d7f') + C(px - prx * 0.45, py - pry * 0.3, prx * 0.24, '#fff', op(0.95)) + C(px + prx * 0.4, py + pry * 0.05, prx * 0.11, '#fff', op(0.8));
    } else {
      s += E(px, py, prx, pry, 'url(#' + G.uid + 'pu)');
      s += C(px - prx * 0.34, py - pry * 0.38, prx * 0.38, '#fff') + C(px + prx * 0.4, py + pry * 0.36, prx * 0.17, '#fff', op(0.85)) + C(px + prx * 0.05, py + pry * 0.62, prx * 0.08, '#fff', op(0.6));
    }
    if (m.lid) {                                  // paupière : calotte de l'ellipse au-dessus d'une corde
      var fo = m.lid[0], fi = m.lid[1], fl = e.inn > 0 ? fo : fi, fr = e.inn > 0 ? fi : fo, ax = ex + pad + 0.6, ay = ey + pad + 0.6;
      var xl = e.x - ax * Math.sqrt(1 - fl * fl), yl = e.y + fl * ay, xr = e.x + ax * Math.sqrt(1 - fr * fr), yr = e.y + fr * ay, qy = (yl + yr) / 2 + ey * 0.14;
      s += Pa('M' + XY(xl, yl) + 'A' + r1(ax) + ' ' + r1(ay) + ' 0 ' + (fl + fr > 0 ? 1 : 0) + ' 1 ' + XY(xr, yr) + 'Q' + XY(e.x, qy) + ' ' + XY(xl, yl) + 'Z', lidc);
      s += line('M' + XY(xl, yl) + 'Q' + XY(e.x, qy) + ' ' + XY(xr, yr), dark, e.rx * 0.13, op(0.75));
    }
    /* clignement : paupière complète affichée un bref instant */
    s += '<g class="mt-blink">' + E(e.x, e.y + ey * 0.03, ex + pad + 0.6, ey + pad + 0.6, lidc) +
      line('M' + XY(e.x - ex * 0.9, e.y + ey * 0.1) + 'Q' + XY(e.x, e.y + ey * 0.62) + ' ' + XY(e.x + ex * 0.9, e.y + ey * 0.1), dark, e.rx * 0.2) + '</g>';
    return s;
  }
  function brow(G, e, type) {
    if (!type) return '';
    var c = G.c, i = e.inn, y0 = e.y - e.ry * 1.22, xi = e.x + i * e.rx * 0.95, xo = e.x - i * e.rx * 1.05, yi, yo, bend = 0, w = e.rx * 0.3;
    if (type === 'angry') { yi = y0 + e.ry * 0.5; yo = y0 - e.ry * 0.16; }
    else if (type === 'sad') { yi = y0 - e.ry * 0.3; yo = y0 + e.ry * 0.14; bend = -e.ry * 0.12; }
    else if (type === 'up') { yi = y0 - e.ry * 0.36; yo = y0 - e.ry * 0.3; bend = -e.ry * 0.32; }
    else if (type === 'det') { yi = y0 + e.ry * 0.14; yo = y0 - e.ry * 0.06; w = e.rx * 0.2; xo = e.x - i * e.rx * 0.6; }
    else if (type === 'bougon') { yi = y0 + e.ry * 0.5; yo = y0 + e.ry * 0.12; w = e.rx * 0.46; bend = -e.ry * 0.06; }
    else { yi = y0 - e.ry * 0.02; yo = y0 - e.ry * 0.02; bend = -e.ry * 0.16; w = e.rx * 0.22; }   // soft
    return line('M' + XY(xo, yo) + 'Q' + XY((xi + xo) / 2, (yi + yo) / 2 + bend) + ' ' + XY(xi, yi), mix(c.shade, c.out, 0.6), w);
  }
  function heart(x, y, s) {
    return 'M' + XY(x, y + s * 0.9) + 'C' + XY(x - s * 1.45, y - s * 0.1) + ' ' + XY(x - s * 0.75, y - s * 1.15) + ' ' + XY(x, y - s * 0.38) +
      'C' + XY(x + s * 0.75, y - s * 1.15) + ' ' + XY(x + s * 1.45, y - s * 0.1) + ' ' + XY(x, y + s * 0.9) + 'Z';
  }
  /* bouche grande ouverte (humeur « eat » et action mâcher) */
  function openMouth(G, mx, my, mw, id, cls) {
    var c = G.c, rx = mw * 0.86, ry = mw * 0.7, cy = my + mw * 0.02, u = G.uid + id;
    var d = 'M' + XY(mx - rx, cy - ry * 0.25) + 'C' + XY(mx - rx, cy - ry * 1.1) + ' ' + XY(mx + rx, cy - ry * 1.1) + ' ' + XY(mx + rx, cy - ry * 0.25) +
      'C' + XY(mx + rx, cy + ry * 1.25) + ' ' + XY(mx - rx, cy + ry * 1.25) + ' ' + XY(mx - rx, cy - ry * 0.25) + 'Z';
    return '<g class="' + cls + '"><clipPath id="' + u + '"><path d="' + d + '"/></clipPath>' + Pa(d, 'url(#' + G.uid + 'mo)') +
      '<g clip-path="url(#' + u + ')">' +
      E(mx - rx * 0.05, cy + ry * 0.82, rx * 0.72, ry * 0.5, '#ff7f9d') + E(mx - rx * 0.18, cy + ry * 0.66, rx * 0.3, ry * 0.14, '#ffc0cf', op(0.8)) +
      E(mx - rx * 0.36, cy - ry * 0.98, rx * 0.26, ry * 0.42, '#fff') + E(mx + rx * 0.2, cy - ry * 0.98, rx * 0.26, ry * 0.42, '#fff') +
      '</g></g>';
  }
  function mouth(G, type, mx, my, mw) {
    var c = G.c, k = c.out, w = Math.max(2, mw * 0.2), s = '', rx, ry, d, u;
    if (type === 'big') return openMouth(G, mx, my, mw, 'mc', 'mt-chomp mt-chomp-on');
    if (type === 'open') {                        // sourire ouvert
      d = 'M' + XY(mx - mw * 0.95, my - mw * 0.2) + 'Q' + XY(mx, my + mw * 0.08) + ' ' + XY(mx + mw * 0.95, my - mw * 0.24) +
        'C' + XY(mx + mw * 0.9, my + mw * 0.95) + ' ' + XY(mx - mw * 0.85, my + mw * 0.98) + ' ' + XY(mx - mw * 0.95, my - mw * 0.2) + 'Z';
      u = G.uid + 'ms';
      s = '<clipPath id="' + u + '"><path d="' + d + '"/></clipPath>' + Pa(d, 'url(#' + G.uid + 'mo)', ' stroke="' + k + '" stroke-width="' + r1(w * 0.5) + '"') +
        '<g clip-path="url(#' + u + ')">' + E(mx, my + mw * 0.68, mw * 0.56, mw * 0.36, '#ff7f9d') + E(mx - mw * 0.12, my + mw * 0.52, mw * 0.22, mw * 0.09, '#ffc0cf', op(0.8)) +
        E(mx - mw * 0.2, my - mw * 0.2, mw * 0.2, mw * 0.24, '#fff') + E(mx + mw * 0.22, my - mw * 0.21, mw * 0.2, mw * 0.24, '#fff') + '</g>';
    } else if (type === 'frown') {
      s = line('M' + XY(mx - mw * 0.62, my + mw * 0.26) + 'Q' + XY(mx + mw * 0.05, my - mw * 0.36) + ' ' + XY(mx + mw * 0.7, my + mw * 0.2), k, w);
    } else if (type === 'grump') {                // moue bougonne + petite dent du bas
      s = E(mx + mw * 0.38, my - mw * 0.12, mw * 0.13, mw * 0.2, '#fff') +
        line('M' + XY(mx - mw * 0.8, my + mw * 0.22) + 'Q' + XY(mx, my - mw * 0.3) + ' ' + XY(mx + mw * 0.85, my + mw * 0.1), k, w);
    } else if (type === 'grit') {                 // dents serrées
      rx = mw * 0.74; ry = mw * 0.34;
      d = 'M' + XY(mx - rx, my + ry * 0.5) + 'Q' + XY(mx - rx, my - ry) + ' ' + XY(mx, my - ry * 1.15) + 'Q' + XY(mx + rx, my - ry) + ' ' + XY(mx + rx, my + ry * 0.4) +
        'Q' + XY(mx + rx * 0.9, my + ry) + ' ' + XY(mx, my + ry * 0.8) + 'Q' + XY(mx - rx * 0.9, my + ry * 1.1) + ' ' + XY(mx - rx, my + ry * 0.5) + 'Z';
      s = Pa(d, '#fff', ' stroke="' + k + '" stroke-width="' + r1(w * 0.75) + '"') +
        line('M' + XY(mx - rx * 0.9, my - ry * 0.05) + 'Q' + XY(mx, my - ry * 0.32) + ' ' + XY(mx + rx * 0.9, my - ry * 0.12) +
          'M' + XY(mx - rx * 0.4, my - ry * 0.95) + 'V' + Y(my + ry * 0.85) + 'M' + XY(mx + rx * 0.05, my - ry * 1.05) + 'V' + Y(my + ry * 0.75) + 'M' + XY(mx + rx * 0.5, my - ry * 0.9) + 'V' + Y(my + ry * 0.75), k, w * 0.42);
    } else if (type === 'wavy') {
      d = 'M' + XY(mx - mw * 0.8, my + mw * 0.05) + 'q' + r1(mw * 0.2) + ' ' + r1(-mw * 0.34) + ' ' + r1(mw * 0.4) + ' 0t' + r1(mw * 0.4) + ' 0t' + r1(mw * 0.4) + ' 0t' + r1(mw * 0.4) + ' 0';
      s = line(d, k, w * 0.9);
    } else if (type === 'tiny') {
      s = E(mx + mw * 0.1, my + mw * 0.02, mw * 0.2, mw * 0.16, 'url(#' + G.uid + 'mo)');
    } else if (type === 'o') {
      s = E(mx + mw * 0.05, my + mw * 0.1, mw * 0.32, mw * 0.42, 'url(#' + G.uid + 'mo)') + E(mx + mw * 0.05, my + mw * 0.36, mw * 0.18, mw * 0.12, '#ff7f9d');
    } else {                                      // smile (+ petit croc dès l'ado : « monstre ensuite »)
      if (G.st >= 3) s = Pa('M' + XY(mx + mw * 0.3, my + mw * 0.1) + 'Q' + XY(mx + mw * 0.44, my + mw * 0.58) + ' ' + XY(mx + mw * 0.58, my + mw * 0.02) + 'Z', '#fff');
      s += line('M' + XY(mx - mw * 0.82, my - mw * 0.18) + 'Q' + XY(mx - mw * 0.1, my + mw * 0.55) + ' ' + XY(mx + mw * 0.82, my - mw * 0.12), k, w);
    }
    return '<g class="mt-mouth">' + s + '</g>' + openMouth(G, mx, my, mw, 'mc', 'mt-chomp mt-chomp-hid');
  }

  function face(G, h, m) {
    var c = G.c, s = '', sk = G.sk, st = G.st, e = h.rx / G.hk * (sk.eyeBig ? 0.268 : 0.236) * (st === 1 ? 1.08 : st === 2 ? 1.04 : 1);
    var e1 = { x: h.x + h.rx * 0.13, y: h.y - h.ry * 0.06, rx: e, ry: e * 1.22, inn: 1 };
    var e2 = { x: h.x + h.rx * 0.79, y: h.y - h.ry * 0.11, rx: e * 0.72, ry: e * 1.1, inn: -1 };
    var mx = h.x + h.rx * 0.62, my = h.y + h.ry * 0.57, mw = h.rx * 0.34, bl = m.blush == null ? 0.85 : m.blush;
    var grog = G.form === 'grognon', mm = {}, key, br = m.brow, mo = m.mouth;
    for (key in m) mm[key] = m[key];
    if (grog) { if (!br) br = 'bougon'; if (!mm.lid && mm.eyes === 'open' && !mm.heart) mm.lid = [-0.5, -0.2]; if (mo === 'smile') mo = 'grump'; }
    else if (G.mood === 'neutral' && st === 3) { mm.lid = [-0.96, -0.7]; }
    else if (G.mood === 'neutral' && st === 4) { mm.lid = [-0.87, -0.87]; }
    /* joues */
    s += E(h.x - h.rx * 0.12, h.y + h.ry * 0.5, h.rx * 0.19 * Math.min(1.2, bl + 0.15), h.ry * 0.12 * Math.min(1.2, bl + 0.15), 'url(#' + G.uid + 'ck)', op(Math.min(1, bl)));
    s += E(h.x + h.rx * 1.02, h.y + h.ry * 0.4, h.rx * 0.09, h.ry * 0.1, 'url(#' + G.uid + 'ck)', op(Math.min(1, bl * 0.8)));
    /* narines */
    s += E(h.x + (h.sn - 0.13) * h.rx, h.y + h.ry * 0.13, h.rx * 0.026, h.ry * 0.045, mix(c.shade, c.out, 0.55), op(0.75) + rot(-18, h.x + (h.sn - 0.13) * h.rx, h.y + h.ry * 0.13));
    s += E(h.x + (h.sn - 0.34) * h.rx, h.y + h.ry * 0.09, h.rx * 0.03, h.ry * 0.05, mix(c.shade, c.out, 0.55), op(0.75) + rot(-18, h.x + (h.sn - 0.34) * h.rx, h.y + h.ry * 0.09));
    s += '<g class="mt-eyes">' + eye(G, e1, mm) + eye(G, e2, mm) + '</g>';
    s += brow(G, e1, br) + brow(G, e2, br);
    s += mouth(G, mo, mx, my, mw);
    /* accessoires d'humeur solidaires de la tête */
    if (m.tear) {
      var tx = e1.x - e1.rx * 0.35, ty = e1.y + e1.ry * 1.5, ts = e1.rx * 0.36;
      s += '<g class="mt-tear">' + Pa('M' + XY(tx, ty - ts * 1.7) + 'C' + XY(tx + ts * 1.15, ty - ts * 0.3) + ' ' + XY(tx + ts, ty + ts) + ' ' + XY(tx, ty + ts) + 'C' + XY(tx - ts, ty + ts) + ' ' + XY(tx - ts * 1.15, ty - ts * 0.3) + ' ' + XY(tx, ty - ts * 1.7) + 'Z', '#6fd0ff') +
        C(tx - ts * 0.3, ty + ts * 0.15, ts * 0.28, '#fff', op(0.85)) + '</g>';
    }
    if (m.thermo) {
      var L = h.rx * 0.72, tt = h.rx * 0.1, x0 = mx + mw * 0.15, y1 = my + mw * 0.02;
      s += '<g' + rot(24, x0, y1) + '><rect x="' + X(x0) + '" y="' + Y(y1 - tt / 2) + '" width="' + r1(L) + '" height="' + r1(tt) + '" rx="' + r1(tt / 2) + '" fill="#fff" stroke="#b8c4d6" stroke-width="1.2"/>' +
        '<rect x="' + X(x0 + L * 0.3) + '" y="' + Y(y1 - tt * 0.16) + '" width="' + r1(L * 0.6) + '" height="' + r1(tt * 0.32) + '" rx="' + r1(tt * 0.16) + '" fill="#ff4d5e"/>' +
        C(x0 + L, y1, tt * 0.95, '#ff4d5e', ' stroke="#b8c4d6" stroke-width="1.2"') + C(x0 + L - tt * 0.25, y1 - tt * 0.3, tt * 0.26, '#fff', op(0.8)) + '</g>';
      var sx = h.x - h.rx * 0.5, sy = h.y - h.ry * 0.5, ss = h.rx * 0.075;      // goutte de sueur
      s += Pa('M' + XY(sx, sy - ss * 1.8) + 'C' + XY(sx + ss * 1.15, sy - ss * 0.3) + ' ' + XY(sx + ss, sy + ss) + ' ' + XY(sx, sy + ss) + 'C' + XY(sx - ss, sy + ss) + ' ' + XY(sx - ss * 1.15, sy - ss * 0.3) + ' ' + XY(sx, sy - ss * 1.8) + 'Z', '#8fdcff', op(0.9)) +
        C(sx - ss * 0.3, sy + ss * 0.1, ss * 0.28, '#fff', op(0.85));
    }
    if (m.mark) {                                 // veine de colère
      var ax = h.x - h.rx * 0.5, ay = h.y - h.ry * 0.62, q = h.rx * 0.085;
      s += line('M' + XY(ax - q * 1.6, ay - q * 0.5) + 'Q' + XY(ax - q * 0.5, ay - q * 0.5) + ' ' + XY(ax - q * 0.5, ay - q * 1.6) + 'M' + XY(ax + q * 0.5, ay - q * 1.6) + 'Q' + XY(ax + q * 0.5, ay - q * 0.5) + ' ' + XY(ax + q * 1.6, ay - q * 0.5) +
        'M' + XY(ax + q * 1.6, ay + q * 0.5) + 'Q' + XY(ax + q * 0.5, ay + q * 0.5) + ' ' + XY(ax + q * 0.5, ay + q * 1.6) + 'M' + XY(ax - q * 0.5, ay + q * 1.6) + 'Q' + XY(ax - q * 0.5, ay + q * 0.5) + ' ' + XY(ax - q * 1.6, ay + q * 0.5), '#ff3b4a', q * 0.62, ' class="mt-mark"');
    }
    return s;
  }

  /* ------------------------------------------------------------------ membres */
  function foot(G, L, grad) {
    var c = G.c, x0 = L.x - L.r * 0.8, x1 = x0 + L.fl, fh = L.fh, fl = L.fl, s, i, nx;
    var d = 'M' + XY(x0, -fh * 0.45) + 'C' + XY(x0, -fh * 1.04) + ' ' + XY(x0 + fl * 0.3, -fh * 1.12) + ' ' + XY(x0 + fl * 0.52, -fh * 0.98) +
      'C' + XY(x0 + fl * 0.78, -fh * 0.86) + ' ' + XY(x1, -fh * 0.8) + ' ' + XY(x1, -fh * 0.34) + 'C' + XY(x1, -fh * 0.05) + ' ' + XY(x1 - fl * 0.06, 0) + ' ' + XY(x1 - fl * 0.14, 0) +
      'L' + XY(x0 + fl * 0.12, 0) + 'C' + XY(x0 + fl * 0.04, 0) + ' ' + XY(x0, -fh * 0.12) + ' ' + XY(x0, -fh * 0.45) + 'Z';
    s = Pa(d, 'url(#' + G.uid + grad + ')');
    for (i = 2; i >= 0; i--) {                    // griffes rondes, au bout du pied
      nx = x1 - fl * (0.075 + i * 0.185);
      s += E(nx, -fh * (0.33 + i * 0.05), fl * 0.082, fh * 0.3, grad === 'sk' ? 'url(#' + G.uid + 'be)' : mix(c.bellyShade, c.shade, 0.4), rot(8 - i * 6, nx, -fh * 0.33));
    }
    if (grad === 'sk') s += E(x0 + fl * 0.3, -fh * 0.86, fl * 0.16, fh * 0.1, '#fff', op(0.3) + rot(-6, x0 + fl * 0.3, -fh * 0.86));
    return s;
  }
  function arm(G, A, ang, grad, cls) {
    var x = A.x, y = A.y, t = A.th, l = A.len, s;                 // moufle : épaule étroite, main ronde
    s = '<g class="mt-arm ' + cls + '"' + org(x, y) + '><g' + rot(ang, x, y) + '>' +
      Pa(blob([[x - t * 0.36, y - t * 0.14], [x + t * 0.36, y - t * 0.14], [x + t * 0.5, y + l * 0.55], [x + t * 0.5, y + l + t * 0.04], [x, y + l + t * 0.42], [x - t * 0.52, y + l + t * 0.04], [x - t * 0.46, y + l * 0.5]]), 'url(#' + G.uid + grad + ')');
    if (grad === 'sk') s += E(A.x - A.th * 0.17, A.y + A.len * 0.3, A.th * 0.1, A.len * 0.2 + 1, '#fff', op(0.34));
    return s + '</g></g>';
  }

  /* motif : rayures ou taches sur le dos */
  function wedge(bx, by, dx, dy, len, w) {      // coin effilé partant du bord (bx,by) vers l'intérieur (dx,dy)
    var px = -dy, py = dx;
    return 'M' + XY(bx - dx * 8 + px * w, by - dy * 8 + py * w) + 'Q' + XY(bx + dx * len * 0.5 + px * w * 0.55, by + dy * len * 0.5 + py * w * 0.55) + ' ' + XY(bx + dx * len, by + dy * len) +
      'Q' + XY(bx + dx * len * 0.5 - px * w * 0.55, by + dy * len * 0.5 - py * w * 0.55) + ' ' + XY(bx - dx * 8 - px * w, by - dy * 8 - py * w) + 'Z';
  }

  /* ------------------------------------------------------------------ le monstre (stades 1 à 4) */
  function drawMonster(G) {
    var sk = G.sk, c = G.c, u = G.uid, st = G.st, m = MOODS[G.mood], R = rig(st, G.form, sk);
    OX = 200 + R.dx; OY = 360;
    var h = R.h, b = R.b, n = R.n, i, q, l, t, pidx = 0, s = '', d = defs(c, u, sk.horn && st >= 3) + (st === 1 ? shellGrad(c, u) : '');
    G.hk = 1 + ((sk.chub || 1) - 1) * 0.3; G.big = !!R.pl.big;
    var hp = headPts(h, m.jaw), bp = bodyPts(R), tg = tailGeom(R.tail);
    var dHead = blob(hp), dBody = blob(bp), pat = mix(c.shade, c.out, 0.3), patO = sk.pattern === 'stripes' ? 0.62 : 0.5;
    d += '<path id="' + u + 'hd" d="' + dHead + '"/><path id="' + u + 'bd" d="' + dBody + '"/><path id="' + u + 'td" d="' + tg.d + '"/>' +
      '<clipPath id="' + u + 'hc"><use href="#' + u + 'hd"/></clipPath><clipPath id="' + u + 'bc"><use href="#' + u + 'bd"/></clipPath><clipPath id="' + u + 'tc"><use href="#' + u + 'td"/></clipPath>';

    /* --- plaques : tête, dos, queue (indices continus de la tête vers la queue) */
    var plH = { g: '', s: '', c: '' }, plB = { g: '', s: '', c: '' }, plT = { g: '', s: '', c: '' }, P = R.pl, a, ca, sa;
    for (i = 0; i < P.head.length; i++) {
      a = P.head[i][0] * Math.PI / 180; ca = Math.cos(a); sa = Math.sin(a);
      q = Math.sqrt(ca * ca * h.ry * h.ry + sa * sa * h.rx * h.rx);
      plate(G, plH, h.x + h.rx * ca * 0.93, h.y - h.ry * sa * 0.93, ca * h.ry / q, -sa * h.rx / q, P.w * P.head[i][1], P.h * P.head[i][1], pidx, P.chip && (pidx % 2 === 1));
      pidx++;
    }
    for (i = 0; i < P.body.length; i++) {
      q = blobAt(bp, 6, P.body[i][0]); l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1;
      plate(G, plB, q.x - q.dy / l * 2, q.y + q.dx / l * 2, q.dy / l, -q.dx / l, P.w * P.body[i][1], P.h * P.body[i][1], pidx, P.chip && (pidx % 2 === 1));
      pidx++;
    }
    for (i = 0; i < P.tail.length; i++) {
      q = tg.at(P.tail[i][0]);
      plate(G, plT, q.x + q.nx * q.w * 0.9, q.y + q.ny * q.w * 0.9, q.nx * 0.85 - 0.15, q.ny * 0.85 - 0.15, P.w * P.tail[i][1], P.h * P.tail[i][1], pidx, P.chip && (pidx % 2 === 1));
      pidx++;
    }

    /* --- motifs */
    var patH = '', patB = '', patT = '';
    if (sk.pattern === 'stripes') {
      var angs = [118, 148, 178];
      for (i = 0; i < angs.length; i++) {
        a = angs[i] * Math.PI / 180; ca = Math.cos(a); sa = Math.sin(a);
        patH += Pa(wedge(h.x + h.rx * ca, h.y - h.ry * sa, -ca, sa, h.rx * (0.44 - i * 0.03), h.rx * 0.085), pat);
      }
      var bt = [0.9, 0.55, 0.2];
      for (i = 0; i < bt.length; i++) {
        q = blobAt(bp, 6, bt[i]); l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1;
        patB += Pa(wedge(q.x, q.y, -q.dy / l * 0.92, q.dx / l * 0.92 + 0.25, b.w * 0.62, b.w * 0.105), pat);
      }
      var tt = st === 1 ? [0.5] : [0.28, 0.48, 0.66, 0.82];
      for (i = 0; i < tt.length; i++) {
        q = tg.at(tt[i]);
        patT += Pa(wedge(q.x + q.nx * q.w, q.y + q.ny * q.w, -q.nx, -q.ny, q.w * 1.35, q.w * 0.3), pat);
      }
    } else if (sk.pattern === 'spots') {
      var hs = [[124, 0.6, 0.115], [158, 0.72, 0.08], [98, 0.74, 0.06], [146, 0.36, 0.05]];
      for (i = 0; i < hs.length; i++) {
        a = hs[i][0] * Math.PI / 180;
        patH += E(h.x + h.rx * Math.cos(a) * hs[i][1], h.y - h.ry * Math.sin(a) * hs[i][1], h.rx * hs[i][2], h.rx * hs[i][2] * 0.9, pat);
      }
      var bs = [[0.75, 0.24, 0.13], [0.36, 0.3, 0.1], [0.56, 0.52, 0.06]];
      for (i = 0; i < bs.length; i++) {
        q = blobAt(bp, 6, bs[i][0]);
        patB += C(q.x + b.w * bs[i][1], q.y + 2, b.w * bs[i][2], pat);
      }
      var ts = st === 1 ? [[0.55, 0.3]] : [[0.3, 0.34], [0.52, 0.4], [0.72, 0.42]];
      for (i = 0; i < ts.length; i++) {
        q = tg.at(ts[i][0]);
        patT += C(q.x + q.nx * q.w * 0.3, q.y + q.ny * q.w * 0.3, q.w * ts[i][1], pat);
      }
    }

    /* --- queue */
    var tail = '<g class="mt-tail"' + org(R.tail.p[0][0] + 4, R.tail.p[0][1]) + '>' + plateLayer(plT, -1.8) +
      '<use href="#' + u + 'td" fill="url(#' + u + 'tl)"/>' +
      '<g clip-path="url(#' + u + 'tc)">' + (patT ? '<g opacity="' + patO + '">' + patT + '</g>' : '') +
      E(b.x - b.w * 0.92, b.y + (b.yb - b.y) * 0.45, b.w * 0.5, R.tail.w0 * 1.5, 'url(#' + u + 'ao)') + '</g>';
    q = tg.at(0.36);                              // reflet doux sur le dessus de la queue
    tail += E(q.x + q.nx * q.w * 0.5, q.y + q.ny * q.w * 0.5, R.tail.w0 * 0.75, q.w * 0.22, 'url(#' + u + 'sp)', op(0.5) + rot(Math.atan2(-q.nx, q.ny) * 180 / Math.PI, q.x + q.nx * q.w * 0.5, q.y + q.ny * q.w * 0.5)) + '</g>';

    /* --- corps */
    var armA = m.arm, belX = b.x + b.w * 0.36, belY = (n.y + b.yb) / 2 + (b.yb - n.y) * 0.1, belRx = b.w * 0.7, belRy = (b.yb - n.y) * 0.5;
    if (G.form === 'grognon' && G.mood === 'neutral') armA = -18;
    var body = '<use href="#' + u + 'bd" fill="url(#' + u + 'sk)"/><g clip-path="url(#' + u + 'bc)">' +
      (patB ? '<g opacity="' + patO + '">' + patB + '</g>' : '') +
      E(belX, belY, belRx, belRy, 'url(#' + u + 'be)', rot(-6, belX, belY));
    if (st >= 3) {                                // plis du ventre
      for (i = 1; i <= 3; i++) {
        t = belY - belRy + belRy * 2 * (0.3 + i * 0.17);
        body += line('M' + XY(belX - belRx * 0.9, t - 3) + 'Q' + XY(belX + belRx * 0.1, t + belRy * 0.1) + ' ' + XY(belX + belRx, t - 6), c.bellyShade, 2.2, op(0.75));
      }
    }
    var ar = armA * Math.PI / 180, ad = R.arm.len * 0.6 + R.arm.th * 0.2, acx = R.arm.x - Math.sin(ar) * ad + 3, acy = R.arm.y + Math.cos(ar) * ad + 6;
    body += E(belX - belRx * 0.3, belY - belRy * 0.05, belRx * 0.3, belRy * 0.5, 'url(#' + u + 'sp)', op(0.45) + rot(8, belX - belRx * 0.3, belY)) +   // brillance du ventre
      E(acx, acy, R.arm.th * 0.62, R.arm.len * 0.5 + R.arm.th * 0.5, 'url(#' + u + 'ao)', op(0.75) + rot(armA, acx, acy)) +      // ombre du bras
      E(h.x + h.rx * 0.12, h.y + h.ry * 0.96, h.rx * 0.98, h.ry * 0.46, 'url(#' + u + 'ao)') +          // ombre de la tête
      E(R.leg.x + R.leg.r * 0.35, R.leg.y + R.leg.r * 0.1, R.leg.r * 1.25, R.leg.r * 1.3, 'url(#' + u + 'ao)', op(0.7)) +   // ombre de la cuisse
      '<use href="#' + u + 'bd" fill="none" stroke="url(#' + u + 'rm)" stroke-width="' + r1(b.w * 0.14) + '"/></g>';

    /* --- pattes */
    var L = R.leg, LF = R.legF;
    var legFar = E(LF.x, LF.y, LF.r, LF.r * 1.12, 'url(#' + u + 'sd)') + foot(G, LF, 'sd');
    var legNear = E(L.x, L.y, L.r, L.r * 1.14, 'url(#' + u + 'sk)', rot(-8, L.x, L.y)) +
      E(L.x - L.r * 0.32, L.y - L.r * 0.5, L.r * 0.3, L.r * 0.16, '#fff', op(0.32) + rot(-28, L.x - L.r * 0.32, L.y - L.r * 0.5)) +
      E(L.x + L.r * 0.1, -L.fh * 0.95, L.r * 0.8, L.fh * 0.3, 'url(#' + u + 'ao)', op(0.8)) + foot(G, L, 'sk');

    /* --- tête */
    var head = '', hornS = '';
    if (sk.horn && st >= 3) {
      var hk = st === 3 ? 0.42 : 1, hw = h.rx * 0.2 * (st === 3 ? 0.8 : 1), hh = h.rx * 0.46 * hk, defsH = [[40, 0.8, 'sd', G.form === 'grognon'], [66, 1, 'hn', false]];
      for (i = 0; i < defsH.length; i++) {
        a = defsH[i][0] * Math.PI / 180; ca = Math.cos(a); sa = Math.sin(a);
        var w2 = hw * defsH[i][1], h2 = hh * defsH[i][1], hx0 = h.x + h.rx * ca * 0.9, hy0 = h.y - h.ry * sa * 0.9, hd;
        if (defsH[i][3]) hd = 'M' + r1(-w2 / 2) + ' 5C' + r1(-w2 / 2) + ' ' + r1(-h2 * 0.25) + ' ' + r1(-w2 * 0.46) + ' ' + r1(-h2 * 0.4) + ' ' + r1(-w2 * 0.42) + ' ' + r1(-h2 * 0.52) + 'L' + r1(-w2 * 0.1) + ' ' + r1(-h2 * 0.42) + 'L' + r1(w2 * 0.12) + ' ' + r1(-h2 * 0.56) + 'L' + r1(w2 * 0.4) + ' ' + r1(-h2 * 0.36) + 'L' + r1(w2 / 2) + ' 5Z';
        else hd = 'M' + r1(-w2 / 2) + ' 5C' + r1(-w2 / 2) + ' ' + r1(-h2 * 0.4) + ' ' + r1(-w2 * 0.62) + ' ' + r1(-h2 * 0.8) + ' ' + r1(-w2 * 0.5) + ' ' + r1(-h2) + 'C' + r1(w2 * 0.05) + ' ' + r1(-h2 * 0.8) + ' ' + r1(w2 / 2) + ' ' + r1(-h2 * 0.4) + ' ' + r1(w2 / 2) + ' 5Z';
        hornS += '<g transform="translate(' + XY(hx0, hy0) + ') rotate(' + r1(Math.atan2(ca * h.ry, sa * h.rx) * 180 / Math.PI) + ')">' +
          '<path d="' + hd + '" fill="' + (defsH[i][2] === 'hn' ? 'url(#' + u + 'hn)' : mix(c.bellyShade, c.shade, 0.3)) + '"/>' +
          (defsH[i][2] === 'hn' ? '<ellipse cx="' + r1(-w2 * 0.2) + '" cy="' + r1(-h2 * 0.45) + '" rx="' + r1(w2 * 0.09) + '" ry="' + r1(h2 * 0.2) + '" fill="#fff" opacity=".7" transform="rotate(-8 ' + r1(-w2 * 0.2) + ' ' + r1(-h2 * 0.45) + ')"/>' : '') + '</g>';
      }
    }
    head += hornS + plateLayer(plH, 0) + '<use href="#' + u + 'hd" fill="url(#' + u + 'sk)"/>';
    head += '<g clip-path="url(#' + u + 'hc)">' + (patH ? '<g opacity="' + patO + '">' + patH + '</g>' : '') +
      '<use href="#' + u + 'hd" fill="none" stroke="url(#' + u + 'rm)" stroke-width="' + r1(h.rx * 0.09) + '"/></g>';
    /* reflets : grand halo doux + éclats nets (vinyle) */
    head += E(h.x - h.rx * 0.3, h.y - h.ry * 0.5, h.rx * 0.46, h.ry * 0.3, 'url(#' + u + 'sp)', op(0.55) + rot(-24, h.x - h.rx * 0.3, h.y - h.ry * 0.5)) +
      E(h.x - h.rx * 0.44, h.y - h.ry * 0.62, h.rx * 0.17, h.ry * 0.075, '#fff', op(0.78) + rot(-32, h.x - h.rx * 0.44, h.y - h.ry * 0.62)) +
      C(h.x - h.rx * 0.66, h.y - h.ry * 0.4, h.rx * 0.035, '#fff', op(0.7)) +
      E(h.x + (h.sn - 0.34) * h.rx, h.y + h.ry * 0.0, h.rx * 0.2, h.ry * 0.1, 'url(#' + u + 'sp)', op(0.6) + rot(14, h.x + (h.sn - 0.34) * h.rx, h.y)) +
      E(h.x + (h.sn - 0.3) * h.rx, h.y - h.ry * 0.02, h.rx * 0.07, h.ry * 0.03, '#fff', op(0.7) + rot(16, h.x + (h.sn - 0.3) * h.rx, h.y - h.ry * 0.02));
    head += face(G, h, m);
    if (st === 1) head += shellHat(G, h);
    var px = h.x - h.rx * 0.15, py = h.y + h.ry * 0.8;
    head = '<g class="mt-head"' + org(px, py) + '><g class="mt-headi"' + org(px, py) + '>' + head + '</g></g>';
    if (m.tilt) head = '<g' + rot(m.tilt, px, py) + '>' + head + '</g>';

    /* --- accessoires flottants */
    var fx = '';
    if (m.zzz) {
      var zx = h.x + h.rx * 1.0, zy = h.y - h.ry * 0.75, zs = h.rx * 0.13;
      for (i = 0; i < 3; i++) {
        var zd = 'M' + XY(zx, zy) + 'h' + r1(zs) + 'l' + r1(-zs) + ' ' + r1(zs) + 'h' + r1(zs);
        fx += '<g class="mt-z" style="animation-delay:' + r1(-i * 0.9) + 's">' + line(zd, c.out, zs * 0.62) + line(zd, '#fff', zs * 0.3) + '</g>';
        zx += zs * 1.5; zy -= zs * 1.9; zs *= 1.3;
      }
      fx += '<g class="mt-bubble"' + org(h.x + (h.sn + 0.02) * h.rx, h.y + h.ry * 0.45) + '>' + C(h.x + (h.sn + 0.16) * h.rx, h.y + h.ry * 0.3, h.rx * 0.15, '#c9ecff', op(0.6) + ' stroke="#fff" stroke-width="1.6"') +
        C(h.x + (h.sn + 0.11) * h.rx, h.y + h.ry * 0.22, h.rx * 0.04, '#fff', op(0.95)) + '</g>';
    }
    if (m.hearts) {
      var hs2 = [[-0.95, -0.95, 0.12, 0], [1.3, -0.9, 0.16, -0.7], [0.75, -1.3, 0.1, -1.3]];
      for (i = 0; i < hs2.length; i++) {
        var qx = h.x + h.rx * hs2[i][0], qy = h.y + h.ry * hs2[i][1], qs = h.rx * hs2[i][2];
        fx += '<g class="mt-heart" style="animation-delay:' + hs2[i][3] + 's">' + Pa(heart(qx, qy, qs), '#ff4f8b') + C(qx - qs * 0.42, qy - qs * 0.32, qs * 0.2, '#fff', op(0.85)) + '</g>';
      }
    }
    if (m.spark) {
      var sx0 = h.x + h.rx * 1.05, sy0 = h.y - h.ry * 0.95, sl = h.rx * 0.2, sd = '';
      for (i = 0; i < 3; i++) { a = (-20 - i * 32) * Math.PI / 180; sd += 'M' + XY(sx0 + Math.cos(a) * sl * 0.5, sy0 + Math.sin(a) * sl * 0.5) + 'L' + XY(sx0 + Math.cos(a) * sl * 1.4, sy0 + Math.sin(a) * sl * 1.4); }
      fx += '<g class="mt-spark">' + line(sd, c.out, sl * 0.34) + line(sd, '#ffe45c', sl * 0.18) + '</g>';
    }

    /* --- assemblage */
    var cx0 = b.x, armN = arm(G, R.arm, armA, 'sk', 'mt-arm-n'), armF = arm(G, R.armF, armA - 8, 'sd', 'mt-arm-f');
    s += E(b.x - 6, 3, b.w * 1.55 + R.tail.w0 * 0.4, Math.max(7, b.w * 0.24), 'url(#' + u + 'sh)', ' class="mt-shadow"');
    s += '<g class="mt-all"' + org(cx0, 0) + '><g class="mt-breath"' + org(cx0, 0) + '>' +
      tail + plateLayer(plB, -2.2) + legFar + armF + body + legNear + head + armN + '</g>' + fx + '</g>';
    return '<defs>' + d + '</defs>' + s;
  }

  /* bout de coquille resté sur la tête du bébé */
  function shellHat(G, h) {
    var c = G.c, a = h.rx * 0.68, b = h.ry * 0.5, x = h.x - h.rx * 0.14, y = h.y - h.ry * 0.66, q = r1;
    var d = 'M' + q(-a) + ' 0C' + q(-a) + ' ' + q(-b * 1.4) + ' ' + q(a) + ' ' + q(-b * 1.4) + ' ' + q(a) + ' 0L' + q(a * 0.76) + ' ' + q(b * 0.44) + 'L' + q(a * 0.5) + ' ' + q(b * 0.04) +
      'L' + q(a * 0.22) + ' ' + q(b * 0.48) + 'L' + q(-a * 0.06) + ' ' + q(b * 0.06) + 'L' + q(-a * 0.34) + ' ' + q(b * 0.48) + 'L' + q(-a * 0.62) + ' ' + q(b * 0.06) + 'L' + q(-a * 0.84) + ' ' + q(b * 0.4) + 'Z';
    return '<g transform="translate(' + XY(x, y) + ') rotate(-12)"><path d="' + d + '" transform="translate(1.5 4)" fill="' + c.out + '" opacity=".2"/>' +
      '<path d="' + d + '" fill="url(#' + G.uid + 'sl)" stroke="url(#' + G.uid + 'sl)" stroke-width="2.5"/>' +
      '<circle cx="' + q(a * 0.34) + '" cy="' + q(-b * 0.52) + '" r="' + q(a * 0.14) + '" fill="' + c.plates[0] + '" opacity=".9"/><circle cx="' + q(-a * 0.5) + '" cy="' + q(-b * 0.14) + '" r="' + q(a * 0.09) + '" fill="' + c.body + '" opacity=".85"/>' +
      '<circle cx="' + q(a * 0.66) + '" cy="' + q(-b * 0.1) + '" r="' + q(a * 0.07) + '" fill="' + c.plates[c.plates.length > 1 ? 1 : 0] + '" opacity=".8"/>' +
      '<ellipse cx="' + q(-a * 0.34) + '" cy="' + q(-b * 0.74) + '" rx="' + q(a * 0.22) + '" ry="' + q(b * 0.1) + '" fill="#fff" opacity=".9" transform="rotate(-28 ' + q(-a * 0.34) + ' ' + q(-b * 0.74) + ')"/></g>';
  }
  function shellGrad(c, uid) {
    var cream = mix('#fff8ec', c.light, 0.12);
    return rad(uid + 'sl', [0.36, 0.28, 0.85, 0.3, 0.2], [[0, '#ffffff'], [0.55, cream], [1, mix(cream, c.shade, 0.3)]]);
  }

  /* ------------------------------------------------------------------ œuf (stade 0) */
  function drawEgg(G) {
    var sk = G.sk, c = G.c, u = G.uid, W = 55, H = 134, i, s = '', rnd = rng(hash(sk.id || 'x')), crack = G.crack;
    OX = 200; OY = 360;
    var d = 'M' + XY(0, -H) + 'C' + XY(W * 0.6, -H) + ' ' + XY(W, -H * 0.62) + ' ' + XY(W, -H * 0.38) + 'C' + XY(W, -H * 0.13) + ' ' + XY(W * 0.6, 0) + ' ' + XY(0, 0) +
      'C' + XY(-W * 0.6, 0) + ' ' + XY(-W, -H * 0.13) + ' ' + XY(-W, -H * 0.38) + 'C' + XY(-W, -H * 0.62) + ' ' + XY(-W * 0.6, -H) + ' ' + XY(0, -H) + 'Z';
    var sc = mix(c.shade, c.out, 0.3), df = shellGrad(c, u) +
      rad(u + 'es', [0.36, 0.3, 0.8], [[0, sc, 0], [0.55, sc, 0], [1, sc, 0.42]]) +
      lin(u + 'rm', [0.25, 0.1, 0.92, 0.95], [[0, '#fff', 0], [0.62, '#fff', 0], [1, '#fff', 0.85]]) +
      rad(u + 'sh', [0.5, 0.5, 0.5], [[0, '#000', 0.34], [0.55, '#000', 0.17], [1, '#000', 0]]) +
      rad(u + 'sp', [0.5, 0.5, 0.5], [[0, '#fff', 0.85], [1, '#fff', 0]]) +
      '<path id="' + u + 'ed" d="' + d + '"/><clipPath id="' + u + 'ec"><use href="#' + u + 'ed"/></clipPath>';
    var deco = '', cols = [c.body, c.plates[0], c.shade, c.body, c.plates[c.plates.length > 1 ? 2 % c.plates.length : 0], c.body, c.plates[c.plates.length > 1 ? 4 % c.plates.length : 0]];
    if (sk.pattern === 'stripes') {
      for (i = 0; i < 3; i++) {
        var by = -H * (0.26 + i * 0.25), amp = 9, zz = 'M' + XY(-W - 4, by), j;
        for (j = 0; j <= 6; j++) zz += 'L' + XY(-W - 4 + (j + 0.5) * (W * 2 + 8) / 6, by + (j % 2 ? amp : -amp) - Math.abs(j - 2.5) * 1.5);
        deco += line(zz + 'L' + XY(W + 4, by), i === 1 ? c.plates[0] : c.body, i === 1 ? 7 : 10);
      }
    } else {
      var spots = [[-0.45, 0.22, 15], [0.38, 0.36, 12], [-0.1, 0.5, 9], [0.5, 0.66, 13], [-0.55, 0.62, 10], [0.02, 0.84, 12], [0.3, 0.1, 7], [-0.2, 0.06, 8]];
      for (i = 0; i < spots.length; i++) {
        var jx = (rnd() - 0.5) * 0.16, jy = (rnd() - 0.5) * 0.1, sr = spots[i][2] * (0.8 + rnd() * 0.4);
        deco += E((spots[i][0] + jx) * W * 1.25, -H * (spots[i][1] + jy), sr, sr * (0.8 + rnd() * 0.25), cols[i % cols.length], op(0.92) + rot(rnd() * 90, (spots[i][0] + jx) * W * 1.25, -H * (spots[i][1] + jy)));
      }
    }
    var ck = '', cc = mix(c.shade, c.out, 0.45);
    function zig(p) { var z = 'M' + XY(p[0][0], p[0][1]), k; for (k = 1; k < p.length; k++) z += 'L' + XY(p[k][0], p[k][1]); return z; }
    function crk(p, w) {
      var hl = p.map(function (v) { return [v[0] + 1.2, v[1] + 1.4]; });
      return line(zig(hl), '#fff', w * 0.8, op(0.75)) + line(zig(p), cc, w);
    }
    if (crack === 1) ck = crk([[16, -124], [9, -110], [21, -101], [12, -90]], 2.2);
    else if (crack === 2) ck = crk([[16, -124], [9, -110], [21, -101], [12, -90], [24, -78], [13, -66], [20, -56]], 2.4) + crk([[21, -101], [33, -98], [40, -86]], 2) + crk([[12, -90], [-2, -92], [-10, -82]], 2);
    else if (crack >= 3) ck = crk([[-5, -66], [1, -54], [-7, -45], [0, -36]], 2.2) + crk([[23, -66], [31, -56], [27, -47]], 2) + crk([[9, -75], [4, -88], [12, -97], [7, -106]], 2.2) + crk([[-33, -66], [-40, -56]], 2);
    /* la coquille complète (réutilisée en deux morceaux quand l'œuf s'ouvre) */
    var shell = '<use href="#' + u + 'ed" fill="url(#' + u + 'sl)"/>' +
      '<g clip-path="url(#' + u + 'ec)">' + deco + '<use href="#' + u + 'ed" fill="url(#' + u + 'es)"/>' +
      '<use href="#' + u + 'ed" fill="none" stroke="url(#' + u + 'rm)" stroke-width="5"/>' + ck + '</g>' +
      E(-W * 0.36, -H * 0.72, W * 0.36, H * 0.16, 'url(#' + u + 'sp)', rot(-28, -W * 0.36, -H * 0.72)) +
      E(-W * 0.44, -H * 0.78, W * 0.14, H * 0.045, '#fff', op(0.9) + rot(-38, -W * 0.44, -H * 0.78)) + C(-W * 0.66, -H * 0.6, 2.4, '#fff', op(0.8));
    s += E(0, 3, W * 1.05, 11, 'url(#' + u + 'sh)', ' class="mt-shadow"');
    s += '<g class="mt-all"' + org(0, 0) + '><g class="mt-egg"' + org(0, 0) + '>';
    if (crack >= 3) {                             // le chapeau se soulève : deux yeux guettent dans le noir
      var zz = [[-64, -67], [-47, -75], [-33, -66], [-19, -75], [-5, -66], [9, -75], [23, -66], [37, -75], [50, -67], [64, -73]], dark = mix(c.out, '#000', 0.25);
      df += '<g id="' + u + 'eg">' + shell + '</g><clipPath id="' + u + 'e1"><path d="' + zig(zz) + 'L' + XY(70, 12) + 'L' + XY(-70, 12) + 'Z"/></clipPath>' +
        '<clipPath id="' + u + 'e2"><path d="' + zig(zz) + 'L' + XY(70, -150) + 'L' + XY(-70, -150) + 'Z"/></clipPath>';
      s += E(8, -82, 58, 21, dark, ' clip-path="url(#' + u + 'ec)"') +
        '<g class="mt-peek">' + E(4, -81, 9.2, 10.6, '#fff') + E(5.8, -80.4, 6.2, 7.6, c.out) + C(3.6, -83.4, 2.7, '#fff') + C(7.8, -77.6, 1.1, '#fff', op(0.8)) +
        E(29, -84, 7.6, 9.2, '#fff') + E(30.4, -83.4, 5, 6.6, c.out) + C(28.8, -86, 2.2, '#fff') + C(32, -81, 0.9, '#fff', op(0.8)) + '</g>' +
        '<g clip-path="url(#' + u + 'e1)"><use href="#' + u + 'eg"/></g>' +
        '<g class="mt-cap"' + org(-56, -70) + '><g transform="rotate(-14 ' + XY(-56, -70) + ')" clip-path="url(#' + u + 'e2)"><use href="#' + u + 'eg"/></g></g>';
    } else s += shell;
    return '<defs>' + df + '</defs>' + s + '</g></g>';
  }

  /* ------------------------------------------------------------------ petit fantôme-ange */
  function drawGhost(G) {
    var sk = G.sk, c = G.c, u = G.uid, g = [0.74, 0.74, 0.84, 0.93, 1][G.st] || 1, s = '', i, a, ca, sa, q;
    OX = 200; OY = 360;
    var h = { x: 6, y: -168 * g, rx: 62 * g, ry: 56 * g, sn: 1.2 }, hp = headPts(h, 0);
    var bp = [[h.x - h.rx * 0.6, h.y + h.ry * 0.5], [h.x + h.rx * 0.62, h.y + h.ry * 0.55], [h.x + h.rx * 0.56, h.y + h.ry * 1.3], [h.x + h.rx * 0.1, h.y + h.ry * 1.95],
      [h.x - h.rx * 0.5, h.y + h.ry * 2.3], [h.x - h.rx * 1.12, h.y + h.ry * 2.18], [h.x - h.rx * 0.74, h.y + h.ry * 1.86], [h.x - h.rx * 0.76, h.y + h.ry * 1.15]];
    var w0 = '#ffffff', w1 = mix('#ffffff', c.light, 0.3), w2 = mix(c.light, c.body, 0.3), ink = mix(c.out, c.body, 0.3);
    var d = rad(u + 'sk', [0.36, 0.28, 0.85, 0.3, 0.2], [[0, w0], [0.55, w1], [1, w2]]) +
      rad(u + 'gl', [0.5, 0.5, 0.5], [[0, '#ffe27a', 0.7], [0.5, '#ffe27a', 0.22], [1, '#ffe27a', 0]]) +
      rad(u + 'ck', [0.5, 0.5, 0.5], [[0, c.cheek, 0.7], [0.55, c.cheek, 0.3], [1, c.cheek, 0]]) +
      rad(u + 'sh', [0.5, 0.5, 0.5], [[0, '#000', 0.2], [0.55, '#000', 0.1], [1, '#000', 0]]) +
      lin(u + 'mo', [0.5, 0, 0.5, 1], [[0, ink], [1, ink]]);
    for (i = 0; i < c.plates.length; i++) d += lin(u + 'p' + i, [0.5, 1, 0.5, 0], [[0, mix(c.plates[i], '#ffffff', 0.35)], [1, mix(c.glow, '#ffffff', 0.5)]]);
    G.ghost = true; G.hk = 1;
    var pl = { g: '', s: '', c: '' }, defsP = [[100, 0.7], [134, 0.95], [165, 1]];
    for (i = 0; i < defsP.length; i++) {
      a = defsP[i][0] * Math.PI / 180; ca = Math.cos(a); sa = Math.sin(a); q = Math.sqrt(ca * ca * h.ry * h.ry + sa * sa * h.rx * h.rx);
      plate(G, pl, h.x + h.rx * ca * 0.93, h.y - h.ry * sa * 0.93, ca * h.ry / q, -sa * h.rx / q, 24 * g * defsP[i][1], 26 * g * defsP[i][1], i, false);
    }
    for (i = 0; i < 2; i++) {
      q = blobAt(bp, 6, 0.75 - i * 0.6); var l = Math.sqrt(q.dx * q.dx + q.dy * q.dy) || 1;
      plate(G, pl, q.x + q.dy / l * -3, q.y - q.dx / l * -3, q.dy / l, -q.dx / l, 24 * g * (0.8 - i * 0.25), 26 * g * (0.8 - i * 0.25), 3 + i, false);
    }
    var e = h.rx * 0.176, e1 = { x: h.x + h.rx * 0.2, y: h.y - h.ry * 0.02, rx: e, ry: e * 1.2 }, e2 = { x: h.x + h.rx * 0.83, y: h.y - h.ry * 0.08, rx: e * 0.74, ry: e * 1.1 };
    var mx = h.x + h.rx * 0.62, my = h.y + h.ry * 0.5, mw = h.rx * 0.3, hy = h.y - h.ry - 17 * g, hx = h.x - h.rx * 0.08;
    var GC = { c: { out: ink, body: w1, shade: w2 } }, st = '', stars = [[-1.35, -0.55, 0.1], [1.5, -1.0, 0.13], [1.3, 1.5, 0.08], [-1.2, 1.1, 0.07]];
    for (i = 0; i < stars.length; i++) {
      var sx = h.x + h.rx * stars[i][0], sy = h.y + h.ry * stars[i][1], ss = h.rx * stars[i][2];
      st += Pa('M' + XY(sx, sy - ss) + 'Q' + XY(sx, sy) + ' ' + XY(sx + ss, sy) + 'Q' + XY(sx, sy) + ' ' + XY(sx, sy + ss) + 'Q' + XY(sx, sy) + ' ' + XY(sx - ss, sy) + 'Q' + XY(sx, sy) + ' ' + XY(sx, sy - ss) + 'Z', '#fff7c2',
        ' class="mt-twinkle mt-fb" stroke="#ffd95a" stroke-width="1" style="animation-delay:' + r1(-i * 0.7) + 's"');
    }
    s += E(0, 3, 50 * g, 8, 'url(#' + u + 'sh)', ' class="mt-shadow"');
    s += '<g class="mt-all"' + org(0, 0) + '><g class="mt-ghost"' + org(0, -150 * g) + '>' +
      E(hx, hy, h.rx * 0.74, h.rx * 0.26, 'url(#' + u + 'gl)') +
      '<g opacity=".88"><g opacity=".7">' + plateLayer(pl, 0) + '</g>' + Pa(blob(bp), 'url(#' + u + 'sk)') +
      E(h.x + h.rx * 0.5, h.y + h.ry * 1.02, h.rx * 0.13, h.ry * 0.24, 'url(#' + u + 'sk)', rot(-40, h.x + h.rx * 0.5, h.y + h.ry * 1.02)) +
      Pa(blob(hp), 'url(#' + u + 'sk)') +
      E(h.x + h.rx * 0.18, h.y + h.ry * 1.06, h.rx * 0.14, h.ry * 0.26, 'url(#' + u + 'sk)', rot(-34, h.x + h.rx * 0.18, h.y + h.ry * 1.06)) + '</g>' +
      E(h.x - h.rx * 0.02, h.y + h.ry * 0.42, h.rx * 0.2, h.ry * 0.13, 'url(#' + u + 'ck)') + E(h.x + h.rx * 0.98, h.y + h.ry * 0.36, h.rx * 0.1, h.ry * 0.1, 'url(#' + u + 'ck)') +
      E(h.x - h.rx * 0.44, h.y - h.ry * 0.62, h.rx * 0.17, h.ry * 0.075, '#fff', op(0.95) + rot(-32, h.x - h.rx * 0.44, h.y - h.ry * 0.62)) +
      eye(GC, e1, { eyes: 'arcUp' }) + eye(GC, e2, { eyes: 'arcUp' }) +
      line('M' + XY(mx - mw * 0.7, my - mw * 0.1) + 'Q' + XY(mx, my + mw * 0.5) + ' ' + XY(mx + mw * 0.7, my - mw * 0.08), ink, Math.max(2, mw * 0.2)) +
      /* auréole */
      '<ellipse cx="' + X(hx) + '" cy="' + Y(hy) + '" rx="' + r1(h.rx * 0.5) + '" ry="' + r1(h.rx * 0.13) + '" fill="none" stroke="#f5b82e" stroke-width="' + r1(6.5 * g) + '"/>' +
      '<ellipse cx="' + X(hx) + '" cy="' + Y(hy - 1) + '" rx="' + r1(h.rx * 0.5) + '" ry="' + r1(h.rx * 0.13) + '" fill="none" stroke="#ffe27a" stroke-width="' + r1(4 * g) + '"/>' +
      '<path d="M' + XY(hx - h.rx * 0.42, hy - h.rx * 0.08) + 'Q' + XY(hx - h.rx * 0.2, hy - h.rx * 0.15) + ' ' + XY(hx, hy - h.rx * 0.14) + '" fill="none" stroke="#fff" stroke-width="' + r1(1.6 * g) + '" stroke-linecap="round" opacity=".9"/>' +
      '</g>' + st + '</g>';
    return '<defs>' + d + '</defs>' + s;
  }

  /* ------------------------------------------------------------------ API */
  var DEF = { id: 'defaut', c: { body: '#3fae52', shade: '#237a38', light: '#7fe08a', belly: '#f6eea6', bellyShade: '#e0cf74', plate: '#38e8ff', plateGlow: '#b6fbff', out: '#0c2b17', cheek: '#ff9db0' }, plate: 'tri', horn: false, pattern: null, chub: 1, eyeBig: false };
  var NOMS = ['Œuf', 'Bébé', 'Enfant', 'Ado', 'Adulte'];

  function monster(skin, opts) {
    opts = opts || {};
    var sk = (skin && skin.c) ? skin : DEF, st = Math.round(+opts.stage);
    if (!(st >= 0 && st <= 4)) st = 1;
    var mood = MOODS.hasOwnProperty(opts.mood) ? opts.mood : 'neutral';
    var form = st === 4 ? (opts.form === 'grognon' ? 'grognon' : 'titan') : '';
    var crack = Math.max(0, Math.min(3, Math.round(+opts.crack || 0)));
    var uid = String(opts.uid == null || opts.uid === '' ? 'mt' : opts.uid).replace(/[^\w-]/g, '_') + '-';
    var dead = opts.dead === true;
    var G = { sk: sk, c: palette(sk, mood === 'sick' && !dead && st > 0), uid: uid, st: st, form: form, mood: mood, crack: crack };
    var inner, cls = 'mt-mon mt-s' + st;
    if (dead) { inner = drawGhost(G); cls += ' mt-dead'; }
    else if (st === 0) { inner = drawEgg(G); cls += ' mt-crack' + crack; }
    else { inner = drawMonster(G); cls += ' mt-m-' + mood + (form ? ' mt-f-' + form : ''); }
    return '<svg class="' + cls + '" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' +
      (dead ? 'Petit fantôme' : NOMS[st]) + ' Mini-Titan">' + inner + '</svg>';
  }

  /* ------------------------------------------------------------------ animations */
  var css = [
    '.mt-mon{display:block;overflow:visible}',
    '.mt-mon .mt-all,.mt-mon .mt-breath,.mt-mon .mt-tail,.mt-mon .mt-head,.mt-mon .mt-headi,.mt-mon .mt-arm,.mt-mon .mt-egg,.mt-mon .mt-ghost,.mt-mon .mt-bubble,.mt-mon .mt-cap{transform-box:view-box}',
    '.mt-mon .mt-fb,.mt-mon .mt-shadow,.mt-mon .mt-z,.mt-mon .mt-heart,.mt-mon .mt-tear,.mt-mon .mt-spark,.mt-mon .mt-mark{transform-box:fill-box;transform-origin:50% 50%}',
    '.mt-mon .mt-chomp{transform-box:fill-box;transform-origin:50% 8%}',
    '.mt-mon .mt-chomp-hid{opacity:0}',
    '.mt-mon .mt-blink{opacity:0}',
    /* repos */
    '.mt-mon .mt-breath{animation:mt-breath 3.6s ease-in-out infinite}',
    '.mt-mon .mt-headi{animation:mt-nod 3.6s ease-in-out -.5s infinite}',
    '.mt-mon .mt-tail{animation:mt-tail 3.2s ease-in-out infinite}',
    '.mt-mon .mt-arm{animation:mt-arm 3.6s ease-in-out -.3s infinite}',
    '.mt-mon .mt-blink{animation:mt-blink 5.2s linear infinite}',
    '.mt-mon .mt-glow{animation:mt-glow 2.6s ease-in-out infinite}',
    '.mt-mon .mt-core{animation:mt-core 2.6s ease-in-out infinite}',
    '.mt-mon .mt-glow,.mt-mon .mt-core{animation-delay:var(--d,0s)}',
    '.mt-mon .mt-egg{animation:mt-rock 3.4s ease-in-out infinite}',
    '.mt-mon.mt-crack2 .mt-egg{animation:mt-shiver 2.2s ease-in-out infinite}',
    '.mt-mon.mt-crack3 .mt-egg{animation:mt-shiver 1.3s ease-in-out infinite}',
    '.mt-mon .mt-peek{animation:mt-blink-off 3.4s linear infinite}',
    '.mt-mon .mt-cap{animation:mt-cap 1.3s ease-in-out infinite}',
    '.mt-mon .mt-ghost{animation:mt-float 4s ease-in-out infinite}',
    '.mt-mon.mt-dead .mt-shadow{animation:mt-float-sh 4s ease-in-out infinite}',
    '.mt-mon .mt-twinkle{animation:mt-twinkle 2.8s ease-in-out infinite}',
    '.mt-mon.mt-m-sleep .mt-breath{animation:mt-breath-sleep 5.6s ease-in-out infinite}',
    '.mt-mon.mt-m-sleep .mt-headi,.mt-mon.mt-m-sleep .mt-arm{animation:none}',
    '.mt-mon.mt-m-sleep .mt-tail{animation-duration:6s}',
    '.mt-mon .mt-z{animation:mt-z 2.7s ease-in-out infinite}',
    '.mt-mon .mt-bubble{animation:mt-bubble 5.6s ease-in-out infinite}',
    '.mt-mon .mt-heart{animation:mt-heart 2.1s ease-in-out infinite}',
    '.mt-mon .mt-tear{animation:mt-tear 2.4s ease-in infinite}',
    '.mt-mon .mt-spark{animation:mt-spark .9s ease-in-out infinite}',
    '.mt-mon .mt-mark{animation:mt-spark .7s ease-in-out infinite}',
    '.mt-mon.mt-m-sick .mt-breath{animation-duration:4.6s}',
    '.mt-mon.mt-m-angry .mt-tail{animation-duration:1.1s}',
    '.mt-mon.mt-m-happy .mt-tail,.mt-mon.mt-m-love .mt-tail{animation-duration:1.4s}',
    '@keyframes mt-breath{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,1.022)}}',
    '@keyframes mt-breath-sleep{0%,100%{transform:scale(1,1)}50%{transform:scale(1.022,1.036)}}',
    '@keyframes mt-nod{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-1.4deg)}}',
    '@keyframes mt-tail{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3.2deg)}}',
    '@keyframes mt-arm{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-5deg)}}',
    '@keyframes mt-blink{0%,93.5%{opacity:0}94%,96.6%{opacity:1}97.2%,100%{opacity:0}}',
    '@keyframes mt-blink-off{0%,90%{opacity:1}91%,95%{opacity:0}96%,100%{opacity:1}}',
    '@keyframes mt-glow{0%,100%{opacity:.4}50%{opacity:1}}',
    '@keyframes mt-core{0%,100%{opacity:.3}50%{opacity:.85}}',
    '@keyframes mt-cap{0%,55%,100%{transform:rotate(0deg)}70%{transform:rotate(-5deg)}85%{transform:rotate(1deg)}}',
    '@keyframes mt-rock{0%,100%{transform:rotate(-2.2deg)}50%{transform:rotate(2.2deg)}}',
    '@keyframes mt-shiver{0%,60%,100%{transform:rotate(0deg)}66%{transform:rotate(-4deg)}72%{transform:rotate(4deg)}78%{transform:rotate(-3deg)}84%{transform:rotate(3deg)}92%{transform:rotate(-1deg)}}',
    '@keyframes mt-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}',
    '@keyframes mt-float-sh{0%,100%{transform:scale(1)}50%{transform:scale(.86)}}',
    '@keyframes mt-twinkle{0%,100%{transform:scale(.5);opacity:.35}50%{transform:scale(1.1);opacity:1}}',
    '@keyframes mt-z{0%{transform:translate(-6px,8px) scale(.6);opacity:0}25%{opacity:1}75%{opacity:1}100%{transform:translate(8px,-12px) scale(1.1);opacity:0}}',
    '@keyframes mt-bubble{0%,100%{transform:scale(.35)}50%{transform:scale(1)}}',
    '@keyframes mt-heart{0%{transform:translateY(8px) scale(.5);opacity:0}30%{opacity:1}100%{transform:translateY(-16px) scale(1.1);opacity:0}}',
    '@keyframes mt-tear{0%{transform:translateY(-4px) scale(.4);opacity:0}25%{transform:translateY(0) scale(1);opacity:1}70%{opacity:1}100%{transform:translateY(22px) scale(1);opacity:0}}',
    '@keyframes mt-spark{0%,100%{transform:scale(.85);opacity:.7}50%{transform:scale(1.12);opacity:1}}',
    /* accessibilité : pas d'animation au repos */
    '@media (prefers-reduced-motion: reduce){' + ['breath', 'headi', 'tail', 'arm', 'blink', 'glow', 'core', 'egg', 'peek', 'cap', 'ghost', 'shadow', 'twinkle', 'z', 'bubble', 'heart', 'tear', 'spark', 'mark'].map(function (k) { return '.mt-mon.mt-mon .mt-' + k; }).join(',') + '{animation:none}.mt-mon .mt-glow{opacity:.8}.mt-mon .mt-core{opacity:.6}}',
    /* actions (classe posée ~1 s sur le parent du <svg>) */
    '.mt-act-jump .mt-mon .mt-all{animation:mt-jump .95s cubic-bezier(.3,.1,.3,1) 1}',
    '.mt-act-jump .mt-mon .mt-shadow{animation:mt-jump-sh .95s ease-in-out 1}',
    '.mt-act-jump .mt-mon .mt-arm{animation:mt-arm-up .95s ease-in-out 1}',
    '.mt-act-jump .mt-mon .mt-tail{animation:mt-wag .32s ease-in-out 3}',
    '.mt-act-chomp .mt-mon .mt-mouth{animation:mt-hide 1s linear 1}',
    '.mt-act-chomp .mt-mon .mt-chomp-hid{animation:mt-chomp-show 1s ease-in-out 1}',
    '.mt-act-chomp .mt-mon .mt-chomp-on{animation:mt-chomp 1s ease-in-out 1}',
    '.mt-act-chomp .mt-mon .mt-head{animation:mt-chomp-head 1s ease-in-out 1}',
    '.mt-act-no .mt-mon .mt-head{animation:mt-no .95s ease-in-out 1}',
    '.mt-act-no .mt-mon .mt-tail{animation:mt-wag .32s ease-in-out 3}',
    '.mt-act-wiggle .mt-mon .mt-all{animation:mt-wiggle 1s ease-in-out 1}',
    '.mt-act-wiggle .mt-mon .mt-tail{animation:mt-wag .25s ease-in-out 4}',
    '.mt-act-wiggle .mt-mon .mt-arm{animation:mt-arm-up 1s ease-in-out 1}',
    '.mt-act-wiggle .mt-mon .mt-egg{animation:mt-egg-wiggle 1s ease-in-out 1}',
    '.mt-act-wiggle .mt-mon.mt-s0 .mt-all{animation:none}',
    '.mt-act-hop .mt-mon .mt-all{animation:mt-hop 1s ease-in-out 1}',
    '.mt-act-hop .mt-mon .mt-shadow{animation:mt-hop-sh 1s ease-in-out 1}',
    '@keyframes mt-jump{0%{transform:translateY(0) scale(1,1)}14%{transform:translateY(0) scale(1.09,.88)}42%{transform:translateY(-44px) scale(.95,1.07)}54%{transform:translateY(-48px) scale(1,1)}76%{transform:translateY(0) scale(1.08,.9)}88%{transform:translateY(-5px) scale(.98,1.02)}100%{transform:translateY(0) scale(1,1)}}',
    '@keyframes mt-jump-sh{0%,14%{transform:scale(1);opacity:1}48%{transform:scale(.62);opacity:.55}76%,100%{transform:scale(1);opacity:1}}',
    '@keyframes mt-arm-up{0%,100%{transform:rotate(0deg)}30%,70%{transform:rotate(-58deg)}50%{transform:rotate(-44deg)}}',
    '@keyframes mt-wag{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(8deg)}}',
    '@keyframes mt-hide{0%,100%{opacity:0}}',
    '@keyframes mt-chomp-show{0%{opacity:1;transform:scaleY(.12)}15%{opacity:1;transform:scaleY(1)}32%{transform:scaleY(.12)}48%{transform:scaleY(1)}65%{transform:scaleY(.12)}81%{transform:scaleY(1)}100%{opacity:1;transform:scaleY(.12)}}',
    '@keyframes mt-chomp{0%{transform:scaleY(1)}16%{transform:scaleY(.12)}33%{transform:scaleY(1)}49%{transform:scaleY(.12)}66%{transform:scaleY(1)}82%{transform:scaleY(.12)}100%{transform:scaleY(1)}}',
    '@keyframes mt-chomp-head{0%,33%,66%,100%{transform:translateY(0) rotate(0deg)}16%,49%,82%{transform:translateY(2.5px) rotate(1.6deg)}}',
    '@keyframes mt-no{0%,100%{transform:rotate(0deg) translateX(0)}12%{transform:rotate(-6deg) translateX(-7px)}30%{transform:rotate(5deg) translateX(7px)}48%{transform:rotate(-6deg) translateX(-7px)}66%{transform:rotate(5deg) translateX(7px)}84%{transform:rotate(-3deg) translateX(-3px)}}',
    '@keyframes mt-wiggle{0%,100%{transform:rotate(0deg) scale(1,1)}12%{transform:rotate(-5deg) scale(1.03,.97)}30%{transform:rotate(5deg) scale(.98,1.03)}48%{transform:rotate(-5deg) scale(1.03,.97)}66%{transform:rotate(5deg) scale(.98,1.03)}84%{transform:rotate(-2.5deg) scale(1.01,.99)}}',
    '@keyframes mt-egg-wiggle{0%,100%{transform:rotate(0deg)}12%{transform:rotate(-11deg)}30%{transform:rotate(10deg)}48%{transform:rotate(-9deg)}66%{transform:rotate(8deg)}84%{transform:rotate(-4deg)}}',
    '@keyframes mt-hop{0%,100%{transform:translateY(0) rotate(0deg) scale(1,1)}8%{transform:translateY(0) scale(1.05,.94)}25%{transform:translateY(-16px) rotate(-3deg) scale(.98,1.03)}44%{transform:translateY(0) rotate(0deg) scale(1.05,.94)}52%{transform:translateY(0) scale(1.04,.95)}70%{transform:translateY(-16px) rotate(3deg) scale(.98,1.03)}90%{transform:translateY(0) rotate(0deg) scale(1.04,.95)}}',
    '@keyframes mt-hop-sh{0%,44%,52%,90%,100%{transform:scale(1)}25%,70%{transform:scale(.82)}}'
  ].join('\n');

  MT.arts.a = { name: 'Jouet vinyle 3D', css: css, monster: monster };
})();
