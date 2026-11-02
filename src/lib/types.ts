export type Channel = 'sms' | 'email'
export type RtwStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected'
export type ApplicationStatus = 'applied' | 'shortlisted' | 'booked' | 'declined' | 'withdrawn'

export interface SignupDraft {
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  email: string
  phone: string
  photo?: File | null
  role: 'staff' | 'employer'
  orgKind: 'business' | 'private'
  orgName: string
}

export interface Profile {
  id: string
  role: 'staff' | 'employer' | 'admin'
  first_name: string
  last_name: string | null
  gender: string | null
  date_of_birth: string | null
  email: string | null
  phone: string | null
  confirmed_by: Channel | null
  photo_path: string | null
  address: string | null
  lat: number | null
  lng: number | null
  travel_km: number
  positions: string[]
  cv_path: string | null
  rtw_status: RtwStatus
  rtw_note?: string | null
  onboarded_at: string | null
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'role' | 'rtw_status' | 'rtw_note'>>

export interface Shift {
  id: string
  venueName: string
  role: string
  startsAt: string
  endsAt: string
  payCents: number
  area: string | null
  description: string | null
  bring: string[]
  km: number | null
}

export interface Application {
  id: string
  status: ApplicationStatus
  createdAt: string
  shift: Shift
}

export interface PrivateDetails {
  nationality: string
  idNumber: string
  idDocPath?: string | null
}

export type UploadKind = 'photo' | 'cv' | 'id'

export interface Venue {
  id: string
  kind: 'business' | 'private'
  name: string
  area: string | null
  lat: number | null
  lng: number | null
  approved: boolean
}

export type ShiftStatus = 'open' | 'filled' | 'cancelled'

export interface VenueShift extends Shift {
  status: ShiftStatus
  counts: { total: number; waiting: number; shortlisted: number; booked: number }
}

export interface NewShift {
  role: string
  startsAt: string
  endsAt: string
  payCents: number
  description: string
  bring: string[]
}

export interface Applicant {
  id: string
  status: ApplicationStatus
  createdAt: string
  staff: { id: string; firstName: string; lastName: string | null; photoPath: string | null; positions: string[]; rtwStatus: RtwStatus }
}

export interface AdminVenue {
  id: string
  kind: 'business' | 'private'
  name: string
  area: string | null
  approved: boolean
  createdAt: string
  owner: { firstName: string; lastName: string | null; phone: string | null; email: string | null }
}

export interface IdCheck {
  id: string
  firstName: string
  lastName: string | null
  phone: string | null
  photoPath: string | null
  cvPath: string | null
  rtwStatus: RtwStatus
  rtwNote: string | null
  submittedAt: string
  nationality: string | null
  idNumber: string | null
  idDocPath: string | null
}

export interface Api {
  readonly mode: 'demo' | 'live'
  currentUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  /** Sends a one-time code. Pass `signup` to create the account if it doesn't exist yet. */
  sendCode(channel: Channel, to: string, signup?: { first_name: string; last_name?: string; role?: 'staff' | 'employer' }): Promise<void>
  verifyCode(channel: Channel, to: string, code: string): Promise<string>
  signOut(): Promise<void>
  getProfile(): Promise<Profile | null>
  updateProfile(patch: ProfilePatch): Promise<Profile>
  upload(kind: UploadKind, file: File): Promise<string>
  fileUrl(kind: UploadKind, path: string): Promise<string | null>
  savePrivate(details: PrivateDetails): Promise<void>
  listShifts(near: { lat: number | null; lng: number | null; km: number }): Promise<Shift[]>
  getShift(id: string, from?: { lat: number | null; lng: number | null }): Promise<Shift | null>
  apply(shiftId: string): Promise<void>
  myApplications(): Promise<Application[]>
  // Employers
  getMyVenue(): Promise<Venue | null>
  createVenue(v: Omit<Venue, 'id' | 'approved'>): Promise<Venue>
  myVenueShifts(): Promise<VenueShift[]>
  postShift(s: NewShift): Promise<void>
  setShiftStatus(shiftId: string, status: ShiftStatus): Promise<void>
  shiftApplicants(shiftId: string): Promise<Applicant[]>
  setApplicationStatus(applicationId: string, status: 'shortlisted' | 'booked' | 'declined'): Promise<void>
  // Dial A Waiter team (admin)
  adminVenues(approved: boolean): Promise<AdminVenue[]>
  adminSetVenue(venueId: string, approved: boolean, note?: string): Promise<void>
  adminIdChecks(status: RtwStatus): Promise<IdCheck[]>
  adminIdCheck(profileId: string): Promise<IdCheck | null>
  adminSetRtw(profileId: string, status: 'verified' | 'rejected', note?: string): Promise<void>
  /** Demo mode only: sign in as a team member to try the admin screens. */
  demoSignInAsAdmin?(): Promise<void>
}
