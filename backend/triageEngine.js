/**
 * AI-Based Medical Triage Engine
 * Classifies symptoms using medical board triage rules:
 * 1. emergency
 * 2. teleconsultation (frontline worker)
 * 3. referral (hospital / CHC / PHC)
 */

const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', 'unconscious', 'breathing difficulty', 
  'severe breathlessness', 'heavy bleeding', 'stroke', 'slurred speech',
  'seizure', 'convulsion', 'cyanosis', 'blue lips', 'poisoning', 
  'snake bite', 'head injury', 'sudden paralysis', 'high fever stiff neck'
];

const REFERRAL_KEYWORDS = [
  'chronic', 'diabetes', 'hypertension', 'fracture', 'bone pain', 
  'swelling', 'lump', 'tumor', 'tuberculosis', 'tb', 'pregnancy', 
  'cataract', 'vision loss', 'kidney', 'jaundice', 'surgery'
];

function analyzeTriage({ symptoms, duration, painLevel, isNewSymptom, additionalNotes }) {
  const text = `${symptoms || ''} ${additionalNotes || ''}`.toLowerCase();
  const pain = parseInt(painLevel, 10) || 0;
  
  let emergencyReasons = [];
  let referralReasons = [];
  let teleReasons = [];

  // Rule 1: High pain is a strong indicator
  if (pain >= 8) {
    emergencyReasons.push(`High acute pain intensity (${pain}/10)`);
  } else if (pain >= 4) {
    teleReasons.push(`Moderate pain intensity (${pain}/10)`);
  }

  // Rule 2: Emergency red flag keyword check
  for (const kw of EMERGENCY_KEYWORDS) {
    if (text.includes(kw)) {
      emergencyReasons.push(`Critical red flag detected: "${kw}"`);
    }
  }

  // Rule 3: Referral keyword check
  for (const kw of REFERRAL_KEYWORDS) {
    if (text.includes(kw)) {
      referralReasons.push(`Specialist/Facility care indicator: "${kw}"`);
    }
  }

  // Rule 4: Duration evaluation
  const dur = (duration || '').toLowerCase();
  if (dur.includes('more than 2 weeks') || dur.includes('month') || dur.includes('chronic')) {
    referralReasons.push(`Prolonged symptom duration (${duration})`);
  } else if (dur.includes('1-2 weeks') || dur.includes('3-5 days')) {
    teleReasons.push(`Sub-acute duration suitable for frontline evaluation`);
  }

  // Rule 5: New vs Pre-existing
  if (isNewSymptom && pain >= 7) {
    emergencyReasons.push('Sudden onset acute distress');
  }

  // Determine classification
  if (emergencyReasons.length > 0) {
    return {
      category: 'emergency',
      categoryLabel: '🚨 Emergency - Immediate Care Required',
      priorityScore: Math.min(100, 80 + (pain * 2)),
      reason: emergencyReasons.join('; '),
      recommendedAction: 'Immediate dispatch / transfer to nearest District Hospital or 108 Emergency Ambulance.',
      recommendedFacilityType: 'District Hospital / Emergency Dept'
    };
  }

  if (referralReasons.length > 0) {
    return {
      category: 'referral',
      categoryLabel: '🏥 Hospital Referral Created',
      priorityScore: Math.min(80, 50 + (pain * 2)),
      reason: referralReasons.join('; '),
      recommendedAction: 'Assigned referral to Community Health Centre (CHC) or District Hospital for in-person diagnosis.',
      recommendedFacilityType: 'Community Health Centre (CHC)'
    };
  }

  return {
    category: 'teleconsultation',
    categoryLabel: '👩‍⚕️ Teleconsultation with Frontline Worker',
    priorityScore: Math.min(60, 30 + (pain * 2)),
    reason: teleReasons.length ? teleReasons.join('; ') : 'General non-critical symptom assessment',
    recommendedAction: 'Scheduled tele-review with assigned ASHA / ANM frontline worker within 24 hours.',
    recommendedFacilityType: 'Primary Health Centre / Frontline Worker'
  };
}

module.exports = { analyzeTriage };
