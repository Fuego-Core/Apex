import './enhancements.css'

const STORAGE='apex-coach-pro-v1'
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{return {}}}
const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null
const n=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toLocaleString('fr-FR',{maximumFractionDigits:d}):'—'
const noPain=v=>{const x=String(v||'').trim().toLowerCase();return !x||['aucune','aucun','non','ras','r.a.s','aucune douleur','pas de douleur','0'].includes(x)}

function recovery(){
 const s=read(),c=(s.checkins||[]).slice(-3)
 if(!c.length)return {level:'orange',label:'À mesurer',text:'Fais ton premier check-in pour obtenir un indicateur de récupération.'}
 const sleep=avg(c.map(x=>Number(x.sleep)).filter(Number.isFinite)),feel=avg(c.map(x=>Number(x.feeling)).filter(Number.isFinite)),pain=c.some(x=>!noPain(x.pain))
 if(pain||sleep<5.5||feel<5)return {level:'red',label:'Récupération basse',text:'Douleur, sommeil ou sensations insuffisants : garde de la marge et signale ce qui ne va pas.'}
 if(sleep<6.5||feel<7)return {level:'orange',label:'À surveiller',text:'Tu peux suivre le plan, mais conserve le RIR prévu et surveille la fatigue.'}
 return {level:'green',label:'Bonne récupération',text:'Les derniers check-ins sont compatibles avec la progression prévue.'}
}

function addRecovery(){
 if(location.hash!=='#home'&&location.hash!=='')return
 const host=document.querySelector('.metric-grid');if(!host||document.querySelector('.recovery-card'))return
 const r=recovery();host.insertAdjacentHTML('afterend',`<article class="recovery-card" data-level="${r.level}"><div class="recovery-dot">${r.level==='green'?'✓':r.level==='red'?'!':'·'}</div><div><strong>${r.label}</strong><p>${r.text}</p></div></article>`)
}

function lastPerformance(sessionId,exIndex){
 const h=(read().history||[]).filter(x=>x.sessionId===sessionId).reverse(),prev=h[0]?.exercises?.[exIndex]?.sets||[]
 if(!prev.length)return null
 const weights=prev.map(x=>x.weight).filter(Boolean),reps=prev.map(x=>x.reps).filter(Boolean),rirs=prev.map(x=>x.rir).filter(Boolean)
 return {weight:weights[0]||'—',reps:reps.join(' / ')||'—',rir:rirs.join(' / ')||'—'}
}

function enhanceWorkout(){
 const m=location.hash.match(/^#workout\/(.+)$/);if(!m)return
 const sessionId=m[1]
 document.querySelectorAll('.exercise-card').forEach((card,i)=>{
   card.querySelectorAll('.ex-visual').forEach(el=>el.remove())
   const cues=card.querySelector('.exercise-cues');if(!cues)return
   const p=cues.querySelector('p');if(p&&/exécution contrôlée|amplitude confortable|technique stable/i.test(p.textContent||''))p.remove()
   if(card.querySelector('.last-performance'))return
   const perf=lastPerformance(sessionId,i)
   const html=perf
    ?`<div class="last-performance"><div><span>Dernière séance</span><strong>${perf.weight} · ${perf.reps} reps · RIR ${perf.rir}</strong></div><div class="target-now"><span>Aujourd’hui</span><strong>Fais aussi bien ou mieux sans perdre la technique</strong></div></div>`
    :`<div class="last-performance"><div><span>Première référence</span><strong>Choisis une charge adaptée au RIR demandé</strong></div><div class="target-now"><span>Aujourd’hui</span><strong>Crée une base propre pour la prochaine séance</strong></div></div>`
   const anchor=card.querySelector('.bf-machine')||cues
   anchor.insertAdjacentHTML('afterend',html)
 })
}

function enhanceNutrition(){
 if(location.hash!=='#nutrition')return
 document.querySelectorAll('.meal-card').forEach((card,i)=>{
   if(card.classList.contains('enhanced'))return
   card.classList.add('enhanced');if(i===0)card.classList.add('open')
   const head=card.querySelector('header');if(!head)return
   head.insertAdjacentHTML('beforeend',`<button class="meal-toggle" aria-label="Afficher les variantes">${i===0?'−':'+'}</button>`)
   const toggle=()=>{card.classList.toggle('open');head.querySelector('.meal-toggle').textContent=card.classList.contains('open')?'−':'+'}
   head.querySelector('.meal-toggle').onclick=e=>{e.stopPropagation();toggle()};head.onclick=toggle
 })
}

function weeklyData(){
 const s=read(),now=Date.now(),weekAgo=now-7*864e5
 const check=(s.checkins||[]).filter(x=>new Date(`${x.date}T12:00:00`).getTime()>=weekAgo)
 const body=(s.body||[]).filter(x=>new Date(`${x.date}T12:00:00`).getTime()>=weekAgo)
 const hist=(s.history||[]).filter(x=>new Date(`${x.date}T12:00:00`).getTime()>=weekAgo)
 const nut=Object.entries(s.nutritionDays||{}).filter(([d])=>new Date(`${d}T12:00:00`).getTime()>=weekAgo).map(([,v])=>v)
 const first=body[0],last=body.at(-1)
 return {sessions:hist.length,weight:avg(body.map(x=>Number(x.weight)).filter(Number.isFinite)),deltaNavel:first&&last?Number(last.navel)-Number(first.navel):null,sleep:avg(check.map(x=>Number(x.sleep)).filter(Number.isFinite)),feeling:avg(check.map(x=>Number(x.feeling)).filter(Number.isFinite)),kcal:avg(nut.map(x=>Number(x.kcal)).filter(Number.isFinite)),protein:avg(nut.map(x=>Number(x.protein)).filter(Number.isFinite)),pain:check.filter(x=>!noPain(x.pain)).map(x=>x.pain)}
}

function enhanceCheckin(){
 if(location.hash!=='#checkin'||document.querySelector('.coach-report-card'))return
 const form=document.querySelector('.check-form');if(!form)return
 const w=weeklyData();form.insertAdjacentHTML('beforebegin',`<article class="plain-card coach-report-card"><h3>Bilan des 7 derniers jours</h3><p>Les données utiles pour ajuster ton coaching.</p><div class="weekly-summary"><div><span>Séances</span><strong>${w.sessions}</strong></div><div><span>Poids moyen</span><strong>${w.weight===null?'—':n(w.weight)} kg</strong></div><div><span>Nombril</span><strong>${w.deltaNavel===null?'—':`${w.deltaNavel>0?'+':''}${n(w.deltaNavel)} cm`}</strong></div><div><span>Sommeil moyen</span><strong>${w.sleep===null?'—':`${n(w.sleep)} h`}</strong></div><div><span>Calories moy.</span><strong>${w.kcal===null?'—':Math.round(w.kcal)}</strong></div><div><span>Protéines moy.</span><strong>${w.protein===null?'—':`${Math.round(w.protein)} g`}</strong></div><div><span>Sensations</span><strong>${w.feeling===null?'—':`${n(w.feeling)}/10`}</strong></div><div><span>Douleurs</span><strong>${w.pain.length}</strong></div></div><button class="btn btn-secondary btn-block" id="copyWeekly">Copier le bilan</button></article>`)
 document.querySelector('#copyWeekly').onclick=async()=>{const r=recovery(),text=`APEX — Bilan 7 jours\nSéances: ${w.sessions}\nPoids moyen: ${w.weight===null?'—':n(w.weight)} kg\nÉvolution nombril: ${w.deltaNavel===null?'—':`${w.deltaNavel>0?'+':''}${n(w.deltaNavel)} cm`}\nSommeil moyen: ${w.sleep===null?'—':n(w.sleep)} h\nCalories moyennes: ${w.kcal===null?'—':Math.round(w.kcal)}\nProtéines moyennes: ${w.protein===null?'—':Math.round(w.protein)} g\nSensations moyennes: ${w.feeling===null?'—':n(w.feeling)}/10\nDouleurs: ${w.pain.length?w.pain.join(' | '):'Aucune'}\nRécupération: ${r.label}`;try{await navigator.clipboard.writeText(text);document.querySelector('#copyWeekly').textContent='Bilan copié'}catch{prompt('Copie le bilan :',text)}}
}

let lock=false
const apply=()=>{if(lock)return;lock=true;requestAnimationFrame(()=>{try{addRecovery();enhanceWorkout();enhanceNutrition();enhanceCheckin()}finally{lock=false}})}
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true})
window.addEventListener('hashchange',()=>setTimeout(apply,0));apply()
