// Logged-in staff screens: home, find jobs, shift detail, applications, account.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../lib/session'
import { km, prettyPhone, profileChecklist, rands, shiftDay, shiftHours, shiftTime } from '../lib/format'
import type { Application, Shift } from '../lib/types'
import { Header, Icon, Spinner, TabBar, VenueArt } from '../components/ui'

const STATUS: Record<Application['status'], [string, 'ok' | 'warn' | 'acc']> = {
  applied: ['Waiting for venue', 'warn'], shortlisted: ['Shortlisted', 'ok'], booked: ['Booked', 'ok'],
  declined: ['Not selected', 'acc'], withdrawn: ['Withdrawn', 'acc']
}

function useShifts(radius?: number) {
  const { api, profile } = useSession()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [err, setErr] = useState('')
  const r = radius ?? profile?.travel_km ?? 10
  useEffect(() => {
    let live = true
    setErr('')
    api.listShifts({ lat: profile?.lat ?? null, lng: profile?.lng ?? null, km: r })
      .then(s => live && setShifts(s)).catch(e => live && setErr((e as Error).message))
    return () => { live = false }
  }, [api, profile?.lat, profile?.lng, r])
  return { shifts, err }
}

function Avatar() {
  const { api, profile } = useSession()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { if (profile?.photo_path) api.fileUrl('photo', profile.photo_path).then(setUrl).catch(() => {}) }, [api, profile?.photo_path])
  return <Link to="/account" className="av" style={url ? { backgroundImage: `url(${url})` } : undefined} aria-label="Account">{url ? '' : profile?.first_name?.[0]?.toUpperCase()}</Link>
}

export function ShiftCard({ s, note }: { s: Shift; note?: React.ReactNode }) {
  return (
    <Link className="jcard" to={`/jobs/${s.id}`}>
      <span className="im"><VenueArt name={s.venueName} /></span>
      <span className="tx">
        <b>{s.role}</b>
        <small>{s.venueName}{s.km != null ? ` · ${km(s.km)}` : s.area ? ` · ${s.area}` : ''}</small>
        <small>{shiftDay(s.startsAt)} · {shiftTime(s.startsAt, s.endsAt)}</small>
        {note}
      </span>
      <span className="amt">{rands(s.payCents)}</span>
    </Link>
  )
}

export function Home() {
  const { profile } = useSession()
  const { shifts, err } = useShifts()
  const left = profile ? profileChecklist(profile).filter(i => !i.done) : []
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const pct = profile ? Math.round(100 * (5 - left.length) / 5) : 0
  return (
    <div className="screen">
      <div className="scroll" style={{ padding: 0 }}>
        <div className="hello"><div className="tx"><small>{greet}</small><h1>{profile?.first_name}</h1></div><Avatar /></div>
        <div style={{ padding: '0 22px 24px' }}>
          {left.length > 0 && (
            <Link className="comp" to={left[0].to}>
              <Ring pct={pct} />
              <span style={{ flex: 1 }}><b>Finish your work profile</b><small>Next: {left[0].label.toLowerCase()} · {left.length} left</small></span>
              <Icon name="chev" size={20} />
            </Link>
          )}
          {profile?.rtw_status === 'pending' && <div className="banner" style={{ marginTop: 12 }}><Icon name="clock" size={20} /><span>We’re checking your ID. This usually takes one working day.</span></div>}
          <div className="qa">
            <Link to="/jobs"><span className="q"><Icon name="search" size={20} /></span>Find jobs</Link>
            <Link to="/applications"><span className="q"><Icon name="brief" size={20} /></span>Applications</Link>
            <Link to="/account"><span className="q"><Icon name="user" size={20} /></span>My profile</Link>
          </div>
          <div className="sec"><h2>Shifts near you</h2><Link to="/jobs">See all</Link></div>
          {err ? <p className="err">{err}</p> : !shifts ? <Spinner /> : shifts.length === 0
            ? <div className="surf empty">No open shifts near you right now. We’ll show them here as venues post them.</div>
            : <div className="list">{shifts.slice(0, 4).map(s => <ShiftCard key={s.id} s={s} />)}</div>}
        </div>
      </div>
      <TabBar />
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 23, c = 2 * Math.PI * r
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" aria-label={`${pct}% complete`} style={{ flex: 'none' }}>
      <circle cx="27" cy="27" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="6" />
      <circle cx="27" cy="27" r={r} fill="none" stroke="#ff5a4e" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 27 27)" />
      <text x="27" y="31" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">{pct}%</text>
    </svg>
  )
}

export function Jobs() {
  const { profile } = useSession()
  const [radius, setRadius] = useState(profile?.travel_km ?? 10)
  const [shown, setShown] = useState(radius)
  const [role, setRole] = useState('All')
  const { shifts, err } = useShifts(radius)
  const roles = useMemo(() => ['All', ...Array.from(new Set((shifts ?? []).map(s => s.role)))], [shifts])
  const list = (shifts ?? []).filter(s => role === 'All' || s.role === role)
  const hasLocation = profile?.lat != null
  return (
    <div className="screen">
      <div className="scroll" style={{ paddingTop: 14 }}>
        <h1 className="page-title">Find jobs</h1>
        {hasLocation ? (
          <label className="radius"><span>Within</span>
            <input type="range" min={1} max={50} value={shown} onChange={e => setShown(+e.target.value)} onPointerUp={() => setRadius(shown)} onKeyUp={() => setRadius(shown)} onBlur={() => setRadius(shown)} aria-label="Distance in km" />
            <output>{shown} km</output></label>
        ) : (
          <Link className="banner" to="/join/address" style={{ margin: '10px 0' }}><Icon name="pin" size={20} /><span>Add your location to see the nearest shifts first.</span></Link>
        )}
        <div className="chips" style={{ margin: '10px 0 16px' }}>
          {roles.map(r => <button key={r} className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>{r}</button>)}
        </div>
        {err ? <p className="err">{err}</p> : !shifts ? <Spinner /> : list.length === 0
          ? <div className="surf empty">No shifts match. {hasLocation ? 'Try a bigger distance.' : ''}</div>
          : <div className="list">{list.map(s => <ShiftCard key={s.id} s={s} />)}</div>}
      </div>
      <TabBar />
    </div>
  )
}

export function ShiftDetail() {
  const { id } = useParams()
  const { api, profile } = useSession()
  const nav = useNavigate()
  const [s, setS] = useState<Shift | null | undefined>(undefined)
  const [applied, setApplied] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    api.getShift(id!, { lat: profile?.lat ?? null, lng: profile?.lng ?? null }).then(setS).catch(() => setS(null))
    api.myApplications().then(a => setApplied(a.some(x => x.shift.id === id && x.status !== 'withdrawn'))).catch(() => {})
  }, [api, id, profile?.lat, profile?.lng])
  if (s === undefined) return <Spinner />
  if (s === null) return <div className="screen"><Header title="Shift" /><div className="scroll empty">This shift is no longer available.</div></div>

  async function apply() {
    try { setBusy(true); setErr(''); await api.apply(s!.id); setApplied(true); setSheet(true) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="screen">
      <div className="scroll" style={{ padding: 0 }}>
        <div className="hero-im"><VenueArt name={s.venueName} /><button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon name="back" size={20} /></button></div>
        <div style={{ padding: '18px 22px 24px' }}>
          <span className="pill acc">{s.role}</span>
          <h1 className="t-disp" style={{ marginTop: 12 }}>{s.venueName}</h1>
          <p className="t-sub" style={{ margin: 0 }}>{s.area}{s.km != null ? ` · ${km(s.km)} from you` : ''}</p>
          <div className="facts"><div>Date<b>{shiftDay(s.startsAt)}</b></div><div>Time<b>{shiftTime(s.startsAt, s.endsAt)}</b></div><div>Length<b>{shiftHours(s.startsAt, s.endsAt)} hrs</b></div></div>
          <div className="paybig"><span style={{ fontSize: 13, color: 'var(--mute)' }}>You earn<br />for this shift</span><b>{rands(s.payCents)}</b></div>
          {s.description && <><div className="sec"><h2>About the shift</h2></div><p style={{ margin: 0, color: 'var(--mute)' }}>{s.description}</p></>}
          {s.bring.length > 0 && <><div className="sec"><h2>What to bring</h2></div><div className="chips">{s.bring.map(b => <span key={b} className="chip" style={{ cursor: 'default' }}>{b}</span>)}</div></>}
          {profile?.rtw_status === 'not_submitted' && <Link className="banner" to="/join/documents" style={{ marginTop: 18 }}><Icon name="shield" size={20} /><span>Venues can only book you once your ID is checked. Add it now.</span></Link>}
          <p className="err" role="alert">{err}</p>
        </div>
      </div>
      <div className="dock">
        {applied ? <button className="btn sec" disabled><Icon name="check" size={18} stroke={2.6} />Applied</button>
          : <button className="btn pri" onClick={apply} disabled={busy}>{busy ? 'Sending…' : `Apply for this shift · ${rands(s.payCents)}`}</button>}
      </div>
      {sheet && (
        <div className="sheet-scrim" onClick={() => setSheet(false)}>
          <div className="sheet center" onClick={e => e.stopPropagation()} role="dialog" aria-label="Application sent">
            <div className="success" style={{ width: 76, height: 76 }}><Icon name="check" size={40} stroke={2.6} /></div>
            <h2 style={{ font: '700 22px var(--display)', margin: '14px 0 6px' }}>Application sent</h2>
            <p className="t-sub">The venue usually replies within a few hours. Check Applications for updates.</p>
            <div className="stack"><button className="btn pri" onClick={() => nav('/applications')}>See my applications</button><button className="btn sec" onClick={() => setSheet(false)}>Keep browsing</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Applications() {
  const { api } = useSession()
  const [apps, setApps] = useState<Application[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.myApplications().then(setApps).catch(e => setErr((e as Error).message)) }, [api])
  return (
    <div className="screen">
      <div className="scroll" style={{ paddingTop: 14 }}>
        <h1 className="page-title">Applications</h1>
        <p className="t-sub">Shifts you’ve applied for and where each one stands.</p>
        {err ? <p className="err">{err}</p> : !apps ? <Spinner /> : apps.length === 0
          ? <div className="surf empty">No applications yet. <Link to="/jobs">Find a shift</Link></div>
          : <div className="list">{apps.map(a => {
              const [label, tone] = STATUS[a.status]
              return <ShiftCard key={a.id} s={a.shift} note={<span className={`pill ${tone}`} style={{ marginTop: 6 }}>{label}</span>} />
            })}</div>}
      </div>
      <TabBar />
    </div>
  )
}

export function Account() {
  const { api, profile } = useSession()
  const nav = useNavigate()
  if (!profile) return <Spinner />
  const items = profileChecklist(profile)
  const rtw = { not_submitted: ['To do', 'acc'], pending: ['Checking', 'warn'], verified: ['Verified', 'ok'], rejected: ['Please resubmit', 'acc'] }[profile.rtw_status]
  return (
    <div className="screen">
      <div className="scroll" style={{ paddingTop: 14 }}>
        <h1 className="page-title">Account</h1>
        <div className="row" style={{ margin: '12px 0 16px' }}>
          <Avatar /><div><b style={{ fontSize: 18 }}>{profile.first_name} {profile.last_name}</b><div style={{ fontSize: 14, color: 'var(--mute)' }}>{profile.phone ? prettyPhone(profile.phone) : profile.email}</div></div>
        </div>
        <div className="sec" style={{ marginTop: 8 }}><h2>My work profile</h2></div>
        <div className="surf">
          {items.map(i => (
            <Link key={i.key} className="lrow" to={i.to}>
              <span className="tx"><b>{i.label}</b></span>
              {i.key === 'rtw' ? <span className={`pill ${rtw[1]}`}>{rtw[0]}</span> : <span className={`pill ${i.done ? 'ok' : 'acc'}`}>{i.done ? 'Done' : 'To do'}</span>}
            </Link>
          ))}
        </div>
        <div className="surf" style={{ marginTop: 12 }}>
          <Link className="lrow" to="/terms"><span className="ic"><Icon name="file" size={20} /></span><span className="tx"><b>Terms & privacy</b><small>The rules and how we use your data</small></span><Icon name="chev" size={18} /></Link>
        </div>
        <button className="btn sec" style={{ margin: '14px 0' }} onClick={async () => { await api.signOut(); nav('/', { replace: true }) }}><Icon name="out" size={18} />Log out</button>
      </div>
      <TabBar />
    </div>
  )
}
