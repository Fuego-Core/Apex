import { getState, save, exportJSON, importJSON, resetAll, resetProgramKeepHistory } from '../state.js'
import { navigate } from '../main.js'
import { esc, header, toast, confirmDialog, formatDateTime } from '../ui.js'

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function settingsView(root) {
  const state = getState()

  root.innerHTML = `
    <div class="page">
      ${header({ back: '#/', title: 'Réglages' })}

      <h3 class="section-title">Séance</h3>
      <div class="card">
        <label class="switch-row">
          <span><strong>Son du timer</strong><br><small>Bip à la fin du repos</small></span>
          <input type="checkbox" data-setting="sound" ${state.settings.sound ? 'checked' : ''}>
        </label>
        <label class="switch-row">
          <span><strong>Vibration</strong><br><small>Si l'appareil le permet</small></span>
          <input type="checkbox" data-setting="vibration" ${state.settings.vibration ? 'checked' : ''}>
        </label>
      </div>

      <h3 class="section-title">Sauvegarde</h3>
      <div class="card stack-sm">
        <p class="muted">${state.history.length} séance${state.history.length > 1 ? 's' : ''} en mémoire${
          state.history[0] ? ` · dernière ${esc(formatDateTime(state.history[0].startedAt))}` : ''
        }.</p>
        <button class="btn btn--gold btn--block" data-act="export">Exporter en JSON</button>
        <button class="btn btn--ghost btn--block" data-act="copy">Copier dans le presse-papier</button>
        <button class="btn btn--ghost btn--block" data-act="import">Importer un fichier JSON</button>
        <input type="file" accept="application/json,.json" hidden data-file>
        <details class="details">
          <summary>Coller un JSON à la main</summary>
          <textarea class="textarea" rows="6" placeholder='{"version":1,"program":[...]}' data-paste></textarea>
          <button class="btn btn--ghost btn--block" data-act="import-paste">Importer ce texte</button>
        </details>
      </div>

      <h3 class="section-title">Zone rouge</h3>
      <div class="card stack-sm">
        <button class="btn btn--ghost btn--block" data-act="reset-program">Réinitialiser le programme</button>
        <p class="muted">Remet les 5 séances et les poids d'origine. L'historique est conservé.</p>
        <button class="btn btn--danger btn--block" data-act="reset-all">Tout effacer</button>
        <p class="muted">Programme, historique et réglages. Irréversible.</p>
      </div>

      <p class="footnote">APEX v1 · 100% local, aucune donnée ne quitte l'appareil.</p>
    </div>`

  root.querySelectorAll('[data-setting]').forEach((input) => {
    input.addEventListener('change', () => {
      state.settings[input.dataset.setting] = input.checked
      save()
      toast('Réglage enregistré')
    })
  })

  const fileInput = root.querySelector('[data-file]')

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      importJSON(text)
      toast('Import réussi', 'gold')
      navigate('#/')
    } catch (e) {
      toast(`Import impossible : ${e.message}`, 'warn')
    } finally {
      fileInput.value = ''
    }
  })

  root.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (!act) return

    if (act === 'export') {
      download(`apex-${stamp()}.json`, exportJSON())
      toast('Fichier exporté')
    } else if (act === 'copy') {
      try {
        await navigator.clipboard.writeText(exportJSON())
        toast('JSON copié')
      } catch (err) {
        toast('Copie refusée par le navigateur', 'warn')
      }
    } else if (act === 'import') {
      fileInput.click()
    } else if (act === 'import-paste') {
      const text = root.querySelector('[data-paste]').value.trim()
      if (!text) return toast('Rien à importer', 'warn')
      try {
        importJSON(text)
        toast('Import réussi', 'gold')
        navigate('#/')
      } catch (err) {
        toast(`Import impossible : ${err.message}`, 'warn')
      }
    } else if (act === 'reset-program') {
      const ok = await confirmDialog({
        title: 'Réinitialiser le programme ?',
        message: "Les 5 séances repartent des valeurs d'origine. L'historique est conservé.",
        confirmLabel: 'Réinitialiser',
        danger: true
      })
      if (ok) {
        resetProgramKeepHistory()
        toast('Programme réinitialisé')
        navigate('#/')
      }
    } else if (act === 'reset-all') {
      const ok = await confirmDialog({
        title: 'Tout effacer ?',
        message: 'Programme, historique et réglages seront supprimés. Pense à exporter avant.',
        confirmLabel: 'Tout effacer',
        danger: true
      })
      if (ok) {
        resetAll()
        toast('Données effacées')
        navigate('#/')
      }
    }
  })
}
