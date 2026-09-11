import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay, save, state } from './store.js'
import { coach, esc, section, shell, top } from './ui.js'
import { renderStockRecipes } from './pantry-recipes.js'

export function nutritionPage() {
  const day = nutritionDay(TODAY())
  const nutritionStatus = day.scanned.count
    ? day.source === 'manual'
      ? 'Correction manuelle active. Les aliments restent dans le journal et tu peux revenir au calcul automatique à tout moment.'
      : `Calculé automatiquement à partir de ${day.scanned.count} aliment${day.scanned.count > 1 ? 's' : ''}. Tu peux corriger ces totaux si une étiquette ou une portion est atypique.`
    : 'Aucun aliment journalisé : tu peux saisir les totaux manuellement ou utiliser le scanner.'

  shell(`
    ${top('Nutrition', 'Manger simplement · suivre précisément')}

    <section class="nutrition-hero">
      <div><p class="kicker">CIBLE QUOTIDIENNE</p><h2>${nutritionTargets.kcal}</h2><span>kcal</span></div>
      <div><strong>${nutritionTargets.protein} g</strong><span>protéines</span></div>
    </section>

    <div class="macro-grid">
      <article><span>Protéines</span><strong>${nutritionTargets.protein} g</strong></article>
      <article><span>Lipides</span><strong>${nutritionTargets.fat} g</strong></article>
      <article><span>Glucides</span><strong>≈ ${nutritionTargets.carbs} g</strong></article>
      <article><span>Créatine</span><strong>${nutritionTargets.creatine}</strong></article>
    </div>

    ${section('Ajouter ce que tu manges')}
    <p class="nutrition-note">Scanne tes courses, garde ton stock à jour, puis laisse APEX te proposer des plats réalisables avec ce que tu as déjà.</p>
    <div id="nutrition-tools-slot"></div>

    <div id="stock-recipes-slot"></div>

    ${section('Plan de la journée')}
    <p class="nutrition-note">Le plan reste une base. Les plats proposés depuis ton stock utilisent les valeurs nutritionnelles réelles de tes produits et peuvent remplacer une option du repas.</p>
    <div class="meal-plan">
      ${mealPlan.map((meal) => `<article class="meal-card">
        <header><div><span>${meal.time}</span><h3>${meal.title}</h3></div><small>${meal.target}</small></header>
        <div class="meal-options">${meal.options.map((option, index) => `<div><b>Option ${index + 1} · ${option.name}</b>${option.items.map((item) => `<p>${item}</p>`).join('')}</div>`).join('')}</div>
      </article>`).join('')}
    </div>

    ${coach('Hydratation', 'Garde de l’eau disponible pendant tout le poste. Créatine 3–5 g chaque jour. Caféine plutôt en début de poste afin de protéger le sommeil.')}

    ${section('Bilan du jour')}
    <article class="plain-card food-log">
      <p class="nutrition-note">${nutritionStatus}</p>
      <div class="form-grid">
        <label>Calories<input id="kcal" inputmode="numeric" value="${esc(day.kcal)}" placeholder="2300"></label>
        <label>Protéines<input id="protein" inputmode="numeric" value="${esc(day.protein)}" placeholder="155"></label>
        <label>Lipides<input id="fat" inputmode="numeric" value="${esc(day.fat)}" placeholder="70"></label>
        <label>Glucides<input id="carbs" inputmode="numeric" value="${esc(day.carbs)}" placeholder="250"></label>
      </div>
      <button class="btn btn-primary btn-block" id="saveNut">Enregistrer une correction</button>
      ${day.source === 'manual' && day.scanned.count ? '<button class="btn btn-secondary btn-block" id="resetNut">Revenir au calcul automatique</button>' : ''}
    </article>
  `, 'nutrition')

  renderStockRecipes(document.querySelector('#stock-recipes-slot'))

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
