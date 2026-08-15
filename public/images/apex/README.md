# Visuels APEX — direction photographique

Les fichiers `.svg` de ce dossier sont des **placeholders générés** (ambiances
de studio abstraites). L'architecture est finale : remplacer un fichier par la
photographie définitive suffit, **aucun code à modifier**. Garder les mêmes
noms (l'extension peut passer à `.webp`/`.avif` en adaptant `src/ui/visuals.js`).

## Direction pour toutes les photos

- premium, sombre, cinématographique, minimaliste
- fond presque noir (#070708), sujet fortement détaché
- lumière latérale unique, chaude et fine
- couleurs désaturées, fort contraste
- aucune esthétique influenceur, aucun texte, aucun logo tiers
- ratio 3:2 (1200×800 minimum), WebP ou AVIF

Le traitement APEX (désaturation, contraste, voile noir, dégradé, lumière
chaude) est appliqué par le CSS — livrer des photos propres, pas pré-traitées.

## Assets à produire

### hero/ — une ambiance par séance (plan large, matériel dans l'ombre)
- push.svg    → développé/pression, lumière venant de la gauche
- pull.svg    → tirage, lumière venant de la droite
- legs.svg    → bas du corps, lumière basse
- upper.svg   → haut du corps, lumière haute
- lower.svg   → chaîne postérieure, lumière basse droite
- default.svg → ambiance neutre (séances créées plus tard)

### exercises/ — une ambiance par famille (cadrage plus serré)
- press.svg → familles pressage (développés, dips, triceps, élévations)
- pull.svg  → familles tirage (rows, tractions, biceps, arrière d'épaule)
- legs.svg  → bas du corps et gainage

Pour une photo dédiée à UN exercice précis : ajouter le fichier ici et
l'entrée correspondante dans `EXERCISE_FAMILY`/`exerciseSrc` (src/ui/visuals.js).

### progress/ et programs/
Réservés (vides pour l'instant) : visuels de jalons de progression et
d'illustration de programmes, même direction photographique.
