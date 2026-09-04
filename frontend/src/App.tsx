import { useNavigate } from 'react-router-dom'
import './App.css'

type Role = 'patient' | 'frontline' | 'hospital' | 'district'

interface RoleOption {
  id: Role
  label: string
  icon: string
  route: string
}

const roles: RoleOption[] = [
  { id: 'patient',   label: 'Patient',         icon: '🩺', route: '/login/patient'   },
  { id: 'frontline', label: 'Frontline Worker', icon: '👩‍⚕️', route: '/login/frontline' },
  { id: 'hospital',  label: 'Hospital Admin',   icon: '🏥', route: '/login/hospital'  },
  { id: 'district',  label: 'District Admin',   icon: '📊', route: '/login/district'  },
]

export default function App() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="brand-icon">⚕</div>
        <h1 className="title">VARADHI</h1>
        <p className="tagline">Bridging Rural Healthcare · Connecting Care. Completing Journeys.</p>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
          Who are you?
        </p>

        <div className="role-grid">
          {roles.map((r) => (
            <button
              key={r.id}
              className="role-btn"
              onClick={() => navigate(r.route)}
            >
              <span className="icon">{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
