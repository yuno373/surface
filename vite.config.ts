import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

// public フォルダをdistにコピーするプラグイン
function copyPublicPlugin() {
  return {
    name: 'copy-public',
    closeBundle() {
      function copyDir(src: string, dest: string) {
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
        for (const item of readdirSync(src)) {
          const srcPath = join(src, item)
          const destPath = join(dest, item)
          if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath)
          } else {
            copyFileSync(srcPath, destPath)
          }
        }
      }
      copyDir('public', 'dist')
    }
  }
}

export default defineConfig({
  plugins: [
    build({
      entry: 'src/index.tsx',
    }),
    copyPublicPlugin(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
