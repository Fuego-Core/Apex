/* Sortie de secours : si l'app ne démarre pas, l'utilisateur doit quand même
   pouvoir récupérer ses données. On lit le stockage brut, sans passer par le
   schéma ni la validation — justement parce que c'est peut-être eux le
   problème. */

/** Toutes les clés APEX présentes, telles quelles. */
export function collectRawApexData(storage = globalThis.localStorage) {
  const out = {}
  try {
    for (const key of Object.keys(storage)) {
      if (key.startsWith('apex.')) out[key] = storage.getItem(key)
    }
  } catch (e) {
    /* stockage inaccessible : on rend ce qu'on a */
  }
  return out
}

/** Fichier de secours, lisible et réimportable une fois le problème réglé. */
export function emergencyExportJSON(storage = globalThis.localStorage) {
  return JSON.stringify(
    {
      apexRescue: true,
      exportedAt: new Date().toISOString(),
      keys: collectRawApexData(storage)
    },
    null,
    2
  )
}

/** Déclenche le téléchargement du fichier de secours. */
export function downloadEmergencyExport(storage = globalThis.localStorage) {
  const blob = new Blob([emergencyExportJSON(storage)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `apex-secours-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
