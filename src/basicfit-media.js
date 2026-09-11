import './basicfit-media.css'

const BF='https://www.basic-fit.com'
const FP='https://www.fitnesspark.fr'
const bfWelcome=`${BF}/fr-be/accueil-chaleureux`
const bfFirst=`${BF}/fr-be/blog/la-premiere-fois-dans-une-salle-de-fitness`
const fpHalf=`${FP}/actualites/entrainement/conseils-dentrainement/programme-musculation-half-body/`
const fpWomen=`${FP}/actualites/entrainement/conseils-dentrainement/programme-de-musculation-femme/`
const fpPull=`${FP}/wp-content/uploads/2020/04/SANSMAT1.pdf`

const guides=[
 {match:['chest press machine'],label:'Chest Press',source:'Basic-Fit',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`,url:bfFirst,muscles:'Pectoraux · épaules · triceps',setup:'Poignées au milieu de la poitrine · dos et tête contre le dossier.',move:'Pousse sans verrouiller les coudes, puis reviens lentement.',avoid:'Ne décolle pas le dos et ne hausse pas les épaules.'},
 {match:['presse à jambes'],label:'Leg Press',source:'Basic-Fit',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`,url:bfWelcome,muscles:'Quadriceps · fessiers · ischios',setup:'Dos soutenu · pieds stables à largeur confortable.',move:'Descends sous contrôle puis pousse en gardant genoux et pieds alignés.',avoid:'Ne verrouille pas les genoux et ne décolle pas le bassin.'},
 {match:['tirage vertical'],label:'Lat Pulldown',source:'Basic-Fit',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`,url:bfWelcome,muscles:'Grand dorsal · haut du dos · biceps',setup:'Cale les cuisses · prise légèrement plus large que les épaules.',move:'Tire vers le haut de la poitrine en descendant les coudes.',avoid:'Ne balance pas le buste et ne tire pas derrière la nuque.'},
 {match:['rowing poulie assis','rowing prise serrée'],label:'Seated Row',source:'Basic-Fit',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`,url:bfFirst,muscles:'Milieu du dos · grand dorsal · biceps',setup:'Dos neutre · poitrine stable · épaules basses.',move:'Ramène la poignée vers l’abdomen et contrôle le retour.',avoid:'Ne rondis pas le dos et ne transforme pas le tirage en balancement.'},
 {match:['crunch poulie','abdos'],label:'Abdominal Crunch',source:'Basic-Fit',src:`${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`,url:bfWelcome,muscles:'Abdominaux · grand droit',setup:'Position stable et charge permettant de garder le contrôle.',move:'Enroule le tronc en contractant les abdos puis reviens lentement.',avoid:'N’utilise pas l’élan.'},
 {match:['tractions assistées'],label:'Tractions assistées · Graviton',source:'Fitness Park',url:fpPull,muscles:'Grand dorsal · grand rond · trapèzes · biceps',setup:'Choisis une assistance qui permet les reps prévues · prise stable · corps gainé.',move:'Monte sans balancer jusqu’à amener le menton au niveau de la barre puis contrôle la descente.',avoid:'Ne donne pas d’élan et ne relâche pas brutalement en bas.'},
 {match:['dips assistés'],label:'Dips assistés · machine',source:'Fitness Park',url:fpHalf,muscles:'Triceps · pectoraux · deltoïdes antérieurs',setup:'Assistance suffisante pour garder une trajectoire propre · épaules basses.',move:'Descends sous contrôle puis repousse jusqu’en haut sans verrouillage agressif.',avoid:'Ne laisse pas les épaules remonter vers les oreilles.'},
 {match:['curl incliné'],label:'Curl incliné',source:'Fitness Park',url:fpWomen,muscles:'Biceps',setup:'Dos contre le banc · bras relâchés sous les épaules · haltères stables.',move:'Fléchis les coudes sans avancer les épaules puis redescends lentement.',avoid:'Ne balance pas les bras et ne décolle pas le dos.'},
 {match:['développé incliné haltères','développé incliné'],label:'Développé incliné',source:'Fitness Park',url:fpWomen,muscles:'Haut des pectoraux · épaules · triceps',setup:'Omoplates stables sur le banc · pieds ancrés.',move:'Descends les haltères sous contrôle puis pousse au-dessus du haut de poitrine.',avoid:'Ne transforme pas le mouvement en développé épaules.'},
 {match:['élévations latérales'],label:'Élévations latérales',source:'Fitness Park',url:fpWomen,muscles:'Deltoïdes latéraux',setup:'Buste stable · coudes légèrement fléchis.',move:'Monte les bras sur les côtés avec contrôle puis redescends lentement.',avoid:'Ne hausse pas les épaules et ne donne pas d’élan.'},
 {match:['extension triceps'],label:'Extension triceps poulie',source:'Fitness Park',url:fpHalf,muscles:'Triceps',setup:'Coudes près du corps · buste stable.',move:'Étends les coudes jusqu’en bas puis contrôle la remontée.',avoid:'Ne fais pas participer les épaules ou le dos.'},
 {match:['curl marteau'],label:'Curl marteau',source:'Fitness Park',url:fpHalf,muscles:'Brachial · brachio-radial · biceps',setup:'Prise neutre · coudes proches du corps.',move:'Monte l’haltère sans bouger le bras puis redescends contrôlé.',avoid:'Ne balance pas le buste.'},
 {match:['leg curl'],label:'Leg Curl',source:'Fitness Park',url:fpHalf,muscles:'Ischio-jambiers',setup:'Axe du genou aligné avec la machine · bassin stable.',move:'Fléchis les genoux puis reviens lentement sans perdre la tension.',avoid:'Ne soulève pas le bassin pour finir la répétition.'},
 {match:['leg extension'],label:'Leg Extension',source:'Fitness Park',url:fpHalf,muscles:'Quadriceps',setup:'Genoux alignés avec l’axe de la machine · dos au dossier.',move:'Étends les genoux avec contrôle puis redescends lentement.',avoid:'Ne claque pas les genoux en extension.'},
 {match:['fentes marchées'],label:'Fentes marchées',source:'Fitness Park',url:fpHalf,muscles:'Quadriceps · fessiers · ischios',setup:'Buste gainé · pas suffisamment long pour rester stable.',move:'Descends verticalement puis pousse dans le sol pour avancer.',avoid:'Ne laisse pas le genou s’effondrer vers l’intérieur.'},
 {match:['fente bulgare'],label:'Fente bulgare',source:'Fitness Park',url:fpHalf,muscles:'Quadriceps · fessiers',setup:'Pied arrière sur support · pied avant suffisamment éloigné pour rester stable.',move:'Descends le bassin sous contrôle puis remonte par la jambe avant.',avoid:'Ne pousse pas principalement avec la jambe arrière.'},
 {match:['soulevé de terre roumain'],label:'Soulevé de terre roumain',source:'Fitness Park',url:fpHalf,muscles:'Ischios · fessiers · érecteurs du rachis',setup:'Dos neutre · genoux légèrement fléchis · charge proche des jambes.',move:'Recule les hanches jusqu’à sentir les ischios puis reviens en extension de hanche.',avoid:'Ne transforme pas le mouvement en squat et ne rondis pas le dos.'},
 {match:['hip thrust'],label:'Hip Thrust',source:'Fitness Park',url:fpWomen,muscles:'Fessiers · ischios',setup:'Haut du dos sur le banc · pieds stables · charge centrée sur le bassin.',move:'Monte le bassin en contractant les fessiers puis redescends sous contrôle.',avoid:'Ne termine pas en hyperextension lombaire.'},
 {match:['mollets'],label:'Mollets',source:'Fitness Park',url:fpHalf,muscles:'Gastrocnémiens · soléaire',setup:'Avant-pied stable · amplitude confortable.',move:'Monte sur la pointe des pieds, marque la contraction puis redescends lentement.',avoid:'Ne rebondis pas en bas.'},
 {match:['shoulder press machine'],label:'Shoulder Press',source:'Fitness Park',url:fpHalf,muscles:'Deltoïdes · triceps',setup:'Dos au dossier · poignées à hauteur confortable · épaules basses.',move:'Pousse au-dessus de la tête puis redescends sous contrôle.',avoid:'Ne cambre pas excessivement le bas du dos.'},
 {match:['reverse fly'],label:'Reverse Fly',source:'Fitness Park',url:fpWomen,muscles:'Deltoïdes postérieurs · haut du dos',setup:'Poitrine stable · épaules basses · coudes souples.',move:'Ouvre les bras en contrôlant les omoplates puis reviens lentement.',avoid:'Ne transforme pas le mouvement en haussement d’épaules.'},
 {match:['hack squat'],label:'Hack Squat',source:'Fitness Park',url:fpHalf,muscles:'Quadriceps · fessiers',setup:'Dos et bassin plaqués · pieds stables sur la plateforme.',move:'Descends avec genoux alignés sur les pieds puis pousse la plateforme.',avoid:'Ne décolle pas le bassin et ne verrouille pas brutalement les genoux.'},
 {match:['suspension barre'],label:'Suspension à la barre',source:'Fitness Park',url:fpPull,muscles:'Prise · avant-bras · épaules',setup:'Prise complète et corps gainé.',move:'Reste suspendu sans balancer pendant le temps prévu.',avoid:'Arrête si douleur d’épaule.'},
 {match:['scapular pull-ups'],label:'Scapular Pull-ups',source:'Fitness Park',url:fpPull,muscles:'Omoplates · grand dorsal · trapèzes',setup:'Suspendu bras tendus · tronc gainé.',move:'Abaisse les omoplates sans plier fortement les coudes puis relâche contrôlé.',avoid:'Ne transforme pas la répétition en traction complète.'},
 {match:['pompes strictes'],label:'Pompes strictes',source:'Fitness Park',url:fpPull,muscles:'Pectoraux · triceps · épaules',setup:'Corps aligné de la tête aux talons · mains stables.',move:'Descends le corps en bloc puis repousse.',avoid:'Ne laisse pas le bassin tomber.'},
 {match:['support dips'],label:'Support dips',source:'Fitness Park',url:fpHalf,muscles:'Triceps · épaules · gainage',setup:'Bras tendus · épaules abaissées · corps stable.',move:'Maintiens la position sans laisser les épaules s’effondrer.',avoid:'Pas de balancement.'},
 {match:['handstand au mur'],label:'Handstand au mur',source:'Fitness Park',url:fpPull,muscles:'Épaules · triceps · gainage',setup:'Mains solides au sol · corps gainé · progression prudente.',move:'Maintiens l’alignement pendant le temps prévu.',avoid:'Ne force pas si les poignets ou épaules sont douloureux.'}
]

function findGuide(name=''){const x=name.toLowerCase();return guides.find(g=>g.match.some(k=>x.includes(k)))}
function media(g){
 if(g.src)return `<a class="bf-media" href="${g.url}" target="_blank" rel="noopener"><img src="${g.src}" alt="${g.label} — ${g.source}" loading="lazy" referrerpolicy="no-referrer"><span>Démo ${g.source}</span></a>`
 return `<a class="bf-media bf-reference" href="${g.url}" target="_blank" rel="noopener"><div class="bf-reference-body"><strong>${g.label}</strong><span>Ouvrir la démonstration ${g.source}</span></div><span>Source ${g.source}</span></a>`
}
function renderGuide(g){return `<section class="bf-machine"><div class="bf-section-label">COMMENT FAIRE</div>${media(g)}<div class="bf-guide"><div class="bf-title"><strong>${g.label}</strong><small>${g.muscles}</small></div><dl><div><dt>1. Réglage</dt><dd>${g.setup}</dd></div><div><dt>2. Mouvement</dt><dd>${g.move}</dd></div><div><dt>3. À éviter</dt><dd>${g.avoid}</dd></div></dl></div></section>`}
function enhance(){
 if(!location.hash.startsWith('#workout/'))return
 document.querySelectorAll('.exercise-card').forEach(card=>{
  const name=card.querySelector('h2')?.textContent||''; const g=findGuide(name); if(!g)return
  card.classList.add('has-official-guide')
  const genericCue=card.querySelector('.exercise-cues p'); if(genericCue)genericCue.hidden=true
  let guide=card.querySelector('.bf-machine')
  if(!guide){
   const old=card.querySelector('.ex-visual')
   if(old){old.outerHTML=renderGuide(g);guide=card.querySelector('.bf-machine')}
   else{
    const anchor=card.querySelector('.exercise-cues')
    if(anchor){anchor.insertAdjacentHTML('afterend',renderGuide(g));guide=card.querySelector('.bf-machine')}
   }
  }
  card.querySelectorAll('.ex-visual').forEach(el=>el.remove())
  const perf=card.querySelector('.last-performance')
  if(guide&&perf&&guide.nextElementSibling!==perf)guide.insertAdjacentElement('afterend',perf)
 })
}
let busy=false;const apply=()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{enhance();busy=false})};new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',()=>setTimeout(apply,0));apply()
