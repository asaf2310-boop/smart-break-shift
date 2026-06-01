import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { applyAppTitle } from '@/lib/appTitle'
import { applyHypDemoDocumentClasses } from '@/lib/hypPage'
import '@/index.css'

applyAppTitle()
applyHypDemoDocumentClasses()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
