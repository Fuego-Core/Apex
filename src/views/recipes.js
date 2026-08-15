/* MES RECETTES — ce que tu prépares, compté une seule fois.

   Le geste utile : composer un plat, dire combien de portions il fait, et
   retrouver ensuite « une portion » dans la liste d'ajout comme n'importe quel
   aliment. La complexité (additionner des ingrédients, diviser par les
   portions, figer les instantanés) reste dans le moteur ; ici on ne voit qu'un
   plat et ses portions. */

import { getState, createRecipe, updateRecipe, removeRecipe } from '../state.js'
import { recipeValues, sortedRecipes } from '../core/nutrition/recipes.js'
import { display } from '../core/nutrition/calculations.js'
import { esc, header, num, toast, confirmDialog } from '../ui.js'
import { blank, openSheet, parseNumber } from '../ui/components.js'
import { pickFood } from '../ui/food-flow.js'

export default function recipesView(root) {
  /* Brouillon en cours d'édition : une recette n'est enregistrée que sur
     validation, donc rien d'incomplet ne peut atterrir dans l'état. */
  let draft = null

  function ingredientLines() {
    if (!draft.items.length) {
      return '<p class="note" style="text-align:center">Aucun ingrédient. Ajoute le premier.</p>'
    }
    return draft.items
      .map((item, index) => {
        const kcal = item.snapshot?.kcal
        return `
          <li class="hrow measure">
            <div>
              <span class="hrow__name">${esc(item.snapshot?.name || 'Ingrédient')}</span>
              <p class="hrow__sets">
                ${esc(num(item.qty))} ${esc(item.unit)}${kcal != null ? ` · ${display((kcal * item.qty) / (item.snapshot.per || 100), 'kcal')} kcal` : ''}
              </p>
            </div>
            <button class="icon-btn" data-act="drop-item" data-index="${index}"
                    aria-label="Retirer ${esc(item.snapshot?.name || 'cet ingrédient')}">×</button>
          </li>`
      })
      .join('')
  }

  function draftSummary() {
    const { total, perServing, servings, unscalable } = recipeValues(draft)
    if (unscalable.length) {
      return `<p class="note scan__status--warn">« ${esc(unscalable[0])} » : quantité incompatible avec son unité.</p>`
    }
    if (total.kcal === null) return '<p class="note">Ajoute des ingrédients pour voir le total.</p>'
    return `
      <div class="prod">
        <div class="prod__row"><span>Total</span><strong>${display(total.kcal, 'kcal')} kcal</strong></div>
        <div class="prod__row">
          <span>Une portion (sur ${esc(String(servings))})</span>
          <strong>${display(perServing.kcal, 'kcal')} kcal${perServing.protein != null ? ` · ${display(perServing.protein)} g prot.` : ''}</strong>
        </div>
      </div>`
  }

  function renderEditor() {
    root.querySelector('[data-editor]').innerHTML = `
      <ul class="card hlist">${ingredientLines()}</ul>
      <button class="btn btn--ghost btn--block btn--sm" data-act="add-item" style="margin-top:var(--sp-2)">
        + Ajouter un ingrédient
      </button>
      ${draftSummary()}
      <div class="sheet__actions">
        <button type="button" class="btn btn--ghost" data-act="cancel-draft">Annuler</button>
        <button type="button" class="btn btn--gold" data-act="save-draft">
          ${draft.id ? 'Enregistrer' : 'Créer la recette'}
        </button>
      </div>`
  }

  async function startDraft(recipe = null) {
    const values = await openSheet({
      title: recipe ? 'Modifier la recette' : 'Nouvelle recette',
      subtitle: 'Le nom du plat, et le nombre de portions qu’il donne.',
      submitLabel: 'Continuer',
      fields: [
        { name: 'name', label: 'Nom', type: 'text', placeholder: 'Poulet riz' },
        { name: 'servings', label: 'Portions', type: 'number', hint: 'Combien d’assiettes au total' }
      ],
      values: { name: recipe?.name ?? '', servings: recipe ? num(recipe.servings) : '' },
      validate: (data) => {
        const errors = {}
        if (!String(data.name).trim()) errors.name = 'Donne un nom à la recette.'
        const s = parseNumber(data.servings)
        if (s === null || s < 1) errors.servings = 'Au moins une portion.'
        else if (Math.round(s) !== s) errors.servings = 'Un nombre entier de portions.'
        return errors
      }
    })
    if (!values) return

    draft = {
      id: recipe?.id || null,
      name: String(values.name).trim(),
      servings: parseNumber(values.servings),
      items: recipe ? recipe.items.map((i) => ({ ...i })) : []
    }
    render()
  }

  async function addItem() {
    // Pas de recette dans une recette : un plat doit rester recalculable.
    const chosen = await pickFood({ includeRecipes: false })
    if (!chosen) return
    draft.items.push({ foodId: chosen.id, qty: chosen.qty, unit: chosen.unit, snapshot: chosen.snapshot })
    renderEditor()
  }

  async function saveDraft() {
    const res = draft.id
      ? await updateRecipe(draft.id, { name: draft.name, servings: draft.servings, items: draft.items })
      : await createRecipe(draft)

    if (!res.ok) {
      toast(Object.values(res.errors)[0], 'warn')
      return
    }
    toast(draft.id ? 'Recette modifiée' : 'Recette créée', 'gold')
    draft = null
    render()
  }

  async function confirmRemove(recipe) {
    const ok = await confirmDialog({
      title: 'Supprimer cette recette ?',
      message: 'Les portions déjà enregistrées dans ton journal ne bougeront pas : elles gardent leurs valeurs.',
      confirmLabel: 'Supprimer',
      danger: true
    })
    if (!ok) return
    await removeRecipe(recipe.id)
    toast('Recette supprimée')
    render()
  }

  function recipeCard(recipe) {
    const { perServing, servings, unscalable } = recipeValues(recipe)
    return `
      <li class="hrow">
        <button class="hrow__main" data-act="edit" data-id="${esc(recipe.id)}">
          <span class="hrow__name">${esc(recipe.name)}</span>
          <p class="hrow__sets">
            ${esc(String(servings))} portion${servings > 1 ? 's' : ''} ·
            ${
              unscalable.length
                ? 'valeurs incomplètes'
                : `${display(perServing.kcal, 'kcal')} kcal/portion${perServing.protein != null ? ` · ${display(perServing.protein)} g prot.` : ''}`
            }
          </p>
          <p class="hrow__sets">${esc(recipe.items.map((i) => i.snapshot?.name || '').filter(Boolean).join(' · '))}</p>
        </button>
        <button class="icon-btn" data-act="remove" data-id="${esc(recipe.id)}"
                aria-label="Supprimer ${esc(recipe.name)}">×</button>
      </li>`
  }

  function render() {
    const recipes = sortedRecipes(getState().nutrition.recipes)

    if (draft) {
      root.innerHTML = `
        <div class="page">
          ${header({ back: '#/nutrition', title: 'Recette', sub: `${esc(draft.name)} · ${draft.servings} portion${draft.servings > 1 ? 's' : ''}` })}
          <div data-editor></div>
        </div>`
      renderEditor()
      return
    }

    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/nutrition', title: 'Recettes', sub: 'Tes plats, comptés une fois' })}

        ${
          recipes.length
            ? `<ul class="card hlist">${recipes.map(recipeCard).join('')}</ul>`
            : blank({
                title: 'Aucune recette',
                text: 'Compose un plat une bonne fois : APEX en déduit la valeur d’une portion, et tu l’ajoutes ensuite comme un aliment.'
              })
        }

        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="new">Nouvelle recette</button>
        </div>
      </div>`
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    const act = btn.dataset.act
    const recipes = getState().nutrition.recipes

    if (act === 'new') await startDraft()
    else if (act === 'edit') await startDraft(recipes.find((r) => r.id === btn.dataset.id))
    else if (act === 'remove') {
      const recipe = recipes.find((r) => r.id === btn.dataset.id)
      if (recipe) await confirmRemove(recipe)
    } else if (act === 'add-item') await addItem()
    else if (act === 'drop-item') {
      draft.items.splice(Number(btn.dataset.index), 1)
      renderEditor()
    } else if (act === 'save-draft') await saveDraft()
    else if (act === 'cancel-draft') {
      draft = null
      render()
    }
  }

  root.addEventListener('click', onClick)
  render()

  return () => root.removeEventListener('click', onClick)
}
