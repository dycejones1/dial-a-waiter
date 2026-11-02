import { useNavigate, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-3.5-3.5',
  cal: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 10h18M8 3v4M16 3v4',
  brief: 'M3 10a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  back: 'm15 5-7 7 7 7', chev: 'm9 5 7 7-7 7', check: 'm5 12.5 4.5 4.5L19 7', plus: 'M12 5v14M5 12h14',
  mail: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm1-1 8 6 8-6',
  phone: 'M9 2.5h6a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3zM11 18h2',
  cam: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm8 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zm0-14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  locate: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  id: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm6 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 14h3',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6zm-3.5 9 2.5 2.5 4.5-4.5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2', out: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10',
  file: 'M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 0v5h5M9 13h6M9 17h6'
}

export function Icon({ name, size = 22, stroke = 1.9 }: { name: keyof typeof P | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>
  )
}

export function Logo({ size = 56 }: { size?: number }) {
  // The master Dial A Waiter logo (from the original 2020 app assets)
  return <img src="/logo.png" width={size} height={size} alt="Dial A Waiter" style={{ display: 'block' }} />
}

/** A light illustration of a venue interior, tinted per venue. Replaces heavy photos to save data. */
export function VenueArt({ name }: { name: string }) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return (
    <svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
      <rect width="240" height="120" fill={`hsl(${h} 32% 22%)`} />
      <rect y="20" width="240" height="4" fill={`hsl(${h} 40% 30%)`} />
      {[40, 95, 150, 205].map((x, i) => (
        <g key={x}><line x1={x} y1="0" x2={x} y2={26 + (i % 2) * 8} stroke={`hsl(${h} 20% 62%)`} />
          <path d={`M${x - 9} ${32 + (i % 2) * 8}h18l-4-8h-10z`} fill={`hsl(${h} 70% 78%)`} /></g>
      ))}
      <g fill={`hsl(${h} 25% 66%)`}><rect x="22" y="84" width="54" height="5" rx="2" /><rect x="94" y="88" width="54" height="5" rx="2" /><rect x="166" y="84" width="54" height="5" rx="2" /></g>
      <g fill={`hsl(${h} 30% 46%)`}>{[26, 70, 98, 142, 170, 214].map((x, i) => <rect key={x} x={x} y={i % 2 ? 93 : 89} width="3" height={i % 2 ? 27 : 31} />)}</g>
    </svg>
  )
}

export function Progress({ step, total = 8 }: { step: number; total?: number }) {
  const nav = useNavigate()
  return (
    <div className="hd">
      <button className="ib ghost" onClick={() => nav(-1)} aria-label="Back"><Icon name="back" /></button>
      <div className="prog" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? 'f' : ''} />)}
      </div>
      <span className="step">{step}/{total}</span>
    </div>
  )
}

export function Header({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="hd">
      {back ? <button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon name="back" size={20} /></button> : <span style={{ width: 42 }} />}
      <h1>{title}</h1>
      {right ?? <span style={{ width: 42 }} />}
    </div>
  )
}

export function TabBar() {
  const tabs = [['/home', 'home', 'Home'], ['/jobs', 'search', 'Jobs'], ['/applications', 'brief', 'Applications'], ['/account', 'user', 'Account']] as const
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map(([to, ic, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={ic} />{label}</NavLink>
      ))}
    </nav>
  )
}

export function Spinner() { return <div className="spinner" role="status" aria-label="Loading" /> }
