import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { applyAppTitle } from '@/lib/appTitle'
import { demoModeEnabled } from '@/api/demoClient'
import '@/index.css'

applyAppTitle()

if (demoModeEnabled) {
  document.documentElement.classList.add('app-brand-background', 'app-hyp-demo')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
