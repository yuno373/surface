import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

function copyPublicPlugin() {
  return {
    name: 'copy-public',
    closeBundle() {
      const root = process.cwd()
      const srcDir = join(root, 'public')
      const destDir = join(root, 'dist')
      if (!existsSync(srcDir)) { console.log('public/ not found, skipping copy'); return }
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
      copyDir(srcDir, destDir)
    }
  }
}

export default defineConfig({
  plugins: [copyPublicPlugin()],
  build: {
    ssr: 'src/server.ts',
    outDir: 'dist',
    rollupOptions: {
      external: ['@aws-sdk/client-s3']
    }
  },
  ssr: {
    external: ['@aws-sdk/client-s3']
  }
})
