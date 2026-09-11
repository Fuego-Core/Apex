import { mealPlan, nutritionTargets } from './config.js'
import { TODAY, nutritionDay, save, state } from './store.js'
import { coach, esc, section, shell, top } from './ui.js'

export function nutritionPage() {
  const day = nutritionDay(TODAY())

  shell(`
    ${top('Nutrition', 'Plan alimentaire adapté au travail de nuit')}
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

    <div id="nutrition-tools-slot"></div>

    ${section('Plan de la journée')}
    <p class="nutrition-note">Poids indiqués cuits quand c’est précisé. Choisis une seule variante par repas. Les marques changent les calories : vérifie les étiquettes et ajuste légèrement les féculents si nécessaire.</p>
    <div class="meal-plan">
      ${mealPlan.map((meal) => `<article class="meal-card">
        <header><div><span>${meal.time}</span><h3>${meal.title}</h3></div><small>${meal.target}</small></header>
        <div class="meal-options">${meal.options.map((option, index) => `<div><b>Option ${index + 1} · ${option.name}</b>${option.items.map((item) => `<p>${item}</p>`).join('')}</div>`).join('')}</div>
      </article>`).join('')}
    </div>

    ${coach('Hydratation', 'Garde de l’eau disponible pendant tout le poste. Créatine 3–5 g chaque jour. Caféine plutôt en début de poste afin de protéger le sommeil.')}

    ${section('Bilan du jour')}
    <article class="plain-card food-log">
      ${day.scanned.count ? `<p class="nutrition-note">Prérempli à partir de ${day.scanned.count} aliment${day.scanned.count > 1 ? 's' : ''} enregistré${day.scanned.count > 1 ? 's' : ''}. Tu peux corriger avant de valider.</p>` : ''}
      <div class="form-grid">
        <label>Calories<input id="kcal" inputmode="numeric" value="${esc(day.kcal)}" placeholder="2300"></label>
        <label>Protéines<input id="protein" inputmode="numeric" value="${esc(day.protein)}" placeholder="155"></label>
        <label>Lipides<input id="fat" inputmode="numeric" value="${esc(day.fat)}" placeholder="70"></label>
        <label>Glucides<input id="carbs" inputmode="numeric" value="${esc(day.carbs)}" placeholder="250"></label>
      </div>
      <button class="btn btn-primary btn-block" id="saveNut">Enregistrer</button>
    </article>
  `, 'nutrition')

  document.querySelector('#saveNut').onclick = () => {
    state.nutritionDays[TODAY()] = {
      kcal: document.querySelector('#kcal').value,
      protein: document.querySelector('#protein').value,
      fat: document.querySelector('#fat').value,
      carbs: document.querySelector('#carbs').value
    }
    save()
    nutritionPage()
  }
}
