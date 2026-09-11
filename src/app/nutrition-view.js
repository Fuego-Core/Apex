import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay, save, state } from './store.js'
import { esc, shell, top } from './ui.js'
import { renderStockRecipes } from './pantry-recipes.js'
import { renderQuickFoods } from './nutrition-quick.js'

function value(input) {
  const parsed = Number(String(input ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function pct(current, target) {
  if (!target) return 0
  return Math.max(0, Math.min(100, Math.round(value(current) / target * 100)))
}

export function nutritionPage() {
  const day = nutritionDay(TODAY())
  const kcal = value(day.kcal)
  const protein = value(day.protein)
  const fat = value(day.fat)
  const carbs = value(day.carbs)
  const remainingKcal = Math.max(0, Math.round(nutritionTargets.kcal - kcal))
  const remainingProtein = Math.max(0, Math.round(nutritionTargets.protein - protein))
  const nutritionStatus = day.scanned.count
    ? day.source === 'manual'
      ? 'Correction manuelle active. Tu peux revenir au calcul automatique à tout moment.'
      : `${day.scanned.count} aliment${day.scanned.count > 1 ? 's' : ''} calculé${day.scanned.count > 1 ? 's' : ''} automatiquement aujourd’hui.`
    : 'Aucun aliment ajouté aujourd’hui.'

  const macroRows = [
    ['Protéines', protein, nutritionTargets.protein, 'g'],
    ['Glucides', carbs, nutritionTargets.carbs, 'g'],
    ['Lipides', fat, nutritionTargets.fat, 'g']
  ]

  shell(`
    ${top('Nutrition', 'Ta journée, tes repas et ton stock')}

    <section class="v3-nutrition-hero">
      <div class="v3-nutrition-main">
        <span>AUJOURD’HUI</span>
        <strong>${Math.round(kcal)}</strong>
        <p>sur ${nutritionTargets.kcal} kcal</p>
      </div>
      <div class="v3-nutrition-remaining">
        <span>IL TE RESTE</span>
        <strong>${remainingKcal} kcal</strong>
        <small>${remainingProtein} g de protéines</small>
      </div>
      <div class="v3-calorie-track"><i style="width:${pct(kcal, nutritionTargets.kcal)}%"></i></div>
    </section>

    <section class="v3-macros">
      ${macroRows.map(([label, current, target, unit]) => `<article>
        <div><span>${label}</span><strong>${Math.round(current)} <small>/ ${target} ${unit}</small></strong></div>
        <div class="v3-macro-track"><i style="width:${pct(current, target)}%"></i></div>
      </article>`).join('')}
    </section>

    <section class="v3-nutrition-actions">
      <button data-jump="nutrition-tools-slot"><span>AJOUTER</span><strong>Scanner un produit</strong><small>Caméra · code-barres · manuel</small><b>›</b></button>
      <button data-jump="quick-foods-slot"><span>RAPIDE</span><strong>Récents & favoris</strong><small>Reprendre un aliment connu</small><b>›</b></button>
      <button data-jump="stock-recipes-slot"><span>CUISINER</span><strong>Avec mon stock</strong><small>Idées selon ce que tu as</small><b>›</b></button>
      <button data-jump="meal-plan"><span>REPÈRES</span><strong>Plan de la journée</strong><small>Adapté à ton travail de nuit</small><b>›</b></button>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>AJOUTER À MA JOURNÉE</span><h2>Scanner & stock</h2></div><small>Les macros se mettent à jour automatiquement</small></div>
      <div id="nutrition-tools-slot"></div>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>EN UN GESTE</span><h2>Récents & favoris</h2></div><small>Ta routine, sans ressaisie</small></div>
      <div id="quick-foods-slot"></div>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>TON GARDE-MANGER</span><h2>Cuisiner avec mon stock</h2></div><small>Quantités et macros réelles</small></div>
      <div id="stock-recipes-slot"></div>
    </section>

    <section class="v3-section-block" id="meal-plan">
      <div class="v3-section-title"><div><span>RYTHME DE NUIT</span><h2>Plan de la journée</h2></div><small>Des bases, jamais une obligation</small></div>
      <div class="v3-meal-timeline">
        ${mealPlan.map((meal, mealIndex) => `<article class="v3-meal ${mealIndex === 0 ? 'open' : ''}">
          <button class="v3-meal-head" data-meal-toggle="${mealIndex}" type="button">
            <time>${meal.time}</time>
            <span><strong>${esc(meal.title.replace(/^Repas \d+ · /, ''))}</strong><small>${esc(meal.target)}</small></span>
            <b>${mealIndex === 0 ? '−' : '+'}</b>
          </button>
          <div class="v3-meal-body"><div>
            ${meal.options.map((option, index) => `<article><span>OPTION ${index + 1}</span><strong>${esc(option.name)}</strong>${option.items.map((item) => `<p>${esc(item)}</p>`).join('')}</article>`).join('')}
          </div></div>
        </article>`).join('')}
      </div>
    </section>

    <details class="v3-advanced-tools">
      <summary><span>OUTILS AVANCÉS</span><strong>Correction manuelle</strong><b>›</b></summary>
      <div class="v3-advanced-body">
        <p>${esc(nutritionStatus)} Open Food Facts est communautaire : vérifie l’étiquette si une valeur paraît anormale.</p>
        <div class="form-grid">
          <label>Calories<input id="kcal" inputmode="numeric" value="${esc(day.kcal)}" placeholder="2300"></label>
          <label>Protéines<input id="protein" inputmode="numeric" value="${esc(day.protein)}" placeholder="155"></label>
          <label>Lipides<input id="fat" inputmode="numeric" value="${esc(day.fat)}" placeholder="70"></label>
          <label>Glucides<input id="carbs" inputmode="numeric" value="${esc(day.carbs)}" placeholder="250"></label>
        </div>
        <button class="btn btn-primary btn-block" id="saveNut">Enregistrer la correction</button>
        ${day.source === 'manual' && day.scanned.count ? '<button class="btn btn-secondary btn-block" id="resetNut">Revenir au calcul automatique</button>' : ''}
      </div>
    </details>
  `, 'nutrition')

  renderQuickFoods(document.querySelector('#quick-foods-slot'))
  renderStockRecipes(document.querySelector('#stock-recipes-slot'))

  document.querySelectorAll('[data-jump]').forEach((button) => {
    button.onclick = () => document.querySelector(`#${button.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  document.querySelectorAll('[data-meal-toggle]').forEach((header) => {
    header.onclick = () => {
      const card = header.closest('.v3-meal')
      if (!card) return
      const wasOpen = card.classList.contains('open')
      document.querySelectorAll('.v3-meal.open').forEach((openCard) => {
        openCard.classList.remove('open')
        const toggle = openCard.querySelector('.v3-meal-head b')
        if (toggle) toggle.textContent = '+'
      })
      if (!wasOpen) {
        card.classList.add('open')
        const toggle = card.querySelector('.v3-meal-head b')
        if (toggle) toggle.textContent = '−'
      }
    }
  })

  document.querySelector('#saveNut').onclick = () => {
    state.nutritionDays[TODAY()] = {
      kcal: document.querySelector('#kcal').value,
      protein: document.querySelector('#protein').value,
      fat: document.querySelector('#fat').value,
      carbs: document.querySelector('#carbs').value,
      updatedAt: new Date().toISOString()
    }
    save()
    nutritionPage()
  }

  const reset = document.querySelector('#resetNut')
  if (reset) reset.onclick = () => {
    delete state.nutritionDays[TODAY()]
    save()
    nutritionPage()
  }
}
