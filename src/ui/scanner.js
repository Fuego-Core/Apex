/* SCANNER DE CODES-BARRES — réel, ou absent.

   Il n'y a pas de troisième possibilité. Si l'appareil sait lire un code-barres,
   la caméra s'ouvre et lit vraiment. Sinon, l'écran le dit franchement et
   propose la saisie du code à la main. Aucune animation de scan par-dessus une
   caméra qui ne détecte rien, aucun « détecté » qui n'aurait pas été détecté.

   La règle d'acceptation vit dans `createDetectionGate` : il faut LIRE DEUX
   FOIS DE SUITE le même code valide. Une lecture unique n'est jamais retenue —
   c'est ce qui empêche un reflet, un morceau d'emballage ou une image floue de
   passer pour un produit. Cette règle est pure et testée sans caméra. */

import { esc } from '../ui.js'
import { isBarcode } from '../data/openFoodFacts.js'

/** Les formats alimentaires. Le reste (QR, PDF417…) n'a rien à faire ici. */
export const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/**
 * Le garde-fou. Il n'accepte un code qu'après N lectures identiques
 * consécutives, et n'accepte jamais ce qui n'a pas la forme d'un code-barres.
 * @param {object} options
 * @param {number} options.needed lectures identiques exigées
 */
export function createDetectionGate({ needed = 2 } = {}) {
  let last = null
  let streak = 0

  return {
    /** @returns {string|null} le code si — et seulement si — il est confirmé */
    push(raw) {
      const code = String(raw ?? '').trim()
      if (!isBarcode(code)) {
        // Une lecture douteuse ne casse pas seulement le compte : elle le remet à zéro.
        last = null
        streak = 0
        return null
      }
      if (code === last) streak++
      else {
        last = code
        streak = 1
      }
      return streak >= needed ? code : null
    },

    get progress() {
      return { code: last, streak, needed }
    },

    reset() {
      last = null
      streak = 0
    }
  }
}

/**
 * Ce que l'appareil sait faire, vérifié et non supposé.
 * @returns {Promise<{ok: boolean, reason?: string, formats?: string[]}>}
 */
export async function scannerSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: 'Scanner indisponible ici.' }
  if (!window.isSecureContext) {
    return { ok: false, reason: 'La caméra exige une connexion sécurisée (https).' }
  }
  if (!('BarcodeDetector' in window)) {
    return { ok: false, reason: 'Ce navigateur ne sait pas lire les codes-barres.' }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'Ce navigateur ne donne pas accès à la caméra.' }
  }
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats()
    const usable = FORMATS.filter((f) => supported.includes(f))
    if (!usable.length) return { ok: false, reason: 'Ce navigateur ne lit aucun format de code-barres alimentaire.' }
    return { ok: true, formats: usable }
  } catch (e) {
    return { ok: false, reason: 'La lecture de codes-barres a échoué à démarrer.' }
  }
}

const CAMERA_ERRORS = {
  NotAllowedError: 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou tape le code à la main.',
  NotFoundError: 'Aucune caméra trouvée sur cet appareil.',
  NotReadableError: 'La caméra est déjà utilisée par une autre application.',
  OverconstrainedError: 'Aucune caméra ne convient sur cet appareil.'
}

/**
 * Ouvre le scanner.
 * @returns {Promise<{code: string}|{manual: true}|null>}
 *   un code réellement lu, une demande de saisie manuelle, ou rien.
 */
export function openScanner({ intervalMs = 200 } = {}) {
  return new Promise((resolve) => {
    const host = document.getElementById('overlay')
    const wrap = document.createElement('div')
    wrap.className = 'sheet scan'
    wrap.innerHTML = `
      <div class="sheet__panel scan__panel">
        <div class="sheet__grip"></div>
        <h3 class="sheet__title">Scanner un code-barres</h3>

        <div class="scan__stage">
          <video class="scan__video" playsinline muted autoplay></video>
          <div class="scan__frame" aria-hidden="true"></div>
        </div>

        <p class="note scan__status" data-status role="status">Démarrage de la caméra…</p>

        <div class="sheet__actions">
          <button type="button" class="btn btn--ghost" data-act="cancel">Annuler</button>
          <button type="button" class="btn btn--gold" data-act="manual">Saisir le code</button>
        </div>
      </div>`

    const video = wrap.querySelector('video')
    const status = wrap.querySelector('[data-status]')
    const gate = createDetectionGate()

    let stream = null
    let timer = null
    let settled = false

    function stop() {
      if (timer) clearInterval(timer)
      timer = null
      // On coupe la caméra AVANT de rendre la main : jamais de voyant qui reste allumé.
      for (const track of stream?.getTracks() || []) track.stop()
      stream = null
      video.srcObject = null
    }

    function close(result) {
      if (settled) return
      settled = true
      stop()
      wrap.classList.remove('is-in')
      setTimeout(() => wrap.remove(), 200)
      resolve(result)
    }

    /** Un message d'échec ne se transforme jamais en résultat. */
    function failWith(message) {
      stop()
      status.textContent = message
      status.classList.add('scan__status--warn')
      wrap.querySelector('.scan__stage').hidden = true
    }

    async function start() {
      const support = await scannerSupport()
      if (!support.ok) return failWith(`${support.reason} Tu peux taper le code à la main.`)

      let detector
      try {
        detector = new window.BarcodeDetector({ formats: support.formats })
      } catch (e) {
        return failWith('La lecture de codes-barres n’a pas pu démarrer. Tape le code à la main.')
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        })
      } catch (e) {
        return failWith(`${CAMERA_ERRORS[e?.name] || 'La caméra n’a pas pu démarrer.'}`)
      }
      if (settled) return stop()

      video.srcObject = stream
      try {
        await video.play()
      } catch (e) {
        /* certains navigateurs démarrent la lecture seuls : ce n'est pas un échec */
      }
      status.textContent = 'Cadre le code-barres du produit.'

      timer = setInterval(async () => {
        let found = []
        try {
          found = await detector.detect(video)
        } catch (e) {
          // Une image illisible n'est pas une erreur : on retente à la frame suivante.
          return
        }
        if (!found.length) return

        const code = gate.push(found[0].rawValue)
        if (!code) {
          // On montre qu'on a vu quelque chose, sans prétendre l'avoir validé.
          status.textContent = 'Code aperçu, maintiens le cadrage…'
          return
        }
        status.textContent = `Code lu : ${code}`
        navigator.vibrate?.(40)
        close({ code })
      }, intervalMs)
    }

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return close(null)
      const act = e.target.closest('[data-act]')?.dataset.act
      if (act === 'cancel') close(null)
      else if (act === 'manual') close({ manual: true })
    })

    host.appendChild(wrap)
    requestAnimationFrame(() => wrap.classList.add('is-in'))
    start()
  })
}

/** Le libellé du bouton d'appel, honnête sur ce qui va se passer. */
export function scanButtonHTML(supported) {
  return supported
    ? `<button type="button" class="btn btn--gold btn--block" data-act="scan">Scanner un code-barres</button>`
    : `<p class="note">${esc('Ce navigateur ne sait pas lire les codes-barres. Tape le code du produit dans le champ ci-dessous : APEX ira le chercher.')}</p>`
}
