import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startVersionCheck } from './versionCheck.js'

// 端末間のキャッシュずれ（古いバンドルの表示）を検出して自動更新
startVersionCheck()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
