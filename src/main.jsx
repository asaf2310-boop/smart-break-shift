import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { applyAppTitle } from '@/lib/appTitle'
import { applyBrandDocumentClasses } from '@/lib/brandShell'
import { migrateLegacyBrowserStorage } from '@/lib/browserStoragePolicy'
import '@/index.css'

applyAppTitle()
applyBrandDocumentClasses()
migrateLegacyBrowserStorage()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
