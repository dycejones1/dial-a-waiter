// Employer ("I need staff") screens: sign-up, venue setup, dashboard, post a shift, applicants.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../lib/session'
import { isEmail, normalizePhone, rands, shiftDay, shiftTime } from '../lib/format'
import type { Applicant, Venue, VenueShift } from '../lib/types'
import { Header, Icon, Progress, Spinner, TabBar, VenueArt } from '../components/ui'

const ROLES = ['Waiter', 'Waitress', 'Bartender', 'Barista', 'Host', 'Head Chef', 'Sous Chef', 'Kitchen hand', 'Cleaner', 'Dishwasher']
const BRING = ['Black shirt', 'White shirt', 'Closed shoes', 'Wine key', 'Chef whites', 'ID']

export function useVenue() {
  const { api, userId } = useSession()
  const [venue, setVenue] = useState<Venue | null | undefined>(undefined)
  const reload = useCallback(() => { api.getMyVenue().then(setVenue).catch(() => setVenue(null)) }, [api])
  useEffect(() => { if (userId) reload() }, [userId, reload])
  return { venue, reload }
}

export function StartChoice() {
  const { draft, setDraft } = useSession()
  const nav = useNavigate()
  const opts: ['business' | 'private', string, string, string][] = [
    ['business', 'brief', 'A business', 'Restaurant, bar, hotel, caterer or events company'],
    ['private', 'home', 'A private event', 'A party, dinner or function at home']
  ]
  return (
    <div className="screen">
      <Progress step={1} total={4} />
      <div className="scroll">
        <h1 className="t-disp">Who are you hiring for?</h1>
        <p className="t-sub">We’ll set up the right kind of account.</p>
        <div className="stack" role="radiogroup" aria-label="Hiring for">
          {opts.map(([k, ic, t, d]) => (
            <button key={k} className="choice" role="radio" aria-checked={draft.orgKind === k} onClick={() => setDraft({ orgKind: k })}>
              <span className="ic"><Icon name={ic} /></span><span className="tx"><b>{t}</b><small>{d}</small></span><span className="radio" />
            </button>
          ))}
        </div>
      </div>
      <div className="dock"><button className="btn pri" onClick={() => { setDraft({ role: 'employer' }); nav('/venue/join') }}>Continue</button></div>
    </div>
  )
}

export function EmployerRegister() {
  const { draft, setDraft } = useSession()
  const nav = useNavigate()
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState('')
  const business = draft.orgKind === 'business'
  useEffect(() => { if (draft.role !== 'employer') setDraft({ role: 'employer' }) }, [draft.role, setDraft])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (business && !draft.orgName.trim()) return setErr('Add the name of your business.')
    if (!draft.firstName.trim()) return setErr('Add your first name.')
    if (!normalizePhone(draft.phone)) return setErr('Check your mobile number, e.g. 083 302 8969.')
    if (draft.email && !isEmail(draft.email)) return setErr('That email doesn’t look right. Check for a missing @ or dot.')
    if (!agree) return setErr('Tick the box to agree to the terms before you continue.')
    setErr(''); nav('/join/confirm')
  }
  const f = (k: 'orgName' | 'firstName' | 'lastName' | 'email' | 'phone') =>
    ({ id: k, value: draft[k], onChange: (e: { target: { value: string } }) => setDraft({ [k]: e.target.value }) })
  return (
    <form className="screen" onSubmit={submit} noValidate>
      <Progress step={1} total={4} />
      <div className="scroll">
        <h1 className="t-disp">Create your employer account</h1>
        <p className="t-sub">Every venue is checked by our team before staff can be booked. It keeps everyone safe.</p>
        <div className="stack">
          {business && <div className="field"><label htmlFor="orgName">Business name</label><input {...f('orgName')} autoComplete="organization" /></div>}
          <div className="grid2">
            <div className="field"><label htmlFor="firstName">First name</label><input {...f('firstName')} autoComplete="given-name" /></div>
            <div className="field"><label htmlFor="lastName">Last name</label><input {...f('lastName')} autoComplete="family-name" /></div>
          </div>
          <div className="field"><label htmlFor="phone">Mobile number</label><input type="tel" inputMode="tel" placeholder="083 302 8969" {...f('phone')} autoComplete="tel" /></div>
          <div className="field"><label htmlFor="email">{business ? 'Work email' : 'Email'} <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(optional)</span></label><input type="email" {...f('email')} autoComplete="email" /></div>
          <label className="chk"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>I agree to the <Link to="/terms">Terms and Privacy Policy</Link></span></label>
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock"><button className="btn pri" type="submit">Continue</button></div>
    </form>
  )
}

export function VenueSetup() {
  const { api, draft, profile } = useSession()
  const { venue } = useVenue()
  const nav = useNavigate()
  const isPrivate = draft.orgKind === 'private'
  const [name, setName] = useState(draft.orgName || (isPrivate && profile ? `${profile.first_name}’s event` : ''))
  const [area, setArea] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (venue) return <Navigate to="/venue" replace />
  if (venue === undefined) return <Spinner />

  function locate() {
    if (!('geolocation' in navigator)) return setErr('Your device didn’t share a location. Type the area instead.')
    navigator.geolocation.getCurrentPosition(p => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setErr('') },
      () => setErr('We couldn’t get your location. Check location is allowed for this site, or type the area.'), { timeout: 10000 })
  }
  async function save() {
    if (!name.trim()) return setErr(isPrivate ? 'Give your event a name.' : 'Add your venue’s name.')
    if (!area.trim()) return setErr('Add the suburb, so staff know where the work is.')
    try {
      setBusy(true); setErr('')
      await api.createVenue({ kind: draft.orgKind, name: name.trim(), area: area.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null })
      nav('/venue/welcome', { replace: true })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Progress step={4} total={4} />
      <div className="scroll">
        <h1 className="t-disp">{isPrivate ? 'Tell us about your event' : 'Where’s the venue?'}</h1>
        <p className="t-sub">Staff see the name and suburb on every shift you post. Your exact location helps show it to people nearby.</p>
        <div className="stack">
          <div className="field"><label htmlFor="vname">{isPrivate ? 'Event name' : 'Venue name'}</label><input id="vname" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="varea">Suburb</label><input id="varea" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Woodstock" autoComplete="address-level2" /></div>
          <button className="btn sec" onClick={locate}><Icon name="locate" size={20} />{coords ? 'Location saved. Tap to update' : 'I’m at the venue: use my location'}</button>
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock"><button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create my account'}</button></div>
    </div>
  )
}

export function VenueWelcome() {
  const nav = useNavigate()
  return (
    <div className="screen">
      <div className="scroll center" style={{ paddingTop: 48 }}>
        <div className="success" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><Icon name="clock" size={48} stroke={1.8} /></div>
        <h1 className="t-disp" style={{ marginTop: 20 }}>Welcome to Dial A Waiter</h1>
        <p className="t-sub">Your employer account has been created and will be approved shortly.</p>
        <div className="surf" style={{ textAlign: 'left', padding: 16, color: 'var(--mute)' }}>
          <b style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>What happens next</b>
          Your dedicated account manager will contact you to approve your account and explain how things work. You can post shifts now. Staff will see them once you’re approved.
        </div>
      </div>
      <div className="dock"><button className="btn pri" onClick={() => nav('/venue', { replace: true })}>Go to my dashboard</button></div>
    </div>
  )
}

const SHIFT_STATUS: Record<VenueShift['status'], [string, string]> = { open: ['Open', 'ok'], filled: ['Filled', 'warn'], cancelled: ['Cancelled', 'acc'] }

function VenueShiftCard({ s }: { s: VenueShift }) {
  const [label, tone] = SHIFT_STATUS[s.status]
  const c = s.counts
  return (
    <Link className="jcard" to={`/venue/shifts/${s.id}`}>
      <span className="im"><VenueArt name={s.role + s.venueName} /></span>
      <span className="tx">
        <b>{s.role}</b>
        <small>{shiftDay(s.startsAt)} · {shiftTime(s.startsAt, s.endsAt)}</small>
        <span className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <span className={`pill ${tone}`}>{label}</span>
          {c.booked > 0 && <span className="pill ok">{c.booked} booked</span>}
          <span className={`pill ${c.waiting ? 'acc' : 'warn'}`}>{c.total === 0 ? 'No applicants yet' : `${c.total} applied${c.waiting ? ` · ${c.waiting} new` : ''}`}</span>
        </span>
      </span>
      <span className="amt">{rands(s.payCents)}</span>
    </Link>
  )
}

export function Dashboard() {
  const { api, profile } = useSession()
  const { venue } = useVenue()
  const [shifts, setShifts] = useState<VenueShift[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.myVenueShifts().then(setShifts).catch(e => setErr((e as Error).message)) }, [api])
  if (venue === undefined) return <Spinner />
  if (venue === null) return <Navigate to="/venue/setup" replace />
  const upcoming = (shifts ?? []).filter(s => new Date(s.endsAt) > new Date())
  const past = (shifts ?? []).filter(s => new Date(s.endsAt) <= new Date())
  return (
    <div className="screen">
      <div className="scroll" style={{ padding: 0 }}>
        <div className="hello"><div className="tx"><small>{venue.name}{venue.area ? ` · ${venue.area}` : ''}</small><h1>Hi {profile?.first_name}</h1></div>
          <Link to="/account" className="av" style={{ background: 'var(--brand)' }} aria-label="Account">{venue.name[0]?.toUpperCase()}</Link></div>
        <div style={{ padding: '0 22px 24px' }}>
          {!venue.approved && (
            <div className="banner"><Icon name="clock" size={20} /><span><b>Waiting for approval.</b> Your account manager will be in touch. Staff will see your shifts once you’re approved.</span></div>
          )}
          <Link className="btn pri" to="/venue/post" style={{ marginTop: 14 }}><Icon name="plus" size={20} stroke={2.4} />Post a shift</Link>
          <div className="sec"><h2>Upcoming shifts</h2></div>
          {err ? <p className="err">{err}</p> : !shifts ? <Spinner /> : upcoming.length === 0
            ? <div className="surf empty">No shifts yet. Post one and people nearby can apply.</div>
            : <div className="list">{upcoming.map(s => <VenueShiftCard key={s.id} s={s} />)}</div>}
          {past.length > 0 && <><div className="sec"><h2>Past shifts</h2></div><div className="list">{past.slice(-5).reverse().map(s => <VenueShiftCard key={s.id} s={s} />)}</div></>}
        </div>
      </div>
      <TabBar />
    </div>
  )
}

function todayISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }

export function PostShift() {
  const { api } = useSession()
  const nav = useNavigate()
  const [role, setRole] = useState('Waiter')
  const [date, setDate] = useState(todayISO())
  const [start, setStart] = useState('17:00')
  const [end, setEnd] = useState('22:00')
  const [pay, setPay] = useState('500')
  const [about, setAbout] = useState('')
  const [bring, setBring] = useState<string[]>(['Black shirt', 'Closed shoes'])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const startsAt = new Date(`${date}T${start}`)
  const endsAt = new Date(`${date}T${end}`)
  if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1) // shift runs past midnight
  const hours = Math.round(((endsAt.getTime() - startsAt.getTime()) / 36e5) * 10) / 10
  const rand = Math.round(Number(pay))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (isNaN(startsAt.getTime())) return setErr('Choose a date and start time.')
    if (startsAt <= new Date()) return setErr('The shift has to start in the future.')
    if (!rand || rand < 1) return setErr('Add what you’ll pay for the shift, in rands.')
    if (hours > 16) return setErr('Shifts can be up to 16 hours. Split longer work into two shifts.')
    try {
      setBusy(true); setErr('')
      await api.postShift({ role, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), payCents: rand * 100, description: about.trim(), bring })
      nav('/venue', { replace: true })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const toggle = (b: string) => setBring(x => (x.includes(b) ? x.filter(y => y !== b) : [...x, b]))
  return (
    <form className="screen" onSubmit={submit} noValidate>
      <Header title="Post a shift" />
      <div className="scroll">
        <div className="stack">
          <div className="field"><label>Who do you need?</label>
            <div className="chips">{ROLES.map(r => <button type="button" key={r} className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>)}</div></div>
          <div className="field"><label htmlFor="pd">Date</label><input type="date" id="pd" min={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="ps">Start</label><input type="time" id="ps" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div className="field"><label htmlFor="pe">End</label><input type="time" id="pe" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="pp">Pay for the whole shift (R)</label><input type="number" inputMode="numeric" id="pp" min={1} value={pay} onChange={e => setPay(e.target.value)} />
            {rand > 0 && hours > 0 && <span className="hint">{hours} hours · about R{Math.round(rand / hours)} an hour</span>}</div>
          <div className="field"><label htmlFor="pa">About the shift <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(optional)</span></label>
            <input id="pa" value={about} onChange={e => setAbout(e.target.value)} placeholder="e.g. Busy Saturday dinner, 80 covers" maxLength={300} /></div>
          <div className="field"><label>What should they bring?</label>
            <div className="chips">{BRING.map(b => <button type="button" key={b} className="chip" aria-pressed={bring.includes(b)} onClick={() => toggle(b)}>{bring.includes(b) && <Icon name="check" size={14} stroke={3} />}{b}</button>)}</div></div>
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock"><button className="btn pri" type="submit" disabled={busy}>{busy ? 'Posting…' : `Post shift · ${rand > 0 ? rands(rand * 100) : 'R0'}`}</button></div>
    </form>
  )
}

const APP_STATUS: Record<Applicant['status'], [string, string]> = {
  applied: ['New', 'acc'], shortlisted: ['Shortlisted', 'warn'], booked: ['Booked', 'ok'], declined: ['Declined', 'acc'], withdrawn: ['Withdrew', 'acc']
}
const RTW: Record<Applicant['staff']['rtwStatus'], [string, string]> = {
  verified: ['ID checked', 'ok'], pending: ['ID being checked', 'warn'], not_submitted: ['No ID yet', 'acc'], rejected: ['ID not accepted', 'acc']
}

function Person({ a }: { a: Applicant }) {
  const { api } = useSession()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { if (a.staff.photoPath) api.fileUrl('photo', a.staff.photoPath).then(setUrl).catch(() => {}) }, [api, a.staff.photoPath])
  return <span className="av" style={url ? { backgroundImage: `url(${url})` } : undefined}>{url ? '' : a.staff.firstName[0]?.toUpperCase()}</span>
}

export function ShiftApplicants() {
  const { id } = useParams()
  const { api } = useSession()
  const nav = useNavigate()
  const [shift, setShift] = useState<VenueShift | null | undefined>(undefined)
  const [apps, setApps] = useState<Applicant[] | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'book'; a: Applicant } | { kind: 'cancel' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    api.myVenueShifts().then(l => setShift(l.find(s => s.id === id) ?? null)).catch(() => setShift(null))
    api.shiftApplicants(id!).then(setApps).catch(e => setErr((e as Error).message))
  }, [api, id])
  useEffect(load, [load])
  if (shift === undefined) return <Spinner />
  if (shift === null) return <div className="screen"><Header title="Shift" /><div className="scroll empty">We couldn’t find that shift.</div></div>

  async function act(fn: () => Promise<void>) {
    try { setBusy(true); setErr(''); await fn(); setConfirm(null); load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const booked = (apps ?? []).filter(a => a.status === 'booked').length
  const open = shift.status === 'open'
  return (
    <div className="screen">
      <Header title={shift.role} />
      <div className="scroll">
        <div className="surf" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><b>{shiftDay(shift.startsAt)} · {shiftTime(shift.startsAt, shift.endsAt)}</b><b>{rands(shift.payCents)}</b></div>
          <div className="row" style={{ gap: 6, marginTop: 8 }}><span className={`pill ${SHIFT_STATUS[shift.status][1]}`}>{SHIFT_STATUS[shift.status][0]}</span>{booked > 0 && <span className="pill ok">{booked} booked</span>}</div>
        </div>
        <div className="sec"><h2>Applicants</h2></div>
        {!apps ? <Spinner /> : apps.length === 0
          ? <div className="surf empty">Nobody has applied yet. People nearby who are free that day will see this shift.</div>
          : <div className="list">{apps.map(a => {
              const [label, tone] = APP_STATUS[a.status]
              const [rtw, rtwTone] = RTW[a.staff.rtwStatus]
              return (
                <div key={a.id} className="surf" style={{ padding: 14 }}>
                  <div className="row"><Person a={a} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{a.staff.firstName} {a.staff.lastName}</b>
                      <div style={{ fontSize: 13, color: 'var(--mute)' }}>{a.staff.positions.join(' · ') || 'No positions listed'}</div>
                      <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}><span className={`pill ${tone}`}>{label}</span><span className={`pill ${rtwTone}`}>{rtw}</span></div>
                    </div>
                  </div>
                  {open && (a.status === 'applied' || a.status === 'shortlisted') && (
                    <div className="row" style={{ marginTop: 12, gap: 8 }}>
                      <button className="btn pri" style={{ minHeight: 42, fontSize: 15 }} disabled={busy} onClick={() => setConfirm({ kind: 'book', a })}>Book</button>
                      {a.status === 'applied' && <button className="btn sec" style={{ minHeight: 42, fontSize: 15 }} disabled={busy} onClick={() => act(() => api.setApplicationStatus(a.id, 'shortlisted'))}>Shortlist</button>}
                      <button className="btn sec" style={{ minHeight: 42, fontSize: 15 }} disabled={busy} onClick={() => act(() => api.setApplicationStatus(a.id, 'declined'))}>Decline</button>
                    </div>
                  )}
                </div>
              )
            })}</div>}
        {apps && apps.length > 0 && <p className="hint" style={{ marginTop: 10 }}>{api.mode === 'demo' ? 'Demo mode: these are example people.' : ''}</p>}
        <p className="err" role="alert">{err}</p>
        {shift.status !== 'cancelled' && (
          <div className="stack" style={{ marginTop: 18 }}>
            {open && booked > 0 && <button className="btn sec" disabled={busy} onClick={() => act(() => api.setShiftStatus(shift.id, 'filled'))}>Mark as filled (stop new applications)</button>}
            {shift.status === 'filled' && <button className="btn sec" disabled={busy} onClick={() => act(() => api.setShiftStatus(shift.id, 'open'))}>Reopen for applications</button>}
            <button className="link" style={{ color: 'var(--accent-text)', alignSelf: 'center' }} onClick={() => setConfirm({ kind: 'cancel' })}>Cancel this shift</button>
          </div>
        )}
      </div>
      {confirm && (
        <div className="sheet-scrim" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Confirm">
            {confirm.kind === 'book' ? <>
              <h2 style={{ font: '700 22px var(--display)', margin: '6px 0' }}>Book {confirm.a.staff.firstName}?</h2>
              <p className="t-sub">{shift.role} · {shiftDay(shift.startsAt)} · {shiftTime(shift.startsAt, shift.endsAt)} · {rands(shift.payCents)}. They’ll see it in their Applications straight away.</p>
              {confirm.a.staff.rtwStatus !== 'verified' && <div className="banner" style={{ marginBottom: 14 }}><Icon name="shield" size={20} /><span>Their ID hasn’t been checked yet.</span></div>}
              <div className="stack"><button className="btn pri" disabled={busy} onClick={() => act(() => api.setApplicationStatus(confirm.a.id, 'booked'))}>{busy ? 'Booking…' : 'Book'}</button><button className="btn sec" onClick={() => setConfirm(null)}>Not yet</button></div>
            </> : <>
              <h2 style={{ font: '700 22px var(--display)', margin: '6px 0' }}>Cancel this shift?</h2>
              <p className="t-sub">It disappears from the jobs list. {booked > 0 ? 'Please call anyone you’ve booked to let them know.' : ''}</p>
              <div className="stack"><button className="btn pri" disabled={busy} onClick={() => act(async () => { await api.setShiftStatus(shift.id, 'cancelled'); nav('/venue', { replace: true }) })}>Cancel shift</button><button className="btn sec" onClick={() => setConfirm(null)}>Keep it</button></div>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}
