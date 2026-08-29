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
  // v137 : les faisceaux du deltoide ne s isolent pas proprement. L EMG montre une
  // activite substantielle du deltoide MOYEN pendant une elevation frontale, d autant
  // plus marquee en prise neutre (le mouvement se rapproche alors du plan de l omoplate)
  // et a mesure que le bras s eleve. Meme principe qu en v127 sur les rowings : quand
  // deux faisceaux travaillent, aucun ne reste a zero.
  if(/elevations? frontales?|front raise/.test(n)) return [{g:'Deltoïde ant.',w:1},{g:'Deltoïde lat.',w:.5}];
  if(/elevation/.test(n) && !/jambe|cuisse|mollet|genou|bassin|hanche|hip|pelv|gainage|buste|tronc/.test(n)) return P('Deltoïde lat.');
  if(/leg curl|leg-curl/.test(n)) return P('Ischios');
  if(/jambes tendues|romanian|\brdl\b|souleve de terre roumain|good ?morning/.test(n)) return [{g:'Ischios',w:1},{g:'Fessiers',w:.5},{g:'Lombaires',w:.5},AB()];
  if(/souleve de terre|deadlift|\bsdt\b/.test(n)) return [{g:'Lombaires',w:1},{g:'Fessiers',w:.5},{g:'Ischios',w:.5},{g:'Trapèzes',w:.5},AB()];
  if(/adduction|adducteur/.test(n)) return P('Adducteurs');
  if(/hip thrust|pont fessier|abduction|abducteur|fessier|glute/.test(n)) return P('Fessiers');
  if(/shrug|haussement|trapeze/.test(n)) return [{g:'Trapèzes',w:1},AB()];
  if(/rowing|\brow\b|\bt[\s-]?bar/.test(n)){
    // Tout rowing tire ET retracte : les dorsaux comme le milieu du dos sont
    // moteurs, la prise decide seulement lequel domine. Aucun des deux ne
    // tombe a zero. Les trapezes manquaient ici alors que les deux autres
    // branches les comptent — une prise neutre retracte les omoplates autant
    // qu une prise large.
    if(/neutre|marteau/.test(n)) return [{g:'Grand dorsal',w:1},{g:'Milieu du dos',w:1},{g:'Trapèzes',w:.5},{g:'Biceps',w:.5},{g:'Deltoïde post.',w:.5},AB()];
    if(/haute|large/.test(n)) return [{g:'Milieu du dos',w:1},{g:'Grand dorsal',w:.5},{g:'Trapèzes',w:.5},{g:'Deltoïde post.',w:.5},{g:'Biceps',w:.5},AB()];
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
    var c=(muscleContribs(x.name, exAttrs(x))||[])[0], g=c?c.g:'Autre';
    var e=(i===0)?2:(vus[g]?0:1);                      // 2 series au demarrage, 1 par nouveau groupe
    vus[g]=1; nEchauf+=e; sec += e*EST_ECHAUF;
  });
  sec += cardio;
  return { min:Math.round(sec/60), sets:nSets, exos:exs.length, echauf:nEchauf, cardio:cMin, rest:rest, uni:nUni };
}

/* RIR par SERIE. On ne tient pas RIR 1 sur quatre series d affilee : la fatigue
   monte, et exiger la meme proximite de l echec partout produit soit des series
   ratees, soit une premiere serie trop facile. On part de la cible de la semaine
   sur la 1re serie, puis on relache d un cran par serie, plafonne a +2.

     cible 1 -> 1, 2, 3, 3, 3...      cible 0 -> 0, 1, 2, 2...

   Une valeur posee sur la serie elle-meme (s.rir) prime toujours : le calcul
   n est qu un defaut, il n ecrase jamais un choix explicite. */
function rirSerie(base, i, s){
  if(s && s.rir!==undefined && s.rir!==null && s.rir!=='') return +s.rir;
  if(base===undefined || base===null) return null;
  var b=+base; if(isNaN(b)) return null;
  // Plafond a 4 : une decharge visant deja RIR 4 ne doit pas glisser vers 5 ou 6,
  // ou la serie ne stimule plus rien. Elle reste donc constante.
  return Math.min(b + Math.min(i||0, 2), 4);
}

/* La plage affichee pour un exercice : « 1 » si une seule serie, « 1→3 » sinon. */
function rirPlage(base, sets){
  if(base===undefined || base===null) return '';
  var n=(sets||[]).length; if(!n) return String(base);
  var a=rirSerie(base,0,(sets||[])[0]), z=rirSerie(base,n-1,(sets||[])[n-1]);
  if(a===null||z===null) return '';
  return a===z ? String(a) : (a+'→'+z);
}

/* ==== FOURCHETTE DE REPETITIONS ====
   L hypertrophie est sensiblement equivalente d environ 5 a 30 reps tant que la
   serie se termine pres de l echec. La fourchette ne dit donc PAS ou se trouve le
   muscle : elle dit ou la serie est LIVRABLE sur cet exercice-la. Quatre criteres :
     - cout systemique : 20 reps a la presse coupent le souffle avant le quadriceps
     - tenue technique : une elevation laterale lourde devient un haussement d epaule
     - contrainte articulaire : une epaule encaisse mieux 15 reps legeres que 6 lourdes
     - granularite de charge : +5 kg sur une machine a 50, c est +10 % d un coup. Il
       faut une fourchette large pour absorber la marche ; sur 80 kg de disques,
       +2,5 kg ne pese que +3 % et une fourchette etroite suffit.
   L ordre des tests reprend celui de muscleContribs : « leg curl » doit etre vu
   avant « curl », « elevations laterales » avant « elevation ». */
var PLAGE_RAISON={
  lourd:"Gros polyarticulaire : la charge est le levier efficace, une serie longue coute plus en fatigue generale qu elle ne rapporte au muscle.",
  poussee:"Poussee du haut du corps : reps moderees. L epaule encaisse mieux une charge tenue longtemps qu une charge maximale.",
  isolation:"Isolation : assez lourd pour tendre le muscle, assez leger pour tenir la technique jusqu a la derniere rep.",
  petit:"Petit muscle, bras de levier defavorable : au-dela d une charge legere c est le tronc qui prend le relais.",
  court:"Amplitude courte et muscle endurant : les repetitions sont un meilleur levier que la charge, et l articulation ne paie rien."
};
function plageReps(name, attrs){
  var n=((name||'')+' '+(attrs||'')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  function R(min,max,cat){ return {min:min, max:max, cat:cat, raison:PLAGE_RAISON[cat]}; }
  if(isWarmup(name)) return R(10,15,'isolation');
  if(/omoplate|scapulaire|retraction scap/.test(n)) return R(12,20,'petit');
  if(/face.?pull/.test(n)) return R(12,20,'petit');
  if(/oiseau|reverse fly|l-?fly|rotation ext|coiffe|rotateur|lever lateral|rear delt|reverse pec/.test(n)) return R(12,20,'petit');
  if(/elevations? laterales?|lateral raise/.test(n)) return R(12,20,'petit');
  if(/elevations? frontales?|front raise/.test(n)) return R(12,20,'petit');
  if(/elevation/.test(n) && !/jambe|cuisse|mollet|genou|bassin|hanche|hip|pelv|gainage|buste|tronc/.test(n)) return R(12,20,'petit');
  if(/leg curl|leg-curl/.test(n)) return R(10,15,'isolation');
  if(/jambes tendues|romanian|\brdl\b|souleve de terre roumain|good ?morning/.test(n)) return R(8,12,'lourd');
  if(/souleve de terre|deadlift|\bsdt\b/.test(n)) return R(6,10,'lourd');
  if(/adduction|adducteur/.test(n)) return R(12,20,'court');
  if(/hip thrust|pont fessier/.test(n)) return R(8,12,'lourd');
  if(/abduction|abducteur|fessier|glute/.test(n)) return R(12,20,'court');
  if(/shrug|haussement|trapeze/.test(n)) return R(10,15,'isolation');
  if(/rowing|\brow\b|\bt[\s-]?bar/.test(n)) return R(6,10,'lourd');
  if(/tirage|traction|pulldown|pull-?up|\blat\b/.test(n)) return R(6,10,'lourd');
  if(/pull-?over/.test(n)) return R(10,15,'isolation');
  if(/ecarte|pec deck|butterfly|\bfly\b/.test(n)) return R(10,15,'isolation');
  if(/developpe couche|developpe incline|chest press|chess press|\bdips?\b|pompe|bench/.test(n)) return R(8,12,'poussee');
  if(/militaire|overhead press|developpe epaule|arnold|shoulder press/.test(n)) return R(8,12,'poussee');
  if(/mollet|calf/.test(n)) return R(12,20,'court');
  if(/fente|\blunge\b/.test(n)) return R(8,12,'lourd');
  if(/squat|leg press|presse a cuisse|hack/.test(n)) return R(6,10,'lourd');
  if(/leg extension/.test(n)) return R(10,15,'isolation');
  if(/triceps|kickback|skull|barre au front/.test(n)) return R(10,15,'isolation');
  if(/reverse.*curl|curl.*invers|avant.?bras|forearm|wrist|poignet/.test(n)) return R(12,20,'court');
  if(/curl marteau|hammer/.test(n)) return R(10,15,'isolation');
  if(/curl|biceps/.test(n)) return R(10,15,'isolation');
  if(/gainage|plank|hollow/.test(n)) return R(12,20,'court');
  if(/crunch|abdo|releve de jambe|oblique|sit.?up|ab wheel/.test(n)) return R(12,20,'court');
  if(/hyperextension|extension lombaire|back extension|superman/.test(n)) return R(12,20,'court');
  return R(10,15,'isolation');
}

/* ==== SUGGESTION DE PROGRESSION ====
   Double progression classique, mais sans plage de repetitions explicite : on
   compare la derniere seance a ce qui etait PREVU.

     toutes les series tenues  -> on monte la charge d un cran
     la moitie ou plus tenue   -> meme charge, on va chercher les reps manquantes
     moins de la moitie        -> meme charge, on consolide

   Le « cran » n est pas une constante : on le DEDUIT de son propre historique
   sur cet exercice. Quelqu un qui est passe de 25 a 35 kg au T-bar progresse par
   5 ; quelqu un passe de 8 a 10 aux halteres progresse par 2. A defaut d ecart
   observable, on retombe sur un pas par type de charge. */
function pasCharge(sessions, charge){
  var poids=[];
  (sessions||[]).forEach(function(s){
    var m=0; (s.sets||[]).forEach(function(x){ var w=+x.w; if(w>m) m=w; });
    if(m>0) poids.push(m);
  });
  var uniq=poids.filter(function(v,i){ return poids.indexOf(v)===i; }).sort(function(a,b){ return a-b; });
  var pas=null;
  for(var i=1;i<uniq.length;i++){ var d=uniq[i]-uniq[i-1]; if(d>0 && (pas===null || d<pas)) pas=d; }
  if(pas!==null && pas>0) return pas;
  var c=String(charge||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/haltere/.test(c)) return 2;
  if(/disque/.test(c)) return 2.5;
  return 2.5;
}

function suggestion(sessions, plan, charge, plage){
  if(!sessions || !sessions.length) return null;
  var last=sessions[sessions.length-1];
  var sets=(last && last.sets) ? last.sets.filter(function(s){ return (+s.r)>0; }) : [];
  if(!sets.length) return null;
  // Sans fourchette, le plan fait foi et min===max : on retombe exactement sur la
  // double progression de la v139 (tenu partout -> charge, moitie -> reps, sinon
  // consolidation). Avec une fourchette, les deux bornes se separent.
  var repsCible=(plan && +plan.reps>0) ? +plan.reps : null;
  var min=(plage && +plage.min>0) ? +plage.min : repsCible;
  var max=(plage && +plage.max>0) ? +plage.max : repsCible;
  if(!min || !max) return null;

  // La reference est la charge REELLEMENT soulevee la derniere fois, jamais celle du
  // plan. v139 partait du plan : l Adduction machine etait planifiee a 47,5 alors qu il
  // tirait deja 50, et l app repondait « monte a 50 kg » — une charge deja depassee.
  var refPoids = Math.max.apply(null, sets.map(function(s){ return +s.w||0; }));
  function auPoids(s){ return refPoids===0 || (+s.w||0)>=refPoids; }
  var hautes=sets.filter(function(s){ return auPoids(s) && (+s.r)>=max; }).length;
  var basses=sets.filter(function(s){ return auPoids(s) && (+s.r)>=min; }).length;
  var pas=pasCharge(sessions, charge);

  if(hautes===sets.length){
    return { action:'charge', pas:pas, poids:refPoids+pas, reps:min, min:min, max:max,
             texte:'Plafond de '+max+' reps tenu partout — monte à '+arrondi(refPoids+pas)+' kg' };
  }
  if(basses*2>=sets.length){
    return { action:'reps', pas:0, poids:refPoids, reps:max, min:min, max:max, manquantes:sets.length-hautes,
             texte:'Reste à '+arrondi(refPoids)+' kg — pousse jusqu’à '+max+' reps avant de charger' };
  }
  // « consolide » ne disait pas quoi faire : sous le plancher, l action est de
  // construire les reps a charge constante jusqu a tenir le plancher partout.
  return { action:'maintien', pas:0, poids:refPoids, reps:min, min:min, max:max,
           texte:'Sous '+min+' reps — reste à '+arrondi(refPoids)+' kg jusqu’à tenir '+min+' partout' };
}
function arrondi(v){ var n=Math.round(v*10)/10; return (n%1===0)?String(n):String(n).replace('.',','); }

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
    rirSerie, rirPlage,
    plageReps, pasCharge, suggestion,
  };
}
