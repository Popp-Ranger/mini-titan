/* Mini-Titan — direction « b » : CARTOON PREMIUM À CONTOUR.
   Contour épais dans c.out, aplats francs, une ombre cel-shading aux bords nets, un liseré de lumière,
   gros yeux à grands reflets, plaques découpées avec reflet graphique.
   Fonction pure : MT.arts.b.monster(skin, opts) -> chaîne SVG (viewBox 0 0 400 400, sol à y = 360). */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};
  MT.arts = MT.arts || {};

  var MOODS = ['neutral', 'happy', 'love', 'sad', 'angry', 'sick', 'sleep', 'eat', 'surprised'];
  var GROUND = 360;

  /* ───────────── outils : nombres, couleurs ───────────── */
  function n(v) { return Math.round(v * 10) / 10; }
  function P(p) { return n(p[0]) + ' ' + n(p[1]); }
  function rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h, 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }
  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b), s = '#', i, v;
    for (i = 0; i < 3; i++) { v = Math.round(A[i] + (B[i] - A[i]) * t).toString(16); s += v.length < 2 ? '0' + v : v; }
    return s;
  }
  function seedOf(str) { var h = 7, i; for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973; return h; }

  /* ───────────── outils : courbes (Catmull-Rom -> Bézier) ───────────── */
  function segs(pts, closed, k) {
    k = (k == null ? 1 : k) / 6;
    var N = pts.length, out = [], m = closed ? N : N - 1, i, p0, p1, p2, p3;
    for (i = 0; i < m; i++) {
      p0 = pts[closed ? (i - 1 + N) % N : Math.max(i - 1, 0)];
      p1 = pts[i];
      p2 = pts[closed ? (i + 1) % N : i + 1];
      p3 = pts[closed ? (i + 2) % N : Math.min(i + 2, N - 1)];
      out.push([p1, [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k],
                    [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k], p2]);
    }
    return out;
  }
  function dOf(S, closed) {
    var d = 'M' + P(S[0][0]), i;
    for (i = 0; i < S.length; i++) d += 'C' + P(S[i][1]) + ' ' + P(S[i][2]) + ' ' + P(S[i][3]);
    return d + (closed ? 'Z' : '');
  }
  function blob(pts, k) { return dOf(segs(pts, true, k), true); }
  function curve(pts, k) { return dOf(segs(pts, false, k), false); }
  /* point + tangente unitaire sur un contour fermé (u = index de segment + fraction) */
  function at(S, u) {
    var N = S.length; u = ((u % N) + N) % N;
    var i = Math.floor(u), t = u - i, a = 1 - t, s = S[i], q = {}, d = [], j, L;
    for (j = 0; j < 2; j++) {
      q[j] = a * a * a * s[0][j] + 3 * a * a * t * s[1][j] + 3 * a * t * t * s[2][j] + t * t * t * s[3][j];
      d[j] = 3 * a * a * (s[1][j] - s[0][j]) + 6 * a * t * (s[2][j] - s[1][j]) + 3 * t * t * (s[3][j] - s[2][j]);
    }
    L = Math.sqrt(d[0] * d[0] + d[1] * d[1]) || 1;
    return { x: q[0], y: q[1], tx: d[0] / L, ty: d[1] / L };   /* normale sortante (contour horaire) = (ty, -tx) */
  }
  /* liseré : portion de contour décalée vers l'intérieur */
  function rim(S, u0, u1, ins) {
    var pts = [], i, q;
    for (i = 0; i <= 6; i++) { q = at(S, u0 + (u1 - u0) * i / 6); pts.push([q.x - q.ty * ins, q.y + q.tx * ins]); }
    return curve(pts);
  }
  function stroke(d, col, w, extra) {
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + n(w) + '"' + (extra || '') + '/>';
  }

  /* ───────────── forme « autocollant » : aplat + ombre cel + contour ─────────────
     La forme est définie une fois dans <defs>, puis réutilisée (fond d'ombre, copie éclairée décalée
     et rognée, contour). inner = détails rognés par la forme. */
  function shape(o, d, fill, shade, inner, opt) {
    opt = opt || {};
    var id = o.u + (o.k++), off = opt.off || [o.sw * 1.3, -o.sw * 1.3];
    o.defs += '<path id="' + id + '" d="' + d + '"/><clipPath id="' + id + 'c"><use href="#' + id + '"/></clipPath>';
    return '<use href="#' + id + '" fill="' + shade + '"/>' +
      '<g clip-path="url(#' + id + 'c)"><use href="#' + id + '" fill="' + fill + '" transform="translate(' + n(off[0]) + ' ' + n(off[1]) + ')"/>' + (inner || '') + '</g>' +
      (opt.noLine ? '' : '<use href="#' + id + '" fill="none" stroke="' + (opt.line || o.c.out) + '" stroke-width="' + n(opt.sw || o.sw) + '"/>');
  }

  /* ───────────── proportions par stade ─────────────
     R/hx/hy tête · sn longueur du museau · bx,by0,by1,wT,wB corps en poire · ln penché vers l'avant · bo bosse du dos
     leg échelle des pattes · arm [longueur, rayon] · tail [longueur, épaisseur, levée à la base, pointe relevée]
     pl hauteurs des plaques [tête[], dos[], queue[]] */
  var STAGES = {
    1: { R: 48, hx: 199, hy: 270, sn: 0.72, bx: 188, by0: 294, by1: 355, wT: 60, wB: 88, ln: 2, bo: 0, leg: 14, arm: [10, 8.5], tail: [36, 30, 5, 7], eye: 1.14, sw: 5, pl: [[7, 9], [], []] },
    2: { R: 54, hx: 208, hy: 231, sn: 0.82, bx: 198, by0: 262, by1: 353, wT: 70, wB: 106, ln: 3, bo: 2, leg: 23, arm: [16, 11], tail: [68, 48, 9, 13], eye: 1.08, sw: 5, pl: [[13, 17], [19, 17], [14, 10]] },
    3: { R: 57, hx: 218, hy: 176, sn: 0.92, bx: 203, by0: 214, by1: 351, wT: 72, wB: 112, ln: 5, bo: 3, leg: 33, arm: [23, 12.5], tail: [104, 60, 13, 20], eye: 1, sw: 5.5, pl: [[19, 25], [29, 29, 25], [21, 16, 11]] },
    titan: { R: 66, hx: 238, hy: 128, sn: 1, bx: 216, by0: 174, by1: 350, wT: 104, wB: 156, ln: 9, bo: 5, leg: 48, arm: [31, 16], tail: [126, 80, 16, 30], eye: 0.96, sw: 6, pl: [[22, 32, 38], [46, 52, 46], [36, 28, 20, 13]] },
    grognon: { R: 64, hx: 244, hy: 164, sn: 1.06, bx: 208, by0: 202, by1: 350, wT: 100, wB: 158, ln: 16, bo: 14, leg: 44, arm: [28, 15], tail: [112, 70, 10, 6], eye: 0.92, sw: 6, pl: [[16, 21, 23], [27, 28, 24], [20, 15, 10]] }
  };

  /* ───────────── plaques dorsales ─────────────
     Dessinées à l'échelle 100 (pointe vers -y, base enfouie de 14), +x = vers la tête. */
  var PLATES = {
    tri:     { d: 'M-48 14Q-31 -52 0 -100Q31 -52 48 14Z', chip: 'M-48 14Q-34 -44 -15 -76L-3 -58L11 -80Q33 -44 48 14Z', hi: 'M19 -20L9 -52', rib: '' },
    round:   { d: 'M-60 14C-60 -138 60 -138 60 14Z', chip: 'M-60 14C-60 -58 -46 -88 -22 -97L-8 -74L9 -96C42 -86 60 -50 60 14Z', hi: 'M24 -68Q37 -50 39 -28', rib: '' },
    crystal: { d: 'M-45 14L-37 -50L-4 -100L33 -58L45 14Z', chip: 'M-45 14L-37 -50L-17 -80L-3 -60L12 -84L33 -58L45 14Z', hi: 'M2 -84L26 -56L8 -40Z', rib: 'M-4 -100L2 14' },
    fin:     { d: 'M50 14C46 -40 10 -92 -52 -100C-64 -60 -58 -20 -50 14Z', chip: 'M50 14C46 -40 10 -90 -28 -97L-34 -76L-56 -80C-62 -50 -58 -20 -50 14Z', hi: 'M33 -24Q20 -58 -4 -78', rib: 'M14 8Q-2 -44 -36 -80M-18 10Q-32 -26 -52 -46' }
  };
  function plateDefs(o, type, withChip) {
    var p = PLATES[type] || PLATES.tri;
    o.defs += '<path id="' + o.u + 'pl" d="' + p.d + '"/>' + (withChip ? '<path id="' + o.u + 'pc" d="' + p.chip + '"/>' : '');
  }
  /* une plaque posée en (x, y), tournée de ang degrés, haute de h */
  function plate(o, type, x, y, ang, h, i, halo, chip) {
    var p = PLATES[type] || PLATES.tri, c = o.c, s = h / 100, cols = c.plate instanceof Array ? c.plate : [c.plate],
      col = cols[i % cols.length], dark = mix(col, c.out, 0.3), ref = '#' + o.u + (chip ? 'pc' : 'pl'),
      sw = n(Math.max(2.6, o.sw * 0.82) / s), inner = ' transform="translate(3 4.2) scale(.7)"',
      g;
    /* --d : décalage de la pulsation, plaque après plaque (une vague lumineuse descend le dos) */
    g = '<g transform="translate(' + P([x, y]) + ') rotate(' + n(ang) + ') scale(' + n(s * 100) / 100 + ')" style="--d:-' + n(2.6 - (i * 0.26) % 2.6) + 's">';
    if (halo) g += '<use href="' + ref + '" class="mt-halo" fill="none" stroke="' + c.plateGlow + '" stroke-width="' + n((o.sw + 10) / s) + '" opacity=".55"/>';
    g += '<use href="' + ref + '" fill="' + dark + '" stroke="' + c.out + '" stroke-width="' + sw + '"/>' +
      '<use href="' + ref + '" fill="' + col + '"' + inner + '/>' +
      '<use href="' + ref + '" class="mt-glow" fill="' + c.plateGlow + '"' + inner + ' opacity=".2"/>';
    if (p.rib) g += '<path d="' + p.rib + '" fill="none" stroke="' + dark + '" stroke-width="' + n(2.2 / s) + '"/>';
    g += type === 'crystal'
      ? '<path d="' + p.hi + '" fill="' + c.plateGlow + '" opacity=".85"/>'
      : '<path d="' + p.hi + '" fill="none" stroke="' + c.plateGlow + '" stroke-width="' + n(Math.max(2.4, o.sw * 0.6) / s) + '"/>';
    return g + '</g>';
  }
  function platesOn(o, S, us, hs, type, i0, halo, chips) {
    var s = '', i, q;
    for (i = 0; i < hs.length; i++) {
      q = at(S, us[i]);
      s += plate(o, type, q.x - q.ty * 3, q.y + q.tx * 3, Math.atan2(q.ty, q.tx) * 180 / Math.PI, hs[i], i0 + i, halo, chips && (i0 + i) % 2 === 0);
    }
    return s;
  }

  /* ───────────── motifs (rayures / taches) rognés par la forme ───────────── */
  function stripesOn(o, S, us, len, wid) {
    var s = '', i, q, nx, ny, col = mix(o.c.shade, o.c.out, 0.28), a, b, tip, m;
    for (i = 0; i < us.length; i++) {
      q = at(S, us[i]); nx = q.ty; ny = -q.tx;
      a = [q.x + q.tx * wid + nx * 6, q.y + q.ty * wid + ny * 6];
      b = [q.x - q.tx * wid + nx * 6, q.y - q.ty * wid + ny * 6];
      tip = [q.x - nx * len, q.y - ny * len];
      m = [q.x - nx * len * 0.5, q.y - ny * len * 0.5];
      s += '<path d="M' + P(a) + 'Q' + P([m[0] + q.tx * wid * 0.5, m[1] + q.ty * wid * 0.5]) + ' ' + P(tip) + 'Q' + P([m[0] - q.tx * wid * 0.9, m[1] - q.ty * wid * 0.9]) + ' ' + P(b) + 'Z" fill="' + col + '"/>';
    }
    return s;
  }
  function spots(o, list) {
    var s = '', i;
    for (i = 0; i < list.length; i++) s += '<circle cx="' + n(list[i][0]) + '" cy="' + n(list[i][1]) + '" r="' + n(list[i][2]) + '" fill="' + o.c.shade + '"/>';
    return s;
  }

  /* ───────────── membres ───────────── */
  /* boudin effilé entre deux cercles */
  function capsule(x0, y0, r0, x1, y1, r1) {
    var a = Math.atan2(y1 - y0, x1 - x0), pts = [], i, t;
    for (i = 0; i < 5; i++) { t = a + Math.PI / 2 + i * Math.PI / 4; pts.push([x0 + Math.cos(t) * r0, y0 + Math.sin(t) * r0]); }
    for (i = 0; i < 5; i++) { t = a - Math.PI / 2 + i * Math.PI / 4; pts.push([x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1]); }
    return pts;
  }
  var LEG = [[-0.1, -1.6], [0.45, -1.4], [0.7, -0.92], [0.7, -0.56], [1.12, -0.52], [1.52, -0.3], [1.5, -0.03], [0.6, 0], [-0.35, 0], [-0.72, -0.2], [-0.86, -0.85], [-0.62, -1.38]];
  function leg(o, ax, s, far) {
    var c = o.c, pts = LEG.map(function (p) { return [ax + p[0] * s, GROUND - 1 + p[1] * s]; }), S = segs(pts, true),
      f = function (x, y) { return [ax + x * s, GROUND - 1 + y * s]; }, inner = '', out = '';
    if (!far) {
      inner += stroke(rim(S, 0.3, 1.9, o.sw * 0.5 + 4), c.light, o.sw * 0.7);
      if (o.pattern === 'stripes') inner += stripesOn(o, S, [10.3, 11.2], s * 0.62, s * 0.13);
      if (o.pattern === 'spots') inner += spots(o, [[f(-0.3, -1.0)[0], f(-0.3, -1.0)[1], s * 0.17], [f(0.1, -0.62)[0], f(0.1, -0.62)[1], s * 0.1]]);
    }
    out = shape(o, dOf(S, true), far ? c.shade : c.body, far ? mix(c.shade, c.out, 0.25) : c.shade, inner, { off: [s * 0.1, -s * 0.13] });
    /* orteils */
    out += stroke('M' + P(f(1.24, -0.42)) + 'Q' + P(f(1.31, -0.28)) + ' ' + P(f(1.27, -0.14)) + 'M' + P(f(0.98, -0.5)) + 'Q' + P(f(1.05, -0.34)) + ' ' + P(f(1.02, -0.18)), c.out, Math.max(2, o.sw * 0.5));
    return out;
  }
  function arm(o, sx, sy, len, r, ang, far) {
    var c = o.c, a = ang * Math.PI / 180, hx = sx + Math.cos(a) * len, hy = sy + Math.sin(a) * len,
      S = segs(capsule(sx, sy, r * 0.95, hx, hy, r * 1.06), true), px = -Math.sin(a), py = Math.cos(a), out;
    out = far
      ? shape(o, dOf(S, true), c.shade, mix(c.shade, c.out, 0.25), '', { off: [r * 0.3, -r * 0.42] })
      : shape(o, dOf(S, true), c.body, c.body, stroke(rim(S, 7.7, 9.9, r * 0.1), c.shade, r * 0.62) + stroke(rim(S, 5.4, 7, o.sw * 0.5 + 3), c.light, o.sw * 0.6), { off: [0, 0], noLine: true });
    /* bras proche : contour ouvert côté épaule pour qu'il se fonde dans le corps */
    if (!far) out += stroke(dOf(S.slice(4, 10), false), c.out, o.sw);
    /* petit pli entre les doigts */
    out += stroke('M' + P([hx + Math.cos(a) * r * 0.86 + px * r * 0.1, hy + Math.sin(a) * r * 0.86 + py * r * 0.1]) + 'L' + P([hx + Math.cos(a) * r * 0.3 + px * r * 0.16, hy + Math.sin(a) * r * 0.3 + py * r * 0.16]), c.out, Math.max(1.8, o.sw * 0.45));
    return out;
  }

  /* ───────────── queue ───────────── */
  function tailGeo(x0, L, w0, lift0, tipUp) {
    function c(t) {
      var w = w0 * Math.pow(Math.max(0, 1 - t), 0.8) + 8 * t;
      return [x0 - L * t, GROUND - 2 - w / 2 - lift0 * (1 - t) * (1 - t) - tipUp * Math.pow(Math.max(0, (t - 0.5) / 0.5), 2), w];
    }
    function frame(t) {
      var p = c(t), a = c(t - 0.02), b = c(t + 0.02), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l;                    /* (dx,dy) file vers la pointe de la queue (à gauche) ; (nx,ny) = normale côté dos (vers le haut) */
      return { p: p, nx: -dy, ny: dx, w: p[2], dx: dx, dy: dy };
    }
    var top = [], bot = [], i, f, N = 6;
    for (i = 0; i <= N; i++) {
      f = frame(i / N);
      top.push([f.p[0] + f.nx * f.w / 2, f.p[1] + f.ny * f.w / 2]);
      bot.push([f.p[0] - f.nx * f.w / 2, f.p[1] - f.ny * f.w / 2]);
    }
    f = frame(1);
    return { pts: top.concat([[f.p[0] + f.dx * 5, f.p[1] + f.dy * 5]], bot.reverse()), frame: frame, pivot: [x0, c(0)[1]] };
  }

  /* ───────────── petits objets (cœur, goutte, Z…) ───────────── */
  function heart(x, y, s) {
    return 'M' + P([x, y + s * 0.9]) + 'C' + P([x - s * 1.5, y - s * 0.1]) + ' ' + P([x - s * 0.75, y - s * 1.15]) + ' ' + P([x, y - s * 0.38]) +
      'C' + P([x + s * 0.75, y - s * 1.15]) + ' ' + P([x + s * 1.5, y - s * 0.1]) + ' ' + P([x, y + s * 0.9]) + 'Z';
  }
  function drop(x, y, s) {
    return 'M' + P([x, y - s * 1.3]) + 'C' + P([x + s * 0.3, y - s * 0.5]) + ' ' + P([x + s * 0.85, y]) + ' ' + P([x + s * 0.85, y + s * 0.35]) +
      'A' + n(s * 0.85) + ' ' + n(s * 0.85) + ' 0 1 1 ' + P([x - s * 0.85, y + s * 0.35]) + 'C' + P([x - s * 0.85, y]) + ' ' + P([x - s * 0.3, y - s * 0.5]) + ' ' + P([x, y - s * 1.3]) + 'Z';
  }
  function sticker(d, col, w, out) {       /* trait doublé : liseré sombre + couleur (lisible sur fond clair comme sombre) */
    return stroke(d, out, w + 5) + stroke(d, col, w);
  }
  function zed(x, y, s) { return 'M' + P([x, y]) + 'h' + n(s) + 'l' + n(-s) + ' ' + n(s) + 'h' + n(s); }

  /* ───────────── yeux ───────────── */
  function eye(o, ex, ey, rx, ry, m, side) {
    var c = o.c, lw = Math.max(2.4, o.sw * 0.62), id, s, px, py, prx, pry, yi, yo, xi, xo;
    if (m.arc === 'up') return stroke('M' + P([ex - rx, ey + ry * 0.3]) + 'Q' + P([ex, ey - ry * 1.0]) + ' ' + P([ex + rx, ey + ry * 0.3]), c.out, o.sw * 0.9);
    if (m.arc === 'down') return stroke('M' + P([ex - rx, ey - ry * 0.02]) + 'Q' + P([ex, ey + ry * 0.72]) + ' ' + P([ex + rx, ey - ry * 0.02]), c.out, o.sw * 0.9);
    if (m.wide) { rx *= m.wide; ry *= m.wide; }
    id = o.u + (o.k++);
    o.defs += '<clipPath id="' + id + '"><ellipse cx="' + n(ex) + '" cy="' + n(ey) + '" rx="' + n(rx) + '" ry="' + n(ry) + '"/></clipPath>';
    prx = rx * (m.pupil || 0.7); pry = ry * (m.pupil || 0.7) * 1.04; px = ex + rx * 0.14; py = ey + ry * (m.lid ? 0.16 : 0.06);
    s = '<g class="mt-blink"><ellipse cx="' + n(ex) + '" cy="' + n(ey) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="#fff"/><g clip-path="url(#' + id + ')">' +
      '<ellipse cx="' + n(ex) + '" cy="' + n(ey - ry * 1.02) + '" rx="' + n(rx * 1.3) + '" ry="' + n(ry * 0.52) + '" fill="' + mix('#ffffff', c.out, 0.16) + '"/>';
    if (m.heart) {
      s += '<path d="' + heart(ex, ey + ry * 0.02, rx * 0.74) + '" fill="#ff3d7f"/><circle cx="' + n(ex - rx * 0.32) + '" cy="' + n(ey - ry * 0.24) + '" r="' + n(rx * 0.17) + '" fill="#fff"/>';
    } else {
      s += '<ellipse cx="' + n(px) + '" cy="' + n(py) + '" rx="' + n(prx) + '" ry="' + n(pry) + '" fill="' + c.out + '"/>';
      if (!m.dull) s += '<ellipse cx="' + n(px) + '" cy="' + n(py + pry * 0.5) + '" rx="' + n(prx * 0.6) + '" ry="' + n(pry * 0.3) + '" fill="' + o.iris + '" opacity=".8"/>';
      s += '<circle cx="' + n(px + prx * 0.36) + '" cy="' + n(py - pry * 0.4) + '" r="' + n(prx * (m.dull ? 0.24 : 0.38)) + '" fill="#fff"/>' +
        (m.dull ? '' : '<circle cx="' + n(px - prx * 0.42) + '" cy="' + n(py + pry * 0.3) + '" r="' + n(prx * 0.17) + '" fill="#fff"/>');
    }
    if (m.lid) {
      xi = ex + side * rx * 1.15; xo = ex - side * rx * 1.15;
      yi = ey - ry + 2 * ry * m.lid[0]; yo = ey - ry + 2 * ry * m.lid[1];
      s += '<path d="M' + P([xo, ey - ry - 5]) + 'L' + P([xi, ey - ry - 5]) + 'L' + P([xi, yi]) + 'L' + P([xo, yo]) + 'Z" fill="' + c.body + '"/>' +
        stroke('M' + P([xi, yi]) + 'L' + P([xo, yo]), c.out, lw);
    }
    return s + '</g><ellipse cx="' + n(ex) + '" cy="' + n(ey) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="none" stroke="' + c.out + '" stroke-width="' + n(lw) + '"/></g>';
  }
  function brow(o, ex, ey, rx, ry, side, inDrop, lift, arch) {
    var y = ey - ry - lift * ry, xi = ex + side * rx * 0.95, xo = ex - side * rx * 0.95,
      yi = y + inDrop * ry, yo = y - inDrop * ry * 0.55;
    return stroke('M' + P([xo, yo]) + 'Q' + P([ex, (yi + yo) / 2 - arch * ry]) + ' ' + P([xi, yi]), o.c.out, o.sw * 0.95);
  }

  /* ───────────── tête complète (plaques, crâne, visage) ───────────── */
  var HEAD = [[-0.15, -1], [0.5, -0.9], [0.9, -0.52], [1.02, -0.16], [1.3, 0.06], [1.46, 0.42], [1.26, 0.8], [0.66, 0.97], [-0.1, 0.98], [-0.75, 0.76], [-1.02, 0.1], [-0.86, -0.6]];
  function head(o, st, skin, stage, form, mood) {
    var c = o.c, R = st.R, sw = o.sw,
      H = function (x, y) { if (x > 0.85) x = 0.85 + (x - 0.85) * st.sn; return [st.hx + x * R, st.hy + y * R]; },
      pts = HEAD.map(function (p) { return H(p[0], p[1]); }), S = segs(pts, true),
      es = st.eye * (skin.eyeBig ? 1.14 : 1),
      r1 = [0.3 * R * es, 0.38 * R * es], r2 = [0.2 * R * es, 0.34 * R * es],
      E2 = [st.hx + 0.95 * R - r2[0], st.hy - 0.17 * R], E1 = [E2[0] - r2[0] - 0.09 * R - r1[0], st.hy - 0.1 * R],
      grog = form === 'grognon', m = {}, back = '', inner = '', front = '', fx = '', mouth = '', browS = '', hp = st.pl[0],
      mouthDark = mix('#8e1f3a', c.out, 0.4), tongue = '#ff7d92', thin = Math.max(2.6, sw * 0.7), t;

    /* -- plaques de la tête + corne (derrière le crâne) -- */
    back += platesOn(o, S, hp.length === 3 ? [11.9, 11.35, 10.75] : [11.6, 10.95], hp, skin.plate, 0, form === 'titan', grog);
    if (skin.horn && stage >= 2) {
      t = at(S, 4.2);
      var hh = R * [0, 0, 0.2, 0.32, grog ? 0.34 : 0.52][stage], hb = R * 0.17 + hh * 0.12, ivory = mix(c.belly, '#ffffff', 0.55);
      back += '<g transform="translate(' + P([t.x - t.ty * 5, t.y + t.tx * 5]) + ') rotate(' + n(Math.atan2(t.ty, t.tx) * 180 / Math.PI - 8) + ')">' +
        '<path d="M' + n(-hb) + ' 6Q' + n(-hb * 0.5) + ' ' + n(-hh * 0.6) + ' ' + n(hb * 0.35) + ' ' + n(-hh) + 'Q' + n(hb * 0.95) + ' ' + n(-hh * 0.4) + ' ' + n(hb) + ' 6Z" fill="' + ivory + '" stroke="' + c.out + '" stroke-width="' + n(sw * 0.85) + '"/>' +
        '<path d="M' + n(-hb) + ' 6Q' + n(-hb * 0.5) + ' ' + n(-hh * 0.6) + ' ' + n(hb * 0.35) + ' ' + n(-hh) + 'Q' + n(-hb * 0.1) + ' ' + n(-hh * 0.4) + ' ' + n(-hb * 0.3) + ' 6Z" fill="' + mix(ivory, c.shade, 0.35) + '"/></g>';
    }

    /* -- humeur -> réglages des yeux -- */
    if (mood === 'happy' || mood === 'eat') m.arc = 'up';
    else if (mood === 'sleep') m.arc = 'down';
    else if (mood === 'love') m.heart = true;
    else if (mood === 'sad') m.lid = [0.12, 0.42];
    else if (mood === 'angry') m.lid = [0.46, 0.1];
    else if (mood === 'sick') { m.lid = [0.5, 0.5]; m.dull = true; m.pupil = 0.56; }
    else if (mood === 'surprised') { m.wide = 1.12; m.pupil = 0.46; }
    if (grog && !m.arc && !m.lid) m.lid = [0.3, 0.22];

    /* -- intérieur du crâne (rogné) : motif, joue, œil lointain -- */
    if (o.pattern === 'stripes') inner += stripesOn(o, S, [9.7, 10.6, 11.5], R * 0.44, R * 0.09);
    if (o.pattern === 'spots') inner += spots(o, [[H(-0.52, -0.5)[0], H(-0.52, -0.5)[1], R * 0.15], [H(-0.14, -0.74)[0], H(-0.14, -0.74)[1], R * 0.09], [H(-0.78, -0.02)[0], H(-0.78, -0.02)[1], R * 0.11], [H(-0.42, 0.42)[0], H(-0.42, 0.42)[1], R * 0.08]]);
    inner += stroke(rim(S, 0.25, 1.75, sw * 0.5 + 5.5), c.light, sw * 0.8) +
      '<circle cx="' + n(H(0.86, -0.6)[0]) + '" cy="' + n(H(0.86, -0.6)[1]) + '" r="' + n(sw * 0.42) + '" fill="' + c.light + '"/>';
    t = (mood === 'love' || mood === 'happy') ? 1 : 0.88;
    inner += '<ellipse cx="' + n(H(-0.08, 0.44)[0]) + '" cy="' + n(H(-0.08, 0.44)[1]) + '" rx="' + n(R * 0.19) + '" ry="' + n(R * 0.12) + '" fill="' + c.cheek + '" opacity="' + t + '"/>';
    inner += eye(o, E2[0], E2[1], r2[0], r2[1], m, -1);

    /* -- sourcils -- */
    if (!m.arc) {
      if (mood === 'angry') browS = brow(o, E1[0], E1[1], r1[0], r1[1], 1, 0.5, -0.12, 0) + brow(o, E2[0], E2[1], r2[0], r2[1], -1, 0.5, -0.12, 0);
      else if (mood === 'sad' || mood === 'sick') browS = brow(o, E1[0], E1[1], r1[0], r1[1], 1, -0.34, 0.2, 0) + brow(o, E2[0], E2[1], r2[0], r2[1], -1, -0.34, 0.2, 0);
      else if (mood === 'surprised') browS = brow(o, E1[0], E1[1], r1[0], r1[1], 1, 0, 0.42, 0.3) + brow(o, E2[0], E2[1], r2[0], r2[1], -1, 0, 0.42, 0.3);
      else if (grog) browS = brow(o, E1[0], E1[1], r1[0], r1[1], 1, 0.3, -0.2, 0) + brow(o, E2[0], E2[1], r2[0], r2[1], -1, 0.3, -0.2, 0);
      else if (stage === 4) browS = brow(o, E1[0], E1[1], r1[0] * 0.6, r1[1], 1, 0.03, 0.24, 0.03) + brow(o, E2[0], E2[1], r2[0] * 0.6, r2[1], -1, 0.03, 0.24, 0.03);
      else if (stage === 3) browS = brow(o, E1[0], E1[1], r1[0] * 0.7, r1[1], 1, 0.14, 0.2, 0.04) + brow(o, E2[0], E2[1], r2[0] * 0.7, r2[1], -1, 0.14, 0.2, 0.04);
    } else if (grog) browS = brow(o, E1[0], E1[1], r1[0], r1[1], 1, 0.3, 0.1, 0) + brow(o, E2[0], E2[1], r2[0], r2[1], -1, 0.3, 0.1, 0);

    /* -- bouche -- */
    var fang = stage >= 3 && !grog ? '<path d="M' + P(H(1.05, 0.66)) + 'L' + P(H(1.12, 0.8)) + 'L' + P(H(1.2, 0.62)) + 'Z" fill="#fff" stroke="' + c.out + '" stroke-width="' + n(thin * 0.8) + '"/>' : '';
    var under = grog ? '<path d="M' + P(H(0.96, 0.7)) + 'L' + P(H(1.04, 0.5)) + 'L' + P(H(1.14, 0.68)) + 'Z" fill="#fff" stroke="' + c.out + '" stroke-width="' + n(thin * 0.8) + '"/>' : '';
    function openMouth(d, tx, ty, teeth) {
      return shape(o, d, mouthDark, mouthDark,
        '<ellipse cx="' + n(H(tx, ty)[0]) + '" cy="' + n(H(tx, ty)[1]) + '" rx="' + n(R * 0.3) + '" ry="' + n(R * 0.2) + '" fill="' + tongue + '"/>' + (teeth || ''), { sw: thin, off: [0, 0] });
    }
    function teeth(y) {
      return '<path d="M' + P(H(0.62, y - 0.1)) + 'L' + P(H(0.64, y + 0.06)) + 'Q' + P(H(0.74, y + 0.17)) + ' ' + P(H(0.84, y + 0.08)) + 'Q' + P(H(0.96, y + 0.2)) + ' ' + P(H(1.07, y + 0.08)) + 'Q' + P(H(1.17, y + 0.15)) + ' ' + P(H(1.25, y + 0.02)) + 'L' + P(H(1.3, y - 0.1)) + 'Z" fill="#fff"/>';
    }
    var smile = 'M' + P(H(1.36, 0.46)) + 'C' + P(H(1.22, 0.68)) + ' ' + P(H(0.82, 0.76)) + ' ' + P(H(0.5, 0.52));
    var dimple = 'M' + P(H(0.43, 0.43)) + 'Q' + P(H(0.44, 0.55)) + ' ' + P(H(0.56, 0.6));
    var dOpen = 'M' + P(H(1.38, 0.4)) + 'C' + P(H(1.24, 0.52)) + ' ' + P(H(0.8, 0.54)) + ' ' + P(H(0.47, 0.4)) + 'C' + P(H(0.4, 0.98)) + ' ' + P(H(1.2, 1.08)) + ' ' + P(H(1.38, 0.4)) + 'Z';
    if (mood === 'happy' || mood === 'love') {
      mouth = openMouth('M' + P(H(1.36, 0.44)) + 'C' + P(H(1.2, 0.6)) + ' ' + P(H(0.8, 0.66)) + ' ' + P(H(0.48, 0.45)) + 'C' + P(H(0.5, 0.9)) + ' ' + P(H(1.12, 1.0)) + ' ' + P(H(1.36, 0.44)) + 'Z', 0.84, 0.9) + under;
    } else if (mood === 'sad') {
      mouth = stroke('M' + P(H(1.3, 0.64)) + 'C' + P(H(1.14, 0.48)) + ' ' + P(H(0.84, 0.48)) + ' ' + P(H(0.6, 0.7)), c.out, thin) + under;
    } else if (mood === 'angry') {
      mouth = '<path d="M' + P(H(0.6, 0.52)) + 'Q' + P(H(0.95, 0.4)) + ' ' + P(H(1.32, 0.5)) + 'L' + P(H(1.27, 0.7)) + 'Q' + P(H(0.95, 0.62)) + ' ' + P(H(0.65, 0.74)) + 'Z" fill="#fff" stroke="' + c.out + '" stroke-width="' + n(thin) + '"/>' +
        stroke('M' + P(H(0.82, 0.47)) + 'L' + P(H(0.84, 0.66)) + 'M' + P(H(1.07, 0.45)) + 'L' + P(H(1.07, 0.64)), c.out, thin * 0.7);
    } else if (mood === 'sick') {
      mouth = stroke('M' + P(H(0.56, 0.62)) + 'Q' + P(H(0.66, 0.52)) + ' ' + P(H(0.78, 0.62)) + 'T' + P(H(1.0, 0.62)) + 'T' + P(H(1.22, 0.6)), c.out, thin) +
        stroke('M' + P(H(1.12, 0.62)) + 'L' + P(H(1.82, 0.92)), c.out, 10) + stroke('M' + P(H(1.12, 0.62)) + 'L' + P(H(1.82, 0.92)), '#fff', 5.2) +
        stroke('M' + P(H(1.4, 0.74)) + 'L' + P(H(1.8, 0.91)), '#ff4b5c', 2.6);
    } else if (mood === 'sleep') {
      mouth = stroke('M' + P(H(0.84, 0.6)) + 'Q' + P(H(0.98, 0.7)) + ' ' + P(H(1.14, 0.6)), c.out, thin);
    } else if (mood === 'surprised') {
      mouth = '<ellipse cx="' + n(H(1.0, 0.62)[0]) + '" cy="' + n(H(1.0, 0.62)[1]) + '" rx="' + n(R * 0.12) + '" ry="' + n(R * 0.16) + '" fill="' + mouthDark + '" stroke="' + c.out + '" stroke-width="' + n(thin) + '"/>';
    } else if (mood !== 'eat') {
      mouth = grog
        ? stroke('M' + P(H(1.34, 0.6)) + 'C' + P(H(1.16, 0.5)) + ' ' + P(H(0.84, 0.52)) + ' ' + P(H(0.56, 0.68)), c.out, thin) + under
        : stroke(smile, c.out, thin) + stroke(dimple, c.out, thin) + fang;
    }
    front += '<g class="mt-mouth">' + mouth + '</g>' +
      '<g class="mt-mouth-open"' + (mood === 'eat' ? '' : ' opacity="0"') + '>' + openMouth(dOpen, 0.9, 0.98, teeth(0.5)) + '</g>';

    /* -- narines, œil proche, sourcils -- */
    front += '<ellipse cx="' + n(H(1.2, 0.2)[0]) + '" cy="' + n(H(1.2, 0.2)[1]) + '" rx="' + n(R * 0.035) + '" ry="' + n(R * 0.055) + '" fill="' + c.out + '" transform="rotate(20 ' + P(H(1.2, 0.2)) + ')"/>' +
      '<ellipse cx="' + n(H(1.36, 0.26)[0]) + '" cy="' + n(H(1.36, 0.26)[1]) + '" rx="' + n(R * 0.028) + '" ry="' + n(R * 0.048) + '" fill="' + c.out + '" transform="rotate(20 ' + P(H(1.36, 0.26)) + ')"/>';
    front += eye(o, E1[0], E1[1], r1[0], r1[1], m, 1) + browS;

    /* -- petits effets d'humeur -- */
    if (mood === 'sad') fx += '<path class="mt-fx mt-fx-tear" d="' + drop(E1[0] - r1[0] * 0.5, E1[1] + r1[1] + R * 0.24, R * 0.1) + '" fill="#8fe0ff" stroke="' + c.out + '" stroke-width="2.6"/>';
    if (mood === 'sick') fx += '<path class="mt-fx mt-fx-tear" d="' + drop(H(-0.6, -0.5)[0], H(-0.6, -0.5)[1], R * 0.11) + '" fill="#8fe0ff" stroke="' + c.out + '" stroke-width="2.6"/>';
    if (mood === 'love') fx += '<path class="mt-fx mt-fx-heart" d="' + heart(H(1.35, -0.95)[0], H(1.35, -0.95)[1], R * 0.2) + '" fill="#ff4f8b" stroke="' + c.out + '" stroke-width="3"/>' +
      '<path class="mt-fx mt-fx-heart2" d="' + heart(H(1.72, -0.5)[0], H(1.72, -0.5)[1], R * 0.13) + '" fill="#ff8fb4" stroke="' + c.out + '" stroke-width="2.6"/>';
    if (mood === 'angry') { t = H(-0.5, -0.98); fx += '<g class="mt-fx mt-fx-pop">' + sticker('M' + P([t[0] - 12, t[1] - 4]) + 'q8 0 8 -8M' + P([t[0] + 4, t[1] - 12]) + 'q0 8 8 8M' + P([t[0] + 12, t[1] + 4]) + 'q-8 0 -8 8M' + P([t[0] - 4, t[1] + 12]) + 'q0 -8 -8 -8', '#ff4b4b', 4, c.out) + '</g>'; }
    if (mood === 'surprised') { t = H(1.3, -1.02); fx += '<g class="mt-fx mt-fx-pop">' + sticker('M' + P(t) + 'l6 -15M' + P([t[0] + 14, t[1] + 8]) + 'l15 -8M' + P([t[0] - 13, t[1] - 3]) + 'l-3 -14', '#ffd84d', 4, c.out) + '</g>'; }
    if (mood === 'sleep') {
      t = H(1.25, -0.72);
      fx += '<g class="mt-fx mt-fx-z">' + sticker(zed(t[0], t[1], R * 0.2), '#fff', 3.6, c.out) + '</g><g class="mt-fx mt-fx-z2">' + sticker(zed(t[0] + R * 0.34, t[1] - R * 0.42, R * 0.28), '#fff', 4, c.out) + '</g>' +
        '<circle class="mt-fx mt-fx-bub" cx="' + n(H(1.56, 0.3)[0]) + '" cy="' + n(H(1.56, 0.3)[1]) + '" r="' + n(R * 0.17) + '" fill="#d9f4ff" fill-opacity=".75" stroke="' + c.out + '" stroke-width="2.6"/>';
    }

    /* -- bout de coquille du bébé -- */
    if (stage === 1) {
      var sh = o.shell, cap = [H(-0.72, -0.72), H(-0.6, -1.04), H(-0.16, -1.3), H(0.34, -1.14), H(0.56, -0.8)],
        zz = 'L' + P(H(0.38, -0.92)) + 'L' + P(H(0.2, -0.76)) + 'L' + P(H(0.02, -0.98)) + 'L' + P(H(-0.18, -0.8)) + 'L' + P(H(-0.38, -0.98)) + 'L' + P(H(-0.54, -0.76)) + 'Z';
      front += '<g transform="rotate(-7 ' + P(H(-0.1, -1)) + ')">' + shape(o, curve(cap) + zz, sh[0], sh[1],
        '<circle cx="' + n(H(-0.3, -1.1)[0]) + '" cy="' + n(H(-0.3, -1.1)[1]) + '" r="' + n(R * 0.09) + '" fill="' + sh[2] + '"/><circle cx="' + n(H(0.22, -1.0)[0]) + '" cy="' + n(H(0.22, -1.0)[1]) + '" r="' + n(R * 0.06) + '" fill="' + sh[3] + '"/>', { sw: sw * 0.85, off: [4, -4] }) + '</g>';
    }

    var piv = H(-0.2, 0.85), tilt = mood === 'sleep' ? 7 : (mood === 'sad' || mood === 'sick' ? 3 : 0);
    return '<g class="mt-headA" style="transform-origin:' + n(piv[0]) + 'px ' + n(piv[1]) + 'px"><g class="mt-head" style="transform-origin:' + n(piv[0]) + 'px ' + n(piv[1]) + 'px">' +
      (tilt ? '<g transform="rotate(' + tilt + ' ' + P(piv) + ')">' : '<g>') +
      back + shape(o, dOf(S, true), c.body, c.shade, inner, { off: [R * 0.13, -R * 0.12] }) + front + fx + '</g></g></g>';
  }

  /* ───────────── le monstre (stades 1 à 4) ───────────── */
  function creature(o, skin, stage, form, mood) {
    var c = o.c, st = STAGES[stage === 4 ? form : stage], sw = o.sw, chub = skin.chub || 1,
      h = st.by1 - st.by0, wb = st.wB * chub, wt = st.wT * (0.4 + 0.6 * chub), bx = st.bx,
      titan = form === 'titan', grog = form === 'grognon',
      bodyPts = [[bx + st.ln, st.by0], [bx + wt * 0.5 + st.ln * 0.7, st.by0 + h * 0.2], [bx + wb * 0.52, st.by0 + h * 0.62], [bx + wb * 0.4, st.by0 + h * 0.9],
        [bx, st.by1], [bx - wb * 0.42, st.by0 + h * 0.92], [bx - wb * 0.52, st.by0 + h * 0.62], [bx - wt * 0.5 - st.bo, st.by0 + h * 0.2]],
      BS = segs(bodyPts, true), tg, TS, s = '', i, f, inner, bp = st.pl[1], tp = st.pl[2], nHead = st.pl[0].length, us;

    plateDefs(o, skin.plate, grog);

    /* -- queue -- */
    tg = tailGeo(bx - wb * 0.27, st.tail[0], st.tail[1], st.tail[2], st.tail[3]);
    TS = segs(tg.pts, true);
    s += '<g class="mt-tail" style="transform-origin:' + n(tg.pivot[0]) + 'px ' + n(tg.pivot[1]) + 'px">';
    us = tp.length === 4 ? [0.24, 0.43, 0.6, 0.76] : tp.length === 3 ? [0.28, 0.5, 0.7] : [0.36, 0.64];
    for (i = 0; i < tp.length; i++) {
      f = tg.frame(us[i]);
      s += plate(o, skin.plate, f.p[0] + f.nx * (f.w / 2 - 3), f.p[1] + f.ny * (f.w / 2 - 3), Math.atan2(-f.dy, -f.dx) * 180 / Math.PI, tp[i], nHead + bp.length + i, titan, grog);
    }
    inner = '';
    if (o.pattern === 'stripes') inner += stripesOn(o, TS, [1.4, 2.6, 3.8], st.tail[1] * 0.5, st.tail[1] * 0.1);
    if (o.pattern === 'spots') { f = tg.frame(0.32); inner += spots(o, [[f.p[0], f.p[1] - f.w * 0.12, f.w * 0.2]]); f = tg.frame(0.6); inner += spots(o, [[f.p[0], f.p[1] - f.w * 0.1, f.w * 0.2]]); }
    s += shape(o, dOf(TS, true), c.body, c.shade, inner, { off: [sw * 0.4, -st.tail[1] * 0.2] }) + '</g>';

    /* -- patte et bras du fond -- */
    s += leg(o, bx + wb * 0.27, st.leg * 0.9, true);
    s += '<g class="mt-up" style="transform-origin:' + n(bx) + 'px ' + st.by1 + 'px">';
    var armA = { happy: -38, love: -30, surprised: -48, eat: -42, sad: 72, sick: 66, sleep: 70, angry: 8 }[mood];
    if (armA == null) armA = grog ? 58 : 38;
    var ay = st.by0 + h * (stage === 1 ? 0.56 : 0.4);
    s += arm(o, bx + wt * 0.5 + st.ln, ay - h * 0.03, st.arm[0], st.arm[1] * 0.92, armA - 22, true);

    /* -- plaques du dos -- */
    us = bp.length === 3 ? [7.3, 6.9, 6.5] : [7.15, 6.65];
    s += platesOn(o, BS, us, bp, skin.plate, nHead, titan, grog);

    /* -- corps : motif, ventre clair segmenté, ombre portée de la tête -- */
    inner = '';
    if (o.pattern === 'stripes') inner += stripesOn(o, BS, [6.25, 6.7, 7.15, 7.6], wb * 0.3, wb * 0.05);
    if (o.pattern === 'spots') inner += spots(o, [[bx - wb * 0.3, st.by0 + h * 0.4, wb * 0.09], [bx - wb * 0.38, st.by0 + h * 0.66, wb * 0.07], [bx - wb * 0.17, st.by0 + h * 0.58, wb * 0.05]]);
    var belly = blob([[bx + st.ln + wt * 0.02, st.by0 - 12], [bx + wb * 0.8, st.by0 + h * 0.3], [bx + wb * 0.8, st.by1 + 12], [bx + wb * 0.04, st.by1 + 12], [bx - wb * 0.07, st.by0 + h * 0.74], [bx + st.ln * 0.5, st.by0 + h * 0.36]]),
      lines = '';
    if (stage >= 2) for (i = 0; i < (stage >= 3 ? 3 : 2); i++) {
      f = st.by0 + h * (0.5 + i * 0.15);
      lines += stroke('M' + P([bx - wb * 0.2, f - 4]) + 'Q' + P([bx + wb * 0.22, f + h * 0.07]) + ' ' + P([bx + wb * 0.62, f - h * 0.03]), c.bellyShade, Math.max(2.6, sw * 0.62));
    }
    inner += shape(o, belly, c.belly, c.bellyShade, lines, { noLine: true, off: [sw * 1.1, -sw * 0.5] });
    inner += '<ellipse cx="' + n(st.hx - st.R * 0.02) + '" cy="' + n(st.hy + st.R * 0.9) + '" rx="' + n(st.R * 1.0) + '" ry="' + n(st.R * 0.4) + '" fill="' + c.out + '" opacity=".2"/>';
    s += shape(o, dOf(BS, true), c.body, c.shade, inner, { off: [wb * 0.075, -wb * 0.04] });

    /* -- tête -- */
    s += head(o, st, skin, stage, form, mood);

    /* -- bras proche -- */
    s += arm(o, bx - wt * 0.1 + st.ln * 0.6, ay, st.arm[0] * 1.3, st.arm[1], armA, false);
    s += '</g>';

    /* -- patte proche -- */
    s += leg(o, bx - wb * 0.13, st.leg, false);

    return { svg: s, shadow: [bx - st.tail[0] * 0.22, wb * 0.62 + st.tail[0] * 0.34] };
  }

  /* ───────────── l'œuf (stade 0) ───────────── */
  function egg(o, skin, crack) {
    var c = o.c, sh = o.shell, pts = [[200, 210], [233, 231], [254, 282], [246, 331], [200, 358], [154, 331], [146, 282], [167, 231]], S = segs(pts, true),
      seed = seedOf(skin.id), inner = '', i, s, list = [[168, 262, 14], [229, 252, 9], [236, 306, 15], [187, 322, 11], [159, 306, 7], [206, 286, 7], [203, 232, 6]],
      cols = [c.body, o.plate0, c.body, c.shade, o.plate0, c.body, c.shade], q, zig = '', x;
    for (i = 0; i < list.length; i++) {
      q = (seed * (i + 3)) % 17;
      inner += '<ellipse cx="' + (list[i][0] + q % 5 - 2) + '" cy="' + (list[i][1] + q % 7 - 3) + '" rx="' + list[i][2] + '" ry="' + n(list[i][2] * 0.82) + '" fill="' + cols[i] + '" transform="rotate(' + (q * 11 - 60) + ' ' + list[i][0] + ' ' + list[i][1] + ')"/>';
    }
    inner += stroke(rim(S, 0.35, 1.9, 10), '#fff', 5, ' opacity=".9"') + '<circle cx="246" cy="300" r="2.8" fill="#fff" opacity=".9"/>';
    if (crack >= 3) {
      for (x = 140, i = 0; x <= 262; x += 12.2, i++) zig += (i ? 'L' : 'M') + n(x) + ' ' + (i % 2 ? 262 : 280);
      inner += stroke(zig, c.out, 3.4);
    }
    s = shape(o, dOf(S, true), sh[0], sh[1], inner, { off: [9, -7] });
    if (crack === 1) s += stroke('M217 219l-9 12l13 7l-8 12', c.out, 3.2);
    if (crack === 2) s += stroke('M217 219l-9 12l13 7l-8 12l12 9l-9 13M213 250l-14 6l-6 -11', c.out, 3.4);
    if (crack >= 3) {
      s += '<path d="M178 252l12 -14l11 11l12 -15l13 13l12 2l-6 14l8 12l-14 2l-10 12l-12 -10l-13 8l-4 -13l-13 -6Z" fill="' + mix(c.out, '#000000', 0.25) + '" stroke="' + c.out + '" stroke-width="3.4"/>' +
        '<g class="mt-blink"><ellipse cx="196" cy="259" rx="6.5" ry="8" fill="#fff"/><ellipse cx="218" cy="258" rx="6" ry="7.6" fill="#fff"/><circle cx="197.5" cy="260" r="3.6" fill="' + c.out + '"/><circle cx="219.3" cy="259" r="3.4" fill="' + c.out + '"/></g>';
    }
    return { svg: '<g class="mt-egg mt-egg' + crack + '" style="transform-origin:200px 358px">' + s + '</g>', shadow: [200, 58] };
  }

  /* ───────────── le petit fantôme-ange ───────────── */
  function ghost(o, skin, stage) {
    var c = o.c, R = 58, gx = 204, gy = 196, k = [0.6, 0.62, 0.74, 0.87, 1][stage],
      H = function (x, y) { return [gx + x * R, gy + y * R]; },
      line = mix(c.out, '#ffffff', 0.32), tint = mix('#ffffff', c.body, 0.26), glow = mix('#ffffff', c.plateGlow, 0.6),
      pts = [[-0.15, -1], [0.5, -0.9], [0.9, -0.52], [1.02, -0.16], [1.26, 0.06], [1.38, 0.4], [1.2, 0.76], [0.74, 1.0], [0.62, 1.5], [0.36, 2.0], [-0.2, 2.34], [-0.86, 2.46], [-1.2, 2.3], [-0.8, 2.08], [-0.72, 1.6], [-0.92, 0.9], [-1.02, 0.1], [-0.86, -0.6]].map(function (p) { return H(p[0], p[1]); }),
      S = segs(pts, true), s = '', q, i, us = [17.75, 17.05, 16.3], hs = [20, 26, 22], E1 = H(0.2, -0.1), E2 = H(0.78, -0.16),
      wing = [[-0.7, 0.7], [-1.25, 0.3], [-1.8, 0.42], [-1.6, 0.8], [-1.78, 1.02], [-1.42, 1.2], [-1.5, 1.42], [-1.0, 1.42], [-0.66, 1.2]].map(function (p) { return H(p[0], p[1]); });
    o.c = { out: line, plate: mix(o.plate0, '#ffffff', 0.5), plateGlow: glow, body: '#ffffff', shade: tint, light: '#ffffff' };
    o.sw = 5.5;
    plateDefs(o, skin.plate, false);
    s += shape(o, blob(wing), '#ffffff', tint, stroke('M' + P(H(-1.5, 0.62)) + 'Q' + P(H(-1.1, 0.7)) + ' ' + P(H(-0.85, 0.95)) + 'M' + P(H(-1.36, 1.0)) + 'Q' + P(H(-1.05, 1.0)) + ' ' + P(H(-0.85, 1.15)), tint, 3.5), { off: [5, -5] });
    for (i = 0; i < us.length; i++) { q = at(S, us[i]); s += plate(o, skin.plate, q.x - q.ty * 3, q.y + q.tx * 3, Math.atan2(q.ty, q.tx) * 180 / Math.PI, hs[i], 0, false, false); }
    s += shape(o, dOf(S, true), '#ffffff', tint,
      '<ellipse cx="' + n(H(-0.08, 0.44)[0]) + '" cy="' + n(H(-0.08, 0.44)[1]) + '" rx="11" ry="7" fill="' + c.cheek + '" opacity=".55"/>', { off: [9, -8] });
    s += shape(o, blob(capsule(H(0.3, 1.18)[0], H(0.3, 1.18)[1], 9, H(0.66, 1.4)[0], H(0.66, 1.4)[1], 8.5)), '#ffffff', tint, '', { off: [3, -3] });
    s += stroke('M' + P([E1[0] - 14, E1[1] - 1]) + 'Q' + P([E1[0], E1[1] + 13]) + ' ' + P([E1[0] + 14, E1[1] - 1]) + 'M' + P([E2[0] - 10, E2[1] - 1]) + 'Q' + P([E2[0], E2[1] + 12]) + ' ' + P([E2[0] + 10, E2[1] - 1]), line, 5) +
      stroke('M' + P(H(0.72, 0.54)) + 'Q' + P(H(0.94, 0.72)) + ' ' + P(H(1.18, 0.5)), line, 4.2);
    /* auréole */
    q = H(-0.1, -1.36);
    s = '<g class="mt-ghost"><g opacity=".9" transform="translate(200 ' + (GROUND - 14) + ') scale(' + k + ') translate(-200 ' + (-(GROUND - 14)) + ')">' + s +
      '<g class="mt-aura" transform="rotate(-8 ' + P(q) + ')"><ellipse cx="' + n(q[0]) + '" cy="' + n(q[1]) + '" rx="34" ry="10" fill="none" stroke="' + line + '" stroke-width="11"/>' +
      '<ellipse cx="' + n(q[0]) + '" cy="' + n(q[1]) + '" rx="34" ry="10" fill="none" stroke="#ffd84d" stroke-width="6"/><path d="M' + P([q[0] - 22, q[1] - 7.5]) + 'q10 -4 22 -3" fill="none" stroke="#fff6b8" stroke-width="2.4"/></g></g></g>';
    o.c = c;
    return { svg: s, shadow: [200, 46 * k], faint: true };
  }

  /* ───────────── point d'entrée ───────────── */
  function monster(skin, opts) {
    opts = opts || {};
    skin = skin && skin.c ? skin : (MT.SKINS && MT.SKINS[0]);
    var stage = Math.max(0, Math.min(4, Math.round(Number(opts.stage) || 0))),
      mood = MOODS.indexOf(opts.mood) >= 0 ? opts.mood : 'neutral',
      form = stage === 4 ? (opts.form === 'grognon' ? 'grognon' : 'titan') : '',
      crack = Math.max(0, Math.min(3, Math.round(Number(opts.crack) || 0))),
      dead = opts.dead === true,
      uid = String(opts.uid == null || opts.uid === '' ? 'mt' + skin.id + stage + form + mood + (dead ? 'x' : '') + crack : opts.uid).replace(/[^\w-]/g, '_') + '_',
      c = {}, key, o, r, plate0 = skin.c.plate instanceof Array ? skin.c.plate[0] : skin.c.plate;
    for (key in skin.c) c[key] = skin.c[key];
    if (mood === 'sick' && !dead && stage > 0) {
      c.body = mix(c.body, '#cfe3b4', 0.55); c.shade = mix(c.shade, '#93b384', 0.55); c.light = mix(c.light, '#eef6da', 0.55);
      c.belly = mix(c.belly, '#eef3d6', 0.45); c.bellyShade = mix(c.bellyShade, '#c3d6a4', 0.45); c.cheek = '#8fcf7a';
    }
    o = { u: uid, k: 0, defs: '', c: c, sw: 5, pattern: skin.pattern, plate0: plate0,
      iris: mix((skin.ui && skin.ui.accent2) || plate0, '#ffffff', 0.12),
      shell: [mix(c.belly, '#ffffff', 0.5), mix(mix(c.bellyShade, '#ffffff', 0.25), c.body, 0.12), c.body, plate0] };
    if (dead) r = ghost(o, skin, stage);
    else if (stage === 0) r = egg(o, skin, crack);
    else { o.sw = STAGES[stage === 4 ? form : stage].sw; r = creature(o, skin, stage, form, mood); }
    return '<svg class="mt-mon mt-s' + stage + (form ? ' mt-f-' + form : '') + ' mt-m-' + mood + (dead ? ' mt-dead' : '') + '" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' + o.defs + '</defs>' +
      '<ellipse class="mt-shadow" cx="' + n(r.shadow[0]) + '" cy="' + (GROUND + 1) + '" rx="' + n(r.shadow[1]) + '" ry="' + n(Math.min(11, 5 + r.shadow[1] * 0.05)) + '" fill="' + skin.c.out + '" opacity="' + (r.faint ? '.12' : '.24') + '"/>' +
      '<g class="mt-all" style="transform-origin:200px ' + GROUND + 'px" stroke-linejoin="round" stroke-linecap="round">' + r.svg + '</g></svg>';
  }

  /* ───────────── animations ───────────── */
  var css = [
    '.mt-mon{overflow:visible;display:block}',
    /* pivots : les grands groupes (mt-all, mt-up, mt-tail, mt-head, mt-egg) portent un transform-origin en unités du viewBox
       dans leur attribut style ; les petits éléments tournent/s'écrasent autour de leur propre boîte (fill-box). */
    '.mt-mon .mt-shadow,.mt-mon .mt-blink,.mt-mon .mt-fx,.mt-mon .mt-mouth-open{transform-box:fill-box}',
    '.mt-mon .mt-shadow,.mt-mon .mt-fx{transform-origin:50% 50%}',
    '.mt-mon .mt-blink{transform-origin:50% 58%}',
    '.mt-mon .mt-mouth-open{transform-origin:50% 8%}',
    /* repos */
    '.mt-mon .mt-up{animation:mt-breathe 3.4s ease-in-out infinite}',
    '.mt-mon .mt-head{animation:mt-nodidle 6.8s ease-in-out infinite}',
    '.mt-mon .mt-tail{animation:mt-tail 2.9s ease-in-out infinite}',
    '.mt-mon .mt-blink{animation:mt-blink 4.6s linear infinite}',
    '.mt-mon .mt-glow{animation:mt-glow 2.6s ease-in-out var(--d,0s) infinite}',
    '.mt-mon .mt-halo{animation:mt-halo 2.6s ease-in-out var(--d,0s) infinite}',
    '.mt-mon .mt-egg{animation:mt-egg 3.2s ease-in-out infinite}',
    '.mt-mon .mt-egg2,.mt-mon .mt-egg3{animation:mt-egg-shake 2.4s ease-in-out infinite}',
    '.mt-mon .mt-ghost{animation:mt-float 3.6s ease-in-out infinite}',
    '.mt-mon .mt-aura{animation:mt-halo 2.8s ease-in-out infinite}',
    '.mt-mon.mt-dead .mt-shadow{animation:mt-shadow-float 3.6s ease-in-out infinite}',
    '.mt-mon.mt-m-sleep .mt-up{animation:mt-breathe-sleep 5.6s ease-in-out infinite}',
    '.mt-mon.mt-m-sleep .mt-head{animation:none}',
    '.mt-mon.mt-m-sleep .mt-tail{animation-duration:6s}',
    '.mt-mon .mt-fx-tear{animation:mt-tear 2.2s ease-in infinite}',
    '.mt-mon .mt-fx-heart{animation:mt-rise 2.4s ease-in-out infinite}',
    '.mt-mon .mt-fx-heart2{animation:mt-rise 2.4s ease-in-out -1.1s infinite}',
    '.mt-mon .mt-fx-pop{animation:mt-pop 1.1s ease-in-out infinite}',
    '.mt-mon .mt-fx-z{animation:mt-zz 3s ease-in-out infinite}',
    '.mt-mon .mt-fx-z2{animation:mt-zz 3s ease-in-out -1.5s infinite}',
    '.mt-mon .mt-fx-bub{transform-origin:0% 60%;animation:mt-bub 5.6s ease-in-out infinite}',
    '@keyframes mt-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.014,.978)}}',
    '@keyframes mt-breathe-sleep{0%,100%{transform:scale(1,1)}50%{transform:scale(1.028,.955)}}',
    '@keyframes mt-nodidle{0%,100%{transform:rotate(-1.4deg)}50%{transform:rotate(1.6deg)}}',
    '@keyframes mt-tail{0%,100%{transform:rotate(0deg)}50%{transform:rotate(5deg)}}',
    '@keyframes mt-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}',
    '@keyframes mt-glow{0%,100%{opacity:.08}50%{opacity:.75}}',
    '@keyframes mt-halo{0%,100%{opacity:.3}50%{opacity:.8}}',
    '@keyframes mt-egg{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}',
    '@keyframes mt-egg-shake{0%,58%,100%{transform:rotate(0)}64%{transform:rotate(-5deg)}72%{transform:rotate(5deg)}80%{transform:rotate(-4deg)}88%{transform:rotate(3deg)}}',
    '@keyframes mt-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}',
    '@keyframes mt-shadow-float{0%,100%{transform:scale(1)}50%{transform:scale(.82)}}',
    '@keyframes mt-tear{0%{transform:translateY(-4px) scale(.5);opacity:0}25%{transform:translateY(0) scale(1);opacity:1}70%{transform:translateY(6px);opacity:1}100%{transform:translateY(22px);opacity:0}}',
    '@keyframes mt-rise{0%{transform:translateY(10px) scale(.6);opacity:0}30%{opacity:1}70%{opacity:1}100%{transform:translateY(-16px) scale(1.1);opacity:0}}',
    '@keyframes mt-pop{0%,100%{transform:scale(.85)}50%{transform:scale(1.15)}}',
    '@keyframes mt-zz{0%{transform:translate(-6px,8px) scale(.6);opacity:0}30%{opacity:1}75%{opacity:1}100%{transform:translate(8px,-12px) scale(1.1);opacity:0}}',
    '@keyframes mt-bub{0%,100%{transform:scale(.35)}50%{transform:scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.mt-mon .mt-up,.mt-mon .mt-head,.mt-mon .mt-tail,.mt-mon .mt-blink,.mt-mon .mt-glow,.mt-mon .mt-halo,.mt-mon .mt-egg,.mt-mon .mt-ghost,.mt-mon .mt-aura,.mt-mon .mt-shadow,.mt-mon .mt-fx{animation:none!important}}',
    /* actions (classe posée ~1 s sur le parent du <svg>) */
    '.mt-act-jump .mt-mon .mt-all{animation:mt-jump .95s cubic-bezier(.3,.7,.4,1) 1}',
    '.mt-act-jump .mt-mon .mt-shadow{animation:mt-jump-shadow .95s ease-in-out 1}',
    '.mt-act-hop .mt-mon .mt-all{animation:mt-hop .95s ease-in-out 1}',
    '.mt-act-hop .mt-mon .mt-shadow{animation:mt-hop-shadow .95s ease-in-out 1}',
    '.mt-act-wiggle .mt-mon .mt-all{animation:mt-wiggle .95s ease-in-out 1}',
    '.mt-act-wiggle .mt-mon .mt-tail{animation:mt-wag .24s ease-in-out 4}',
    '.mt-act-no .mt-mon .mt-headA{animation:mt-no .95s ease-in-out 1}',
    '.mt-act-chomp .mt-mon .mt-headA{animation:mt-chomp-head .95s ease-in-out 1}',
    '.mt-act-chomp .mt-mon .mt-mouth{opacity:0}',
    '.mt-act-chomp .mt-mon .mt-mouth-open{opacity:1;animation:mt-chomp .95s ease-in-out 1 both}',
    '@keyframes mt-jump{0%,100%{transform:translateY(0) scale(1,1)}14%{transform:translateY(0) scale(1.09,.86)}38%{transform:translateY(-58px) scale(.95,1.07)}52%{transform:translateY(-66px) scale(1,1)}74%{transform:translateY(0) scale(1.08,.88)}87%{transform:translateY(0) scale(.98,1.03)}}',
    '@keyframes mt-jump-shadow{0%,14%,74%,100%{transform:scale(1);opacity:.24}45%,55%{transform:scale(.62);opacity:.12}}',
    '@keyframes mt-hop{0%,100%{transform:translateY(0) rotate(0) scale(1,1)}10%{transform:scale(1.04,.94)}26%{transform:translateY(-20px) rotate(-3.5deg)}44%{transform:translateY(0) scale(1.05,.93)}56%{transform:translateY(0) scale(1.03,.96)}72%{transform:translateY(-16px) rotate(3.5deg)}90%{transform:translateY(0) scale(1.04,.95)}}',
    '@keyframes mt-hop-shadow{0%,10%,44%,56%,90%,100%{transform:scale(1)}26%,72%{transform:scale(.85)}}',
    '@keyframes mt-wiggle{0%,100%{transform:rotate(0) scale(1,1)}12%{transform:rotate(-6deg) scale(1.03,.97)}30%{transform:rotate(6deg) scale(.98,1.02)}48%{transform:rotate(-5deg) scale(1.03,.97)}66%{transform:rotate(5deg) scale(.98,1.02)}84%{transform:rotate(-2.5deg)}}',
    '@keyframes mt-wag{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(11deg)}}',
    '@keyframes mt-no{0%,100%{transform:translateX(0) rotate(0)}14%{transform:translateX(-9px) rotate(-7deg)}32%{transform:translateX(9px) rotate(7deg)}50%{transform:translateX(-9px) rotate(-7deg)}68%{transform:translateX(8px) rotate(6deg)}86%{transform:translateX(-4px) rotate(-3deg)}}',
    '@keyframes mt-chomp{0%,33%,66%,100%{transform:scale(.94,.12)}16%,50%,83%{transform:scale(1,1)}}',
    '@keyframes mt-chomp-head{0%,33%,66%,100%{transform:translateY(0) rotate(0)}16%,50%,83%{transform:translateY(-3px) rotate(-2.5deg)}}'
  ].join('\n');

  MT.arts.b = { name: 'Cartoon premium à contour', css: css, monster: monster };
})();
