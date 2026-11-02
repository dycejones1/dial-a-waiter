import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './lib/session'
import { Address, Code, ConfirmChoice, Cv, Documents, Done, Jobs as PickJobs, Login, Photo, Register, Welcome } from './screens/join'
import { Account, Applications, Home, Jobs, ShiftDetail } from './screens/staff'
import { Dashboard, EmployerRegister, PostShift, ShiftApplicants, StartChoice, VenueSetup, VenueWelcome } from './screens/employer'
import type { Profile } from './lib/types'
import { Header, Spinner } from './components/ui'

function RequireAuth({ children, role }: { children: ReactNode; role?: Profile['role'] }) {
  const { ready, userId, profile } = useSession()
  if (!ready) return <Spinner />
  if (!userId) return <Navigate to="/" replace />
  if (role && profile && profile.role !== role) return <Navigate to={profile.role === 'employer' ? '/venue' : '/home'} replace />
  return <>{children}</>
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
      <Route path="/join/address" element={<RequireAuth role="staff"><Address /></RequireAuth>} />
      <Route path="/join/jobs" element={<RequireAuth role="staff"><PickJobs /></RequireAuth>} />
      <Route path="/join/cv" element={<RequireAuth role="staff"><Cv /></RequireAuth>} />
      <Route path="/join/documents" element={<RequireAuth role="staff"><Documents /></RequireAuth>} />
      <Route path="/join/done" element={<RequireAuth role="staff"><Done /></RequireAuth>} />
      <Route path="/home" element={<RequireAuth role="staff"><Home /></RequireAuth>} />
      <Route path="/jobs" element={<RequireAuth role="staff"><Jobs /></RequireAuth>} />
      <Route path="/jobs/:id" element={<RequireAuth role="staff"><ShiftDetail /></RequireAuth>} />
      <Route path="/applications" element={<RequireAuth role="staff"><Applications /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/venue/start" element={<StartChoice />} />
      <Route path="/venue/join" element={<EmployerRegister />} />
      <Route path="/venue/setup" element={<RequireAuth role="employer"><VenueSetup /></RequireAuth>} />
      <Route path="/venue/welcome" element={<RequireAuth role="employer"><VenueWelcome /></RequireAuth>} />
      <Route path="/venue" element={<RequireAuth role="employer"><Dashboard /></RequireAuth>} />
      <Route path="/venue/post" element={<RequireAuth role="employer"><PostShift /></RequireAuth>} />
      <Route path="/venue/shifts/:id" element={<RequireAuth role="employer"><ShiftApplicants /></RequireAuth>} />
      <Route path="/terms" element={<Terms />} />
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
