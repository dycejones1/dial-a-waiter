// Demo mode: the whole app runs in the browser with sample shifts. Any code is "123456".
// Used for demos and for trying the app before Supabase is set up. Nothing leaves the device.
import type { Api, Application, Profile, Shift } from './types'
import { distanceKm } from './format'

export const DEMO_CODE = '123456'
const KEY = 'daw-demo-v1'

const day = (n: number, h: number, m = 0) => {
  const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + n); return d.toISOString()
}
const SHIFTS: (Omit<Shift, 'km'> & { lat: number; lng: number })[] = [
  { id: 's1', venueName: 'Sample Bistro', role: 'Bartender', startsAt: day(3, 17), endsAt: day(3, 22), payCents: 45000, area: 'Woodstock', lat: -33.9268, lng: 18.4475, description: 'Cocktail service for a 60-cover dinner.', bring: ['Black shirt', 'Wine key'] },
  { id: 's2', venueName: 'Sample Grill House', role: 'Waiter', startsAt: day(4, 17), endsAt: day(4, 22, 30), payCents: 65000, area: 'Observatory', lat: -33.9378, lng: 18.4712, description: 'Busy Saturday dinner service. POS experience a plus.', bring: ['Black shirt', 'Closed shoes'] },
  { id: 's3', venueName: 'Sample Burger Co.', role: 'Cleaner', startsAt: day(5, 8), endsAt: day(5, 14), payCents: 35000, area: 'Rondebosch', lat: -33.9611, lng: 18.4719, description: 'Front-of-house and kitchen cleaning.', bring: ['Closed shoes'] },
  { id: 's4', venueName: 'Sample Events Co.', role: 'Waitress', startsAt: day(6, 12), endsAt: day(6, 18), payCents: 60000, area: 'Sea Point', lat: -33.918, lng: 18.388, description: 'Outdoor wedding lunch, canapé and table service.', bring: ['White shirt'] },
  { id: 's5', venueName: 'Sample Kitchen', role: 'Dishwasher', startsAt: day(5, 17), endsAt: day(5, 23), payCents: 38000, area: 'Gardens', lat: -33.9339, lng: 18.4137, description: 'Evening service in an open kitchen.', bring: ['Closed shoes'] },
  { id: 's6', venueName: 'Sample Bistro', role: 'Head Chef', startsAt: day(8, 14), endsAt: day(8, 23), payCents: 140000, area: 'City Centre', lat: -33.9249, lng: 18.4241, description: 'Private function for 40 guests. Set menu supplied.', bring: ['Chef whites'] }
]

interface Store { userId: string | null; profile: Profile | null; applications: { id: string; shiftId: string; status: Application['status']; createdAt: string }[]; pending: Record<string, unknown> | null }

function load(): Store {
  try { const s = sessionStorage.getItem(KEY); if (s) return JSON.parse(s) } catch { /* storage unavailable */ }
  return { userId: null, profile: null, applications: [], pending: null }
}

export function createDemoApi(): Api {
  let st = load()
  const listeners = new Set<(id: string | null) => void>()
  const files = new Map<string, string>()
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(st)) } catch { /* ignore */ } }
  const wait = (ms = 250) => new Promise(r => setTimeout(r, ms))
  const withKm = (s: typeof SHIFTS[number], lat: number | null, lng: number | null): Shift =>
    ({ ...s, km: lat != null && lng != null ? distanceKm(lat, lng, s.lat, s.lng) : null })

  return {
    mode: 'demo',
    async currentUserId() { return st.userId },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    async sendCode(_c, _to, signup) { await wait(); st.pending = signup ?? null; save() },
    async verifyCode(channel, to, code) {
      await wait()
      if (code !== DEMO_CODE) throw new Error('That code is wrong or has expired. In demo mode the code is 123456.')
      if (!st.profile) {
        const meta = (st.pending ?? {}) as { first_name?: string; last_name?: string }
        st.profile = {
          id: 'demo-user', role: 'staff', first_name: meta.first_name ?? 'Friend', last_name: meta.last_name ?? null, gender: null,
          date_of_birth: null, email: channel === 'email' ? to : null, phone: channel === 'sms' ? to : null, confirmed_by: channel,
          photo_path: null, address: null, lat: null, lng: null, travel_km: 10, positions: [], cv_path: null,
          rtw_status: 'not_submitted', onboarded_at: null
        }
      }
      st.userId = 'demo-user'; save(); listeners.forEach(l => l(st.userId))
      return st.userId
    },
    async signOut() { st = { userId: null, profile: null, applications: [], pending: null }; save(); listeners.forEach(l => l(null)) },
    async getProfile() { return st.userId ? st.profile : null },
    async updateProfile(patch) {
      if (!st.profile) throw new Error('Please log in again.')
      st.profile = { ...st.profile, ...patch }; save(); return st.profile
    },
    async upload(kind, file) {
      await wait(400)
      const path = `demo/${kind}-${Date.now()}-${file.name}`
      try { files.set(path, URL.createObjectURL(file)) } catch { /* ignore */ }
      return path
    },
    async fileUrl(_k, path) { return files.get(path) ?? null },
    async savePrivate(d) {
      await wait()
      if (st.profile && (d.idNumber || d.idDocPath)) { st.profile.rtw_status = 'pending'; save() }
    },
    async listShifts({ lat, lng, km }) {
      await wait(200)
      return SHIFTS.map(s => withKm(s, lat, lng)).filter(s => s.km == null || s.km <= km)
        .sort((a, b) => (a.km ?? 999) - (b.km ?? 999) || a.startsAt.localeCompare(b.startsAt))
    },
    async getShift(id, from) {
      const s = SHIFTS.find(x => x.id === id); return s ? withKm(s, from?.lat ?? null, from?.lng ?? null) : null
    },
    async apply(shiftId) {
      await wait()
      if (!st.applications.some(a => a.shiftId === shiftId)) {
        st.applications.unshift({ id: 'a' + Date.now(), shiftId, status: 'applied', createdAt: new Date().toISOString() }); save()
      }
    },
    async myApplications() {
      return st.applications.map(a => ({ id: a.id, status: a.status, createdAt: a.createdAt, shift: withKm(SHIFTS.find(s => s.id === a.shiftId)!, null, null) }))
    }
  }
}
