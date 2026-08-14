/* CATALOGUE DES MOUVEMENTS — l'identité d'un exercice.

   Un mouvement a un id stable et global (`lateral-raise`). Une séance ne
   contient pas des exercices, elle contient des RÉFÉRENCES à ces mouvements :
   les élévations latérales de Push et celles de Upper sont le même mouvement,
   donc le même historique.

   L'id ne change JAMAIS. Le nom affiché, lui, peut changer sans casser quoi
   que ce soit — c'est tout l'intérêt de la séparation.

   Ce qui vit ici : ce qui appartient au mouvement lui-même (nom, mode, nature
   assistée). Ce qui vit dans la séance : ce qui appartient à TA pratique de ce
   mouvement ce jour-là (séries, fourchette de reps, poids, incrément, repos). */

/** Slug ASCII stable, utilisé pour fabriquer l'id d'un mouvement inconnu. */
export function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Clé de rapprochement par nom : insensible à la casse, aux accents, aux espaces. */
export function nameKey(s) {
  return slug(s)
}

function move(id, name, opts = {}) {
  return {
    id,
    name,
    mode: opts.mode ?? 'reps',
    assisted: opts.assisted ?? false,
    increment: opts.increment ?? 2.5
  }
}

/** Les 31 mouvements du programme d'origine. */
export const CATALOG = [
  move('supine-press-machine', 'Supine Press machine'),
  move('incline-dumbbell-press', 'Développé incliné haltères'),
  move('shoulder-press-machine', 'Développé épaules machine'),
  move('lateral-raise', 'Élévations latérales'),
  move('assisted-dips', 'Dips assistés', { assisted: true, increment: 2 }),
  move('triceps-rope-extension', 'Extension triceps corde'),
  move('incline-walk', 'Marche inclinée', { mode: 'temps', increment: 0 }),

  move('lat-pulldown-wide', 'Tirage vertical prise large'),
  move('barbell-row', 'Rowing barre penché'),
  move('cable-row-bar', 'Tirage horizontal poulie (barre courbée)'),
  move('face-pull', 'Face pull corde'),
  move('ez-bar-curl', 'Curl barre EZ'),
  move('hammer-curl', 'Hammer curl'),

  move('hack-squat', 'Hack squat'),
  move('leg-press', 'Presse à jambes'),
  move('walking-lunge', 'Fentes marchées'),
  move('leg-extension', 'Leg extension'),
  move('standing-calf-raise', 'Mollets debout'),
  move('plank', 'Planche', { mode: 'temps', increment: 0 }),

  move('arnold-press', 'Arnold press'),
  move('cable-row-vgrip', 'Tirage horizontal V-grip prise serrée'),
  move('reverse-fly-machine', 'Fly arrière machine'),
  move('skull-crusher-ez', 'Skull crushers EZ'),
  move('incline-dumbbell-curl', 'Curl incliné haltères'),

  move('romanian-deadlift', 'Soulevé de terre roumain'),
  move('bulgarian-split-squat', 'Fente bulgare'),
  move('lying-leg-curl', 'Leg curl couché'),
  move('hip-thrust-machine', 'Hip thrust machine'),
  move('calf-raise', 'Mollets'),
  move('cable-crunch', 'Crunch poulie'),
  move('stationary-bike', 'Vélo', { mode: 'temps', increment: 0 })
]

/** Catalogue frais, indexé par id. */
export function buildCatalog() {
  const out = {}
  for (const m of CATALOG) out[m.id] = { ...m }
  return out
}

/** Index nom normalisé -> id, pour rattacher l'historique v1 (identifié par nom). */
export function catalogIdByName(catalog = buildCatalog()) {
  const index = {}
  for (const m of Object.values(catalog)) index[nameKey(m.name)] = m.id
  return index
}

/**
 * Id de mouvement pour un nom libre : réutilise le mouvement connu s'il existe,
 * sinon fabrique un id stable dérivé du nom (dédupliqué contre l'existant).
 */
export function resolveOrCreate(catalog, { name, mode = 'reps', assisted = false, increment = 2.5 }) {
  const index = catalogIdByName(catalog)
  const key = nameKey(name)
  if (index[key]) return index[key]

  const base = key || 'exercice'
  let id = base
  let n = 2
  while (catalog[id]) id = `${base}-${n++}`
  catalog[id] = { id, name: String(name), mode, assisted: !!assisted, increment }
  return id
}
