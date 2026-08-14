import { defineConfig } from 'vite'

// base './' => le build fonctionne aussi bien à la racine d'un domaine
// que dans un sous-dossier GitHub Pages (https://user.github.io/apex/).
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: 'dist'
  }
})
