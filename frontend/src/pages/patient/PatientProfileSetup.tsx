import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Patient.css'
import { API_BASE } from '../../config'

export default function PatientProfileSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    village: '',
    district: '',
    state: 'Karnataka',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('varadhi_token')
    if (!token) {
      navigate('/login/patient')
      return
    }

    // Pre-fetch if existing
    fetch(`${API_BASE}/patient/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          setForm({
            name: data.name || '',
            age: data.age?.toString() || '',
            gender: data.gender || 'Male',
            village: data.village || '',
            district: data.district || '',
            state: data.state || 'Karnataka',
            emergency_contact_name: data.emergency_contact_name || '',
            emergency_contact_phone: data.emergency_contact_phone || ''
          })
        }
      })
      .catch(() => {})
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const token = localStorage.getItem('varadhi_token')
    if (!token) {
      navigate('/login/patient')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/patient/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update profile')
        setLoading(false)
        return
      }

      // Updated successfully, navigate to patient dashboard
      navigate('/patient/dashboard')
    } catch (err) {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: '520px' }}>
        <button className="back-btn" onClick={() => navigate('/login/patient')}>← Back</button>

        <div className="role-badge">📝 Profile Setup</div>
        <h1 className="login-title">Create Patient Profile</h1>
        <p className="login-subtitle">
          Complete your medical profile to enable personalized care journeys and AI triage
        </p>

        {error && (
          <div style={{
            padding: '0.8rem',
            borderRadius: '8px',
            background: 'hsla(0, 72%, 58%, 0.15)',
            border: '1px solid hsla(0, 72%, 58%, 0.4)',
            color: 'hsl(0, 72%, 75%)',
            marginBottom: '1rem',
            fontSize: '0.88rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Chandra Patil"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div className="field">
              <label>Age</label>
              <input
                type="number"
                min="1"
                max="120"
                placeholder="e.g. 45"
                value={form.age}
                onChange={e => setForm({ ...form, age: e.target.value })}
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
                  padding: '0.75rem 1rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  fontFamily: 'var(--font)',
                  outline: 'none'
                }}
                value={form.gender}
                onChange={e => setForm({ ...form, gender: e.target.value })}
              >
                <option value="Male" style={{ background: '#1c2230', color: '#fff' }}>Male</option>
                <option value="Female" style={{ background: '#1c2230', color: '#fff' }}>Female</option>
                <option value="Other" style={{ background: '#1c2230', color: '#fff' }}>Other</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div className="field">
              <label>Village / Location</label>
              <input
                type="text"
                placeholder="e.g. Rampura Village"
                value={form.village}
                onChange={e => setForm({ ...form, village: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label>District</label>
              <input
                type="text"
                placeholder="e.g. Ballari"
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>State</label>
            <input
              type="text"
              placeholder="e.g. Karnataka"
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
              required
            />
          </div>

          <div style={{ margin: '1.2rem 0 0.6rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🚨 Emergency Contact
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div className="field">
              <label>Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Suresh (Son)"
                value={form.emergency_contact_name}
                onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                maxLength={10}
                value={form.emergency_contact_phone}
                onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value.replace(/\D/g, '') })}
                required
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading} style={{ marginTop: '1.2rem' }}>
            {loading ? 'Saving Profile...' : 'Save Profile & Go to Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  )
}
