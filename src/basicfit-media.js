import './basicfit-media.css'

const BF = 'https://www.basic-fit.com'
const FP = 'https://www.fitnesspark.fr'
const bfWelcome = `${BF}/fr-be/accueil-chaleureux`
const bfFirst = `${BF}/fr-be/blog/la-premiere-fois-dans-une-salle-de-fitness`
const fpHalf = `${FP}/actualites/entrainement/conseils-dentrainement/programme-musculation-half-body/`
const fpWomen = `${FP}/actualites/entrainement/conseils-dentrainement/programme-de-musculation-femme/`
const fpPull = `${FP}/wp-content/uploads/2020/04/SANSMAT1.pdf`

const guides = [
  { match: ['chest press machine'], label: 'Chest Press', source: 'Basic-Fit', src: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw1b4c86d9/0_fdknajmm_0_84ptx3hs_12-ezgif.com-video-to-gif-converter.gif`, url: bfFirst, muscles: 'Pectoraux · épaules · triceps', setup: 'Poignées au milieu de la poitrine. Dos et tête contre le dossier.', move: 'Pousse sans verrouiller les coudes, puis reviens lentement.', avoid: 'Ne décolle pas le dos et ne hausse pas les épaules.' },
  { match: ['presse à jambes'], label: 'Leg Press', source: 'Basic-Fit', src: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dwc959a21b/0_0oxe37db_0_2ldh7nhy_12-ezgif.com-video-to-gif-converter.gif`, url: bfWelcome, muscles: 'Quadriceps · fessiers · ischios', setup: 'Dos soutenu. Pieds stables à largeur confortable.', move: 'Descends sous contrôle puis pousse en gardant genoux et pieds alignés.', avoid: 'Ne verrouille pas les genoux et ne décolle pas le bassin.' },
  { match: ['tirage vertical'], label: 'Lat Pulldown', source: 'Basic-Fit', src: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw6d007707/0_1k0danbd-ezgif.com-video-to-gif-converter.gif`, url: bfWelcome, muscles: 'Grand dorsal · haut du dos · biceps', setup: 'Cale les cuisses. Prise légèrement plus large que les épaules.', move: 'Tire vers le haut de la poitrine en descendant les coudes.', avoid: 'Ne balance pas le buste et ne tire pas derrière la nuque.' },
  { match: ['rowing poulie assis', 'rowing prise serrée'], label: 'Seated Row', source: 'Basic-Fit', src: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw9953e1b8/0_to0bmre4_0_oz5iawwf_12-ezgif.com-video-to-gif-converter.gif`, url: bfFirst, muscles: 'Milieu du dos · grand dorsal · biceps', setup: 'Dos neutre. Poitrine stable. Épaules basses.', move: 'Ramène la poignée vers l’abdomen puis contrôle le retour.', avoid: 'Ne rondis pas le dos et ne te balance pas.' },
  { match: ['crunch poulie', 'abdos'], label: 'Abdominal Crunch', source: 'Basic-Fit', src: `${BF}/on/demandware.static/-/Library-Sites-basic-fit-shared-library/default/dw2bae917d/0_1lf96kbg_0_k2zetkzq_12-ezgif.com-video-to-gif-converter.gif`, url: bfWelcome, muscles: 'Abdominaux · grand droit', setup: 'Position stable avec une charge que tu peux contrôler.', move: 'Enroule le tronc en contractant les abdos puis reviens lentement.', avoid: 'N’utilise pas l’élan.' },
  { match: ['tractions assistées'], label: 'Tractions assistées · Graviton', source: 'Fitness Park', url: fpPull, muscles: 'Grand dorsal · grand rond · trapèzes · biceps', setup: 'Choisis une assistance qui te permet les reps prévues. Corps gainé.', move: 'Monte sans balancer jusqu’au niveau de la barre puis contrôle la descente.', avoid: 'Ne donne pas d’élan et ne relâche pas brutalement en bas.' },
  { match: ['dips assistés'], label: 'Dips assistés · machine', source: 'Fitness Park', url: fpHalf, muscles: 'Triceps · pectoraux · épaules', setup: 'Prends assez d’assistance pour garder une trajectoire propre. Épaules basses.', move: 'Descends sous contrôle puis repousse jusqu’en haut.', avoid: 'Ne laisse pas les épaules remonter vers les oreilles.' },
  { match: ['curl incliné'], label: 'Curl incliné', source: 'Fitness Park', url: fpWomen, muscles: 'Biceps', setup: 'Dos contre le banc. Bras relâchés sous les épaules.', move: 'Fléchis les coudes sans avancer les épaules puis redescends lentement.', avoid: 'Ne balance pas les bras et ne décolle pas le dos.' },
  { match: ['développé incliné haltères', 'développé incliné'], label: 'Développé incliné', source: 'Fitness Park', url: fpWomen, muscles: 'Haut des pectoraux · épaules · triceps', setup: 'Omoplates stables sur le banc. Pieds ancrés.', move: 'Descends sous contrôle puis pousse au-dessus du haut de poitrine.', avoid: 'Ne transforme pas le mouvement en développé épaules.' },
  { match: ['élévations latérales'], label: 'Élévations latérales', source: 'Fitness Park', url: fpWomen, muscles: 'Deltoïdes latéraux', setup: 'Buste stable. Coudes légèrement fléchis.', move: 'Monte les bras sur les côtés puis redescends lentement.', avoid: 'Ne hausse pas les épaules et ne donne pas d’élan.' },
  { match: ['extension triceps'], label: 'Extension triceps poulie', source: 'Fitness Park', url: fpHalf, muscles: 'Triceps', setup: 'Coudes près du corps. Buste stable.', move: 'Étends les coudes vers le bas puis contrôle la remontée.', avoid: 'Ne fais pas participer les épaules ou le dos.' },
  { match: ['curl marteau'], label: 'Curl marteau', source: 'Fitness Park', url: fpHalf, muscles: 'Brachial · avant-bras · biceps', setup: 'Prise neutre. Coudes proches du corps.', move: 'Monte l’haltère sans bouger le bras puis redescends contrôlé.', avoid: 'Ne balance pas le buste.' },
  { match: ['leg curl'], label: 'Leg Curl', source: 'Fitness Park', url: fpHalf, muscles: 'Ischio-jambiers', setup: 'Aligne le genou avec l’axe de la machine. Bassin stable.', move: 'Fléchis les genoux puis reviens lentement.', avoid: 'Ne soulève pas le bassin pour finir la répétition.' },
  { match: ['leg extension'], label: 'Leg Extension', source: 'Fitness Park', url: fpHalf, muscles: 'Quadriceps', setup: 'Genoux alignés avec l’axe de la machine. Dos au dossier.', move: 'Étends les genoux puis redescends lentement.', avoid: 'Ne claque pas les genoux en extension.' },
  { match: ['fentes marchées'], label: 'Fentes marchées', source: 'Fitness Park', url: fpHalf, muscles: 'Quadriceps · fessiers · ischios', setup: 'Buste gainé. Fais un pas assez long pour rester stable.', move: 'Descends verticalement puis pousse dans le sol pour avancer.', avoid: 'Ne laisse pas le genou rentrer vers l’intérieur.' },
  { match: ['fente bulgare'], label: 'Fente bulgare', source: 'Fitness Park', url: fpHalf, muscles: 'Quadriceps · fessiers', setup: 'Pied arrière sur support. Pied avant assez éloigné pour rester stable.', move: 'Descends le bassin puis remonte par la jambe avant.', avoid: 'Ne pousse pas principalement avec la jambe arrière.' },
  { match: ['soulevé de terre roumain'], label: 'Soulevé de terre roumain', source: 'Fitness Park', url: fpHalf, muscles: 'Ischios · fessiers · bas du dos', setup: 'Dos neutre. Genoux légèrement fléchis. Charge près des jambes.', move: 'Recule les hanches jusqu’à sentir les ischios puis reviens.', avoid: 'Ne transforme pas le mouvement en squat et ne rondis pas le dos.' },
  { match: ['hip thrust'], label: 'Hip Thrust', source: 'Fitness Park', url: fpWomen, muscles: 'Fessiers · ischios', setup: 'Haut du dos sur le banc. Pieds stables. Charge centrée sur le bassin.', move: 'Monte le bassin en contractant les fessiers puis redescends.', avoid: 'Ne termine pas en hyperextension du bas du dos.' },
  { match: ['mollets'], label: 'Mollets', source: 'Fitness Park', url: fpHalf, muscles: 'Mollets', setup: 'Avant-pied stable avec une amplitude confortable.', move: 'Monte sur la pointe des pieds, marque la contraction puis redescends.', avoid: 'Ne rebondis pas en bas.' },
  { match: ['shoulder press machine'], label: 'Shoulder Press', source: 'Fitness Park', url: fpHalf, muscles: 'Épaules · triceps', setup: 'Dos au dossier. Poignées à hauteur confortable.', move: 'Pousse au-dessus de la tête puis redescends sous contrôle.', avoid: 'Ne cambre pas excessivement le bas du dos.' },
  { match: ['reverse fly'], label: 'Reverse Fly', source: 'Fitness Park', url: fpWomen, muscles: 'Arrière d’épaules · haut du dos', setup: 'Poitrine stable. Épaules basses. Coudes souples.', move: 'Ouvre les bras puis reviens lentement.', avoid: 'Ne transforme pas le mouvement en haussement d’épaules.' },
  { match: ['hack squat'], label: 'Hack Squat', source: 'Fitness Park', url: fpHalf, muscles: 'Quadriceps · fessiers', setup: 'Dos et bassin plaqués. Pieds stables sur la plateforme.', move: 'Descends avec les genoux alignés puis pousse la plateforme.', avoid: 'Ne décolle pas le bassin et ne verrouille pas brutalement les genoux.' },
  { match: ['suspension barre'], label: 'Suspension à la barre', source: 'Fitness Park', url: fpPull, muscles: 'Prise · avant-bras · épaules', setup: 'Prise complète. Corps gainé.', move: 'Reste suspendu sans balancer pendant le temps prévu.', avoid: 'Arrête si tu ressens une douleur d’épaule.' },
  { match: ['scapular pull-ups'], label: 'Scapular Pull-ups', source: 'Fitness Park', url: fpPull, muscles: 'Omoplates · grand dorsal · trapèzes', setup: 'Suspendu bras tendus. Tronc gainé.', move: 'Abaisse les omoplates sans plier fortement les coudes.', avoid: 'Ne transforme pas la répétition en traction complète.' },
  { match: ['pompes strictes'], label: 'Pompes strictes', source: 'Fitness Park', url: fpPull, muscles: 'Pectoraux · triceps · épaules', setup: 'Corps aligné de la tête aux talons. Mains stables.', move: 'Descends le corps en bloc puis repousse.', avoid: 'Ne laisse pas le bassin tomber.' },
  { match: ['support dips'], label: 'Support dips', source: 'Fitness Park', url: fpHalf, muscles: 'Triceps · épaules · gainage', setup: 'Bras tendus. Épaules abaissées. Corps stable.', move: 'Maintiens la position sans laisser les épaules s’effondrer.', avoid: 'Évite tout balancement.' },
  { match: ['handstand au mur'], label: 'Handstand au mur', source: 'Fitness Park', url: fpPull, muscles: 'Épaules · triceps · gainage', setup: 'Mains solides au sol. Corps gainé. Progression prudente.', move: 'Maintiens l’alignement pendant le temps prévu.', avoid: 'Ne force pas si poignets ou épaules sont douloureux.' }
]

function findGuide(name = '') {
  const normalized = name.toLowerCase()
  return guides.find((guide) => guide.match.some((key) => normalized.includes(key)))
}

function media(guide) {
  if (guide.src) {
    return `<a class="bf-media" href="${guide.url}" target="_blank" rel="noopener">
      <img src="${guide.src}" alt="Démonstration ${guide.label} — ${guide.source}" loading="lazy">
      <span>Démo officielle ${guide.source}</span>
    </a>`
  }
  return `<a class="bf-reference" href="${guide.url}" target="_blank" rel="noopener">
    <div><span class="bf-source">FICHE OFFICIELLE ${guide.source}</span><strong>${guide.label}</strong><small>Toucher pour ouvrir la démonstration complète</small></div><b>↗</b>
  </a>`
}

function renderGuide(guide) {
  return `<section class="bf-machine">
    <div class="bf-section-label">COMMENT FAIRE</div>
    ${media(guide)}
    <div class="bf-guide">
      <div class="bf-title"><strong>${guide.label}</strong><small>${guide.muscles}</small></div>
      <div class="bf-steps">
        <div><b>1</b><p><strong>Réglage</strong><span>${guide.setup}</span></p></div>
        <div><b>2</b><p><strong>Mouvement</strong><span>${guide.move}</span></p></div>
        <div class="bf-warning"><b>!</b><p><strong>À éviter</strong><span>${guide.avoid}</span></p></div>
      </div>
    </div>
  </section>`
}

function enhance() {
  if (!location.hash.startsWith('#workout/')) return
  document.querySelectorAll('.exercise-card').forEach((card) => {
    card.querySelectorAll('.ex-visual').forEach((node) => node.remove())
    const name = card.querySelector('h2')?.textContent || ''
    const guide = findGuide(name)
    if (!guide) return

    card.classList.add('has-official-guide')
    card.querySelector('.exercise-cues p')?.remove()

    let guideNode = card.querySelector('.bf-machine')
    if (!guideNode) {
      const anchor = card.querySelector('.exercise-cues')
      if (!anchor) return
      anchor.insertAdjacentHTML('afterend', renderGuide(guide))
      guideNode = card.querySelector('.bf-machine')
    }

    const performance = card.querySelector('.last-performance')
    if (guideNode && performance && guideNode.nextElementSibling !== performance) {
      guideNode.insertAdjacentElement('afterend', performance)
    }
  })
}

window.addEventListener('apex:rendered', enhance)
enhance()
