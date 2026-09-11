import './basicfit-media.css'

const BF='https://www.basic-fit.com'
const machines=[
 {match:['chest press machine'],label:'Chest Press',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`,url:`${BF}/fr-be/blog/la-premiere-fois-dans-une-salle-de-fitness`,muscles:'Pectoraux · épaules · triceps',setup:'Poignées au milieu de la poitrine · dos et tête contre le dossier.',move:'Pousse sans verrouiller les coudes, puis reviens lentement.',avoid:'Ne décolle pas le dos et ne hausse pas les épaules.'},
 {match:['presse à jambes'],label:'Leg Press',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`,url:`${BF}/fr-fr/blog/abc-des-appareils-de-fitness`,muscles:'Quadriceps · fessiers · ischios',setup:'Dos entièrement soutenu · pieds à largeur d’épaules sur la plateforme.',move:'Descends sous contrôle vers environ 90°, puis pousse par les talons.',avoid:'Ne verrouille pas les genoux et garde les talons posés.'},
 {match:['tirage vertical'],label:'Lat Pulldown',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`,url:`${BF}/fr-be/accueil-chaleureux`,muscles:'Grand dorsal · haut du dos · biceps',setup:'Cale les cuisses · prise légèrement plus large que les épaules.',move:'Tire la barre vers le haut de la poitrine en descendant les coudes.',avoid:'Ne balance pas le buste et ne tire jamais derrière la nuque.'},
 {match:['rowing poulie assis','rowing prise serrée'],label:'Seated Row',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`,url:`${BF}/fr-be/blog/la-premiere-fois-dans-une-salle-de-fitness`,muscles:'Milieu du dos · grand dorsal · biceps',setup:'Poitrine stable contre le support si présent · dos droit.',move:'Ramène les poignées vers l’abdomen en serrant les omoplates.',avoid:'Ne rondis pas le dos et ne transforme pas le tirage en balancement.'},
 {match:['crunch poulie','abdos'],label:'Abdominal Crunch',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`,url:`${BF}/fr-be/accueil-chaleureux`,muscles:'Abdominaux · grand droit',setup:'Position stable et charge permettant de garder le contrôle.',move:'Enroule le tronc en contractant les abdos puis reviens lentement.',avoid:'N’utilise pas l’élan et ne tire pas uniquement avec les bras.'}
]
function findMachine(name=''){const x=name.toLowerCase();return machines.find(m=>m.match.some(k=>x.includes(k)))}
function enhance(){
 if(!location.hash.startsWith('#workout/'))return
 document.querySelectorAll('.exercise-card').forEach(card=>{
  if(card.querySelector('.bf-machine'))return
  const name=card.querySelector('h2')?.textContent||''; const m=findMachine(name); if(!m)return
  const old=card.querySelector('.ex-visual'); if(!old)return
  old.outerHTML=`<section class="bf-machine"><a class="bf-media" href="${m.url}" target="_blank" rel="noopener"><img src="${m.src}" alt="${m.label} chez Basic-Fit" loading="lazy"><span>Visuel officiel Basic-Fit</span></a><div class="bf-guide"><div class="bf-title"><strong>${m.label}</strong><small>${m.muscles}</small></div><dl><div><dt>Réglage</dt><dd>${m.setup}</dd></div><div><dt>Mouvement</dt><dd>${m.move}</dd></div><div><dt>À éviter</dt><dd>${m.avoid}</dd></div></dl></div></section>`
 })
}
let busy=false;const apply=()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{enhance();busy=false})};new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',()=>setTimeout(apply,0));apply()
