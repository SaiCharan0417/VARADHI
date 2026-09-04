import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import { API_BASE } from '../config'

export default function HospitalLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ facilityCode: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/auth/hospital/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        setLoading(false)
        return
      }

      localStorage.setItem('varadhi_token', data.token)
      localStorage.setItem('varadhi_role', 'hospital')
      localStorage.setItem('varadhi_hospital', JSON.stringify(data.hospital))
      navigate('/hospital/dashboard')
    } catch (err) {
      setError('Cannot connect to server. Please check backend status.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setForm({
      facilityCode: 'HF-KA-2024-0056',
      password: 'hospital123'
    })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>

        <div className="role-badge">🏥 Hospital Admin Portal</div>
        <h1 className="login-title">Facility Sign In</h1>
        <p className="login-subtitle">Manage facility readiness, equipment, beds & doctor availability</p>

        {error && (
          <div style={{
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.2rem',
            fontSize: '0.88rem',
            background: 'hsla(0, 72%, 58%, 0.15)',
            border: '1px solid hsla(0, 72%, 58%, 0.4)',
            color: 'hsl(0, 72%, 75%)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Unique Facility Code</label>
            <input
              type="text"
              placeholder="e.g. HF-KA-2024-0056"
              value={form.facilityCode}
              onChange={e => setForm({ ...form, facilityCode: e.target.value })}
              required
            />
            <p className="helper-text">Assigned by District Health Authority</p>
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter facility password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Dashboard →'}
          </button>

          <div style={{ marginTop: '1.2rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={fillDemo}
              style={{
                background: 'hsla(165, 72%, 52%, 0.12)',
                border: '1px dashed var(--accent)',
                color: 'var(--accent)',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⚡ Fill Demo Facility (Ballari District Hospital)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
