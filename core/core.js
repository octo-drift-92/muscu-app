/* Increm — noyau pur.
 *
 * Ces fonctions ne lisent aucun etat et ne touchent pas au DOM : meme entree,
 * meme sortie, toujours. C'est ce qui les rend testables hors navigateur, et
 * c'est la seule raison d'etre de ce fichier separe.
 *
 * Ce fichier est la SOURCE. « node build.js » le reinjecte entre les marqueurs
 * NOYAU de suivi-musculation.html ; ne pas editer le bloc dans le HTML.
 * « node core/core.test.js » verifie le tout.
 */

// Identite d'un exercice pour l'HISTORIQUE : nom + materiel/marque.
// Deux machines differentes ne se comparent pas -> courbes, records et
// "Derniere fois" sont separes automatiquement quand le materiel differe.
var EQUIP_PRESETS=['Basic Fit','Fitness Park',"Gold's Gym",'Maison'];                           // salles

// Trois attributs qui changent l exercice sans changer la machine. Ils etaient
// jusqu ici ecrits dans le NOM (« prise neutre », « a disques », « banc incline
// 45 degres ») : les sortir en champs rend l ecriture coherente et la cle stable.
var CHARGE_OPTS=['Disques','Sélecteur','Haltères','Barre','Poulie','Poids du corps'];
var PRISE_OPTS=['Pronation','Supination','Neutre','Marteau','Large','Serrée','Haute'];
var INCL_OPTS=['Plat','15°','30°','45°','60°','Décliné'];
var EQUIP_BRANDS=['Technogym','Matrix','Life Fitness','Hammer Strength','Precor','Panatta','Gym80'];  // marques de machines

/* ---------- analyses : groupe musculaire, dernière séance, plateaux ---------- */
var MUSCLE_GROUPS=['Pectoraux','Grand dorsal','Milieu du dos','Trapèzes','Deltoïde ant.','Deltoïde lat.','Deltoïde post.','Biceps','Triceps','Avant-bras','Quadriceps','Ischios','Fessiers','Adducteurs','Mollets','Abdos','Lombaires'];

var GROUP_COLORS={'Pectoraux':'#ef6f6c','Grand dorsal':'#4f86c6','Milieu du dos':'#6f9fd8','Deltoïde ant.':'#e8973a','Deltoïde lat.':'#f0b54e','Deltoïde post.':'#cf7d2e','Biceps':'#9b6dd6','Triceps':'#19b8aa','Quadriceps':'#3fa869','Ischios':'#7cc24a','Fessiers':'#e070a8','Adducteurs':'#b5738a','Mollets':'#b08152','Abdos':'#e6c64a','Lombaires':'#8090a6','Trapèzes':'#3fb1ca','Avant-bras':'#9aa3ad','Autre':'#8090a6'};

// Estimation de duree d une seance. Constantes assumees, documentees dans l aide :
// 40 s de travail par serie · repos = repos cible reglable · 65 s par serie d echauffement
// (20 s d effort + 45 s de repos court) · 90 s par changement de machine (trouver, regler, charger).
var EST_REP=3.5, EST_INSTALL=15, EST_ECHAUF=65, EST_CHANGT=90, EST_COTE=20;

function isWarmup(name){ return /echauffement|warm-?up|mobilit|activation|etirement|stretch/.test((name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')); }

// exercices unilateraux : suivi par cote. Une serie = G + D (le comptage du volume ne change pas)
function isUnilateral(name){ return /unilat|1 bras|un bras|une jambe|alterne/i.test(name||''); }

// 2e parametre : la chaine d attributs (« Disques · Neutre · 45° »). Elle est
// concatenee au nom avant normalisation, parce que les valeurs des champs sont
// deja les mots que les motifs cherchent — « Large » -> large, « Neutre » ->
// neutre, « Halteres » -> haltere. Aucune table de correspondance n est donc
// necessaire, et une prise sortie du nom continue de peser sur le recrutement.
function muscleContribs(name, attrs){
  var n=((name||'')+' '+(attrs||'')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  function P(g){ return [{g:g,w:1}]; }
  var ch=String(attrs||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  // Prehension : 0,5 quand on tient la charge (disques, barre, halteres, son propre
  // poids), 0,25 quand une machine la guide (poulie, selecteur). Le CHAMP charge fait
  // autorite ; le nom n est qu un repli pour les exercices qui n en ont pas encore.
  function AB(){
    if(/disque|barre|haltere|poids du corps/.test(ch)) return {g:'Avant-bras', w:.5};
    if(/poulie|selecteur/.test(ch)) return {g:'Avant-bras', w:.25};
    return {g:'Avant-bras', w:(/\bt[\s-]?bar|barre|haltere|disque|poids libres|souleve de terre|deadlift|traction|pull-?up|chin-?up/.test(n) ? .5 : .25)};
  }

  if(/omoplate|scapulaire|retraction scap/.test(n)) return [{g:'Trapèzes',w:1},{g:'Deltoïde post.',w:.5}];
  if(/face.?pull/.test(n)) return [{g:'Deltoïde post.',w:1},{g:'Trapèzes',w:.5}];
  if(/oiseau|reverse fly|l-?fly|rotation ext|coiffe|rotateur|lever lateral|rear delt|reverse pec/.test(n)) return P('Deltoïde post.');
  if(/elevations? laterales?|lateral raise/.test(n)) return P('Deltoïde lat.');
  if(/elevations? frontales?|front raise/.test(n)) return P('Deltoïde ant.');
  if(/elevation/.test(n) && !/jambe|cuisse|mollet|genou|bassin|hanche|hip|pelv|gainage|buste|tronc/.test(n)) return P('Deltoïde lat.');
  if(/leg curl|leg-curl/.test(n)) return P('Ischios');
  if(/jambes tendues|romanian|\brdl\b|souleve de terre roumain|good ?morning/.test(n)) return [{g:'Ischios',w:1},{g:'Fessiers',w:.5},{g:'Lombaires',w:.5},AB()];
  if(/souleve de terre|deadlift|\bsdt\b/.test(n)) return [{g:'Lombaires',w:1},{g:'Fessiers',w:.5},{g:'Ischios',w:.5},{g:'Trapèzes',w:.5},AB()];
  if(/adduction|adducteur/.test(n)) return P('Adducteurs');
  if(/hip thrust|pont fessier|abduction|abducteur|fessier|glute/.test(n)) return P('Fessiers');
  if(/shrug|haussement|trapeze/.test(n)) return [{g:'Trapèzes',w:1},AB()];
  if(/rowing|\brow\b|\bt[\s-]?bar/.test(n)){
    if(/neutre|marteau/.test(n)) return [{g:'Grand dorsal',w:1},{g:'Milieu du dos',w:.5},{g:'Biceps',w:.5},{g:'Deltoïde post.',w:.5},AB()];
    if(/haute|large/.test(n)) return [{g:'Milieu du dos',w:1},{g:'Trapèzes',w:.5},{g:'Deltoïde post.',w:.5},{g:'Biceps',w:.5},AB()];
    return [{g:'Milieu du dos',w:1},{g:'Grand dorsal',w:.5},{g:'Biceps',w:.5},{g:'Deltoïde post.',w:.5},{g:'Trapèzes',w:.5},AB()];
  }
  if(/tirage|traction|pulldown|pull-?up|\blat\b/.test(n)) return [{g:'Grand dorsal',w:1},{g:'Biceps',w:.5},AB()];
  if(/pull-?over/.test(n)) return [{g:'Grand dorsal',w:1},{g:'Pectoraux',w:.5}];
  if(/ecarte|pec deck|butterfly|\bfly\b/.test(n)) return P('Pectoraux');
  if(/developpe couche|developpe incline|chest press|chess press|\bdips?\b|pompe|bench/.test(n)) return [{g:'Pectoraux',w:1},{g:'Triceps',w:.5},{g:'Deltoïde ant.',w:.5}];
  if(/militaire|overhead press|developpe epaule|arnold|shoulder press/.test(n)) return [{g:'Deltoïde ant.',w:1},{g:'Deltoïde lat.',w:.5},{g:'Triceps',w:.5}];
  if(/mollet|calf/.test(n)) return P('Mollets');
  if(/squat|leg press|presse a cuisse|hack|fente|\blunge\b/.test(n)) return [{g:'Quadriceps',w:1},{g:'Fessiers',w:.5}];
  if(/leg extension/.test(n)) return P('Quadriceps');
  if(/triceps|kickback|skull|barre au front/.test(n)) return P('Triceps');
  if(/reverse.*curl|curl.*invers|avant.?bras|forearm|wrist|poignet/.test(n)) return [{g:'Avant-bras',w:1},{g:'Biceps',w:.5}];
  if(/curl marteau|hammer/.test(n)) return [{g:'Biceps',w:1},{g:'Avant-bras',w:0.5}];
  if(/curl|biceps/.test(n)) return P('Biceps');
  if(/gainage|plank|hollow/.test(n)) return [{g:'Abdos',w:1},{g:'Lombaires',w:.5}];
  if(/crunch|abdo|releve de jambe|oblique|sit.?up|ab wheel/.test(n)) return P('Abdos');
  if(/hyperextension|extension lombaire|back extension|superman/.test(n)) return P('Lombaires');
  return P('Autre');
}

// le materiel s'ecrit "Salle · Marque · Poste" : les trois parties se reglent
// independamment. Le poste est un repere visuel libre ("poulie fenetre") : deux
// poulies de meme marque dans la meme salle n ont pas le meme rapport de mouflage,
// donc pas la meme charge reelle a la main. Sans lui, leurs historiques se melangent.
function equipParts(v){
  var p=String(v||'').split('·').map(function(t){return t.trim();}).filter(Boolean);
  var gym='', brand='', poste=[];
  p.forEach(function(t){
    if(!gym && EQUIP_PRESETS.indexOf(t)>=0) gym=t;
    else if(!brand && EQUIP_BRANDS.indexOf(t)>=0) brand=t;
    else poste.push(t);
  });
  if(!gym && !brand && poste.length) gym=poste.shift();   // rien de connu : le 1er segment est la salle
  return { gym:gym, brand:brand, poste:poste.join(' · ') };
}

function equipJoin(gym, brand, poste){ return [gym,brand,poste].filter(Boolean).join(' · '); }

// « Disques · Neutre · 45° » — l ordre est fixe pour que la cle soit stable.
function exAttrs(x){
  if(!x) return '';
  return [x.charge,x.prise,x.incl].map(function(v){ return String(v||'').trim(); }).filter(Boolean).join(' · ');
}
// Identite pour l HISTORIQUE : nom, materiel entre crochets, attributs entre accolades.
// Deux delimiteurs distincts : keyName/keyEquip/keyAttrs savent decouper sans ambiguite.
function exKey(x){
  if(!x) return '';
  var n=(x.name||'').trim(), e=(x.equip||'').trim(), a=exAttrs(x);
  if(!n) return '';
  return n + (e?(' ['+e+']'):'') + (a?(' {'+a+'}'):'');
}

// une cle d'historique vaut "Nom [Materiel]" — on sait en extraire les deux morceaux
// une cle d historique vaut "Nom [Materiel]" — on sait en extraire les deux morceaux
function keyName(k){
  return String(k||'').replace(/\s*\{[^}]*\}\s*$/,'').replace(/\s*\[[^\]]*\]\s*$/,'').trim();
}

function keyEquip(k){
  var m=/\[([^\]]*)\]\s*$/.exec(String(k||'').replace(/\s*\{[^}]*\}\s*$/,''));
  return m?m[1]:'';
}
function keyAttrs(k){ var m=/\{([^}]*)\}\s*$/.exec(String(k||'')); return m?m[1]:''; }

function e1rm(w, reps){ w=+w||0; reps=+reps||0; if(w<=0||reps<=0) return 0; if(reps===1) return Math.round(w); return Math.round(w*(1+reps/30)); }

// Un exercice « passe » : volontairement non realise ce jour-la. Il reste dans la
// prog et dans l'historique, mais ne compte ni dans les series ni dans le volume.
// Le garde-fou « aucune serie validee » evite qu'un drapeau errant (vieille donnee,
// synchro d'un autre appareil) puisse effacer du travail reellement effectue.
function exSkipped(x){ return !!(x && x.skipped && !(x.sets||[]).some(function(s){ return s.done; })); }

function estSerie(sets){ var t=0; (sets||[]).forEach(function(z){ var r=(z.planReps!=null&&z.planReps>0)?z.planReps:10; t+=r*EST_REP+EST_INSTALL; }); return t; }

function sessionEstBrut(day, rest){
  if(!day) return null;
  var exs=(day.exercises||[]).filter(function(x){ return (x.sets||[]).length && !exSkipped(x); });
  var cMin=(day.cardio||[]).reduce(function(a,c){ var m=(c.min!=null&&c.min!=='')?+c.min:0; return a+(m>0?m:0); },0);
  var cardio=(day.cardio||[]).reduce(function(a,c){ var m=(c.min!=null&&c.min!=='')?+c.min:0; return a+(m>0?m*60+60:0); },0);
  if(!exs.length && !cardio) return null;
  var sec=0, nSets=0, nEchauf=0, nUni=0, vus={};
  exs.forEach(function(x,i){
    var n=(x.sets||[]).length; nSets+=n;
    var uni=isUnilateral(x.name); if(uni) nUni+=n;
    sec += estSerie(x.sets)*(uni?2:1) + (uni?n*EST_COTE:0) + Math.max(0,n-1)*rest;
    if(i>0) sec += EST_CHANGT;
    if(isWarmup(x.name)) return;                       // un echauffement ne s echauffe pas
    var c=(muscleContribs(x.name)||[])[0], g=c?c.g:'Autre';
    var e=(i===0)?2:(vus[g]?0:1);                      // 2 series au demarrage, 1 par nouveau groupe
    vus[g]=1; nEchauf+=e; sec += e*EST_ECHAUF;
  });
  sec += cardio;
  return { min:Math.round(sec/60), sets:nSets, exos:exs.length, echauf:nEchauf, cardio:cMin, rest:rest, uni:nUni };
}

/* ==== EXPORTS (tests hors navigateur) ==== */
/* Dans le navigateur, « module » n'existe pas : ce bloc est inerte, et build.js
   le retire de toute facon avant reinjection. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EQUIP_PRESETS, EQUIP_BRANDS, MUSCLE_GROUPS, GROUP_COLORS,
    EST_REP, EST_INSTALL, EST_ECHAUF, EST_CHANGT, EST_COTE,
    isWarmup, isUnilateral, muscleContribs, equipParts, equipJoin,
    CHARGE_OPTS, PRISE_OPTS, INCL_OPTS,
    exKey, exAttrs, keyName, keyEquip, keyAttrs, e1rm, exSkipped, estSerie, sessionEstBrut,
  };
}
