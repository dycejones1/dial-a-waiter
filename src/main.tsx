import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const configured = !!url && !!key && !url.includes('YOUR-PROJECT')
const demo = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV

createRoot(document.getElementById('root')!).render(
  configured || demo
    ? <StrictMode><App /></StrictMode>
    : <p style={{ padding: 24 }}>This build has no Supabase keys. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README), or VITE_DEMO_MODE=true.</p>
)
