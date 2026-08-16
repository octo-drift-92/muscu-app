#!/usr/bin/env node
/* Réinjecte core/core.js dans le fichier unique de l'app.
 *
 *   node build.js                  -> écrit dans la copie de travail
 *   node build.js <chemin.html>    -> écrit dans le fichier indiqué
 *   node build.js --verifier       -> ne écrit rien, sort en 1 si le bloc a dérivé
 *
 * L'app reste un fichier unique, sans dépendance et sans étape obligatoire :
 * seul le bloc entre les marqueurs NOYAU est généré. Tout le reste du HTML
 * s'édite directement comme avant.
 */
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const CORE = path.join(RACINE, 'core', 'core.js');
const DEFAUT = 'C:/Users/vince/OneDrive/1. Personnel/Musculation/suivi-musculation.html';

const VERIF = process.argv.indexOf('--verifier') >= 0;
const cible = process.argv.slice(2).filter(a => a !== '--verifier')[0] || DEFAUT;

const DEBUT = '/* ==== NOYAU : DEBUT';
const FIN = '/* ==== NOYAU : FIN ==== */';

function echec(m) { console.error('ECHEC : ' + m); process.exit(1); }

let core = fs.readFileSync(CORE, 'utf8');

// le garde d'export ne part pas dans le navigateur : il n'y a rien à y exporter
const iGarde = core.indexOf('/* ==== EXPORTS (tests hors navigateur) ==== */');
if (iGarde < 0) echec('core/core.js : le bloc EXPORTS est introuvable');
core = core.slice(0, iGarde).replace(/\s+$/, '');

// aucun caractère de contrôle : c'est exactement ainsi qu'un \b s'est déjà
// transformé en caractère 8 dans une expression régulière, sans que rien ne le signale
for (let i = 0; i < core.length; i++) {
  const c = core.charCodeAt(i);
  if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
    echec('caractère de contrôle ' + c + ' dans core/core.js à l\'offset ' + i);
  }
}

// le noyau vit dans une IIFE indentée de deux espaces
const indente = core.split('\n').map(l => (l.trim() ? '  ' + l : l)).join('\n');

let html = fs.readFileSync(cible, 'utf8');
const a = html.indexOf(DEBUT);
const b = html.indexOf(FIN);
if (a < 0 || b < 0 || b < a) echec('marqueurs NOYAU introuvables dans ' + cible);

const finEntete = html.indexOf('*/', a) + 2;
const avant = html.slice(0, finEntete);
const apres = html.slice(b);
const actuel = html.slice(finEntete, b);
const neuf = '\n' + indente + '\n  ';

if (actuel === neuf) {
  console.log('déjà à jour — ' + path.basename(cible));
  process.exit(0);
}
if (VERIF) {
  echec('le bloc NOYAU de ' + path.basename(cible) + ' a dérivé de core/core.js. Lancer « node build.js ».');
}

fs.writeFileSync(cible, avant + neuf + apres);
console.log('noyau réinjecté (' + core.length + ' octets) -> ' + cible);
