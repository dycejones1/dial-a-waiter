import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Api, Channel, Profile, SignupDraft } from './types'
import { createSupabaseApi } from './supabaseApi'
import { createDemoApi } from './demoApi'

function makeApi(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const configured = !!url && !!key && !url.includes('YOUR-PROJECT')
  // Demo mode only when asked for, or while developing without keys. A live build with no keys must not pretend to work.
  if (import.meta.env.VITE_DEMO_MODE === 'true' || (!configured && import.meta.env.DEV)) return createDemoApi()
  if (!configured) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. See README, "Connect Supabase".')
  return createSupabaseApi(url!, key!)
}

const emptyDraft: SignupDraft = { firstName: '', lastName: '', gender: '', dateOfBirth: '', email: '', phone: '', photo: null, role: 'staff', orgKind: 'business', orgName: '' }

/** Where someone lands after logging in. */
export function homeFor(p: Profile | null): string {
  if (!p) return '/'
  if (p.role === 'admin') return '/admin'
  if (p.role === 'employer') return '/venue'
  return p.onboarded_at ? '/home' : '/join/address'
}

interface SessionValue {
  api: Api
  ready: boolean
  userId: string | null
  profile: Profile | null
  setProfile: (p: Profile | null) => void
  refresh: () => Promise<void>
  draft: SignupDraft
  setDraft: (d: Partial<SignupDraft>) => void
  /** How the person chose to confirm, and the address the code went to. */
  confirm: { channel: Channel; to: string; purpose: 'join' | 'login' } | null
  setConfirm: (c: SessionValue['confirm']) => void
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const api = useMemo(makeApi, [])
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [draft, setDraftState] = useState<SignupDraft>(emptyDraft)
  const [confirm, setConfirm] = useState<SessionValue['confirm']>(null)

  const refresh = useCallback(async () => {
    const id = await api.currentUserId()
    setUserId(id)
    setProfile(id ? await api.getProfile().catch(() => null) : null)
  }, [api])

  useEffect(() => {
    refresh().finally(() => setReady(true))
    return api.onAuthChange(id => { setUserId(id); if (!id) setProfile(null) })
  }, [api, refresh])

  const setDraft = useCallback((d: Partial<SignupDraft>) => setDraftState(prev => ({ ...prev, ...d })), [])

  return (
    <Ctx.Provider value={{ api, ready, userId, profile, setProfile, refresh, draft, setDraft, confirm, setConfirm }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used inside SessionProvider')
  return v
}
