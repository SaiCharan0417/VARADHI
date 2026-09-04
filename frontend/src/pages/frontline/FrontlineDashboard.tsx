import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../hospital/Hospital.css'
import { QRCodeSVG } from 'qrcode.react'
import { API_BASE } from '../../config'

interface TriagedCase {
  id: number
  token_number: string
  patient_id: number
  patient_name: string
  patient_age: number
  patient_gender: string
  patient_village: string
  patient_district: string
  emergency_contact_phone: string
  symptoms: string
  symptom_duration: string
  pain_level: number
  triage_category: 'emergency' | 'teleconsultation' | 'referral'
  triage_reason: string
  triage_score: number
  status: string
  created_at: string
  booked_time_slot?: string
  booked_date?: string
  booked_service?: string
  booked_facility?: string
}

interface FacilityResource {
  id: number
  category: 'equipment' | 'test' | 'doctor' | 'other'
  name: string
  description: string
  quantity: number
  is_available: number
}

interface Facility {
  id: number
  facility_code: string
  facility_name: string
  facility_type: string
  district: string
  bed_capacity: number
  resources: FacilityResource[]
}

interface SlotInfo {
  slot: string
  isAvailable: boolean
  bookedBy: { token: string; patient: string } | null
}

export default function FrontlineDashboard() {
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState<'cases' | 'facilities'>('cases')
  const [cases, setCases] = useState<TriagedCase[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)

  // Filter for cases
  const [caseFilter, setCaseFilter] = useState<'all' | 'teleconsultation' | 'referral' | 'emergency'>('all')

  // Slot Allotment Modal State
  const [allotModalCase, setAllotModalCase] = useState<TriagedCase | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null)
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [slotsData, setSlotsData] = useState<{
    slots: SlotInfo[]
    availableCount: number
    filledCount: number
  } | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [allotMessage, setAllotMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Rural Patient On-Behalf Registration State
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    name: '',
    age: '',
    gender: 'Female',
    phone: '',
    village: '',
    district: 'Ballari',
    symptoms: '',
    duration: '1-2 days',
    painLevel: 5,
    isNewSymptom: true,
    additionalNotes: ''
  })
  const [registering, setRegistering] = useState(false)
  const [registerSuccessData, setRegisterSuccessData] = useState<any>(null)
  const [registerCloseConfirm, setRegisterCloseConfirm] = useState<any>(null)

  // SMS Resend State
  const [sendingSmsToken, setSendingSmsToken] = useState<string | null>(null)
  const [smsNotificationMsg, setSmsNotificationMsg] = useState<{ token: string; text: string } | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [casesRes, facRes] = await Promise.all([
        fetch(`${API_BASE}/frontline/triaged-cases`),
        fetch(`${API_BASE}/facilities`)
      ])

      const casesData = await casesRes.json()
      const facData = await facRes.json()

      setCases(casesData || [])
      setFacilities(facData || [])
      if (facData && facData.length > 0) {
        setSelectedFacilityId(facData[0].id)
      }
    } catch (err) {
      console.error('Error fetching frontline data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // When facility or service or date changes in modal, load slot availability
  useEffect(() => {
    if (allotModalCase && selectedFacilityId && selectedService) {
      fetch(`${API_BASE}/slots/available?facility_id=${selectedFacilityId}&service_name=${encodeURIComponent(selectedService)}&date=${selectedDate}`)
        .then(res => res.json())
        .then(data => {
          setSlotsData(data)
          setSelectedSlot('')
        })
        .catch(err => console.error('Error fetching slots:', err))
    }
  }, [allotModalCase, selectedFacilityId, selectedService, selectedDate])

  const openAllotModal = (c: TriagedCase) => {
    setAllotModalCase(c)
    setAllotMessage(null)
    const defFac = facilities[0]
    if (defFac) {
      setSelectedFacilityId(defFac.id)
      // Pick first test or doctor or bed as default
      const defService = defFac.resources?.find(r => r.category === 'test' || r.category === 'doctor') || defFac.resources?.[0]
      if (defService) setSelectedService(defService.name)
    }
  }

  const handleConfirmAllot = async () => {
    if (!allotModalCase || !selectedFacilityId || !selectedService || !selectedSlot) {
      alert('Please select a facility, service, and available time slot.')
      return
    }

    setBookingLoading(true)
    setAllotMessage(null)

    const tokenNum = allotModalCase.token_number || `${1000 + allotModalCase.id}`

    try {
      const res = await fetch(`${API_BASE}/appointments/allot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_id: allotModalCase.id,
          token_number: tokenNum,
          patient_id: allotModalCase.patient_id,
          facility_id: selectedFacilityId,
          service_name: selectedService,
          appointment_date: selectedDate,
          time_slot: selectedSlot,
          instructions: `Arrive 15 minutes before slot with Token #${tokenNum} for ${selectedService}.`,
          allotted_by: 'Frontline Health Worker (ASHA)'
        })
      })

      const data = await res.json()
      if (res.ok) {
        const smsNote = data.smsSent && data.smsDetails
          ? ` · 📲 Referral SMS dispatched to patient's mobile (${data.smsDetails.phone}) with facility directions!`
          : ''
        setAllotMessage({
          type: 'success',
          text: `Time slot ${selectedSlot} successfully allotted to Token #${tokenNum}!${smsNote}`
        })
        fetchData()
        setTimeout(() => {
          setAllotModalCase(null)
        }, 2200)
      } else {
        setAllotMessage({ type: 'error', text: data.error || 'Failed to allot slot' })
      }
    } catch (err) {
      setAllotMessage({ type: 'error', text: 'Server error while booking appointment.' })
    } finally {
      setBookingLoading(false)
    }
  }

  // Frontline worker registers rural citizen case directly on their behalf
  const handleRegisterPatientCase = async (confirmClose = false) => {
    if (!registerForm.name.trim() || !registerForm.phone.trim() || !registerForm.symptoms.trim()) {
      alert('Please provide Patient Name, Mobile Number, and Symptoms.')
      return
    }

    setRegistering(true)
    try {
      const res = await fetch(`${API_BASE}/frontline/register-patient-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...registerForm,
          age: parseInt(registerForm.age, 10) || 40,
          confirmCloseExisting: confirmClose
        })
      })

      const data = await res.json()

      if (res.status === 409 && data.requiresConfirmation) {
        setRegisterCloseConfirm(data)
        return
      }

      if (res.ok) {
        setRegisterSuccessData(data)
        setRegisterCloseConfirm(null)
        // Reset form
        setRegisterForm({
          name: '',
          age: '',
          gender: 'Female',
          phone: '',
          village: '',
          district: 'Ballari',
          symptoms: '',
          duration: '1-2 days',
          painLevel: 5,
          isNewSymptom: true,
          additionalNotes: ''
        })
        await fetchData()
      } else {
        alert(data.error || 'Failed to register patient case')
      }
    } catch {
      alert('Network error registering patient case')
    } finally {
      setRegistering(false)
    }
  }

  // Frontline worker manually resends referral SMS to patient
  const handleSendSms = async (tokenNumber: string, phone?: string) => {
    setSendingSmsToken(tokenNumber)
    try {
      const res = await fetch(`${API_BASE}/frontline/send-referral-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_number: tokenNumber, phone })
      })
      const data = await res.json()
      if (res.ok) {
        setSmsNotificationMsg({
          token: tokenNumber,
          text: `📲 Referral SMS dispatched successfully to +91 ${data.smsDetails?.phone || phone || 'patient'}!`
        })
        setTimeout(() => setSmsNotificationMsg(null), 4000)
      } else {
        alert(data.error || 'Failed to send SMS')
      }
    } catch {
      alert('Network error sending referral SMS')
    } finally {
      setSendingSmsToken(null)
    }
  }

  const filteredCases = cases.filter(c => {
    if (caseFilter === 'all') return true
    return c.triage_category === caseFilter
  })

  const currentFacility = facilities.find(f => f.id === selectedFacilityId) || facilities[0]

  if (loading) {
    return (
      <div className="hospital-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Frontline Health Coordinator Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="hospital-container">
      {/* Header */}
      <header className="h-header">
        <div className="h-title-group">
          <h1>👩‍⚕️ Frontline Worker · Teleconsultation & Referral Desk</h1>
          <p className="h-subtitle">
            Review AI Triaged Patients, Coordinate Care, and Allot Facility Time Slots with Token Numbers
          </p>
        </div>

        <div className="h-header-actions">
          {/* Main View Switcher */}
          <div style={{
            display: 'flex',
            background: 'hsla(0,0%,100%,0.06)',
            borderRadius: '50px',
            padding: '3px',
            border: '1px solid var(--card-border)'
          }}>
            <button
              onClick={() => setActiveView('cases')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '50px',
                border: 'none',
                background: activeView === 'cases' ? 'var(--accent)' : 'transparent',
                color: activeView === 'cases' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              📋 Triaged Cases ({cases.length})
            </button>
            <button
              onClick={() => setActiveView('facilities')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '50px',
                border: 'none',
                background: activeView === 'facilities' ? 'var(--gradient-end)' : 'transparent',
                color: activeView === 'facilities' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              🏥 Facility Live Readiness
            </button>
          </div>

          <button className="cta-btn" onClick={() => setShowRegisterModal(true)} style={{ marginLeft: '0.5rem' }}>
            ➕ Register New Patient
          </button>

          <button className="icon-btn" title="Back to Home" onClick={() => navigate('/')}>
            ⏻
          </button>
        </div>
      </header>

      {/* ================= CASES VIEW ================= */}
      {activeView === 'cases' && (
        <>
          {/* Quick Metrics Bar */}
          <div className="h-stats-grid">
            <div className="h-stat-card">
              <div className="h-stat-icon">👩‍⚕️</div>
              <div>
                <div className="h-stat-val">
                  {cases.filter(c => c.triage_category === 'teleconsultation').length}
                </div>
                <div className="h-stat-label">Teleconsultations</div>
              </div>
            </div>

            <div className="h-stat-card">
              <div className="h-stat-icon">🏥</div>
              <div>
                <div className="h-stat-val">
                  {cases.filter(c => c.triage_category === 'referral').length}
                </div>
                <div className="h-stat-label">Hospital Referrals</div>
              </div>
            </div>

            <div className="h-stat-card">
              <div className="h-stat-icon">🚨</div>
              <div>
                <div className="h-stat-val" style={{ color: 'var(--danger)' }}>
                  {cases.filter(c => c.triage_category === 'emergency').length}
                </div>
                <div className="h-stat-label">Emergency Critical</div>
              </div>
            </div>

            <div className="h-stat-card">
              <div className="h-stat-icon">✅</div>
              <div>
                <div className="h-stat-val" style={{ color: 'var(--accent)' }}>
                  {cases.filter(c => c.booked_time_slot).length}
                </div>
                <div className="h-stat-label">Time Slots Allotted</div>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="h-toolbar">
            <div className="h-filter-pills">
              <button
                className={`h-filter-btn ${caseFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCaseFilter('all')}
              >
                All Cases ({cases.length})
              </button>
              <button
                className={`h-filter-btn ${caseFilter === 'teleconsultation' ? 'active' : ''}`}
                onClick={() => setCaseFilter('teleconsultation')}
              >
                👩‍⚕️ Teleconsultations ({cases.filter(c => c.triage_category === 'teleconsultation').length})
              </button>
              <button
                className={`h-filter-btn ${caseFilter === 'referral' ? 'active' : ''}`}
                onClick={() => setCaseFilter('referral')}
              >
                🏥 Hospital Referrals ({cases.filter(c => c.triage_category === 'referral').length})
              </button>
              <button
                className={`h-filter-btn ${caseFilter === 'emergency' ? 'active' : ''}`}
                onClick={() => setCaseFilter('emergency')}
              >
                🚨 Emergency ({cases.filter(c => c.triage_category === 'emergency').length})
              </button>
            </div>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Assign slot & facility to sync directly to patient dashboard
            </span>
          </div>

          {/* Cases List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredCases.map(c => {
              const tokenDisplay = c.token_number ? `#${c.token_number}` : `#${1000 + c.id}`
              const isSlotAllotted = !!c.booked_time_slot

              return (
                <div
                  key={c.id}
                  className="p-card"
                  style={{
                    borderLeft: `4px solid ${
                      c.triage_category === 'emergency' ? 'var(--danger)' :
                      c.triage_category === 'referral' ? 'var(--gradient-end)' : 'var(--accent)'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{
                        background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
                        color: 'var(--bg-primary)',
                        padding: '0.35rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em'
                      }}>
                        TOKEN {tokenDisplay}
                      </span>

                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                          {c.patient_name || 'Patient'}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {c.patient_age} yrs · {c.patient_gender} · 📍 {c.patient_village || 'Village'}, {c.patient_district || 'District'} · 📞 {c.emergency_contact_phone || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <span className={`ref-badge ${c.triage_category === 'emergency' ? 'alert-banner' : 'pending'}`} style={{ margin: 0, padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>
                      {c.triage_category === 'emergency' ? '🚨 Emergency Critical' :
                       c.triage_category === 'referral' ? '🏥 Facility Referral' : '👩‍⚕️ Teleconsultation'}
                    </span>
                  </div>

                  {/* Clinical symptoms & Triage Summary */}
                  <div style={{ background: 'hsla(0,0%,100%,0.04)', padding: '0.9rem', borderRadius: '8px', marginBottom: '0.9rem' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                      <strong>Symptoms:</strong> {c.symptoms}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      <strong>Clinical AI Triage:</strong> {c.triage_reason}
                    </div>
                    <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
                      <span>Pain: {c.pain_level}/10</span>
                      <span>Duration: {c.symptom_duration}</span>
                      <span>Triage Score: {c.triage_score}/100</span>
                    </div>
                  </div>

                  {/* Slot Allotment Status & CTA */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                    {isSlotAllotted ? (
                      <div style={{
                        background: 'hsla(145, 65%, 48%, 0.12)',
                        border: '1px solid hsla(145, 65%, 48%, 0.35)',
                        borderRadius: '8px',
                        padding: '0.6rem 1rem',
                        fontSize: '0.88rem',
                        color: 'hsl(145, 65%, 75%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                      }}>
                        <span>✅</span>
                        <span>
                          <strong>Allotted Slot:</strong> {c.booked_time_slot} ({c.booked_date}) · <strong>{c.booked_service}</strong> at <em>{c.booked_facility}</em>
                        </span>
                      </div>
                    ) : (
                      <div style={{ color: 'hsl(38, 92%, 75%)', fontSize: '0.85rem', fontWeight: 600 }}>
                        ⏳ Time slot pending allotment for this patient
                      </div>
                    )}

                    <button
                      className="cta-btn"
                      onClick={() => openAllotModal(c)}
                      style={{
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.85rem',
                        background: isSlotAllotted ? 'hsla(0,0%,100%,0.08)' : undefined,
                        border: isSlotAllotted ? '1px solid var(--card-border)' : undefined
                      }}
                    >
                      {isSlotAllotted ? '🔄 Change Slot / Service' : '🗓️ Allot Time Slot & Facility →'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ================= FACILITIES READINESS VIEW ================= */}
      {activeView === 'facilities' && (
        <>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
              Select Hospital / Health Center:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {facilities.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFacilityId(f.id)}
                  style={{
                    background: selectedFacilityId === f.id ? 'var(--accent)' : 'hsla(0,0%,100%,0.06)',
                    color: selectedFacilityId === f.id ? 'var(--bg-primary)' : 'var(--text-primary)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🏥 {f.facility_name} ({f.district})
                </button>
              ))}
            </div>
          </div>

          <div className="h-resource-grid" style={{ marginTop: '1rem' }}>
            {(currentFacility?.resources || []).map(res => (
              <div key={res.id} className={`h-resource-card ${res.is_available ? '' : 'unavailable'}`}>
                <div>
                  <div className="h-res-header">
                    <span className="h-res-title">{res.name}</span>
                    <span className={`h-res-cat-badge badge-${res.category}`}>
                      {res.category === 'doctor' ? 'Specialist Doctor' : res.category === 'test' ? 'Diagnostic Test' : 'Equipment'}
                    </span>
                  </div>
                  <p className="h-res-desc" style={{ marginTop: '0.5rem' }}>
                    {res.description}
                  </p>
                </div>

                <div className="h-res-controls">
                  <div className="qty-counter">
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {res.category === 'doctor' ? 'Doctors Available:' : 'Available Capacity:'}
                    </span>
                    <span className="qty-display" style={{ color: res.is_available ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {res.quantity}
                    </span>
                  </div>
                  <span className={`avail-toggle ${res.is_available ? 'on' : 'off'}`} style={{ cursor: 'default' }}>
                    {res.is_available ? '● Available' : '○ Unavailable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= REGISTRATION MODAL ================= */}
      {showRegisterModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '1rem'
        }}>
          <div className="login-card" style={{ maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Register New Patient Referral</h2>
              <button className="icon-btn" onClick={() => setShowRegisterModal(false)} style={{ width: '32px', height: '32px' }}>✕</button>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="field">
                <label>Patient Full Name *</label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Lakshmi Devi"
                  value={registerForm.name}
                  onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Age *</label>
                <input
                  id="reg-age"
                  type="number"
                  placeholder="e.g. 52"
                  value={registerForm.age}
                  onChange={e => setRegisterForm({ ...registerForm, age: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="field">
                <label>Gender</label>
                <select
                  id="reg-gender"
                  value={registerForm.gender}
                  onChange={e => setRegisterForm({ ...registerForm, gender: e.target.value })}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="field">
                <label>Mobile Number (For SMS) *</label>
                <input
                  id="reg-phone"
                  type="tel"
                  placeholder="e.g. 9845123456"
                  value={registerForm.phone}
                  onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="field">
                <label>Village / Habitation</label>
                <input
                  id="reg-village"
                  type="text"
                  placeholder="e.g. Kudligi Village"
                  value={registerForm.village}
                  onChange={e => setRegisterForm({ ...registerForm, village: e.target.value })}
                />
              </div>
              <div className="field">
                <label>District</label>
                <input
                  id="reg-district"
                  type="text"
                  placeholder="Ballari"
                  value={registerForm.district}
                  onChange={e => setRegisterForm({ ...registerForm, district: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>Symptom Description *</label>
              <textarea
                id="reg-symptoms"
                rows={2}
                placeholder="Describe chief complaint, pain location, swelling, dizziness..."
                value={registerForm.symptoms}
                onChange={e => setRegisterForm({ ...registerForm, symptoms: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div className="field">
                <label>Duration of Symptoms</label>
                <input
                  id="reg-duration"
                  type="text"
                  placeholder="e.g. 3 days, 1 week"
                  value={registerForm.duration}
                  onChange={e => setRegisterForm({ ...registerForm, duration: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Symptom Type</label>
                <select
                  id="reg-newsymptom"
                  value={registerForm.isNewSymptom ? 'new' : 'existing'}
                  onChange={e => setRegisterForm({ ...registerForm, isNewSymptom: e.target.value === 'new' })}
                >
                  <option value="new">🆕 New / Acute Symptom</option>
                  <option value="existing">🔄 Already There (Recurring/Chronic)</option>
                </select>
              </div>
            </div>

            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ margin: 0 }}>Pain Intensity (1 - 10)</label>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: registerForm.painLevel >= 8 ? 'hsl(0, 72%, 58%)' : registerForm.painLevel >= 5 ? 'hsl(38, 92%, 50%)' : 'hsl(165, 72%, 40%)',
                  color: '#fff'
                }}>
                  Level {registerForm.painLevel} / 10 · {registerForm.painLevel >= 8 ? '🚨 Severe / Acute' : registerForm.painLevel >= 5 ? '⚠️ Moderate' : '🟢 Mild'}
                </span>
              </div>
              <input
                id="reg-pain"
                type="range"
                min="1"
                max="10"
                value={registerForm.painLevel}
                onChange={e => setRegisterForm({ ...registerForm, painLevel: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            <div className="field">
              <label>Additional Notes / Frontline Observations</label>
              <textarea
                id="reg-notes"
                rows={2}
                placeholder="Patient mobility, vitals taken, emergency history, etc."
                value={registerForm.additionalNotes}
                onChange={e => setRegisterForm({ ...registerForm, additionalNotes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
              <button
                id="reg-submit-btn"
                className="cta-btn"
                onClick={() => handleRegisterPatientCase()}
                disabled={registering}
                style={{ flex: 1 }}
              >
                {registering ? 'Triage & Registering…' : 'Register Referral & Generate QR →'}
              </button>
              <button
                className="cta-btn"
                onClick={() => setShowRegisterModal(false)}
                style={{ flex: 1, background: 'var(--card-border)' }}
              >
                Cancel
              </button>
            </div>

            {registerSuccessData && (
              <div style={{
                textAlign: 'center',
                marginTop: '1.5rem',
                padding: '1.2rem',
                background: 'hsla(165, 72%, 52%, 0.08)',
                border: '1px solid var(--accent)',
                borderRadius: '12px'
              }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>🎉</div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)', fontSize: '1.1rem' }}>
                  Referral Created Successfully!
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Token: <strong>#{registerSuccessData.tokenNumber || (1000 + (registerSuccessData.referralId || registerSuccessData.id))}</strong>
                  {registerSuccessData.patient?.name ? ` · ${registerSuccessData.patient.name}` : ''}
                </p>

                <div style={{
                  display: 'inline-block',
                  padding: '12px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  marginBottom: '1rem'
                }}>
                  <QRCodeSVG
                    value={`${window.location.origin}/referral/${registerSuccessData.referralId || registerSuccessData.id || registerSuccessData.tokenNumber}`}
                    size={180}
                  />
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
                  Scan the QR code above or use this direct verification link:
                </p>

                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                  marginBottom: '1rem',
                  border: '1px solid var(--card-border)'
                }}>
                  <a
                    href={`${window.location.origin}/referral/${registerSuccessData.referralId || registerSuccessData.id || registerSuccessData.tokenNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                  >
                    {`${window.location.origin}/referral/${registerSuccessData.referralId || registerSuccessData.id || registerSuccessData.tokenNumber}`}
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="view-btn"
                    onClick={() => window.open(`/referral/${registerSuccessData.referralId || registerSuccessData.id || registerSuccessData.tokenNumber}`, '_blank')}
                  >
                    Open Tracking Page ↗
                  </button>
                  <button
                    type="button"
                    className="view-btn"
                    style={{ background: 'hsla(0,0%,100%,0.1)', color: '#fff' }}
                    onClick={() => {
                      setRegisterSuccessData(null)
                      setShowRegisterModal(false)
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SLOT ALLOTMENT MODAL ================= */}
      {allotModalCase && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 150,
          padding: '1rem'
        }}>
          <div className="login-card" style={{ maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Allot Time Slot · Token #{allotModalCase.token_number || (1000 + allotModalCase.id)}
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Patient: <strong>{allotModalCase.patient_name}</strong> · {allotModalCase.symptoms}
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setAllotModalCase(null)}
                style={{ width: '32px', height: '32px' }}
              >
                ✕
              </button>
            </div>

            {allotMessage && (
              <div style={{
                padding: '0.8rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.88rem',
                background: allotMessage.type === 'error' ? 'hsla(0, 72%, 58%, 0.15)' : 'hsla(145, 65%, 48%, 0.15)',
                border: `1px solid ${allotMessage.type === 'error' ? 'hsla(0, 72%, 58%, 0.4)' : 'hsla(145, 65%, 48%, 0.4)'}`,
                color: allotMessage.type === 'error' ? 'hsl(0, 72%, 75%)' : 'hsl(145, 65%, 75%)'
              }}>
                {allotMessage.text}
              </div>
            )}

            {/* Step 1: Select Facility */}
            <div className="field">
              <label>1. Select Healthcare Facility</label>
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
                value={selectedFacilityId || ''}
                onChange={e => setSelectedFacilityId(parseInt(e.target.value, 10))}
              >
                {facilities.map(f => (
                  <option key={f.id} value={f.id} style={{ background: '#1c2230' }}>
                    🏥 {f.facility_name} ({f.facility_type} · {f.district})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Service / Test / Doctor */}
            <div className="field">
              <label>2. Select Required Service, Diagnostic Test, or Specialist Doctor</label>
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
                value={selectedService}
                onChange={e => setSelectedService(e.target.value)}
              >
                {(currentFacility?.resources || []).map(r => (
                  <option key={r.id} value={r.name} style={{ background: '#1c2230' }}>
                    {r.category === 'doctor' ? '👨‍⚕️ Doctor: ' : r.category === 'test' ? '🔬 Lab Test: ' : '🛏️ Equipment: '}
                    {r.name} ({r.is_available ? `Available · ${r.quantity} on duty` : 'Unavailable'})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Select Date */}
            <div className="field">
              <label>3. Appointment Date</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Step 4: Time Slot Selection with Live Availability */}
            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ margin: 0 }}>4. Choose 20-Minute Time Slot</label>
                {slotsData && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                    🟢 {slotsData.availableCount} Available · 🔴 {slotsData.filledCount} Booked
                  </span>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '0.5rem',
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '0.5rem',
                background: 'hsla(0,0%,100%,0.03)',
                borderRadius: '8px',
                border: '1px solid var(--card-border)'
              }}>
                {(slotsData?.slots || []).map(s => {
                  const isSelected = selectedSlot === s.slot
                  return (
                    <button
                      key={s.slot}
                      type="button"
                      disabled={!s.isAvailable}
                      onClick={() => setSelectedSlot(s.slot)}
                      style={{
                        padding: '0.5rem 0.4rem',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                        background: !s.isAvailable
                          ? 'hsla(0, 72%, 58%, 0.12)'
                          : isSelected
                          ? 'var(--accent)'
                          : 'hsla(0,0%,100%,0.06)',
                        color: !s.isAvailable
                          ? 'hsl(0, 72%, 75%)'
                          : isSelected
                          ? 'var(--bg-primary)'
                          : 'var(--text-primary)',
                        cursor: s.isAvailable ? 'pointer' : 'not-allowed',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        alignItems: 'center'
                      }}
                    >
                      <span>{s.slot}</span>
                      {!s.isAvailable ? (
                        <span style={{ fontSize: '0.68rem', color: 'hsl(0, 72%, 75%)' }}>
                          🔴 Token #{s.bookedBy?.token}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: isSelected ? 'var(--bg-primary)' : 'var(--accent)' }}>
                          🟢 Available
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedSlot && (
              <div style={{
                background: 'hsla(165, 72%, 52%, 0.12)',
                border: '1px solid var(--accent)',
                borderRadius: '8px',
                padding: '0.8rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: 'var(--accent)'
              }}>
                🎯 <strong>Selected Slot:</strong> {selectedSlot} on {selectedDate} for <strong>{selectedService}</strong> at {currentFacility?.facility_name}.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="view-btn"
                style={{ background: 'hsla(0,0%,100%,0.08)', color: '#fff' }}
                onClick={() => setAllotModalCase(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="view-btn"
                disabled={!selectedSlot || bookingLoading}
                onClick={handleConfirmAllot}
              >
                {bookingLoading ? 'Allotting Slot...' : 'Confirm & Allot Time Slot →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
