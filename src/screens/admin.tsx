// Dial A Waiter team screens: approve venues and check staff IDs. Every decision is logged in the database.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../lib/session'
import { isValidSaId, prettyPhone } from '../lib/format'
import type { AdminVenue, IdCheck } from '../lib/types'
import { Header, Icon, Spinner } from '../components/ui'

type Tab = 'venues' | 'ids' | 'approved'

function since(iso: string): string {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5)
  if (h < 1) return 'just now'
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24); return `${d} day${d === 1 ? '' : 's'} ago`
}

function Sheet({ title, body, needNote, confirmLabel, danger, onConfirm, onClose }: {
  title: string; body: string; needNote?: boolean; confirmLabel: string; danger?: boolean
  onConfirm: (note: string) => Promise<void>; onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (needNote && !note.trim()) return setErr('Add a short note. The person will see it.')
    try { setBusy(true); setErr(''); await onConfirm(note.trim()); onClose() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <h2 style={{ font: '700 22px var(--display)', margin: '6px 0' }}>{title}</h2>
        <p className="t-sub">{body}</p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="note">{needNote ? 'What should they fix?' : 'Note for the team (optional)'}</label>
          <input id="note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={needNote ? 'e.g. Photo is blurry, please retake it in good light' : 'e.g. Called the owner, all good'} />
        </div>
        <p className="err" role="alert">{err}</p>
        <div className="stack">
          <button className="btn pri" style={danger ? { background: 'var(--ink)', color: 'var(--bg)' } : undefined} onClick={go} disabled={busy}>{busy ? 'Saving…' : confirmLabel}</button>
          <button className="btn sec" onClick={onClose}>Back</button>
        </div>
      </div>
    </div>
  )
}

export function AdminHome() {
  const { api, profile } = useSession()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>(() => { try { return (sessionStorage.getItem('daw-admin-tab') as Tab) || 'venues' } catch { return 'venues' } })
  const [pending, setPending] = useState<AdminVenue[] | null>(null)
  const [approved, setApproved] = useState<AdminVenue[] | null>(null)
  const [ids, setIds] = useState<IdCheck[] | null>(null)
  const [sheet, setSheet] = useState<{ v: AdminVenue; approve: boolean } | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    setErr('')
    Promise.all([api.adminVenues(false), api.adminVenues(true), api.adminIdChecks('pending')])
      .then(([p, a, i]) => { setPending(p); setApproved(a); setIds(i) }).catch(e => setErr((e as Error).message))
  }, [api])
  useEffect(load, [load])
  useEffect(() => { try { sessionStorage.setItem('daw-admin-tab', tab) } catch { /* ignore */ } }, [tab])

  const venueCard = (v: AdminVenue) => (
    <div key={v.id} className="surf" style={{ padding: 16 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="ic"><Icon name={v.kind === 'private' ? 'home' : 'brief'} size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{v.name}</b>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>{v.kind === 'private' ? 'Private event' : 'Business'}{v.area ? ` · ${v.area}` : ''} · signed up {since(v.createdAt)}</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>{v.owner.firstName} {v.owner.lastName}</div>
          {v.owner.phone && <div style={{ fontSize: 14, userSelect: 'all' }}>{prettyPhone(v.owner.phone)}</div>}
          {v.owner.email && <div style={{ fontSize: 14, color: 'var(--mute)', userSelect: 'all', wordBreak: 'break-all' }}>{v.owner.email}</div>}
        </div>
      </div>
      {v.approved
        ? <button className="link" style={{ marginTop: 12, color: 'var(--accent-text)', fontSize: 14 }} onClick={() => setSheet({ v, approve: false })}>Remove approval</button>
        : <button className="btn pri" style={{ marginTop: 12, minHeight: 44 }} onClick={() => setSheet({ v, approve: true })}><Icon name="check" size={18} stroke={2.6} />Approve venue</button>}
    </div>
  )
  const tabs: [Tab, string, number | undefined][] = [['venues', 'Venues to approve', pending?.length], ['ids', 'ID checks', ids?.length], ['approved', 'Approved', undefined]]
  return (
    <div className="screen">
      <div className="hd" style={{ padding: '14px 22px 6px' }}>
        <div style={{ flex: 1 }}><small style={{ color: 'var(--mute)' }}>Dial A Waiter team</small><h1 className="page-title" style={{ margin: 0, textAlign: 'left' }}>Hi {profile?.first_name}</h1></div>
        <button className="ib" aria-label="Log out" onClick={async () => { await api.signOut(); nav('/', { replace: true }) }}><Icon name="out" size={20} /></button>
      </div>
      <div className="scroll">
        <div className="chips" role="tablist" style={{ margin: '10px 0 16px' }}>
          {tabs.map(([k, l, n]) => <button key={k} role="tab" className="chip" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n ? ` · ${n}` : ''}</button>)}
        </div>
        {err && <p className="err">{err}</p>}
        {tab === 'venues' && (!pending ? <Spinner /> : pending.length === 0
          ? <div className="surf empty">No venues waiting. You’re all caught up.</div>
          : <><p className="hint" style={{ marginBottom: 10 }}>Call each owner before approving. Once approved, staff can see and apply for their shifts.</p><div className="list">{pending.map(venueCard)}</div></>)}
        {tab === 'approved' && (!approved ? <Spinner /> : approved.length === 0
          ? <div className="surf empty">No approved venues yet.</div> : <div className="list">{approved.map(venueCard)}</div>)}
        {tab === 'ids' && (!ids ? <Spinner /> : ids.length === 0
          ? <div className="surf empty">No IDs waiting to be checked.</div>
          : <div className="surf">{ids.map(p => (
              <Link key={p.id} className="lrow" to={`/admin/people/${p.id}`}>
                <span className="av" style={{ width: 40, height: 40, fontSize: 16 }}>{p.firstName[0]?.toUpperCase()}</span>
                <span className="tx"><b>{p.firstName} {p.lastName}</b><small>{p.nationality ?? 'Nationality not given'} · sent {since(p.submittedAt)}</small></span>
                <Icon name="chev" size={18} />
              </Link>
            ))}</div>)}
      </div>
      {sheet && (
        <Sheet
          title={sheet.approve ? `Approve ${sheet.v.name}?` : `Remove approval for ${sheet.v.name}?`}
          body={sheet.approve ? 'Staff will be able to see and apply for their shifts straight away.' : 'Their open shifts disappear from the jobs list until they’re approved again.'}
          confirmLabel={sheet.approve ? 'Approve' : 'Remove approval'} danger={!sheet.approve}
          onConfirm={note => api.adminSetVenue(sheet.v.id, sheet.approve, note).then(load)} onClose={() => setSheet(null)} />
      )}
    </div>
  )
}

function FileLink({ kind, path, label }: { kind: 'id' | 'cv'; path: string | null; label: string }) {
  const { api } = useSession()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { if (path) api.fileUrl(kind, path).then(setUrl).catch(() => setUrl(null)) }, [api, kind, path])
  if (!path) return <div className="lrow"><span className="ic"><Icon name={kind === 'id' ? 'id' : 'file'} size={20} /></span><span className="tx"><b>{label}</b><small>Not uploaded</small></span></div>
  return (
    <a className="lrow" href={url ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!url}>
      <span className="ic"><Icon name={kind === 'id' ? 'id' : 'file'} size={20} /></span>
      <span className="tx"><b>{label}</b><small>{url ? 'Opens in a new tab. The link expires after an hour.' : 'Loading…'}</small></span><Icon name="chev" size={18} />
    </a>
  )
}

export function AdminPerson() {
  const { id } = useParams()
  const { api } = useSession()
  const nav = useNavigate()
  const [p, setP] = useState<IdCheck | null | undefined>(undefined)
  const [photo, setPhoto] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'verified' | 'rejected' | null>(null)
  useEffect(() => { api.adminIdCheck(id!).then(setP).catch(() => setP(null)) }, [api, id])
  useEffect(() => { if (p?.photoPath) api.fileUrl('photo', p.photoPath).then(setPhoto).catch(() => {}) }, [api, p?.photoPath])
  if (p === undefined) return <Spinner />
  if (p === null) return <div className="screen"><Header title="ID check" /><div className="scroll empty">We couldn’t find this person.</div></div>

  const sa = p.nationality === 'South African'
  const idOk = sa && p.idNumber ? isValidSaId(p.idNumber) : null
  return (
    <div className="screen">
      <Header title="ID check" />
      <div className="scroll">
        <div className="row" style={{ margin: '6px 0 18px' }}>
          <span className="av" style={{ width: 64, height: 64, fontSize: 24, ...(photo ? { backgroundImage: `url(${photo})` } : {}) }}>{photo ? '' : p.firstName[0]?.toUpperCase()}</span>
          <div><b style={{ fontSize: 20 }}>{p.firstName} {p.lastName}</b>{p.phone && <div style={{ color: 'var(--mute)', userSelect: 'all' }}>{prettyPhone(p.phone)}</div>}</div>
        </div>
        <div className="surf">
          <div className="lrow"><span className="tx"><small>Nationality</small><b>{p.nationality ?? 'Not given'}</b></span></div>
          <div className="lrow"><span className="tx"><small>{sa ? 'ID number' : 'Passport or permit number'}</small><b style={{ userSelect: 'all', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{p.idNumber ?? 'Not given'}</b></span>
            {idOk !== null && <span className={`pill ${idOk ? 'ok' : 'acc'}`}>{idOk ? 'Valid format' : 'Check digit wrong'}</span>}</div>
        </div>
        {idOk === false && <p className="hint" style={{ marginTop: 8 }}>This number fails the SA ID check digit, so it was probably typed wrong. Compare it with the document.</p>}
        <div className="surf" style={{ marginTop: 12 }}>
          <FileLink kind="id" path={p.idDocPath} label="ID or work permit document" />
          <FileLink kind="cv" path={p.cvPath} label="CV" />
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Check the name and number match the document and the photo. If you can, confirm a work permit with the Department of Home Affairs.</p>
      </div>
      <div className="dock">
        <button className="btn pri" onClick={() => setSheet('verified')}><Icon name="shield" size={20} />ID checked: verify</button>
        <button className="btn sec" onClick={() => setSheet('rejected')}>Not accepted</button>
      </div>
      {sheet && (
        <Sheet
          title={sheet === 'verified' ? `Verify ${p.firstName}?` : `Don’t accept ${p.firstName}’s ID?`}
          body={sheet === 'verified' ? 'Venues will see “ID checked” on their applications.' : 'They’ll see your note in the app and can upload a new document.'}
          needNote={sheet === 'rejected'} confirmLabel={sheet === 'verified' ? 'Verify' : 'Not accepted'} danger={sheet === 'rejected'}
          onConfirm={note => api.adminSetRtw(p.id, sheet, note).then(() => nav('/admin', { replace: true }))} onClose={() => setSheet(null)} />
      )}
    </div>
  )
}
