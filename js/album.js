/* Mini-Titan — album et succès.
   L'album est une mémoire à part de la partie : il survit à la mort du monstre et aux nouveaux œufs
   (seul « Recommencer à zéro » l'efface). Il retient :
     - la collection : pour chaque look, les stades atteints (œuf, bébé, enfant, ado, Titan, Grognon) ;
     - les plats goûtés, les records, la série de jours de visite ;
     - les succès débloqués, annoncés par un bandeau.
   Un stade n'entre dans la collection que s'il est atteint en portant ce look : changer de look après coup ne débloque rien.
   MT.album = { data(), ACH, render(el), count() } — tout le reste écoute MT.core. */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {}, core = MT.core;
  var KEY = 'mini-titan-album-v1', AL = null, uidN = 0;
  var SLOTS = [['oeuf', 'Œuf'], ['bebe', 'Bébé'], ['enfant', 'Enfant'], ['ado', 'Ado'], ['titan', 'Titan'], ['grognon', 'Grognon']];
  var STAGE_SLOT = ['oeuf', 'bebe', 'enfant', 'ado'];

  function fresh() {
    return { v: 1, seen: {}, foods: {}, n: { meals: 0, snacks: 0, games: 0, wins: 0, washes: 0, cures: 0, pets: 0, roars: 0, poops: 0, eggs: 0, lost: 0 },
      best: { cote: 0, festin: 0, memo: 0 }, won: {}, days: { last: -1, streak: 0, max: 0 }, maxAge: 0, perfect: 0, ach: {} };
  }
  function load() {
    var d = fresh(), a = null;
    if (!core.isDemo()) { try { a = JSON.parse(localStorage.getItem(KEY)); } catch (e) { a = null; } }
    if (a && a.v === 1) { for (var k in d) if (a[k] != null) d[k] = a[k]; for (var x in fresh().n) if (typeof d.n[x] !== 'number') d.n[x] = 0; for (var b in fresh().best) if (typeof d.best[b] !== 'number') d.best[b] = 0; }
    else d.isNew = true;
    AL = d;
  }
  function save() { if (core.isDemo()) return; try { var o = {}; for (var k in AL) if (k !== 'isNew') o[k] = AL[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  /* ---------- lectures ---------- */
  var skins = function () { return MT.SKINS; };
  function has(skinId, slot) { return !!(AL.seen[skinId] && AL.seen[skinId][slot]); }
  function countSlot(slot) { return skins().filter(function (s) { return has(s.id, slot); }).length; }
  function adults() { return skins().filter(function (s) { return has(s.id, 'titan') || has(s.id, 'grognon'); }).length; }
  function seenTotal() { var n = 0; skins().forEach(function (s) { SLOTS.forEach(function (x) { if (has(s.id, x[0])) n++; }); }); return n; }
  function tasted() { return core.FOODS.filter(function (f) { return AL.foods[f.id]; }).length; }
  function wonAll() { return (MT.games && MT.games.list || []).every(function (g) { return AL.won[g.id]; }); }

  /* ---------- les succès : [id, titre, comment l'obtenir, condition] ---------- */
  var ACH = [
    ['eclo', 'Première éclosion', 'Faire éclore un œuf', function () { return countSlot('bebe') >= 1; }],
    ['enfant', 'Ça pousse !', 'Atteindre le stade enfant', function () { return countSlot('enfant') >= 1; }],
    ['ado', 'L\'âge ingrat', 'Atteindre le stade ado', function () { return countSlot('ado') >= 1; }],
    ['adulte', 'Grand monstre', 'Atteindre l\'âge adulte', function () { return adults() >= 1; }],
    ['titan', 'Premier Titan', 'Élever un monstre jusqu\'à la forme Titan', function () { return countSlot('titan') >= 1; }],
    ['grognon', 'Sale caractère', 'Découvrir la forme Grognon', function () { return countSlot('grognon') >= 1; }],
    ['parfait', 'Soins parfaits', 'Devenir adulte sans aucune erreur de soin', function () { return AL.perfect >= 1; }],
    ['oeufs3', 'Couveuse', 'Faire éclore 3 looks différents', function () { return countSlot('bebe') >= 3; }],
    ['trio', 'Trio de choc', 'Élever 3 looks différents jusqu\'à l\'âge adulte', function () { return adults() >= 3; }],
    ['tous', 'Toute la ménagerie', 'Élever tous les looks jusqu\'à l\'âge adulte', function () { return adults() >= skins().length; }],
    ['braise', 'Jouer avec le feu', 'Faire éclore l\'œuf Ombre-Braise', function () { return has('braise', 'bebe'); }],
    ['collec', 'Collectionneur', 'Remplir 20 cases de la collection', function () { return seenTotal() >= 20; }],
    ['gourmet', 'Fin gourmet', 'Goûter tous les plats et toutes les friandises', function () { return tasted() >= core.FOODS.length; }],
    ['repas50', 'Bon appétit', 'Servir 50 repas', function () { return AL.n.meals >= 50; }],
    ['jeu1', 'Première victoire', 'Gagner un mini-jeu', function () { return AL.n.wins >= 1; }],
    ['jeux3', 'Touche-à-tout', 'Gagner au moins une fois à chaque mini-jeu', wonAll],
    ['jeu25', 'Champion', 'Gagner 25 parties', function () { return AL.n.wins >= 25; }],
    ['cote5', 'Devin', 'Faire 5 sur 5 à « Gauche ou droite ? »', function () { return AL.best.cote >= 5; }],
    ['festin20', 'Ventre sans fond', 'Marquer 20 points au Festin tombé du ciel', function () { return AL.best.festin >= 20; }],
    ['memo8', 'Mémoire d\'éléphant', 'Atteindre une suite de 8 au Rugi-mémo', function () { return AL.best.memo >= 8; }],
    ['bain10', 'Propre comme un sou neuf', 'Donner 10 bains complets', function () { return AL.n.washes >= 10; }],
    ['crotte25', 'Service de nettoyage', 'Ramasser 25 crottes', function () { return AL.n.poops >= 25; }],
    ['soin3', 'Bon docteur', 'Guérir 3 maladies', function () { return AL.n.cures >= 3; }],
    ['calin100', 'Gros câlins', 'Faire 100 caresses', function () { return AL.n.pets >= 100; }],
    ['rugir50', 'Voix de stentor', 'Le faire rugir 50 fois', function () { return AL.n.roars >= 50; }],
    ['j3', 'Trois jours de suite', 'Lui rendre visite 3 jours de suite', function () { return AL.days.max >= 3; }],
    ['j7', 'Sept jours de suite', 'Lui rendre visite 7 jours de suite', function () { return AL.days.max >= 7; }],
    ['age7', 'Une semaine ensemble', 'Garder un monstre en vie 7 jours', function () { return AL.maxAge >= 7 * 1440; }]
  ];

  /* ---------- bandeau de succès (trois secondes, l'un après l'autre) ---------- */
  var queue = [], busy = false, banner = null;
  function nextBanner() {
    if (busy || !queue.length) return;
    if (!banner) { banner = document.createElement('div'); banner.className = 'ach-banner'; banner.setAttribute('role', 'status'); (document.getElementById('app') || document.body).appendChild(banner); }
    busy = true; var a = queue.shift();
    banner.innerHTML = '<span class="ach-ic">' + (MT.props ? MT.props.svg('etoile', 'ab' + (++uidN) + '-') : '') + '</span><span class="ach-tx"><b>Succès débloqué</b><span>' + esc(a[1]) + '</span></span>';
    banner.classList.add('show');
    try { if (MT.sfx) MT.sfx.play('coin'); } catch (e) {}
    setTimeout(function () { banner.classList.remove('show'); setTimeout(function () { busy = false; nextBanner(); }, 450); }, 3000);
  }
  function check(quiet) {
    var n = 0;
    ACH.forEach(function (a) { if (!AL.ach[a[0]] && a[3]()) { AL.ach[a[0]] = Date.now(); if (!quiet) queue.push(a); n++; } });
    if (n) { save(); nextBanner(); }
    return n;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- ce qui remplit l'album ---------- */
  function mark(slot) {
    var S = core.S, id = MT.SKINS[S.skin].id;
    AL.seen[id] = AL.seen[id] || {};
    if (!AL.seen[id][slot]) { AL.seen[id][slot] = Date.now(); return true; }
    return false;
  }
  function slotNow() { var S = core.S; return S.stage < 4 ? STAGE_SLOT[S.stage] : (S.form === 'grognon' ? 'grognon' : 'titan'); }
  function day() {
    var d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5), D = AL.days;
    if (D.last === d) return false;
    D.streak = D.last === d - 1 ? D.streak + 1 : 1; D.last = d; D.max = Math.max(D.max, D.streak);
    return true;
  }
  function sync() {
    var S = core.S, ch = false;
    if (!S.chosen) return;
    ch = day();
    if (!S.dead) { if (mark(slotNow())) ch = true; if (S.age > AL.maxAge) { AL.maxAge = S.age; ch = S.age % 60 === 0 || ch; } }
    if (ch) save();
    check();
  }
  function bind() {
    core.on('hatch', function () { AL.n.eggs++; mark('bebe'); save(); check(); });
    core.on('evolve', function (d) { mark(slotNow()); if (d.to === 4 && core.S.mistakes === 0) AL.perfect++; save(); check(); });
    core.on('fed', function (d) { var f = d.food; AL.foods[f.id] = (AL.foods[f.id] || 0) + 1; if (f.type === 'repas') AL.n.meals++; else AL.n.snacks++; save(); check(); });
    core.on('played', function (r) {
      AL.n.games++; if (r.win) { AL.n.wins++; if (r.id) AL.won[r.id] = (AL.won[r.id] || 0) + 1; }
      if (r.id && AL.best[r.id] != null && (r.score || 0) > AL.best[r.id]) AL.best[r.id] = r.score || 0;
      save(); check();
    });
    core.on('washed', function () { AL.n.washes++; save(); check(); });
    core.on('cured', function () { AL.n.cures++; save(); check(); });
    core.on('cleaned', function () { AL.n.poops++; save(); check(); });
    core.on('pet', function () { AL.n.pets++; if (AL.n.pets % 5 === 0) save(); check(); });
    core.on('roar', function () { AL.n.roars++; if (AL.n.roars % 5 === 0) save(); check(); });
    core.on('die', function () { AL.n.lost++; save(); });
    core.on('wiped', function () { AL = fresh(); try { localStorage.removeItem(KEY); } catch (e) {} });
    core.on('change', sync);
  }

  /* ---------- écran Album ---------- */
  function fmtD(t) { try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function fmtAge(min) { var d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60); return d ? d + ' j ' + h + ' h' : h ? h + ' h' : min + ' min'; }
  function monSvg(sk, slot) {
    var st = slot === 'titan' || slot === 'grognon' ? 4 : STAGE_SLOT.indexOf(slot);
    return MT.art.monster(sk, { stage: st, form: st === 4 ? slot : '', mood: slot === 'grognon' ? 'neutral' : 'happy', uid: 'al' + (++uidN) + '-' });
  }
  var BOX = { oeuf: 2.6, bebe: 2.2, enfant: 1.7, ado: 1.35, titan: 1.12, grognon: 1.25 };   // les petits sont agrandis dans leur case
  function render(el) {
    sync();
    var nAch = Object.keys(AL.ach).length, nSeen = seenTotal(), total = skins().length * SLOTS.length, keep = el.scrollTop;
    var rows = skins().map(function (sk) {
      var any = !!AL.seen[sk.id];
      return '<div class="alrow"><div class="rn">' + (any ? esc(sk.name) : '???') + '</div><div class="alf">' + SLOTS.map(function (x) {
        var got = has(sk.id, x[0]), k = BOX[x[0]];
        return '<div class="alc' + (got ? '' : ' lock') + '" style="background:linear-gradient(' + sk.ui.bgTop + ',' + sk.ui.bgBot + ')">' +
          '<div class="alm" style="width:' + (k * 100) + '%;left:' + ((1 - k) * 50) + '%;top:' + (80 - k * 75) + '%">' + monSvg(sk, x[0]) + '</div>' +
          '<span class="aln">' + (got ? x[1] : '?') + '</span></div>';
      }).join('') + '</div></div>';
    }).join('');
    var foods = core.FOODS.map(function (f) {
      var n = AL.foods[f.id];
      return '<div class="alp' + (n ? '' : ' lock') + '"><span class="pic">' + (MT.props ? MT.props.svg(f.id, 'al' + (++uidN) + '-') : '') + '</span><b>' + (n ? esc(f.name) : '???') + '</b><small>' + (n ? '×' + n : 'à goûter') + '</small></div>';
    }).join('');
    var rec = [['Série de visites', AL.days.streak + ' j'], ['Record de série', AL.days.max + ' j'], ['Plus longue vie', fmtAge(AL.maxAge)], ['Œufs éclos', AL.n.eggs],
      ['Gauche ou droite ?', AL.best.cote + ' / 5'], ['Festin', AL.best.festin + ' pts'], ['Rugi-mémo', 'suite de ' + AL.best.memo], ['Victoires', AL.n.wins],
      ['Caresses', AL.n.pets], ['Rugissements', AL.n.roars], ['Crottes ramassées', AL.n.poops], ['Compagnons envolés', AL.n.lost]]
      .map(function (r) { return '<div class="stat"><b>' + r[1] + '</b><span>' + r[0] + '</span></div>'; }).join('');
    var ach = ACH.map(function (a) {
      var t = AL.ach[a[0]];
      return '<div class="ach' + (t ? ' ok' : '') + '"><span class="ach-ic">' + (MT.props ? MT.props.svg('etoile', 'al' + (++uidN) + '-') : '') + '</span><span class="ach-tx"><b>' + (t ? esc(a[1]) : '???') + '</b><span>' + esc(a[2]) + '</span><small>' + (t ? 'Obtenu le ' + fmtD(t) : 'À débloquer') + '</small></span></div>';
    }).join('');
    el.innerHTML = '<h1 class="vt">Album</h1><p class="lead">Tout ce que tu as découvert reste ici, même quand un monstre s\'envole.</p>' +
      '<div class="pchips"><span class="chip big">' + nAch + ' / ' + ACH.length + ' succès</span><span class="chip big">' + nSeen + ' / ' + total + ' cases</span><span class="chip big">' + tasted() + ' / ' + core.FOODS.length + ' plats</span></div>' +
      '<div class="card"><h3>Collection <span class="cnt">' + nSeen + ' / ' + total + '</span></h3><p class="cap" style="margin:-4px 0 12px">Un stade se débloque quand ton monstre l\'atteint en portant ce look.</p>' + rows + '</div>' +
      '<div class="card"><h3>Succès <span class="cnt">' + nAch + ' / ' + ACH.length + '</span></h3><div class="achs">' + ach + '</div></div>' +
      '<div class="card"><h3>Plats goûtés <span class="cnt">' + tasted() + ' / ' + core.FOODS.length + '</span></h3><div class="alps">' + foods + '</div></div>' +
      '<div class="card"><h3>Records</h3><div class="stats">' + rec + '</div></div>';
    el.scrollTop = keep;
  }

  MT.album = { ACH: ACH, data: function () { return AL; }, render: render, check: check,
    count: function () { return { ach: Object.keys(AL.ach).length, total: ACH.length }; },
    /* à appeler une fois la partie chargée (MT.core.load ou demo) */
    start: function () {
      load();
      var S = core.S;
      if (AL.isNew && S.chosen && !S.dead) {       // joueur d'avant l'album : on lui crédite le chemin déjà parcouru, sans rafale de bandeaux
        for (var i = 0; i <= Math.min(S.stage, 3); i++) mark(STAGE_SLOT[i]);
        if (S.stage === 4) mark(slotNow());
        AL.maxAge = S.age; day(); check(true); save();
      }
      bind(); sync();
    } };
})();
