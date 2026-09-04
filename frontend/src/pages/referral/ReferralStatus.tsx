import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import '../hospital/Hospital.css'
import { API_BASE } from '../../config'

interface ReferralData {
  id: number
  token_number: string
  patient_name: string
  patient_age: number
  patient_gender: string
  patient_village: string
  patient_district: string
  symptoms: string
  symptom_duration: string
  pain_level: number
  triage_category: string
  triage_reason: string
  triage_score: number
  status: string
  created_at: string
  booked_time_slot?: string
  booked_date?: string
  booked_service?: string
  booked_facility?: string
}

const statusSteps = [
  { key: 'registered', label: 'Registered', icon: '📝' },
  { key: 'triaged', label: 'AI Triaged', icon: '🤖' },
  { key: 'slot_allotted', label: 'Slot Allotted', icon: '🗓️' },
  { key: 'visited', label: 'Visited Facility', icon: '🏥' },
  { key: 'completed', label: 'Completed', icon: '✅' },
]

function getStepIndex(status: string, hasSlot: boolean): number {
  if (status === 'completed') return 4
  if (status === 'visited') return 3
  if (hasSlot) return 2
  if (status === 'triaged' || status === 'pending') return 1
  return 0
}

export default function ReferralStatus() {
  const { id } = useParams<{ id: string }>()
  const [referral, setReferral] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('No referral ID provided.')
      setLoading(false)
      return
    }

    const fetchReferral = async () => {
      try {
        const res = await fetch(`${API_BASE}/referral/${id}`)
        if (!res.ok) {
          setError('Referral not found. Please verify the QR code or contact your frontline worker.')
          setLoading(false)
          return
        }
        const data = await res.json()
        setReferral(data)
      } catch {
        setError('Unable to load referral data. Please check your internet connection and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchReferral()
  }, [id])

  if (loading) {
    return (
      <div className="hospital-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Loading referral status…</p>
      </div>
    )
  }

  if (error || !referral) {
    return (
      <div className="hospital-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid hsla(0, 72%, 58%, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'hsl(0, 72%, 75%)', marginBottom: '0.5rem' }}>Referral Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {error || 'This referral could not be located. The QR code may be invalid or expired.'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
            Please contact your frontline health worker (ASHA) for assistance.
          </p>
        </div>
      </div>
    )
  }

  const currentStep = getStepIndex(referral.status, !!referral.booked_time_slot)
  const tokenDisplay = referral.token_number || `${1000 + referral.id}`

  return (
    <div className="hospital-container" style={{ minHeight: '100vh', padding: '1.5rem' }}>
      {/* Header */}
      <header style={{
        textAlign: 'center',
        marginBottom: '2rem'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚕</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>VARADHI</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
          Patient Referral Status Tracker
        </p>
      </header>

      {/* Token Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        textAlign: 'center',
        marginBottom: '1.5rem'
      }}>
        <p style={{ fontSize: '0.85rem', color: 'hsla(0,0%,100%,0.7)', margin: 0 }}>Your Token Number</p>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', margin: '0.3rem 0' }}>#{tokenDisplay}</h2>
        <p style={{ fontSize: '0.9rem', color: 'hsla(0,0%,100%,0.85)', margin: 0 }}>
          {referral.patient_name} · {referral.patient_age} yrs · {referral.patient_gender}
        </p>
      </div>

      {/* Progress Tracker */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.2rem', color: 'var(--accent)' }}>
          📊 Referral Progress
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {/* Progress line */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '10%',
            right: '10%',
            height: '3px',
            background: 'var(--card-border)',
            zIndex: 0
          }} />
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '10%',
            width: `${Math.min(currentStep / (statusSteps.length - 1) * 80, 80)}%`,
            height: '3px',
            background: 'var(--accent)',
            zIndex: 1,
            transition: 'width 0.5s ease'
          }} />

          {statusSteps.map((step, idx) => (
            <div key={step.key} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 2,
              flex: 1
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                background: idx <= currentStep ? 'var(--accent)' : 'var(--card-bg)',
                border: idx <= currentStep ? '2px solid var(--accent)' : '2px solid var(--card-border)',
                color: idx <= currentStep ? 'var(--bg-primary)' : 'var(--text-secondary)',
                transition: 'all 0.3s ease'
              }}>
                {step.icon}
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: idx <= currentStep ? 700 : 500,
                color: idx <= currentStep ? 'var(--accent)' : 'var(--text-secondary)',
                marginTop: '0.5rem',
                textAlign: 'center'
              }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Details */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent)' }}>
          🩺 Referral Details
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Symptoms</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{referral.symptoms}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Duration</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{referral.symptom_duration}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Pain Level</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{referral.pain_level}/10</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Triage Category</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
              {referral.triage_category === 'emergency' ? '🚨 Emergency' :
               referral.triage_category === 'referral' ? '🏥 Facility Referral' : '👩‍⚕️ Teleconsultation'}
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>AI Triage Reason</p>
            <p style={{ fontSize: '0.88rem', fontWeight: 500, margin: 0, color: 'var(--text-secondary)' }}>{referral.triage_reason}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Location</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>📍 {referral.patient_village}, {referral.patient_district}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Triage Score</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{referral.triage_score}/100</p>
          </div>
        </div>
      </div>

      {/* Appointment / Slot Info */}
      {referral.booked_time_slot && (
        <div style={{
          background: 'hsla(145, 65%, 48%, 0.1)',
          border: '1px solid hsla(145, 65%, 48%, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'hsl(145, 65%, 75%)' }}>
            ✅ Appointment Allotted
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Date</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'hsl(145, 65%, 75%)' }}>{referral.booked_date}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Time Slot</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'hsl(145, 65%, 75%)' }}>{referral.booked_time_slot}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Service</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{referral.booked_service}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.2rem' }}>Facility</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{referral.booked_facility}</p>
            </div>
          </div>
          <div style={{
            marginTop: '1rem',
            padding: '0.8rem',
            background: 'hsla(145, 65%, 48%, 0.08)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: 'hsl(145, 65%, 75%)'
          }}>
            💡 Please arrive 15 minutes before your allotted time slot with your Token Number <strong>#{tokenDisplay}</strong>.
          </div>
        </div>
      )}

      {!referral.booked_time_slot && (
        <div style={{
          background: 'hsla(38, 92%, 50%, 0.1)',
          border: '1px solid hsla(38, 92%, 50%, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '1.2rem', margin: '0 0 0.5rem' }}>⏳</p>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(38, 92%, 75%)', margin: 0 }}>
            Your referral is being processed. A time slot will be allotted by your frontline health worker shortly.
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          VARADHI · Bridging Rural Healthcare · Connecting Care. Completing Journeys.
        </p>
      </div>
    </div>
  )
}
