import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { applyAppTitle } from '@/lib/appTitle'
<<<<<<< HEAD
import { applyBrandDocumentClasses } from '@/lib/brandShell'
import '@/index.css'

applyAppTitle()
applyBrandDocumentClasses()
=======
import { demoModeEnabled } from '@/api/demoClient'
import '@/index.css'

applyAppTitle()

if (demoModeEnabled) {
  document.documentElement.classList.add('app-brand-background', 'app-hyp-demo')
}
>>>>>>> 842dd9e (Initial commit)

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
