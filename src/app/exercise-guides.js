import '../smartworkout-media.css'
import { exerciseMedia } from './exercise-media.js'

const guides = [
  { match:['chest press machine'],label:'Chest Press',muscles:'Pectoraux · épaules · triceps',setup:'Poignées au milieu de la poitrine. Dos et tête contre le dossier.',move:'Pousse sans verrouiller les coudes, puis reviens lentement.',avoid:'Ne décolle pas le dos et ne hausse pas les épaules.'},
  { match:['presse à jambes'],label:'Leg Press',muscles:'Quadriceps · fessiers · ischios',setup:'Dos soutenu. Pieds stables à largeur confortable.',move:'Descends sous contrôle puis pousse en gardant genoux et pieds alignés.',avoid:'Ne verrouille pas les genoux et ne décolle pas le bassin.'},
  { match:['tirage vertical'],label:'Lat Pulldown',muscles:'Grand dorsal · haut du dos · biceps',setup:'Cale les cuisses. Prise légèrement plus large que les épaules.',move:'Tire vers le haut de la poitrine en descendant les coudes.',avoid:'Ne balance pas le buste et ne tire pas derrière la nuque.'},
  { match:['rowing poulie assis','rowing prise serrée'],label:'Seated Row',muscles:'Milieu du dos · grand dorsal · biceps',setup:'Dos neutre. Poitrine stable. Épaules basses.',move:'Ramène la poignée vers l’abdomen puis contrôle le retour.',avoid:'Ne rondis pas le dos et ne te balance pas.'},
  { match:['crunch poulie','abdos'],label:'Abdominal Crunch',muscles:'Abdominaux · grand droit',setup:'Position stable avec une charge que tu peux contrôler.',move:'Enroule le tronc en contractant les abdos puis reviens lentement.',avoid:'N’utilise pas l’élan.'},
  { match:['tractions assistées'],label:'Tractions assistées · Graviton',muscles:'Grand dorsal · grand rond · trapèzes · biceps',setup:'Choisis une assistance qui te permet les reps prévues. Corps gainé.',move:'Monte sans balancer puis contrôle la descente.',avoid:'Ne donne pas d’élan et ne relâche pas brutalement en bas.'},
  { match:['dips assistés'],label:'Dips assistés · machine',muscles:'Triceps · pectoraux · épaules',setup:'Prends assez d’assistance pour garder une trajectoire propre. Épaules basses.',move:'Descends sous contrôle puis repousse jusqu’en haut.',avoid:'Ne laisse pas les épaules remonter vers les oreilles.'},
  { match:['curl incliné'],label:'Curl incliné',muscles:'Biceps',setup:'Dos contre le banc. Bras relâchés sous les épaules.',move:'Fléchis les coudes sans avancer les épaules puis redescends lentement.',avoid:'Ne balance pas les bras et ne décolle pas le dos.'},
  { match:['développé incliné haltères','développé incliné'],label:'Développé incliné',muscles:'Haut des pectoraux · épaules · triceps',setup:'Omoplates stables sur le banc. Pieds ancrés.',move:'Descends sous contrôle puis pousse au-dessus du haut de poitrine.',avoid:'Ne transforme pas le mouvement en développé épaules.'},
  { match:['élévations latérales'],label:'Élévations latérales',muscles:'Deltoïdes latéraux',setup:'Buste stable. Coudes légèrement fléchis.',move:'Monte les bras sur les côtés puis redescends lentement.',avoid:'Ne hausse pas les épaules et ne donne pas d’élan.'},
  { match:['extension triceps'],label:'Extension triceps poulie',muscles:'Triceps',setup:'Coudes près du corps. Buste stable.',move:'Étends les coudes vers le bas puis contrôle la remontée.',avoid:'Ne fais pas participer les épaules ou le dos.'},
  { match:['curl marteau'],label:'Curl marteau',muscles:'Brachial · avant-bras · biceps',setup:'Prise neutre. Coudes proches du corps.',move:'Monte l’haltère sans bouger le bras puis redescends contrôlé.',avoid:'Ne balance pas le buste.'},
  { match:['leg curl'],label:'Leg Curl',muscles:'Ischio-jambiers',setup:'Aligne le genou avec l’axe de la machine. Bassin stable.',move:'Fléchis les genoux puis reviens lentement.',avoid:'Ne soulève pas le bassin pour finir la répétition.'},
  { match:['leg extension'],label:'Leg Extension',muscles:'Quadriceps',setup:'Genoux alignés avec l’axe de la machine. Dos au dossier.',move:'Étends les genoux puis redescends lentement.',avoid:'Ne claque pas les genoux en extension.'},
  { match:['fentes marchées'],label:'Fentes marchées',muscles:'Quadriceps · fessiers · ischios',setup:'Buste gainé. Fais un pas assez long pour rester stable.',move:'Descends verticalement puis pousse dans le sol pour avancer.',avoid:'Ne laisse pas le genou rentrer vers l’intérieur.'},
  { match:['fente bulgare'],label:'Fente bulgare',muscles:'Quadriceps · fessiers',setup:'Pied arrière sur support. Pied avant assez éloigné pour rester stable.',move:'Descends le bassin puis remonte par la jambe avant.',avoid:'Ne pousse pas principalement avec la jambe arrière.'},
  { match:['soulevé de terre roumain'],label:'Soulevé de terre roumain',muscles:'Ischios · fessiers · bas du dos',setup:'Dos neutre. Genoux légèrement fléchis. Charge près des jambes.',move:'Recule les hanches jusqu’à sentir les ischios puis reviens.',avoid:'Ne transforme pas le mouvement en squat et ne rondis pas le dos.'},
  { match:['hip thrust'],label:'Hip Thrust',muscles:'Fessiers · ischios',setup:'Haut du dos sur le banc. Pieds stables. Charge centrée sur le bassin.',move:'Monte le bassin en contractant les fessiers puis redescends.',avoid:'Ne termine pas en hyperextension du bas du dos.'},
  { match:['mollets'],label:'Mollets',muscles:'Mollets',setup:'Avant-pied stable avec une amplitude confortable.',move:'Monte sur la pointe des pieds, marque la contraction puis redescends.',avoid:'Ne rebondis pas en bas.'},
  { match:['shoulder press machine'],label:'Shoulder Press',muscles:'Épaules · triceps',setup:'Dos au dossier. Poignées à hauteur confortable.',move:'Pousse au-dessus de la tête puis redescends sous contrôle.',avoid:'Ne cambre pas excessivement le bas du dos.'},
  { match:['reverse fly'],label:'Reverse Fly',muscles:'Arrière d’épaules · haut du dos',setup:'Poitrine stable. Épaules basses. Coudes souples.',move:'Ouvre les bras puis reviens lentement.',avoid:'Ne transforme pas le mouvement en haussement d’épaules.'},
  { match:['hack squat'],label:'Hack Squat',muscles:'Quadriceps · fessiers',setup:'Dos et bassin plaqués. Pieds stables sur la plateforme.',move:'Descends avec les genoux alignés puis pousse la plateforme.',avoid:'Ne décolle pas le bassin et ne verrouille pas brutalement les genoux.'},
  { match:['suspension barre'],label:'Suspension à la barre',muscles:'Prise · avant-bras · épaules',setup:'Prise complète. Corps gainé.',move:'Reste suspendu sans balancer pendant le temps prévu.',avoid:'Arrête si tu ressens une douleur d’épaule.'},
  { match:['scapular pull-ups'],label:'Scapular Pull-ups',muscles:'Omoplates · grand dorsal · trapèzes',setup:'Suspendu bras tendus. Tronc gainé.',move:'Abaisse les omoplates sans plier fortement les coudes.',avoid:'Ne transforme pas la répétition en traction complète.'},
  { match:['pompes strictes'],label:'Pompes strictes',muscles:'Pectoraux · triceps · épaules',setup:'Corps aligné de la tête aux talons. Mains stables.',move:'Descends le corps en bloc puis repousse.',avoid:'Ne laisse pas le bassin tomber.'},
  { match:['support dips'],label:'Support dips',muscles:'Triceps · épaules · gainage',setup:'Bras tendus. Épaules abaissées. Corps stable.',move:'Maintiens la position sans laisser les épaules s’effondrer.',avoid:'Évite tout balancement.'},
  { match:['handstand au mur'],label:'Handstand au mur',muscles:'Épaules · triceps · gainage',setup:'Mains solides au sol. Corps gainé. Progression prudente.',move:'Maintiens l’alignement pendant le temps prévu.',avoid:'Ne force pas si poignets ou épaules sont douloureux.'}
]

function esc(value=''){return String(value).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c])}

export function exerciseGuide(name=''){
  const normalized=String(name).toLowerCase()
  const guide=guides.find(g=>g.match.some(key=>normalized.includes(key)))||null
  if(!guide)return null
  const media=exerciseMedia(name)
  return media?{...guide,...media,src:media.thumbnail||media.image||null}:guide
}

function mediaBlock(guide){
  if(guide.image){
    return `<a class="sw-real-media" href="${esc(guide.page)}" target="_blank" rel="noopener"><img src="${esc(guide.image)}" alt="${esc(guide.label)} — démonstration ${esc(guide.source)}" loading="lazy"><span><b>${esc(guide.source)}</b><small>Démo officielle</small></span></a>`
  }
  if(guide.page){
    return `<a class="sw-clean-link" href="${esc(guide.page)}" target="_blank" rel="noopener"><span><small>GUIDE EXTERNE</small><b>${esc(guide.source)}</b></span><strong>Voir la démonstration ↗</strong></a>`
  }
  return ''
}

export function renderExerciseGuide(name=''){
  const guide=exerciseGuide(name)
  if(!guide)return ''
  return `<section class="sw-machine"><div class="sw-head"><div><span>TECHNIQUE</span><strong>${esc(guide.label)}</strong><small>${esc(guide.muscles)}</small></div></div>${mediaBlock(guide)}<div class="sw-guide"><div class="sw-steps"><div><b>1</b><p><strong>Réglage</strong><span>${esc(guide.setup)}</span></p></div><div><b>2</b><p><strong>Mouvement</strong><span>${esc(guide.move)}</span></p></div><div class="sw-warning"><b>!</b><p><strong>À éviter</strong><span>${esc(guide.avoid)}</span></p></div></div></div></section>`
}