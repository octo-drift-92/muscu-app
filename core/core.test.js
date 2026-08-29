#!/usr/bin/env node
/* Tests du noyau pur — aucune dépendance, aucun navigateur.
 *
 *   node core/core.test.js
 *
 * Chaque bloc correspond à quelque chose qui s'est déjà cassé une fois, ou à
 * une invariance sur laquelle repose le reste de l'app. Ce n'est pas une suite
 * exhaustive : c'est un filet sous les fonctions qui, quand elles se trompent,
 * se trompent en silence.
 */
const fs = require('fs');
const path = require('path');
const C = require('./core.js');

let ok = 0, ko = 0;
function verifie(titre, condition, detail) {
  if (condition) { ok++; return; }
  ko++;
  console.log('  ÉCHEC  ' + titre + (detail ? '\n         ' + detail : ''));
}
function egal(titre, obtenu, attendu) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  verifie(titre, a === b, 'obtenu   ' + a + '\n         attendu  ' + b);
}
function bloc(nom) { console.log('\n' + nom); }

/* ---------------------------------------------------------------- *
 * 1. Caractères de contrôle
 *    Un « \b » écrit dans une chaîne de patch s'est déjà transformé en
 *    caractère 8 à l'intérieur d'une expression régulière. Le fichier restait
 *    syntaxiquement valide : node --check passait, et le T-bar retombait
 *    silencieusement sur une pondération de préhension erronée.
 * ---------------------------------------------------------------- */
bloc('Caractères de contrôle');
{
  const src = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
  let trouves = [];
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) trouves.push(c + '@' + i);
  }
  verifie('core.js ne contient aucun caractère de contrôle', trouves.length === 0, trouves.join(' '));
}

/* ---------------------------------------------------------------- *
 * 2. Taxonomie musculaire
 * ---------------------------------------------------------------- */
bloc('muscleContribs — pondérations');
egal('T-bar : préhension à 0,5 (barre, pas machine) — la régression de v94',
  (C.muscleContribs('Rowing T-bar prise large') || []).filter(c => c.g === 'Avant-bras'),
  [{ g: 'Avant-bras', w: 0.5 }]);
egal('tirage sur machine : préhension à 0,25',
  (C.muscleContribs('Lat pulldown') || []).filter(c => c.g === 'Avant-bras'),
  [{ g: 'Avant-bras', w: 0.25 }]);
egal('curl marteau : 0,5 par sa clause propre',
  (C.muscleContribs('Curl marteau') || []).filter(c => c.g === 'Avant-bras'),
  [{ g: 'Avant-bras', w: 0.5 }]);
// Choix assumé : le crédit avant-bras par la préhension vaut pour les TIRAGES,
// pas pour les curls classiques, où l'avant-bras ne tient rien de plus que la
// charge que le biceps déplace déjà.
egal('un curl classique ne crédite pas les avant-bras',
  (C.muscleContribs('Curl biceps haltères') || []).filter(c => c.g === 'Avant-bras'), []);
verifie('lat pulldown cible le grand dorsal en direct',
  (C.muscleContribs('Lat pulldown') || []).some(c => c.g === 'Grand dorsal' && c.w >= 1));
verifie('pec deck cible les pectoraux en direct',
  (C.muscleContribs('Pec deck machine') || []).some(c => c.g === 'Pectoraux' && c.w >= 1));
verifie('les abducteurs comptent pour les fessiers',
  (C.muscleContribs('Abduction machine') || []).some(c => c.g === 'Fessiers'));
verifie('l\'adduction a bien son propre groupe',
  (C.muscleContribs('Adduction machine') || []).some(c => c.g === 'Adducteurs'));

bloc('muscleContribs — invariants');
{
  // Un groupe mal orthographié n'apparaîtrait jamais dans la vue Volume :
  // il serait simplement ignoré, sans erreur.
  const connus = new Set(C.MUSCLE_GROUPS);
  const NOMS = ['Rowing T-bar prise large', 'Lat pulldown', 'Pec deck machine', 'Leg Press à chariot',
    'Chest Press assis à charge guidée', 'Face pull poulie basse', 'Leg Curl assis', 'Leg Extension',
    'Élévations latérales poulie unilatérales', 'Extension triceps à la poulie haute (corde)',
    'Soulevé de terre roumain', 'Machine mollets', 'Adduction machine', 'Abduction machine',
    'Preacher curl haltères', 'Skull crushers', 'Crunch à la poulie haute', 'Développé couché haltères',
    'Traction pronation', 'Rowing machine prise neutre unilatéral', 'Curl marteau', 'Kickback haltères'];
  const inconnus = [];
  NOMS.forEach(n => (C.muscleContribs(n) || []).forEach(c => { if (!connus.has(c.g)) inconnus.push(n + ' -> ' + c.g); }));
  verifie('tout groupe renvoyé existe dans MUSCLE_GROUPS', inconnus.length === 0, inconnus.join('\n         '));

  const horsBorne = [];
  NOMS.forEach(n => (C.muscleContribs(n) || []).forEach(c => { if (!(c.w > 0 && c.w <= 1)) horsBorne.push(n + ' -> ' + c.g + ' = ' + c.w); }));
  verifie('toute pondération est dans ]0 ; 1]', horsBorne.length === 0, horsBorne.join('\n         '));

  verifie('chaque groupe a une couleur', C.MUSCLE_GROUPS.every(g => !!C.GROUP_COLORS[g]),
    C.MUSCLE_GROUPS.filter(g => !C.GROUP_COLORS[g]).join(' '));
}

bloc('muscleContribs — lecture des attributs');
{
  // La prise pilote le recrutement : un rowing prise large ne recrute pas comme un
  // rowing prise neutre. Quand la prise sort du NOM pour aller dans un CHAMP, la
  // taxonomie doit continuer de la voir — sans quoi migrer un nom change
  // silencieusement le volume par groupe. Vérifié avant l'écriture, en v122.
  var EQUIV = [
    ['Rowing T-bar prise large', 'Rowing T-bar', 'Disques · Large'],
    ['Rowing assis à disques unilatéral (prise neutre)', 'Rowing assis unilatéral', 'Disques · Neutre'],
    ['Rowing machine prise haute', 'Rowing machine', 'Sélecteur · Haute'],
    ['Rowing machine prise neutre', 'Rowing machine', 'Sélecteur · Neutre'],
    ['Élévations latérales haltères', 'Élévations latérales', 'Haltères'],
    ['Preacher curl haltères', 'Preacher curl', 'Haltères'],
  ];
  EQUIV.forEach(function (t) {
    egal('« ' + t[1] + ' » + {' + t[2] + '} recrute comme « ' + t[0] + ' »',
      C.muscleContribs(t[1], t[2]), C.muscleContribs(t[0]));
  });

  // La préhension suit la charge : engin libre 0,5, poulie et sélecteur 0,25.
  egal('charge Haltères donne 0,5 de préhension',
    (C.muscleContribs('Rowing machine', 'Haltères') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.5 }]);
  egal('charge Poulie donne 0,25',
    (C.muscleContribs('Rowing machine', 'Poulie') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.25 }]);

  // La charge fait autorité, y compris contre le nom : un nom contenant « poulie »
  // avec une charge « Barre » compte 0,5, parce que c'est bien la main qui tient.
  egal('charge Disques donne 0,5',
    (C.muscleContribs('Rowing machine', 'Disques') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.5 }]);
  egal('charge Sélecteur donne 0,25',
    (C.muscleContribs('Rowing machine', 'Sélecteur') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.25 }]);
  egal('charge Poids du corps donne 0,5',
    (C.muscleContribs('Traction', 'Poids du corps') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.5 }]);
  egal('le champ l emporte sur le nom : « poulie » + charge Barre = 0,5',
    (C.muscleContribs('Rowing poulie basse', 'Barre') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.5 }]);
  egal('sans champ, « poulie basse » reste à 0,25',
    (C.muscleContribs('Rowing poulie basse', '') || []).filter(function (c) { return c.g === 'Avant-bras'; }),
    [{ g: 'Avant-bras', w: 0.25 }]);

  // NON-RÉGRESSION : sans attribut, rien ne bouge.
  ['Lat pulldown', 'Pec deck machine', 'Soulevé de terre', 'Curl marteau', 'Leg Extension',
   'Rowing T-bar prise large', 'Développé incliné haltères'].forEach(function (n) {
    egal('sans attribut, « ' + n + ' » est inchangé', C.muscleContribs(n, ''), C.muscleContribs(n));
    egal('attribut absent, « ' + n + ' » est inchangé', C.muscleContribs(n), C.muscleContribs(n, undefined));
  });
}

bloc('isWarmup / isUnilateral');
verifie('un échauffement est reconnu', C.isWarmup('Échauffement rotation externe poulie') === true);
verifie('un exercice normal ne l\'est pas', C.isWarmup('Lat pulldown') === false);
verifie('unilatéral reconnu', C.isUnilateral('Élévations latérales poulie unilatérales') === true);
verifie('bilatéral non signalé', C.isUnilateral('Lat pulldown') === false);

/* ---------------------------------------------------------------- *
 * 3. Matériel — l'aller-retour garantit qu'aucune clé d'historique ne bouge
 *    quand le découpage évolue. C'est ce qui a permis d'ajouter le poste en
 *    v106 sans casser 40 séances.
 * ---------------------------------------------------------------- */
bloc('equipParts / equipJoin');
{
  const REELS = ['', 'Basic Fit', 'Basic Fit · Matrix', 'Fitness Park', 'Fitness Park · Gym80',
    'Fitness Park · Hammer Strength', 'Fitness Park · Technogym', "Gold's Gym", "Gold's Gym · Gym80",
    'Maison', "Gold's Gym · Gym80 · poulie fenêtre", "Gold's Gym · poulie du fond",
    'Salle inconnue · truc bizarre'];
  REELS.forEach(v => {
    const p = C.equipParts(v);
    egal('aller-retour : ' + (v || '(vide)'), C.equipJoin(p.gym, p.brand, p.poste), v.trim());
  });
  egal('salle reconnue', C.equipParts("Gold's Gym · Gym80 · poulie fenêtre").gym, "Gold's Gym");
  egal('marque reconnue', C.equipParts("Gold's Gym · Gym80 · poulie fenêtre").brand, 'Gym80');
  egal('poste reconnu', C.equipParts("Gold's Gym · Gym80 · poulie fenêtre").poste, 'poulie fenêtre');
  egal('rien de connu : le 1er segment est la salle', C.equipParts('Ma salle · un poste').gym, 'Ma salle');
}

bloc('exKey / keyName / keyEquip');
{
  // keyName et keyEquip ont longtemps existé en DEUX versions différentes, la
  // plus basse gagnant silencieusement. Une seule subsiste ; l'aller-retour la
  // verrouille.
  [['Lat pulldown', "Gold's Gym · Gym80"], ['Squat', ''], ['Curl', 'Maison'],
   ['Rowing T-bar prise large', "Gold's Gym · Gym80 · poulie fenêtre"]].forEach(([nom, eq]) => {
    const k = C.exKey({ name: nom, equip: eq });
    egal('nom retrouvé : ' + nom, C.keyName(k), nom);
    egal('matériel retrouvé : ' + (eq || '(vide)'), C.keyEquip(k), eq);
  });
  egal('sans matériel, la clé est le nom seul', C.exKey({ name: 'Squat', equip: '' }), 'Squat');
  egal('exKey tolère l\'absence d\'objet', C.exKey(null), '');
}

bloc('Attributs : charge, prise, inclinaison');
{
  // Ces trois notions vivaient dans le NOM (« prise neutre », « à disques »).
  // Sorties en champs, elles entrent dans la clé entre accolades — un délimiteur
  // distinct des crochets du matériel, pour que le découpage reste sans ambiguïté.
  egal('ordre fixe : charge · prise · inclinaison',
    C.exAttrs({ charge:'Disques', prise:'Neutre', incl:'45°' }), 'Disques · Neutre · 45°');
  egal('les champs vides sautent', C.exAttrs({ prise:'Neutre' }), 'Neutre');
  egal('aucun attribut', C.exAttrs({}), '');
  egal('objet absent toléré', C.exAttrs(null), '');

  var k = C.exKey({ name:'Rowing assis', equip:"Gold's Gym · Gym80", charge:'Disques', prise:'Neutre' });
  egal('clé complète', k, "Rowing assis [Gold's Gym · Gym80] {Disques · Neutre}");
  egal('nom retrouvé', C.keyName(k), 'Rowing assis');
  egal('matériel retrouvé', C.keyEquip(k), "Gold's Gym · Gym80");
  egal('attributs retrouvés', C.keyAttrs(k), 'Disques · Neutre');

  // COMPATIBILITÉ : une clé sans attribut doit rester identique à l'ancienne
  // écriture, sans quoi 40 semaines d'historique se détacheraient.
  egal('sans attribut, la clé ne change pas',
    C.exKey({ name:'Lat pulldown', equip:"Gold's Gym · Gym80" }), "Lat pulldown [Gold's Gym · Gym80]");
  egal('ancienne clé : nom', C.keyName("Lat pulldown [Gold's Gym · Gym80]"), 'Lat pulldown');
  egal('ancienne clé : matériel', C.keyEquip("Lat pulldown [Gold's Gym · Gym80]"), "Gold's Gym · Gym80");
  egal('ancienne clé : aucun attribut', C.keyAttrs("Lat pulldown [Gold's Gym · Gym80]"), '');

  egal('attributs sans matériel', C.exKey({ name:'Traction', charge:'Poids du corps' }), 'Traction {Poids du corps}');
  egal('nom seul quand tout est vide', C.exKey({ name:'Squat' }), 'Squat');
  verifie('les trois listes d options existent',
    C.CHARGE_OPTS.length>0 && C.PRISE_OPTS.length>0 && C.INCL_OPTS.length>0);
}

/* ---------------------------------------------------------------- *
 * 4. Calculs
 * ---------------------------------------------------------------- */
bloc('e1rm');
egal('1 répétition = la charge', C.e1rm(100, 1), 100);
egal('formule Epley à 10 reps, arrondie à l entier', C.e1rm(100, 10), 133);
egal('Epley : 80 kg x 12', C.e1rm(80, 12), 112);
egal('charge nulle', C.e1rm(0, 10), 0);
egal('reps nulles', C.e1rm(60, 0), 0);

bloc('exSkipped');
verifie('non marqué : pas passé', C.exSkipped({ sets: [{ done: false }] }) === false);
verifie('marqué et rien de fait : passé', C.exSkipped({ skipped: true, sets: [{ done: false }] }) === true);
verifie('marqué MAIS une série faite : pas passé (garde-fou)',
  C.exSkipped({ skipped: true, sets: [{ done: true }] }) === false);
verifie('objet absent toléré', C.exSkipped(null) === false);

bloc('estSerie / sessionEstBrut');
egal('3 séries de 10 reps', C.estSerie([{ planReps: 10 }, { planReps: 10 }, { planReps: 10 }]),
  3 * (10 * C.EST_REP + C.EST_INSTALL));
{
  const jour = { exercises: [{ name: 'Lat pulldown', sets: [{ planReps: 10 }, { planReps: 10 }] }], cardio: [] };
  const e = C.sessionEstBrut(jour, 120);
  egal('2 séries comptées', e.sets, 2);
  egal('1 exercice compté', e.exos, 1);
  egal('le repos passé est bien celui utilisé', e.rest, 120);
  verifie('la durée croît avec le repos',
    C.sessionEstBrut(jour, 180).min > C.sessionEstBrut(jour, 60).min);

  const passe = { exercises: [{ name: 'Lat pulldown', skipped: true, sets: [{ planReps: 10 }] }], cardio: [] };
  egal('un exercice passé ne compte pas', C.sessionEstBrut(passe, 120), null);

  const uni = { exercises: [{ name: 'Élévations latérales poulie unilatérales', sets: [{ planReps: 10 }] }], cardio: [] };
  const bi = { exercises: [{ name: 'Élévations latérales haltères', sets: [{ planReps: 10 }] }], cardio: [] };
  verifie('un unilatéral dure plus longtemps qu\'un bilatéral à séries égales',
    C.sessionEstBrut(uni, 120).min > C.sessionEstBrut(bi, 120).min);
  egal('unilatéral signalé', C.sessionEstBrut(uni, 120).uni, 1);

  const ech = { exercises: [{ name: 'Échauffement rotation externe poulie', sets: [{ planReps: 15 }] }], cardio: [] };
  egal('un échauffement ne génère pas d\'échauffement', C.sessionEstBrut(ech, 120).echauf, 0);
}

/* ---------------------------------------------------------------- */
bloc('rirSerie / rirPlage');
{
  const S = n => Array.from({ length: n }, () => ({}));

  egal('cible 1, série 1', C.rirSerie(1, 0, {}), 1);
  egal('cible 1, série 2', C.rirSerie(1, 1, {}), 2);
  egal('cible 1, série 3', C.rirSerie(1, 2, {}), 3);
  egal('cible 1, série 4 : le relâchement plafonne à +2', C.rirSerie(1, 3, {}), 3);
  egal('cible 1, série 8 : toujours +2', C.rirSerie(1, 7, {}), 3);

  egal('cible 0 (échec) monte à 2', C.rirSerie(0, 3, {}), 2);
  egal('décharge à 4 reste à 4', C.rirSerie(4, 3, {}), 4);
  egal('cible 3 plafonne à 4', C.rirSerie(3, 3, {}), 4);

  egal('une valeur posée sur la série prime', C.rirSerie(1, 3, { rir: 0 }), 0);
  egal('rir 0 sur la série n est pas confondu avec absent', C.rirSerie(1, 0, { rir: 0 }), 0);
  egal('sans cible de semaine, pas de RIR', C.rirSerie(null, 2, {}), null);
  egal('cible non numérique ignorée', C.rirSerie('abc', 1, {}), null);

  egal('plage sur 4 séries', C.rirPlage(1, S(4)), '1\u21923');
  egal('plage sur 1 série', C.rirPlage(1, S(1)), '1');
  egal('plage en décharge : constante', C.rirPlage(4, S(4)), '4');
  egal('plage sans séries', C.rirPlage(2, []), '2');
  egal('plage sans cible', C.rirPlage(null, S(3)), '');
}

/* ---------------------------------------------------------------- */
console.log('\n' + (ko ? '✘ ' + ko + ' échec(s) sur ' + (ok + ko) + ' vérifications'
                       : '✔ ' + ok + ' vérifications passées'));
process.exit(ko ? 1 : 0);
