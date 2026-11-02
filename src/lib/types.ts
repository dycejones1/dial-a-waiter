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
}

export interface Profile {
  id: string
  role: 'staff' | 'employer'
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
  onboarded_at: string | null
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'role' | 'rtw_status'>>

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
}
