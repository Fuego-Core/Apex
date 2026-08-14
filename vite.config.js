import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/* Le service worker doit connaître les fichiers réellement produits : leurs
   noms sont hashés, donc inconnus tant que le build n'a pas tourné. On les
   injecte après coup, avec une version de cache dérivée du build. */
function serviceWorkerPrecache() {
  return {
    name: 'apex-sw-precache',
    apply: 'build',
    writeBundle(options, bundle) {
      const swPath = resolve(options.dir, 'sw.js')
      if (!existsSync(swPath)) return

      const assets = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => `./${f}`)
      // Version de cache dérivée du contenu : un nouveau build purge l'ancien,
      // un build identique ne fait rien retélécharger.
      const version = `apex-${createHash('sha1').update(assets.join('|')).digest('hex').slice(0, 8)}`

      const source = readFileSync(swPath, 'utf8')
        .replace("'__APEX_BUILD__'", JSON.stringify(version))
        .replace("'__APEX_ASSETS__'", JSON.stringify(assets))
      writeFileSync(swPath, source)
      this.info?.(`service worker : ${assets.length} fichiers précachés (${version})`)
    }
  }
}

// base './' => le build fonctionne aussi bien à la racine d'un domaine
// que dans un sous-dossier GitHub Pages (https://user.github.io/apex/).
export default defineConfig({
  base: './',
  plugins: [serviceWorkerPrecache()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: 'dist'
  }
})
