import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { applyAppTitle } from '@/lib/appTitle'
import { applyBrandDocumentClasses } from '@/lib/brandShell'
import '@/index.css'

applyAppTitle()
applyBrandDocumentClasses()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
