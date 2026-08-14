# APEX

**Plateforme d'analyse probabiliste des marchés financiers.**
Phase actuelle : **conception**. Aucun code applicatif n'est encore écrit.

---

## Où en est le projet

| | |
|---|---|
| Étape | Document de conception rédigé, en attente d'arbitrages |
| Périmètre visé en V1 | Crypto perpétuels, un exchange, mode analyse seule, aucun ordre envoyé |
| Prochaine étape | Trancher les 5 décisions de l'annexe C, puis démarrer le MVP |

👉 **[Lire le document de conception complet](docs/APEX-DESIGN.md)** — vision, architecture IA,
data, backend, frontend, risque, backtesting, pipeline ML, sécurité, réglementation, stack,
roadmap, ordre de développement et MVP.

## Ce que le projet est, et n'est pas

**Est** : un système qui produit des probabilités calibrées, explique chaque décision à partir des
attributions réelles de ses modèles, impose une discipline de risque, et enregistre tout pour
pouvoir se juger lui-même.

**N'est pas** : une promesse de rentabilité. Aucune n'est faite, nulle part, et le document de
conception explique pourquoi elle serait malhonnête.

## Principes non négociables

1. Probabiliste, jamais oraculaire — `WAIT` est un état normal et fréquent.
2. Explicable par construction — un signal non reproductible est un bug.
3. Le moteur de risque a un droit de veto sur toute décision.
4. Aucun modèle ne se réentraîne seul face à de l'argent réel.
5. Bitemporalité des données dès le premier enregistrement, sinon tous les backtests mentent.

## Historique du dépôt

Ce dépôt a d'abord hébergé une PWA de suivi de musculation, projet abandonné. Le nom APEX est
conservé pour le nouveau produit. L'ancien code a été retiré de l'arbre de travail ; il reste
récupérable dans l'historique git au commit `a8842c0` (`git show a8842c0` pour le consulter,
`git checkout a8842c0 -- .` pour le restaurer).

Le dépôt ne contient donc, à ce stade, que de la documentation. Le socle technique du nouveau
produit sera initialisé une fois les décisions de l'annexe C tranchées.
