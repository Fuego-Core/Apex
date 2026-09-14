import { nutritionTargets } from './config.js'
import { TODAY, nutritionDay, save, state } from './store.js'
import { esc, shell } from './ui.js'
import { renderQuickFoods } from './nutrition-quick.js'

function value(input){const n=Number(String(input??'').replace(',','.'));return Number.isFinite(n)?n:0}
function pct(current,target){return target?Math.max(0,Math.min(100,Math.round(value(current)/target*100))):0}
function dateLabel(){const s=new Intl.DateTimeFormat('fr-BE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());return s.charAt(0).toUpperCase()+s.slice(1)}
function defaultMeal(){const h=new Date().getHours();if(h<11)return 'Petit-déjeuner';if(h<16)return 'Déjeuner';if(h<21)return 'Dîner';return 'Collation'}

export function nutritionPage(){
  state.activeMeal=state.activeMeal||defaultMeal()
  const day=nutritionDay(TODAY())
  const kcal=value(day.kcal),protein=value(day.protein),carbs=value(day.carbs),fat=value(day.fat)
  const remain=Math.max(0,Math.round(nutritionTargets.kcal-kcal))
  const meals=['Petit-déjeuner','Déjeuner','Dîner','Collation']

  shell(`
    <header class="nx-head nx-head--nutrition simple-nutrition-head">
      <div class="nx-brand">APEX<span>.</span><small>NUTRITION</small></div>
      <div class="nx-date">${esc(dateLabel())}</div>
      <h1>Ma journée</h1>
      <p>Ajoute ce que tu manges. APEX fait les calculs.</p>
    </header>

    <section class="simple-summary">
      <div><span>CONSOMMÉ</span><strong>${Math.round(kcal)} <small>/ ${nutritionTargets.kcal} kcal</small></strong></div>
      <div class="simple-summary__remain"><span>IL TE RESTE</span><strong>${remain}</strong><small>kcal</small></div>
      <div class="simple-summary__bar"><i style="width:${pct(kcal,nutritionTargets.kcal)}%"></i></div>
      <div class="simple-summary__macros"><span>P <b>${Math.round(protein)}</b>/${nutritionTargets.protein}g</span><span>G <b>${Math.round(carbs)}</b>/${nutritionTargets.carbs}g</span><span>L <b>${Math.round(fat)}</b>/${nutritionTargets.fat}g</span></div>
    </section>

    <section class="simple-meal-picker">
      <span class="simple-kicker">1 · CHOISIS TON REPAS</span>
      <div>${meals.map(m=>`<button class="${state.activeMeal===m?'active':''}" data-meal="${esc(m)}">${esc(m)}</button>`).join('')}</div>
    </section>

    <section class="simple-add" id="nutrition-tools-slot-wrap">
      <div class="simple-add__head"><span class="simple-kicker">2 · AJOUTE CE QUE TU MANGES</span><h2>${esc(state.activeMeal)}</h2><p>Scanner, saisir ou reprendre un aliment récent.</p></div>
      <div id="nutrition-tools-slot"></div>
      <div id="quick-foods-slot"></div>
    </section>
  `,'nutrition')

  renderQuickFoods(document.querySelector('#quick-foods-slot'))
  document.querySelectorAll('[data-meal]').forEach(button=>{
    button.onclick=()=>{state.activeMeal=button.dataset.meal;save();nutritionPage()}
  })
}
