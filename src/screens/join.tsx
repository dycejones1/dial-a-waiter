// Staff sign-up: register → photo → email or mobile → code → address → jobs → CV → ID → done.
// Steps after the code also open from the home checklist, and then return home when saved.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { homeFor, useSession } from '../lib/session'
import { isEmail, isValidSaId, normalizePhone, prettyPhone, profileChecklist } from '../lib/format'
import { DEMO_CODE } from '../lib/demoApi'
import type { Channel } from '../lib/types'
import { Icon, Logo, Progress } from '../components/ui'

const POSITIONS = ['Waiter / Waitress', 'Bartender', 'Barista', 'Host', 'Head Chef', 'Sous Chef', 'Kitchen hand', 'Cleaner', 'Dishwasher']

function useNext(next: string) {
  const { profile } = useSession()
  const nav = useNavigate()
  return () => nav(profile?.onboarded_at ? '/home' : next)
}

export function Welcome() {
  const { userId, profile, api, refresh } = useSession()
  const nav = useNavigate()
  if (userId && profile) return <Navigate to={homeFor(profile)} replace />
  return (
    <div className="wel">
      <div className="art"><Pattern /></div>
      <div className="body">
        <Logo size={64} />
        <h1>Service<br />with a smile.</h1>
        <p>Paid hospitality shifts near you, and reliable staff for venues that need them.</p>
        <Link className="btn pri" to="/join/register">I need work</Link>
        <Link className="btn light" to="/venue/start">I need staff</Link>
        <p className="center" style={{ margin: '6px 0 0' }}>Already a member? <Link to="/login" style={{ color: '#fff', fontWeight: 600 }}>Log in</Link></p>
        {api.demoSignInAsAdmin && (
          <button className="link" style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, alignSelf: 'center' }}
            onClick={async () => { await api.demoSignInAsAdmin!(); await refresh(); nav('/admin') }}>Dial A Waiter team login (demo)</button>
        )}
      </div>
    </div>
  )
}

function Pattern() {
  const c = []
  for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) {
    const x = k * 72 + (r % 2 ? 36 : 0), y = r * 72 + 30
    c.push(<g key={`${r}-${k}`}><circle cx={x} cy={y} r="20" /><circle cx={x} cy={y} r="11" /></g>)
  }
  return (
    <svg viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5">{c}</g>
      <circle cx="320" cy="90" r="120" fill="#ff5a4e" opacity=".18" />
    </svg>
  )
}

export function Register() {
  const { draft, setDraft } = useSession()
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const [agree, setAgree] = useState(false)

  useEffect(() => { if (draft.role !== 'staff') setDraft({ role: 'staff' }) }, [draft.role, setDraft])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.firstName.trim()) return setErr('Add your first name.')
    if (!normalizePhone(draft.phone)) return setErr('Check your mobile number, e.g. 083 302 8969.')
    if (draft.email && !isEmail(draft.email)) return setErr('That email doesn’t look right. Check for a missing @ or dot, or leave it empty.')
    if (!agree) return setErr('Tick the box to agree to the terms before you continue.')
    setErr(''); nav('/join/photo')
  }
  const f = (k: 'firstName' | 'lastName' | 'gender' | 'dateOfBirth' | 'email' | 'phone') =>
    ({ id: k, value: draft[k], onChange: (e: { target: { value: string } }) => setDraft({ [k]: e.target.value }) })

  return (
    <form className="screen" onSubmit={submit} noValidate>
      <Progress step={1} />
      <div className="scroll">
        <h1 className="t-disp">Create your account</h1>
        <p className="t-sub">It takes about 3 minutes. You can finish your profile later.</p>
        <div className="stack">
          <div className="grid2">
            <div className="field"><label htmlFor="firstName">First name</label><input {...f('firstName')} autoComplete="given-name" /></div>
            <div className="field"><label htmlFor="lastName">Last name</label><input {...f('lastName')} autoComplete="family-name" /></div>
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="gender">Gender</label>
              <select {...f('gender')}><option value="">Choose…</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div>
            <div className="field"><label htmlFor="dateOfBirth">Date of birth</label><input type="date" {...f('dateOfBirth')} autoComplete="bday" /></div>
          </div>
          <div className="field"><label htmlFor="phone">Mobile number</label><input type="tel" inputMode="tel" placeholder="083 302 8969" {...f('phone')} autoComplete="tel" /></div>
          <div className="field"><label htmlFor="email">Email <span style={{ fontWeight: 400, color: 'var(--mute)' }}>(optional)</span></label><input type="email" {...f('email')} autoComplete="email" /></div>
          <label className="chk"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>I agree to the <Link to="/terms">Terms and Privacy Policy</Link></span></label>
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock"><button className="btn pri" type="submit">Continue</button></div>
    </form>
  )
}

export function Photo() {
  const { draft, setDraft, userId, api, setProfile, profile } = useSession()
  const nav = useNavigate()
  const next = useNext('/join/confirm')
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (draft.photo) { const u = URL.createObjectURL(draft.photo); setPreview(u); return () => URL.revokeObjectURL(u) }
  }, [draft.photo])

  async function go() {
    if (!userId) return nav('/join/confirm')
    if (!draft.photo) return next()
    try {
      setBusy(true)
      const path = await api.upload('photo', draft.photo)
      setProfile(await api.updateProfile({ photo_path: path }))
      next()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const name = profile?.first_name || draft.firstName || 'there'
  return (
    <div className="screen">
      <Progress step={2} />
      <div className="scroll center">
        <h1 className="t-disp">Hi {name}, let’s get you ready for work.</h1>
        <p className="t-sub">Show us your best self. Venues are much more likely to book someone with a photo.</p>
        <label className="photo" style={preview ? { backgroundImage: `url(${preview})` } : undefined}>
          {!preview && name[0]?.toUpperCase()}
          <span className="cam"><Icon name="cam" size={20} /></span>
          <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={e => setDraft({ photo: e.target.files?.[0] ?? null })} />
        </label>
        <div className="tips" style={{ textAlign: 'left' }}>
          {['Face the camera and smile', 'Good light, plain background', 'Dress like you would for a shift'].map(t => <div key={t}><Icon name="check" size={18} stroke={2.6} />{t}</div>)}
        </div>
        <p className="err" role="alert">{err}</p>
      </div>
      <div className="dock">
        {draft.photo
          ? <button className="btn pri" onClick={go} disabled={busy}>{busy ? 'Saving…' : 'Use this photo'}</button>
          : <button className="btn pri" onClick={() => input.current?.click()}>Add a photo</button>}
        <button className="btn sec" onClick={() => (userId ? next() : nav('/join/confirm'))}>Skip for now</button>
      </div>
    </div>
  )
}

export function ConfirmChoice() {
  const { draft, api, setConfirm } = useSession()
  const nav = useNavigate()
  const phone = normalizePhone(draft.phone)
  const [channel, setChannel] = useState<Channel>('sms')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const employer = draft.role === 'employer'
  if (!draft.firstName || !phone) return <Navigate to={employer ? '/venue/join' : '/join/register'} replace />

  async function send() {
    const to = channel === 'sms' ? phone! : draft.email.trim()
    try {
      setBusy(true); setErr('')
      await api.sendCode(channel, to, { first_name: draft.firstName.trim(), last_name: draft.lastName.trim() || undefined, role: draft.role, phone: phone ?? undefined, gender: draft.gender || undefined, date_of_birth: draft.dateOfBirth || undefined })
      setConfirm({ channel, to, purpose: 'join' })
      nav('/join/code')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const opts: [Channel, string, string, string, boolean][] = [
    ['sms', 'phone', 'Mobile (SMS)', `We’ll text a 6-digit code to ${prettyPhone(phone)}`, true],
    ['email', 'mail', 'Email', draft.email ? `We’ll email a 6-digit code to ${draft.email}` : 'Add an email on the first step to use this', !!draft.email && isEmail(draft.email)]
  ]
  return (
    <div className="screen">
      {employer ? <Progress step={2} total={4} /> : <Progress step={3} />}
      <div className="scroll">
        <h1 className="t-disp">How should we confirm it’s you?</h1>
        <p className="t-sub">We’ll send a quick code so we know your details are right.</p>
        <div className="stack" role="radiogroup" aria-label="Confirm by">
          {opts.map(([k, ic, t, d, ok]) => (
            <button key={k} className="choice" role="radio" aria-checked={channel === k} disabled={!ok} style={ok ? undefined : { opacity: 0.55 }} onClick={() => setChannel(k)}>
              <span className="ic"><Icon name={ic} /></span><span className="tx"><b>{t}</b><small>{d}</small></span><span className="radio" />
            </button>
          ))}
        </div>
        <p className="err" role="alert">{err}</p>
      </div>
      <div className="dock"><button className="btn pri" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send my code'}</button></div>
    </div>
  )
}

export function Code() {
  const { api, confirm, draft, setProfile, refresh, userId } = useSession()
  const nav = useNavigate()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [wait, setWait] = useState(30)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => { if (wait > 0) { const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t) } }, [wait])
  const done = useRef(false)
  // Email can also arrive as a sign-in link. If it's tapped in another tab, this tab is signed in too, so carry on from here.
  useEffect(() => { if (userId && confirm && !done.current) { setBusy(true); finish().catch(e => setErr((e as Error).message)).finally(() => setBusy(false)) } }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!confirm) return <Navigate to="/" replace />

  const join = confirm.purpose === 'join'
  async function verify(code = digits.join('')) {
    if (code.length < 6) return setErr('Enter all 6 digits.')
    try {
      setBusy(true); setErr('')
      await api.verifyCode(confirm!.channel, confirm!.to, code)
      await finish()
    } catch (e) { setErr((e as Error).message); setDigits(['', '', '', '', '', '']); refs.current[0]?.focus() } finally { setBusy(false) }
  }
  async function finish() {
    if (done.current) return
    done.current = true
    try {
      if (join) {
        const phone = normalizePhone(draft.phone)
        let p = await api.updateProfile({
          gender: draft.gender || null, date_of_birth: draft.dateOfBirth || null,
          email: draft.email.trim() || null, phone, confirmed_by: confirm!.channel
        })
        if (draft.photo) {
          try { p = await api.updateProfile({ photo_path: await api.upload('photo', draft.photo) }) } catch { /* photo can be added later */ }
        }
        setProfile(p); nav(draft.role === 'employer' ? '/venue/setup' : '/join/address', { replace: true })
      } else {
        const p = await api.getProfile(); await refresh(); nav(homeFor(p), { replace: true })
      }
    } catch (e) { done.current = false; throw e }
  }
  function onType(i: number, v: string) {
    const d = v.replace(/\D/g, '')
    if (d.length > 1) { // pasted or autofilled
      const all = d.slice(0, 6).split(''); const next = [...digits]; all.forEach((c, j) => { if (i + j < 6) next[i + j] = c })
      setDigits(next); refs.current[Math.min(i + all.length, 5)]?.focus()
      if (next.every(Boolean)) verify(next.join(''))
      return
    }
    const next = [...digits]; next[i] = d; setDigits(next)
    if (d && i < 5) refs.current[i + 1]?.focus()
    if (d && next.every(Boolean)) verify(next.join(''))
  }
  async function resend() {
    try { await api.sendCode(confirm!.channel, confirm!.to, join ? { first_name: draft.firstName, last_name: draft.lastName || undefined, role: draft.role, phone: normalizePhone(draft.phone) ?? undefined, gender: draft.gender || undefined, date_of_birth: draft.dateOfBirth || undefined } : undefined); setWait(30); setErr('') }
    catch (e) { setErr((e as Error).message) }
  }
  return (
    <div className="screen">
      {join ? (draft.role === 'employer' ? <Progress step={3} total={4} /> : <Progress step={4} />) : <div style={{ height: 62 }} />}
      <div className="scroll">
        <h1 className="t-disp">Enter the code we sent you</h1>
        <p className="t-sub">We sent a 6-digit code to <b style={{ color: 'var(--ink)' }}>{prettyPhone(confirm.to)}</b>.</p>
        {api.mode === 'demo' && <p className="pill acc" style={{ margin: '0 0 8px' }}>Demo mode: the code is {DEMO_CODE}</p>}
        <div className="otp">
          {digits.map((d, i) => (
            <input key={i} ref={el => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${i + 1}`} maxLength={i === 0 ? 6 : 1} onChange={e => onType(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus() }} />
          ))}
        </div>
        {confirm.channel === 'email' && api.mode === 'live' && (
          <p className="t-sub" style={{ fontSize: 14 }}>If the email has a <b style={{ color: 'var(--ink)' }}>Sign in</b> link instead of a code, tap it on this phone. You’ll carry on automatically.</p>
        )}
        <p className="err center" role="alert">{err}</p>
        <p className="t-sub center" style={{ fontSize: 14 }}>
          Didn’t get it? {wait > 0 ? <span>You can send a new code in {wait}s</span> : <button className="link" onClick={resend}>Send a new code</button>}
        </p>
      </div>
      <div className="dock"><button className="btn pri" onClick={() => verify()} disabled={busy}>{busy ? 'Checking…' : 'Verify'}</button></div>
    </div>
  )
}

export function Address() {
  const { api, profile, setProfile } = useSession()
  const next = useNext('/join/jobs')
  const [address, setAddress] = useState(profile?.address ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null)
  const [travel, setTravel] = useState(profile?.travel_km ?? 10)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function locate() {
    if (!('geolocation' in navigator)) return setErr('Your phone didn’t share a location. Type your address instead.')
    setErr('')
    navigator.geolocation.getCurrentPosition(
      p => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); if (!address) setAddress('My current location') },
      () => setErr('We couldn’t get your location. Check location is allowed for this site, or type your address.'),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }
  async function save() {
    if (!address.trim() && !coords) return setErr('Use your location or type your address.')
    try {
      setBusy(true)
      setProfile(await api.updateProfile({ address: address.trim() || null, lat: coords?.lat ?? null, lng: coords?.lng ?? null, travel_km: travel }))
      next()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Progress step={5} />
      <div className="scroll">
        <h1 className="t-disp">Where are you based?</h1>
        <p className="t-sub">We use this to show you shifts close to home.</p>
        <div className="stack">
          <button className="btn sec" onClick={locate}><Icon name="locate" size={20} />{coords ? 'Location saved. Tap to update' : 'Use my current location'}</button>
          <div className="field"><label htmlFor="addr">Street address or suburb</label><input id="addr" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 15 Alfred Street, Observatory" autoComplete="street-address" /></div>
          <div className="field"><label>How far will you travel?</label>
            <div className="chips">{[5, 10, 25].map(k => <button key={k} className="chip" aria-pressed={travel === k} onClick={() => setTravel(k)}>{k} km</button>)}</div></div>
          {!coords && <p className="hint">Without your location we’ll show all shifts, not just the nearest ones.</p>}
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock"><button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button></div>
    </div>
  )
}

export function Jobs() {
  const { api, profile, setProfile } = useSession()
  const next = useNext('/join/cv')
  const [picked, setPicked] = useState<string[]>(profile?.positions ?? [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toggle = (p: string) => setPicked(s => (s.includes(p) ? s.filter(x => x !== p) : [...s, p]))
  async function save() {
    try { setBusy(true); setProfile(await api.updateProfile({ positions: picked })); next() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Progress step={6} />
      <div className="scroll">
        <h1 className="t-disp">Which jobs can you do?</h1>
        <p className="t-sub">Pick all that apply. We’ll show you these shifts first.</p>
        <div className="chips">{POSITIONS.map(p => (
          <button key={p} className="chip" aria-pressed={picked.includes(p)} onClick={() => toggle(p)}>{picked.includes(p) && <Icon name="check" size={14} stroke={3} />}{p}</button>
        ))}</div>
        <p className="err" role="alert">{err}</p>
      </div>
      <div className="dock">
        <button className="btn pri" onClick={save} disabled={busy || picked.length === 0}>{busy ? 'Saving…' : 'Continue'}</button>
        <button className="btn sec" onClick={next}>Skip for now</button>
      </div>
    </div>
  )
}

export function Cv() {
  const { api, profile, setProfile } = useSession()
  const next = useNext('/join/documents')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!file) return next()
    try { setBusy(true); setProfile(await api.updateProfile({ cv_path: await api.upload('cv', file) })); next() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Progress step={7} />
      <div className="scroll">
        <h1 className="t-disp">Add your CV</h1>
        <p className="t-sub">You’re more likely to be hired with an up-to-date CV. A PDF, a Word file or a photo of a printed CV all work.</p>
        <label className="drop">
          <span className="bubble"><Icon name="upload" size={24} /></span>
          <b>{file ? file.name : profile?.cv_path ? 'CV uploaded. Tap to replace' : 'Upload your CV'}</b>Up to 10 MB
          <input type="file" accept=".pdf,.doc,.docx,image/*" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <p className="err" role="alert">{err}</p>
      </div>
      <div className="dock">
        <button className="btn pri" onClick={save} disabled={busy || !file}>{busy ? 'Uploading…' : 'Continue'}</button>
        <button className="btn sec" onClick={next}>Skip for now</button>
      </div>
    </div>
  )
}

export function Documents() {
  const { api, setProfile } = useSession()
  const next = useNext('/join/done')
  const [nationality, setNationality] = useState('South African')
  const [idNumber, setIdNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    const id = idNumber.replace(/\s/g, '')
    if (!id && !file) return setErr('Add your ID or passport number, or a photo of the document.')
    if (nationality === 'South African' && id && !isValidSaId(id)) return setErr('That ID number doesn’t look right. Check all 13 digits.')
    try {
      setBusy(true); setErr('')
      const idDocPath = file ? await api.upload('id', file) : undefined
      await api.savePrivate({ nationality, idNumber: id, idDocPath })
      const p = await api.getProfile(); if (p) setProfile(p)
      next()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <Progress step={8} />
      <div className="scroll">
        <h1 className="t-disp">Show you can work in South Africa</h1>
        <div className="banner" style={{ marginBottom: 18 }}><Icon name="shield" size={20} /><span>You can’t be booked until we’ve checked these. Only our team can see them, never venues.</span></div>
        <div className="stack">
          <div className="field"><label htmlFor="nat">Nationality</label>
            <select id="nat" value={nationality} onChange={e => setNationality(e.target.value)}>
              {['South African', 'Zimbabwean', 'Malawian', 'Mozambican', 'Lesotho', 'Other'].map(n => <option key={n}>{n}</option>)}</select></div>
          <div className="field"><label htmlFor="idn">{nationality === 'South African' ? 'ID number' : 'Passport or permit number'}</label>
            <input id="idn" inputMode={nationality === 'South African' ? 'numeric' : 'text'} value={idNumber} onChange={e => setIdNumber(e.target.value)} autoComplete="off" /></div>
          <label className="drop" style={{ padding: 18 }}>
            <span className="bubble"><Icon name="id" size={24} /></span>
            <b>{file ? file.name : 'Photo of your ID or work permit'}</b>
            <input type="file" accept="image/*,.pdf" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock">
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Submitting…' : 'Submit for checking'}</button>
        <button className="btn sec" onClick={next}>Skip for now</button>
      </div>
    </div>
  )
}

export function Done() {
  const { api, profile, setProfile } = useSession()
  const nav = useNavigate()
  useEffect(() => {
    if (profile && !profile.onboarded_at) api.updateProfile({ onboarded_at: new Date().toISOString() }).then(setProfile).catch(() => {})
  }, [api, profile, setProfile])
  if (!profile) return <Navigate to="/" replace />
  const items = profileChecklist(profile)
  return (
    <div className="screen">
      <div className="scroll center" style={{ paddingTop: 40 }}>
        <div className="success"><Icon name="check" size={52} stroke={2.6} /></div>
        <h1 className="t-disp" style={{ fontSize: 34, marginTop: 20 }}>You’re in, {profile.first_name}!</h1>
        <p className="t-sub">Finish anything left below so venues can start booking you.</p>
        <div className="surf" style={{ textAlign: 'left' }}>
          {items.map(i => (
            <div key={i.key} className="lrow"><span className="tx"><b>{i.label}</b></span><span className={`pill ${i.done ? 'ok' : 'acc'}`}>{i.key === 'rtw' && profile.rtw_status === 'pending' ? 'Being checked' : i.done ? 'Done' : 'To do'}</span></div>
          ))}
        </div>
      </div>
      <div className="dock"><button className="btn pri" onClick={() => nav('/home', { replace: true })}>Go to my home screen</button></div>
    </div>
  )
}

export function Login() {
  const { api, setConfirm } = useSession()
  const nav = useNavigate()
  const [channel, setChannel] = useState<Channel>('sms')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function send(e: FormEvent) {
    e.preventDefault()
    const to = channel === 'sms' ? normalizePhone(value) : value.trim()
    if (channel === 'sms' && !to) return setErr('Check your mobile number, e.g. 083 302 8969.')
    if (channel === 'email' && !isEmail(value)) return setErr('That email doesn’t look right.')
    try { setBusy(true); setErr(''); await api.sendCode(channel, to!); setConfirm({ channel, to: to!, purpose: 'login' }); nav('/login/code') }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <form className="screen" onSubmit={send} noValidate>
      <div className="hd"><button type="button" className="ib ghost" onClick={() => nav('/')} aria-label="Back"><Icon name="back" /></button><span style={{ flex: 1 }} /></div>
      <div className="scroll">
        <h1 className="t-disp">Welcome back.</h1>
        <p className="t-sub">We’ll send you a code to log in. No password needed.</p>
        <div className="chips" style={{ marginBottom: 16 }}>
          <button type="button" className="chip" aria-pressed={channel === 'sms'} onClick={() => setChannel('sms')}>Mobile</button>
          <button type="button" className="chip" aria-pressed={channel === 'email'} onClick={() => setChannel('email')}>Email</button>
        </div>
        <div className="field"><label htmlFor="who">{channel === 'sms' ? 'Mobile number' : 'Email'}</label>
          <input id="who" type={channel === 'sms' ? 'tel' : 'email'} value={value} onChange={e => setValue(e.target.value)} placeholder={channel === 'sms' ? '083 302 8969' : 'you@example.com'} autoComplete={channel === 'sms' ? 'tel' : 'email'} /></div>
        <p className="err" role="alert">{err}</p>
      </div>
      <div className="dock"><button className="btn pri" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send my code'}</button></div>
    </form>
  )
}
