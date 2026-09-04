import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

export default function FrontlineLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ workerId: 'FW-2024-00123', password: 'workerpassword' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('varadhi_role', 'frontline')
    localStorage.setItem('varadhi_worker_id', form.workerId)
    navigate('/frontline/dashboard')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>

        <div className="role-badge">👩‍⚕️ Frontline Worker Portal</div>
        <h1 className="login-title">Worker Sign In</h1>
        <p className="login-subtitle">Inspect real-time facility readiness, hospital beds & specialist doctors</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Worker ID</label>
            <input
              type="text"
              placeholder="e.g. FW-2024-00123"
              value={form.workerId}
              onChange={e => setForm({ ...form, workerId: e.target.value })}
              required
            />
            <p className="helper-text">Issued by district health administration</p>
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="submit-btn">Sign In to Dashboard →</button>
        </form>
      </div>
    </div>
  )
}
