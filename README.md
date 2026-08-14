# APEX — PWA de coaching musculation

Une app de suivi de musculation qui ne se contente pas de noter les séries : elle **applique les
règles de progression et les explique**. Mobile-first, 100 % locale, utilisable hors ligne en salle.

- Vanilla JS + HTML + CSS, build [Vite](https://vitejs.dev/). Aucun framework, aucun backend, aucun compte.
- Aucune requête vers un tiers : polices auto-hébergées, tout est servi par l'app.
- PWA installable sur Android (manifest + service worker), fonctionne sans réseau.
- Données en `localStorage`, export / import JSON manuel dans les réglages.
- Noir profond + or, tout en français, gros boutons tapables en pleine série.

---

## Démarrer

```bash
npm install
npm run dev        # serveur de dev sur http://localhost:5173
npm test           # tests unitaires (moteur, schéma, migration, stockage)
npm run build      # build de production dans dist/
npm run preview    # sert dist/ pour vérifier avant déploiement
```

Parcours complet dans un vrai navigateur (migration, séance, hors ligne, écran d'erreur) :

```bash
npm run build && npm i --no-save playwright-core && node tests/e2e/smoke.mjs
```

Sur le téléphone, en dev : `npm run dev` écoute sur le réseau local (`host: true`), ouvre
`http://<ip-de-ton-pc>:5173` depuis le mobile.

> Le service worker n'est actif que sur le build (`preview` ou site déployé), pas en dev.

## Déploiement GitHub Pages

Le build utilise `base: './'` : les chemins sont relatifs, le site marche donc aussi bien à la
racine d'un domaine que dans `https://<user>.github.io/<repo>/`.

**Automatique (recommandé)** — le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
construit et publie à chaque push sur les branches listées dans `on.push.branches` (la branche par
défaut du dépôt et la branche de restauration `claude/apex-musculation-restore-b0sf29`). Une seule
chose à faire, une fois : `Settings → Pages → Source: GitHub Actions`. Le site sort ensuite sur
**https://fuego-core.github.io/Apex/**.

Si la branche par défaut change de nom, penser à l'ajouter dans `on.push.branches` du workflow.
GitHub restreint par défaut l'environnement `github-pages` à la branche par défaut : pour publier
depuis une autre branche, l'autoriser dans `Settings → Environments → github-pages → Deployment
branches`, ou fusionner la branche dans la branche par défaut.

**Manuel** — si tu préfères la branche `gh-pages` :

```bash
npm run build
npx gh-pages -d dist        # ou pousse le contenu de dist/ sur la branche gh-pages
```

Puis `Settings → Pages → Source: Deploy from a branch → gh-pages / root`.

## Installer sur Android

1. Ouvrir le site déployé dans Chrome (HTTPS obligatoire pour le service worker).
2. Menu ⋮ → **Installer l'application** / *Ajouter à l'écran d'accueil*.
3. L'app se lance en plein écran, sans barre d'adresse, et fonctionne ensuite hors ligne.

---

## Le moteur de coaching

### Concepts

| Concept | Règle |
| --- | --- |
| Programme | 5 séances : Push, Pull, Legs, Upper, Lower |
| Exercice | nom, mode (`reps` ou `temps`), nb de séries, fourchette de reps ou durée cible, poids courant, incrément (défaut 2,5 kg), repos, note, flag `assisté` |
| 1 exo = 1 poids | toutes les séries de travail d'un exercice au même poids ; le poids se règle **au niveau de l'exercice** et s'applique à toutes les séries non validées |
| Échauffement | ajoutable, marqué `É`, **exclu** du moteur et des stats |
| Assisté | logique inversée : progresser = **réduire** le poids d'assistance |

Si des poids différents sont saisis entre séries de travail, l'app affiche un avertissement
**non bloquant** : « 1 exo = 1 poids — les montées, c'est l'échauffement ».

### Progression double (mode `reps`, à la fin de la séance)

| Situation | Statut | Suggestion pour la prochaine fois |
| --- | --- | --- |
| Toutes les séries de travail au **haut** de la fourchette, au même poids | **Progression 🎯** (or) | poids **+ incrément** (− incrément si assisté) |
| Au moins une série **sous le plancher** | **Trop lourd** | poids **− incrément** (+ incrément si assisté) |
| Entre les deux | **Construire** | même poids — « les reps montent d'abord » |

Le mode `temps` (planche, marche inclinée, vélo) est un simple log de durée : pas de moteur.

Les règles vivent dans [`src/core/engine.js`](src/core/engine.js), sans dépendance au DOM,
et sont gelées par les tests de [`tests/engine.spec.js`](tests/engine.spec.js) : le comportement
actuel est une spécification, il ne change que volontairement.

### Pense-bête

À l'ouverture d'une séance, l'écran **« Aujourd'hui ça monte 🎯 »** liste les suggestions laissées
par la séance précédente. Un tap pour **accepter** le nouveau poids, un tap pour **garder** l'ancien
(ou « Tout accepter »). Les suggestions non traitées sont considérées comme gardées.

---

## Déroulé d'une séance

1. **Accueil** — les 5 séances et la date de leur dernier passage.
2. **Pense-bête** — les ajustements proposés, puis « Commencer la séance ».
3. **Séance** — chaque exercice affiche son poids courant et ses séries pré-remplies (reps cible).
   On ajuste les reps réelles au besoin, puis on valide la série d'un tap.
4. **Repos** — timer plein écran automatique (durée de l'exercice), vibration + son à la fin,
   bouton **+30 s**, bouton **Passer**. L'écran reste allumé quand le navigateur l'autorise.
   Les exercices en mode temps ont un **chrono** (⏱) qui enregistre la durée réellement tenue.
5. **Résumé** — durée, tonnage, séries, et le verdict du moteur exercice par exercice.
   « Terminer » archive dans l'historique et prépare le pense-bête suivant.
6. **Historique** — séances passées, et par exercice une mini-courbe poids (or) + volume de reps.

Une séance en cours est sauvegardée en continu : fermer l'app en plein milieu ne perd rien,
l'accueil propose « Reprendre ».

---

## Données

Tout est dans le `localStorage` de l'appareil, rien ne sort du téléphone. Les clés et la garantie de
non-destruction sont décrites plus bas, dans *Données, identité des exercices et migration*.

**Réglages → Sauvegarde** : export JSON (fichier ou presse-papier) et import (fichier ou
copier-coller). À faire de temps en temps : effacer les données du navigateur efface l'historique.

Forme du JSON exporté :

```jsonc
{
  "version": 2,
  "catalog": {
    // L'identité des mouvements : un id stable, un nom qui peut changer.
    "lateral-raise": { "id": "lateral-raise", "name": "Élévations latérales",
                       "mode": "reps", "assisted": false, "increment": 2.5 }
  },
  "program": [
    {
      "id": "push",
      "name": "Push",
      "lastDoneAt": "2026-08-12T18:30:00.000Z",
      "exercises": [
        {
          "id": "push-04-lateral-raise",   // placement dans la séance
          "exerciseId": "lateral-raise",   // mouvement du catalogue
          "sets": 4,
          "repMin": 12, "repMax": 15,
          "weight": 8,
          "increment": 2.5,
          "rest": 60,                      // secondes
          "note": "",
          "pending": null                  // suggestion du moteur (pense-bête)
        }
      ]
    }
  ],
  "history": [ /* séances archivées, séries incluses, rattachées à exerciseId */ ],
  "settings": { "sound": true, "vibration": true }
}
```

---

## Structure

```
index.html                 coquille, zéro requête externe
public/
  manifest.webmanifest     manifest PWA
  sw.js                    service worker (offline, précache injecté au build)
  fonts/                   Inter + Space Grotesk auto-hébergées (woff2)
  icons/                   logo + icônes APEX (SVG)
src/
  main.js                  démarrage async, routeur hash, garde-fous d'erreur
  state.js                 état en mémoire, chargement/enregistrement, import/export
  core/                    métier pur, sans DOM, testable
    engine.js              moteur de progression
    catalog.js             catalogue des mouvements (ids stables)
    program.js             programme préchargé (5 séances)
    schema.js              schéma v2, hydratation, validation
    migrate.js             migration v1 → v2
  data/                    stockage
    dataStore.js           façade asynchrone (file d'écriture)
    adapters/local.js      adapter localStorage (IndexedDB viendra ici)
    errors.js              erreurs typées avec message utilisateur
    rescue.js              export de secours si l'app ne démarre pas
  timer.js                 timer plein écran (repos / effort), son + vibration
  ui.js                    helpers de rendu, toasts, modales, bannières, écran d'erreur
  fonts.css                @font-face locales
  styles.css               design system noir + or
  views/                   home, prep (pense-bête), workout, summary, history, exercise, settings
tests/                     tests unitaires + parcours navigateur (tests/e2e)
```

## Données, identité des exercices et migration

Un **mouvement** a un id stable et global (`lateral-raise`). Une séance ne contient pas des
exercices : elle place des mouvements et leur donne des paramètres de travail (séries, fourchette,
poids, incrément, repos). Conséquence : les élévations latérales de Push et de Upper sont **le même
exercice**, donc le même historique et le même record — mais chaque séance garde son propre poids de
travail. Renommer un mouvement ne casse rien, l'id ne bouge pas.

| Clé | Contenu |
| --- | --- |
| `apex.v2` | état courant (catalogue, programme, historique, réglages) |
| `apex.live.v2` | séance en cours |
| `apex.backup.v1` | copie brute de l'état v1, écrite automatiquement avant la migration |
| `apex.v1` | état d'origine — **jamais modifié, jamais supprimé** |

La migration v1 → v2 est non destructive et vérifiée : sauvegarde d'abord, conversion ensuite,
validation du résultat, écriture sous une nouvelle clé, puis **relecture de contrôle**. Si une seule
de ces étapes échoue, rien n'est écrit, `apex.v1` reste intact et l'app affiche un écran d'erreur
avec un export de secours. Les anciens fichiers d'export v1 restent importables : ils sont convertis
à la volée.

## Logo

Symbole minimaliste en lignes fines or sur noir : un sommet (triangle) dont la barre horizontale
est une barre de musculation avec ses disques, et le wordmark **A P E X** en capitales espacées.

- [`public/icons/apex-icon.svg`](public/icons/apex-icon.svg) — icône du manifest
- [`public/icons/apex-maskable.svg`](public/icons/apex-maskable.svg) — variante *maskable* Android
- [`public/icons/apex-logo.svg`](public/icons/apex-logo.svg) — logo complet avec wordmark

## Réinitialiser

**Réglages → Zone rouge** : « Réinitialiser le programme » remet les 5 séances et les poids
d'origine en gardant l'historique ; « Tout effacer » remet l'app à zéro.

---

## Historique du dépôt

Ce dépôt a brièvement changé de sujet (plateforme d'analyse de marchés) : le code de la PWA avait
été retiré au commit `82da47b`, puis **restauré ici**. APEX est bien, et reste, l'app de coaching
musculation. Le document de conception de l'autre concept a été supprimé de l'arbre de travail ; il
reste consultable dans l'historique git au commit `df8b57b` (`git show df8b57b:docs/APEX-DESIGN.md`).
