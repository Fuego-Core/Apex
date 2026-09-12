import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay, save, state } from './store.js'
import { esc, shell } from './ui.js'
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

function dateLabel() {
  const label = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return label.charAt(0).toUpperCase() + label.slice(1)
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
      ? 'Correction manuelle active.'
      : `${day.scanned.count} aliment${day.scanned.count > 1 ? 's' : ''} ajouté${day.scanned.count > 1 ? 's' : ''} aujourd’hui.`
    : 'Aucun aliment ajouté aujourd’hui.'

  const macros = [
    ['Protéines', protein, nutritionTargets.protein, 'protein'],
    ['Glucides', carbs, nutritionTargets.carbs, 'carbs'],
    ['Lipides', fat, nutritionTargets.fat, 'fat']
  ]

  shell(`
    <header class="nx-head nx-head--nutrition">
      <div class="nx-brand">APEX<span>.</span><small>NUTRITION</small></div>
      <div class="nx-date">${esc(dateLabel())}</div>
      <h1>Alimentation</h1>
      <p>Ajoute ce que tu manges. APEX calcule le reste.</p>
    </header>

    <section class="nx-day-summary">
      <div>
        <span>AUJOURD’HUI</span>
        <strong>${Math.round(kcal)} <small>/ ${nutritionTargets.kcal} kcal</small></strong>
        <div class="nx-day-track"><i style="width:${pct(kcal, nutritionTargets.kcal)}%"></i></div>
      </div>
      <aside><span>IL TE RESTE</span><strong>${remainingKcal}</strong><small>kcal · ${remainingProtein} g prot.</small></aside>
    </section>

    <section class="nx-macros nx-macros--nutrition">
      ${macros.map(([label,current,target,tone]) => `<article class="nx-macro nx-macro--${tone}">
        <div class="nx-macro-top"><span>${label}</span><b>${Math.round(current)} <small>/ ${target} g</small></b></div>
        <div class="nx-track"><i style="width:${pct(current,target)}%"></i></div>
        <small>${Math.max(0, Math.round(target-current))} g restantes</small>
      </article>`).join('')}
    </section>

    <section class="nx-action-grid">
      <button data-jump="nutrition-tools-slot" class="nx-action nx-action--primary"><span>＋</span><div><small>AJOUTER</small><strong>Un aliment</strong><p>Scanner ou saisir</p></div><b>›</b></button>
      <button data-jump="quick-foods-slot" class="nx-action"><span>♡</span><div><small>RAPIDE</small><strong>Récents & favoris</strong><p>En un geste</p></div><b>›</b></button>
      <button data-jump="stock-recipes-slot" class="nx-action"><span>□</span><div><small>STOCK</small><strong>Idées de repas</strong><p>Avec ce que tu as</p></div><b>›</b></button>
      <button data-jump="meal-plan" class="nx-action"><span>☰</span><div><small>REPÈRES</small><strong>Plan du jour</strong><p>Selon ton rythme</p></div><b>›</b></button>
    </section>

    <section class="nx-workspace" id="nutrition-tools-slot-wrap">
      <div class="nx-workspace-head"><span>AJOUTER</span><h2>Scanner ou saisir</h2><p>Le plus rapide pour mettre ta journée à jour.</p></div>
      <div id="nutrition-tools-slot"></div>
    </section>

    <section class="nx-workspace">
      <div class="nx-workspace-head"><span>EN UN GESTE</span><h2>Récents & favoris</h2><p>Réutilise les aliments que tu consommes souvent.</p></div>
      <div id="quick-foods-slot"></div>
    </section>

    <section class="nx-workspace">
      <div class="nx-workspace-head"><span>TON STOCK</span><h2>Que manger ?</h2><p>Des idées basées sur les aliments disponibles chez toi.</p></div>
      <div id="stock-recipes-slot"></div>
    </section>

    <section class="nx-workspace" id="meal-plan">
      <div class="nx-workspace-head"><span>TA JOURNÉE</span><h2>Repères de repas</h2><p>Une structure pratique, pas une obligation.</p></div>
      <div class="nx-plan-list">
        ${mealPlan.map((meal, mealIndex) => `<article class="nx-plan ${mealIndex === 0 ? 'open' : ''}">
          <button data-meal-toggle="${mealIndex}" type="button">
            <time>${esc(meal.time)}</time>
            <span><strong>${esc(meal.title.replace(/^Repas \d+ · /, ''))}</strong><small>${esc(meal.target)}</small></span>
            <b>${mealIndex === 0 ? '−' : '+'}</b>
          </button>
          <div class="nx-plan-body"><div>
            ${meal.options.map((option, index) => `<article><span>OPTION ${index + 1}</span><strong>${esc(option.name)}</strong>${option.items.map((item) => `<p>${esc(item)}</p>`).join('')}</article>`).join('')}
          </div></div>
        </article>`).join('')}
      </div>
    </section>

    <details class="nx-settings">
      <summary><span>Réglage avancé</span><strong>Corriger les totaux manuellement</strong><b>›</b></summary>
      <div class="nx-settings-body">
        <p>${esc(nutritionStatus)} Utilise cette correction seulement si les données d’un produit sont incorrectes.</p>
        <div class="form-grid">
          <label>Calories<input id="kcal" inputmode="numeric" value="${esc(day.kcal)}" placeholder="2300"></label>
          <label>Protéines<input id="protein" inputmode="numeric" value="${esc(day.protein)}" placeholder="155"></label>
          <label>Lipides<input id="fat" inputmode="numeric" value="${esc(day.fat)}" placeholder="70"></label>
          <label>Glucides<input id="carbs" inputmode="numeric" value="${esc(day.carbs)}" placeholder="250"></label>
        </div>
        <button class="btn btn-primary btn-block" id="saveNut">Enregistrer</button>
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
      const card = header.closest('.nx-plan')
      if (!card) return
      const wasOpen = card.classList.contains('open')
      document.querySelectorAll('.nx-plan.open').forEach((openCard) => {
        openCard.classList.remove('open')
        const toggle = openCard.querySelector('button b')
        if (toggle) toggle.textContent = '+'
      })
      if (!wasOpen) {
        card.classList.add('open')
        const toggle = card.querySelector('button b')
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
