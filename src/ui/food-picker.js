/* LA FEUILLE D'AJOUT — le geste le plus fréquent de l'app.

   Ordre imposé par l'usage, pas par la technique : RÉCENTS → FAVORIS →
   RECHERCHE → EN LIGNE → CRÉER. Un aliment habituel s'ajoute en deux taps
   (ouvrir, taper la ligne) et sans saisie, parce que sa dernière quantité est
   déjà là. Le réseau n'arrive qu'en dernier recours, et seulement sur demande.

   Taper la ligne = ajouter avec la quantité habituelle.
   Taper la quantité = l'ajuster avant d'ajouter.

   La recherche en ligne ne part JAMAIS toute seule à la frappe : chaque lettre
   serait une requête vers un tiers. Il faut la déclencher. */

import { esc, num } from '../ui.js'
import { scale, display } from '../core/nutrition/calculations.js'
import { askQuantity } from './product-card.js'

/** Ligne d'aliment : nom, marque, et la quantité mémorisée bien en évidence. */
function rowHTML(row) {
  const qty = row.lastQty ? `${num(row.lastQty)} ${esc(row.unit || 'g')}` : 'quantité ?'
  const values = row.lastQty ? scale(row.snapshot, row.lastQty, row.unit) : null
  const kcal =
    values?.kcal != null
      ? `${display(values.kcal, 'kcal')} kcal`
      : row.snapshot?.kcal != null
        ? `${display(row.snapshot.kcal, 'kcal')} kcal / ${num(row.snapshot.per || 100)} ${esc(row.snapshot.unit || 'g')}`
        : ''
  // Une valeur reconstituée depuis les kilojoules le dit : on n'habille pas une dérivation en mesure.
  const derived = row.derived?.kcal === 'from-kj' ? 'kcal calculées depuis les kJ' : ''
  return `
    <div class="pick" data-pick="${esc(row.id)}">
      <button class="pick__main" data-act="choose" data-id="${esc(row.id)}">
        <span class="pick__name">${row.favorite ? '⭐ ' : ''}${esc(row.name)}</span>
        <span class="pick__meta">${esc([row.brand, kcal, derived].filter(Boolean).join(' · '))}</span>
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
 * @param {Function} [opts.online] (query) => Promise<{rows, warning, message}> — sur demande seulement
 * @param {object} [opts.scan] { supported, reason, run: () => Promise<row|null> }
 * @param {Function} opts.onCreate () => Promise<row|null> — création d'un aliment
 * @returns {Promise<{id, snapshot, qty, unit}|null>}
 */
export function openFoodPicker({ recents, favorites, search, online = null, scan = null, onCreate }) {
  return new Promise((resolve) => {
    const host = document.getElementById('overlay')
    const wrap = document.createElement('div')
    wrap.className = 'sheet'
    wrap.innerHTML = `
      <div class="sheet__panel">
        <div class="sheet__grip"></div>
        <h3 class="sheet__title">Ajouter un aliment</h3>

        <div class="seg seg--page${online ? ' seg--tight' : ''}" data-tabs>
          <button type="button" class="seg__opt is-on" data-tab="recents">Récents</button>
          <button type="button" class="seg__opt" data-tab="favorites">Favoris</button>
          <button type="button" class="seg__opt" data-tab="search">Mes aliments</button>
          ${online ? '<button type="button" class="seg__opt" data-tab="online">En ligne</button>' : ''}
        </div>

        <div data-search hidden>
          <input class="fld__input" type="search" inputmode="search" autocomplete="off"
                 placeholder="Nom ou marque…" data-query aria-label="Rechercher un aliment">
        </div>

        <div data-online hidden>
          ${
            scan
              ? scan.supported
                ? '<button type="button" class="btn btn--gold btn--block" data-act="scan">Scanner un code-barres</button>'
                : `<p class="note scan__fallback">${esc(scan.reason || 'Ce navigateur ne sait pas lire les codes-barres.')} Tape le code du produit ci-dessous : APEX ira le chercher.</p>`
              : ''
          }
          <div class="pick-search">
            <input class="fld__input" type="search" inputmode="search" autocomplete="off"
                   placeholder="Nom, marque ou code-barres…" data-online-query
                   aria-label="Rechercher dans Open Food Facts">
            <button type="button" class="btn btn--gold btn--sm" data-act="run-online">Chercher</button>
          </div>
          <p class="note" data-online-note>
            Recherche dans Open Food Facts, sur demande uniquement. Données © Open Food Facts — ODbL.
          </p>
        </div>

        <div class="picks" data-list></div>

        <div class="sheet__actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">Fermer</button>
          <button type="button" class="btn btn--gold" data-act="create">Créer un aliment</button>
        </div>
      </div>`

    const list = wrap.querySelector('[data-list]')
    const searchBox = wrap.querySelector('[data-search]')
    const onlineBox = wrap.querySelector('[data-online]')
    const queryInput = wrap.querySelector('[data-query]')
    const onlineInput = wrap.querySelector('[data-online-query]')
    let tab = 'recents'
    /** Résultats en ligne : ils n'existent qu'après une demande explicite. */
    let onlineState = { rows: [], status: 'idle', message: '' }

    const close = (result) => {
      wrap.classList.remove('is-in')
      setTimeout(() => wrap.remove(), 200)
      resolve(result)
    }

    function rowsFor() {
      if (tab === 'favorites') return favorites()
      if (tab === 'search') return search(queryInput.value)
      if (tab === 'online') return onlineState.rows
      return recents()
    }

    function emptyMessage() {
      if (tab === 'favorites') return 'Aucun favori. Touche l’étoile d’un aliment pour l’épingler.'
      if (tab === 'search') {
        return queryInput.value.trim()
          ? 'Rien trouvé dans tes aliments. Cherche en ligne, ou crée-le à la main.'
          : 'Tape le début d’un nom.'
      }
      if (tab === 'online') {
        if (onlineState.status === 'loading') return 'Recherche en cours…'
        if (onlineState.status === 'error') return onlineState.message
        if (onlineState.status === 'done') return onlineState.message || 'Aucun produit exploitable trouvé.'
        return 'Tape un nom, une marque ou un code-barres, puis touche « Chercher ».'
      }
      return 'Rien encore. Ton premier aliment ajouté apparaîtra ici, avec sa quantité.'
    }

    function render() {
      const rows = rowsFor()
      const notice =
        tab === 'online' && rows.length && onlineState.message
          ? `<p class="note" style="text-align:center">${esc(onlineState.message)}</p>`
          : ''
      list.innerHTML = rows.length
        ? notice + rows.map(rowHTML).join('')
        : `<p class="note" style="text-align:center">${esc(emptyMessage())}</p>`
    }

    /** La requête réseau : uniquement ici, uniquement sur un geste de l'utilisateur. */
    async function runOnline() {
      const query = onlineInput.value.trim()
      if (!query) return
      onlineState = { rows: [], status: 'loading', message: '' }
      render()
      try {
        const result = await online(query)
        onlineState = {
          rows: result.rows || [],
          status: result.rows?.length ? 'done' : 'error',
          message: result.message || result.warning || ''
        }
        if (onlineState.status === 'error' && !onlineState.message) {
          onlineState.message = 'Aucun produit exploitable trouvé. Crée-le à la main : APEX s’en souviendra ensuite.'
        }
      } catch (e) {
        onlineState = { rows: [], status: 'error', message: 'La recherche a échoué. Réessaie, ou crée l’aliment à la main.' }
      }
      render()
    }

    wrap.addEventListener('click', async (e) => {
      const tabBtn = e.target.closest('[data-tab]')
      if (tabBtn) {
        tab = tabBtn.dataset.tab
        wrap.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-on', b === tabBtn))
        searchBox.hidden = tab !== 'search'
        onlineBox.hidden = tab !== 'online'
        render()
        if (tab === 'search') queryInput.focus()
        if (tab === 'online') onlineInput.focus()
        return
      }

      const btn = e.target.closest('[data-act]')
      if (!btn) {
        if (e.target === wrap) close(null)
        return
      }

      const act = btn.dataset.act
      if (act === 'cancel') return close(null)
      if (act === 'run-online') return runOnline()

      if (act === 'create') {
        const created = await onCreate()
        if (!created) return
        const qty = await askQuantity(created)
        if (qty === null) return
        return close({ id: created.id, snapshot: created.snapshot, qty, unit: created.unit || 'g' })
      }

      // Scanner : le code lu ne devient une ligne qu'après la fiche produit,
      // sa validation, puis la quantité. Rien n'est ajouté tout seul.
      if (act === 'scan') {
        const scanned = await scan.run()
        if (!scanned) return
        const qty = await askQuantity(scanned)
        if (qty === null) return
        return close({ id: scanned.id, snapshot: scanned.snapshot, qty, unit: scanned.unit || 'g' })
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
    // Entrée déclenche la recherche en ligne — mais la frappe seule, jamais.
    onlineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        runOnline()
      }
    })

    host.appendChild(wrap)
    requestAnimationFrame(() => wrap.classList.add('is-in'))
    render()
  })
}
