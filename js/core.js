/* Mini-Titan — le cœur du jeu : état, règles, temps, sauvegarde.
   Aucun accès au DOM ici. L'interface écoute MT.core.on(evt, fn) et appelle les actions.
   Jauges de 0 à 100 (100 = au mieux). Le temps avance en « minutes de jeu » ; à vitesse ×1, une minute de jeu = une minute réelle. */
window.MT = window.MT || {};
(function () {
  'use strict';
  var KEY = 'mini-titan-v2';

  /* Par stade : durée (min), pertes par minute éveillé (faim, humeur, énergie, propreté), délai entre crottes, poids mini, heures de sommeil. */
  var STAGES = [
    { id: 'oeuf',   name: 'Œuf',    dur: 3 },
    { id: 'bebe',   name: 'Bébé',   dur: 135,      hun: 1.8,  hap: 1.3,  ene: 0,     hyg: 0.6,  poop: 15,  w: 5,  sleep: null },
    { id: 'enfant', name: 'Enfant', dur: 4320,     hun: 0.42, hap: 0.36, ene: 0.12,  hyg: 0.09, poop: 120, w: 10, sleep: [20, 8] },
    { id: 'ado',    name: 'Ado',    dur: 8640,     hun: 0.32, hap: 0.28, ene: 0.115, hyg: 0.08, poop: 150, w: 20, sleep: [21, 8] },
    { id: 'adulte', name: 'Adulte', dur: Infinity, hun: 0.26, hap: 0.24, ene: 0.11,  hyg: 0.07, poop: 180, w: 30, sleep: [22, 8] }
  ];
  var FOODS = [
    { id: 'steak',   type: 'repas',     name: 'Steak',   hun: 35, hap: 2,  w: 2 },
    { id: 'poisson', type: 'repas',     name: 'Poisson', hun: 28, hap: 4,  w: 1 },
    { id: 'ramen',   type: 'repas',     name: 'Ramen',   hun: 40, hap: 5,  w: 2 },
    { id: 'pomme',   type: 'repas',     name: 'Pomme',   hun: 15, hap: 2,  w: 0 },
    { id: 'glace',   type: 'friandise', name: 'Glace',   hun: 6,  hap: 22, w: 2 },
    { id: 'donut',   type: 'friandise', name: 'Donut',   hun: 10, hap: 18, w: 3 },
    { id: 'sucette', type: 'friandise', name: 'Sucette', hun: 3,  hap: 15, w: 1 }
  ];
  var FORMS = { titan: 'Titan', grognon: 'Grognon' };
  var CALL_DELAY = 15;      // minutes pour répondre à un appel avant l'erreur de soin
  var NEGLECT_EVERY = 180;  // appel toujours sans réponse : une erreur de plus toutes les 3 h éveillées
  var LIGHT_DELAY = 60;     // minutes pour éteindre la lumière quand il s'endort
  var SICK_AFTER_DIRT = 180, DEATH_SICK = 720, DEATH_STARVE = 720, TITAN_MAX_MISTAKES = 30;
  var EGG_TAPS = 12;        // tapes pour faire éclore l'œuf tout de suite
  var MAX_WEIGHT = 99;      // plafond de la balance (kg)
  var FIRST_BED = 20;       // plus tôt des couchers : passé cette heure, on ne réveille plus personne
  var SLOW_TICK = 5000;     // au-delà, le tick est « ralenti » : le temps reprend à vitesse réelle
  var AWAY_TICK = 90000;    // au-delà, c'est une absence : rattrapage muet, puis résumé

  var S = null, listeners = {}, silent = false, awayLines = [];
  var clamp = function (v) { return v < 0 ? 0 : v > 100 ? 100 : v; };

  function fresh(skin, name) {
    var now = Date.now();
    return {
      v: 2, skin: skin || 0, name: name || 'Titan', chosen: false,
      stage: 0, form: '', age: 0, grow: 0, eggTaps: 0,
      hunger: 60, happy: 60, energy: 100, hygiene: 100, disc: 0, weight: 5,
      poops: 0, poopT: 10, dirtyT: 0, filthT: 0,
      sick: false, doses: 0, sickT: 0, starveT: 0, snacks: 0,
      asleep: false, nap: false, light: true, lightT: 0,
      mistakes: 0, callT: -1, fake: 0, fakeT: 200,
      dead: false, deathCause: '', born: now, last: now, simT: now, acc: 0, petAt: 0, roarAt: 0,
      speed: 1, mute: false, haptics: true, notif: false,
      stats: { meals: 0, snacks: 0, games: 0, wins: 0, washes: 0, meds: 0, scolds: 0, pets: 0, poops: 0 },
      log: [], hall: []
    };
  }

  /* ---------- événements ---------- */
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, data) {
    if (silent) return;
    var run = function (list) { (list || []).slice().forEach(function (fn) { try { fn(data, evt); } catch (e) { if (window.console) console.error(e); } }); };
    run(listeners[evt]); run(listeners['*']);
  }
  function log(text) {
    S.log.unshift({ t: S.simT, text: text });
    if (S.log.length > 40) S.log.length = 40;
    if (silent) awayLines.push(text);
  }

  /* ---------- sauvegarde ---------- */
  var noSave = false;       // mode démo : rien n'est lu ni écrit dans le navigateur
  /* Plusieurs instances peuvent être ouvertes (deux onglets, onglet + appli installée) : chaque sauvegarde porte
     l'identifiant de l'instance qui l'a écrite (by) et un numéro (rev). sync() adopte la sauvegarde d'une autre
     instance dès qu'elle en voit une qu'elle ne connaît pas : la dernière à avoir joué fait foi. */
  var ME = Math.random().toString(36).slice(2, 10) + Date.now().toString(36), seen = '';
  function stamp(j) { return j ? (j.by || '') + ':' + (j.rev || 0) : ''; }
  function read() { try { var j = JSON.parse(localStorage.getItem(KEY)); return j && j.v === 2 ? j : null; } catch (e) { return null; } }
  function save() {
    if (noSave) return true;
    S.by = ME; S.rev = (S.rev || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(S)); seen = stamp(S); return true; } catch (e) { return false; }
  }
  /* Mode démo (captures, essais) : état neuf en mémoire, jamais sauvegardé. À appeler À LA PLACE de load(). */
  function demo(o) {
    noSave = true; S = fresh(); S.chosen = true;
    for (var k in (o || {})) S[k] = o[k];
    api.S = S; return S;
  }
  /* Réglages de l'appareil : ils survivent à un nouvel œuf comme à une remise à zéro. */
  function keepPrefs(from) { S.mute = !!from.mute; S.haptics = from.haptics !== false; S.notif = !!from.notif; }
  /* Remplace l'état par une sauvegarde lue. Une sauvegarde dont l'accueil n'a jamais été terminé ne vaut rien
     (d'anciennes versions y laissaient vivre un monstre que personne n'avait vu) : on repart d'un œuf neuf. */
  function adopt(j) {
    S = fresh();
    if (j.chosen === false) { keepPrefs(j); S.skin = j.skin; }
    else for (var k in j) S[k] = j[k];
    var st = fresh().stats; for (var s in st) if (typeof S.stats[s] !== 'number') S.stats[s] = 0;
    if (!(S.skin >= 0 && S.skin < MT.SKINS.length)) S.skin = 0;
    if (!S.log || !S.log.unshift) S.log = [];
    if (!S.hall || !S.hall.unshift) S.hall = [];
    api.S = S; seen = stamp(j);
  }
  function load() {
    var j = read();
    if (j) adopt(j); else { S = fresh(); api.S = S; }
    return S;
  }
  /* Relit la sauvegarde ; si une AUTRE instance a écrit depuis notre dernière lecture, on adopte son état. */
  function sync() {
    if (noSave) return false;
    var j = read();
    if (!j || j.by === ME || stamp(j) === seen) return false;
    adopt(j); emit('adopted', {}); emit('change', {});
    return true;
  }

  /* ---------- lectures ---------- */
  var stage = function () { return STAGES[S.stage]; };
  function critical() { return S.hunger <= 0 || S.happy <= 0 || S.sick; }
  function isSleepTime(t) {
    var sl = stage().sleep; if (!sl) return false;
    var h = new Date(t == null ? S.simT : t).getHours();
    return h >= sl[0] || h < sl[1];
  }
  function isNight() { var h = new Date(S.simT).getHours(); return h >= 20 || h < 7; }
  function attention() {
    if (S.dead || S.stage === 0) return false;
    var calling = S.callT >= 0 && S.callT < CALL_DELAY;
    // endormi : on ne peut ni le nourrir ni jouer, donc seuls la lumière et la maladie sonnent (faim et humeur reprennent au réveil)
    if (S.asleep) return (S.sick && calling) || (S.light && S.lightT < LIGHT_DELAY);
    return (critical() && calling) || S.fake > 0;
  }
  function callType() { return S.fake > 0 ? 'caprice' : S.sick ? 'malade' : S.asleep ? 'lumiere' : S.hunger <= 0 ? 'faim' : 'humeur'; }
  /* Liste des besoins à afficher : level 'crit' (appel, urgent) ou 'warn' (bientôt). */
  function needs() {
    var n = [];
    if (S.dead || S.stage === 0) return n;
    if (S.sick) n.push({ id: 'malade', level: 'crit', label: 'Il est malade' });
    if (S.asleep) {
      if (S.light) n.push({ id: 'lumiere', level: 'crit', label: 'Éteins la lumière' });
      return n;
    }
    if (S.hunger <= 0) n.push({ id: 'faim', level: 'crit', label: 'Il meurt de faim' });
    else if (S.hunger < 25) n.push({ id: 'faim', level: 'warn', label: 'Il a faim' });
    if (S.happy <= 0) n.push({ id: 'humeur', level: 'crit', label: 'Il est très triste' });
    else if (S.happy < 25) n.push({ id: 'humeur', level: 'warn', label: 'Il s\'ennuie' });
    if (S.fake > 0) n.push({ id: 'caprice', level: 'crit', label: 'Il fait un caprice' });
    if (S.poops > 0) n.push({ id: 'crotte', level: 'warn', label: 'À nettoyer' });
    if (S.hygiene < 25) n.push({ id: 'sale', level: 'warn', label: 'Il est sale' });
    if (S.energy < 20 && S.stage >= 2) n.push({ id: 'fatigue', level: 'warn', label: 'Il est fatigué' });
    return n;
  }
  /* Humeur pour le dessin : 'neutral' | 'happy' | 'love' | 'sad' | 'angry' | 'sick' | 'sleep' */
  function mood() {
    if (S.asleep) return 'sleep';
    if (S.sick) return 'sick';
    if (S.fake > 0) return 'angry';
    if (S.hunger <= 0 || S.happy <= 0) return 'sad';
    if (S.hunger < 25 || S.happy < 25 || S.hygiene < 15) return 'sad';
    if (S.happy >= 90 && S.hunger >= 60) return 'love';
    if (S.happy >= 65 && S.hunger >= 40) return 'happy';
    return 'neutral';
  }
  function eggCrack() {
    if (S.stage !== 0) return 0;
    var p = Math.max(S.eggTaps / EGG_TAPS, (S.grow * 60000 + S.acc) / (STAGES[0].dur * 60000));
    return p >= 0.75 ? 3 : p >= 0.5 ? 2 : p >= 0.25 ? 1 : 0;
  }
  function ageDays() { return Math.floor(S.age / 1440); }
  function ageText() {
    var m = S.age;
    if (m < 60) return m + ' min';
    if (m < 1440) return Math.floor(m / 60) + ' h';
    var d = Math.floor(m / 1440); return d + (d > 1 ? ' jours' : ' jour');
  }
  function stageName() { return S.stage === 4 && FORMS[S.form] ? 'Adulte ' + FORMS[S.form] : stage().name; }
  function growth() { var d = stage().dur; return d === Infinity ? 1 : Math.min(1, S.grow / d); }

  /* ---------- règles : une minute de jeu ---------- */
  function mistake(why) { S.mistakes++; log('Erreur de soin : ' + why); emit('mistake', { why: why }); }
  function fallSick(why) {
    if (S.sick) return;
    S.sick = true; S.doses = 1 + (Math.random() < 0.5 ? 1 : 0); S.sickT = 0;
    log(S.name + ' est tombé malade (' + why + ')'); emit('sick', { why: why });
  }
  function die(cause) {
    S.dead = true; S.deathCause = cause; S.asleep = false; S.nap = false; S.light = true; S.fake = 0;
    S.hall.unshift({ name: S.name, days: ageDays(), age: S.age, stage: stageName(), skin: S.skin, cause: cause, t: S.simT });
    if (S.hall.length > 12) S.hall.length = 12;
    log(S.name + ' s\'est envolé (' + cause + ')'); emit('die', { cause: cause });
  }
  function evolve() {
    var from = S.stage;
    S.stage++; S.grow = 0;
    var st = stage();
    S.weight = Math.max(S.weight, st.w); S.poopT = st.poop;
    if (S.stage === 4) S.form = S.mistakes <= TITAN_MAX_MISTAKES ? 'titan' : 'grognon';
    if (from === 0) { log(S.name + ' est sorti de son œuf'); emit('hatch', {}); }
    else { log(S.name + ' a grandi : ' + stageName()); emit('evolve', { from: from, to: S.stage, form: S.form }); }
  }
  function minute(t) {
    if (S.dead) return;
    S.age++; S.grow++;
    if (S.stage === 0) { if (S.grow >= STAGES[0].dur) evolve(); return; }
    var st = stage(), night = isSleepTime(t);

    if (night && !S.asleep) { S.asleep = true; S.nap = false; S.lightT = 0; S.fake = 0; emit('sleep', { night: true }); }
    else if (night && S.nap) S.nap = false;
    // réveil : seulement en journée. Un stade qui se couche plus tard (évolution pendant le sommeil) ne le tire pas du lit le soir.
    else if (!night && S.asleep && !S.nap && new Date(t).getHours() < FIRST_BED) { S.asleep = false; S.light = true; emit('wake', {}); }
    else if (S.asleep && S.nap && S.energy >= 100) { S.asleep = false; S.nap = false; S.light = true; emit('wake', {}); }

    if (S.asleep) {
      S.energy = clamp(S.energy + (S.light ? 0.1 : 0.21));
      S.hunger = clamp(S.hunger - st.hun * 0.15);
      if (S.light && ++S.lightT === LIGHT_DELAY) mistake('lumière restée allumée');
    } else {
      var grumpy = S.hygiene < 25 || S.hunger < 25 || S.energy <= 0;
      S.hunger = clamp(S.hunger - st.hun);
      S.happy = clamp(S.happy - st.hap * (grumpy ? 1.5 : 1));
      S.energy = clamp(S.energy - st.ene);
      S.hygiene = clamp(S.hygiene - st.hyg - S.poops * 0.25);
      if (--S.poopT <= 0) {
        S.poopT = st.poop;
        if (S.poops < 4) { S.poops++; S.stats.poops++; emit('poop', { n: S.poops }); }
      }
      if (S.poops > 0) { if (++S.dirtyT >= SICK_AFTER_DIRT) fallSick('crottes non nettoyées'); } else S.dirtyT = 0;
      if (S.hygiene <= 0) { if (++S.filthT >= 120) fallSick('manque d\'hygiène'); } else S.filthT = 0;
      if (S.age % 30 === 0 && S.snacks > 0) S.snacks--;
      S.fake = 0;       // plus de caprices ni de discipline : le bouton sert à rugir, pour le plaisir
      // appel réel : jauge vide ou maladie
      if (critical()) {
        if (S.callT < 0) { S.callT = 0; emit('call', { type: callType() }); }
        else if (++S.callT === CALL_DELAY) mistake('appel resté sans réponse');
        else if (S.callT > CALL_DELAY && (S.callT - CALL_DELAY) % NEGLECT_EVERY === 0) mistake('toujours sans réponse');
      } else S.callT = -1;
      if (S.hunger <= 0) { if (++S.starveT >= DEATH_STARVE) return die('faim'); } else S.starveT = 0;
    }
    if (S.sick && ++S.sickT >= DEATH_SICK) return die('maladie');
    if (S.grow >= st.dur) evolve();
  }

  /* Avance le temps. À appeler régulièrement (4 fois par seconde suffit). */
  function tick(now) {
    now = now || Date.now();
    if (S.speed !== 1) S.speed = 1;       // anciennes sauvegardes en ×20 ou ×120 : retour au temps réel
    if (now - S.last > SLOW_TICK) sync();          // long silence : une autre instance a peut-être joué entre-temps
    if (!S.chosen) { S.last = now; S.simT = now; S.acc = 0; return 0; }   // accueil pas terminé : le temps ne démarre qu'à « Faire éclore »
    var dt = now - S.last; S.last = now;
    if (dt < 0) dt = 0;
    var slow = dt > SLOW_TICK, away = dt > AWAY_TICK, n = 0;
    var was = { dead: S.dead, stage: S.stage, calling: attention() }, slowed = false;
    if (away) {                       // page fermée ou en veille : rattrapage muet à vitesse réelle, 7 jours au plus
      dt = Math.min(dt, 7 * 864e5); S.simT = now - dt;
      if (dt > 36e5 && S.speed !== 1) { S.speed = 1; slowed = true; }     // l'accélération ne survit pas à une longue absence
      silent = true; awayLines = [];
    }
    // tick ralenti (onglet en arrière-plan : un réveil par minute) : vitesse réelle aussi, mais avec ses événements
    S.acc += slow ? dt : dt * S.speed;
    while (S.acc >= 60000) { S.acc -= 60000; S.simT += 60000; minute(S.simT); n++; }
    if (S.speed === 1 && Math.abs(S.simT - now) > 90000) S.simT = now;
    if (away) {
      silent = false;
      // les grands moments avalés par le rattrapage sont rejoués : adieu, naissance ou évolution, puis appel en cours
      if (!was.dead && S.dead) emit('die', { cause: S.deathCause });
      else if (S.stage !== was.stage) emit(was.stage === 0 && S.stage === 1 ? 'hatch' : 'evolve', { from: was.stage, to: S.stage, form: S.form });
      if (!S.dead && !was.calling && attention()) emit('call', { type: callType() });
      if (n >= 5 || awayLines.length) emit('away', { minutes: n, lines: awayLines.slice().reverse(), dead: S.dead, grew: S.stage !== was.stage, slowed: slowed });
      awayLines = [];
    }
    if (n) { save(); emit('change', { minutes: n }); }
    return n;
  }

  /* ---------- actions du joueur : renvoient { ok, reason?, ... } ---------- */
  var no = function (reason) { return { ok: false, reason: reason }; };
  function done(r) { save(); emit('change', {}); return r; }
  function blocked() {
    if (S.dead) return 'Il n\'est plus là…';
    if (S.stage === 0) return 'Il faut d\'abord qu\'il sorte de l\'œuf';
    return '';
  }
  function feed(id) {
    var f = null; FOODS.forEach(function (x) { if (x.id === id) f = x; });
    var b = blocked(); if (b) return no(b);
    if (!f) return no('Plat inconnu');
    if (S.asleep) return no('Chut… il dort');
    if (S.sick) return no('Il est malade, il refuse de manger');
    if (f.type === 'repas' && S.hunger >= 95) return no('Il n\'a plus faim');
    S.hunger = clamp(S.hunger + f.hun); S.happy = clamp(S.happy + f.hap); S.weight = Math.min(MAX_WEIGHT, S.weight + f.w);
    if (S.hunger > 0) S.starveT = 0;
    if (f.type === 'repas') S.stats.meals++;
    else { S.stats.snacks++; if (++S.snacks >= 5) { S.snacks = 2; fallSick('trop de friandises'); } }
    emit('fed', { food: f });
    return done({ ok: true, food: f });
  }
  function canPlay() {
    var b = blocked(); if (b) return no(b);
    if (S.asleep) return no('Chut… il dort');
    if (S.sick) return no('Il est trop malade pour jouer');
    if (S.energy < 8 && S.stage >= 2) return no('Il est trop fatigué pour jouer');
    return { ok: true };
  }
  function playResult(res) {
    res = res || {};
    if (S.dead || S.stage === 0) return no('');
    var w0 = S.weight, e0 = S.energy, h0 = S.happy;
    S.stats.games++; if (res.win) S.stats.wins++;
    S.happy = clamp(S.happy + (res.win ? 28 : 12));
    S.weight = Math.max(stage().w, S.weight - 1);
    S.energy = clamp(S.energy - 4); S.hunger = clamp(S.hunger - 3);
    emit('played', res);
    // ce que la partie a réellement changé (au poids plancher du stade, rien n'est perdu)
    return done({ ok: true, win: !!res.win, gain: Math.round(S.happy - h0), lost: w0 - S.weight, tired: Math.round(e0 - S.energy) });
  }
  function toggleLight() {
    var b = blocked(); if (b) return no(b);
    if (S.light) {
      if (!S.asleep) {
        if (S.stage < 2) return no('Un bébé ne fait pas de sieste');
        if (S.energy >= 70) return no('Il n\'a pas sommeil');
        S.asleep = true; S.nap = !isSleepTime(); S.fake = 0; S.light = false; S.lightT = 0;
        emit('sleep', { night: !S.nap });
        return done({ ok: true, light: false, asleep: true });
      }
      S.light = false; S.lightT = 0;
      return done({ ok: true, light: false, asleep: true });
    }
    S.light = true; S.lightT = 0;
    if (S.asleep && S.nap) { S.asleep = false; S.nap = false; emit('wake', {}); }
    return done({ ok: true, light: true, asleep: S.asleep });
  }
  function cleanPoop() {
    if (S.dead || S.poops <= 0) return no('Rien à nettoyer');
    S.poops--; S.hygiene = clamp(S.hygiene + 4); emit('cleaned', {});
    if (S.poops === 0) S.dirtyT = 0;
    return done({ ok: true, left: S.poops });
  }
  function wash(amount) {
    var b = blocked(); if (b) return no(b);
    if (S.asleep) return no('Chut… il dort');
    var before = S.hygiene;
    S.hygiene = clamp(S.hygiene + (amount || 5));
    var full = S.hygiene >= 100 && before < 100;
    if (full) { S.stats.washes++; S.happy = clamp(S.happy + 5); S.filthT = 0; emit('washed', {}); }
    return done({ ok: true, hygiene: S.hygiene, full: full });
  }
  function medicine() {
    var b = blocked(); if (b) return no(b);
    if (!S.sick) return no('Il n\'est pas malade');
    S.stats.meds++;
    if (--S.doses <= 0) {
      S.sick = false; S.sickT = 0; S.doses = 0;
      S.dirtyT = 0; S.filthT = 0;       // sinon il retombe malade dans la minute : 3 h (crottes) ou 2 h (saleté) pour nettoyer
      log(S.name + ' est guéri'); emit('cured', {});
      return done({ ok: true, cured: true });
    }
    return done({ ok: true, cured: false, msg: 'Encore une dose' });
  }
  /* Rugir : juste pour s'amuser. Un tout petit plus d'humeur, au plus toutes les 10 secondes. */
  function roar() {
    var b = blocked(); if (b) return no(b);
    if (S.asleep) return no('Chut… il dort');
    emit('roar', {}); S.stats.scolds++;     // compteur de rugissements (ancien nom gardé pour les sauvegardes)
    var now = Date.now(), gain = 0;
    if (!(now - S.roarAt < 10000 && now >= S.roarAt)) { S.roarAt = now; gain = 1; S.happy = clamp(S.happy + gain); }
    return done({ ok: true, gain: gain, stage: S.stage });
  }
  function pet() {
    if (S.dead || S.stage === 0 || S.asleep) return no('');
    var now = Date.now();
    if (now >= S.petAt && now - S.petAt < 4000) return { ok: true, gain: 0 };   // un horodatage dans le futur (horloge reculée) ne bloque rien
    S.petAt = now; S.stats.pets++; emit('pet', {});
    S.happy = clamp(S.happy + 1.5);
    return done({ ok: true, gain: 1.5 });
  }
  function tapEgg() {
    if (S.dead || S.stage !== 0) return no('');
    S.eggTaps++;
    if (S.eggTaps >= EGG_TAPS) { evolve(); return done({ ok: true, hatched: true, crack: 3 }); }
    return done({ ok: true, hatched: false, crack: eggCrack() });
  }
  function rename(n) {
    n = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14);
    if (!n) return no('Nom vide');
    S.name = n; return done({ ok: true, name: n });
  }
  function setSkin(i) {
    if (!(i >= 0 && i < MT.SKINS.length)) return no('Look inconnu');
    S.skin = i; emit('skin', { skin: i }); return done({ ok: true });
  }
  function setSpeed(n) {
    S.speed = 1;                          // une seule vitesse pour tout le monde : le temps réel
    if (S.speed === 1) S.simT = Date.now();
    return done({ ok: true, speed: S.speed });
  }
  function setOpt(k, v) {
    if (['mute', 'haptics', 'notif', 'chosen'].indexOf(k) < 0) return no('Option inconnue');
    if (k === 'chosen' && v && !S.chosen) { S.born = S.last = S.simT = Date.now(); S.acc = 0; }   // la vie de l'œuf commence maintenant
    S[k] = !!v; return done({ ok: true });
  }
  /* Nouvel œuf : garde le look, les réglages de l'appareil et le souvenir des anciens monstres. Le temps repart à ×1. */
  function newEgg(skin, name) {
    var o = S;
    S = fresh(skin == null ? o.skin : skin, name || o.name);
    S.chosen = o.chosen; S.rev = o.rev; keepPrefs(o); S.hall = o.hall || [];
    api.S = S; save(); emit('newegg', {}); emit('change', {});
    return { ok: true };
  }
  /* Remise à zéro : tout est effacé sauf les réglages de l'appareil (sons, vibrations, notifications). */
  function wipe() {
    var o = S;
    S = fresh(); S.rev = o.rev; keepPrefs(o); emit('wiped', {});
    api.S = S; save(); emit('newegg', {}); emit('change', {});
  }

  var api = MT.core = {
    isDemo: function () { return noSave; },
    S: null, STAGES: STAGES, FOODS: FOODS, FORMS: FORMS, CALL_DELAY: CALL_DELAY, EGG_TAPS: EGG_TAPS, TITAN_MAX_MISTAKES: TITAN_MAX_MISTAKES,
    KEY: KEY, load: load, save: save, sync: sync, demo: demo, tick: tick, on: on,
    needs: needs, attention: attention, mood: mood, critical: critical, isNight: isNight, isSleepTime: isSleepTime,
    eggCrack: eggCrack, ageDays: ageDays, ageText: ageText, stageName: stageName, growth: growth,
    skin: function () { return MT.SKINS[S.skin]; },
    clock: function () { return new Date(S.simT); },
    feed: feed, canPlay: canPlay, playResult: playResult, toggleLight: toggleLight, cleanPoop: cleanPoop, wash: wash,
    medicine: medicine, roar: roar, pet: pet, tapEgg: tapEgg, rename: rename, setSkin: setSkin, setSpeed: setSpeed,
    setOpt: setOpt, newEgg: newEgg, wipe: wipe,
    /* Aides de test (console) : MT.core.debug.advance(600), MT.core.debug.set({stage:4, form:'titan'}) */
    debug: {
      advance: function (min) { silent = true; for (var i = 0; i < min; i++) { S.simT += 60000; minute(S.simT); } silent = false; save(); emit('change', {}); return S; },
      set: function (o) { for (var k in o) S[k] = o[k]; save(); emit('change', {}); return S; },
      minute: function () { S.simT += 60000; minute(S.simT); emit('change', {}); return S; }
    }
  };
})();
