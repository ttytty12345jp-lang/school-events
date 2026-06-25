import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// ビルドごとに一意のIDを発行（端末間のキャッシュずれ検出に使用）
const BUILD_ID = Date.now().toString()

// dist/version.json を書き出すプラグイン
function writeVersionPlugin() {
  return {
    name: 'write-version-json',
    apply: 'build',
    closeBundle() {
      try {
        writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify({ id: BUILD_ID }))
      } catch (e) {
        console.warn('version.json の書き出しに失敗:', e)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), writeVersionPlugin()],
  base: '/school-events/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    // 古いブラウザでもメディアクエリが解釈されるよう従来構文(max-width)で出力させる
    // （既定だと @media (width<=600px) という新しい範囲構文に最適化されてしまう）
    cssTarget: 'chrome80',
  },
})
