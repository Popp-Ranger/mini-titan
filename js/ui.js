/* Mini-Titan — l'interface de l'appli (aucune règle du jeu ici : tout passe par MT.core).
   Sommaire : 1 outils · 2 icônes · 3 habillage (couleurs du look) · 4 accueil : scène, jauges, dock
              5 feuilles, écrans pleins, messages · 6 actions · 7 événements du jeu · 8 onglets
              9 première ouverture · 10 démarrage (dont le bouton Retour)
   Pour les essais : MT.ui.go('profil'), MT.ui.open('nourrir'), MT.ui.toast('…'), MT.ui.back() (= bouton Retour).
   Dans l'adresse : ?demo=…&ecran=… ; en plus, &ecran=resultat (écran de fin de partie) et, sur ?demo=accueil, &etape=1 ou 2. */
(function () {
  'use strict';
  var MT = window.MT = window.MT || {};
  var core = MT.core, S = null;

  /* ------------------------------------------------------------------ 1. outils */
  var $ = function (id) { return document.getElementById(id); };
  var uidN = 0;
  function uid() { return 'u' + (++uidN) + '-'; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  /* typographie française : espace insécable avant ? ! ; : et à l'intérieur des guillemets (texte seul, jamais du HTML) */
  function fr(s) { return String(s).replace(/ ([?!;])/g, '\u202f$1').replace(/ :/g, '\u00a0:').replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»'); }
  function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }   // valeur d'attribut, telle quelle
  function esc(s) { return attr(fr(s)); }                                                                                               // texte affiché
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sfx(n, o) { try { if (MT.sfx) MT.sfx.play(n, o); } catch (e) {} }
  function buzz(p) { try { if (MT.haptic && S && S.haptics) MT.haptic(p); } catch (e) {} }
  function prop(id) { return MT.props ? MT.props.svg(id, uid()) : ''; }
  function monster(o, skin) {
    o = o || {};
    return MT.art.monster(skin || core.skin(), {
      stage: o.stage == null ? S.stage : o.stage, form: o.form == null ? S.form : o.form,
      mood: o.mood || 'neutral', dead: !!o.dead, crack: o.crack || 0, uid: uid()
    });
  }
  function scene(skin, night) { return MT.scenes ? MT.scenes.render(skin || core.skin(), { night: !!night, uid: uid() }) : ''; }
  function later(fn, ms) { return setTimeout(fn, ms); }
  function fmtDur(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + ' min';
    if (min < 1440) { var h = Math.floor(min / 60), m = min % 60; return h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : ''); }
    var d = Math.floor(min / 1440), r = Math.floor((min % 1440) / 60); return d + ' j' + (r ? ' ' + r + ' h' : '');
  }
  function fmtDate(t) {
    try { return new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  /* n'écrit dans le DOM que si la valeur a changé */
  var memo = {};
  function put(key, val, fn) { if (memo[key] !== val) { memo[key] = val; fn(val); } }

  /* ------------------------------------------------------------------ 2. icônes au trait */
  var IC = {
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5h4v5"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.8-5.4 7.2-5.4s6.3 1.8 7.2 5.4"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.2-1-1.5-1-2.6 0-1 .8-1.6 1.9-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.8-7.5-8.5-7.5Z"/><circle class="f" cx="8" cy="10.5" r="1.2"/><circle class="f" cx="12" cy="7.8" r="1.2"/><circle class="f" cx="16" cy="10.2" r="1.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>',
    food: '<path d="M7 3v7a2.2 2.2 0 0 0 4.4 0V3M9.2 3v18"/><path d="M17 21v-7.5M17 13.5c-1.7 0-2.8-1.6-2.8-4.8S15.6 3 17 3v10.5Z"/>',
    play: '<rect x="2.8" y="7.5" width="18.4" height="10.5" rx="5.2"/><path d="M7.4 11v3.6M5.6 12.8h3.6"/><circle class="f" cx="15.2" cy="14" r="1.1"/><circle class="f" cx="18" cy="11.6" r="1.1"/>',
    wash: '<path d="M12 3.2c3.2 3.9 5.6 6.9 5.6 10.3a5.6 5.6 0 0 1-11.2 0c0-3.4 2.4-6.4 5.6-10.3Z"/><path d="M9.6 14.2c.2 1.3 1 2.2 2.3 2.5"/>',
    heal: '<rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><path d="m8.9 8.9 6.2 6.2"/>',
    light: '<path d="M8.4 15.2a6 6 0 1 1 7.2 0c-.6.5-.9 1.1-.9 1.8H9.3c0-.7-.3-1.3-.9-1.8Z"/><path d="M9.8 20.2h4.4"/>',
    scold: '<path d="M4 10v4h3l7 4.5v-13L7 10H4Z"/><path d="M17.4 9.2a4 4 0 0 1 0 5.6M19.8 6.8a7.4 7.4 0 0 1 0 10.4"/>',
    bell: '<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z"/><path d="M10 20.4a2.2 2.2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5 7 7M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/>',
    moon: '<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chev: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
    back: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10Z"/>',
    bolt: '<path d="M13 2.8 5.5 13.500H11l-1 7.700L18.500 10.500H13l0-7.700Z"/>',
    smile: '<circle cx="12" cy="12" r="8.6"/><path d="M8.300 13.800c1 1.500 2.200 2.200 3.700 2.200s2.700-.7 3.700-2.200"/><circle class="f" cx="9" cy="10" r="1.100"/><circle class="f" cx="15" cy="10" r="1.100"/>',
    scale: '<rect x="4" y="4" width="16" height="16" rx="4.500"/><path d="M8.500 9.500a5 5 0 0 1 7 0M12 9.500l1.400-2"/>',
    alert: '<path d="M12 4 2.800 19.500h18.400L12 4Z"/><path d="M12 10v4.500"/><circle class="f" cx="12" cy="17" r="1"/>',
    sound: '<path d="M4 10v4h3l5 4V6l-5 4H4Z"/><path d="M16 9a4.200 4.200 0 0 1 0 6M18.600 6.500a8 8 0 0 1 0 11"/>',
    vibrate: '<rect x="8" y="3.500" width="8" height="17" rx="2.200"/><path d="M4.500 9v6M19.500 9v6M2 10.500v3M22 10.500v3"/>',
    speed: '<path d="M4.500 16a8 8 0 1 1 15 0"/><path d="m12 13.500 3.500-4.500"/><circle class="f" cx="12" cy="14" r="1.300"/>',
    install: '<path d="M12 3.500v11M7.500 10.500 12 15l4.500-4.500"/><path d="M4.500 16.500V19a1.500 1.500 0 0 0 1.500 1.500h12a1.500 1.500 0 0 0 1.500-1.500v-2.500"/>',
    help: '<circle cx="12" cy="12" r="8.600"/><path d="M9.500 9.700a2.600 2.600 0 1 1 3.800 2.300c-.9.500-1.300 1-1.300 2"/><circle class="f" cx="12" cy="16.800" r="1"/>',
    trash: '<path d="M4.500 7h15M9.500 7V4.500h5V7M6.500 7l.8 12a1.500 1.500 0 0 0 1.500 1.400h6.400a1.500 1.500 0 0 0 1.500-1.400l.8-12"/>',
    edit: '<path d="m4.500 19.500 1-4L16 5a2.100 2.100 0 0 1 3 3L8.500 18.500l-4 1Z"/>',
    clock: '<circle cx="12" cy="12" r="8.600"/><path d="M12 7.500V12l3 2"/>',
    star: '<path d="m12 3.500 2.600 5.400 5.900.8-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900L3.500 9.700l5.900-.8L12 3.500Z"/>',
    shield: '<path d="M12 3.200 5 6v5.500c0 4.300 2.800 7.600 7 9.300 4.200-1.700 7-5 7-9.300V6l-7-2.800Z"/><path d="m9 12 2.200 2.200L15.200 10"/>',
    retro: '<rect x="6" y="2.800" width="12" height="18.400" rx="5"/><rect x="8.800" y="6.500" width="6.400" height="5.500" rx="1.200"/><circle class="f" cx="9.500" cy="16" r="1"/><circle class="f" cx="12" cy="17" r="1"/><circle class="f" cx="14.500" cy="16" r="1"/>'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }

  /* ------------------------------------------------------------------ 3. habillage : variables CSS tirées du look */
  function rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (v) { v = Math.round(clamp(v, 0, 255)).toString(16); return v.length < 2 ? '0' + v : v; }).join(''); }
  function mix(a, b, t) { a = rgb(a); b = rgb(b); return hex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function rgba(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function darkTo(h, max) { for (var i = 0; i < 20 && lum(h) > max; i++) h = mix(h, '#000000', 0.12); return h; }
  function lightTo(h, min) { for (var i = 0; i < 20 && lum(h) < min; i++) h = mix(h, '#ffffff', 0.14); return h; }
  function applyTheme(skin) {
    var u = skin.ui, dark = lum(u.ink) > 0.5, v = {};
    v['--accent'] = u.accent; v['--accent2'] = u.accent2; v['--bg-top'] = u.bgTop; v['--bg-bot'] = u.bgBot; v['--ink'] = u.ink;
    if (dark) {
      v['--page-top'] = darkTo(u.bgTop, 0.1); v['--page-bot'] = darkTo(u.bgBot, 0.035);
      v['--surf'] = darkTo(mix(u.bgBot, u.bgTop, 0.15), 0.022); v['--surf2'] = mix(v['--surf'], '#ffffff', 0.1);
      v['--hi'] = lightTo(u.accent, 0.3);
    } else {
      v['--page-top'] = lightTo(u.bgTop, 0.62); v['--page-bot'] = lightTo(u.bgBot, 0.4);
      v['--surf'] = mix(u.bgTop, '#ffffff', 0.86); v['--surf2'] = '#ffffff';
      v['--hi'] = darkTo(u.accent, 0.24);
    }
    v['--glass'] = rgba(v['--surf'], dark ? 0.58 : 0.72); v['--glass-solid'] = rgba(v['--surf'], 0.93);
    // texte sur la couleur d'accent : sombre dès que c'est lui le plus lisible (au moins 4,5:1 sur les dix looks)
    v['--on-accent'] = lum(u.accent) > 0.18 ? mix(u.accent, '#000000', 0.86) : '#ffffff';
    // alertes : claires sur les looks sombres, foncées sur le look à encre sombre (Pop Art) ; -fill = fond sous du texte blanc
    v['--warn'] = dark ? '#ffb020' : '#a35400'; v['--bad'] = dark ? '#ff4d5e' : '#c2183a';
    v['--bad-ink'] = dark ? '#ff97a0' : '#6b0818'; v['--bad-fill'] = dark ? '#dc1f43' : '#c2183a';
    v['--lamp'] = dark ? '#ffd54a' : '#8a5d00'; v['--lamp-line'] = rgba(v['--lamp'], 0.6);
    v['--status'] = dark ? 'transparent' : 'rgba(0,0,0,.42)';     // iPhone installé : l'heure du système est écrite en blanc
    v['--ink2'] = rgba(u.ink, 0.76); v['--ink3'] = rgba(u.ink, 0.54);
    v['--line'] = rgba(u.ink, 0.14); v['--fill'] = rgba(u.ink, 0.09); v['--fill2'] = rgba(u.ink, 0.18);
    var st = document.documentElement.style;
    for (var k in v) st.setProperty(k, v[k]);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', v['--page-top']);
  }

  /* ------------------------------------------------------------------ 4. accueil : scène, jauges, dock */
  var HEIGHT = { 0: 0.3, 1: 0.37, 2: 0.5, 3: 0.63, 4: 0.75, grognon: 0.66 };   // hauteur du dessin dans son carré
  var BOOST = [1.55, 1.5, 1.34, 1.2, 1.1];                                       // les jeunes sont un peu agrandis
  var GAUGES = [
    { k: 'hunger', lb: 'Faim', ic: 'food', tip: 'Faim : donne-lui un repas avant que la jauge ne se vide.' },
    { k: 'happy', lb: 'Humeur', ic: 'smile', tip: 'Humeur : joue avec lui, caresse-le, ou offre une friandise.' },
    { k: 'energy', lb: 'Énergie', ic: 'bolt', tip: 'Énergie : elle remonte quand il dort, lumière éteinte.' },
    { k: 'hygiene', lb: 'Propreté', ic: 'wash', tip: 'Propreté : lave-le et ramasse ses crottes.' }
  ];
  var ACTS = [
    { a: 'feed', lb: 'Nourrir', ic: 'food', c: '#ff7043', d: '#b23c17' }, { a: 'play', lb: 'Jouer', ic: 'play', c: '#8b6cf6', d: '#5237b8' }, { a: 'wash', lb: 'Laver', ic: 'wash', c: '#1fb6e8', d: '#0e7ba3' },
    { a: 'heal', lb: 'Soigner', ic: 'heal', c: '#ec4f8a', d: '#a12357' }, { a: 'light', lb: 'Lumière', ic: 'light', c: '#f5b400', d: '#a97800' }, { a: 'scold', lb: 'Rugir', ic: 'scold', c: '#35c26b', d: '#1c7f41' }
  ];
  var TABS = [{ t: 'maison', lb: 'Maison', ic: 'home' }, { t: 'profil', lb: 'Profil', ic: 'user' }, { t: 'looks', lb: 'Looks', ic: 'palette' }, { t: 'album', lb: 'Album', ic: 'star' }, { t: 'reglages', lb: 'Réglages', ic: 'gear' }];
  var NEED_PROP = { malade: 'crane', lumiere: 'ampoule', faim: 'steak', humeur: 'ballon', caprice: 'megaphone', crotte: 'crotte', sale: 'savon', fatigue: 'zzz' };
  var NEED_ACT = { malade: 'heal', lumiere: 'light', faim: 'feed', humeur: 'play', caprice: 'scold', sale: 'wash', crotte: 'wash', fatigue: 'light' };
  var CIRC = 2 * Math.PI * 20;
  var HERO_K = [2.1, 1.9, 1.45, 1.15, 1];                                        // écrans pleins : les jeunes sont agrandis autour de leurs pieds
  var tab = 'maison', tempMood = null, washing = null, G = { w: 0, h: 0 };

  function buildHome() {
    $('gauges').innerHTML = GAUGES.map(function (g) {
      return '<button class="gauge" type="button" data-g="' + g.k + '" aria-label="' + g.lb + '">' +
        ic(g.ic) + '<span class="seg"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></button>';
    }).join('');
    $('dock').innerHTML = ACTS.map(function (a) {
      return '<button class="act" type="button" data-a="' + a.a + '" style="--c:' + a.c + ';--d:' + a.d + '"><span class="circ">' + ic(a.ic) + '<i class="dot"></i></span><span class="lb">' + a.lb + '</span></button>';
    }).join('');
    $('tabbar').innerHTML = TABS.map(function (t) {
      return '<button class="tab" type="button" data-t="' + t.t + '"><span class="pill">' + ic(t.ic) + '</span>' + t.lb + '</button>';
    }).join('');
    $('side').innerHTML = TABS.slice(1).map(function (t) {
      return '<button class="glass" type="button" data-t="' + t.t + '" aria-label="' + t.lb + '">' + ic(t.ic) + '</button>';
    }).join('');
    $('side').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { sfx('tap'); go(b.dataset.t); } });
    $('bellIc').innerHTML = ic('bell');
    $('zzz').innerHTML = prop('zzz');

    $('gauges').addEventListener('click', function (e) {
      var b = e.target.closest('.gauge'); if (!b) return;
      GAUGES.forEach(function (g) { if (g.k === b.dataset.g) toast(g.tip); }); sfx('tap');
    });
    $('dock').addEventListener('click', function (e) { var b = e.target.closest('.act'); if (b) doAct(b.dataset.a); });
    $('tabbar').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) { sfx('tap'); go(b.dataset.t); } });
    $('idcard').addEventListener('click', function () { sfx('tap'); go('profil'); });
    $('bell').addEventListener('click', function () {
      sfx('tap'); var n = core.needs();
      var hollow = S.asleep && (S.hunger <= 0 || S.happy <= 0);        // il dort avec une jauge vide : rien à faire avant le réveil
      toast(S.dead ? 'Il n\'est plus là…' : S.stage === 0 ? 'Il dort encore dans son œuf.' : n.length ? n.map(function (x) { return x.label; }).join(' · ')
        : hollow ? 'Il dort ' + (S.hunger <= 0 ? 'le ventre vide' : 'le cœur gros') + ' : occupe-toi de lui dès son réveil.' : 'Tout va bien, il ne réclame rien.');
    });
    $('clock').addEventListener('click', function () {
      sfx('tap');
      if (S.speed === 1) return toast('Chez lui, il est ' + $('clockTx').textContent + '.');
      toast('Le temps file ×' + S.speed, 'Revenir à ×1', function () { core.setSpeed(1); refreshTab(true); toast('Temps normal'); });
    });
    $('monHit').addEventListener('click', touchMonster);
    $('poops').addEventListener('click', function (e) {
      var b = e.target.closest('.poop'); if (!b || b.classList.contains('out') || S.poops <= 0) return;
      // la crotte touchée s'en va AVANT l'appel au cœur : il émet « change » aussitôt, et update() ne doit plus la compter
      b.classList.add('out');
      var r = core.cleanPoop(); if (!r.ok) { b.classList.remove('out'); return; }
      sfx('pop'); buzz(12);
      floatAt(parseFloat(b.style.left), parseFloat(b.style.top), 'etoile');
      if (washing) washing.ring();
      later(function () { b.remove(); }, 280);
    });
    if (window.ResizeObserver) new ResizeObserver(function () { layout(true); }).observe($('stage'));
    window.addEventListener('resize', function () { layout(true); });
  }

  function monHeightFrac() { return S.stage === 4 && S.form === 'grognon' ? HEIGHT.grognon : HEIGHT[S.stage]; }
  /* Pose le monstre les pieds sur la ligne de sol du décor, et tout ce qui gravite autour. */
  function layout(force) {
    var st = $('stage'), w = st.clientWidth, h = st.clientHeight;
    if (!w || !h) return;
    var key = w + 'x' + h + '|' + S.stage + '|' + S.form + '|' + S.poops + '|' + (S.asleep ? 1 : 0);
    if (!force && G.key === key) return;
    // ligne de sol, depuis le bas : celle du décor, bornée pour qu'il reste dans le cadre quand la scène est basse et large
    var e = Math.max(w / 400, h / 600), gb = Math.min(130 * e, Math.max(100, h * 0.42));
    var topH = $('topbar').offsetHeight + 34;
    // un adulte occupe 0,83 de son carré ; 30 px sont gardés au-dessus de sa tête pour la bulle de besoin
    var adult = Math.max(120, Math.min(w * 0.86, (h - gb - topH - 30) / 0.83));
    var side = adult * BOOST[S.stage], monH = monHeightFrac() * side;
    var mon = $('mon').style;
    mon.width = mon.height = side + 'px'; mon.left = (w - side) / 2 + 'px'; mon.bottom = (gb - side * 0.1) + 'px';
    var hitW = Math.max(110, monH * 0.95), hit = $('monHit').style;
    hit.width = hitW + 'px'; hit.height = (monH + 8) + 'px'; hit.left = (w - hitW) / 2 + 'px'; hit.bottom = (gb - 8) + 'px';
    var headY = h - gb - monH;                                       // haut du monstre, depuis le haut
    var lift = S.asleep ? 70 : 34;                                   // endormi : la bulle passe au-dessus des « z » du dessin
    var tight = headY - lift < topH;                                 // plus de place au-dessus de la tête : bulle et Zzz se rangent à côté
    var nd = $('need').style; nd.left = Math.min(w - 66, w / 2 + hitW * (tight ? 0.5 : 0.3)) + 'px'; nd.top = Math.max(topH, headY - lift) + 'px';
    var zz = $('zzz').style; zz.left = Math.min(w - 64, w / 2 + hitW * (tight ? 0.5 : 0.22)) + 'px'; zz.top = Math.max(topH, headY - 44) + 'px';
    $('hint').style.top = Math.max(topH + 4, headY - 74) + 'px';
    G = { key: key, w: w, h: h, gb: gb, side: side, monH: monH, hitW: hitW, headY: headY, cx: w / 2 + (typeof walkDx === 'number' ? walkDx : 0) };
    var xs = [0.15, 0.86, 0.29, 0.73];
    Array.prototype.forEach.call($('poops').children, function (p) { p.style.left = (xs[(+p.dataset.s || 0) % 4] * w) + 'px'; p.style.top = (h - gb - 40) + 'px'; });
  }
  /* Autant de crottes à l'écran que dans le jeu. Chacune garde son emplacement (data-s) : on n'ajoute que celles qui
     manquent, dans le premier emplacement libre, et on ne touche pas aux autres. */
  function syncPoops(n) {
    var box = $('poops'), live = box.querySelectorAll('.poop:not(.out)'), used = {}, i, s, b;
    Array.prototype.forEach.call(live, function (p) { used[p.dataset.s] = 1; });
    for (i = live.length; i < n; i++) {
      s = 0; while (used[s]) s++; used[s] = 1;
      b = el('button', 'poop', prop('crotte')); b.type = 'button'; b.dataset.s = s; b.setAttribute('aria-label', 'Nettoyer la crotte');
      box.appendChild(b);
    }
    for (i = live.length - 1; i >= n; i--) live[i].remove();
    layout(true);
  }

  function currentMood() {
    if (tempMood && Date.now() < tempMood.until) return tempMood.mood;
    tempMood = null;
    return washing ? 'happy' : core.mood();
  }
  function setTempMood(m, ms) { tempMood = { mood: m, until: Date.now() + ms }; update(); later(update, ms + 30); }
  function act(cls, ms) { var m = $('mon'); m.classList.remove(cls); void m.offsetWidth; m.classList.add(cls); later(function () { m.classList.remove(cls); }, ms || 1200); }

  /* Met l'accueil à jour ; n'écrit que ce qui a changé. Appelé à chaque tick. */
  function update() {
    S = core.S;
    if (S.dead && S.chosen && !memorial) onDeath(false);              // filet : un monstre envolé a toujours son écran d'adieu
    var sk = core.skin(), night = core.isNight(), dead = S.dead, egg = S.stage === 0;
    put('scene', S.skin + '|' + night, function () { $('scene').innerHTML = scene(sk, night); });
    var mood = currentMood(), crack = core.eggCrack();
    put('mon', [S.skin, S.stage, S.form, mood, dead, crack].join('|'), function () {
      $('mon').innerHTML = monster({ mood: mood, dead: dead, crack: crack });
    });
    put('name', S.name, function (v) { $('tbName').textContent = v; $('tbAv').textContent = (v || 'T').charAt(0).toUpperCase(); });
    // adulte : la forme seule (« Grognon · 12 jours »), le Profil donne le titre complet et la carte est étroite
    var what = S.stage === 4 && core.FORMS[S.form] ? core.FORMS[S.form] : core.stageName();
    put('sub', dead ? 'Envolé' : egg ? 'Œuf · bientôt éclos' : what + ' · ' + core.ageText(), function (v) { $('tbSub').textContent = v; });
    put('grow', Math.round(core.growth() * 100), function (v) { $('tbGrow').style.width = v + '%'; });
    var d = core.clock(), hh = d.getHours(), mm = d.getMinutes();
    put('clock', (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm, function (v) { $('clockTx').textContent = v; });
    put('clockIc', night, function (v) { $('clockIc').innerHTML = ic(v ? 'moon' : 'sun'); });
    put('spd', S.speed, function (v) { $('clockSpd').textContent = v === 1 ? '' : '×' + v; $('clock').classList.toggle('fast', v !== 1); });
    put('bell', core.attention(), function (v) { $('bell').classList.toggle('on', v); });
    put('stageCls', (S.light ? '' : 'dark ') + (S.asleep ? 'asleep' : ''), function () {
      $('stage').classList.toggle('dark', !S.light); $('stage').classList.toggle('asleep', S.asleep);
    });
    put('gOff', egg || dead, function (v) { $('gauges').classList.toggle('off', v); });
    Array.prototype.forEach.call($('gauges').children, function (b, i) {
      var v = Math.round(S[GAUGES[i].k]);
      put('g' + i, v, function () {
        var full = v <= 0 ? 0 : Math.max(1, Math.round(v / 12.5));          // 8 segments ; il en reste un tant que la jauge n'est pas vide
        Array.prototype.forEach.call(b.querySelectorAll('.seg i'), function (s, k) { s.classList.toggle('f', k < full); });
        b.setAttribute('aria-label', GAUGES[i].lb + ' : ' + v + ' sur 100');
        b.classList.toggle('warn', v > 0 && v < 25); b.classList.toggle('bad', v <= 0);
      });
    });
    // besoins : bulle au-dessus du monstre + pastilles sur le dock
    var needs = core.needs(), first = washing ? null : needs[0], alerts = {};
    needs.forEach(function (n) { if (n.id !== 'crotte' && NEED_ACT[n.id]) alerts[NEED_ACT[n.id]] = 1; });
    put('need', first ? first.id + first.level : '', function () {
      var n = $('need');
      if (!first) { n.classList.remove('on'); return; }
      n.innerHTML = prop(NEED_PROP[first.id] || 'coeur'); n.setAttribute('aria-label', first.label);
      n.classList.toggle('crit', first.level === 'crit'); n.classList.add('on');
    });
    Array.prototype.forEach.call($('dock').children, function (b, i) {
      var a = ACTS[i].a;
      put('a' + i, (alerts[a] ? 1 : 0) + '|' + (a === 'light' && S.light ? 1 : 0), function () {
        b.classList.toggle('alert', !!alerts[a]); b.classList.toggle('lit', a === 'light' && S.light && !egg && !dead);
        if (a === 'light') b.querySelector('.lb').textContent = S.light ? 'Lumière' : 'Éteinte';
      });
    });
    put('poops', S.poops, syncPoops);
    put('hint', egg && !dead, function (v) { $('hint').innerHTML = v ? '<div class="pill glass">Tapote l\'œuf pour l\'aider à sortir</div>' : ''; });
    layout(false);
  }

  /* retours flottants dans la scène */
  function floatAt(x, y, what, text) {
    var f = el('div', 'fl' + (text ? ' txt' : ''), text ? esc(text) : prop(what));
    f.style.left = x + 'px'; f.style.top = y + 'px'; $('fx').appendChild(f);
    later(function () { f.remove(); }, 1200);
  }
  function floatMon(what, text) { floatAt(G.cx + (Math.random() - 0.5) * G.hitW * 0.7, G.headY + G.monH * 0.25 + Math.random() * 20, what, text); }
  function burst(what, n) {
    for (var i = 0; i < (n || 8); i++) {
      var f = el('div', 'fl burst', prop(what)), a = Math.PI * 2 * i / (n || 8);
      f.style.left = G.cx + 'px'; f.style.top = (G.headY + G.monH * 0.5) + 'px';
      f.style.setProperty('--dx', Math.round(Math.cos(a) * 90) + 'px'); f.style.setProperty('--dy', Math.round(Math.sin(a) * 90) + 'px');
      $('fx').appendChild(f); (function (f) { later(function () { f.remove(); }, 850); })(f);
    }
  }
  /* un objet vole du bas de l'écran jusqu'au monstre */
  function fly(what, done) {
    var f = el('div', 'fly', prop(what)), st = $('stage');
    f.style.left = G.cx + 'px'; f.style.top = (G.h - 70) + 'px'; st.appendChild(f);
    void f.offsetWidth;
    f.style.left = (G.cx + G.hitW * 0.2) + 'px'; f.style.top = (G.headY + G.monH * 0.34) + 'px'; f.style.transform = 'scale(.45)'; f.style.opacity = '0';
    later(function () { f.remove(); if (done) done(); }, 620);
  }

  var lastPetSound = 0, lastHush = 0;
  function touchMonster() {
    if (S.dead || washing) return;
    if (S.stage === 0) {
      var r = core.tapEgg(); if (!r.ok) return;
      act('mt-act-wiggle', 700); sfx('pop'); buzz(15);
      if (!r.hatched) floatMon('etoile');
      return;
    }
    if (S.asleep) { if (Date.now() - lastHush > 2500) { lastHush = Date.now(); toast('Chut… il dort'); } return; }
    var p = core.pet(); if (!p.ok) return;
    act('mt-act-wiggle', 900); floatMon('coeur'); buzz(10);
    if (p.gain && Date.now() - lastPetSound > 1500) { lastPetSound = Date.now(); sfx('love'); }
    else sfx('tap');
  }

  /* ------------------------------------------------------------------ 5. feuilles, écrans pleins, messages */
  function toast(text, actLabel, actFn) {
    var box = $('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    var t = el('div', 'toast' + (actLabel ? ' has-act' : ''), '<span>' + esc(text) + '</span>');
    if (actLabel) { var b = el('button', '', esc(actLabel)); b.type = 'button'; b.onclick = function () { kill(); actFn(); }; t.appendChild(b); }
    function kill() { if (!t.parentNode) return; t.classList.add('out'); later(function () { t.remove(); }, 230); }
    box.appendChild(t); later(kill, actLabel ? 5200 : 2600);
  }

  var sheetNow = null;
  function sheet(title, html, opts) {
    opts = opts || {};
    if (sheetNow) sheetNow.close(true);
    var wrap = el('div', 'sheet-wrap', '<div class="sheet-bg"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-top"><div class="sheet-grab"><i></i></div><div class="sheet-head"><h2>' + esc(title) + '</h2><button class="iconbtn" type="button" aria-label="Fermer">' + ic('close') + '</button></div></div>' +
      '<div class="sheet-body">' + html + '</div></div>');
    var box = wrap.querySelector('.sheet'), top = wrap.querySelector('.sheet-top'), closed = false;
    var me = { el: wrap, body: wrap.querySelector('.sheet-body'), close: close, closed: false };
    function close(fast) {
      if (closed) return; closed = me.closed = true; if (sheetNow === me) sheetNow = null;
      wrap.classList.remove('on'); box.style.transform = '';
      wrap.style.pointerEvents = 'none';                              // pendant qu'elle glisse, plus rien n'y est cliquable (ni le voile)
      later(function () { wrap.remove(); }, fast ? 0 : 330);
      if (opts.onClose) opts.onClose();
    }
    wrap.querySelector('.sheet-bg').addEventListener('click', function () { sfx('close'); close(); });
    wrap.querySelector('.iconbtn').addEventListener('click', function () { sfx('close'); close(); });
    // glisser vers le bas pour fermer
    var y0 = null, dy = 0;
    top.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; box.classList.add('drag'); try { top.setPointerCapture(e.pointerId); } catch (x) {} });
    top.addEventListener('pointermove', function (e) { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); box.style.transform = 'translateY(' + dy + 'px)'; });
    function up() { if (y0 == null) return; y0 = null; box.classList.remove('drag'); if (dy > 90) close(); else box.style.transform = ''; }
    top.addEventListener('pointerup', up); top.addEventListener('pointercancel', up);
    $('sheets').appendChild(wrap); void wrap.offsetWidth; wrap.classList.add('on');
    sheetNow = me; sfx('open');
    return me;
  }
  var fullStack = [];       // écrans pleins ouverts, du plus ancien au plus récent (le dernier est au-dessus)
  /* onBack : ce que fait le bouton Retour sur cet écran ; s'il renvoie false (ou s'il manque), Retour quitte l'appli. */
  function full(cls, html, onBack) {
    var f = el('div', 'full ' + cls, html), closed = false;
    var me = { el: f, back: onBack || null, close: function () {
      if (closed) return; closed = true;
      var i = fullStack.indexOf(me); if (i >= 0) fullStack.splice(i, 1);
      f.classList.add('out'); later(function () { f.remove(); }, 230);
      later(flushEvolve, 260);                                        // une évolution attendait peut-être que l'écran se libère
    } };
    $('fulls').appendChild(f); fullStack.push(me);
    return me;
  }
  function confetti(host) {
    var c = el('div', 'confetti'), cols = [core.skin().ui.accent, core.skin().ui.accent2, '#ffffff', '#ffd54a', '#ff7aa8'];
    for (var i = 0; i < 28; i++) {
      var p = el('i'); p.style.left = (Math.random() * 100) + '%'; p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.7) + 's'; p.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 120) + 'px');
      p.style.setProperty('--rot', Math.round(360 + Math.random() * 540) + 'deg'); c.appendChild(p);
    }
    host.appendChild(c); later(function () { c.remove(); }, 3600);
  }

  /* ------------------------------------------------------------------ 6. actions */
  function refuse(reason) { if (S.stage > 0 && !S.dead && !S.asleep) act('mt-act-no', 1000); sfx('no'); buzz([20, 40, 20]); if (reason) toast(reason); }
  function doAct(a) {
    if (washing && a !== 'wash') endWash();
    if (S.dead) { showMemorial(); return; }
    if (a === 'feed') return openFeed();
    if (a === 'play') return openGames();
    if (a === 'wash') return washing ? endWash() : startWash();
    if (a === 'heal') return heal();
    if (a === 'light') return light();
    if (a === 'scold') return scold();
  }

  /* --- nourrir --- */
  function chips(f) {
    var c = '';
    if (f.hun) c += '<span class="chip">' + ic('food') + '+' + f.hun + '</span>';
    if (f.hap) c += '<span class="chip">' + ic('smile') + '+' + f.hap + '</span>';
    if (f.w) c += '<span class="chip">' + ic('scale') + '+' + f.w + '</span>';
    return c;
  }
  function openFeed() {
    sfx('tap');
    var type = 'repas';
    var sh = sheet('Nourrir', '<div class="seg" role="tablist"><button type="button" data-ty="repas">Repas</button><button type="button" data-ty="friandise">Friandises</button></div><div class="foods"></div><p class="sheet-note"></p>');
    function draw() {
      Array.prototype.forEach.call(sh.body.querySelectorAll('.seg button'), function (b) { b.classList.toggle('on', b.dataset.ty === type); });
      sh.body.querySelector('.foods').innerHTML = core.FOODS.filter(function (f) { return f.type === type; }).map(function (f) {
        return '<button class="food" type="button" data-f="' + f.id + '"><span class="pic">' + prop(f.id) + '</span><span class="nm">' + f.name + '</span><span class="fx-row">' + chips(f) + '</span></button>';
      }).join('');
      sh.body.querySelector('.sheet-note').innerHTML = type === 'repas'
        ? ic('food') + '<span>Un repas remplit la jauge de faim. Il refuse de manger quand il est rassasié.</span>'
        : ic('alert') + '<span>Les friandises font plaisir et font grossir. Trop d\'affilée, et il tombe malade.</span>';
    }
    draw();
    sh.body.addEventListener('click', function (e) {
      if (sh.closed) return;                                          // un second appui pendant la fermeture ne redonne pas à manger
      var s = e.target.closest('.seg button'); if (s) { type = s.dataset.ty; sfx('tap'); draw(); return; }
      var b = e.target.closest('.food'); if (!b) return;
      var r = core.feed(b.dataset.f); sh.close();
      if (!r.ok) return later(function () { refuse(r.reason); }, 200);
      later(function () {
        fly(r.food.id, function () { floatMon('', '+' + (r.food.type === 'repas' ? r.food.hun : r.food.hap)); });
        setTempMood('eat', 1500); later(function () { act('mt-act-chomp', 1200); sfx('eat'); buzz(18); }, 420);
      }, 220);
    });
  }

  /* --- jouer --- */
  function openGames() {
    var c = core.canPlay(); if (!c.ok) return refuse(c.reason);
    sfx('tap');
    var list = MT.games && MT.games.list || [];
    if (!list.length) { sheet('Jouer', '<div class="empty"><div class="pic">' + prop('ballon') + '</div><h3>Bientôt</h3><p>Les mini-jeux arrivent.</p></div>'); return; }
    var sh = sheet('Jouer', '<div class="rows">' + list.map(function (g) {
      return '<button class="rowbtn" type="button" data-g="' + g.id + '"><span class="pic">' + prop(g.icon) + '</span><span class="tx"><span class="nm">' + esc(g.name) + '</span><span class="ds">' + esc(g.desc) + '</span></span>' + ic('chev') + '</button>';
    }).join('') + '</div><p class="sheet-note">' + ic('smile') + '<span>Jouer remonte l\'humeur, le fatigue un peu et lui fait perdre du poids. Une victoire rapporte plus.</span></p>');
    sh.body.addEventListener('click', function (e) { var b = e.target.closest('.rowbtn'); if (b && !sh.closed) { sh.close(); later(function () { runGame(b.dataset.g); }, 200); } });
  }
  function gameCtx() {
    var sk = core.skin();
    return {
      skin: sk, stage: S.stage, form: S.form, night: core.isNight(),
      monster: function (o) { o = o || {}; return MT.art.monster(sk, { stage: S.stage, form: S.form, mood: o.mood || 'neutral', uid: o.uid || uid() }); },
      prop: function (id) { return prop(id); }, scene: function () { return scene(sk, core.isNight()); },
      sfx: function (n, o) { sfx(n, o); }, haptic: function (p) { buzz(p); }, uid: uid
    };
  }
  function runGame(id) {
    var g = null; (MT.games.list || []).forEach(function (x) { if (x.id === id) g = x; });
    if (!g) return;
    var c = core.canPlay(); if (!c.ok) return refuse(c.reason);
    var f = full('game', '<div class="full-head"><h2>' + esc(g.name) + '</h2><button class="iconbtn" type="button" aria-label="Quitter le jeu">' + ic('close') + '</button></div><div class="game-host"></div>',
      function () { MT.games.stop(); });
    f.el.querySelector('.iconbtn').addEventListener('click', function () { sfx('close'); MT.games.stop(); });
    var p;
    try { p = MT.games.start(id, f.el.querySelector('.game-host'), gameCtx()); } catch (e) { p = Promise.resolve({ win: false, score: 0, quit: true }); }
    Promise.resolve(p).then(function (res) {
      res = res || { quit: true };
      if (res.quit) { f.close(); return; }
      var out = core.playResult({ win: !!res.win, score: res.score || 0, id: g.id });
      if (!out.ok) { f.close(); return; }                             // il n'est plus là pour fêter ça
      showResult(g, res, f, out);
    }, function () { f.close(); });
  }
  /* out = ce que la partie a réellement changé (core.playResult) : on n'annonce que ce qui a bougé. */
  function showResult(g, res, gameScreen, out) {
    sfx(res.win ? 'win' : 'lose'); buzz(res.win ? [20, 40, 60] : 30);
    var fx = '<span class="chip">' + ic('smile') + (out.gain > 0 ? '+' + out.gain + ' humeur' : 'Humeur au maximum') + '</span>' +
      (out.tired > 0 ? '<span class="chip">' + ic('bolt') + '−' + out.tired + ' énergie</span>' : '') +
      (out.lost > 0 ? '<span class="chip">' + ic('scale') + '−' + out.lost + ' poids</span>' : '');
    var r = full('result', '<div class="center"><span class="kicker">' + esc(g.name) + '</span><h2>' + fr(res.win ? 'Gagné !' : 'Perdu…') + '</h2>' +
      '<div class="hero" style="--k:' + HERO_K[S.stage] + '">' + monster({ mood: res.win ? 'love' : 'sad' }) + '</div>' +
      '<div class="score"><small>Score</small>' + (res.score || 0) + '</div>' +
      '<p>' + fr(res.win ? 'Il s\'est bien amusé : son humeur grimpe en flèche.' : 'Il a quand même aimé jouer avec toi.') + '</p>' +
      '<div class="chips">' + fx + '</div></div>' +
      '<div class="full-foot two"><button class="btn ghost" type="button" data-b="again">Rejouer</button><button class="btn" type="button" data-b="ok">Continuer</button></div>',
      function () { r.close(); update(); });
    gameScreen.close();
    if (res.win) { confetti(r.el); later(function () { var h = r.el.querySelector('.hero'); if (h) { h.classList.add('mt-act-jump'); } }, 250); }
    r.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b) return;
      sfx('tap'); r.close(); update();
      if (b.dataset.b === 'again') later(function () { runGame(g.id); }, 150);
    });
  }

  /* --- laver --- */
  function startWash() {
    if (S.stage === 0) return refuse('Il faut d\'abord qu\'il sorte de l\'œuf');
    if (S.asleep) return refuse('Chut… il dort');
    if (S.hygiene >= 100) { sfx('tap'); return toast('Il est déjà tout propre'); }
    sfx('open');
    var st = $('stage'), w = el('div', 'wash', '<div class="wash-top"><div class="wash-info glass"><span class="ring"><svg viewBox="0 0 48 48"><circle class="trk" cx="24" cy="24" r="20"/><circle class="val" cx="24" cy="24" r="20" stroke-dasharray="' + CIRC.toFixed(2) + '"/></svg><b></b></span><span>Frotte avec l\'éponge</span></div><button class="btn small" type="button">Terminer</button></div><div class="sponge idle">' + prop('eponge') + '</div>');
    var sp = w.querySelector('.sponge'), down = false, lx = 0, ly = 0, acc = 0, lastS = 0;
    sp.style.left = G.cx + 'px'; sp.style.top = (G.headY + G.monH * 0.5) + 'px';
    function ring() { var v = Math.round(S.hygiene); w.querySelector('.val').setAttribute('stroke-dashoffset', (CIRC * (1 - v / 100)).toFixed(2)); w.querySelector('b').textContent = v; }
    function pos(e) { var r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onMon(p) { return Math.abs(p.x - G.cx) < G.hitW * 0.62 && p.y > G.headY - 20 && p.y < G.h - G.gb + 24; }
    w.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      down = true; var p = pos(e); lx = p.x; ly = p.y; sp.classList.remove('idle'); sp.classList.add('down');
      sp.style.left = p.x + 'px'; sp.style.top = p.y + 'px'; try { w.setPointerCapture(e.pointerId); } catch (x) {}
    });
    w.addEventListener('pointermove', function (e) {
      if (!down) return; var p = pos(e); sp.style.left = p.x + 'px'; sp.style.top = p.y + 'px';
      if (onMon(p)) acc += Math.hypot(p.x - lx, p.y - ly);
      lx = p.x; ly = p.y;
      while (acc >= 70) {
        acc -= 70; var r = core.wash(2); if (!r.ok) return endWash();
        var b = el('div', 'bub', prop('bulle')); b.style.left = (p.x + (Math.random() - 0.5) * 50) + 'px'; b.style.top = (p.y + (Math.random() - 0.5) * 30) + 'px';
        b.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 50) + 'px'); w.appendChild(b); (function (b) { later(function () { b.remove(); }, 1250); })(b);
        if (Date.now() - lastS > 380) { lastS = Date.now(); sfx('wash'); buzz(8); }
        ring();
        if (r.full || S.hygiene >= 100) { down = false; burst('etoile', 10); sfx('happy'); act('mt-act-jump', 1100); toast('Tout propre !'); later(endWash, 1000); return; }
      }
    });
    function up() { down = false; sp.classList.remove('down'); }
    w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
    w.querySelector('button').addEventListener('click', function () { sfx('close'); endWash(); });
    st.appendChild(w); st.classList.add('washing'); washing = { el: w, ring: ring }; ring(); update();
  }
  function endWash() { if (!washing) return; washing.el.remove(); washing = null; $('stage').classList.remove('washing'); update(); }

  /* --- soigner, lumière, gronder --- */
  function heal() {
    var r = core.medicine(); if (!r.ok) return refuse(r.reason);
    sfx('tap'); fly('seringue', function () {
      sfx('heal'); buzz(20);
      if (r.cured) {
        burst('coeur', 8); act('mt-act-jump', 1100);
        // guéri, mais ce qui l'a rendu malade est peut-être encore là : on le dit
        toast(S.poops > 0 ? 'Guéri ! Pense à ramasser ses crottes.' : S.hygiene < 25 ? 'Guéri ! Un bon bain lui ferait du bien.' : 'Guéri ! Il va beaucoup mieux.');
      }
      else { act('mt-act-wiggle', 800); toast('Encore une dose et il sera guéri.'); }
    });
  }
  function light() {
    var r = core.toggleLight(); if (!r.ok) return refuse(r.reason);
    buzz(12);
    if (r.light) { if (r.woke) return; sfx(r.asleep ? 'tap' : 'wake'); toast(r.asleep ? 'Lumière allumée… il dort encore.' : 'Lumière allumée'); }
    else { sfx('sleep'); toast('Lumière éteinte. Bonne nuit !'); }
  }
  /* Rugir : le monstre pousse son cri, l'écran tremble. Plus il est grand, plus le cri est grave. */
  /* Quatre vrais rugissements enregistrés (sons/rugir-N.wav), tirés au hasard sans répéter le précédent.
     Plus le monstre est jeune, plus le cri est joué vite, donc aigu. Si le fichier ne peut pas être lu, on retombe sur le son de synthèse. */
  var ROAR_FILES = ['sons/rugir-1.wav', 'sons/rugir-2.wav', 'sons/rugir-3.wav', 'sons/rugir-4.wav'], roarAudio = [], roarLast = -1, roarNow = null;
  function synthRoar() { sfx('roar', { pitch: [1, 1.9, 1.45, 1.1, 0.8][S.stage] || 1, volume: 0.7 + S.stage * 0.15 }); }
  function playRoar() {
    if (S.mute) return;
    var i; do { i = Math.floor(Math.random() * ROAR_FILES.length); } while (i === roarLast && ROAR_FILES.length > 1);
    roarLast = i;
    try {
      var a = roarAudio[i] || (roarAudio[i] = new Audio(ROAR_FILES[i]));
      if (roarNow && roarNow !== a) roarNow.pause();
      roarNow = a; a.currentTime = 0;
      a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
      a.playbackRate = [1, 1.7, 1.35, 1.12, 1][S.stage] || 1;
      a.volume = Math.min(1, 0.6 + S.stage * 0.1);
      var p = a.play(); if (p && p.catch) p.catch(synthRoar);
    } catch (e) { synthRoar(); }
  }
  var lastRoar = 0, ROARS =['Couic !', 'Rrrr !', 'Graou !', 'GRAOUUU !', 'GRRRAAAOUUU !'];
  function scold() {
    if (Date.now() - lastRoar < 1300) return;                         // le rugissement précédent joue encore
    var r = core.roar(); if (!r.ok) return refuse(r.reason);
    lastRoar = Date.now();
    playRoar();
    buzz(S.stage >= 3 ? [40, 30, 90] : [25, 25, 40]);
    setTempMood('eat', 1250); act('mt-act-hop', 900);
    var st = $('stage'); st.classList.remove('roaring'); void st.offsetWidth; st.classList.add('roaring');
    later(function () { st.classList.remove('roaring'); }, 700);
    floatAt(G.cx + G.hitW * 0.2, G.headY + G.monH * 0.1, '', ROARS[S.stage] || 'Graou !');
    if (S.stage >= 3) burst('eclair', 6);
  }

  /* Promenade : de temps en temps, s'il est éveillé et en forme, il fait quelques pas vers la gauche ou la droite. */
  var walkDx = 0, walkAt = Date.now() + 6000;
  function setWalk(dx) {
    var st = $('stage');
    if (dx !== walkDx) $('mon').classList.toggle('flip', dx < walkDx);
    walkDx = dx; st.style.setProperty('--wx', dx + 'px'); G.cx = G.w / 2 + dx;
  }
  function wander() {
    var now = Date.now();
    var free = tab === 'maison' && !S.dead && S.stage > 0 && !S.asleep && !S.sick && !washing && !document.hidden &&
      !$('fulls').children.length && !$('sheets').children.length;
    if (!free) { if (walkDx && (S.asleep || S.dead || S.stage === 0)) setWalk(0); walkAt = now + 5000; return; }
    if (now < walkAt || (tempMood && now < tempMood.until)) return;
    var room = Math.max(0, (G.w - G.hitW) / 2 - 14);
    if (room < 24) { walkAt = now + 20000; return; }
    var dx = Math.round((Math.random() * 2 - 1) * room);
    if (Math.abs(dx - walkDx) < 30) dx = walkDx > 0 ? -Math.round(room * 0.7) : Math.round(room * 0.7);
    setWalk(dx);
    act('mt-act-hop', 900); later(function () { if (!tempMood) act('mt-act-hop', 900); }, 950);
    walkAt = now + 7000 + Math.random() * 9000;
  }

  /* ------------------------------------------------------------------ 7. événements du jeu */
  function showEvolve(from, to, title, text) {
    var f = full('evo', '<div class="center"><span class="kicker early">Oh ! Il se passe quelque chose…</span>' +
      '<div class="hero"><div class="old" style="--k:' + HERO_K[from.stage] + '">' + monster({ stage: from.stage, form: from.form, mood: 'surprised', crack: from.stage === 0 ? 3 : 0 }) + '</div>' +
      '<div class="new" style="--k:' + HERO_K[to.stage] + '">' + monster({ stage: to.stage, form: to.form, mood: 'happy' }) + '</div></div>' +
      '<span class="kicker late">' + esc(S.name) + '</span><h2 class="late">' + esc(title) + '</h2><p class="late">' + esc(text) + '</p></div>' +
      '<div class="flash"></div><div class="full-foot"><button class="btn block late" type="button">Continuer</button></div>',
      function () { f.close(); update(); });
    later(function () { f.el.classList.add('flashing'); sfx(from.stage === 0 ? 'hatch' : 'evolve'); buzz([30, 50, 30, 50, 80]); }, 700);
    later(function () { f.el.classList.add('done'); confetti(f.el); }, 1150);
    f.el.querySelector('button').addEventListener('click', function () { sfx('tap'); f.close(); update(); });
  }
  /* Naissance et évolution : la cérémonie attend son tour. Si un autre écran plein est ouvert (mini-jeu, résultat,
     accueil…), on retient seulement le stade de départ ; l'écran s'affiche dès que la place est libre. */
  var pendingEvo = null;
  function evoBusy() { return fullStack.length > 0 || !!(MT.games && MT.games.running && MT.games.running()); }
  function queueEvolve(from) { if (pendingEvo == null) pendingEvo = from; flushEvolve(); }
  function flushEvolve() {
    S = core.S;
    if (pendingEvo == null || evoBusy()) return;
    var from = pendingEvo; pendingEvo = null;
    if (S.dead || S.stage <= from) return;
    if (from === 0 && S.stage === 1) return showEvolve({ stage: 0 }, { stage: 1 }, 'Il est né !', 'Un bébé tout rond vient de sortir de sa coquille. Il a déjà faim.');
    var txt = S.stage < 4 ? 'Il grandit à vue d\'œil. Continue de bien t\'en occuper.'
      : S.form === 'titan' ? 'Grâce à tes bons soins, il est devenu un Titan majestueux.' : 'Il a manqué de soins : le voilà devenu un adulte grognon.';
    showEvolve({ stage: from, form: '' }, { stage: S.stage, form: S.form }, core.stageName(), txt);
  }
  var memorial = null;
  /* 26 étoiles dans le ciel de l'adieu, jamais sur une ligne de texte (elles s'y liraient comme des signes parasites). */
  function scatterStars(host) {
    var box = host.getBoundingClientRect(), W = box.width || 1, H = box.height || 1, keep = [], s = '', n = 0, tries = 0, x, y;
    Array.prototype.forEach.call(host.querySelectorAll('.kicker, h2, p, .chips'), function (e) {
      var r = e.getBoundingClientRect(); if (r.width) keep.push([r.left - box.left - 10, r.top - box.top - 10, r.right - box.left + 10, r.bottom - box.top + 10]);
    });
    var inText = function (k) { return x > k[0] && x < k[2] && y > k[1] && y < k[3]; };
    while (n < 26 && tries++ < 600) {
      x = Math.random() * W; y = Math.random() * H * 0.7;
      if (keep.some(inText)) continue;
      s += '<i style="left:' + (x / W * 100).toFixed(1) + '%;top:' + (y / H * 100).toFixed(1) + '%;animation-delay:' + (Math.random() * 3).toFixed(2) + 's"></i>'; n++;
    }
    host.querySelector('.stars').innerHTML = s;
  }
  /* Tout ce qui accompagne la mort : on range ce qui était ouvert, puis l'écran d'adieu. */
  function onDeath(sound) {
    if (memorial) return;
    S = core.S;
    endWash(); if (MT.games && MT.games.stop) MT.games.stop(); if (sheetNow) sheetNow.close(true);
    pendingEvo = null; fullStack.slice().forEach(function (f) { if (f !== onbNow) f.close(); });
    if (sound) sfx('die');
    showMemorial(); refreshTab(true);
  }
  function showMemorial() {
    if (memorial) return;
    var last = S.hall[0] || { name: S.name, age: S.age, stage: core.stageName(), cause: S.deathCause };
    memorial = full('memorial', '<div class="stars"></div><div class="center"><span class="kicker">Au revoir</span>' +
      '<div class="hero">' + monster({ dead: true }) + '</div><h2>' + esc(last.name) + ' s\'est envolé</h2>' +
      '<p>Il a vécu ' + fmtDur(last.age) + ' à tes côtés' + (last.cause ? ', puis la ' + esc(last.cause) + ' l\'a emporté' : '') + '. Il veille maintenant sur le prochain œuf.</p>' +
      '<div class="chips"><span class="chip big">' + ic('star') + esc(last.stage) + '</span><span class="chip big">' + ic('clock') + fmtDur(last.age) + '</span></div></div>' +
      '<div class="full-foot"><button class="btn block" type="button">Accueillir un nouvel œuf</button></div>');
    memorial.el.querySelector('button').addEventListener('click', function () { sfx('ok'); core.newEgg(); });
    scatterStars(memorial.el);
  }
  /* Notification du système. Promesse : true si elle est vraiment partie. Sur Android, seul le service worker a le droit
     d'en afficher (le constructeur lève une erreur) ; ailleurs, ou sans service worker (essais en local), le constructeur suffit. */
  function sendNotif(text) {
    var opts = { body: text, icon: 'icons/icon-192.png', tag: 'mini-titan' };
    var direct = function () { new Notification('Mini-Titan', opts); return true; };
    try {
      if (!window.Notification || Notification.permission !== 'granted') return Promise.resolve(false);
      var swc = navigator.serviceWorker;
      if (!swc || !swc.getRegistration) return Promise.resolve(direct());
      return swc.getRegistration().then(function (r) {
        if (!r || !r.showNotification) return direct();
        // un service worker tout juste installé n'est pas encore « actif » : on attend qu'il le soit (3 s au plus)
        var pret = r.active ? Promise.resolve(r) : Promise.race([swc.ready, new Promise(function (ok) { setTimeout(function () { ok(r); }, 3000); })]);
        return pret.then(function (reg) { return reg.showNotification('Mini-Titan', opts); }).then(function () { return true; }, function () { try { return direct(); } catch (e) { return false; } });
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  /* Un appel pendant que l'appli est derrière une autre fenêtre. Si rien ne peut s'afficher, le réglage s'éteint : il ne ment pas. */
  function notify(text) {
    if (!S.notif || !document.hidden) return;
    sendNotif(text).then(function (ok) {
      if (ok) return;
      core.setOpt('notif', false); toast('Notifications indisponibles sur ce navigateur'); refreshTab(true);
    });
  }
  function syncSfx() { if (MT.sfx) { MT.sfx.mute(!!S.mute); MT.sfx.hapticsOff = !S.haptics; } }
  /* L'état a été remplacé d'un bloc (nouvel œuf, remise à zéro, autre instance) : tout l'affichage se recale dessus. */
  function resync() {
    S = core.S;
    if (memorial && !S.dead) { memorial.close(); memorial = null; }
    if (onbNow && S.chosen) { onbNow.close(); onbNow = null; }
    memo = {}; applyTheme(core.skin()); syncSfx(); update(); refreshTab(true);
    if (!S.chosen) showOnboarding();
  }
  var CALLS = { faim: ' a très faim !', humeur: ' est très triste…', malade: ' est malade !', caprice: ' t\'appelle…', lumiere: ' dort, la lumière est restée allumée' };
  function bindCore() {
    core.on('change', function () { update(); refreshTab(false); });
    core.on('hatch', function () { queueEvolve(0); refreshTab(true); });
    core.on('evolve', function (d) { queueEvolve(d.from); refreshTab(true); });
    core.on('die', function () { onDeath(true); });
    core.on('newegg', function () { resync(); if (S.chosen) toast('Un nouvel œuf est arrivé'); });
    core.on('adopted', resync);
    core.on('skin', function () { applyTheme(core.skin()); memo.scene = null; update(); });
    core.on('call', function (d) { sfx('call'); buzz([60, 60, 60]); notify(S.name + (CALLS[d.type] || ' a besoin de toi')); });
    core.on('sick', function () { sfx('sick'); toast(S.name + ' est tombé malade'); });
    core.on('poop', function () { sfx('poop'); });
    core.on('mistake', function (d) { toast('Erreur de soin : ' + d.why); });
    core.on('sleep', function (d) { toast(d.night ? S.name + ' s\'endort. Pense à éteindre la lumière.' : S.name + ' fait une sieste'); });
    core.on('wake', function (d) { sfx('wake'); toast(S.name + (d && d.night ? ' se réveille. Sans toi, il se rendormira dans 20 minutes.' : ' se réveille')); });
    core.on('away', function (d) {
      if (S.dead) return;                                             // l'écran d'adieu raconte déjà la fin
      var lines = d.lines.slice(); if (d.slowed) lines.push('Le temps est revenu à sa vitesse normale (×1)');
      var li = lines.length ? lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') : '<li>' + fr('Rien de spécial : il t\'attendait sagement.') + '</li>';
      sheet('Pendant ton absence', '<p class="sheet-text">Tu es parti ' + fmtDur(d.minutes) + '.</p><ul class="away-list">' + li + '</ul>');
    });
  }

  /* ------------------------------------------------------------------ 8. onglets */
  function go(t) {
    if (['maison', 'profil', 'looks', 'album', 'reglages'].indexOf(t) < 0) t = 'maison';
    if (washing) endWash();
    var prev = tab; tab = t;
    TABS.forEach(function (x) { $('v-' + x.t).classList.toggle('on', x.t === t); });
    $('app').classList.toggle('at-home', t === 'maison');     // sur l'accueil, la barre d'onglets laisse place aux raccourcis de gauche
    Array.prototype.forEach.call($('tabbar').children, function (b) { b.classList.toggle('on', b.dataset.t === t); if (b.dataset.t === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (prev !== t && prev !== 'maison') $('v-' + prev).innerHTML = '';     // libère les gros dessins
    refreshTab(true);
    if (t === 'maison') { layout(true); update(); } else $('v-' + t).scrollTop = 0;
  }
  var lastTabDraw = 0;
  function refreshTab(force) {
    if (tab === 'maison') return;
    if (!force && Date.now() - lastTabDraw < 15000) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    lastTabDraw = Date.now();
    if (tab === 'profil') drawProfil(); else if (tab === 'looks') drawLooks(); else if (tab === 'album') MT.album.render($('v-album')); else drawReglages();
  }

  function drawProfil() {
    var v = $('v-profil'), keep = v.scrollTop, sk = core.skin(), st = core.STAGES[S.stage], egg = S.stage === 0;
    var left = '';                                  // le délai avant le prochain stade reste secret : seule la jauge de croissance le laisse deviner
    // chaque stade est recadré sur lui-même : il remplit 72 % de sa pastille, centré (sinon l'œuf et le bébé sont des points)
    var friseMon = function (i) {
      var form = i === 4 ? S.form : '', H = form === 'grognon' ? HEIGHT.grognon : HEIGHT[i], k = 0.72 / H, cy = 90 - H * 50;
      return '<span class="fm" style="transform:translateY(' + (50 - cy).toFixed(1) + '%) scale(' + k.toFixed(2) + ');transform-origin:50% ' + cy.toFixed(1) + '%">' + monster({ stage: i, form: form, mood: 'neutral' }) + '</span>';
    };
    var frise = core.STAGES.map(function (x, i) {
      return '<div class="fnode ' + (i < S.stage ? 'done' : i === S.stage ? 'cur' : '') + '"><span class="dot">' + (i <= S.stage ? friseMon(i) : '?') + '</span>' + x.name + '</div>';
    }).join('');
    var s = S.stats, stats = [[s.meals, 'repas'], [s.snacks, 'friandises'], [s.games, 'parties'], [s.wins, 'victoires'], [s.washes, 'bains'], [s.pets, 'caresses']]
      .map(function (x) { return '<div class="stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
    var log = S.log.length ? S.log.slice(0, 14).map(function (l) { return '<li><time>' + fmtDate(l.t) + '</time>' + esc(l.text) + '</li>'; }).join('') : '<li>Rien pour l\'instant.</li>';
    var hall = S.hall.length ? '<div class="card"><h3>Anciens compagnons</h3><div class="hall">' + S.hall.map(function (h) {
      return '<div class="hall-it"><div class="av">' + MT.art.monster(MT.SKINS[h.skin] || sk, { stage: 2, dead: true, uid: uid() }) + '</div><div><div class="nm">' + esc(h.name) + '</div><div class="ds">' + esc(h.stage) + ' · ' + fmtDur(h.age) + (h.cause ? ' · ' + esc(h.cause) : '') + '</div></div></div>';
    }).join('') + '</div></div>' : '';
    v.innerHTML = '<h1 class="vt">Profil</h1>' +
      '<div class="portrait">' + scene(sk, core.isNight()) + '<div class="pm">' + monster({ mood: S.dead ? 'neutral' : core.mood(), dead: S.dead, crack: core.eggCrack() }) + '</div>' +
      '<div class="pinfo glass"><div class="tx"><div class="nm">' + esc(S.name) + '</div><div class="sub">' + (egg ? 'Œuf' : core.stageName() + ' · ' + core.ageText()) + '</div></div><button class="iconbtn" type="button" id="pfEdit" aria-label="Changer le nom">' + ic('edit') + '</button></div></div>' +
      '<div class="pchips"><span class="chip big">' + ic('scale') + S.weight + ' kg</span><span class="chip big">' + ic('clock') + core.ageText() + '</span><span class="chip big">' + ic('palette') + esc(sk.name) + '</span></div>' +
      '<div class="card"><h3>Soins</h3><div class="kv" style="margin-top:0;padding-top:0;border-top:0">' + ic('alert') + 'Erreurs de soin<b>' + S.mistakes + '</b></div><p class="cap">Un appel resté sans réponse 15 minutes (puis une erreur de plus toutes les 3 heures tant qu\'il attend), ou la lumière oubliée quand il dort. Au-delà de ' + core.TITAN_MAX_MISTAKES + ' erreurs, il deviendra un adulte grognon.</p></div>' +
      '<div class="card"><h3>Croissance</h3><div class="frise"><span class="bar" style="width:' + (clamp((S.stage + core.growth()) / 4, 0, 1) * 80).toFixed(1) + '%"></span>' + frise + '</div>' + (left ? '<p class="cap" style="margin-top:12px">' + left + '</p>' : '') + '</div>' +
      '<div class="card"><h3>Statistiques</h3><div class="stats">' + stats + '</div></div>' +
      '<div class="card"><h3>Journal</h3><ul class="log">' + log + '</ul></div>' + hall;
    v.scrollTop = keep;
    $('pfEdit').addEventListener('click', openRename);
  }
  function openRename() {
    sfx('tap');
    var sh = sheet('Son nom', '<input class="field" type="text" maxlength="14" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + attr(S.name) + '" aria-label="Nom du monstre"><div class="sheet-actions"><button class="btn block" type="button">Enregistrer</button></div>');
    var inp = sh.body.querySelector('input');
    function ok() { var r = core.rename(inp.value); if (!r.ok) return toast('Donne-lui un nom'); inp.blur(); sh.close(); sfx('ok'); refreshTab(true); }
    sh.body.querySelector('button').addEventListener('click', ok);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok(); });
  }

  function drawLooks() {
    var v = $('v-looks'), keep = v.scrollTop, egg = S.stage === 0;
    var k = egg ? 1 : [1, 1.6, 1.4, 1.2, 1][S.stage];                 // les jeunes sont agrandis, pieds sur la même ligne
    var box = 'width:' + (82 * k).toFixed(1) + '%;left:' + ((100 - 82 * k) / 2).toFixed(1) + '%;top:' + (87.3 - 73.8 * k).toFixed(1) + '%';
    v.innerHTML = '<h1 class="vt">Looks</h1><p class="lead">Des habits pour ton monstre et son décor. Tu peux en changer quand tu veux, sans rien perdre.</p><div class="looks">' +
      MT.SKINS.map(function (sk, i) {
        return '<button class="look' + (i === S.skin ? ' on' : '') + '" type="button" data-i="' + i + '" aria-pressed="' + (i === S.skin) + '"><span class="pv" style="background:linear-gradient(' + sk.ui.bgTop + ',' + sk.ui.bgBot + ')">' +
          '<span class="lm" style="' + box + '">' + MT.art.monster(sk, { stage: egg ? 4 : S.stage, form: egg ? 'titan' : S.form, mood: 'happy', uid: uid() }) + '</span></span>' +
          '<span class="ck">' + ic('check') + '</span><span class="tx"><span class="nm">' + esc(sk.name) + '</span><span class="ds">' + esc(sk.desc) + '</span></span></button>';
      }).join('') + '</div>';
    v.scrollTop = keep;
    if (!v.dataset.bound) {
      v.dataset.bound = '1';
      v.addEventListener('click', function (e) {
        var b = e.target.closest('.look'); if (!b) return;
        var i = +b.dataset.i; if (i === S.skin) return;
        core.setSkin(i); sfx('ok'); buzz(15);
        Array.prototype.forEach.call(v.querySelectorAll('.look'), function (x) { x.classList.toggle('on', +x.dataset.i === i); x.setAttribute('aria-pressed', +x.dataset.i === i); });
        toast('Look « ' + MT.SKINS[i].name + ' »');
      });
    }
  }

  var installEvt = null;
  function sw(id, on) { return '<button class="switch" type="button" role="switch" id="' + id + '" aria-checked="' + (on ? 'true' : 'false') + '"></button>'; }
  function drawReglages() {
    var v = $('v-reglages'), keep = v.scrollTop, canNotify = !!window.Notification;
    v.innerHTML = '<h1 class="vt">Réglages</h1>' +
      '<p class="gt">Appli</p><div class="group">' +
      '<div class="set">' + ic('sound') + '<div class="tx"><span class="nm">Sons</span></div>' + sw('swSon', !S.mute) + '</div>' +
      '<div class="set">' + ic('vibrate') + '<div class="tx"><span class="nm">Vibrations</span><span class="ds">Sur les téléphones qui le permettent.</span></div>' + sw('swVib', S.haptics) + '</div>' +
      // la ligne n'existe que là où une notification peut s'afficher, et ne promet que ce qui marche
      (canNotify ? '<div class="set">' + ic('bell') + '<div class="tx"><span class="nm">Notifications</span><span class="ds">' + fr('Il te prévient quand il t\'appelle, mais seulement tant que l\'appli reste ouverte derrière une autre fenêtre. Appli fermée ou téléphone en veille : il ne peut pas te prévenir.') + '</span></div>' + sw('swNot', S.notif) + '</div>' : '') +
      (installEvt ? '<button class="set" type="button" id="setInstall">' + ic('install') + '<div class="tx"><span class="nm">Installer l\'appli</span><span class="ds">Ajoute Mini-Titan à ton écran d\'accueil.</span></div>' + ic('chev') + '</button>'
        : '<div class="set">' + ic('install') + '<div class="tx"><span class="nm">Installer l\'appli</span><span class="ds">' + fr('Sur iPhone : bouton Partager, puis « Sur l\'écran d\'accueil ». Sur Android : menu du navigateur, puis « Installer l\'application ».') + '</span></div></div>') +
      '</div>' +
      '<p class="gt">Aide</p><div class="group">' +
      '<button class="set" type="button" id="setTuto">' + ic('star') + '<div class="tx"><span class="nm">Tutoriel rapide</span><span class="ds">Les jauges et les boutons en cinq ' + String.fromCharCode(233) + 'crans.</span></div>' + ic('chev') + '</button>' +
      '<button class="set" type="button" id="setHelp">' + ic('help') + '<div class="tx"><span class="nm">Comment jouer</span></div>' + ic('chev') + '</button>' +
      '<a class="set" href="classique.html">' + ic('retro') + '<div class="tx"><span class="nm">Version classique</span><span class="ds">L\'œuf en pixels à trois boutons.</span></div>' + ic('chev') + '</a>' +
      '</div>' +
      '<div class="group"><button class="set danger" type="button" id="setWipe">' + ic('trash') + '<div class="tx"><span class="nm">Recommencer à zéro</span><span class="ds">Efface le monstre, le journal et les souvenirs.</span></div></button></div>' +
      '<p class="foot">Mini-Titan · version 2</p>';
    v.scrollTop = keep;
    function flip(id, fn) { $(id).addEventListener('click', function () { var on = this.getAttribute('aria-checked') !== 'true'; fn(on, this); }); }
    flip('swSon', function (on, b) { core.setOpt('mute', !on); if (MT.sfx) MT.sfx.mute(!on); b.setAttribute('aria-checked', on); if (on) sfx('ok'); });
    flip('swVib', function (on, b) { core.setOpt('haptics', on); if (MT.sfx) MT.sfx.hapticsOff = !on; b.setAttribute('aria-checked', on); sfx('tap'); buzz(30); });
    if (canNotify) flip('swNot', function (on, b) {
      sfx('tap');
      if (!on) { core.setOpt('notif', false); b.setAttribute('aria-checked', false); return; }
      var answered = false;
      var done = function (p) {
        if (answered) return; answered = true;                        // le navigateur répond deux fois : par la fonction ET par la promesse
        if (p !== 'granted') return toast('Notifications refusées par le navigateur');
        // l'interrupteur ne s'allume que si une notification d'essai part vraiment
        sendNotif('C\'est noté : il te préviendra quand il t\'appelle.').then(function (ok) {
          if (!ok) return toast('Notifications indisponibles sur ce navigateur');
          core.setOpt('notif', true); toast('Notifications activées');
          var now = $('swNot'); if (now) now.setAttribute('aria-checked', true);
        });
      };
      try { var q = Notification.requestPermission(done); if (q && q.then) q.then(done, function () { done('denied'); }); } catch (e) { toast('Notifications indisponibles sur ce navigateur'); }
    });
    $('setHelp').addEventListener('click', openHelp);
    $('setTuto').addEventListener('click', function () { sfx('tap'); showTuto(); });
    $('setWipe').addEventListener('click', function () {
      sfx('tap');
      var sh = sheet('Recommencer à zéro ?', '<p class="sheet-text">' + esc(S.name) + ', son journal et les anciens compagnons seront effacés pour de bon.</p><div class="sheet-actions"><button class="btn danger block" type="button" data-b="y">Tout effacer</button><button class="btn ghost block" type="button" data-b="n">Annuler</button></div>');
      sh.body.addEventListener('click', function (e) {
        var b = e.target.closest('[data-b]'); if (!b) return; sh.close();
        if (b.dataset.b === 'y') { go('maison'); core.wipe(); }       // l'événement « newegg » rouvre l'accueil (resync)
      });
    });
    if (installEvt) $('setInstall').addEventListener('click', function () { try { installEvt.prompt(); } catch (e) {} installEvt = null; later(function () { refreshTab(true); }, 400); });
  }
  function openHelp() {
    sfx('tap');
    var h = function (i, t, p) { return '<section><h3>' + ic(i) + t + '</h3><p>' + fr(p) + '</p></section>'; };
    sheet('Comment jouer', '<div class="help">' +
      h('heart', 'Il vit en temps réel', 'Ton monstre grandit, a faim et s\'endort même quand l\'appli est fermée. Passe le voir plusieurs fois par jour.') +
      h('food', 'Nourrir', 'Les repas remplissent la faim. Les friandises font plaisir mais font grossir, et rendent malade si on en abuse.') +
      h('play', 'Jouer', 'Trois mini-jeux remontent son humeur. Tu peux aussi le caresser en le touchant.') +
      h('wash', 'Laver', 'Frotte-le avec l\'éponge, et touche ses crottes pour les ramasser. La saleté finit par le rendre malade.') +
      h('heal', 'Soigner', 'Une tête de mort ? Il est malade : donne-lui son médicament, parfois deux doses. Sans soin, il ne survit pas.') +
      h('light', 'Lumière et sommeil', 'Il s\'endort tout seul le soir et se réveille à 8 h. Éteins la lumière quand il dort. Tu veux jouer la nuit ? Rallume : il se réveille, puis se rendort au bout de 20 minutes sans toi, ou dès que tu éteins. En journée, s\'il est fatigué, éteindre lui fait faire une sieste.') +
      h('scold', 'Rugir', 'Juste pour le plaisir : il pousse son cri de monstre. Tout petit, il couine ; adulte, il fait trembler l\'écran.') +
      h('bell', 'Les appels', 'La cloche rouge sonne quand une jauge est vide ou qu\'il est malade. Sans réponse en 15 minutes, c\'est une erreur de soin, puis une de plus toutes les 3 heures tant qu\'il attend.') +
      h('star', 'Grandir', 'Œuf, bébé, enfant, ado, puis adulte : Titan s\'il a été bien soigné, Grognon sinon. Négligé trop longtemps, il s\'envole.') +
      '</div>');
  }

  /* ------------------------------------------------------------------ 9. première ouverture */
  var onbNow = null;
  function showOnboarding() {
    if (onbNow) return;
    var idx = S.skin || 0, step = 0;
    var dots = function (n) { return '<div class="dots">' + [0, 1, 2].map(function (i) { return '<i class="' + (i === n ? 'on' : '') + '"></i>'; }).join('') + '</div>'; };
    var backBtn = '<button class="iconbtn" type="button" data-b="back" aria-label="Retour">' + ic('back') + '</button>';
    var f = onbNow = full('onb', '' +
      '<div class="step" data-s="0"><div class="top"><span class="sp"></span>' + dots(0) + '<span class="sp"></span></div>' +
      '<div class="welcome"><div class="duo"><div class="big"></div><div class="egg"></div></div><h2>Bienvenue\u202f!</h2><p>Un œuf mystérieux t\'attend. Dedans, un tout petit monstre qui ne demande qu\'à grandir… si tu prends bien soin de lui.</p></div>' +
      '<div class="full-foot"><button class="btn block" type="button" data-b="next">Commencer</button></div></div>' +
      '<div class="step" data-s="1"><div class="top">' + backBtn + dots(1) + '<span class="sp"></span></div>' +
      '<div class="head"><h2>Choisis son look</h2><p>Fais glisser pour les voir tous. Tu pourras en changer plus tard.</p></div>' +
      '<div class="carousel">' + MT.SKINS.map(function (sk, i) { return '<div class="lcard" data-i="' + i + '" style="background:linear-gradient(' + sk.ui.bgTop + ',' + sk.ui.bgBot + ')"><div class="lbg"></div><div class="lm"></div><div class="le"></div><div class="cap2 glass"><b>' + esc(sk.name) + '</b><span>' + esc(sk.desc) + '</span></div></div>'; }).join('') + '</div>' +
      '<div class="cdots">' + MT.SKINS.map(function () { return '<i></i>'; }).join('') + '</div>' +
      '<div class="full-foot"><button class="btn block" type="button" data-b="next">Choisir ce look</button></div></div>' +
      '<div class="step" data-s="2"><div class="top">' + backBtn + dots(2) + '<span class="sp"></span></div>' +
      '<div class="head"><h2>Comment <span class="nw">s\'appelle-t-il\u202f?</span></h2><p>Donne un nom à ton futur compagnon.</p></div>' +
      '<div class="namebox"><div class="hero"></div><input class="field" type="text" maxlength="14" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Titan" aria-label="Nom du monstre"><p class="cap">14 caractères au plus.</p></div>' +
      '<div class="full-foot"><button class="btn block" type="button" data-b="done">Faire éclore</button></div></div>',
      function () { if (step > 0) { show(step - 1); return true; } return false; });
    var car = f.el.querySelector('.carousel'), cards = car.children, cd = f.el.querySelector('.cdots').children, inp = f.el.querySelector('input');
    function fillCards() {      // ne dessine que la carte courante et ses voisines
      Array.prototype.forEach.call(cards, function (c, i) {
        var near = Math.abs(i - idx) <= 1, sk = MT.SKINS[i];
        c.classList.toggle('on', i === idx); cd[i].classList.toggle('on', i === idx);
        if (near && !c.dataset.f) {
          c.dataset.f = '1'; c.querySelector('.lbg').innerHTML = scene(sk, false);
          c.querySelector('.le').innerHTML = MT.art.monster(sk, { stage: 0, uid: uid() });
        } else if (!near && c.dataset.f) { c.dataset.f = ''; c.querySelector('.lbg').innerHTML = c.querySelector('.lm').innerHTML = c.querySelector('.le').innerHTML = ''; }
      });
    }
    function setIdx(i) { i = clamp(i, 0, MT.SKINS.length - 1); if (i === idx && cards[i].dataset.f) return; idx = i; applyTheme(MT.SKINS[idx]); fillCards(); }
    var scT = null;
    car.addEventListener('scroll', function () {
      clearTimeout(scT); scT = later(function () { var c = cards[0]; if (!c) return; setIdx(Math.round(car.scrollLeft / (c.offsetWidth + 14))); }, 60);
    });
    // glisser à la souris (au doigt, le défilement natif s'en charge) + flèches du clavier
    function goCard(i) { var c = cards[0]; i = clamp(i, 0, cards.length - 1); try { car.scrollTo({ left: i * (c.offsetWidth + 14), behavior: 'smooth' }); } catch (e) { car.scrollLeft = i * (c.offsetWidth + 14); } }
    var drag = null;
    car.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: car.scrollLeft, moved: 0 }; car.classList.add('dragging');
      try { car.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    });
    car.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.x; drag.moved = dx; car.scrollLeft = drag.left - dx; });
    function dragEnd() {
      if (!drag) return;
      var c = cards[0], pas = c.offsetWidth + 14, i = Math.round(drag.left / pas);
      if (drag.moved < -40) i++; else if (drag.moved > 40) i--;       // un petit geste suffit pour changer de carte
      drag = null; goCard(i);
      later(function () { car.classList.remove('dragging'); }, 420);   // le cran revient une fois l'élan terminé
    }
    car.addEventListener('pointerup', dragEnd); car.addEventListener('pointercancel', dragEnd);
    f.el.addEventListener('keydown', function (e) {
      if (step !== 1) return;
      if (e.key === 'ArrowRight') goCard(idx + 1); else if (e.key === 'ArrowLeft') goCard(idx - 1);
    });
    f.el.querySelector('.cdots').addEventListener('click', function (e) { var k = Array.prototype.indexOf.call(cd, e.target); if (k >= 0) goCard(k); });
    function show(n) {
      step = n;
      Array.prototype.forEach.call(f.el.querySelectorAll('.step'), function (s) { s.classList.toggle('on', +s.dataset.s === n); });
      var sk = MT.SKINS[idx];
      if (n === 0) {
        f.el.querySelector('.duo .egg').innerHTML = MT.art.monster(sk, { stage: 0, uid: uid() });
      } else if (n === 1) { fillCards(); var c = cards[0]; car.scrollLeft = idx * (c.offsetWidth + 14); }
      else { f.el.querySelector('.namebox .hero').innerHTML = MT.art.monster(sk, { stage: 0, crack: 1, uid: uid() }); }
    }
    f.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b) return;
      sfx('tap');
      if (b.dataset.b === 'next') show(step + 1);
      else if (b.dataset.b === 'back') show(step - 1);
      else {
        inp.blur(); onbNow = null; core.setSkin(idx); core.rename(inp.value || 'Titan'); core.setOpt('chosen', true);   // le temps de l'œuf démarre ici
        sfx('ok'); f.close(); applyTheme(core.skin()); memo = {}; update();
        later(showTuto, 350);
      }
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    f.show = show;
    show(0);
  }

  /* ------------------------------------------------------------------ 10. démarrage */
  /* ------------------------------------------------------------------ tutoriel rapide (5 écrans)
     Montré une fois, juste après « Faire éclore » (ou au premier lancement pour un joueur d'avant), et rejouable depuis les Réglages. */
  var TUTO_KEY = 'mini-titan-tuto-v1', tutoNow = null;
  function tutoSeen() { if (core.isDemo()) return true; try { return !!localStorage.getItem(TUTO_KEY); } catch (e) { return true; } }
  function showTuto() {
    if (tutoNow) return;
    try { if (!core.isDemo()) localStorage.setItem(TUTO_KEY, '1'); } catch (e) {}
    var rowG = function (g, txt) { return '<div class="tu-row"><span class="tu-ic tu-g">' + ic(g.ic) + '</span><div><b>' + g.lb + '</b><span>' + txt + '</span></div></div>'; };
    var rowA = function (i, txt) { var a = ACTS[i]; return '<div class="tu-row"><span class="tu-ic tu-a" style="--c:' + a.c + ';--d:' + a.d + '">' + ic(a.ic) + '</span><div><b>' + a.lb + '</b><span>' + txt + '</span></div></div>'; };
    var rowI = function (icn, t, txt) { return '<div class="tu-row"><span class="tu-ic tu-g">' + ic(icn) + '</span><div><b>' + t + '</b><span>' + txt + '</span></div></div>'; };
    var steps = [
      ['Ton monstre vit en vrai', 'Il grandit, a faim et s\'endort en temps réel, même quand l\'appli est fermée.',
        '<div class="tu-hero">' + monster({ stage: 1, mood: 'happy' }) + '</div>' +
        rowI('clock', 'Passe le voir chaque jour', 'Quelques minutes, deux ou trois fois par jour, suffisent.') +
        rowI('star', 'Il évolue', 'Œuf, bébé, enfant, ado, puis adulte. Sa jauge de croissance te montre où il en est.') +
        rowI('heart', 'Fais-lui des câlins', 'Appuie sur ton monstre pour le caresser : il adore ça.')],
      ['Les quatre jauges', 'En haut à droite. Huit segments chacune : vertes tout va bien, orange attention, rouge urgence.',
        rowG(GAUGES[0], 'Baisse avec le temps. Remonte avec un repas.') +
        rowG(GAUGES[1], 'Remonte en jouant, avec une caresse ou une friandise.') +
        rowG(GAUGES[2], 'Baisse quand il est debout. Remonte quand il dort.') +
        rowG(GAUGES[3], 'Baisse avec le temps et les crottes. Remonte avec un bain.') +
        '<p class="tu-note">Touche une jauge dans le jeu pour revoir son explication.</p>'],
      ['Les six boutons', 'En bas de l\'écran. Celui dont il a besoin s\'entoure de blanc et sautille.',
        rowA(0, 'Repas pour la faim, friandises pour le plaisir (pas trop : ça rend malade).') +
        rowA(1, 'Trois mini-jeux qui remontent son humeur.') +
        rowA(2, 'Frotte-le avec l\'éponge jusqu\'à ce qu\'il brille.') +
        rowA(3, 'Le médicament quand il est malade, parfois deux doses.') +
        rowA(4, 'Éteins quand il dort. Rallume pour le réveiller.') +
        rowA(5, 'Juste pour le plaisir : il pousse son cri.')],
      ['Quand il a besoin de toi', 'Il te le montre de trois façons.',
        rowI('bell', 'La cloche rouge', 'Une jauge est vide ou il est malade. Sans réponse en 15 minutes, c\'est une erreur de soin.') +
        rowI('smile', 'La bulle au-dessus de lui', 'Elle montre ce qu\'il lui faut : un steak, un savon, une ampoule…') +
        rowI('wash', 'Les crottes', 'Touche-les pour les ramasser. Les laisser traîner le rend malade.') +
        rowI('alert', 'Les erreurs de soin', 'Trop d\'erreurs et il deviendra un adulte Grognon au lieu d\'un Titan. Négligé deux jours, il s\'envole.')],
      ['Sommeil et raccourcis', 'Dernières choses à savoir.',
        rowI('moon', 'La nuit', 'Il s\'endort seul le soir et se réveille à 8 h. Éteins la lumière. Pour jouer la nuit, rallume : il reste debout 20 minutes.') +
        rowI('user', 'Profil', 'Son âge, son poids, sa croissance et son journal.') +
        rowI('palette', 'Looks', 'Change son apparence et son décor quand tu veux.') +
        rowI('star', 'Album', 'Ta collection et tes succès. Ils restent même s\'il s\'envole.') +
        rowI('gear', 'Réglages', 'Sons, vibrations, et ce tutoriel à revoir.')]
    ];
    var n = steps.length, step = 0;
    var f = tutoNow = full('tuto', steps.map(function (s, i) {
      var dots = ''; for (var k = 0; k < n; k++) dots += '<i class="' + (k === i ? 'on' : '') + '"></i>';
      return '<div class="tu-step" data-s="' + i + '"><div class="tu-top"><button class="iconbtn" type="button" data-b="back" aria-label="Retour"' + (i ? '' : ' style="visibility:hidden"') + '>' + ic('back') + '</button><div class="tu-dots">' + dots + '</div>' +
        '<button class="tu-skip" type="button" data-b="skip">' + (i < n - 1 ? 'Passer' : '') + '</button></div>' +
        '<div class="tu-body"><h2>' + s[0] + '</h2><p class="tu-lead">' + fr(s[1]) + '</p>' + s[2] + '</div>' +
        '<div class="full-foot"><button class="btn block" type="button" data-b="next">' + (i < n - 1 ? 'Suivant' : 'C\'est parti !') + '</button></div></div>';
    }).join(''), function () { if (step > 0) { show(step - 1); return true; } return false; });
    function show(i) { step = i; Array.prototype.forEach.call(f.el.querySelectorAll('.tu-step'), function (s) { s.classList.toggle('on', +s.dataset.s === i); }); }
    function end() { tutoNow = null; f.close(); update(); }
    f.el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-b]'); if (!b) return;
      sfx('tap');
      if (b.dataset.b === 'back') show(step - 1); else if (b.dataset.b === 'skip' || step >= n - 1) end(); else show(step + 1);
    });
    show(0);
  }

  var DEMO = {
    oeuf: { stage: 0 },
    bebe: { stage: 1, age: 20, grow: 20, hunger: 70, happy: 82, hygiene: 90 },
    enfant: { stage: 2, age: 620, grow: 560, weight: 12, hunger: 72, happy: 84, energy: 66, hygiene: 80 },
    ado: { stage: 3, age: 2700, grow: 1200, weight: 23, hunger: 58, happy: 61, energy: 74, hygiene: 66, disc: 50 },
    titan: { stage: 4, form: 'titan', age: 7200, grow: 2800, weight: 34, hunger: 92, happy: 96, energy: 81, hygiene: 88, disc: 75 },
    grognon: { stage: 4, form: 'grognon', age: 7200, grow: 2800, weight: 41, hunger: 55, happy: 48, energy: 60, hygiene: 52, mistakes: 9 },
    malade: { stage: 2, age: 900, grow: 800, weight: 12, sick: true, doses: 2, callT: 0, hunger: 46, happy: 38, energy: 52, hygiene: 40 },
    dodo: { stage: 3, age: 2700, grow: 1200, weight: 23, asleep: true, nap: true, light: false, energy: 30, hunger: 64, happy: 70, hygiene: 75 },
    sale: { stage: 2, age: 900, grow: 800, weight: 13, hygiene: 8, poops: 3, hunger: 60, happy: 44, energy: 70 },
    faim: { stage: 2, age: 900, grow: 800, weight: 10, hunger: 0, callT: 0, happy: 30, energy: 58, hygiene: 62 },
    caprice: { stage: 3, age: 2700, grow: 1200, weight: 23, hunger: 80, happy: 77, energy: 70, hygiene: 81 },
    mort: { stage: 3, age: 5000, dead: true, deathCause: 'maladie', hunger: 0, happy: 0 },
    accueil: { chosen: false }
  };
  function start() {
    var q = {}; location.search.replace(/[?&]([^=&]+)=([^&]*)/g, function (m, k, v) { q[k] = decodeURIComponent(v); });
    if (q.demo) { var d = {}, src = DEMO[q.demo] || DEMO.enfant; for (var k in src) d[k] = src[k]; if (q.look != null) d.skin = clamp(+q.look || 0, 0, MT.SKINS.length - 1); S = core.demo(d); }
    else S = core.load();
    ['art', 'scenes', 'games'].forEach(function (m) { if (MT[m] && MT[m].css) { var s = document.createElement('style'); s.textContent = MT[m].css; document.head.appendChild(s); } });
    syncSfx(); if (MT.album) MT.album.start();
    window.addEventListener('pointerdown', function () { if (MT.sfx) MT.sfx.unlock(); }, { passive: true });
    /* Téléphone : ni zoom au double tap, ni zoom au pincement (Safari ignore en partie les réglages CSS et la balise viewport).
       Le second tap rapproché est annulé pour le navigateur, mais on déclenche nous-mêmes son clic : tapoter vite l'œuf reste possible. */
    var lastTap = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now(), t = e.target, fast = now - lastTap < 350;
      lastTap = now;
      if (!fast || e.touches.length || !e.cancelable) return;
      if (t && t.closest && t.closest('input, textarea, .wash, .mtg-root, .carousel, .sheet-top')) return;
      e.preventDefault();
      var b = t && t.closest && t.closest('button, a, [data-b]'); if (b) b.click();
    }, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (g) { document.addEventListener(g, function (e) { e.preventDefault(); }, { passive: false }); });
    document.addEventListener('touchmove', function (e) { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; refreshTab(true); });
    applyTheme(core.skin()); buildHome(); bindCore(); go('maison');
    core.tick(); update();
    setInterval(function () { core.tick(); update(); wander(); }, 250);
    // retour au premier plan : d'abord relire la sauvegarde (une autre instance a pu jouer), puis rattraper le temps.
    // Départ en arrière-plan : on sauvegarde, sauf si une autre instance a écrit entre-temps (alors on la suit, sans l'écraser).
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { core.sync(); core.tick(); update(); } else if (!core.sync()) core.save(); });
    window.addEventListener('storage', function (e) { if (e.key === null || e.key === core.KEY) core.sync(); });
    // clavier ouvert : la fenêtre rétrécit, ce n'est pas un téléphone tourné (voir « paysage » dans app.css)
    document.addEventListener('focusin', function (e) { document.documentElement.classList.toggle('typing', e.target.tagName === 'INPUT'); });
    document.addEventListener('focusout', function () { document.documentElement.classList.remove('typing'); });
    bindBack();
    if (!S.chosen) showOnboarding(); else if (S.dead) showMemorial(); else if (!tutoSeen()) later(showTuto, 500);
    var e = q.ecran;
    if (e === 'profil' || e === 'looks' || e === 'album' || e === 'reglages') go(e); else if (e) later(function () { open(e); }, 60);
    if (q.etape && onbNow) onbNow.show(clamp(+q.etape || 0, 0, 2));        // essais : &etape=1 (looks) ou 2 (nom) sur l'accueil
  }
  /* Bouton Retour (Android) : il ferme ce qui est ouvert au lieu de quitter l'appli. Une entrée « sentinelle » est posée dans
     l'historique au premier geste du joueur (sans geste, Chrome n'en tiendrait pas compte) ; Retour la consomme, on ferme
     l'écran du dessus et on la repose. S'il n'y a rien à fermer, on laisse partir. */
  var sentinel = false;
  function armBack() { if (sentinel) return; try { history.pushState({ mt: 1 }, ''); sentinel = true; } catch (e) {} }
  function backPressed() {
    var top = fullStack[fullStack.length - 1];
    if (top) return top.back ? top.back() !== false : false;
    if (sheetNow) { sfx('close'); sheetNow.close(); return true; }
    if (washing) { endWash(); return true; }
    if (tab !== 'maison') { go('maison'); return true; }
    return false;
  }
  function bindBack() {
    window.addEventListener('pointerdown', armBack, { passive: true });
    window.addEventListener('popstate', function () {
      if (!sentinel) return;                                          // une navigation qui ne nous concerne pas
      sentinel = false;
      if (backPressed()) armBack(); else { try { history.back(); } catch (e) {} }
    });
  }
  function open(name) {
    if (name === 'nourrir') openFeed(); else if (name === 'jeux') openGames(); else if (name === 'laver') startWash();
    else if (name === 'tuto') showTuto(); else if (name === 'aide') openHelp(); else if (name === 'accueil') showOnboarding(); else if (name === 'nom') openRename();
    else if (/^jeu-/.test(name || '')) runGame(name.slice(4));
    else if (name === 'evolution') showEvolve({ stage: Math.max(0, S.stage - 1), form: '' }, { stage: S.stage, form: S.form }, core.stageName(), 'Il grandit à vue d\'œil. Continue de bien t\'en occuper.');
    else if (name === 'resultat' && MT.games && MT.games.list[0]) showResult(MT.games.list[0], { win: true, score: 7 }, { close: function () {} }, { gain: 28, tired: 4, lost: 1 });
  }

  MT.ui = { go: go, open: open, toast: toast, update: update, runGame: runGame, showEvolve: showEvolve, back: backPressed };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
