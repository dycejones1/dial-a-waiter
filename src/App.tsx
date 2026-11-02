import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import { Address, Code, ConfirmChoice, Cv, Documents, Done, Jobs as PickJobs, Login, Photo, Register, Welcome } from './screens/join'
import { Account, Applications, Home, Jobs, ShiftDetail } from './screens/staff'
import { Header, Spinner } from './components/ui'

function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, userId } = useSession()
  if (!ready) return <Spinner />
  return userId ? <>{children}</> : <Navigate to="/" replace />
}

function DemoBanner() {
  const { api } = useSession()
  return api.mode === 'demo' ? <div className="demo">Demo mode · login code 123456 · nothing is saved</div> : null
}

function Terms() {
  return (
    <div className="screen"><Header title="Terms & privacy" />
      <div className="scroll">
        <p className="t-sub">Placeholder. Before launch, replace this page with your terms of use and a POPIA-compliant privacy notice, reviewed by a lawyer.</p>
        <p>In short, it should say what personal information we collect (contact details, location, CV, ID and bank details), why, who can see it (venues see your profile, photo and ratings; only our team sees ID documents), how long we keep it, and how to ask for it to be deleted.</p>
      </div>
    </div>
  )
}

function StaffSide() {
  return (
    <div className="screen"><Header title="I need staff" />
      <div className="scroll center" style={{ paddingTop: 30 }}>
        <h1 className="t-disp">Hiring for your venue?</h1>
        <p className="t-sub">Employer accounts are opening soon. Leave your details with our team and an account manager will set you up.</p>
        <Link className="btn sec" to="/">Back</Link>
      </div>
    </div>
  )
}

function Routed() {
  const { ready } = useSession()
  if (!ready) return <Spinner />
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/code" element={<Code />} />
      <Route path="/join/register" element={<Register />} />
      <Route path="/join/photo" element={<Photo />} />
      <Route path="/join/confirm" element={<ConfirmChoice />} />
      <Route path="/join/code" element={<Code />} />
      <Route path="/join/address" element={<RequireAuth><Address /></RequireAuth>} />
      <Route path="/join/jobs" element={<RequireAuth><PickJobs /></RequireAuth>} />
      <Route path="/join/cv" element={<RequireAuth><Cv /></RequireAuth>} />
      <Route path="/join/documents" element={<RequireAuth><Documents /></RequireAuth>} />
      <Route path="/join/done" element={<RequireAuth><Done /></RequireAuth>} />
      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/jobs" element={<RequireAuth><Jobs /></RequireAuth>} />
      <Route path="/jobs/:id" element={<RequireAuth><ShiftDetail /></RequireAuth>} />
      <Route path="/applications" element={<RequireAuth><Applications /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/staff" element={<StaffSide />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <div className="shell"><DemoBanner /><Routed /></div>
      </BrowserRouter>
    </SessionProvider>
  )
}
