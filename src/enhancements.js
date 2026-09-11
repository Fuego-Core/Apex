import './enhancements.css'

const STORAGE='apex-coach-pro-v1'
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{return {}}}
const avg=(arr)=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null
const n=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toLocaleString('fr-FR',{maximumFractionDigits:d}):'—'

function movementSvg(name=''){
  const x=name.toLowerCase()
  if(x.includes('squat')||x.includes('presse')||x.includes('fente')||x.includes('extension')||x.includes('curl')) return `<svg viewBox="0 0 96 72" aria-hidden="true"><circle cx="49" cy="12" r="6"/><path d="M49 18v17l-14 10M49 29l15 7M35 45l-8 16M35 45l15 15M64 36l8 16"/><path d="M16 62h64"/><path d="M24 18v44M24 24h16"/></svg>`
  if(x.includes('traction')||x.includes('tirage')||x.includes('rowing')||x.includes('pull')) return `<svg viewBox="0 0 96 72" aria-hidden="true"><path d="M18 10h60M26 10v9M70 10v9"/><circle cx="48" cy="24" r="6"/><path d="M48 30v17M48 34L31 18M48 34l17-16M48 47l-10 15M48 47l10 15"/><path d="M28 18h8M60 18h8"/></svg>`
  if(x.includes('développé')||x.includes('press')||x.includes('dips')||x.includes('pompe')) return `<svg viewBox="0 0 96 72" aria-hidden="true"><path d="M18 56h60M28 56V42h40v14"/><circle cx="47" cy="34" r="6"/><path d="M41 39l-12 7M53 39l12 7M29 46l-8-14M65 46l10-14"/><path d="M15 29h16M63 29h18"/><path d="M20 24v10M76 24v10"/></svg>`
  if(x.includes('latérale')||x.includes('reverse')||x.includes('shoulder')||x.includes('handstand')) return `<svg viewBox="0 0 96 72" aria-hidden="true"><circle cx="48" cy="16" r="6"/><path d="M48 22v24M48 30L23 28M48 30l25-2M48 46L37 62M48 46l11 16"/><circle cx="20" cy="28" r="3"/><circle cx="76" cy="28" r="3"/></svg>`
  return `<svg viewBox="0 0 96 72" aria-hidden="true"><circle cx="48" cy="14" r="6"/><path d="M48 20v25M48 29L32 40M48 29l16 11M48 45L38 62M48 45l10 17"/><circle cx="28" cy="43" r="4"/><circle cx="68" cy="43" r="4"/></svg>`
}

function recovery(){
 const s=read(), c=(s.checkins||[]).slice(-3)
 if(!c.length)return {level:'orange',label:'À mesurer',text:'Fais ton premier check-in pour obtenir un indicateur de récupération.'}
 const sleep=avg(c.map(x=>Number(x.sleep)).filter(Number.isFinite)),feel=avg(c.map(x=>Number(x.feeling)).filter(Number.isFinite)); const pain=c.some(x=>x.pain&&String(x.pain).trim().toLowerCase()!=='aucune')
 if(pain||sleep<5.5||feel<5)return {level:'red',label:'Récupération basse',text:'Douleur, sommeil ou sensations insuffisants : prudence et signalement au coach.'}
 if(sleep<6.5||feel<7)return {level:'orange',label:'À surveiller',text:'Tu peux suivre le plan, mais garde la marge prévue et surveille la fatigue.'}
 return {level:'green',label:'Bonne récupération',text:'Les derniers check-ins sont compatibles avec la progression prévue.'}
}

function addRecovery(){
 if(location.hash!=='#home'&&location.hash!=='')return
 const host=document.querySelector('.metric-grid'); if(!host||document.querySelector('.recovery-card'))return
 const r=recovery(); host.insertAdjacentHTML('afterend',`<article class="recovery-card" data-level="${r.level}"><div class="recovery-dot">${r.level==='green'?'✓':r.level==='red'?'!':'·'}</div><div><strong>${r.label}</strong><p>${r.text}</p></div></article>`)
}

function lastPerformance(sessionId,exIndex){
 const h=(read().history||[]).filter(x=>x.sessionId===sessionId).reverse(); const prev=h[0]?.exercises?.[exIndex]?.sets||[]
 if(!prev.length)return null
 const weights=prev.map(x=>x.weight).filter(Boolean), reps=prev.map(x=>x.reps).filter(Boolean), rirs=prev.map(x=>x.rir).filter(Boolean)
 return {weight:weights[0]||'—',reps:reps.join(' / ')||'—',rir:rirs.join(' / ')||'—'}
}

function enhanceWorkout(){
 const m=location.hash.match(/^#workout\/(.+)$/); if(!m)return
 const sessionId=m[1]; document.querySelectorAll('.exercise-card').forEach((card,i)=>{
   if(card.querySelector('.ex-visual'))return
   const title=card.querySelector('h2')?.textContent||''; const perf=lastPerformance(sessionId,i)
   const top=card.querySelector('.exercise-cues'); if(!top)return
   top.insertAdjacentHTML('afterend',`<div class="ex-visual">${movementSvg(title)}<div><strong>Repère mouvement</strong><p>Position stable · trajectoire contrôlée · aucune douleur articulaire. L’illustration sert de repère visuel, pas de démonstration biomécanique complète.</p></div></div>${perf?`<div class="last-performance"><div><span>Dernière performance</span><strong>${perf.weight} · ${perf.reps} reps · RIR ${perf.rir}</strong></div><div class="target-now"><span>Objectif aujourd’hui</span><strong>Égale ou dépasse proprement avant d’augmenter la charge</strong></div></div>`:`<div class="last-performance"><div><span>Première référence</span><strong>Calibre la charge avec le RIR demandé</strong></div><div class="target-now"><span>Objectif aujourd’hui</span><strong>Créer une référence propre et reproductible</strong></div></div>`}`)
 })
}

function enhanceNutrition(){
 if(location.hash!=='#nutrition')return
 document.querySelectorAll('.meal-card').forEach((card,i)=>{
   if(card.classList.contains('enhanced'))return
   card.classList.add('enhanced'); if(i===0)card.classList.add('open')
   const head=card.querySelector('header'); if(!head)return
   head.insertAdjacentHTML('beforeend',`<button class="meal-toggle" aria-label="Afficher les variantes">${i===0?'−':'+'}</button>`)
   head.querySelector('.meal-toggle').onclick=e=>{e.stopPropagation();card.classList.toggle('open');e.currentTarget.textContent=card.classList.contains('open')?'−':'+'}
   head.onclick=()=>{card.classList.toggle('open');head.querySelector('.meal-toggle').textContent=card.classList.contains('open')?'−':'+'}
 })
}

function weeklyData(){
 const s=read(), now=Date.now(), weekAgo=now-7*864e5
 const check=(s.checkins||[]).filter(x=>new Date(`${x.date}T12:00:00`).getTime()>=weekAgo)
 const body=(s.body||[]).filter(x=>new Date(`${x.date}T12:00:00`).getTime()>=weekAgo)
 const hist=(s.history||[]).filter(x=>new Date(`${x.date}T12:00:00`).getTime()>=weekAgo)
 const nut=Object.entries(s.nutritionDays||{}).filter(([d])=>new Date(`${d}T12:00:00`).getTime()>=weekAgo).map(([,v])=>v)
 const first=body[0],last=body.at(-1)
 return {sessions:hist.length,weight:avg(body.map(x=>Number(x.weight)).filter(Number.isFinite)),deltaNavel:first&&last?Number(last.navel)-Number(first.navel):null,sleep:avg(check.map(x=>Number(x.sleep)).filter(Number.isFinite)),feeling:avg(check.map(x=>Number(x.feeling)).filter(Number.isFinite)),kcal:avg(nut.map(x=>Number(x.kcal)).filter(Number.isFinite)),protein:avg(nut.map(x=>Number(x.protein)).filter(Number.isFinite)),pain:check.filter(x=>x.pain&&String(x.pain).trim().toLowerCase()!=='aucune').map(x=>x.pain)}
}

function enhanceCheckin(){
 if(location.hash!=='#checkin'||document.querySelector('.coach-report-card'))return
 const form=document.querySelector('.check-form'); if(!form)return
 const w=weeklyData(); form.insertAdjacentHTML('beforebegin',`<article class="plain-card coach-report-card"><h3>Bilan des 7 derniers jours</h3><p>Lecture rapide des données qui me servent pour ajuster ton coaching.</p><div class="weekly-summary"><div><span>Séances</span><strong>${w.sessions}</strong></div><div><span>Poids moyen</span><strong>${w.weight===null?'—':n(w.weight)} kg</strong></div><div><span>Nombril</span><strong>${w.deltaNavel===null?'—':`${w.deltaNavel>0?'+':''}${n(w.deltaNavel)} cm`}</strong></div><div><span>Sommeil moyen</span><strong>${w.sleep===null?'—':`${n(w.sleep)} h`}</strong></div><div><span>Calories moy.</span><strong>${w.kcal===null?'—':Math.round(w.kcal)}</strong></div><div><span>Protéines moy.</span><strong>${w.protein===null?'—':`${Math.round(w.protein)} g`}</strong></div><div><span>Sensations</span><strong>${w.feeling===null?'—':`${n(w.feeling)}/10`}</strong></div><div><span>Douleurs signalées</span><strong>${w.pain.length}</strong></div></div><button class="btn btn-secondary btn-block" id="copyWeekly">Copier bilan hebdo</button></article>`)
 document.querySelector('#copyWeekly').onclick=async()=>{const r=recovery(); const text=`APEX — Bilan 7 jours\nSéances: ${w.sessions}\nPoids moyen: ${w.weight===null?'—':n(w.weight)} kg\nÉvolution nombril: ${w.deltaNavel===null?'—':`${w.deltaNavel>0?'+':''}${n(w.deltaNavel)} cm`}\nSommeil moyen: ${w.sleep===null?'—':n(w.sleep)} h\nCalories moyennes: ${w.kcal===null?'—':Math.round(w.kcal)}\nProtéines moyennes: ${w.protein===null?'—':Math.round(w.protein)} g\nSensations moyennes: ${w.feeling===null?'—':n(w.feeling)}/10\nDouleurs signalées: ${w.pain.length?w.pain.join(' | '):'Aucune'}\nRécupération: ${r.label}`; try{await navigator.clipboard.writeText(text);document.querySelector('#copyWeekly').textContent='Bilan copié'}catch{prompt('Copie le bilan :',text)}}
}

let lock=false
const apply=()=>{if(lock)return;lock=true;requestAnimationFrame(()=>{try{addRecovery();enhanceWorkout();enhanceNutrition();enhanceCheckin()}finally{lock=false}})}
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true})
window.addEventListener('hashchange',()=>setTimeout(apply,0)); apply()
