import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AdminVenue, Api, Applicant, Application, IdCheck, Channel, PrivateDetails, Profile, ProfilePatch, Shift, UploadKind, Venue, VenueShift } from './types'
import { distanceKm } from './format'

const BUCKET: Record<UploadKind, string> = { photo: 'photos', cv: 'documents', id: 'documents' }

// Shape of a shift row joined with its venue
type ShiftRow = {
  id: string; role: string; starts_at: string; ends_at: string; pay_cents: number; area: string | null
  description: string | null; bring: string[] | null; lat: number | null; lng: number | null; venues: { name: string } | null
}

function fromRow(r: ShiftRow, from?: { lat: number | null; lng: number | null }): Shift {
  const km = from?.lat != null && from?.lng != null && r.lat != null && r.lng != null ? distanceKm(from.lat, from.lng, r.lat, r.lng) : null
  return {
    id: r.id, venueName: r.venues?.name ?? 'Venue', role: r.role, startsAt: r.starts_at, endsAt: r.ends_at,
    payCents: r.pay_cents, area: r.area, description: r.description, bring: r.bring ?? [], km
  }
}

function friendly(e: { message?: string } | null): Error {
  const m = e?.message ?? 'Something went wrong'
  if (/token has expired|invalid/i.test(m)) return new Error('That code is wrong or has expired. Check it, or send a new one.')
  if (/rate limit|too many/i.test(m)) return new Error('Too many tries. Wait a minute, then try again.')
  if (/signups not allowed|user not found/i.test(m)) return new Error('We couldn’t find an account with those details. Tap “Join now” to sign up.')
  return new Error(m)
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })

  async function uid(): Promise<string> {
    const { data } = await sb.auth.getUser()
    if (!data.user) throw new Error('Please log in again.')
    return data.user.id
  }

  return {
    mode: 'live',

    async currentUserId() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.id ?? null
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user.id ?? null))
      return () => data.subscription.unsubscribe()
    },

    async sendCode(channel: Channel, to: string, signup) {
      const options = { shouldCreateUser: !!signup, data: signup }
      const { error } = channel === 'sms'
        ? await sb.auth.signInWithOtp({ phone: to, options })
        : await sb.auth.signInWithOtp({ email: to, options })
      if (error) throw friendly(error)
    },

    async verifyCode(channel, to, code) {
      const { data, error } = channel === 'sms'
        ? await sb.auth.verifyOtp({ phone: to, token: code, type: 'sms' })
        : await sb.auth.verifyOtp({ email: to, token: code, type: 'email' })
      if (error || !data.user) throw friendly(error)
      return data.user.id
    },

    async signOut() { await sb.auth.signOut() },

    async getProfile() {
      const id = await this.currentUserId()
      if (!id) return null
      const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
      if (error) throw friendly(error)
      return data as Profile | null
    },

    async updateProfile(patch: ProfilePatch) {
      const id = await uid()
      const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select('*').single()
      if (error) throw friendly(error)
      return data as Profile
    },

    async upload(kind, file) {
      const id = await uid()
      if (file.size > 10 * 1024 * 1024) throw new Error('That file is bigger than 10 MB. Try a smaller one or a photo.')
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
      const path = `${id}/${kind}-${Date.now()}.${ext}`
      const { error } = await sb.storage.from(BUCKET[kind]).upload(path, file, { upsert: true, contentType: file.type || undefined })
      if (error) throw friendly(error)
      return path
    },

    async fileUrl(kind, path) {
      const { data } = await sb.storage.from(BUCKET[kind]).createSignedUrl(path, 3600)
      return data?.signedUrl ?? null
    },

    async savePrivate(d: PrivateDetails) {
      const id = await uid()
      const row: Record<string, unknown> = { id, nationality: d.nationality, id_number: d.idNumber || null }
      if (d.idDocPath !== undefined) row.id_doc_path = d.idDocPath
      const { error } = await sb.from('staff_private').upsert(row)
      if (error) throw friendly(error)
    },

    async listShifts({ lat, lng, km }) {
      const { data, error } = await sb.rpc('shifts_near', { p_lat: lat, p_lng: lng, p_km: km })
      if (error) throw friendly(error)
      return (data as any[]).map(r => ({
        id: r.shift_id, venueName: r.venue_name, role: r.shift_role, startsAt: r.starts_at, endsAt: r.ends_at,
        payCents: r.pay_cents, area: r.area, description: r.description, bring: [], km: r.km
      }))
    },

    async getShift(id, from) {
      const { data, error } = await sb.from('shifts')
        .select('id, role, starts_at, ends_at, pay_cents, area, description, bring, lat, lng, venues(name)')
        .eq('id', id).maybeSingle()
      if (error) throw friendly(error)
      return data ? fromRow(data as unknown as ShiftRow, from) : null
    },

    async apply(shiftId) {
      const id = await uid()
      const { error } = await sb.from('applications').insert({ shift_id: shiftId, staff_id: id })
      if (error) {
        if (/duplicate/i.test(error.message)) return
        throw friendly(error)
      }
    },

    async myApplications() {
      const id = await uid()
      const { data, error } = await sb.from('applications')
        .select('id, status, created_at, shift:shifts(id, role, starts_at, ends_at, pay_cents, area, description, bring, lat, lng, venues(name))')
        .eq('staff_id', id).order('created_at', { ascending: false })
      if (error) throw friendly(error)
      return (data as any[]).filter(r => r.shift).map((r): Application => ({
        id: r.id, status: r.status, createdAt: r.created_at, shift: fromRow(r.shift as ShiftRow)
      }))
    },

    // ---------- employers ----------
    async getMyVenue() {
      const id = await uid()
      const { data, error } = await sb.from('venues').select('id, kind, name, area, lat, lng, approved').eq('owner_id', id)
        .order('created_at').limit(1).maybeSingle()
      if (error) throw friendly(error)
      return data as Venue | null
    },

    async createVenue(v) {
      const id = await uid()
      const { data, error } = await sb.from('venues').insert({ ...v, owner_id: id }).select('id, kind, name, area, lat, lng, approved').single()
      if (error) throw friendly(error)
      return data as Venue
    },

    async myVenueShifts() {
      const venue = await this.getMyVenue()
      if (!venue) return []
      const { data, error } = await sb.from('shifts')
        .select('id, role, starts_at, ends_at, pay_cents, area, description, bring, lat, lng, status, venues(name), applications(status)')
        .eq('venue_id', venue.id).order('starts_at', { ascending: true })
      if (error) throw friendly(error)
      return (data as any[]).map((r): VenueShift => {
        const apps: { status: string }[] = r.applications ?? []
        const n = (s: string) => apps.filter(a => a.status === s).length
        return { ...fromRow(r as ShiftRow), status: r.status, counts: { total: apps.filter(a => a.status !== 'withdrawn').length, waiting: n('applied'), shortlisted: n('shortlisted'), booked: n('booked') } }
      })
    },

    async postShift(s) {
      const venue = await this.getMyVenue()
      if (!venue) throw new Error('Set up your venue first.')
      const { error } = await sb.from('shifts').insert({
        venue_id: venue.id, role: s.role, starts_at: s.startsAt, ends_at: s.endsAt, pay_cents: s.payCents,
        description: s.description || null, bring: s.bring, area: venue.area, lat: venue.lat, lng: venue.lng
      })
      if (error) throw friendly(error)
    },

    async setShiftStatus(shiftId, status) {
      const { error } = await sb.from('shifts').update({ status }).eq('id', shiftId)
      if (error) throw friendly(error)
    },

    async shiftApplicants(shiftId) {
      const { data, error } = await sb.from('applications')
        .select('id, status, created_at, staff:profiles(id, first_name, last_name, photo_path, positions, rtw_status)')
        .eq('shift_id', shiftId).neq('status', 'withdrawn').order('created_at')
      if (error) throw friendly(error)
      return (data as any[]).filter(r => r.staff).map((r): Applicant => ({
        id: r.id, status: r.status, createdAt: r.created_at,
        staff: { id: r.staff.id, firstName: r.staff.first_name, lastName: r.staff.last_name, photoPath: r.staff.photo_path, positions: r.staff.positions ?? [], rtwStatus: r.staff.rtw_status }
      }))
    },

    async setApplicationStatus(applicationId, status) {
      const { error } = await sb.from('applications').update({ status }).eq('id', applicationId)
      if (error) throw friendly(error)
    },

    // ---------- Dial A Waiter team ----------
    async adminVenues(approved) {
      const { data, error } = await sb.from('venues')
        .select('id, kind, name, area, approved, created_at, owner:profiles(first_name, last_name, phone, email)')
        .eq('approved', approved).order('created_at', { ascending: !approved }).limit(200)
      if (error) throw friendly(error)
      return (data as any[]).map((r): AdminVenue => ({
        id: r.id, kind: r.kind, name: r.name, area: r.area, approved: r.approved, createdAt: r.created_at,
        owner: { firstName: r.owner?.first_name ?? '', lastName: r.owner?.last_name ?? null, phone: r.owner?.phone ?? null, email: r.owner?.email ?? null }
      }))
    },

    async adminSetVenue(venueId, approved, note) {
      const { error } = await sb.rpc('admin_set_venue_approval', { p_venue: venueId, p_approved: approved, p_note: note || null })
      if (error) throw friendly(error)
    },

    async adminIdChecks(status) {
      const { data, error } = await sb.from('profiles')
        .select('id, first_name, last_name, phone, photo_path, cv_path, rtw_status, rtw_note, updated_at, staff_private(nationality, id_number, id_doc_path)')
        .eq('role', 'staff').eq('rtw_status', status).order('updated_at', { ascending: true }).limit(200)
      if (error) throw friendly(error)
      return (data as any[]).map(toIdCheck)
    },

    async adminIdCheck(profileId) {
      const { data, error } = await sb.from('profiles')
        .select('id, first_name, last_name, phone, photo_path, cv_path, rtw_status, rtw_note, updated_at, staff_private(nationality, id_number, id_doc_path)')
        .eq('id', profileId).maybeSingle()
      if (error) throw friendly(error)
      return data ? toIdCheck(data) : null
    },

    async adminSetRtw(profileId, status, note) {
      const { error } = await sb.rpc('admin_set_rtw', { p_profile: profileId, p_status: status, p_note: note || null })
      if (error) throw friendly(error)
    }
  }
}

function toIdCheck(r: any): IdCheck {
  const p = Array.isArray(r.staff_private) ? r.staff_private[0] : r.staff_private
  return {
    id: r.id, firstName: r.first_name, lastName: r.last_name, phone: r.phone, photoPath: r.photo_path, cvPath: r.cv_path,
    rtwStatus: r.rtw_status, rtwNote: r.rtw_note ?? null, submittedAt: r.updated_at,
    nationality: p?.nationality ?? null, idNumber: p?.id_number ?? null, idDocPath: p?.id_doc_path ?? null
  }
}
