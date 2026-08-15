/* LA FICHE PRODUIT — l'étape qui sépare « lu » de « ajouté ».

   Un code lu n'ajoute rien. On montre d'abord ce qu'on a trouvé, avec sa
   provenance et ses valeurs, et l'utilisateur valide — ou non. Cette étape
   existe pour une raison simple : un scanner peut lire le mauvais produit d'un
   rayon, et personne ne doit s'en apercevoir trois semaines plus tard dans son
   historique. */

import { esc, num } from '../ui.js'
import { openSheet, parseNumber } from './components.js'
import { display } from '../core/nutrition/calculations.js'

const line = (label, value) =>
  value === null || value === undefined ? '' : `<div class="prod__row"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`

/** Le corps de la fiche : les valeurs telles que la source les donne. */
export function productBodyHTML(row) {
  const s = row.snapshot || {}
  const per = `pour ${num(s.per || 100)} ${esc(s.unit || 'g')}`
  const source = s.source === 'open-food-facts' ? 'Open Food Facts' : s.source === 'user-created' ? 'Ton aliment' : 'Importé'
  const derived = row.derived?.kcal === 'from-kj'
    ? `<p class="note prod__note">Calories reconstituées depuis les kilojoules : la fiche ne donnait pas de kcal.</p>`
    : ''
  const attribution = s.attribution ? `<p class="note prod__note">${esc(s.attribution)}</p>` : ''

  return `
    <div class="prod">
      <p class="prod__per">${esc(per)}</p>
      ${line('Calories', s.kcal === null || s.kcal === undefined ? null : `${display(s.kcal, 'kcal')} kcal`)}
      ${line('Protéines', s.protein === null || s.protein === undefined ? null : `${display(s.protein)} g`)}
      ${line('Glucides', s.carbs === null || s.carbs === undefined ? null : `${display(s.carbs)} g`)}
      ${line('Lipides', s.fat === null || s.fat === undefined ? null : `${display(s.fat)} g`)}
      ${line('Fibres', s.fiber === null || s.fiber === undefined ? null : `${display(s.fiber)} g`)}
      ${line('Source', source)}
      ${derived}
      ${attribution}
    </div>`
}

/**
 * Montre la fiche et attend une validation explicite.
 * @returns {Promise<boolean>} true si l'utilisateur confirme.
 */
export async function confirmProduct(row, { title = null } = {}) {
  const values = await openSheet({
    title: title || row.name,
    subtitle: [row.brand, row.snapshot?.barcode || row.barcode].filter(Boolean).join(' · '),
    body: productBodyHTML(row),
    fields: [],
    submitLabel: 'C’est bien ça'
  })
  return values !== null
}

/**
 * Demande la quantité, pré-remplie avec l'habitude quand elle existe.
 * @returns {Promise<number|null>}
 */
export async function askQuantity(row) {
  const values = await openSheet({
    title: row.name,
    subtitle: row.brand || '',
    submitLabel: 'Ajouter',
    fields: [
      {
        name: 'qty',
        label: `Quantité (${row.unit || row.snapshot?.unit || 'g'})`,
        type: 'number',
        hint: row.snapshot?.servingSize ? `portion indiquée : ${num(row.snapshot.servingSize)} g` : ''
      }
    ],
    values: { qty: row.lastQty ? num(row.lastQty) : '' },
    validate: (data) => {
      const qty = parseNumber(data.qty)
      if (qty === null || qty <= 0) return { qty: 'Indique une quantité.' }
      if (qty > 5000) return { qty: 'Au-delà de 5 000, c’est probablement une faute de frappe.' }
      return {}
    }
  })
  return values ? parseNumber(values.qty) : null
}
