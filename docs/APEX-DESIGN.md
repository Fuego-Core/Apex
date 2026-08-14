# APEX — Plateforme d'analyse de marchés assistée par IA

**Document de conception — v0.1, avant toute ligne de code.**

---

## Avertissement liminaire

Ce document ne promet aucune rentabilité, et refuse explicitement de le faire. Les marchés liquides
sont proches de l'efficience faible : la composante prédictible du rendement à court terme est
faible, instable, et se déplace dès qu'elle est exploitée. La grande majorité des systèmes qui
paraissent excellents en backtest perdent de l'argent en production, non par malchance mais parce
que le backtest était faux.

Ce qu'APEX peut viser honnêtement :

1. **Estimer des probabilités calibrées.** Quand le système annonce 70 %, l'événement doit se
   produire dans ~70 % des cas. C'est mesurable, falsifiable, et c'est la seule promesse tenable.
2. **Imposer une discipline de risque.** La majeure partie de la valeur d'un tel système ne vient
   pas de la prédiction mais du dimensionnement, des stops et du refus de trader.
3. **Rendre chaque décision auditable.** Pourquoi ce signal, avec quelles données, quel modèle,
   quelle version — et qu'est-ce qui l'invalide.
4. **Apprendre proprement de ses erreurs**, dans un pipeline où aucun modèle ne se met à jour tout
   seul face à de l'argent réel.

Si le système atteint ces quatre objectifs, c'est déjà un logiciel remarquable. La rentabilité,
elle, dépend de facteurs que l'architecture ne contrôle pas.

---

## Résumé exécutif — les 12 décisions structurantes

| # | Décision | Raison courte |
|---|---|---|
| 1 | **Une seule classe d'actifs en V1 : crypto perpétuels**, un seul exchange | Crypto + actions simultanément multiplie le travail par ~2,5 (horaires, corporate actions, réglementation, sources de données) pour zéro apprentissage supplémentaire |
| 2 | **Les 14 « moteurs IA » ne sont pas 14 modèles** | Ce sont 3 pipelines réels (marché, texte, on-chain), 1 modèle de décision, 1 moteur de risque déterministe, et un affichage par famille de features |
| 3 | **Aucun LLM dans la boucle de décision sur données de marché** | Non déterministe, lent, cher, et surtout **impossible à backtester honnêtement** : le modèle connaît déjà l'histoire des marchés |
| 4 | **LightGBM + calibration** comme modèle principal, pas de deep learning en V1 | Sur features tabulaires hétérogènes avec peu de données utiles, le gradient boosting domine ; itération 100× plus rapide |
| 5 | **Labellisation par triple-barrière + meta-labeling** | C'est la seule façon de rendre BUY/SELL/HOLD apprenable et cohérent avec le format de signal (entrée/stop/TP) |
| 6 | **Le Risk Engine n'est pas de l'IA** | Règles déterministes, testées unitairement, lisibles par un humain. Un modèle ne doit jamais pouvoir lever une limite de risque |
| 7 | **Le Master Decision Engine n'est pas un réseau de neurones** | Probabilité calibrée + politique de décision transparente + veto du risque. Un méta-modèle opaque détruit l'explicabilité, qui est le produit |
| 8 | **Les « raisons » viennent des attributions réelles du modèle** (SHAP par groupe), jamais d'un LLM qui rédige librement | Sinon on fabrique une justification plausible et fausse — le pire défaut possible pour ce produit |
| 9 | **Pas de reinforcement learning** | Environnement non stationnaire, échantillon insuffisant, simulateur infidèle, validation impossible. Séduisant sur le papier, ingérable en pratique |
| 10 | **Bitemporalité obligatoire dès le premier jour** (event_time + ingestion_time) | Sans ça, tous les backtests fuitent, et on ne s'en aperçoit qu'après avoir perdu de l'argent |
| 11 | **Mode AUTONOMOUS interdit avant 6 mois de paper trading documenté** | Pas une question de prudence morale : sans distribution de résultats hors échantillon, le dimensionnement est arbitraire |
| 12 | **Pas de Kafka, pas de Kubernetes, pas de feature store en V1** | Trois taxes opérationnelles classiques qui n'apportent rien avant une échelle qu'on n'atteindra pas avant longtemps |

---

## Ce que je coupe immédiatement, et pourquoi

Demande explicite d'être critique. Voici ce qui, dans le cahier des charges initial, coûte cher pour
un bénéfice faible ou négatif.

**14 moteurs IA indépendants.** Quatorze modèles entraînés séparément sur les mêmes prix produisent
des scores fortement corrélés : on n'agrège pas de l'information, on agrège du bruit corrélé, avec
14 fois plus de surface d'overfitting et 14 fois plus de maintenance. Le découpage reste excellent
comme **grammaire d'explication** (l'utilisateur veut voir « Momentum → bullish ») : on garde
l'affichage par famille, obtenu par attribution groupée d'un modèle unique. C'est plus honnête —
le score affiché reflète alors la contribution réelle à la décision, pas l'avis d'un modèle
parallèle qu'on ignore ensuite.

**Order book complet (L2/L3) en V1.** Plusieurs Go par jour et par symbole liquide, pour un
bénéfice réel uniquement sur des horizons de quelques secondes — donc sur un terrain où la
compétition est colocalisée et écrit en C++. Ce qu'on garde : top-of-book, spread, profondeur
agrégée à ±10/25/50 bps, échantillonnés à 1 s. Coût dérisoire, 90 % du signal exploitable à notre
horizon.

**Reinforcement learning.** Il faut des millions d'épisodes dans un environnement stationnaire avec
un simulateur fidèle. On a un environnement non stationnaire, ~10 ans de données au mieux, et un
simulateur qui ment sur l'impact de marché. Le RL apprendra à exploiter les défauts du simulateur.
Éventuellement pertinent un jour pour l'**exécution** (placement d'ordre sur quelques secondes), où
le simulateur est bien plus fidèle — jamais pour la stratégie.

**Actions + crypto en parallèle dès la V1.** Deux modèles de données différents (corporate actions,
splits, dividendes, univers survivorship-free, horaires de marché, halts), deux régimes
réglementaires, deux sources payantes. À reporter en V2, une fois que le socle est prouvé sur un
marché.

**Interface avec 40 widgets.** L'utilisateur demande un terminal professionnel : la densité doit
servir la décision. Un écran de signal doit tenir en une vue : quoi, quelle confiance, quel risque,
pourquoi, ce qui l'invalide. Tout le reste est secondaire.

**Le mot « temps réel ».** À définir précisément, sinon il justifie une infrastructure absurde. Pour
une stratégie à horizon 1 h–3 jours, « temps réel » = latence de bout en bout < 2 s, ce que fait du
Python correctement écrit. Si un jour on vise l'horizon seconde, c'est un autre produit, une autre
équipe et un autre budget.

---

# 1. Vision du produit

**APEX est un terminal d'analyse probabiliste des marchés, pas un robot de trading.**

La question qu'il pose n'est pas « le prix va-t-il monter ? » mais :

> Compte tenu de tout ce qui est observable maintenant, quelle est la probabilité que ce scénario
> se réalise avant son invalidation, et le rapport risque/rendement justifie-t-il d'engager du
> capital ?

Trois principes non négociables :

1. **Probabiliste, jamais oraculaire.** Toute sortie est une distribution ou une probabilité
   calibrée, accompagnée de sa condition d'invalidation. Le système a le droit de dire « je ne sais
   pas » — c'est même le statut `WAIT`, et il doit être fréquent.
2. **Explicable par construction.** Aucune décision n'est produite sans la trace des données, des
   features, des versions de modèle et des attributions qui l'ont provoquée. Un signal
   non reproductible est un bug.
3. **Le risque a un droit de veto.** Le moteur de risque peut annuler n'importe quelle décision.
   L'inverse est impossible.

**Utilisateur cible V1 :** le propriétaire, trader discrétionnaire, qui veut un copilote analytique
rigoureux et une mémoire de ses décisions. Pas un public. Ce point conditionne l'essentiel des
choix techniques et toute la partie réglementaire.

**Ce qui distingue APEX d'un bot à indicateurs :** la traçabilité et la calibration. Un bot dit
« RSI < 30, achète ». APEX dit : « P(TP avant SL) = 0,63 ± 0,05, calibrée sur 4 200 cas comparables,
portée à 62 % par la structure de volatilité et le funding, contredite par le régime macro ;
espérance après frais = +0,18 R ; taille recommandée 0,4 % du capital ; invalidé sous 102 900. »

---

# 2. Fonctionnalités V1

Périmètre : **crypto perpétuels, un exchange, mode ANALYST uniquement, aucun ordre envoyé.**

### 2.1 Ingestion et données
- Flux WebSocket temps réel : trades, top-of-book, mark price, funding, open interest, liquidations.
- Barres agrégées 1 m / 5 m / 15 m / 1 h / 4 h / 1 j construites **par nous** depuis les trades
  (jamais dépendre des barres de l'exchange : elles se corrigent silencieusement).
- Backfill historique complet (24 mois minimum) via REST, réconcilié avec le flux live.
- Détection de trous, de doublons, de désordre temporel, d'horloge décalée.
- Stockage bitemporel immuable en Parquet + base opérationnelle pour le récent.

### 2.2 Features et modèle
- Bibliothèque de features **unique**, utilisée à l'identique en backtest et en live (un seul code
  source — c'est la protection n°1 contre le train/serve skew).
- Familles : tendance, momentum, volatilité (réalisée, ratio court/long), structure de marché
  (swings, ranges, cassures), volume/liquidité (spread, profondeur, volume relatif), dérivés
  (funding, OI, liquidations), corrélations (BTC-dominance, bêta au marché), temps (heure, jour).
- Labels par triple-barrière calibrée en volatilité, sur horizon paramétrable.
- Modèle primaire de direction + **meta-model de confiance** (LightGBM), calibration isotonique.
- Modèle de volatilité séparé (HAR-RV ou GARCH) qui alimente stops et sizing.

### 2.3 Décision et risque
- Master Decision Engine : politique explicite convertissant (probabilité, volatilité, régime,
  coûts) en `BUY / SELL / HOLD / WAIT / EXIT`. `SHORT` traité comme `SELL` sur perpétuels.
- Risk Engine déterministe : sizing par risque fixe fractionnaire, stop basé volatilité, limites
  d'exposition, corrélation, perte quotidienne, drawdown, filtre de liquidité.
- Kill switch avec déclencheurs automatiques (même sans exécution : il coupe la production de
  signaux et lève une alerte, ce qui teste le mécanisme avant qu'il ne compte vraiment).

### 2.4 Produit
- Terminal web : watchlist dense, écran de signal détaillé, journal des signaux, santé du système.
- Alertes Telegram (setup de qualité, invalidation, incident système).
- Journal complet de chaque signal, avec suivi automatique du résultat **y compris pour les signaux
  non pris** (le prix est observable de toute façon : on peut évaluer les contrefactuels).
- Rapport de calibration hebdomadaire : fiabilité, Brier, dérive des features.

### 2.5 Recherche
- Moteur de backtest à deux implémentations (vectorielle rapide + événementielle fidèle) avec test
  de concordance obligatoire.
- Validation croisée purgée avec embargo, walk-forward, Monte Carlo par blocs.
- Registre de modèles versionnés, promotion manuelle, rollback par changement de pointeur.

### Explicitement **hors** V1
Exécution réelle, mode COPILOT/AUTONOMOUS, actions, on-chain, LLM/news/sentiment, multi-exchange,
multi-utilisateur, mobile natif, order book profond, GPU.

---

# 3. Fonctionnalités V2 et au-delà

Par ordre de valeur décroissante rapportée à la complexité :

**V2.0 — Exécution encadrée (le plus gros saut de risque)**
Mode COPILOT : le système prépare l'ordre, l'humain valide en un geste. OMS avec idempotence,
réconciliation continue contre l'exchange, séparation stricte paper/live, dead man's switch.
*C'est la fonctionnalité qui transforme le profil de risque du projet : elle mérite à elle seule
un cycle complet de sécurité.*

**V2.1 — News & Sentiment**
Pipeline texte séparé : ingestion, déduplication, classification d'impact, extraction d'entités,
horodatage strict de publication. C'est ici qu'un LLM est légitime — en extraction de features
à partir de texte, pas en décision. Attention : impossible de backtester avant d'avoir accumulé
plusieurs mois de features horodatées en propre.

**V2.2 — Actions**
Univers survivorship-free, corporate actions, fondamentaux point-in-time (avec vintages), horaires
et halts, données intraday payantes.

**V2.3 — On-chain (crypto)**
Flux exchange, âge des coins, stablecoins, activité des adresses. Fréquence basse, valeur réelle
mais latence d'information élevée.

**V2.4 — Macro & régimes**
Modèle de régime (HMM ou clustering) sur volatilité/corrélation/taux, utilisé comme **filtre** et
comme variable de conditionnement, pas comme générateur de signal.

**V3 — Autonome, multi-stratégies, multi-comptes**
Allocation entre stratégies, optimisation de portefeuille, exécution algorithmique (TWAP/VWAP,
placement passif). Uniquement si les phases précédentes ont produit des preuves statistiques.

**Jamais, sauf décision explicite :** ouverture à des utilisateurs tiers. Ce n'est pas une
fonctionnalité, c'est un changement de métier (voir §15).

---

# 4. Architecture globale

Cinq plans séparés par des frontières nettes. La règle : **les données descendent, les décisions
remontent, et rien ne saute une couche.**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PLAN 0 — SOURCES                                                        │
│  Exchange WS/REST · macro (FRED) · news (V2) · on-chain (V2)             │
└───────────────┬──────────────────────────────────────────────────────────┘
                │  adaptateurs par source (normalisation, horodatage)
┌───────────────▼──────────────────────────────────────────────────────────┐
│  PLAN 1 — INGESTION & STOCKAGE                                           │
│  collecteurs → bus (Redis Streams) → writers                             │
│  · lac Parquet immuable (vérité historique, bitemporel)                  │
│  · Postgres/Timescale (état opérationnel + fenêtre récente)              │
│  · Redis (dernier état, caches chauds)                                   │
│  Contrôles qualité en ligne : trous, doublons, staleness, aberrations    │
└───────────────┬──────────────────────────────────────────────────────────┘
                │  MÊME code de features des deux côtés
┌───────────────▼──────────────────────────────────────────────────────────┐
│  PLAN 2 — FEATURES                                                       │
│  feature library (pur, déterministe, versionné)                          │
│  online: calcul incrémental à la clôture de barre                        │
│  offline: recalcul massif sur Parquet (DuckDB)                           │
└───────────────┬──────────────────────────────────────────────────────────┘
┌───────────────▼──────────────────────────────────────────────────────────┐
│  PLAN 3 — INFÉRENCE & DÉCISION                                           │
│  modèle direction → meta-modèle confiance → calibration                  │
│  modèle volatilité → stops/targets                                       │
│  Decision Policy (déterministe) → Risk Engine (veto) → Signal            │
│  Anomaly/Health Engine en travers de tout                                │
└───────────────┬──────────────────────────────────────────────────────────┘
┌───────────────▼──────────────────────────────────────────────────────────┐
│  PLAN 4 — PRODUIT & EXÉCUTION                                            │
│  API (REST + WS) · terminal web · alertes · journal                      │
│  [V2] OMS/exécution, isolé, avec ses propres garde-fous                  │
└──────────────────────────────────────────────────────────────────────────┘

    PLAN R — RECHERCHE (hors ligne, jamais dans le chemin de production)
    backtest · walk-forward · entraînement · registre · promotion
```

**Trois invariants d'architecture**, à faire respecter par des tests automatisés :

- **I1 — Pureté des features.** Une feature à l'instant *t* ne peut lire que des données dont
  `event_time ≤ t` **et** `ingestion_time ≤ t`. Test : rejouer l'historique en mode « live simulé »
  et vérifier l'égalité bit-à-bit avec le calcul offline.
- **I2 — Reproductibilité.** (données, code, config, seed) → sortie identique. Toute décision porte
  le hash de ces quatre éléments.
- **I3 — Autorité du risque.** Aucun chemin de code ne permet à un modèle de contourner le Risk
  Engine. Le moteur de risque est la dernière porte, et il est déterministe.

---

# 5. Architecture IA

## 5.1 La question posée : multi-agents, vraiment ?

**Réponse : non, pas au sens « 14 agents autonomes qui délibèrent ».** Voici le raisonnement.

Un système multi-agents apporte de la valeur quand les agents ont des **sources d'information
disjointes**, des **espaces d'action distincts**, ou des **contraintes de latence différentes**.
Sur les 14 moteurs demandés, la majorité partagent exactement la même source (le flux de prix) :
leurs sorties seraient corrélées à 0,7–0,95. Les agréger revient à moyenner du bruit corrélé, en
multipliant les degrés de liberté — donc l'overfitting — et la maintenance.

Découpage réel, par nature de traitement :

| Moteur demandé | Ce que c'est réellement | Verdict |
|---|---|---|
| Technical, Market Structure, Momentum, Volume/Liquidity, Volatility, Correlation | **Familles de features** sur la même source | Fusionner dans une bibliothèque unique → 1 modèle. Affichage séparé via attribution groupée |
| Volatility (prévision) | Vrai problème de modélisation distinct, et **prévisible** contrairement à la direction | Modèle dédié (HAR-RV/GARCH). Priorité haute |
| News, Sentiment | Source disjointe (texte), latence et modes de panne différents | Pipeline séparé. Seul endroit légitime pour un LLM |
| On-chain | Source disjointe, basse fréquence | Pipeline séparé, V2 |
| Fundamental | Source disjointe, cadence trimestrielle | Filtre d'univers, pas générateur de signal |
| Macro | Basse fréquence, effet de conditionnement | Détecteur de régime, en entrée du modèle |
| Anomaly Detection | **N'est pas un moteur de signal** | Système de sécurité : données corrompues, flux figés, dérive de modèle, rupture de régime → alimente le kill switch |
| Risk Engine | Politique, pas prédiction | Déterministe, testé unitairement, zéro ML |
| Master Decision | Agrégation | Politique explicite + calibration, **pas** un méta-modèle opaque |

Résultat : **3 pipelines de données, 3 modèles entraînés, 2 composants déterministes.** L'utilisateur
voit toujours ses « moteurs » dans l'interface — mais ce sont des vues honnêtes sur une décision
unique, pas une mise en scène.

## 5.2 Pourquoi aucun LLM ne décide sur des données de marché

Quatre raisons, la troisième est rédhibitoire :

1. **Non-déterminisme** : même prompt, sorties différentes → invariant I2 violé, backtest impossible.
2. **Coût et latence** : 500 symboles × 4 timeframes, plusieurs fois par heure = des dizaines de
   milliers d'appels/jour, pour une tâche que fait un arbre de décision en microsecondes.
3. **Contamination temporelle (le tueur)** : un LLM a mémorisé l'histoire des marchés jusqu'à sa
   date de coupure. Lui montrer un graphique de mars 2020 et lui demander « que va-t-il se passer »
   n'est pas une prédiction, c'est de la récitation. **Tout backtest impliquant un LLM sur des
   données antérieures à sa coupure est invalide**, et aucune astuce d'anonymisation ne le corrige
   vraiment (les configurations de prix sont reconnaissables).
4. **Rationalisation post-hoc** : un LLM produira toujours une explication convaincante, y compris
   pour une décision aberrante. C'est exactement le contraire du produit voulu.

Usage légitime d'un LLM dans APEX : **texte → features structurées** (classification d'impact,
extraction d'entités, résumé de dépêche), avec sortie contrainte par un schéma, mise en cache,
horodatée, et évaluée comme n'importe quel autre extracteur. Et éventuellement, en surcouche
d'interface : reformuler en français lisible des attributions déjà calculées — sans jamais pouvoir
ajouter un argument qui ne vient pas du modèle.

## 5.3 Le problème d'apprentissage, formulé correctement

C'est la décision la plus importante du projet, et celle que 90 % des projets amateurs ratent.

**Mauvaise formulation** : « prédire le rendement à H+1 ». Cible bruitée, sans lien avec une
décision de trading, et qui ignore le chemin (un +2 % final après un −5 % intermédiaire a liquidé
la position).

**Bonne formulation — triple-barrière** (López de Prado, *Advances in Financial Machine Learning*) :
pour chaque instant candidat, on pose trois barrières — profit (`+k₁·σ`), perte (`−k₂·σ`), et temps
(`T` barres). Le label est la première barrière touchée. Avantages décisifs :

- la cible est **exactement** la décision produite (entrée, stop, TP, horizon) ;
- les barrières sont calibrées en volatilité, donc comparables entre BTC et un altcoin ;
- le backtest et l'entraînement mesurent la même chose.

**Meta-labeling** : un modèle primaire propose une direction (il peut même être une règle simple :
cassure de range, retour à la moyenne). Un second modèle apprend `P(le trade primaire réussit)` à
partir du contexte complet. C'est **précisément le « 82 % de confiance »** demandé, et c'est la
bonne architecture : le modèle secondaire n'a pas à deviner la direction, seulement à filtrer.
Bénéfice mesuré dans la littérature et en pratique : forte hausse de la précision, baisse du nombre
de trades — ce qui est le bon sens du problème.

**Pièges de labellisation à traiter dès le départ** :
- labels chevauchants → poids d'échantillon par unicité, sinon la significativité est surestimée ;
- purge + embargo dans la validation croisée, sinon fuite entre train et test ;
- barrières exprimées en volatilité **estimée à t**, jamais en volatilité réalisée future.

## 5.4 Comparatif des modèles, sans effet de mode

| Modèle | Pertinent ici ? | Analyse |
|---|---|---|
| **LightGBM / XGBoost / CatBoost** | ✅ **Choix V1** | Domine sur données tabulaires hétérogènes ; robuste au bruit et aux features inutiles ; entraînement en secondes → on itère 50 fois par jour ; SHAP natif pour l'explicabilité, qui est ici une exigence produit. LightGBM pour la vitesse, CatBoost si beaucoup de catégorielles |
| **Random Forest** | 🟡 Baseline | Utile comme référence de variance et détecteur d'overfitting du GBDT. Généralement dominé. À garder en test de contrôle, pas en production |
| **Régression logistique régularisée** | ✅ Baseline obligatoire | Si le GBDT ne bat pas nettement une logistique sur les mêmes features, le GBDT overfitte. C'est un garde-fou, pas une option |
| **LSTM / GRU** | ❌ Pas en V1 | Affamés en données, instables sur du signal/bruit ~0,05, lents à itérer, et régulièrement battus par un GBDT sur features retardées. GRU marginalement moins coûteux. Réévaluer seulement si on passe à la microstructure |
| **Temporal Fusion Transformer** | 🟡 V2, ciblé | Conçu pour la prévision multi-horizon **de valeurs** avec covariables (demande, énergie) ; ses attentions sont interprétables. Candidat crédible pour la **volatilité** et les quantiles, pas pour la direction. Coût d'entraînement et d'ops sans commune mesure avec le gain attendu en V1 |
| **Transformers temporels génériques** | ❌ | La littérature de benchmark (Zeng et al., AAAI 2023) montre qu'un simple modèle linéaire les bat souvent sur de la prévision réelle. Sur du bruit financier, l'écart se creuse dans le mauvais sens |
| **Modèles de volatilité (GARCH, HAR-RV)** | ✅ **Priorité haute** | La volatilité, elle, **est** prédictible (persistance forte, effet de levier). C'est le meilleur rapport signal/effort de tout le projet, et ça alimente stops, sizing et régime |
| **Modèles de régime (HMM, clustering)** | ✅ V1.5 | Conditionner le modèle au régime évite le désastre classique du modèle entraîné en marché haussier |
| **Conformal prediction / quantile regression** | ✅ V1.5 | Intervalles de confiance avec garantie de couverture, sans hypothèse de distribution. Exactement ce qu'exige un produit qui vend de l'incertitude |
| **Calibration (isotonique, Platt)** | ✅ **Non négociable** | Sans elle, la « confiance à 82 % » est un chiffre décoratif. Mesure : diagramme de fiabilité + score de Brier |
| **Reinforcement learning** | ❌ | Voir §« ce que je coupe ». Reconsidérer un jour pour l'exécution seule |
| **Modèles hybrides** | ✅ **C'est l'architecture retenue** | GBDT (direction + méta-confiance) + HAR-RV (volatilité) + HMM (régime) + règles (risque). Chaque brique sur le problème où elle est la meilleure |

**Principe directeur :** mettre le machine learning là où le signal existe. Direction = signal
faible et instable → modèle simple, régularisé, humble. Volatilité, liquidité, coût d'exécution,
régime = signal réel → c'est là qu'on investit.

## 5.5 Master Decision Engine

Une fonction pure, lisible, versionnée, testée :

```
entrées : p_calibrée, direction, σ_prévue, régime, spread, profondeur,
          funding, coûts estimés, contexte du portefeuille
sorties : action ∈ {BUY, SELL, HOLD, WAIT, EXIT}, taille, stop, TP1, TP2, RR, raisons
```

Logique, dans cet ordre :

1. **Recevabilité** : données fraîches ? liquidité suffisante ? pas d'anomalie ? sinon → `WAIT`.
2. **Espérance nette** : `E = p·gain − (1−p)·perte − coûts` (frais + spread + slippage estimé +
   funding attendu sur l'horizon). Si `E ≤ seuil` → `WAIT`. **Beaucoup de signaux mourront ici, et
   c'est le but.**
3. **Seuil de conviction dépendant du régime** (plus exigeant en régime chaotique).
4. **Cohérence portefeuille** : corrélation aux positions ouvertes, exposition nette.
5. **Veto du Risk Engine** : la dernière porte, elle ne peut qu'interdire ou réduire.
6. **Génération des raisons** : attributions SHAP agrégées par famille, transformées en phrases par
   des gabarits. Le score de chaque « moteur » affiché **est** sa contribution réelle.

`HOLD` vs `WAIT` : `HOLD` = position ouverte, on la conserve ; `WAIT` = pas de position, conditions
insuffisantes. Les confondre rend le journal inexploitable.

---

# 6. Architecture data

## 6.1 Données par priorité

**Indispensables V1 (crypto) :**

| Donnée | Usage | Coût/volume |
|---|---|---|
| Trades (tick) | Barres maison, volume, agressivité | ~quelques centaines de Mo/jour pour 50 symboles, compressé |
| Top-of-book 1 s | Spread, microprix, liquidité | Faible |
| Profondeur agrégée ±10/25/50 bps, 1 s | Coût d'exécution, déséquilibre | Faible |
| Funding rate | Coût de portage, positionnement | Négligeable |
| Open interest | Positionnement, désengagement | Négligeable |
| Liquidations | Événements de capitulation | Négligeable |
| Mark/index price | Référence de liquidation | Négligeable |
| Spécifications d'instrument | Tick size, lot size, levier max, frais | Négligeable, **souvent oublié → backtest faux** |

**Utiles rapidement (V1.5) :** macro quotidienne (FRED : taux, DXY, VIX — gratuit), corrélations
inter-marchés, calendrier économique.

**Reportables (V2) :** news, sentiment, on-chain, fondamentaux actions, order book profond.

**Volumétrie réaliste V1** : 50 symboles, trades + snapshots 1 s ≈ **0,5 à 2 Go/jour** brut,
nettement moins en Parquet compressé (ZSTD). Sur un an : ~200–500 Go. Un seul disque NVMe suffit.
Une capture L2 complète sur les mêmes symboles ferait plusieurs To/mois : d'où l'exclusion.

## 6.2 Bitemporalité — le point qui sauve ou tue le projet

Chaque enregistrement porte **deux temps** :
- `event_time` : quand l'événement s'est produit sur le marché ;
- `ingestion_time` : quand nous l'avons su.

Toute requête de backtest est un « as-of » : *que savions-nous à t ?*. Sans cette discipline :
- les révisions de données macro font apparaître un pouvoir prédictif inexistant (le PIB « connu »
  en janvier n'est pas celui publié en janvier) ;
- un backfill tardif se retrouve utilisé « avant » son arrivée ;
- un flux réparé après coup rend le backtest meilleur que la réalité.

Corollaire : **le lac de données est immuable**. On n'écrase jamais ; on écrit une nouvelle version
avec son `ingestion_time`. Les corrections sont des insertions, pas des mises à jour.

## 6.3 Modèle de stockage

```
lac/                         Parquet, partitionné exchange/symbole/date, immuable
  raw/trades/… raw/book/… raw/funding/…
  bars/1m/… bars/1h/…       dérivés reproductibles, régénérables
  features/v3/…             matérialisées, versionnées par hash de code
opérationnel (Postgres + TimescaleDB)
  instruments, sessions, signaux, décisions, positions,
  runs de modèles, métriques, audit log
cache (Redis)
  dernier état par symbole, order book courant, verrous, streams
```

Pourquoi ce découpage : le lac est la **vérité** (rejouable, sauvegardable, versionnable) ; Postgres
porte l'**état** (transactions, contraintes, intégrité référentielle) ; Redis porte l'**instantané**
(volatile par nature). Chaque outil sur son terrain, et un seul SGBD à administrer.

## 6.4 Qualité des données — un service, pas un script

Contrôles en continu, avec alerte et effet sur la décision :
- **staleness** : dernier message par flux ; au-delà de N secondes, les signaux du symbole sont
  suspendus (pas dégradés : suspendus) ;
- **continuité** : numéros de séquence WebSocket, détection de trou → resynchronisation par snapshot ;
- **cohérence** : prix hors bande vs mark price, spread négatif, volume nul sur symbole liquide ;
- **dérive de distribution** : PSI/KS des features vs fenêtre de référence ;
- **horloge** : dérive NTP, comparaison timestamp exchange vs local.

Chaque contrôle produit une métrique et peut armer le kill switch. Un système de trading meurt
beaucoup plus souvent d'un flux corrompu que d'un mauvais modèle.
---

# 7. Architecture backend

## 7.1 Découpage en services

Cinq processus, pas dix-huit microservices. À ce stade, la frontière utile est celle du **domaine de
panne**, pas celle du diagramme.

| Service | Rôle | Peut mourir sans conséquence grave ? |
|---|---|---|
| `collector` | Connexions WS/REST, normalisation, publication sur le bus | Non — mais redémarrage rapide + backfill automatique |
| `writer` | Consomme le bus, écrit Parquet + Postgres | Oui, tant que le bus retient (rattrapage) |
| `engine` | Features → inférence → décision → risque → signal | Oui, le marché continue sans nous |
| `api` | REST + WebSocket pour le front, auth | Oui |
| `worker` | Tâches planifiées : backfill, rapports, recalculs, entraînements | Oui |
| *(V2)* `executor` | OMS, ordres, réconciliation | **Non — service critique, isolé, garde-fous propres** |

Un seul dépôt, un seul environnement Python, des processus séparés. Le passage aux vrais
microservices n'a de sens qu'avec une équipe et des cycles de déploiement indépendants.

## 7.2 Langage : soyons honnêtes sur la latence

Python (3.12+, asyncio, `uvloop`) tient sans difficulté 50–500 symboles à une cadence de la seconde.
Notre budget de latence de bout en bout — clôture de barre → signal affiché — est de **1 à 2 s**,
dont l'essentiel est le calcul de features et l'inférence (quelques ms avec LightGBM).

Rust ou Go se justifient uniquement si l'on descend sous les ~50 ms de bout en bout, c'est-à-dire si
la stratégie devient de la microstructure. **Écrire le collector en Rust « pour la performance »
alors qu'on prend des décisions à l'heure est de l'optimisation prématurée coûteuse.** Le seul
composant où j'accepterais un autre langage plus tôt : le maintien d'order books profonds
multi-symboles, si un jour on en fait.

## 7.3 Bus de messages

**V1 : Redis Streams.** Consumer groups, ack, relecture courte, une seule dépendance (Redis sert
déjà de cache). Suffisant pour des dizaines de milliers de messages/seconde.

**Quand migrer vers Redpanda (API Kafka) :** quand la relecture longue durée devient un besoin
opérationnel — rejouer trois jours de flux pour reconstruire un état, ou alimenter plusieurs
consommateurs indépendants avec des rétentions différentes. Pas avant.

**Kafka en V1 : non.** ZooKeeper/KRaft, rééquilibrages, partitionnement, monitoring — plusieurs
semaines d'ingénierie pour un problème qu'on n'a pas. Redpanda si vraiment besoin : un binaire.

La vraie garantie à mettre en place tout de suite n'est pas le broker mais l'**idempotence** :
chaque message porte une clé naturelle (`exchange, symbole, type, event_time, séquence`) et tous les
consommateurs sont rejouables sans effet de bord. Avec ça, « at least once » suffit et le choix du
broker devient réversible.

## 7.4 API

- **REST** (FastAPI) pour l'état, l'historique, la recherche, les actions.
- **WebSocket unique et multiplexé** pour le temps réel — pas une connexion par widget. Abonnements
  par canal, coalescence des mises à jour (au maximum 4 par seconde et par symbole : l'œil humain
  n'en demande pas plus, et ça divise par dix la charge front), backpressure explicite : si un
  client ne suit pas, on jette les images intermédiaires plutôt que d'accumuler.
- **Contrat typé** : schémas Pydantic → OpenAPI → types TypeScript générés. Zéro type écrit à la
  main côté front.
- **Séparation lecture/écriture** : les endpoints qui déclenchent une action (armer un mode, valider
  un ordre en V2) passent par un chemin distinct, journalisé, avec confirmation explicite.

## 7.5 Le composant le plus sous-estimé : la bibliothèque de features

Un module Python pur, sans I/O, testé, versionné par hash :

```python
def compute_features(window: MarketWindow, spec: FeatureSpec) -> FeatureVector
```

- **Un seul code** pour le live et l'offline. Toute duplication finit en divergence silencieuse.
- **Aucun accès réseau ou base** : on lui passe une fenêtre de données déjà chargée.
- **Déterministe** : mêmes entrées → mêmes sorties, testé par property-based testing.
- **Versionné** : `features_v3` est immuable ; une modification crée `v4`. Les modèles référencent
  une version de features ; on ne « corrige » jamais une feature sous un modèle en production.

Test d'or, à écrire avant le premier modèle : rejouer une journée en mode live simulé, recalculer la
même journée en offline, exiger l'égalité stricte. Tant que ce test n'existe pas, aucun résultat de
backtest n'a de valeur.

---

# 8. Architecture frontend

## 8.1 Parti pris

Un terminal, pas un dashboard. Concrètement : densité élevée, chiffres tabulaires monospacés, aucune
animation décorative, palette sombre neutre où **la couleur est un signal, pas une décoration**
(vert/rouge réservés à la direction et au P&L ; ambre = attention ; tout le reste en niveaux de
gris). Navigation clavier de bout en bout, palette de commandes (`⌘K`) pour tout atteindre sans
souris.

Écrans, par ordre d'usage :

1. **Marchés** — grille dense : symbole, prix, variation, volatilité, funding, OI, spread, score,
   état. Tri et filtre instantanés, virtualisée (500 lignes sans ramer).
2. **Signal** — la vue centrale. Action, confiance **avec son intervalle**, entrée/stop/TP, RR,
   espérance nette après coûts, contributions par famille, condition d'invalidation, historique des
   signaux comparables et leur issue réelle.
3. **Positions & portefeuille** *(V2)* — exposition, risque agrégé, corrélations, marge.
4. **Journal** — chaque signal, sa décision, son issue, sa durée, son drawdown ; filtrable.
5. **Performance & calibration** — diagramme de fiabilité, Brier, métriques par régime. *C'est
   l'écran qui distingue un produit sérieux : il montre quand le système se trompe.*
6. **Santé système** — flux, latences, versions de modèles, dérive, état du kill switch.

## 8.2 Stack front et arbitrages

| Besoin | Choix | Pourquoi pas l'alternative |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | Svelte/Solid excellents mais l'écosystème de composants de données (grilles, graphiques financiers) est en React |
| Graphiques prix | **TradingView Lightweight Charts** | Gratuit, conçu pour ça, performant. D3 from scratch = des semaines ; Chart.js/Recharts ne tiennent pas la charge temps réel |
| Grilles | TanStack Table + virtualisation (AG Grid si besoin de plus) | Une table HTML classique s'effondre à 500 lignes × 10 Hz |
| État serveur | TanStack Query | Cache, invalidation, retry gérés |
| État client | Zustand | Redux = cérémonie inutile ici |
| Style | Tailwind + tokens de design | Cohérence sans usine à CSS |
| Temps réel | WS natif + store dédié, coalescence par frame | Socket.io inutile (pas de fallback nécessaire) |

**Piège de performance principal** : re-rendre l'app à chaque tick. Solution : les mises à jour
haute fréquence n'entrent pas dans l'état React — elles vont dans un store externe avec abonnement
par cellule et rendu groupé sur `requestAnimationFrame`.

**Mobile** : lecture seule et alertes. Un terminal dense sur 390 px est un mensonge ergonomique ;
on assume une vue mobile réduite (alertes, liste des signaux, détail) plutôt qu'un terminal
compressé.

---

# 9. Architecture trading (exécution — V2)

Section volontairement détaillée : c'est là que les bugs coûtent de l'argent réel.

## 9.1 Principes

1. **L'exchange est la seule source de vérité.** Notre base est un cache, jamais une référence. Une
   boucle de réconciliation compare en continu positions/ordres locaux et distants ; en cas
   d'écart, on suspend et on alerte — on ne « corrige » pas automatiquement.
2. **Idempotence de bout en bout.** Chaque intention d'ordre a un `client_order_id` déterministe.
   Rejouer la même intention ne crée jamais un second ordre.
3. **Machine à états explicite** : `INTENDED → SUBMITTED → ACKED → PARTIAL → FILLED / CANCELED /
   REJECTED / UNKNOWN`. L'état `UNKNOWN` (timeout réseau) est le plus important : il déclenche une
   requête de réconciliation avant toute nouvelle action, jamais un renvoi aveugle.
4. **Séparation physique paper/live** : processus distincts, bases distinctes, clés distinctes,
   couleur d'interface distincte. Aucun booléen `is_live` dans le code de décision — c'est le
   mécanisme par lequel on finit par trader en réel « par accident ».
5. **Garde-fou de dernier niveau** dans l'`executor`, indépendant du Risk Engine : notionnel maximal
   par ordre, par symbole, par jour, en dur dans la configuration signée. Si le Risk Engine a un
   bug, cette barrière tient encore.

## 9.2 Ce dont on hérite du monde réel

- Rate limits par exchange (poids par endpoint) → budget de requêtes centralisé, avec priorité aux
  annulations sur les créations.
- Reconnexions WebSocket avec backoff exponentiel + resynchronisation par snapshot.
- Ordres réduits par les règles de l'instrument (tick/lot/notional minimum) → arrondi **avant**
  l'envoi, testé.
- Frais maker/taker, funding, éventuellement rabais VIP → modélisés une seule fois, partagés entre
  exécution et backtest.
- **Cancel-on-disconnect / dead man's switch** natif quand l'exchange le propose (certains, comme
  Deribit ou les futures Binance, exposent une annulation automatique après N secondes sans
  heartbeat). À armer systématiquement : si notre système meurt, les ordres meurent avec lui.

## 9.3 Modes

| Mode | Ce que fait le système | Garde-fous |
|---|---|---|
| **ANALYST** | Analyse et signale. Aucun ordre. | Aucun risque financier direct |
| **COPILOT** | Prépare un ordre complet ; l'humain valide. | Expiration de la proposition (ex. 60 s), revalidation du prix et du risque au moment du clic, refus si le marché a bougé au-delà d'un seuil |
| **AUTONOMOUS** | Exécute selon des règles strictes. | Liste blanche de symboles, plafond de notionnel, plage horaire, **autorisation à durée limitée** (expire au bout de N heures sans renouvellement humain), heartbeat obligatoire, kill switch armé |

Le changement de mode est un événement audité, avec auteur, horodatage, raison et signature de la
configuration active. **AUTONOMOUS n'est pas un interrupteur** : c'est une autorisation périmable,
par stratégie et par symbole.

---

# 10. Risk Engine

Le composant le plus important du produit — et celui qui ne contient **aucune** intelligence
artificielle. Il doit être lisible ligne à ligne par un humain fatigué à 3 h du matin.

## 10.1 Dimensionnement

Base : **risque fractionnaire fixe**. On risque `r` % du capital par trade (typiquement 0,25–1 %),
la taille se déduit de la distance au stop :

```
taille = (capital × r) / |entrée − stop|
```

puis on applique successivement :
- plafond de notionnel par position et par symbole ;
- plafond de **participation à la liquidité** (ex. ≤ 1 % du volume moyen sur l'horizon prévu, et
  ≤ X % de la profondeur à 25 bps) — c'est ce qui empêche de croire qu'on peut prendre une position
  qui bougerait le marché à elle seule ;
- ajustement par volatilité prévue (si σ double, la taille est divisée) ;
- **haircut de corrélation** : l'exposition qui compte est celle du portefeuille, pas du trade. En
  crypto, tout est corrélé à BTC : trois « trades différents » peuvent être une seule position
  triplée.

**Sur Kelly** : mathématiquement optimal en croissance *si* l'espérance est connue. Elle ne l'est
pas, elle est estimée avec une erreur importante, et Kelly est brutalement sensible à cette erreur —
surestimer l'edge de 30 % suffit à transformer la croissance optimale en ruine. Si on l'utilise :
**quart de Kelly maximum**, plafonné par les règles ci-dessus, jamais comme mécanisme principal.

## 10.2 Limites, en couches

| Niveau | Limite | Réaction au dépassement |
|---|---|---|
| Trade | risque max, RR minimum, liquidité minimale, spread maximal | Refus du signal |
| Symbole | exposition max, nombre de positions | Refus ou réduction |
| Cluster corrélé | exposition nette max par groupe (bêta BTC, secteur) | Refus |
| Portefeuille | exposition brute/nette, marge utilisée, VaR simple par bootstrap historique | Refus + alerte |
| Journalier | perte quotidienne max, nombre de trades max, pertes consécutives max | **Arrêt des entrées** jusqu'au lendemain |
| Global | drawdown max depuis le plus haut | **Kill switch** |

Note importante sur les pertes consécutives : c'est un déclencheur psychologiquement satisfaisant
mais statistiquement faible (5 pertes d'affilée avec un taux de réussite de 50 % arrivent 3 % du
temps, soit régulièrement). À utiliser comme **alerte**, pas comme preuve que le modèle est cassé.

## 10.3 Risques spécifiques

- **Liquidité** : profondeur et spread à l'instant de la décision, pas en moyenne. Un symbole peut
  être liquide en moyenne et introuvable à 3 h du matin.
- **Volatilité** : régime de volatilité en entrée du sizing ; refus d'entrer dans les minutes qui
  suivent un choc (le stop y est mécaniquement traversé).
- **News/événement** : fenêtre d'exclusion autour des annonces macro connues (calendrier), et en
  V2 autour des événements détectés. Simple, très efficace.
- **Funding** : sur perpétuels, un funding extrême change l'espérance du trade. Il entre dans le
  calcul de coût, pas seulement dans les features.
- **Modèle** : dérive détectée, calibration dégradée, features hors distribution → réduction
  automatique de la taille (facteur de confiance système), puis suspension.

## 10.4 Kill switch

Trois niveaux, avec des effets distincts — **couper n'est pas liquider** :

1. **HALT ENTRIES** — plus de nouvelles positions, les existantes vivent avec leurs stops.
   Déclencheurs : perte quotidienne, dérive de données, latence anormale, désaccord de
   réconciliation, échec de contrôle qualité.
2. **HALT ALL** — plus aucun ordre sauf les protections (stops déjà en place). Déclencheurs :
   drawdown max, erreur exchange répétée, flux figé, incohérence positions.
3. **FLATTEN** — liquidation de tout. **Déclenchement manuel uniquement**, ou automatique sur
   critère extrême et rarissime. Raison : liquider automatiquement pendant un flash crash, dans un
   carnet vide, c'est réaliser la perte maximale au pire moment. Un stop déjà placé chez l'exchange
   protège souvent mieux qu'une liquidation paniquée par notre propre code.

Complément : **dead man's switch**. L'`executor` exige un heartbeat signé du service de risque ;
sans heartbeat pendant N secondes, il refuse tout nouvel ordre et laisse l'annulation automatique
de l'exchange faire le ménage.

---

# 11. Backtesting

Le backtest n'est pas là pour montrer que la stratégie gagne. **Il est là pour essayer de prouver
qu'elle ne marche pas.** Toute la conception découle de ce renversement.

## 11.1 Deux moteurs, une vérité

- **Vectoriel** (pandas/polars) : rapide, pour balayer des hypothèses. Approximations assumées.
- **Événementiel** : rejoue les événements dans l'ordre, avec latence, carnet, frais, partiels.
  Lent, fidèle, fait autorité.

**Test de concordance obligatoire** : sur une stratégie canonique simple, les deux moteurs doivent
produire des P&L identiques à une tolérance serrée. Sans ce test, le moteur rapide dérive et on
optimise sur une fiction. À écrire dès le début, pas « plus tard ».

## 11.2 Les biais, et le mécanisme concret qui les empêche

| Biais | Mécanisme de protection |
|---|---|
| **Look-ahead** | Requêtes bitemporelles obligatoires ; décision à la clôture de barre, exécution à l'ouverture suivante + latence ; test de rejeu live/offline bit-à-bit |
| **Survivorship** | Univers historique incluant les symboles délistés/expirés, avec leurs dates. En crypto, les paires disparaissent souvent — les ignorer embellit tout |
| **Data leakage** | Purge + embargo dans la CV ; normalisation ajustée **sur le train uniquement** ; aucune statistique globale calculée sur l'ensemble des données |
| **Overfitting** | Nombre d'essais journalisé, Deflated Sharpe Ratio, Probability of Backtest Overfitting, modèle simple préféré à qualité comparable |
| **Slippage irréaliste** | Modèle de coût = spread/2 + impact `k·σ·√(Q/ADV)` + latence ; calibré ensuite sur nos exécutions réelles |
| **Frais irréalistes** | Table de frais par exchange et par niveau, funding inclus, coût de portage des shorts |
| **Cherry picking** | Fenêtre de test verrouillée, touchée deux fois maximum ; toute stratégie testée reste au registre, y compris les échecs |

Le dernier point est le plus difficile parce qu'il est humain : le registre des hypothèses testées
n'a d'intérêt que si l'on y inscrit **aussi** les tentatives ratées. Sans ce compte, on ne peut pas
corriger la significativité pour les tests multiples, et un Sharpe de 2 obtenu au 300ᵉ essai ne vaut
rien.

## 11.3 Protocole de validation

```
1. Développement          70 % des données les plus anciennes, CV purgée
2. Walk-forward           fenêtres glissantes : entraîner sur N mois, tester sur le mois suivant,
                          réentraîner, avancer. C'est le seul test proche de la réalité
3. Out-of-sample verrouillé   les 15 % les plus récents. Deux consultations maximum, journalisées
4. Monte Carlo            bootstrap par blocs (préserve l'autocorrélation), permutation de l'ordre
                          des trades, perturbation des coûts (+50 % de slippage)
5. Stress                 crash 2020, effondrement 2022, mèches de faible liquidité,
                          panne de flux, exchange indisponible, funding extrême
6. Paper trading          minimum 8 semaines, comparé au backtest sur la même période :
                          tout écart significatif est un bug, pas de la malchance
```

## 11.4 Métriques

Performance : CAGR, Sharpe, Sortino, Calmar, profit factor, expectancy (en R), win rate, trade
moyen, max drawdown, temps sous l'eau, exposition, turnover.

Robustesse : **Deflated Sharpe Ratio** (corrigé du nombre d'essais), **Probabilistic Sharpe Ratio**,
PBO, sensibilité aux coûts, stabilité par sous-période, capacité estimée.

Risque : risque de ruine estimé par bootstrap sur la distribution empirique des trades (pas par la
formule fermée, dont les hypothèses sont fausses ici), VaR/ES historique, pire série.

**Qualité probabiliste — spécifique à ce produit** : score de Brier, log-loss, diagramme de
fiabilité, ECE, résolution/raffinement. Si la calibration est bonne mais la performance médiocre, le
système reste utile en mode ANALYST. Si la calibration est mauvaise, la confiance affichée est un
mensonge et le produit est cassé, quel que soit le P&L.

Tout rapport de backtest est un **artefact versionné** : code, données, config, seed, résultats, et
un identifiant unique. Un résultat non reproductible est nul et non avenu.

---

# 12. Pipeline ML et boucle d'apprentissage

## 12.1 Cycle de vie d'un modèle

```
DONNÉES (immuables, bitemporelles)
   └→ ENTRAÎNEMENT        code + config + seed versionnés, CV purgée
        └→ VALIDATION     hors échantillon, calibration, tests de sanité
             └→ BACKTEST  moteur événementiel, coûts réalistes
                  └→ WALK-FORWARD    performance hors échantillon glissante
                       └→ SHADOW     tourne en production, prédit, ne trade pas (≥ 4 semaines)
                            └→ PAPER TRADING   ordres simulés, exécution réaliste (≥ 8 semaines)
                                 └→ APPROBATION HUMAINE   décision signée, critères écrits
                                      └→ PRODUCTION      pointeur de version, canari possible
                                           └→ SURVEILLANCE → ROLLBACK si dérive
```

Points non négociables :

- **Aucun apprentissage en ligne en production.** Jamais. Un modèle en production est un artefact
  figé et immuable.
- **Le réentraînement est planifié** (ex. mensuel), pas déclenché par une mauvaise performance.
  Réentraîner après un drawdown, c'est apprendre le bruit récent et acheter le sommet du surapprentissage.
- **Shadow mode** : la nouvelle version consomme exactement les mêmes entrées et journalise ses
  décisions sans agir. On compare décisions, calibration, et taux de désaccord avec la production.
- **Rollback** = changer un pointeur de version + réconcilier les positions ouvertes. Testé
  régulièrement, comme une sauvegarde : un rollback jamais répété ne fonctionne pas.
- **Champion/challenger** : au plus un challenger en shadow à la fois. Deux challengers, c'est déjà
  du test multiple déguisé.

## 12.2 Ce qu'on enregistre pour chaque signal

Exactement la liste demandée, plus ce qui manque pour être exploitable :

```
identité      : id, actif, exchange, timestamp de décision, version de features,
                version de modèle, hash de config, mode
contexte      : prix, spread, profondeur, volatilité, funding, OI, régime,
                snapshot complet du vecteur de features
décision      : action, direction, probabilité brute, probabilité calibrée,
                intervalle, taille proposée, stop, TP1, TP2, RR, espérance nette
raisons       : attributions par famille, règles déclenchées, condition d'invalidation
exécution     : (V2) prix réel, slippage, frais, latence, fills partiels
issue         : barrière touchée, P&L en R, durée, MAE/MFE (drawdown et gain maximum
                pendant la vie du trade), régime de marché pendant la vie du trade
contrefactuel : issue simulée des signaux NON pris, avec le même protocole
```

Les deux derniers points font la différence. **MAE/MFE** dit si le stop était trop serré ou le TP
trop ambitieux — information invisible dans le P&L final. Et surtout, en trading, on peut
**évaluer les contrefactuels** : contrairement à la publicité ou à la recommandation, le prix se
forme que l'on soit entré ou non. Ne pas exploiter ça, c'est se condamner à apprendre sur un
échantillon biaisé par ses propres décisions.

## 12.3 Ce que la boucle d'apprentissage peut et ne peut pas faire

**Peut** : détecter une dérive de calibration, révéler qu'une famille de features a cessé de
contribuer, montrer que la performance vient d'un seul régime, mesurer l'écart backtest/réel,
identifier des configurations systématiquement mal évaluées.

**Ne peut pas** : « s'améliorer toute seule ». Avec quelques centaines de trades par an, le signal
d'apprentissage est trop faible pour ajuster un modèle en continu. Le rythme réaliste est un
réentraînement mensuel et une revue trimestrielle de l'architecture des features. **Un système qui
apprend vite de ses trades est un système qui overfitte vite.**

---

# 13. Sécurité

## 13.1 Modèle de menace, par ordre de probabilité réelle

1. **Nous-mêmes** : bug qui envoie 100 ordres, mauvaise config poussée en production, paper qui
   devient live par erreur. **De loin le risque n°1.**
2. **Données corrompues** : flux figé sur un prix, décimale déplacée, backfill qui écrase du réel.
3. **Fuite de clés API** : dépôt, logs, capture d'écran, dépendance compromise.
4. **Compromission de la machine** : accès à distance, dépendance malveillante.
5. **Attaquant externe ciblé** : peu probable tant que le système est privé et sans utilisateurs.

L'ordre compte : il dit où mettre l'effort. Les protections contre soi-même passent avant le
durcissement réseau.

## 13.2 Mesures

**Clés et secrets**
- Clés exchange **sans droit de retrait**, restreintes par IP, une paire par environnement
  (paper/live), portée minimale.
- Secrets dans un gestionnaire dédié (SOPS + age en solo, Vault/Infisical ensuite), jamais en clair
  ni dans l'image Docker. Rotation planifiée et testée.
- Scan de secrets en pre-commit et en CI (gitleaks) — c'est la fuite la plus banale.

**Séparation**
- Environnements paper et live totalement disjoints : processus, base, clés, couleur d'interface,
  fichier de config. Passer en live doit être un acte administratif, pas un drapeau.
- Le service d'exécution n'expose aucune API publique et n'accepte d'ordres que du moteur, signés.

**Intégrité**
- Configuration de production signée et vérifiée au démarrage ; refus de démarrer si le hash ne
  correspond pas à la version approuvée.
- Artefacts de modèles hashés et vérifiés au chargement.
- Journal d'audit append-only (qui, quoi, quand, pourquoi) pour tout changement de mode, de limite,
  de modèle, et pour toute intervention manuelle.

**Robustesse applicative**
- Rate limiting côté client (budget de requêtes) et côté API.
- Circuit breakers par dépendance externe, avec dégradation explicite (suspendre plutôt que deviner).
- Validation stricte de toutes les entrées externes, y compris celles de l'exchange : un message
  malformé ou aberrant ne doit jamais atteindre le moteur de décision.
- Chiffrement en transit partout ; chiffrement au repos du disque ; sauvegardes chiffrées et
  **restauration testée** (une sauvegarde jamais restaurée n'existe pas).

**Accès**
- V1 mono-utilisateur : pas de système de comptes maison. Reverse proxy + OIDC (ou passkey WebAuthn),
  service non exposé publiquement, VPN/Tailscale de préférence.
- Multi-utilisateur (si un jour) : fournisseur d'identité éprouvé, MFA obligatoire, RBAC, isolation
  stricte des données par tenant. Ne pas écrire son propre système d'authentification.

---

# 14. Scalabilité

## 14.1 Ce qu'il faut vraiment tenir

Objectif honnête V1 : **50–200 symboles, décisions à la barre (1 m au plus fin), latence < 2 s.**
Cela tient sur **une seule machine** correctement dimensionnée (8–16 cœurs, 32–64 Go de RAM, NVMe).
Prétendre le contraire mène à construire une infrastructure distribuée pour un problème qui n'existe
pas.

Ordres de grandeur : 200 symboles × 1 snapshot/s = 200 msg/s — trois ordres de grandeur sous ce que
tient Redis. Le vrai goulot est ailleurs : le **calcul de features** et les **écritures disque**.

## 14.2 Leviers, dans l'ordre où on les tire

1. **Partitionnement par symbole** : le traitement est parallèle par nature. Un pool de workers, un
   symbole traité par un seul worker à la fois (ordonnancement garanti par symbole).
2. **Calcul incrémental** : les features glissantes se mettent à jour en O(1) à la clôture de barre.
   Recalculer 500 barres à chaque tick est l'erreur classique qui coûte 100× le nécessaire.
3. **Batching de l'inférence** : LightGBM prédit des milliers de lignes d'un coup ; on regroupe tous
   les symboles d'une même clôture de barre.
4. **Écritures groupées** : accumulation en mémoire, flush périodique en Parquet ; jamais une écriture
   par message.
5. **Cache** : dernier état en Redis, features chaudes en mémoire de process, TTL courts et explicites.
6. **Scale horizontal** : ajouter des workers (sans état, partitionnés par symbole) avant d'ajouter
   des services. Le collector, lui, reste unique par exchange — le dupliquer crée des doublons et
   des problèmes d'ordonnancement.

**GPU** : inutile pour GBDT. Ne devient pertinent que pour l'entraînement de modèles séquentiels ou
de LLM — auquel cas on loue à l'heure. **Aucune raison d'acheter du GPU pour ce projet.**

**Haute disponibilité** : à ne pas confondre avec la scalabilité. En ANALYST, une coupure ne coûte
que des signaux manqués — redémarrage automatique + backfill suffisent. En AUTONOMOUS, la question
change : la bonne réponse n'est pas « deux instances actives » (risque de double envoi d'ordres) mais
**un seul actif, un veilleur passif, et une annulation automatique côté exchange si l'actif meurt**.
En trading, mourir proprement vaut mieux que continuer à moitié.
---

# 15. Réglementation — zones à faire vérifier

**Je ne suis pas juriste et ceci n'est pas un avis juridique.** Ce qui suit identifie les zones qui
exigent une vérification par un avocat spécialisé en réglementation financière (France/UE), et
signale où se situent les vraies falaises.

## 15.1 Usage strictement personnel (le propriétaire uniquement)

Zone la plus simple, mais pas vide :
- **Conditions d'utilisation des exchanges** : usage des API, limites de débit, interdiction de
  certains comportements (spoofing, layering, wash trading) — même non intentionnels, un bug
  d'algorithme peut produire un motif d'ordres qui ressemble à de la manipulation.
- **Abus de marché (MAR)** : s'applique aux personnes physiques. Sur actions, un algorithme mal
  réglé peut créer des motifs problématiques.
- **Fiscalité** : régime des plus-values crypto vs actions, obligations déclaratives, comptes
  détenus à l'étranger (déclaration des comptes d'actifs numériques ouverts hors de France).
- **Assurance et responsabilité** : aucune, c'est votre argent.

À vérifier : traitement fiscal du trading algorithmique fréquent (le passage d'un régime privé à un
régime professionnel dépend de critères de fréquence et d'organisation).

## 15.2 Donner des signaux à d'autres utilisateurs — **la plus grosse falaise du projet**

Le passage de « pour moi » à « pour d'autres » change de métier, même gratuitement, même « à titre
informatif ».

- **Conseil en investissement** : recommandation personnalisée sur un instrument financier →
  activité réglementée (en France, statut CIF, immatriculation ORIAS, adhésion à une association
  agréée, contrôle AMF). La frontière entre « recommandation générale » et « conseil personnalisé »
  est précisément le point à faire trancher : un signal produit pour un utilisateur, dans son
  contexte, penche du mauvais côté.
- **Recommandation d'investissement (règlement Abus de marché / délégué 2016/958)** : obligations de
  présentation objective, d'identification de l'auteur, de divulgation des conflits d'intérêts, de
  conservation des recommandations passées.
- **MiCA** (crypto, applicable depuis fin 2024) : le conseil sur crypto-actifs et la gestion de
  portefeuille de crypto-actifs sont des services listés, soumis à agrément CASP.
- **Publicité et démarchage** : encadrement strict de la promotion de produits financiers et
  crypto ; interdictions et mentions obligatoires ; influence sur la façon dont le produit peut être
  présenté.
- **RGPD** dès qu'il y a des utilisateurs identifiés.
- **Archivage** : conservation des recommandations et des communications.

À vérifier en priorité : la qualification exacte du produit (outil d'aide à la décision vs conseil),
car elle détermine tout le reste. Une même fonctionnalité peut basculer selon la formulation de
l'interface — dire « BUY » à un utilisateur n'a pas le même statut que présenter des probabilités et
des scénarios.

## 15.3 Exécuter automatiquement pour des utilisateurs

Encore un cran au-dessus :
- **Gestion de portefeuille pour compte de tiers** ou **réception-transmission d'ordres** → agrément
  (AMF/ACPR) selon la structure ; MiCA pour la partie crypto.
- **Garde des actifs** : à éviter absolument. Modèle le moins risqué : les clés API restent celles de
  l'utilisateur, sans droit de retrait — mais cela ne suffit probablement pas à échapper à la
  qualification si le système décide et exécute.
- **Responsabilité en cas de perte** : bug, panne, mauvaise exécution — assurance responsabilité
  civile professionnelle, plafonds contractuels (dont l'opposabilité au consommateur est limitée).
- **DORA** : exigences de résilience opérationnelle si l'on devient une entité financière régulée.
- **Reporting et lutte anti-blanchiment** selon la structure retenue.

## 15.4 Commercialisation SaaS

- Cumul des points 15.2 et 15.3 selon le service rendu, plus :
- **Droit de la consommation** : information précontractuelle, rétractation, clauses abusives.
- **Marketing** : interdiction des promesses de performance ; les mentions de performances passées
  sont très encadrées. *Un site qui affiche « +180 % » est un problème juridique avant d'être un
  problème d'honnêteté.*
- **AI Act (UE)** : à vérifier — le trading algorithmique n'est pas explicitement classé « haut
  risque » (contrairement à la notation de crédit), mais des obligations de transparence et de
  documentation s'appliquent probablement, et l'analyse doit être refaite à froid.
- **TVA et facturation** transfrontalière ; structure sociale.
- **Propriété intellectuelle** : licences des données de marché — la plupart des fournisseurs
  interdisent la redistribution, y compris dérivée. **Afficher un prix à un utilisateur tiers peut
  violer un contrat de données**, indépendamment de toute réglementation financière.

## 15.5 Recommandation pratique

Rester en 15.1 aussi longtemps que possible. Concevoir dès maintenant en gardant le multi-tenant
*possible* (isolation des données, notion de compte) sans l'*activer*. Avant tout utilisateur, même
un ami, même gratuitement : consultation juridique. Le coût d'une consultation est négligeable face
au coût d'une régularisation.

---

# 16. Stack technique recommandée

| Domaine | Recommandation | Alternatives écartées et pourquoi |
|---|---|---|
| Langage backend | **Python 3.12** (asyncio, uvloop) | Rust/Go : gain de latence inutile à notre horizon, coût d'écriture ×3. Node : écosystème quant inexistant |
| Calcul | **Polars** (+ pandas là où c'est nécessaire), NumPy, Numba au besoin | Pandas seul : trop lent sur les gros balayages. Spark : absurde à cette échelle |
| API | **FastAPI + Pydantic v2** | Django trop lourd, Flask trop nu |
| Base opérationnelle | **PostgreSQL 16 + TimescaleDB** | Une seule base à administrer, hypertables pour les séries récentes |
| Analytique / backtest | **Parquet + DuckDB** | ClickHouse : excellent mais un service de plus ; à envisager si les scans dépassent la minute. InfluxDB : écarté (instabilité des versions, mauvais ajustement) |
| Cache / bus | **Redis 7** (Streams + structures) | Kafka en V1 : taxe opérationnelle. Redpanda quand la relecture longue devient un besoin |
| ML | **LightGBM**, scikit-learn, Optuna, SHAP, statsmodels/arch (GARCH) | PyTorch seulement quand un modèle séquentiel sera justifié |
| Suivi d'expériences | **MLflow** (self-hosted) | W&B excellent mais SaaS payant ; MLflow suffit et reste local |
| Feature store | **Aucun** — un module de features versionné | Feast : complexité prématurée. La discipline compte, pas l'outil |
| Orchestration | **Prefect** ou **Dagster** (Dagster si l'on veut la lignée des données) | Airflow : lourd pour un solo. Cron pur : suffisant les premières semaines |
| Frontend | **React 18 + TS + Vite + Tailwind + TanStack + Lightweight Charts** | Voir §8 |
| Tests | pytest, hypothesis (property-based), pytest-benchmark | Le property-based testing est particulièrement adapté aux features et au moteur de risque |
| Qualité | ruff, mypy (strict sur les modules critiques), pre-commit, gitleaks | |
| Conteneurs | **Docker Compose**, une machine | Kubernetes : non, et probablement jamais pour ce produit |
| Observabilité | Prometheus + Grafana, Loki, Sentry, OpenTelemetry | Datadog : très bien, cher ; à réserver au moment où le temps vaut plus que l'argent |
| Alertes | Telegram Bot API (V1) | Push mobile plus tard. Email : trop lent pour du marché |
| CI/CD | GitHub Actions (lint, tests, backtest de régression) | |
| Secrets | SOPS + age (solo) → Infisical/Vault (équipe) | |
| Hébergement | 1 serveur dédié (Hetzner/OVH) + disque NVMe + sauvegardes chiffrées hors site | Cloud managé : 3 à 5× le prix pour ce profil de charge. Latence vers l'exchange : choisir la région du datacenter de l'exchange (souvent Tokyo/Singapour pour les majors crypto) |

**Un test de régression de backtest en CI** est le garde-fou le plus rentable du projet : à chaque
commit, rejouer une période figée avec une stratégie de référence et vérifier que le P&L est
identique au centime. Toute dérive silencieuse dans les features, les coûts ou l'ordonnancement est
attrapée immédiatement.

---

# 17. Structure du repository

Monorepo, un environnement Python, des frontières claires par package.

```
apex/
├── README.md
├── docs/
│   ├── APEX-DESIGN.md              ce document
│   ├── adr/                        décisions d'architecture (1 fichier = 1 décision, datée)
│   ├── runbooks/                   que faire quand X casse
│   └── research/                   notes d'expériences, hypothèses testées (succès ET échecs)
│
├── libs/
│   ├── core/                       types, temps, argent (Decimal), erreurs, config
│   ├── marketdata/                 modèles normalisés (Trade, Book, Bar, Funding…)
│   ├── features/                   ⚠️ bibliothèque de features, pure et versionnée
│   ├── labeling/                   triple-barrière, meta-labels, poids d'échantillon
│   ├── models/                     entraînement, calibration, registre, chargement
│   ├── risk/                       ⚠️ moteur de risque déterministe
│   ├── decision/                   politique de décision, génération des raisons
│   ├── backtest/                   moteur vectoriel + événementiel, coûts, métriques
│   └── storage/                    accès Parquet/Postgres/Redis, requêtes bitemporelles
│
├── services/
│   ├── collector/                  connecteurs exchange, normalisation, publication
│   ├── writer/                     persistance depuis le bus
│   ├── engine/                     features → inférence → décision → signal
│   ├── api/                        REST + WebSocket
│   ├── worker/                     tâches planifiées, rapports, entraînements
│   └── executor/                   [V2] OMS, ordres, réconciliation — isolé
│
├── web/                            terminal React
│   └── src/{app,components,charts,stores,api,styles}
│
├── research/                       notebooks (jetables) + scripts reproductibles
├── tests/
│   ├── unit/  integration/  property/
│   ├── golden/                     jeux figés : live vs offline, régression de backtest
│   └── chaos/                      flux coupé, exchange en erreur, horloge décalée
│
├── config/                         environnements, limites, univers (versionnés, signés)
├── ops/                            docker-compose, Grafana, Prometheus, sauvegardes
└── scripts/                        backfill, migration, outils d'exploitation
```

Deux règles structurantes :
- `libs/` ne dépend jamais de `services/` (le cœur métier est testable sans infrastructure) ;
- `features/` et `risk/` ont une couverture de tests exigée proche de 100 % — ce sont les deux
  endroits où un bug est silencieux et coûteux.

---

# 18. Roadmap de développement

Hypothèse : **un développeur compétent, ~20 h/semaine.** Multiplier par 2 à 2,5 pour un temps très
partiel ou une montée en compétence sur le domaine.

| Phase | Contenu | Durée estimée | Sortie vérifiable |
|---|---|---|---|
| **P0 — Socle** | Repo, CI, Docker, config, logs, métriques, types de base | 2 sem. | `docker compose up` démarre tout, CI verte |
| **P1 — Données** | Collector 1 exchange, normalisation, bus, écriture Parquet+PG, backfill 24 mois, contrôles qualité | 4–5 sem. | 30 jours de données sans trou, contrôles au vert |
| **P2 — Features** | Bibliothèque versionnée, calcul online + offline, **test d'or live/offline** | 3 sem. | Égalité bit-à-bit prouvée |
| **P3 — Recherche** | Labels triple-barrière, CV purgée, baselines, LightGBM, calibration | 4 sem. | Rapport reproductible, calibration mesurée |
| **P4 — Backtest** | Moteur vectoriel + événementiel, coûts, métriques, concordance, walk-forward | 4–5 sem. | Deux moteurs concordants, DSR calculé |
| **P5 — Décision & risque** | Politique de décision, Risk Engine, kill switch, génération des raisons | 3 sem. | Tests unitaires exhaustifs, refus corrects |
| **P6 — Produit** | API, terminal (marchés, signal, journal, santé), alertes Telegram | 5–6 sem. | Utilisable quotidiennement en ANALYST |
| **P7 — Boucle** | Journal des signaux + contrefactuels, suivi d'issue, rapport de calibration, MLflow, promotion/rollback | 3 sem. | Première revue de performance mensuelle |
| — | **Fin de la V1 : ~28–32 semaines** | | |
| **P8 — Paper trading** | Simulateur d'exécution réaliste, comparaison backtest/paper | 4 sem. | 8 semaines de paper documentées |
| **P9 — COPILOT** | OMS, idempotence, réconciliation, garde-fous, dead man's switch, live/paper séparés | 6–8 sem. | Ordres réels validés à la main, réconciliation propre |
| **P10 — V2 fonctionnelle** | News/sentiment ou actions ou on-chain — **une seule à la fois** | 6–10 sem. chacune | |
| **P11 — AUTONOMOUS** | Autorisations périmables, canari, surveillance renforcée | 4 sem. + 3 mois d'observation | |

**Ce qui prendra plus de temps que prévu** (systématiquement) : la qualité des données, la
réconciliation d'exécution, et le débogage des écarts backtest/réel. Ce qui en prendra moins :
l'entraînement des modèles. Le ratio réel de ce type de projet est d'environ **70 % data +
infrastructure, 20 % produit, 10 % ML**. Toute planification qui inverse ces proportions est fausse.

---

# 19. Difficulté par module

Échelle 1–5 (1 = mécanique, 5 = expertise pointue + itérations longues). « Piège » = là où l'on
croit avoir fini alors qu'on commence.

| Module | Diff. | Effort | Piège principal |
|---|---|---|---|
| Socle / DevOps | 2 | 2 sem. | Sur-outillage précoce |
| Collector WebSocket | 3 | 2 sem. | Reconnexions, trous de séquence, doublons — 80 % du travail est dans les cas dégradés |
| Stockage bitemporel | 4 | 2 sem. | Comprendre la bitemporalité **après** avoir écrit 6 mois de données |
| Contrôles qualité | 3 | 1 sem. | Alerter sans agir : un contrôle qui n'a pas d'effet sur la décision ne sert à rien |
| Bibliothèque de features | **4** | 3 sem. | Fuite de futur invisible ; divergence live/offline |
| Labellisation | **4** | 1 sem. | Chevauchement des labels, barrières mal calibrées → significativité fantôme |
| Modélisation + calibration | 3 | 3 sem. | Chercher la performance avant la calibration |
| Backtest vectoriel | 3 | 2 sem. | Faux sentiment de rapidité |
| Backtest événementiel | **5** | 3–4 sem. | Ordonnancement des événements, latence, fills partiels. **Le module le plus difficile de la V1** |
| Métriques & validation | 3 | 1 sem. | Se croire significatif |
| Risk Engine | 3 | 2 sem. | Simple à écrire, difficile à écrire *complet* ; exige des tests exhaustifs |
| Decision policy + raisons | 3 | 2 sem. | Raisons plausibles mais non fondées sur les attributions réelles |
| API + WebSocket | 2 | 2 sem. | Backpressure |
| Terminal web | 3 | 5 sem. | Performance du rendu temps réel ; densité sans illisibilité |
| Alertes | 1 | 3 j. | Spam → l'utilisateur ignore tout, y compris l'alerte utile |
| Journal + contrefactuels | 3 | 2 sem. | Schéma trop pauvre au départ, donc inexploitable ensuite |
| Registre / promotion / rollback | 3 | 1 sem. | Rollback jamais testé |
| **Exécution / OMS (V2)** | **5** | 6–8 sem. | Idempotence, état `UNKNOWN`, réconciliation. **Le module le plus dangereux du projet** |
| News/NLP (V2) | 4 | 6 sem. | Horodatage de publication, impossibilité de backtester rétroactivement |
| Actions (V2) | 4 | 6 sem. | Corporate actions, univers survivorship-free, coût des données |
| On-chain (V2) | 3 | 4 sem. | Signal réel mais lent ; coût des fournisseurs |
| Multi-utilisateur (V3) | 4 | — | Change le métier (voir §15) |

---

# 20. Ordre exact de développement

Chaque étape produit quelque chose de vérifiable, et **aucune ne peut être sautée** sans invalider
les suivantes.

```
 1. Socle : repo, CI, compose, config typée, logs structurés, métriques
 2. Modèles de données normalisés + gestion du temps (UTC partout, Decimal pour l'argent)
 3. Collector 1 exchange (trades + book top + funding + OI) avec reconnexion et détection de trous
 4. Bus + writer + lac Parquet bitemporel + Postgres opérationnel
 5. Backfill historique 24 mois, réconcilié avec le live
 6. Contrôles qualité + tableau de bord de santé  ← STOP : rien d'autre tant que les données mentent
 7. Construction des barres maison + tests de reproductibilité
 8. Bibliothèque de features v1 (30–50 features, pas 300)
 9. TEST D'OR live/offline  ← STOP : sans lui, tout ce qui suit est de la fiction
10. Labellisation triple-barrière + poids d'échantillon + CV purgée
11. Baselines : aléatoire, buy&hold, logistique. Toute la suite se mesure contre elles
12. Backtest vectoriel + modèle de coûts réaliste
13. LightGBM direction + meta-label confiance + calibration isotonique
14. Backtest événementiel + test de concordance  ← STOP : si les deux divergent, on ne continue pas
15. Walk-forward + Monte Carlo + DSR/PBO. Décision honnête : y a-t-il quelque chose ou non ?
16. Modèle de volatilité (HAR-RV) → stops et sizing
17. Risk Engine complet + kill switch (déclencheurs testés, y compris en simulation de panne)
18. Decision policy + génération des raisons par attribution
19. API + WebSocket
20. Terminal : marchés → signal → journal → santé (dans cet ordre)
21. Alertes Telegram
22. Journal des signaux + suivi d'issue + contrefactuels
23. Rapport de calibration + surveillance de dérive
24. MLflow, registre, procédure de promotion, rollback testé
    ──────── FIN V1 (ANALYST) ────────
25. Simulateur d'exécution + paper trading (≥ 8 semaines)
26. Shadow mode pour la v2 des modèles
27. OMS + réconciliation + garde-fous + dead man's switch (paper uniquement d'abord)
28. COPILOT en live, taille minimale, plusieurs semaines
29. Une seule extension V2 à la fois (news OU actions OU on-chain)
30. AUTONOMOUS, autorisations périmables, canari, capital minimal
```

Les trois **STOP** (étapes 6, 9, 14) sont des portes fermées. Les franchir « provisoirement » est la
façon la plus fiable de construire un système qui a l'air de fonctionner et qui perd de l'argent.

---

# 21. Le MVP réellement réalisable

Ce que je construirais réellement en premier, en **6 à 8 semaines** à 20 h/semaine — nettement plus
petit que la V1 décrite, et volontairement.

## 21.1 Périmètre

- **1 exchange** (Binance ou Bybit), **perpétuels USDT**, **20 symboles** parmi les plus liquides.
- **1 timeframe de décision** : 1 h (barres 1 m conservées pour la simulation d'exécution).
- **ANALYST uniquement.** Aucun ordre, aucune clé avec droit de trading.
- **1 famille de modèles** : LightGBM sur ~40 features, triple-barrière, calibration.
- **Interface minimale** : une liste de symboles, un écran de signal, un journal. Rien d'autre.
- **Alertes Telegram** sur les setups au-dessus d'un seuil.

## 21.2 Ce qu'on livre exactement

1. Collector + backfill 12 mois + contrôles qualité + tableau de santé.
2. Bibliothèque de features et **test d'or** live/offline.
3. Labels, CV purgée, baselines, LightGBM + calibration, rapport reproductible.
4. Backtest vectoriel avec coûts réalistes **et** un moteur événementiel simplifié pour vérifier.
5. Risk Engine (sizing, stops, limites, refus) — même sans exécution, il conditionne les signaux.
6. Terminal 3 écrans + alertes.
7. Journal complet avec suivi automatique des issues, y compris contrefactuelles.

## 21.3 Ce qu'on s'interdit dans le MVP

Actions, news, sentiment, on-chain, macro, order book profond, LLM, deep learning, RL, multi-exchange,
exécution, multi-utilisateur, mobile natif, GPU, Kafka, Kubernetes, feature store, microservices.

## 21.4 Critères de succès — aucun n'est un critère de profit

| Critère | Seuil |
|---|---|
| Intégrité des données | 0 trou non détecté sur 30 jours ; 100 % des enregistrements bitemporels |
| Reproductibilité | même entrée → même sortie, bit-à-bit, prouvé par test automatisé |
| Absence de fuite | test d'or live/offline vert en continu |
| Calibration | score de Brier meilleur que la fréquence de base ; diagramme de fiabilité sans biais systématique |
| Concordance | écart P&L vectoriel/événementiel < 2 % sur la stratégie de référence |
| Discipline | ≥ 60 % des candidats rejetés par espérance nette ou risque (un système qui trade tout le temps est cassé) |
| Latence | clôture de barre → signal affiché < 2 s au p95 |
| Disponibilité | ≥ 99 % sur 30 jours, redémarrage automatique avec backfill |

Et le critère qui décide de la suite : **après 3 mois d'exploitation, la calibration tient-elle hors
échantillon ?** Si oui, on continue vers le paper trading. Si non, on ne passe pas à l'exécution — on
retourne aux features, ou on arrête. Décider cela *maintenant*, à froid, vaut infiniment mieux que
de le décider devant un drawdown.

---

# Annexe A — Points de désaccord dans l'équipe

Ces tensions sont réelles ; les trancher d'avance évite des semaines perdues.

**Le quant contre l'ingénieur ML.** L'ingénieur ML veut un TFT multi-horizon dès le départ ; le quant
répond que sur un rapport signal/bruit de ~0,05, la capacité du modèle n'est pas le facteur limitant
— la qualité des labels et des features l'est. *Tranché : GBDT d'abord ; on ne réexaminera le deep
learning que si un modèle linéaire, un GBDT et une amélioration de features ont tous plafonné au même
endroit.*

**L'architecte contre l'ingénieur data.** L'ingénieur data veut Kafka + ClickHouse + Feast tout de
suite « pour ne pas migrer plus tard » ; l'architecte note que la migration coûte moins cher que
d'administrer trois systèmes pendant un an sans utilisateur. *Tranché : Redis + Postgres + Parquet ;
l'idempotence garantit la réversibilité.*

**L'expert risque contre le produit.** Le produit veut afficher un signal sur chaque symbole en
permanence (c'est plus vivant) ; le risque veut que `WAIT` soit l'état par défaut et fréquent. *Tranché :
`WAIT` domine, et l'interface l'affiche comme un état normal, pas comme un échec. Un terminal qui
crie en permanence entraîne l'utilisateur à ignorer ses alertes.*

**La sécurité contre l'ergonomie.** Le mode AUTONOMOUS derrière une autorisation qui expire est
pénible à l'usage. *Tranché : maintenu. La pénibilité est le mécanisme, pas un effet de bord.*

**Le backtest contre tout le monde.** L'expert validation veut un holdout consultable deux fois
maximum ; tous les autres trouvent ça excessif. *Tranché : maintenu, avec registre des essais. C'est
la seule protection réelle contre le fait de s'auto-convaincre.*

---

# Annexe B — Les risques qui tuent ce projet

Par ordre de probabilité, pas de gravité.

1. **Abandon par épuisement avant la fin de la phase données.** 70 % du travail est ingrat et
   invisible. *Mitigation : livrer une interface utilisable dès P6, même moche ; voir des signaux
   réels entretient la motivation.*
2. **Croire un backtest faux.** Le mode d'échec le plus classique et le plus coûteux. *Mitigation :
   les trois STOP, la CI de régression, le DSR.*
3. **Élargir le périmètre.** Ajouter actions + news + on-chain avant d'avoir prouvé le socle. Chaque
   ajout multiplie la surface de bugs et divise l'attention. *Mitigation : une extension à la fois,
   avec critère de succès écrit avant de commencer.*
4. **Passer en live trop tôt.** L'euphorie d'un bon backtest pousse à exécuter avant d'avoir la
   distribution hors échantillon. *Mitigation : les 8 semaines de paper trading ne sont pas
   négociables.*
5. **Absence d'edge.** Possibilité réelle et parfaitement respectable : au terme du MVP, la
   conclusion peut être « les probabilités sont calibrées mais l'espérance nette est nulle après
   coûts ». Ce serait un **résultat**, pas un échec — et un résultat que 90 % des projets amateurs
   n'obtiennent jamais parce qu'ils ne mesurent pas correctement.
6. **Dérive vers le jouet technique.** Construire de l'infrastructure parce que c'est plus amusant
   que de mesurer une calibration. *Mitigation : chaque phase a une sortie vérifiable orientée
   décision, pas orientée technologie.*

---

# Annexe C — Prochaines décisions à prendre avant d'écrire du code

1. **Exchange cible** (dépend du pays de résidence, de l'accès aux perpétuels et de la qualité des API).
2. **Horizon de décision** : 1 h, 4 h ou journalier. Il détermine les données, les coûts relatifs et
   la faisabilité — c'est la décision la plus structurante après le choix du marché.
3. **Capital de référence** pour le dimensionnement, même fictif : sans lui, le Risk Engine n'a pas
   d'unité.
4. **Budget mensuel d'infrastructure** (ordre de grandeur : 50–150 €/mois en V1, hors données actions).
5. **Temps réellement disponible par semaine** — pour transformer la roadmap en calendrier.
