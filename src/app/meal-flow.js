import { TODAY, save, state } from './store.js'

const OFF_SEARCH='https://world.openfoodfacts.org/cgi/search.pl'
const BASE=[
  {name:'Œuf entier',kcal:143,protein:12.6,carbs:.7,fat:9.5,unit:'œuf',unitGrams:50,defaultQty:2,source:'Base APEX'},
  {name:'Banane',kcal:89,protein:1.1,carbs:23,fat:.3,unit:'banane',unitGrams:120,defaultQty:1,source:'Base APEX'},
  {name:'Skyr nature',kcal:63,protein:10.8,carbs:4,fat:.2,unit:'g',defaultQty:200,source:'Base APEX'},
  {name:'Fromage blanc 0%',kcal:46,protein:8,carbs:4,fat:.2,unit:'g',defaultQty:200,source:'Base APEX'},
  {name:'Blanc de poulet',kcal:120,protein:23,carbs:0,fat:2.6,unit:'g',defaultQty:150,source:'Base APEX'},
  {name:'Riz basmati cuit',kcal:130,protein:2.7,carbs:28,fat:.3,unit:'g',defaultQty:150,source:'Base APEX'},
  {name:'Pâtes cuites',kcal:157,protein:5.8,carbs:30.9,fat:.9,unit:'g',defaultQty:150,source:'Base APEX'},
  {name:'Flocons d’avoine',kcal:370,protein:13,carbs:59,fat:7,unit:'g',defaultQty:60,source:'Base APEX'},
  {name:'Whey protéine',kcal:390,protein:78,carbs:8,fat:6,unit:'dose',unitGrams:30,defaultQty:1,source:'Base APEX'},
  {name:'Pain complet',kcal:247,protein:9,carbs:41,fat:3.5,unit:'tranche',unitGrams:35,defaultQty:2,source:'Base APEX'},
  {name:'Pomme',kcal:52,protein:.3,carbs:14,fat:.2,unit:'pomme',unitGrams:150,defaultQty:1,source:'Base APEX'},
  {name:'Saumon',kcal:208,protein:20,carbs:0,fat:13,unit:'g',defaultQty:150,source:'Base APEX'}
]

function n(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function uid(){return `food-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
function ensure(){state.foodLog=state.foodLog&&typeof state.foodLog==='object'?state.foodLog:{};state.foodLog[TODAY()]=Array.isArray(state.foodLog[TODAY()])?state.foodLog[TODAY()]:[];state.customFoods=Array.isArray(state.customFoods)?state.customFoods:[]}
function gramsFor(food,qty){return food.unit&&food.unit!=='g'&&food.unit!=='ml'&&food.unitGrams?n(qty)*n(food.unitGrams):n(qty)}
function macros(food,grams){const f=Math.max(0,n(grams))/100;return {kcal:n(food.kcal)*f,protein:n(food.protein)*f,carbs:n(food.carbs)*f,fat:n(food.fat)*f}}

function addFood(food,qty){ensure();const grams=gramsFor(food,qty);const m=macros(food,grams);state.foodLog[TODAY()].push({id:uid(),name:food.name,brand:food.brand||'',barcode:food.barcode||'',mealName:state.activeMeal||'Repas',amount:grams,displayAmount:n(qty),displayUnit:food.unit||'g',...m,per100:{kcal:n(food.kcal),protein:n(food.protein),carbs:n(food.carbs),fat:n(food.fat)},source:food.source||'APEX',at:new Date().toISOString()});save({scope:'nutrition'})}

async function online(term){
  const url=`${OFF_SEARCH}?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=16&fields=code,product_name,product_name_fr,brands,nutriments`
  const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('offline')
  const d=await r.json();return (d.products||[]).map(p=>{const z=p.nutriments||{};return {name:p.product_name_fr||p.product_name||'Produit',brand:p.brands||'Open Food Facts',barcode:p.code||'',kcal:n(z['energy-kcal_100g']??z['energy-kcal']),protein:n(z.proteins_100g),carbs:n(z.carbohydrates_100g),fat:n(z.fat_100g),unit:'g',defaultQty:100,source:'Open Food Facts'}}).filter(x=>x.name)
}

function allLocal(){ensure();return [...state.customFoods.map(f=>({...f,unit:f.unit||'g',defaultQty:f.defaultQty||100,source:f.source||'Ma base APEX'})),...BASE]}
function key(f){return f.barcode||`${f.name}|${f.brand||f.source||''}`.toLowerCase()}

function quantityCard(food){
  document.querySelector('.meal-food-qty')?.remove()
  const unit=food.unit||'g', plural=unit==='œuf'?'œufs':unit==='banane'?'bananes':unit==='pomme'?'pommes':unit==='tranche'?'tranches':unit==='dose'?'doses':unit
  const box=document.createElement('div');box.className='meal-food-qty'
  box.innerHTML=`<div class="meal-food-qty__card"><button class="meal-food-qty__close">×</button><span>${esc(state.activeMeal||'Repas')}</span><h3>${esc(food.name)}</h3><small>${esc(food.brand||food.source||'APEX')}</small><label>${unit==='g'||unit==='ml'?'Quantité':'Combien ?'}<div><input id="mealFoodQty" inputmode="decimal" value="${esc(food.defaultQty||1)}"><b>${esc(plural)}</b></div></label><div id="mealFoodPreview"></div><button id="mealFoodConfirm">Ajouter à ${esc(state.activeMeal||'ce repas')}</button></div>`
  document.body.appendChild(box)
  const input=box.querySelector('#mealFoodQty'),preview=box.querySelector('#mealFoodPreview')
  const draw=()=>{const g=gramsFor(food,input.value),m=macros(food,g);preview.innerHTML=`<strong>${Math.round(m.kcal)} kcal</strong><span>${m.protein.toFixed(1)} g prot. · ${m.carbs.toFixed(1)} g gluc. · ${m.fat.toFixed(1)} g lip.</span>${unit!=='g'&&unit!=='ml'?`<small>≈ ${Math.round(g)} g utilisés uniquement pour le calcul</small>`:''}`}
  input.oninput=draw;draw();box.querySelector('.meal-food-qty__close').onclick=()=>box.remove();box.onclick=e=>{if(e.target===box)box.remove()};box.querySelector('#mealFoodConfirm').onclick=()=>{if(n(input.value)<=0)return;addFood(food,input.value);box.remove()}
}

function renderUnifiedSearch(){
  if((location.hash||'#home')!=='#nutrition')return
  const host=document.querySelector('.simple-add__head');if(!host||document.querySelector('#mealFoodSearch'))return
  const section=document.createElement('section');section.className='meal-food-search';section.id='mealFoodSearch'
  section.innerHTML=`<div class="meal-food-search__bar"><input id="mealFoodQuery" autocomplete="off" placeholder="Chercher œuf, banane, skyr, Lidl, Aldi…"><button id="mealFoodGo">Rechercher</button></div><div class="meal-food-search__shortcuts"><button data-q="">Essentiels</button><button data-q="Lidl">Lidl</button><button data-q="Aldi">Aldi</button><button data-q="skyr">Skyr</button></div><div id="mealFoodResults" class="meal-food-results"></div>`
  host.after(section)
  const input=section.querySelector('#mealFoodQuery'),results=section.querySelector('#mealFoodResults')
  let shown=[]
  const draw=()=>{results.innerHTML=shown.length?shown.slice(0,12).map((f,i)=>`<button class="meal-food-result" data-food="${i}"><span><strong>${esc(f.name)}</strong><small>${esc(f.brand||f.source||'APEX')} · ${Math.round(n(f.kcal))} kcal/100g</small></span><b>＋</b></button>`).join(''):'<p class="meal-food-empty">Aucun aliment trouvé.</p>';results.querySelectorAll('[data-food]').forEach(b=>b.onclick=()=>quantityCard(shown[Number(b.dataset.food)]))}
  const run=async(q)=>{const term=q.trim();const local=allLocal().filter(f=>!term||`${f.name} ${f.brand||''} ${f.source||''}`.toLowerCase().includes(term.toLowerCase()));shown=local;draw();if(!term)return;results.classList.add('loading');try{const remote=await online(term);const map=new Map([...local,...remote].map(f=>[key(f),f]));shown=[...map.values()];draw()}catch{}finally{results.classList.remove('loading')}}
  section.querySelector('#mealFoodGo').onclick=()=>run(input.value);input.addEventListener('keydown',e=>{if(e.key==='Enter')run(input.value)});section.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{input.value=b.dataset.q;run(b.dataset.q)});run('')
}

function decorateJournal(){
  if((location.hash||'#home')!=='#nutrition')return
  const rows=Array.isArray(state.foodLog?.[TODAY()])?state.foodLog[TODAY()]:[]
  document.querySelectorAll('.food-row[data-food]').forEach(button=>{const row=rows[Number(button.dataset.food)];if(!row)return;if(!button.querySelector('.meal-tag')){const tag=document.createElement('em');tag.className='meal-tag';tag.textContent=row.mealName||'Repas';button.querySelector('span')?.prepend(tag)}const small=button.querySelector('small');if(small&&row.displayAmount&&row.displayUnit){const u=row.displayUnit==='œuf'&&row.displayAmount>1?'œufs':row.displayUnit;small.textContent=`${row.displayAmount} ${u} · ${n(row.protein).toFixed(1)} g prot.`}}
  )
}

window.addEventListener('apex:rendered',()=>setTimeout(()=>{renderUnifiedSearch();decorateJournal()},0))
window.addEventListener('hashchange',()=>setTimeout(()=>{renderUnifiedSearch();decorateJournal()},0))
setTimeout(()=>{renderUnifiedSearch();decorateJournal()},0)
