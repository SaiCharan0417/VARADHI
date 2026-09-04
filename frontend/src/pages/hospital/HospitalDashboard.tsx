import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Hospital.css'
import { API_BASE } from '../../config'

interface FacilityResource {
  id: number
  facility_id: number
  category: 'equipment' | 'test' | 'doctor' | 'other'
  name: string
  description: string
  quantity: number
  is_available: number
  updated_at: string
}

interface FacilityInfo {
  id: number
  facility_code: string
  facility_name: string
  facility_type: string
  district: string
  bed_capacity: number
}

interface AppointmentInfo {
  id: number
  token_number: string
  patient_id: number
  patient_name: string
  village: string
  emergency_contact_phone: string
  service_name: string
  appointment_date: string
  time_slot: string
  status: string
  instructions: string
  allotted_by: string
  symptoms: string
  triage_category: string
}

// Preset Doctor types
const DOCTOR_PRESETS = [
  {
    name: 'Cardiologist',
    category: 'doctor' as const,
    description: 'Treat heart and blood vessel conditions like high blood pressure and heart failure.'
  },
  {
    name: 'Dermatologist',
    category: 'doctor' as const,
    description: 'Treat skin, hair, and nail problems such as acne and skin cancer.'
  },
  {
    name: 'Endocrinologist',
    category: 'doctor' as const,
    description: 'Manage hormone and metabolism disorders like diabetes and thyroid disease.'
  },
  {
    name: 'Gastroenterologist',
    category: 'doctor' as const,
    description: 'Treat digestive system issues involving the stomach, intestines, and liver.'
  },
  {
    name: 'Neurologist',
    category: 'doctor' as const,
    description: 'Focus on disorders of the brain, spinal cord, and nervous system.'
  },
  {
    name: 'Oncologist',
    category: 'doctor' as const,
    description: 'Diagnose and treat cancer using chemotherapy, radiation, or other therapies.'
  },
  {
    name: 'Pediatrician',
    category: 'doctor' as const,
    description: 'Provide medical care for infants, children, and teens.'
  },
  {
    name: 'Pulmonologist',
    category: 'doctor' as const,
    description: 'Specialize in lung and respiratory conditions like asthma and pneumonia.'
  },
  {
    name: 'Psychiatrist',
    category: 'doctor' as const,
    description: 'Diagnose and treat mental health and emotional disorders.'
  }
]

export default function HospitalDashboard() {
  const navigate = useNavigate()
  const [facility, setFacility] = useState<FacilityInfo | null>(null)
  const [resources, setResources] = useState<FacilityResource[]>([])
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [mainTab, setMainTab] = useState<'resources' | 'appointments'>('resources')
  const [filter, setFilter] = useState<'all' | 'equipment' | 'test' | 'doctor'>('all')
  const [viewMode, setViewMode] = useState<'admin' | 'frontline_preview'>('admin')

  // Add Resource Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    category: 'doctor' as 'equipment' | 'test' | 'doctor' | 'other',
    name: '',
    description: '',
    quantity: 1,
    is_available: true
  })
  const [submittingAdd, setSubmittingAdd] = useState(false)

  const token = localStorage.getItem('varadhi_token')

  const fetchResources = async () => {
    if (!token) {
      navigate('/login/hospital')
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/hospital/resources`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        localStorage.removeItem('varadhi_token')
        navigate('/login/hospital')
        return
      }

      const data = await res.json()
      setFacility(data.facility)
      setResources(data.resources || [])
      setAppointments(data.appointments || [])
    } catch (err) {
      console.error('Error fetching facility resources:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('varadhi_token')
    localStorage.removeItem('varadhi_role')
    localStorage.removeItem('varadhi_hospital')
    navigate('/')
  }

  // Live Quantity Change (+ or -)
  const handleQuantityChange = async (resId: number, currentQty: number, delta: number) => {
    if (viewMode !== 'admin') return
    const newQty = Math.max(0, currentQty + delta)

    setResources(prev => prev.map(r => r.id === resId ? { ...r, quantity: newQty } : r))

    try {
      await fetch(`${API_BASE}/hospital/resources/${resId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: newQty })
      })
    } catch (err) {
      fetchResources()
    }
  }

  // Toggle Availability
  const handleToggleAvailability = async (resId: number, currentAvail: number) => {
    if (viewMode !== 'admin') return
    const nextAvail = currentAvail === 1 ? 0 : 1

    setResources(prev => prev.map(r => r.id === resId ? { ...r, is_available: nextAvail } : r))

    try {
      await fetch(`${API_BASE}/hospital/resources/${resId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_available: nextAvail === 1 })
      })
    } catch (err) {
      fetchResources()
    }
  }

  // Delete Resource
  const handleDeleteResource = async (resId: number, name: string) => {
    if (viewMode !== 'admin') return
    if (!window.confirm(`Are you sure you want to remove "${name}" from this facility?`)) return

    setResources(prev => prev.filter(r => r.id !== resId))

    try {
      await fetch(`${API_BASE}/hospital/resources/${resId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (err) {
      fetchResources()
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingAdd(true)

    try {
      const res = await fetch(`${API_BASE}/hospital/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(addForm)
      })

      if (res.ok) {
        setShowAddModal(false)
        setAddForm({
          category: 'doctor',
          name: '',
          description: '',
          quantity: 1,
          is_available: true
        })
        fetchResources()
      } else {
        const errData = await res.json()
        alert(errData.error || 'Failed to add resource')
      }
    } catch (err) {
      alert('Error adding resource')
    } finally {
      setSubmittingAdd(false)
    }
  }

  const filteredResources = resources.filter(r => {
    if (filter === 'all') return true
    return r.category === filter
  })

  // Quick statistics
  const totalBeds = resources
    .filter(r => r.category === 'equipment' && r.name.toLowerCase().includes('bed'))
    .reduce((sum, r) => sum + (r.is_available ? r.quantity : 0), 0)

  const oxygenUnits = resources
    .filter(r => r.category === 'equipment' && r.name.toLowerCase().includes('oxygen'))
    .reduce((sum, r) => sum + (r.is_available ? r.quantity : 0), 0)

  const testCount = resources.filter(r => r.category === 'test' && r.is_available).length
  const doctorCount = resources
    .filter(r => r.category === 'doctor' && r.is_available)
    .reduce((sum, r) => sum + r.quantity, 0)

  if (loading && !facility) {
    return (
      <div className="hospital-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading hospital dashboard...</p>
      </div>
    )
  }

  return (
    <div className="hospital-container">
      {/* Top Header */}
      <header className="h-header">
        <div className="h-title-group">
          <h1>{facility?.facility_name || 'Hospital Resource Center'}</h1>
          <p className="h-subtitle">
            Facility Code: <strong>{facility?.facility_code}</strong> · {facility?.facility_type} · {facility?.district || 'Ballari'}
          </p>
        </div>

        <div className="h-header-actions">
          {/* Main Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'hsla(0,0%,100%,0.06)',
            borderRadius: '50px',
            padding: '3px',
            border: '1px solid var(--card-border)'
          }}>
            <button
              onClick={() => setMainTab('resources')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '50px',
                border: 'none',
                background: mainTab === 'resources' ? 'var(--accent)' : 'transparent',
                color: mainTab === 'resources' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              🛠️ Services & Readiness ({resources.length})
            </button>
            <button
              onClick={() => setMainTab('appointments')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '50px',
                border: 'none',
                background: mainTab === 'appointments' ? 'var(--gradient-end)' : 'transparent',
                color: mainTab === 'appointments' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              📅 Allotted Patient Slots ({appointments.length})
            </button>
          </div>

          {/* Mode Switcher: Admin Edit vs Frontline View */}
          <div style={{
            display: 'flex',
            background: 'hsla(0,0%,100%,0.06)',
            borderRadius: '50px',
            padding: '3px',
            border: '1px solid var(--card-border)'
          }}>
            <button
              onClick={() => setViewMode('admin')}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '50px',
                border: 'none',
                background: viewMode === 'admin' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'admin' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Admin (Edit)
            </button>
            <button
              onClick={() => setViewMode('frontline_preview')}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '50px',
                border: 'none',
                background: viewMode === 'frontline_preview' ? 'var(--gradient-end)' : 'transparent',
                color: viewMode === 'frontline_preview' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Frontline (View)
            </button>
          </div>

          <button className="icon-btn" title="Sign Out" onClick={handleLogout}>
            ⏻
          </button>
        </div>
      </header>

      {/* Live Stat Cards */}
      <div className="h-stats-grid">
        <div className="h-stat-card">
          <div className="h-stat-icon">🛏️</div>
          <div>
            <div className="h-stat-val">{totalBeds}</div>
            <div className="h-stat-label">Available Beds (Gen/ICU)</div>
          </div>
        </div>

        <div className="h-stat-card">
          <div className="h-stat-icon">🫧</div>
          <div>
            <div className="h-stat-val">{oxygenUnits}</div>
            <div className="h-stat-label">Oxygen Units & Tanks</div>
          </div>
        </div>

        <div className="h-stat-card">
          <div className="h-stat-icon">🔬</div>
          <div>
            <div className="h-stat-val">{testCount}</div>
            <div className="h-stat-label">Diagnostic Tests Active</div>
          </div>
        </div>

        <div className="h-stat-card">
          <div className="h-stat-icon">👨‍⚕️</div>
          <div>
            <div className="h-stat-val">{doctorCount}</div>
            <div className="h-stat-label">Specialist Doctors on Duty</div>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: SERVICES & READINESS ================= */}
      {mainTab === 'resources' && (
        <>
          {/* Toolbar: Category Filters & Add Resource CTA */}
          <div className="h-toolbar">
            <div className="h-filter-pills">
              <button
                className={`h-filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Services ({resources.length})
              </button>
              <button
                className={`h-filter-btn ${filter === 'equipment' ? 'active' : ''}`}
                onClick={() => setFilter('equipment')}
              >
                🛏️ Beds & Equipment ({resources.filter(r => r.category === 'equipment').length})
              </button>
              <button
                className={`h-filter-btn ${filter === 'test' ? 'active' : ''}`}
                onClick={() => setFilter('test')}
              >
                🔬 Diagnostic Tests ({resources.filter(r => r.category === 'test').length})
              </button>
              <button
                className={`h-filter-btn ${filter === 'doctor' ? 'active' : ''}`}
                onClick={() => setFilter('doctor')}
              >
                👨‍⚕️ Doctors & Specialists ({resources.filter(r => r.category === 'doctor').length})
              </button>
            </div>

            {viewMode === 'admin' && (
              <button className="h-add-btn" onClick={() => setShowAddModal(true)}>
                + Add Facility Service / Doctor
              </button>
            )}
          </div>

          {/* Resources & Doctors Grid */}
          <div className="h-resource-grid">
            {filteredResources.map(res => (
              <div
                key={res.id}
                className={`h-resource-card ${res.is_available ? '' : 'unavailable'}`}
              >
                <div>
                  <div className="h-res-header">
                    <span className="h-res-title">{res.name}</span>
                    <span className={`h-res-cat-badge badge-${res.category}`}>
                      {res.category === 'doctor' ? 'Doctor' : res.category === 'test' ? 'Diagnostic Test' : 'Equipment'}
                    </span>
                  </div>

                  <p className="h-res-desc" style={{ marginTop: '0.5rem' }}>
                    {res.description}
                  </p>
                </div>

                {/* Controls Bar */}
                <div className="h-res-controls">
                  <div className="qty-counter">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '4px' }}>
                      {res.category === 'doctor' ? 'Doctors:' : res.category === 'test' ? 'Labs:' : 'Quantity:'}
                    </span>

                    {viewMode === 'admin' ? (
                      <>
                        <button
                          className="qty-btn"
                          onClick={() => handleQuantityChange(res.id, res.quantity, -1)}
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="qty-display">{res.quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => handleQuantityChange(res.id, res.quantity, 1)}
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <span className="qty-display" style={{ color: 'var(--accent)' }}>{res.quantity} units</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {viewMode === 'admin' ? (
                      <button
                        className={`avail-toggle ${res.is_available ? 'on' : 'off'}`}
                        onClick={() => handleToggleAvailability(res.id, res.is_available)}
                      >
                        {res.is_available ? '● Available' : '○ Unavailable'}
                      </button>
                    ) : (
                      <span className={`avail-toggle ${res.is_available ? 'on' : 'off'}`} style={{ cursor: 'default' }}>
                        {res.is_available ? '● Available' : '○ Unavailable'}
                      </span>
                    )}

                    {viewMode === 'admin' && (
                      <button
                        className="del-btn"
                        title="Delete Service"
                        onClick={() => handleDeleteResource(res.id, res.name)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ================= TAB 2: ALLOTTED PATIENT SLOTS & SERVICE USAGE ================= */}
      {mainTab === 'appointments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="h-toolbar">
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Live Patient Arrivals & Scheduled Service Usage
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Track patients utilizing lab tests, consultations, and beds by their unique Token Numbers
              </p>
            </div>
            <span style={{
              background: 'hsla(145, 65%, 48%, 0.15)',
              border: '1px solid hsla(145, 65%, 48%, 0.4)',
              color: 'hsl(145, 65%, 65%)',
              padding: '0.35rem 0.8rem',
              borderRadius: '50px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}>
              🟢 {appointments.length} Total Booked Slots
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="p-card empty-state">
              <div className="empty-icon">📅</div>
              <div className="empty-title">No Slots Currently Booked</div>
              <div className="empty-sub">
                Frontline health workers will allot teleconsultation and referral patient slots to this facility.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {appointments.map(app => (
                <div key={app.id} className="p-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
                      color: 'var(--bg-primary)',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 800
                    }}>
                      TOKEN #{app.token_number}
                    </span>
                    <span className="ref-badge completed" style={{ margin: 0, padding: '0.2rem 0.6rem' }}>
                      ● Slot Confirmed
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.2rem' }}>
                    {app.patient_name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.8rem' }}>
                    📍 {app.village || 'Village'} · 📞 {app.emergency_contact_phone || 'N/A'}
                  </p>

                  <div style={{ background: 'hsla(0,0%,100%,0.04)', padding: '0.8rem', borderRadius: '8px', marginBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Service:</span>
                      <strong style={{ color: 'var(--accent)' }}>{app.service_name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Time Slot:</span>
                      <strong>{app.time_slot}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Date:</span>
                      <span>{app.appointment_date}</span>
                    </div>
                  </div>

                  {app.symptoms && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      <strong>Symptoms:</strong> {app.symptoms}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= ADD SERVICE / DOCTOR MODAL ================= */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 120,
          padding: '1rem'
        }}>
          <div className="login-card" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Add Facility Service / Doctor</h2>
              <button className="icon-btn" onClick={() => setShowAddModal(false)} style={{ width: '32px', height: '32px' }}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em' }}>
                ⚡ Quick Select Specialist Doctor:
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {DOCTOR_PRESETS.map(doc => (
                  <button
                    key={doc.name}
                    type="button"
                    onClick={() => {
                      setAddForm({
                        category: 'doctor',
                        name: doc.name,
                        description: doc.description,
                        quantity: 1,
                        is_available: true
                      })
                    }}
                    style={{
                      background: addForm.name === doc.name ? 'var(--accent)' : 'hsla(0,0%,100%,0.06)',
                      color: addForm.name === doc.name ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '50px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + {doc.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="field">
                <label>Category</label>
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
                  value={addForm.category}
                  onChange={e => setAddForm({ ...addForm, category: e.target.value as any })}
                >
                  <option value="doctor" style={{ background: '#1c2230' }}>Specialist Doctor</option>
                  <option value="equipment" style={{ background: '#1c2230' }}>Beds & Medical Equipment</option>
                  <option value="test" style={{ background: '#1c2230' }}>Diagnostic / Laboratory Test</option>
                  <option value="other" style={{ background: '#1c2230' }}>Other Hospital Service</option>
                </select>
              </div>

              <div className="field">
                <label>Service / Specialist Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cardiologist, ICU Beds, Digital X-Ray..."
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label>Description & Scope of Care</label>
                <textarea
                  style={{
                    width: '100%',
                    background: 'hsla(0,0%,100%,0.06)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font)',
                    fontSize: '0.88rem',
                    minHeight: '60px',
                    outline: 'none'
                  }}
                  placeholder="Details regarding medical treatments, diagnostic coverage, or operational hours"
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div className="field">
                  <label>Initial Quantity / Count</label>
                  <input
                    type="number"
                    min="1"
                    value={addForm.quantity}
                    onChange={e => setAddForm({ ...addForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    required
                  />
                </div>

                <div className="field">
                  <label>Initial Status</label>
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
                    value={addForm.is_available ? '1' : '0'}
                    onChange={e => setAddForm({ ...addForm, is_available: e.target.value === '1' })}
                  >
                    <option value="1" style={{ background: '#1c2230' }}>Available</option>
                    <option value="0" style={{ background: '#1c2230' }}>Unavailable</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
                <button
                  type="button"
                  className="view-btn"
                  style={{ background: 'hsla(0,0%,100%,0.08)', color: '#fff' }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="view-btn" disabled={submittingAdd}>
                  {submittingAdd ? 'Saving...' : 'Add to Hospital Services →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
