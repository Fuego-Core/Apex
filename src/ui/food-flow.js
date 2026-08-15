/* LE PARCOURS D'AJOUT, en un seul endroit.

   Choisir un aliment met en jeu cinq chemins — récents, favoris, aliments
   personnels, recherche en ligne, scanner — plus la création manuelle. Cette
   mécanique servait au journal ; elle sert maintenant aussi aux ingrédients
   d'une recette. Elle vit donc ici, et pas dans un écran.

   Ce module ne décide de rien : il rend ce que l'utilisateur a choisi, avec sa
   quantité. C'est l'appelant qui en fait une ligne de journal ou un ingrédient. */

import { toast } from '../ui.js'
import { openSheet, parseNumber } from './components.js'
import { openFoodPicker } from './food-picker.js'
import { openScanner, scannerSupport } from './scanner.js'
import { confirmProduct } from './product-card.js'
import { isBarcode } from '../data/openFoodFacts.js'
import { recents, favorites, searchLocal, snapshotOf } from '../core/nutrition/foods.js'
import { getState, createFood, searchFoodsOnline, lookupBarcode, recipeFoods } from '../state.js'

/** Création d'un aliment personnel. Les valeurs saisies ne sont pas retouchées. */
export async function openCreateFoodSheet({ barcode = null } = {}) {
  const values = await openSheet({
    title: 'Nouvel aliment',
    subtitle: barcode
      ? `Code ${barcode} — les valeurs telles qu’elles figurent sur l’emballage.`
      : 'Les valeurs telles qu’elles figurent sur l’emballage.',
    submitLabel: 'Créer',
    fields: [
      { name: 'name', label: 'Nom', type: 'text', placeholder: 'Skyr maison' },
      { name: 'brand', label: 'Marque (facultatif)', type: 'text' },
      { name: 'per', label: 'Valeurs pour (g)', type: 'number', hint: 'En général 100' },
      { name: 'kcal', label: 'Calories (kcal)', type: 'number' },
      { name: 'protein', label: 'Protéines (g)', type: 'number' },
      { name: 'carbs', label: 'Glucides (g)', type: 'number' },
      { name: 'fat', label: 'Lipides (g)', type: 'number' },
      { name: 'fiber', label: 'Fibres (g, facultatif)', type: 'number' }
    ],
    values: { per: '100' }
  })
  if (!values) return null

  const res = await createFood({
    name: values.name,
    brand: values.brand,
    barcode,
    per: parseNumber(values.per),
    kcal: parseNumber(values.kcal),
    protein: parseNumber(values.protein),
    carbs: parseNumber(values.carbs),
    fat: parseNumber(values.fat),
    fiber: values.fiber === '' ? null : parseNumber(values.fiber)
  })

  if (!res.ok) {
    toast(Object.values(res.errors)[0], 'warn')
    return null
  }
  toast('Aliment créé', 'gold')
  return {
    id: res.food.id,
    name: res.food.name,
    brand: res.food.brand,
    snapshot: snapshotOf(res.food),
    unit: res.food.unit,
    lastQty: null
  }
}

/** Saisie du code à la main : le repli quand l'appareil ne sait pas lire. */
async function askBarcode() {
  const values = await openSheet({
    title: 'Code-barres',
    subtitle: 'Les chiffres imprimés sous les barres, sur l’emballage.',
    submitLabel: 'Chercher',
    fields: [{ name: 'code', label: 'Code-barres', type: 'text', placeholder: '3017620422003' }],
    validate: (data) => (isBarcode(data.code?.trim()) ? {} : { code: 'Un code-barres compte 8 à 14 chiffres.' })
  })
  return values ? values.code.trim() : null
}

/* Un code-barres tapé est une lecture directe, pas une recherche : on ne fait
   pas chercher « 3017620422003 » à un moteur de texte. */
async function onlineSearch(query) {
  if (isBarcode(query)) {
    const found = await lookupBarcode(query)
    return found.ok ? { rows: [found.row], message: '' } : { rows: [], message: found.message }
  }
  const { rows, warning, skipped } = await searchFoodsOnline(query)
  const note = warning || (skipped ? `${skipped} fiche${skipped > 1 ? 's' : ''} écartée${skipped > 1 ? 's' : ''} : valeurs manquantes.` : '')
  return { rows, message: note }
}

/* Le chemin complet d'un scan, dans cet ordre et sans raccourci : lecture
   réelle → code → cache → Open Food Facts si nécessaire → fiche produit →
   validation explicite. La quantité est demandée ensuite par le sélecteur.
   Un code lu n'ajoute jamais rien tout seul. */
async function scanFlow() {
  const scanned = await openScanner()
  if (!scanned) return null

  const code = scanned.manual ? await askBarcode() : scanned.code
  if (!code) return null

  const found = await lookupBarcode(code)
  if (!found.ok) {
    // Inconnu ou incomplet : on le dit, et on propose de le créer — l'emballage
    // est de toute façon dans la main.
    toast(found.message, 'warn')
    return openCreateFoodSheet({ barcode: code })
  }

  const confirmed = await confirmProduct(found.row, { title: found.row.name })
  if (!confirmed) return null
  if (found.fromCache) toast('Fiche retrouvée sans réseau')
  return found.row
}

/**
 * Ouvre le parcours complet et rend le choix de l'utilisateur.
 * @param {object} options
 * @param {boolean} [options.includeRecipes] proposer aussi les recettes —
 *        vrai pour le journal, faux pour les ingrédients (une recette dans une
 *        recette rendrait un plat impossible à recalculer honnêtement).
 * @returns {Promise<{id, snapshot, qty, unit}|null>}
 */
export async function pickFood({ includeRecipes = true } = {}) {
  const state = getState()
  const support = await scannerSupport()
  const searchable = includeRecipes
    ? { foods: { ...state.nutrition.foods, ...recipeFoods() }, usage: state.nutrition.usage }
    : state.nutrition

  return openFoodPicker({
    recents: () => recents(state.nutrition.usage),
    favorites: () => favorites(state.nutrition.usage),
    search: (query) => searchLocal(searchable, query),
    online: onlineSearch,
    scan: { supported: support.ok, reason: support.reason, run: scanFlow },
    onCreate: openCreateFoodSheet
  })
}
