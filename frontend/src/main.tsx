import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import PatientLogin from './pages/PatientLogin'
import FrontlineLogin from './pages/FrontlineLogin'
import HospitalLogin from './pages/HospitalLogin'
import DistrictLogin from './pages/DistrictLogin'
import PatientProfileSetup from './pages/patient/PatientProfileSetup'
import PatientDashboard from './pages/patient/PatientDashboard'
import HospitalDashboard from './pages/hospital/HospitalDashboard'
import FrontlineDashboard from './pages/frontline/FrontlineDashboard'
import DistrictDashboard from './pages/district/DistrictDashboard'
import ReferralStatus from './pages/referral/ReferralStatus'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login/patient"   element={<PatientLogin />} />
        <Route path="/login/frontline" element={<FrontlineLogin />} />
        <Route path="/login/hospital"  element={<HospitalLogin />} />
        <Route path="/login/district"  element={<DistrictLogin />} />
        <Route path="/patient/profile-setup" element={<PatientProfileSetup />} />
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
        <Route path="/frontline/dashboard" element={<FrontlineDashboard />} />
        <Route path="/district/dashboard" element={<DistrictDashboard />} />
        <Route path="/referral/:id" element={<ReferralStatus />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
