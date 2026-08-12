# APEX — PWA de coaching musculation

Une app de suivi de musculation qui ne se contente pas de noter les séries : elle **applique les
règles de progression et les explique**. Mobile-first, 100 % locale, utilisable hors ligne en salle.

- Vanilla JS + HTML + CSS, build [Vite](https://vitejs.dev/). Aucun framework, aucun backend, aucun compte.
- PWA installable sur Android (manifest + service worker), fonctionne sans réseau.
- Données en `localStorage`, export / import JSON manuel dans les réglages.
- Noir profond + or, tout en français, gros boutons tapables en pleine série.

---

## Démarrer

```bash
npm install
npm run dev        # serveur de dev sur http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # sert dist/ pour vérifier avant déploiement
```

Sur le téléphone, en dev : `npm run dev` écoute sur le réseau local (`host: true`), ouvre
`http://<ip-de-ton-pc>:5173` depuis le mobile.

> Le service worker n'est actif que sur le build (`preview` ou site déployé), pas en dev.

## Déploiement GitHub Pages

Le build utilise `base: './'` : les chemins sont relatifs, le site marche donc aussi bien à la
racine d'un domaine que dans `https://<user>.github.io/<repo>/`.

**Automatique (recommandé)** — le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
construit et publie à chaque push sur la branche par défaut. Une seule chose à faire :
`Settings → Pages → Source: GitHub Actions`.

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

Les règles vivent dans [`src/engine.js`](src/engine.js), sans dépendance au DOM.

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

Tout est dans le `localStorage` de l'appareil, rien ne sort du téléphone.

| Clé | Contenu |
| --- | --- |
| `apex.v1` | programme (5 séances + exercices + poids courants), historique, réglages |
| `apex.live.v1` | séance en cours, pour survivre à une fermeture d'app |

**Réglages → Sauvegarde** : export JSON (fichier ou presse-papier) et import (fichier ou
copier-coller). À faire de temps en temps : effacer les données du navigateur efface l'historique.

Forme du JSON exporté :

```jsonc
{
  "version": 1,
  "program": [
    {
      "id": "push",
      "name": "Push",
      "lastDoneAt": "2026-08-12T18:30:00.000Z",
      "exercises": [
        {
          "id": "push-01-supine-press-machine",
          "name": "Supine Press machine",
          "mode": "reps",          // "reps" | "temps"
          "sets": 4,
          "repMin": 6, "repMax": 8,
          "weight": 50,
          "increment": 2.5,
          "rest": 120,             // secondes
          "note": "",
          "assisted": false,
          "pending": null          // suggestion du moteur (pense-bête)
        }
      ]
    }
  ],
  "history": [ /* séances archivées, séries incluses */ ],
  "settings": { "sound": true, "vibration": true }
}
```

---

## Structure

```
index.html                 coquille + polices Google
public/
  manifest.webmanifest     manifest PWA
  sw.js                    service worker (offline)
  icons/                   logo + icônes APEX (SVG)
src/
  main.js                  routeur hash + enregistrement du service worker
  state.js                 localStorage, export/import, séance en cours
  program.js               le programme préchargé (les 5 séances)
  engine.js                moteur de progression (pur, testable)
  timer.js                 timer plein écran (repos / effort), son + vibration
  ui.js                    helpers de rendu, formats FR, toasts, modales
  styles.css               design system noir + or
  views/                   home, prep (pense-bête), workout, summary, history, exercise, settings
```

## Logo

Symbole minimaliste en lignes fines or sur noir : un sommet (triangle) dont la barre horizontale
est une barre de musculation avec ses disques, et le wordmark **A P E X** en capitales espacées.

- [`public/icons/apex-icon.svg`](public/icons/apex-icon.svg) — icône du manifest
- [`public/icons/apex-maskable.svg`](public/icons/apex-maskable.svg) — variante *maskable* Android
- [`public/icons/apex-logo.svg`](public/icons/apex-logo.svg) — logo complet avec wordmark

## Réinitialiser

**Réglages → Zone rouge** : « Réinitialiser le programme » remet les 5 séances et les poids
d'origine en gardant l'historique ; « Tout effacer » remet l'app à zéro.
