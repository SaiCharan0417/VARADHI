import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import { API_BASE } from '../config'

export default function DistrictLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ adminId: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/auth/district/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: form.adminId.trim(),
          password: form.password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Invalid Admin ID or Password')
      }

      localStorage.setItem('varadhi_token', data.token)
      localStorage.setItem('varadhi_user', JSON.stringify({ ...data.admin, role: 'district' }))

      navigate('/district/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setForm({
      adminId: 'DA-KA-2024-001',
      password: 'district123'
    })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>

        <div className="role-badge">📊 District Admin Portal</div>
        <h1 className="login-title">Admin Sign In</h1>
        <p className="login-subtitle">Monitor and coordinate district-wide healthcare</p>

        {error && (
          <div style={{
            background: 'hsla(0, 72%, 58%, 0.15)',
            border: '1px solid hsla(0, 72%, 58%, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'hsl(0, 72%, 68%)',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Admin Identification Number</label>
            <input
              type="text"
              placeholder="e.g. DA-KA-2024-001"
              value={form.adminId}
              onChange={e => setForm({ ...form, adminId: e.target.value })}
              required
            />
            <p className="helper-text">Issued by the State Health Department</p>
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>

        <div style={{ marginTop: '1.2rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={fillDemo}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            ⚡ Auto-fill District Admin Demo Credentials
          </button>
        </div>
      </div>
    </div>
  )
}
