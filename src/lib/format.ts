// Formatting and validation helpers. Pure functions, covered by format.test.ts.

/** Turns a South African mobile number into international format (+27...). Returns null if it isn't valid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '')
  let n = digits
  if (n.startsWith('+')) n = n.slice(1)
  else if (n.startsWith('00')) n = n.slice(2)
  else if (n.startsWith('0')) n = '27' + n.slice(1)
  if (!/^\d{8,15}$/.test(n)) return null
  if (n.startsWith('27') && !/^27[6-8]\d{8}$/.test(n)) return null // SA mobiles: 06x, 07x, 08x
  return '+' + n
}

/** +27833028969 → +27 83 302 8969 for display. */
export function prettyPhone(p: string): string {
  const m = /^\+27(\d{2})(\d{3})(\d{4})$/.exec(p)
  return m ? `+27 ${m[1]} ${m[2]} ${m[3]}` : p
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim())
}

/** Checks a 13-digit South African ID number: date of birth and Luhn check digit. */
export function isValidSaId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false
  const mm = +id.slice(2, 4), dd = +id.slice(4, 6)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    let d = +id[12 - i]
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}

export function rands(cents: number): string {
  return 'R' + new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 0 }).format(Math.round(cents / 100))
}

export function shiftDay(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))
}

export function shiftTime(startIso: string, endIso: string): string {
  const f = new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${f.format(new Date(startIso))}–${f.format(new Date(endIso))}`
}

export function shiftHours(startIso: string, endIso: string): number {
  return Math.round(((new Date(endIso).getTime() - new Date(startIso).getTime()) / 36e5) * 10) / 10
}

export function km(value: number | null): string {
  if (value == null) return ''
  return value < 10 ? `${value.toFixed(1)} km` : `${Math.round(value)} km`
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (x: number) => (x * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

/** What's left before a staff profile is complete, in plain words. */
export function profileChecklist(p: {
  photo_path: string | null; address: string | null; cv_path: string | null; rtw_status: string; positions: string[]
}) {
  return [
    { key: 'photo', label: 'Profile photo', done: !!p.photo_path, to: '/join/photo' },
    { key: 'where', label: 'Where I can work', done: !!p.address, to: '/join/address' },
    { key: 'jobs', label: 'Jobs I can do', done: p.positions.length > 0, to: '/join/jobs' },
    { key: 'cv', label: 'My CV', done: !!p.cv_path, to: '/join/cv' },
    { key: 'rtw', label: 'ID & work permit', done: p.rtw_status !== 'not_submitted' && p.rtw_status !== 'rejected', to: '/join/documents' }
  ]
}
