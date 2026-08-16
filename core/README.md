# Noyau

`core.js` contient les fonctions d'Increm qui ne lisent aucun état et ne
touchent pas au DOM : taxonomie musculaire, découpage du matériel, clés
d'historique, e1RM, modèle de durée de séance.

C'est la seule partie de l'app qui vit hors du fichier unique, et pour une
raison précise : **ces fonctions se trompent en silence**. Une expression
régulière abîmée ne lève pas d'erreur — elle renvoie simplement une
pondération fausse, que rien n'affiche. Trois incidents de ce type ont motivé
cette extraction :

- un `\b` transformé en caractère de contrôle dans le motif du T-bar : le
  fichier restait valide, `node --check` passait, et la préhension retombait
  silencieusement de 0,5 à 0,25 ;
- `keyName` et `keyEquip` définis **deux fois**, avec des implémentations
  différentes, la plus basse gagnant sans que rien ne le signale ;
- une évolution du découpage du matériel qui aurait pu changer les clés
  d'historique de quarante séances.

## Les deux commandes

```bash
node core/core.test.js      # 61 vérifications, aucune dépendance
node build.js               # réinjecte core.js dans le fichier unique
```

`build.js --verifier` ne modifie rien et sort en erreur si le bloc du HTML a
dérivé de `core.js`. C'est le garde-fou : sans lui, les tests finiraient par
vérifier autre chose que ce qui est livré.

## Ce qui ne change pas

L'app reste **un fichier unique, sans dépendance**. Seul le bloc entre les
marqueurs `NOYAU` de `suivi-musculation.html` est généré ; tout le reste du
HTML s'édite directement, comme avant. Il n'y a pas d'étape de compilation :
`build.js` est une copie de texte entre deux marqueurs.

## Modifier une fonction du noyau

1. éditer `core/core.js` (**pas** le bloc dans le HTML)
2. `node core/core.test.js`
3. `node build.js`
4. déployer comme d'habitude

Si une correction est faite directement dans le HTML par erreur,
`build.js --verifier` la signale avant qu'elle ne soit écrasée.
