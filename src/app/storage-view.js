import { state, save } from './store.js'
import { esc, shell } from './ui.js'
import { openScanner, openPantry } from '../nutrition-scanner.js'

const OFF_SEARCH='https://world.openfoodfacts.org/cgi/search.pl'

function num(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0}
function uid(){return `pantry-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
function ensure(){state.pantry=Array.isArray(state.pantry)?state.pantry:[];return state.pantry}
function stockLabel(p){if(p.remainingBase!==null&&p.remainingBase!==undefined)return `${Math.round(num(p.remainingBase))} ${p.baseUnit||'g'}`;return `${num(p.qty)||0} ${p.unit||'unité'}`}

async function loadStore(store){
  const url=`${OFF_SEARCH}?action=process&json=1&page_size=40&tagtype_0=stores&tag_contains_0=contains&tag_0=${encodeURIComponent(store)}&fields=code,product_name,product_name_fr,brands,image_front_small_url,image_front_url,nutriments`
  const r=await fetch(url,{headers:{Accept:'application/json'}})
  if(!r.ok)throw new Error('Catalogue indisponible')
  const data=await r.json()
  return (data.products||[]).map(p=>{const n=p.nutriments||{};return {barcode:p.code,name:p.product_name_fr||p.product_name||'Produit',brand:p.brands||store,image:p.image_front_small_url||p.image_front_url||'',kcal:num(n['energy-kcal_100g']??n['energy-kcal']),protein:num(n.proteins_100g),carbs:num(n.carbohydrates_100g),fat:num(n.fat_100g),source:store}}).filter(p=>p.name&&p.barcode)
}

function addModal(product){
  document.querySelector('.stock-modal')?.remove()
  document.body.insertAdjacentHTML('beforeend',`<div class="stock-modal"><section><button class="stock-modal__close" aria-label="Fermer">×</button><div class="stock-product-head">${product.image?`<img src="${esc(product.image)}" alt="">`:'<div class="stock-img-fallback">A</div>'}<div><span>${esc(product.brand||product.source||'APEX')}</span><h2>${esc(product.name)}</h2><p>${Math.round(num(product.kcal))} kcal / 100 g</p></div></div><div class="stock-fields"><label>Quantité<input id="stockAddQty" inputmode="decimal" value="1"></label><label>Unité<select id="stockAddUnit"><option value="unité">unité</option><option value="pack">pack</option><option value="g">g</option><option value="ml">ml</option></select></label><label id="stockPackWrap">Poids/volume par unité<input id="stockPackSize" inputmode="decimal" placeholder="Ex. 500"></label><label id="stockBaseWrap">Mesuré en<select id="stockBaseUnit"><option value="g">g</option><option value="ml">ml</option></select></label></div><button class="stock-primary" id="stockAddConfirm">Ajouter à mon stock</button></section></div>`)
  const modal=document.querySelector('.stock-modal')
  modal.querySelector('.stock-modal__close').onclick=()=>modal.remove()
  modal.onclick=e=>{if(e.target===modal)modal.remove()}
  modal.querySelector('#stockAddConfirm').onclick=()=>{
    const qty=Math.max(0,num(modal.querySelector('#stockAddQty').value))||1
    const unit=modal.querySelector('#stockAddUnit').value
    const packageSize=Math.max(0,num(modal.querySelector('#stockPackSize').value))
    const baseUnit=modal.querySelector('#stockBaseUnit').value
    const addedBase=(unit==='g'||unit==='ml')?qty:(packageSize?qty*packageSize:null)
    const pantry=ensure();const existing=pantry.find(x=>x.barcode&&x.barcode===product.barcode)
    if(existing){existing.qty=(num(existing.qty)||0)+qty;if(addedBase!==null)existing.remainingBase=(num(existing.remainingBase)||0)+addedBase}
    else pantry.push({...product,id:uid(),qty,unit,packageSize:packageSize||null,baseUnit:(unit==='g'||unit==='ml')?unit:baseUnit,remainingBase:addedBase,addedAt:new Date().toISOString()})
    save({scope:'nutrition'});modal.remove();storagePage()
  }
}

function manualModal(){
  document.querySelector('.stock-modal')?.remove()
  document.body.insertAdjacentHTML('beforeend',`<div class="stock-modal"><section><button class="stock-modal__close">×</button><span class="storage-kicker">AJOUT MANUEL</span><h2>Ajouter un produit</h2><div class="stock-fields stock-fields--manual"><label>Nom<input id="mStockName" placeholder="Ex. Œufs Aldi"></label><label>Quantité<input id="mStockQty" inputmode="decimal" value="1"></label><label>Unité<select id="mStockUnit"><option value="unité">unité</option><option value="pack">pack</option><option value="g">g</option><option value="ml">ml</option></select></label><label>Poids/volume par unité<input id="mStockSize" inputmode="decimal" placeholder="Ex. 500"></label></div><button class="stock-primary" id="mStockSave">Ajouter à mon stock</button></section></div>`)
  const modal=document.querySelector('.stock-modal');modal.querySelector('.stock-modal__close').onclick=()=>modal.remove()
  modal.querySelector('#mStockSave').onclick=()=>{const name=modal.querySelector('#mStockName').value.trim();if(!name)return;const qty=Math.max(0,num(modal.querySelector('#mStockQty').value))||1;const unit=modal.querySelector('#mStockUnit').value;const size=Math.max(0,num(modal.querySelector('#mStockSize').value));ensure().push({id:uid(),barcode:`manual-${Date.now()}`,name,brand:'Ajout manuel',qty,unit,packageSize:size||null,baseUnit:(unit==='ml'?'ml':'g'),remainingBase:(unit==='g'||unit==='ml')?qty:(size?qty*size:null),kcal:0,protein:0,carbs:0,fat:0,source:'Saisie manuelle',addedAt:new Date().toISOString()});save({scope:'nutrition'});modal.remove();storagePage()}
}

function renderStock(){const items=ensure();return items.length?items.slice(0,8).map(p=>`<article class="storage-owned">${p.image?`<img src="${esc(p.image)}" alt="">`:'<div class="storage-owned__ph">A</div>'}<div><strong>${esc(p.name)}</strong><small>${esc(p.brand||'APEX')} · ${esc(stockLabel(p))} restant</small></div></article>`).join(''):'<div class="storage-empty">Ton stock est vide. Ajoute tes courses avec Aldi, Lidl, le scanner ou manuellement.</div>'}

export function storagePage(){
  shell(`<header class="nx-head storage-head"><div class="nx-brand">APEX<span>.</span><small>STOCKAGE</small></div><h1>À la maison</h1><p>Tout ce que tu as réellement chez toi.</p></header><section class="storage-actions"><button data-store="Lidl"><b>Lidl</b><span>Voir les produits</span></button><button data-store="Aldi"><b>Aldi</b><span>Voir les produits</span></button><button id="storageScan"><b>Scanner</b><span>Code-barres</span></button><button id="storageManual"><b>Ajouter</b><span>Manuellement</span></button></section><section class="storage-current"><div class="storage-title"><div><span class="storage-kicker">MON STOCK</span><h2>Ce que j’ai chez moi</h2></div><button id="storageManage">Gérer tout</button></div><div class="storage-owned-list">${renderStock()}</div></section><section class="storage-catalog" id="storageCatalog" hidden><div class="storage-title"><div><span class="storage-kicker" id="storageStoreLabel">CATALOGUE</span><h2 id="storageStoreTitle">Produits</h2></div></div><div class="storage-search"><input id="storageFilter" placeholder="Rechercher dans cette liste…"></div><div id="storageProducts" class="storage-products"></div></section>`,'storage')
  document.querySelector('#storageScan').onclick=openScanner
  document.querySelector('#storageManual').onclick=manualModal
  document.querySelector('#storageManage').onclick=openPantry
  document.querySelectorAll('[data-store]').forEach(btn=>btn.onclick=async()=>{const store=btn.dataset.store;const section=document.querySelector('#storageCatalog');const list=document.querySelector('#storageProducts');section.hidden=false;document.querySelector('#storageStoreLabel').textContent=store.toUpperCase();document.querySelector('#storageStoreTitle').textContent=`Produits ${store}`;list.innerHTML='<div class="storage-empty">Chargement du catalogue…</div>';section.scrollIntoView({behavior:'smooth',block:'start'});try{let products=await loadStore(store);const draw=(rows)=>{list.innerHTML=rows.length?rows.map((p,i)=>`<article class="storage-product"><div class="storage-product__image">${p.image?`<img src="${esc(p.image)}" alt="">`:'<div>A</div>'}</div><div><strong>${esc(p.name)}</strong><small>${esc(p.brand||store)}</small></div><button data-add-product="${i}">＋</button></article>`).join(''):'<div class="storage-empty">Aucun produit trouvé.</div>';list.querySelectorAll('[data-add-product]').forEach(b=>b.onclick=()=>addModal(rows[Number(b.dataset.addProduct)]))};draw(products);document.querySelector('#storageFilter').oninput=e=>{const q=e.target.value.toLowerCase();draw(products.filter(p=>`${p.name} ${p.brand}`.toLowerCase().includes(q)))}}catch{list.innerHTML='<div class="storage-empty">Impossible de charger le catalogue pour le moment.</div>'}})
}
