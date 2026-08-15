/* LA FEUILLE D'AJOUT — le geste le plus fréquent de l'app.

   Ordre imposé par l'usage, pas par la technique : RÉCENTS → FAVORIS →
   RECHERCHE → CRÉER. Un aliment habituel s'ajoute en deux taps (ouvrir, taper
   la ligne) et sans saisie, parce que sa dernière quantité est déjà là.

   Taper la ligne = ajouter avec la quantité habituelle.
   Taper la quantité = l'ajuster avant d'ajouter. */

import { esc, num } from '../ui.js'
import { openSheet, parseNumber } from './components.js'
import { scale, display } from '../core/nutrition/calculations.js'

/** Ligne d'aliment : nom, marque, et la quantité mémorisée bien en évidence. */
function rowHTML(row) {
  const qty = row.lastQty ? `${num(row.lastQty)} ${esc(row.unit || 'g')}` : 'quantité ?'
  const values = row.lastQty ? scale(row.snapshot, row.lastQty, row.unit) : null
  const kcal = values?.kcal != null ? `${display(values.kcal, 'kcal')} kcal` : ''
  return `
    <div class="pick" data-pick="${esc(row.id)}">
      <button class="pick__main" data-act="choose" data-id="${esc(row.id)}">
        <span class="pick__name">${row.favorite ? '⭐ ' : ''}${esc(row.name)}</span>
        <span class="pick__meta">${esc([row.brand, kcal].filter(Boolean).join(' · '))}</span>
      </button>
      <button class="pick__qty" data-act="quantity" data-id="${esc(row.id)}" aria-label="Modifier la quantité">
        ${esc(qty)}
      </button>
    </div>`
}

/**
 * Ouvre la feuille d'ajout.
 * @param {object} opts
 * @param {Function} opts.recents  () => rows
 * @param {Function} opts.favorites () => rows
 * @param {Function} opts.search   (query) => rows
 * @param {Function} opts.onCreate () => Promise<row|null> — création d'un aliment
 * @returns {Promise<{id, snapshot, qty, unit}|null>}
 */
export function openFoodPicker({ recents, favorites, search, onCreate }) {
  return new Promise((resolve) => {
    const host = document.getElementById('overlay')
    const wrap = document.createElement('div')
    wrap.className = 'sheet'
    wrap.innerHTML = `
      <div class="sheet__panel">
        <div class="sheet__grip"></div>
        <h3 class="sheet__title">Ajouter un aliment</h3>

        <div class="seg seg--page" data-tabs>
          <button type="button" class="seg__opt is-on" data-tab="recents">Récents</button>
          <button type="button" class="seg__opt" data-tab="favorites">Favoris</button>
          <button type="button" class="seg__opt" data-tab="search">Recherche</button>
        </div>

        <div data-search hidden>
          <input class="fld__input" type="search" inputmode="search" autocomplete="off"
                 placeholder="Nom ou marque…" data-query aria-label="Rechercher un aliment">
        </div>

        <div class="picks" data-list></div>

        <div class="sheet__actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">Fermer</button>
          <button type="button" class="btn btn--gold" data-act="create">Créer un aliment</button>
        </div>
      </div>`

    const list = wrap.querySelector('[data-list]')
    const searchBox = wrap.querySelector('[data-search]')
    const queryInput = wrap.querySelector('[data-query]')
    let tab = 'recents'

    const close = (result) => {
      wrap.classList.remove('is-in')
      setTimeout(() => wrap.remove(), 200)
      resolve(result)
    }

    function rowsFor() {
      if (tab === 'favorites') return favorites()
      if (tab === 'search') return search(queryInput.value)
      return recents()
    }

    function emptyMessage() {
      if (tab === 'favorites') return 'Aucun favori. Touche l’étoile d’un aliment pour l’épingler.'
      if (tab === 'search') {
        return queryInput.value.trim()
          ? 'Rien trouvé dans tes aliments. Crée-le, ou scanne-le quand ce sera disponible.'
          : 'Tape le début d’un nom.'
      }
      return 'Rien encore. Ton premier aliment ajouté apparaîtra ici, avec sa quantité.'
    }

    function render() {
      const rows = rowsFor()
      list.innerHTML = rows.length
        ? rows.map(rowHTML).join('')
        : `<p class="note" style="text-align:center">${esc(emptyMessage())}</p>`
    }

    /** Demande la quantité, pré-remplie avec l'habitude. */
    async function askQuantity(row) {
      const values = await openSheet({
        title: row.name,
        subtitle: row.brand || '',
        submitLabel: 'Ajouter',
        fields: [{ name: 'qty', label: `Quantité (${row.unit || 'g'})`, type: 'number' }],
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

    wrap.addEventListener('click', async (e) => {
      const tabBtn = e.target.closest('[data-tab]')
      if (tabBtn) {
        tab = tabBtn.dataset.tab
        wrap.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-on', b === tabBtn))
        searchBox.hidden = tab !== 'search'
        render()
        if (tab === 'search') queryInput.focus()
        return
      }

      const btn = e.target.closest('[data-act]')
      if (!btn) {
        if (e.target === wrap) close(null)
        return
      }

      const act = btn.dataset.act
      if (act === 'cancel') return close(null)

      if (act === 'create') {
        const created = await onCreate()
        if (!created) return
        const qty = await askQuantity(created)
        if (qty === null) return
        return close({ id: created.id, snapshot: created.snapshot, qty, unit: created.unit || 'g' })
      }

      const row = rowsFor().find((r) => r.id === btn.dataset.id)
      if (!row) return

      if (act === 'choose') {
        // Le geste unique : quantité habituelle connue => on ajoute directement.
        if (row.lastQty) return close({ id: row.id, snapshot: row.snapshot, qty: row.lastQty, unit: row.unit || 'g' })
        const qty = await askQuantity(row)
        if (qty === null) return
        return close({ id: row.id, snapshot: row.snapshot, qty, unit: row.unit || 'g' })
      }

      if (act === 'quantity') {
        const qty = await askQuantity(row)
        if (qty === null) return
        return close({ id: row.id, snapshot: row.snapshot, qty, unit: row.unit || 'g' })
      }
    })

    queryInput.addEventListener('input', render)

    host.appendChild(wrap)
    requestAnimationFrame(() => wrap.classList.add('is-in'))
    render()
  })
}
