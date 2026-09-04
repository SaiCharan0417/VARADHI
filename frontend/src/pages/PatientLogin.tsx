import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import { API_BASE } from '../config'

type Mode = 'signin' | 'signup'

export default function PatientLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [form, setForm] = useState({ username: '', password: '', aadhar: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'warning', text: string } | null>(null)

  // Check Aadhar on blur during signup
  const checkAadharExists = async (aadharVal: string) => {
    const clean = aadharVal.replace(/\s+/g, '')
    if (clean.length === 12) {
      try {
        const res = await fetch(`${API_BASE}/auth/check-aadhar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aadhar: aadharVal })
        })
        const data = await res.json()
        if (data.exists) {
          setMessage({
            type: 'warning',
            text: '⚠️ This Aadhar is already registered in VARADHI! Please sign in.'
          })
          setMode('signin')
        }
      } catch (err) {
        console.error('Aadhar check error:', err)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    try {
      const endpoint = mode === 'signup' ? '/auth/patient/signup' : '/auth/patient/signin'
      const payload = mode === 'signup' 
        ? { username: form.username, password: form.password, aadhar: form.aadhar }
        : { username: form.username, password: form.password }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.shouldSignIn) {
          setMessage({ type: 'warning', text: data.error })
          setMode('signin')
        } else {
          setMessage({ type: 'error', text: data.error || 'Request failed' })
        }
        setLoading(false)
        return
      }

      // Save token and profile status
      localStorage.setItem('varadhi_token', data.token)
      localStorage.setItem('varadhi_user', JSON.stringify(data.patient))

      if (mode === 'signup' || !data.patient.profile_complete) {
        navigate('/patient/profile-setup')
      } else {
        navigate('/patient/dashboard')
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server connection failed. Please ensure backend is running.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to Home</button>

        <div className="role-badge">🩺 Patient Portal</div>
        <h1 className="login-title">{mode === 'signin' ? 'Welcome Back' : 'Patient Registration'}</h1>
        <p className="login-subtitle">
          {mode === 'signin'
            ? 'Sign in to track your health journey & referrals'
            : 'Register with your Aadhar to access rural healthcare services'}
        </p>

        {/* Tab Switcher */}
        <div className="tab-switcher">
          <button 
            type="button"
            className={`tab-btn ${mode === 'signin' ? 'active' : ''}`} 
            onClick={() => { setMode('signin'); setMessage(null) }}
          >
            Sign In
          </button>
          <button 
            type="button"
            className={`tab-btn ${mode === 'signup' ? 'active' : ''}`} 
            onClick={() => { setMode('signup'); setMessage(null) }}
          >
            Sign Up
          </button>
        </div>

        {mode === 'signin' && (
          <button
            type="button"
            className="demo-btn"
            style={{ marginBottom: '1rem', width: '100%', padding: '0.5rem', fontSize: '0.82rem', borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => setForm({ username: 'sunita_devi', password: 'patient123', aadhar: '' })}
          >
            ⚡ Use Demo Patient (Sunita Devi)
          </button>
        )}

        {message && (
          <div style={{
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.2rem',
            fontSize: '0.88rem',
            background: message.type === 'error' ? 'hsla(0, 72%, 58%, 0.15)' : 'hsla(38, 92%, 55%, 0.15)',
            border: `1px solid ${message.type === 'error' ? 'hsla(0, 72%, 58%, 0.4)' : 'hsla(38, 92%, 55%, 0.4)'}`,
            color: message.type === 'error' ? 'hsl(0, 72%, 75%)' : 'hsl(38, 92%, 75%)'
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input
              type="text"
              placeholder="e.g. ramesh_patil"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="field">
              <label>Aadhar Card Number</label>
              <input
                type="text"
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                value={form.aadhar}
                onBlur={() => checkAadharExists(form.aadhar)}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 12)
                  const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
                  setForm({ ...form, aadhar: formatted })
                  if (formatted.replace(/\s+/g, '').length === 12) {
                    checkAadharExists(formatted)
                  }
                }}
                required
              />
              <p className="helper-text">Verified against database to prevent duplicate registrations</p>
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder={mode === 'signup' ? 'Create a secure password' : 'Enter your password'}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : (mode === 'signin' ? 'Sign In →' : 'Continue to Profile Setup →')}
          </button>
        </form>
      </div>
    </div>
  )
}
