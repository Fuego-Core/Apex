import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay, save, state } from './store.js'
import { coach, esc, section, shell, top } from './ui.js'
import { renderStockRecipes } from './pantry-recipes.js'
import { renderQuickFoods } from './nutrition-quick.js'

function value(input) {
  const parsed = Number(String(input ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
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
      ? 'Correction manuelle active. Les aliments restent dans le journal et tu peux revenir au calcul automatique à tout moment.'
      : `Calcul automatique depuis ${day.scanned.count} aliment${day.scanned.count > 1 ? 's' : ''}. Vérifie toujours l’étiquette si une valeur paraît anormale.`
    : 'Aucun aliment journalisé aujourd’hui. Scanne, choisis un aliment récent ou utilise ton stock.'

  shell(`
    ${top('Nutrition', 'Journal alimentaire · stock · recettes')}

    <section class="nutrition-hero">
      <div><p class="kicker">RESTE AUJOURD’HUI</p><h2>${remainingKcal}</h2><span>kcal</span></div>
      <div><strong>${remainingProtein} g</strong><span>protéines</span></div>
    </section>

    <div class="macro-grid">
      <article><span>Protéines</span><strong>${Math.round(protein)} / ${nutritionTargets.protein} g</strong></article>
      <article><span>Lipides</span><strong>${Math.round(fat)} / ${nutritionTargets.fat} g</strong></article>
      <article><span>Glucides</span><strong>${Math.round(carbs)} / ${nutritionTargets.carbs} g</strong></article>
      <article><span>Calories</span><strong>${Math.round(kcal)} / ${nutritionTargets.kcal}</strong></article>
    </div>

    ${section('Ajouter')}
    <p class="nutrition-note">Un seul réflexe : ajoute ce que tu manges. APEX met à jour automatiquement la journée et le stock quand les quantités sont connues.</p>
    <div id="nutrition-tools-slot"></div>
    <div id="quick-foods-slot"></div>
    <div id="stock-recipes-slot"></div>

    ${section('Plan de la journée')}
    <p class="nutrition-note">Une base adaptée à ton rythme de nuit. Tu peux remplacer n’importe quelle option par un plat calculé depuis ton stock.</p>
    <div class="meal-plan">
      ${mealPlan.map((meal, mealIndex) => `<article class="meal-card enhanced ${mealIndex === 0 ? 'open' : ''}">
        <header data-meal-toggle="${mealIndex}">
          <div><span>${meal.time}</span><h3>${meal.title}</h3></div>
          <small>${meal.target}</small>
          <button class="meal-toggle" type="button" aria-label="Afficher les variantes">${mealIndex === 0 ? '−' : '+'}</button>
        </header>
        <div class="meal-options">${meal.options.map((option, index) => `<div><b>Option ${index + 1} · ${option.name}</b>${option.items.map((item) => `<p>${item}</p>`).join('')}</div>`).join('')}</div>
      </article>`).join('')}
    </div>

    ${coach('Repères', 'La cible est une zone de travail, pas une obsession au gramme près. Priorité aux protéines, à la régularité et aux moyennes sur plusieurs jours.')}

    ${section('Correction manuelle')}
    <article class="plain-card food-log">
      <p class="nutrition-note">${nutritionStatus}</p>
      <div class="form-grid">
        <label>Calories<input id="kcal" inputmode="numeric" value="${esc(day.kcal)}" placeholder="2300"></label>
        <label>Protéines<input id="protein" inputmode="numeric" value="${esc(day.protein)}" placeholder="155"></label>
        <label>Lipides<input id="fat" inputmode="numeric" value="${esc(day.fat)}" placeholder="70"></label>
        <label>Glucides<input id="carbs" inputmode="numeric" value="${esc(day.carbs)}" placeholder="250"></label>
      </div>
      <button class="btn btn-primary btn-block" id="saveNut">Enregistrer la correction</button>
      ${day.source === 'manual' && day.scanned.count ? '<button class="btn btn-secondary btn-block" id="resetNut">Revenir au calcul automatique</button>' : ''}
    </article>
  `, 'nutrition')

  renderQuickFoods(document.querySelector('#quick-foods-slot'))
  renderStockRecipes(document.querySelector('#stock-recipes-slot'))

  document.querySelectorAll('[data-meal-toggle]').forEach((header) => {
    header.onclick = (event) => {
      event.preventDefault()
      const card = header.closest('.meal-card')
      if (!card) return
      card.classList.toggle('open')
      const toggle = card.querySelector('.meal-toggle')
      if (toggle) toggle.textContent = card.classList.contains('open') ? '−' : '+'
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
