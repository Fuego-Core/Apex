/* FAÇADE D'ÉTAT.

   Les vues importent d'ici, et d'ici seulement. Le découpage par domaine
   derrière cette porte peut évoluer sans qu'aucune vue ne bouge — c'est ce qui
   a permis d'ajouter la nutrition sans toucher aux écrans d'entraînement. */

export * from './state/index.js'
export * from './state/body.js'
export * from './state/goals.js'
