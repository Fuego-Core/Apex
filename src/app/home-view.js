import { nutritionTargets } from './config.js'
import { TODAY, nutritionDay, state } from './store.js'
import { esc, go, shell } from './ui.js'

function value(input){const n=Number(String(input??'').replace(',','.'));return Number.isFinite(n)?n:0}
function pct(current,target){return target?Math.max(0,Math.min(100,Math.round(value(current)/target*100))):0}
function dateLabel(){const s=new Intl.DateTimeFormat('fr-BE',{weekday:'long',day:'numeric',month:'long'}).format(new Date());return s.charAt(0).toUpperCase()+s.slice(1)}
function mealRows(){const rows=state.foodLog?.[TODAY()]||[];const meals=['Petit-déjeuner','Déjeuner','Dîner','Collation'];return meals.map(meal=>{const list=rows.filter(r=>(r.meal||r.mealName||'Collation')===meal);const kcal=list.reduce((s,r)=>s+value(r.kcal),0);return {meal,list,kcal}})}

export function homePage(){
  const day=nutritionDay(TODAY());const kcal=value(day.kcal),protein=value(day.protein),carbs=value(day.carbs),fat=value(day.fat)
  const left=Math.max(0,Math.round(nutritionTargets.kcal-kcal));const meals=mealRows()
  shell(`<header class="nx-head"><div class="nx-brand">APEX<span>.</span><small>NUTRITION</small></div><div class="nx-date">${esc(dateLabel())}</div><h1>Aujourd’hui</h1><p>Ta journée en un coup d’œil.</p></header>
  <section class="nx-calorie-card"><div class="nx-ring" style="--progress:${pct(kcal,nutritionTargets.kcal)*3.6}deg"><div><strong>${pct(kcal,nutritionTargets.kcal)}%</strong><span>du quota</span></div></div><div class="nx-calorie-copy"><span>CALORIES</span><strong>${Math.round(kcal)} <small>/ ${nutritionTargets.kcal} kcal</small></strong><p>${left} kcal restantes aujourd’hui</p></div><div class="nx-remain"><span>IL TE RESTE</span><strong>${left}</strong><small>kcal</small></div></section>
  <section class="nx-macros">${[['Protéines',protein,nutritionTargets.protein,'protein'],['Glucides',carbs,nutritionTargets.carbs,'carbs'],['Lipides',fat,nutritionTargets.fat,'fat']].map(([label,current,target,tone])=>`<article class="nx-macro nx-macro--${tone}"><div class="nx-macro-top"><span>${label}</span><b>${Math.round(current)} <small>/ ${target} g</small></b></div><div class="nx-track"><i style="width:${pct(current,target)}%"></i></div></article>`).join('')}</section>
  <button class="nx-add" data-go="nutrition"><span class="nx-add-icon">＋</span><span><strong>Ajouter ce que j’ai mangé</strong><small>Choisir un repas puis un aliment</small></span><b>›</b></button>
  <section class="nx-section"><div class="nx-section-head"><div><span>AUJOURD’HUI</span><h2>Mes repas</h2></div><button data-go="nutrition">Modifier</button></div><div class="nx-meals">${meals.map(({meal,list,kcal})=>`<button data-go="nutrition" class="nx-meal"><span>${list.length?`${list.length} aliment${list.length>1?'s':''}`:'Pas encore rempli'}</span><strong>${esc(meal)}</strong><small>${list.length?`${Math.round(kcal)} kcal`:'Ajouter mon repas'}</small><b>＋</b></button>`).join('')}</div></section>
  <section class="nx-tip"><span>MAISON</span><strong>${(state.pantry||[]).length} produit${(state.pantry||[]).length>1?'s':''} dans ton stock</strong><p>Les courses et le scanner de stock sont maintenant séparés de ton journal alimentaire.</p><button class="home-stock-link" data-go="storage">Voir mon stock</button></section>`,'home')
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go))
}
