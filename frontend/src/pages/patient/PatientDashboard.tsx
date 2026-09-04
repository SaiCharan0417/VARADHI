import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Patient.css'
import { API_BASE } from '../../config'

interface PatientProfile {
  id: number
  username: string
  name: string
  age: number
  gender: string
  village: string
  district: string
  state: string
  aadhar: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

interface Referral {
  id: number
  token_number: string
  symptoms: string
  symptom_duration: string
  pain_level: number
  is_new_symptom: number
  additional_notes: string
  triage_category: 'emergency' | 'teleconsultation' | 'referral'
  triage_reason: string
  triage_score: number
  status: string
  created_at: string
}

interface Appointment {
  id: number
  token_number: string
  service_name: string
  appointment_date: string
  time_slot: string
  facility_name: string
  facility_district: string
  instructions: string
  allotted_by: string
  status: string
}

interface TriageResult {
  category: string
  categoryLabel: string
  priorityScore: number
  reason: string
  recommendedAction: string
  recommendedFacilityType: string
}

export default function PatientDashboard() {
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientProfile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'journey' | 'profile'>('journey')

  // Questionnaire Modal State
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [assessmentForm, setAssessmentForm] = useState({
    symptoms: '',
    duration: '3-5 days',
    painLevel: 5,
    isNewSymptom: true,
    additionalNotes: ''
  })
  const [submittingAssessment, setSubmittingAssessment] = useState(false)
  const [triageModalResult, setTriageModalResult] = useState<TriageResult | null>(null)
  const [createdTokenNumber, setCreatedTokenNumber] = useState<string | null>(null)

  // Single Referral Enforcement State
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closingReferrals, setClosingReferrals] = useState(false)
  const [activeReferralInfo, setActiveReferralInfo] = useState<any[]>([])

  // Symptom Update State (1 symptom at a time policy)
  const [showUpdateSymptomsModal, setShowUpdateSymptomsModal] = useState(false)
  const [updateSymptomsForm, setUpdateSymptomsForm] = useState({
    symptoms: '',
    duration: '3-5 days',
    painLevel: 5,
    isNewSymptom: true,
    additionalNotes: ''
  })
  const [updatingSymptoms, setUpdatingSymptoms] = useState(false)

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<Partial<PatientProfile>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const token = localStorage.getItem('varadhi_token')

  const fetchData = async () => {
    let activeToken = localStorage.getItem('varadhi_token')

    if (!activeToken) {
      try {
        const authRes = await fetch(`${API_BASE}/auth/patient/signin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'ramesh_patil', password: 'patient123' })
        })
        if (authRes.ok) {
          const authData = await authRes.json()
          localStorage.setItem('varadhi_token', authData.token)
          localStorage.setItem('varadhi_user', JSON.stringify({ ...authData.patient, role: 'patient' }))
          activeToken = authData.token
        }
      } catch (e) {
        console.error('Patient auto auth failed:', e)
      }
    }

    if (!activeToken) {
      navigate('/login/patient')
      return
    }

    try {
      setLoading(true)
      const [profRes, refRes, appRes] = await Promise.all([
        fetch(`${API_BASE}/patient/profile`, { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetch(`${API_BASE}/patient/referrals`, { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetch(`${API_BASE}/patient/appointments`, { headers: { Authorization: `Bearer ${activeToken}` } })
      ])

      if (!profRes.ok) {
        localStorage.removeItem('varadhi_token')
        navigate('/login/patient')
        return
      }

      const profData = await profRes.json()
      setPatient(profData)
      setProfileForm(profData)

      if (refRes.ok) {
        const refData = await refRes.json()
        setReferrals(refData)
      }

      if (appRes.ok) {
        const appData = await appRes.json()
        setAppointments(appData)
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('varadhi_token')
    localStorage.removeItem('varadhi_user')
    navigate('/')
  }

  // Check for active referrals before allowing new submission
  const handleNewReferralClick = async () => {
    try {
      const res = await fetch(`${API_BASE}/patient/active-referral`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.hasActive && data.activeReferrals.length > 0) {
        setActiveReferralInfo(data.activeReferrals)
        setShowCloseConfirm(true)
      } else {
        setShowAssessmentModal(true)
      }
    } catch {
      // If check fails, still allow (fallback)
      setShowAssessmentModal(true)
    }
  }

  // Close all previous referrals, free slots, then open assessment
  const handleCloseAndProceed = async () => {
    setClosingReferrals(true)
    try {
      const res = await fetch(`${API_BASE}/patient/close-referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (res.ok) {
        setShowCloseConfirm(false)
        setShowAssessmentModal(true)
        fetchData() // Refresh referrals list
      } else {
        alert(data.error || 'Failed to close referrals')
      }
    } catch {
      alert('Error closing referrals')
    } finally {
      setClosingReferrals(false)
    }
  }

  // Open Symptom Update Modal preloaded with current active referral details
  const handleOpenUpdateSymptoms = () => {
    if (!activeReferral) return
    setUpdateSymptomsForm({
      symptoms: activeReferral.symptoms || '',
      duration: activeReferral.symptom_duration || '3-5 days',
      painLevel: activeReferral.pain_level || 5,
      isNewSymptom: Boolean(activeReferral.is_new_symptom),
      additionalNotes: activeReferral.additional_notes || ''
    })
    setShowUpdateSymptomsModal(true)
  }

  // Submit Updated Symptoms to backend (triggers AI re-triage)
  const handleUpdateSymptomsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeReferral) return
    setUpdatingSymptoms(true)

    try {
      const res = await fetch(`${API_BASE}/patient/referrals/${activeReferral.id}/symptoms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          symptoms: updateSymptomsForm.symptoms,
          symptom_duration: updateSymptomsForm.duration,
          pain_level: updateSymptomsForm.painLevel,
          is_new_symptom: updateSymptomsForm.isNewSymptom ? 1 : 0,
          additional_notes: updateSymptomsForm.additionalNotes
        })
      })

      const data = await res.json()
      if (res.ok) {
        setShowUpdateSymptomsModal(false)
        if (data.triage) {
          setTriageModalResult({
            category: data.triage.category,
            categoryLabel: data.triage.category === 'emergency' ? 'EMERGENCY IMMEDIATE ATTENTION' :
                           data.triage.category === 'referral' ? 'HOSPITAL FACILITY REFERRAL' : 'TELECONSULTATION APPOINTMENT',
            priorityScore: data.triage.priorityScore,
            reason: data.triage.reason,
            recommendedAction: data.triage.recommendedAction,
            recommendedFacilityType: data.triage.recommendedFacilityType
          })
        }
        await fetchData()
      } else {
        alert(data.error || 'Failed to update symptoms')
      }
    } catch {
      alert('Error connecting to update symptoms API')
    } finally {
      setUpdatingSymptoms(false)
    }
  }

  const handleAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingAssessment(true)

    try {
      const res = await fetch(`${API_BASE}/patient/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          symptoms: assessmentForm.symptoms,
          symptom_duration: assessmentForm.duration,
          pain_level: assessmentForm.painLevel,
          is_new_symptom: assessmentForm.isNewSymptom,
          additional_notes: assessmentForm.additionalNotes
        })
      })

      const data = await res.json()
      if (res.ok) {
        setTriageModalResult(data.triage)
        setCreatedTokenNumber(data.tokenNumber)
        setShowAssessmentModal(false)
        setAssessmentForm({
          symptoms: '',
          duration: '3-5 days',
          painLevel: 5,
          isNewSymptom: true,
          additionalNotes: ''
        })
        fetchData()
      } else {
        alert(data.error || 'Failed to submit case')
      }
    } catch (err) {
      alert('Error submitting case')
    } finally {
      setSubmittingAssessment(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch(`${API_BASE}/patient/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      })
      const data = await res.json()
      if (res.ok) {
        setPatient(data.patient)
        setIsEditingProfile(false)
        alert('Profile saved successfully!')
      } else {
        alert(data.error || 'Failed to update')
      }
    } catch (err) {
      alert('Error saving profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const activeReferral = referrals.find(r => r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'dropped_out')
  const pastReferrals = referrals.filter(r => r !== activeReferral)

  // Current active appointment matching token or latest
  const activeAppointment = appointments[0]

  const activeToken = activeReferral?.token_number || (activeReferral ? `${1000 + activeReferral.id}` : null)

  if (loading && !patient) {
    return (
      <div className="patient-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your health dashboard...</p>
      </div>
    )
  }

  return (
    <div className="patient-shell">
      {/* Top Header */}
      <header className="p-header">
        <div>
          <div className="p-header-brand">VARADHI · Patient Portal</div>
          <div className="p-header-greeting">
            Namaste, {patient?.name || patient?.username || 'Citizen'}
            {patient?.village ? ` · ${patient.village}` : ''}
          </div>
        </div>
        <div className="p-header-icons">
          {activeToken && (
            <span style={{
              background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
              color: 'var(--bg-primary)',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 800
            }}>
              TOKEN #{activeToken}
            </span>
          )}
          <button 
            className="icon-btn" 
            title="Sign Out" 
            onClick={handleLogout}
          >
            ⏻
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="p-body">
        {activeTab === 'journey' && (
          <>
            {/* Active Referral / Care Journey */}
            {activeReferral ? (
              <div className="p-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div>
                    <div className="p-card-title" style={{ margin: 0 }}>
                      ACTIVE CARE JOURNEY · TOKEN #{activeToken}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.3rem' }}>
                      {activeReferral.symptoms}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleOpenUpdateSymptoms}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: 'hsla(165, 72%, 52%, 0.15)',
                        border: '1px solid var(--accent)',
                        color: 'var(--accent)',
                        cursor: 'pointer'
                      }}
                      title="Update symptoms for this active evaluation"
                    >
                      ✏️ Update Symptoms
                    </button>
                    <span className={`ref-badge ${activeReferral.triage_category === 'emergency' ? 'alert-banner' : 'pending'}`} style={{ margin: 0, padding: '0.3rem 0.7rem' }}>
                      {activeReferral.triage_category === 'emergency' ? '🚨 Emergency' :
                       activeReferral.triage_category === 'referral' ? '🏥 Facility Referral' : '👩‍⚕️ Teleconsultation'}
                    </span>
                  </div>
                </div>

                <div style={{ background: 'hsla(0,0%,100%,0.04)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    <strong>AI Triage Assessment:</strong> {activeReferral.triage_reason}
                  </div>
                  <div style={{ display: 'flex', gap: '1.2rem', color: 'var(--accent)', fontWeight: 600 }}>
                    <span>Pain: {activeReferral.pain_level}/10</span>
                    <span>Duration: {activeReferral.symptom_duration}</span>
                    <span>Score: {activeReferral.triage_score}/100</span>
                  </div>
                </div>

                {/* Allotted Time Slot & Facility Card (Shared by Frontline Worker) */}
                {activeAppointment ? (
                  <div style={{
                    background: 'linear-gradient(135deg, hsla(165, 72%, 52%, 0.15), hsla(195, 90%, 55%, 0.1))',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    marginBottom: '1.2rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🎯 ALLOTTED FACILITY & TIME SLOT
                      </span>
                      <span className="ref-badge completed" style={{ margin: 0, fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                        Confirmed
                      </span>
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {activeAppointment.facility_name || 'District General Hospital Ballari'}
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.4rem' }}>
                      Service / Test: {activeAppointment.service_name}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem', background: 'hsla(0,0%,0%,0.2)', padding: '0.5rem', borderRadius: '6px' }}>
                      <span>📅 <strong>{activeAppointment.appointment_date}</strong></span>
                      <span>⏰ <strong>{activeAppointment.time_slot}</strong></span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                      ℹ️ {activeAppointment.instructions}
                    </p>
                  </div>
                ) : (
                  <div style={{
                    background: 'hsla(38, 92%, 55%, 0.1)',
                    border: '1px solid hsla(38, 92%, 55%, 0.3)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: 'hsl(38, 92%, 75%)'
                  }}>
                    ⏳ <strong>Pending Frontline Coordination:</strong> An ASHA/ANM frontline worker is reviewing your case and will allot your facility time slot shortly.
                  </div>
                )}

                <div className="p-card-title">JOURNEY PROGRESS</div>
                <ul className="journey-list">
                  <li className="journey-step">
                    <span className="step-dot done" />
                    <span className="step-label done">1. Case Registered (Token #{activeToken})</span>
                  </li>
                  <li className="journey-step">
                    <span className="step-dot done" />
                    <span className="step-label done">2. AI Medical Board Triage Completed</span>
                  </li>
                  <li className="journey-step">
                    <span className={`step-dot ${activeAppointment ? 'done' : 'active'}`} />
                    <span className={`step-label ${activeAppointment ? 'done' : 'active'}`}>
                      {activeAppointment 
                        ? `3. Time Slot Allotted: ${activeAppointment.time_slot} (${activeAppointment.facility_name})`
                        : '3. Frontline Worker Scheduling Time Slot & Hospital Facility'}
                    </span>
                  </li>
                  <li className="journey-step">
                    <span className={`step-dot ${activeAppointment ? 'active' : ''}`} />
                    <span className={`step-label ${activeAppointment ? 'active' : ''}`}>
                      4. Arrival at Facility, Test / Doctor Consultation
                    </span>
                  </li>
                </ul>

                <button 
                  className="cta-btn" 
                  style={{ width: '100%', marginTop: '1.2rem', background: 'hsla(0,0%,100%,0.08)', border: '1px solid var(--card-border)' }}
                  onClick={handleNewReferralClick}
                >
                  + Report New Symptoms / Assessment
                </button>
              </div>
            ) : (
              <div className="p-card empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">No Active Referrals</div>
                <div className="empty-sub">
                  You do not have any ongoing medical cases or referrals right now.
                </div>
                <button 
                  className="cta-btn"
                  onClick={handleNewReferralClick}
                >
                  + Register Patient Case / Symptom Assessment
                </button>
              </div>
            )}

            {/* Past Referrals Section */}
            {pastReferrals.length > 0 && (
              <div className="p-card">
                <div className="p-card-title">PAST REFERRALS & CASE HISTORY</div>
                {pastReferrals.map((ref) => (
                  <div key={ref.id} className="referral-item">
                    <div className="ref-icon">
                      {ref.triage_category === 'emergency' ? '🚨' : ref.triage_category === 'referral' ? '🏥' : '👩‍⚕️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ref-label">
                        {ref.token_number ? `Token #${ref.token_number}: ` : ''}{ref.symptoms}
                      </div>
                      <div className="ref-sub">
                        {new Date(ref.created_at).toLocaleDateString()} · Pain: {ref.pain_level}/10 · {ref.triage_category}
                      </div>
                    </div>
                    <span className="ref-badge completed">Completed</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="p-card">
            <div className="profile-avatar">👤</div>
            <h2 className="profile-name">{patient?.name || 'Patient Profile'}</h2>
            <p className="profile-sub">Aadhar: {patient?.aadhar || 'Not available'}</p>

            {!isEditingProfile ? (
              <div>
                <div className="profile-field">
                  <span className="pf-key">Age / Gender</span>
                  <span className="pf-val">{patient?.age || '—'} yrs · {patient?.gender || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="pf-key">Village / Location</span>
                  <span className="pf-val">{patient?.village || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="pf-key">District & State</span>
                  <span className="pf-val">{patient?.district || '—'}, {patient?.state || 'Karnataka'}</span>
                </div>
                <div className="profile-field">
                  <span className="pf-key">Emergency Contact</span>
                  <span className="pf-val">{patient?.emergency_contact_name || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="pf-key">Emergency Phone</span>
                  <span className="pf-val">{patient?.emergency_contact_phone || '—'}</span>
                </div>

                <button 
                  className="cta-btn" 
                  style={{ width: '100%', marginTop: '1.4rem' }}
                  onClick={() => setIsEditingProfile(true)}
                >
                  ✏️ Edit Profile Details
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile}>
                <div className="field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name || ''}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>Age</label>
                    <input
                      type="number"
                      value={profileForm.age || ''}
                      onChange={e => setProfileForm({ ...profileForm, age: parseInt(e.target.value, 10) || 0 })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select
                      style={{
                        width: '100%',
                        background: 'hsla(0,0%,100%,0.06)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                      value={profileForm.gender || 'Male'}
                      onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}
                    >
                      <option value="Male" style={{ background: '#1c2230' }}>Male</option>
                      <option value="Female" style={{ background: '#1c2230' }}>Female</option>
                      <option value="Other" style={{ background: '#1c2230' }}>Other</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Village</label>
                  <input
                    type="text"
                    value={profileForm.village || ''}
                    onChange={e => setProfileForm({ ...profileForm, village: e.target.value })}
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>District</label>
                    <input
                      type="text"
                      value={profileForm.district || ''}
                      onChange={e => setProfileForm({ ...profileForm, district: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <input
                      type="text"
                      value={profileForm.state || 'Karnataka'}
                      onChange={e => setProfileForm({ ...profileForm, state: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label>Emergency Contact</label>
                    <input
                      type="text"
                      value={profileForm.emergency_contact_name || ''}
                      onChange={e => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Emergency Phone</label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={profileForm.emergency_contact_phone || ''}
                      onChange={e => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
                  <button 
                    type="button" 
                    className="view-btn" 
                    style={{ background: 'hsla(0,0%,100%,0.1)', color: '#fff' }}
                    onClick={() => setIsEditingProfile(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="view-btn" disabled={savingProfile}>
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="p-bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'journey' ? 'active' : ''}`}
          onClick={() => setActiveTab('journey')}
        >
          <span className="nav-icon">🩺</span>
          <span>Journey</span>
        </button>
        <button 
          className="nav-item"
          onClick={() => setShowAssessmentModal(true)}
        >
          <span className="nav-icon">➕</span>
          <span>Register Case</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>

      {/* ================= ASSESSMENT MODAL ================= */}
      {showAssessmentModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="p-card" style={{ maxWidth: '440px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Register Case / Symptom Triage</h2>
              <button 
                className="icon-btn" 
                onClick={() => setShowAssessmentModal(false)}
                style={{ width: '32px', height: '32px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
              Describe the health situation. Our AI Medical Board rules will analyze and triage into Emergency, Teleconsultation, or Facility Referral, and issue a unique Token Number.
            </p>

            <form onSubmit={handleAssessmentSubmit}>
              <div className="field">
                <label>Chief Complaints & Symptoms</label>
                <textarea
                  style={{
                    width: '100%',
                    background: 'hsla(0,0%,100%,0.06)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font)',
                    fontSize: '0.9rem',
                    minHeight: '75px',
                    outline: 'none'
                  }}
                  placeholder="e.g. Severe chest pain, shortness of breath, continuous fever..."
                  value={assessmentForm.symptoms}
                  onChange={e => setAssessmentForm({ ...assessmentForm, symptoms: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label>How many days have you been feeling this?</label>
                <select
                  style={{
                    width: '100%',
                    background: 'hsla(0,0%,100%,0.06)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                  value={assessmentForm.duration}
                  onChange={e => setAssessmentForm({ ...assessmentForm, duration: e.target.value })}
                >
                  <option value="Started today (< 24 hours)" style={{ background: '#1c2230' }}>Started today (&lt; 24 hours)</option>
                  <option value="3-5 days" style={{ background: '#1c2230' }}>3 to 5 days</option>
                  <option value="1-2 weeks" style={{ background: '#1c2230' }}>1 to 2 weeks</option>
                  <option value="More than 2 weeks (Chronic)" style={{ background: '#1c2230' }}>More than 2 weeks (Chronic)</option>
                </select>
              </div>

              <div className="field">
                <label>Pain Intensity: {assessmentForm.painLevel} / 10</label>
                <div className="pain-scale">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      type="button"
                      key={num}
                      className={`pain-btn ${assessmentForm.painLevel === num ? 'selected' : ''}`}
                      onClick={() => setAssessmentForm({ ...assessmentForm, painLevel: num })}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  <span>Mild</span>
                  <span>Moderate</span>
                  <span>Severe (Emergency)</span>
                </div>
              </div>

              <div className="field">
                <label>Is this a new symptom or already existing?</label>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    className={`tab-btn ${assessmentForm.isNewSymptom ? 'active' : ''}`}
                    onClick={() => setAssessmentForm({ ...assessmentForm, isNewSymptom: true })}
                    style={{ flex: 1, padding: '0.5rem' }}
                  >
                    ⚡ New Symptom
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${!assessmentForm.isNewSymptom ? 'active' : ''}`}
                    onClick={() => setAssessmentForm({ ...assessmentForm, isNewSymptom: false })}
                    style={{ flex: 1, padding: '0.5rem' }}
                  >
                    🔄 Already Existing
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Any other issues (Fever, BP, Diabetes, etc.)?</label>
                <input
                  type="text"
                  placeholder="e.g. Diabetic, high blood pressure, feeling dizzy"
                  value={assessmentForm.additionalNotes}
                  onChange={e => setAssessmentForm({ ...assessmentForm, additionalNotes: e.target.value })}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={submittingAssessment}>
                {submittingAssessment ? 'Analyzing with AI Triage...' : '⚡ Submit Case for AI Triage →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= TRIAGE RESULT MODAL ================= */}
      {triageModalResult && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '1rem'
        }}>
          <div className="p-card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {triageModalResult.category === 'emergency' ? '🚨' :
               triageModalResult.category === 'referral' ? '🏥' : '👩‍⚕️'}
            </div>

            {createdTokenNumber && (
              <div style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
                color: 'var(--bg-primary)',
                padding: '0.35rem 0.9rem',
                borderRadius: '50px',
                fontWeight: 800,
                fontSize: '0.95rem',
                marginBottom: '0.8rem'
              }}>
                YOUR TOKEN NUMBER: {createdTokenNumber}
              </div>
            )}

            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.3rem', color: triageModalResult.category === 'emergency' ? 'var(--danger)' : 'var(--accent)' }}>
              {triageModalResult.categoryLabel}
            </h2>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
              Priority Score: <strong>{triageModalResult.priorityScore}/100</strong>
            </div>

            <div style={{
              background: 'hsla(0,0%,100%,0.05)',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'left',
              marginBottom: '1.2rem',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Triage Analysis:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{triageModalResult.reason}</p>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Recommended Action:</strong>
                <p style={{ color: 'var(--accent)', marginTop: '2px' }}>{triageModalResult.recommendedAction}</p>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Assigned Care Level:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{triageModalResult.recommendedFacilityType}</p>
              </div>
            </div>

            <button 
              className="submit-btn" 
              onClick={() => setTriageModalResult(null)}
            >
              Continue to Care Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* ================= CLOSE ACTIVE REFERRAL CONFIRMATION MODAL ================= */}
      {showCloseConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 120,
          padding: '1rem'
        }}>
          <div className="p-card" style={{ maxWidth: '480px', width: '100%', border: '1px solid hsla(38, 92%, 55%, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.8rem' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Active Referral in Progress</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>One Active Referral Policy</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCloseConfirm(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'hsla(38, 92%, 55%, 0.1)',
              border: '1px solid hsla(38, 92%, 55%, 0.3)',
              borderRadius: '8px',
              padding: '0.85rem',
              marginBottom: '1rem',
              fontSize: '0.86rem',
              color: 'var(--text-primary)'
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                You currently have an active care referral:
              </p>
              {activeReferralInfo.map((ref, idx) => (
                <div key={idx} style={{ padding: '0.4rem 0', borderTop: idx > 0 ? '1px solid hsla(0,0%,100%,0.1)' : 'none', fontSize: '0.82rem' }}>
                  <div>🏷️ <strong>Token #{ref.token_number || ref.id}</strong>: {ref.symptoms}</div>
                  {ref.service_name && (
                    <div style={{ color: 'var(--accent)', marginTop: '0.2rem' }}>
                      🏥 Service: {ref.service_name} at {ref.facility_name || 'District Facility'}
                    </div>
                  )}
                  {ref.time_slot && (
                    <div style={{ color: 'hsl(38, 92%, 75%)', marginTop: '0.2rem' }}>
                      ⏰ Reserved Slot: {ref.appointment_date} ({ref.time_slot})
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1.2rem' }}>
              To register a new symptom assessment, your previous referral will be marked as closed, and any reserved appointment slots will be immediately released for other rural patients.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false)
                  handleOpenUpdateSymptoms()
                }}
                style={{
                  width: '100%',
                  padding: '0.7rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--accent)',
                  background: 'hsla(165, 72%, 52%, 0.15)',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.84rem'
                }}
              >
                ✏️ Just Update Existing Symptoms (Keep Reserved Slot)
              </button>

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button
                  type="button"
                  className="submit-btn"
                  onClick={handleCloseAndProceed}
                  disabled={closingReferrals}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, hsl(38, 92%, 50%), hsl(15, 90%, 55%))',
                    color: '#000',
                    fontWeight: 700
                  }}
                >
                  {closingReferrals ? 'Releasing Slot & Closing...' : 'Close Previous & Evaluate New →'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(false)}
                  style={{
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Keep Existing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= UPDATE SYMPTOMS MODAL ================= */}
      {showUpdateSymptomsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 125,
          padding: '1rem'
        }}>
          <div className="p-card" style={{ maxWidth: '520px', width: '100%', border: '1px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  ✏️ Update Symptoms & Re-evaluate
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  Evaluating 1 symptom at a time · Token #{activeToken}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdateSymptomsModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSymptomsSubmit}>
              <div className="field">
                <label>Updated Symptoms Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe your current or changing symptoms in detail..."
                  value={updateSymptomsForm.symptoms}
                  onChange={e => setUpdateSymptomsForm({ ...updateSymptomsForm, symptoms: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'hsla(0,0%,0%,0.25)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Duration of Symptoms</label>
                  <select
                    value={updateSymptomsForm.duration}
                    onChange={e => setUpdateSymptomsForm({ ...updateSymptomsForm, duration: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      background: 'hsla(0,0%,0%,0.35)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="< 24 hours">Less than 24 hours</option>
                    <option value="1-2 days">1 to 2 days</option>
                    <option value="3-5 days">3 to 5 days</option>
                    <option value="1-2 weeks">1 to 2 weeks</option>
                    <option value="> 2 weeks">More than 2 weeks</option>
                  </select>
                </div>

                <div className="field">
                  <label>Pain Severity (1-10): {updateSymptomsForm.painLevel}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={updateSymptomsForm.painLevel}
                    onChange={e => setUpdateSymptomsForm({ ...updateSymptomsForm, painLevel: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', accentColor: 'var(--accent)', marginTop: '0.4rem' }}
                  />
                </div>
              </div>

              <div className="field">
                <label>Symptom Pattern</label>
                <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.3rem' }}>
                  <button
                    type="button"
                    className={`btn-secondary ${updateSymptomsForm.isNewSymptom ? 'active' : ''}`}
                    onClick={() => setUpdateSymptomsForm({ ...updateSymptomsForm, isNewSymptom: true })}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: updateSymptomsForm.isNewSymptom ? 'hsla(165, 72%, 52%, 0.2)' : 'transparent',
                      borderColor: updateSymptomsForm.isNewSymptom ? 'var(--accent)' : 'var(--card-border)',
                      color: updateSymptomsForm.isNewSymptom ? 'var(--accent)' : 'var(--text-secondary)'
                    }}
                  >
                    ⚡ Newly Emerged
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary ${!updateSymptomsForm.isNewSymptom ? 'active' : ''}`}
                    onClick={() => setUpdateSymptomsForm({ ...updateSymptomsForm, isNewSymptom: false })}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: !updateSymptomsForm.isNewSymptom ? 'hsla(165, 72%, 52%, 0.2)' : 'transparent',
                      borderColor: !updateSymptomsForm.isNewSymptom ? 'var(--accent)' : 'var(--card-border)',
                      color: !updateSymptomsForm.isNewSymptom ? 'var(--accent)' : 'var(--text-secondary)'
                    }}
                  >
                    🔄 Existing / Progressing
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Additional Notes or Other Chronic Conditions</label>
                <input
                  type="text"
                  placeholder="e.g. High blood pressure, diabetic, dizziness"
                  value={updateSymptomsForm.additionalNotes}
                  onChange={e => setUpdateSymptomsForm({ ...updateSymptomsForm, additionalNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={updatingSymptoms}
                  style={{ flex: 1 }}
                >
                  {updatingSymptoms ? 'Re-evaluating with AI Triage...' : '⚡ Re-evaluate with AI Triage →'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpdateSymptomsModal(false)}
                  style={{
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

