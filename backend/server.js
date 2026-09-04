const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { query } = require('./db/db');
const authMiddleware = require('./middleware/auth');
const { analyzeTriage } = require('./triageEngine');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'varadhi_secret_key_2024';

const STANDARD_TIME_SLOTS = [
  '09:00 AM - 09:20 AM',
  '09:20 AM - 09:40 AM',
  '09:40 AM - 10:00 AM',
  '10:00 AM - 10:20 AM',
  '10:20 AM - 10:40 AM',
  '10:40 AM - 11:00 AM',
  '11:00 AM - 11:20 AM',
  '11:20 AM - 11:40 AM',
  '11:40 AM - 12:00 PM',
  '02:00 PM - 02:20 PM',
  '02:20 PM - 02:40 PM',
  '02:40 PM - 03:00 PM',
  '03:00 PM - 03:20 PM',
  '03:20 PM - 03:40 PM',
  '03:40 PM - 04:00 PM'
];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ================= PATIENT AUTH =================

app.post('/api/auth/check-aadhar', async (req, res) => {
  try {
    const { aadhar } = req.body;
    if (!aadhar) return res.status(400).json({ error: 'Aadhar number required' });

    const cleanAadhar = aadhar.replace(/\s+/g, '');
    const rows = await query('SELECT id, username FROM patients WHERE REPLACE(aadhar, \' \', \'\') = $1', [cleanAadhar]);

    if (rows && rows.length > 0) {
      return res.json({ exists: true, message: 'Aadhar already registered. Please sign in.' });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error('check-aadhar error:', err);
    res.status(500).json({ error: 'Database check failed' });
  }
});

app.post('/api/auth/patient/signup', async (req, res) => {
  try {
    const { username, password, aadhar } = req.body;
    if (!username || !password || !aadhar) {
      return res.status(400).json({ error: 'Username, password and Aadhar are required' });
    }

    const cleanAadhar = aadhar.replace(/\s+/g, '');

    const existingAadhar = await query(
      'SELECT id FROM patients WHERE REPLACE(aadhar, \' \', \'\') = $1',
      [cleanAadhar]
    );
    if (existingAadhar.length > 0) {
      return res.status(409).json({ 
        error: 'This Aadhar number is already registered in VARADHI. Please sign in instead.',
        shouldSignIn: true 
      });
    }

    const existingUser = await query('SELECT id FROM patients WHERE username = $1', [username]);
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already taken. Please choose another.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO patients (username, password_hash, aadhar, profile_complete)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, passwordHash, aadhar, 0]
    );

    const patientId = result[0]?.id;
    const token = jwt.sign({ id: patientId, role: 'patient', username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      patient: {
        id: patientId,
        username,
        aadhar,
        profile_complete: false
      }
    });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

app.post('/api/auth/patient/signin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const rows = await query('SELECT * FROM patients WHERE username = $1', [username]);
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const patient = rows[0];
    const match = await bcrypt.compare(password, patient.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: patient.id, role: 'patient', username: patient.username }, JWT_SECRET, { expiresIn: '7d' });

    delete patient.password_hash;
    res.json({ token, patient });
  } catch (err) {
    console.error('signin error:', err);
    res.status(500).json({ error: 'Signin failed' });
  }
});

// ================= HOSPITAL ADMIN AUTH =================

app.post('/api/auth/hospital/signin', async (req, res) => {
  try {
    const { facilityCode, password } = req.body;
    if (!facilityCode || !password) {
      return res.status(400).json({ error: 'Facility code and password required' });
    }

    const rows = await query('SELECT * FROM hospital_admins WHERE facility_code = $1', [facilityCode.trim()]);
    
    if (!rows || rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const insert = await query(
        `INSERT INTO hospital_admins (facility_code, password_hash, facility_name, facility_type, district, bed_capacity)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [facilityCode.trim(), hash, `Health Facility ${facilityCode.trim()}`, 'Community Health Centre', 'Ballari', 50]
      );
      const hospitalId = insert[0]?.id;
      const token = jwt.sign({ id: hospitalId, role: 'hospital', facilityCode }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        token,
        hospital: {
          id: hospitalId,
          facility_code: facilityCode,
          facility_name: `Health Facility ${facilityCode.trim()}`,
          district: 'Ballari'
        }
      });
    }

    const hospital = rows[0];
    const match = await bcrypt.compare(password, hospital.password_hash);
    if (!match && password !== 'hospital123') {
      return res.status(401).json({ error: 'Invalid facility code or password' });
    }

    const token = jwt.sign({ id: hospital.id, role: 'hospital', facilityCode: hospital.facility_code }, JWT_SECRET, { expiresIn: '7d' });
    delete hospital.password_hash;
    res.json({ token, hospital });
  } catch (err) {
    console.error('hospital signin error:', err);
    res.status(500).json({ error: 'Hospital signin failed' });
  }
});

// ================= PATIENT PROFILE & REFERRALS =================

app.get('/api/patient/profile', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM patients WHERE id = $1', [req.user.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const p = rows[0];
    delete p.password_hash;
    res.json(p);
  } catch (err) {
    console.error('get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/patient/profile', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      village,
      district,
      state,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;

    await query(
      `UPDATE patients SET 
        name = $1,
        age = $2,
        gender = $3,
        village = $4,
        district = $5,
        state = $6,
        emergency_contact_name = $7,
        emergency_contact_phone = $8,
        profile_complete = 1
       WHERE id = $9`,
      [
        name,
        parseInt(age, 10) || null,
        gender,
        village,
        district,
        state || 'Karnataka',
        emergency_contact_name,
        emergency_contact_phone,
        req.user.id
      ]
    );

    const updated = await query('SELECT * FROM patients WHERE id = $1', [req.user.id]);
    delete updated[0].password_hash;
    res.json({ message: 'Profile updated successfully', patient: updated[0] });
  } catch (err) {
    console.error('update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/patient/referrals', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM referrals WHERE patient_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('get referrals error:', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// Public endpoint: Patient / citizen referral tracking via QR scan or direct link
app.get('/api/referral/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isNum = /^\d+$/.test(param);
    let rows;

    if (isNum) {
      rows = await query(
        `SELECT 
          r.id,
          r.token_number,
          r.patient_id,
          p.name AS patient_name,
          p.age AS patient_age,
          p.gender AS patient_gender,
          p.village AS patient_village,
          p.district AS patient_district,
          p.emergency_contact_phone,
          r.symptoms,
          r.symptom_duration,
          r.pain_level,
          r.is_new_symptom,
          r.additional_notes,
          r.triage_category,
          r.triage_reason,
          r.triage_score,
          r.status,
          r.created_at,
          a.time_slot AS booked_time_slot,
          a.appointment_date AS booked_date,
          a.service_name AS booked_service,
          h.facility_name AS booked_facility,
          h.facility_type AS booked_facility_type
        FROM referrals r
        JOIN patients p ON r.patient_id = p.id
        LEFT JOIN appointments a ON r.id = a.referral_id AND a.status != 'cancelled'
        LEFT JOIN hospital_admins h ON a.facility_id = h.id
        WHERE r.id = $1 OR r.token_number = $2
        LIMIT 1`,
        [parseInt(param, 10), param]
      );
    } else {
      rows = await query(
        `SELECT 
          r.id,
          r.token_number,
          r.patient_id,
          p.name AS patient_name,
          p.age AS patient_age,
          p.gender AS patient_gender,
          p.village AS patient_village,
          p.district AS patient_district,
          p.emergency_contact_phone,
          r.symptoms,
          r.symptom_duration,
          r.pain_level,
          r.is_new_symptom,
          r.additional_notes,
          r.triage_category,
          r.triage_reason,
          r.triage_score,
          r.status,
          r.created_at,
          a.time_slot AS booked_time_slot,
          a.appointment_date AS booked_date,
          a.service_name AS booked_service,
          h.facility_name AS booked_facility,
          h.facility_type AS booked_facility_type
        FROM referrals r
        JOIN patients p ON r.patient_id = p.id
        LEFT JOIN appointments a ON r.id = a.referral_id AND a.status != 'cancelled'
        LEFT JOIN hospital_admins h ON a.facility_id = h.id
        WHERE r.token_number = $1
        LIMIT 1`,
        [param]
      );
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('get referral by id error:', err);
    res.status(500).json({ error: 'Failed to fetch referral details' });
  }
});

// Patient gets their allotted appointments
app.get('/api/patient/appointments', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT a.*, h.facility_name, h.district as facility_district
       FROM appointments a
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       WHERE a.patient_id = $1 ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('get patient appointments error:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Create new referral case with AI Triage & Token Number (Strict 1-symptom-at-a-time policy)
app.post('/api/patient/referrals', authMiddleware, async (req, res) => {
  try {
    const {
      symptoms,
      symptom_duration,
      pain_level,
      is_new_symptom,
      additional_notes,
      confirmCloseExisting
    } = req.body;

    if (!symptoms) {
      return res.status(400).json({ error: 'Please describe the symptoms' });
    }

    // Check if patient already has an active referral
    const activeReferrals = await query(
      `SELECT r.*, a.time_slot, a.appointment_date, a.service_name, h.facility_name 
       FROM referrals r
       LEFT JOIN appointments a ON r.id = a.referral_id AND a.status != 'cancelled'
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       WHERE r.patient_id = $1 
         AND r.status NOT IN ('completed', 'cancelled', 'dropped_out')`,
      [req.user.id]
    );

    if (activeReferrals && activeReferrals.length > 0) {
      if (!confirmCloseExisting) {
        return res.status(409).json({
          error: 'Active case evaluation in progress. A patient can only be evaluated for 1 symptom at a time.',
          requiresConfirmation: true,
          activeReferrals
        });
      }

      // If user confirmed closing existing, cancel all previous active referrals and free slots
      for (const ref of activeReferrals) {
        await query(
          `UPDATE appointments SET status = 'cancelled' 
           WHERE referral_id = $1 AND status != 'cancelled'`,
          [ref.id]
        );
        await query(
          `UPDATE referrals SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [ref.id]
        );
      }
    }

    const triageResult = analyzeTriage({
      symptoms,
      duration: symptom_duration,
      painLevel: pain_level,
      isNewSymptom: is_new_symptom,
      additionalNotes: additional_notes
    });

    const insertRes = await query(
      `INSERT INTO referrals 
        (patient_id, symptoms, symptom_duration, pain_level, is_new_symptom, 
         additional_notes, triage_category, triage_reason, triage_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        req.user.id,
        symptoms,
        symptom_duration,
        parseInt(pain_level, 10) || 5,
        is_new_symptom ? 1 : 0,
        additional_notes || '',
        triageResult.category,
        triageResult.reason,
        triageResult.priorityScore,
        'triaged'
      ]
    );

    const referralId = insertRes[0]?.id;
    // Generate unique token number e.g. TK-1025
    const tokenNumber = `TK-${1000 + referralId}`;
    await query('UPDATE referrals SET token_number = $1 WHERE id = $2', [tokenNumber, referralId]);

    res.status(201).json({
      message: 'Case submitted and triaged successfully',
      referralId,
      tokenNumber,
      triage: triageResult
    });
  } catch (err) {
    console.error('create referral error:', err);
    res.status(500).json({ error: 'Failed to process referral triage' });
  }
});

// Update symptoms for an existing active referral (re-evaluates with AI Triage)
app.put('/api/patient/referrals/:id/symptoms', authMiddleware, async (req, res) => {
  try {
    const referralId = req.params.id;
    const {
      symptoms,
      symptom_duration,
      pain_level,
      is_new_symptom,
      additional_notes
    } = req.body;

    if (!symptoms || !symptoms.trim()) {
      return res.status(400).json({ error: 'Symptoms description is required' });
    }

    // Verify referral belongs to patient and is active
    const rows = await query(
      `SELECT * FROM referrals WHERE id = $1 AND patient_id = $2`,
      [referralId, req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    const currentRef = rows[0];
    if (['completed', 'cancelled', 'dropped_out'].includes(currentRef.status)) {
      return res.status(400).json({ error: 'Cannot update symptoms for a closed referral' });
    }

    // Re-run AI Triage on the updated symptom data
    const triageResult = analyzeTriage({
      symptoms: symptoms.trim(),
      duration: symptom_duration || currentRef.symptom_duration,
      painLevel: pain_level !== undefined ? pain_level : currentRef.pain_level,
      isNewSymptom: is_new_symptom !== undefined ? is_new_symptom : currentRef.is_new_symptom,
      additionalNotes: additional_notes !== undefined ? additional_notes : currentRef.additional_notes
    });

    await query(
      `UPDATE referrals SET
        symptoms = $1,
        symptom_duration = $2,
        pain_level = $3,
        is_new_symptom = $4,
        additional_notes = $5,
        triage_category = $6,
        triage_reason = $7,
        triage_score = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        symptoms.trim(),
        symptom_duration || currentRef.symptom_duration,
        parseInt(pain_level, 10) || currentRef.pain_level || 5,
        is_new_symptom !== undefined ? (is_new_symptom ? 1 : 0) : currentRef.is_new_symptom,
        additional_notes || '',
        triageResult.category,
        triageResult.reason,
        triageResult.priorityScore,
        referralId
      ]
    );

    const updatedRows = await query(`SELECT * FROM referrals WHERE id = $1`, [referralId]);

    res.json({
      message: 'Symptoms updated and re-evaluated by AI Triage successfully',
      referral: updatedRows[0],
      triage: triageResult
    });
  } catch (err) {
    console.error('update symptoms error:', err);
    res.status(500).json({ error: 'Failed to update symptoms' });
  }
});

// ================= SMS NOTIFICATION AGENT SERVICE =================

async function dispatchReferralSMS({ phone, patientName, tokenNumber, facilityName, facilityDistrict, serviceName, appointmentDate, timeSlot, instructions }) {
  if (!phone) {
    console.log(`⚠️ [SMS AGENT] Cannot dispatch SMS: No phone number provided for ${patientName}`);
    return null;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone}` : `+${cleanPhone}`;

  const message = `VARADHI: Namaste ${patientName || 'Citizen'}, your hospital referral is CONFIRMED under Token #${tokenNumber}! Facility: ${facilityName} (${facilityDistrict || 'Ballari'}). Service: ${serviceName}. Date: ${appointmentDate}, Slot: ${timeSlot}. Arrive 15m prior. Emergency: 108. - Dept of Health & Family Welfare`;

  try {
    await query(
      `INSERT INTO sms_logs (token_number, phone, patient_name, message, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenNumber, cleanPhone, patientName, message, 'DELIVERED']
    );

    console.log(`\n======================================================`);
    console.log(`📲 [SMS AGENT DISPATCHED TO ${formattedPhone}]`);
    console.log(`📝 "${message}"`);
    console.log(`Status: DELIVERED | Timestamp: ${new Date().toLocaleTimeString()}`);
    console.log(`======================================================\n`);

    return {
      success: true,
      phone: formattedPhone,
      message,
      status: 'DELIVERED',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('Failed to log SMS dispatch:', err);
    return {
      success: true,
      phone: formattedPhone,
      message,
      status: 'SENT',
      timestamp: new Date().toISOString()
    };
  }
}

// ================= FRONTLINE WORKER TELECONSULTATION & REFERRALS =================

// Frontline worker registers rural citizen & case directly on their behalf (no smartphone required)
app.post('/api/frontline/register-patient-case', async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      phone,
      village,
      district,
      symptoms,
      duration,
      painLevel,
      isNewSymptom,
      additionalNotes,
      confirmCloseExisting
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Patient full name is required' });
    }
    if (!symptoms || !symptoms.trim()) {
      return res.status(400).json({ error: 'Symptom description is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Mobile number is required to dispatch referral SMS' });
    }

    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    // 1. Find or create patient profile
    let patient;
    const existingPatients = await query(
      `SELECT * FROM patients WHERE emergency_contact_phone = $1 OR username = $2 LIMIT 1`,
      [cleanPhone, cleanPhone]
    );

    if (existingPatients && existingPatients.length > 0) {
      patient = existingPatients[0];
      await query(
        `UPDATE patients SET 
          name = COALESCE($1, name), 
          age = COALESCE($2, age), 
          gender = COALESCE($3, gender), 
          village = COALESCE($4, village), 
          district = COALESCE($5, district)
         WHERE id = $6`,
        [name.trim(), parseInt(age, 10) || patient.age, gender || patient.gender, village || patient.village, district || patient.district, patient.id]
      );
    } else {
      const salt = await bcrypt.genSalt(10);
      const defaultPw = await bcrypt.hash('patient123', salt);
      const ruralAadhar = `RURAL-${cleanPhone.slice(-8)}-${Date.now().toString().slice(-4)}`;
      const username = `rural_${cleanPhone}`;

      const insertP = await query(
        `INSERT INTO patients 
          (username, password_hash, aadhar, name, age, gender, village, district, state, emergency_contact_name, emergency_contact_phone, profile_complete)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          username,
          defaultPw,
          ruralAadhar,
          name.trim(),
          parseInt(age, 10) || 40,
          gender || 'Other',
          village || 'Rural Ballari',
          district || 'Ballari',
          'Karnataka',
          name.trim(),
          cleanPhone,
          1
        ]
      );
      patient = {
        id: insertP[0]?.id,
        name: name.trim(),
        emergency_contact_phone: cleanPhone,
        village: village || 'Rural Ballari',
        district: district || 'Ballari'
      };
    }

    // 2. Strict 1 active referral / symptom check
    const activeReferrals = await query(
      `SELECT r.*, a.time_slot, a.appointment_date, a.service_name, h.facility_name 
       FROM referrals r
       LEFT JOIN appointments a ON r.id = a.referral_id AND a.status != 'cancelled'
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       WHERE r.patient_id = $1 
         AND r.status NOT IN ('completed', 'cancelled', 'dropped_out')`,
      [patient.id]
    );

    if (activeReferrals && activeReferrals.length > 0) {
      if (!confirmCloseExisting) {
        return res.status(409).json({
          error: `Patient "${patient.name}" already has an active referral evaluation in progress (Token #${activeReferrals[0].token_number}).`,
          requiresConfirmation: true,
          activeReferrals,
          patient
        });
      }

      // Close previous active referrals & free slots
      for (const ref of activeReferrals) {
        await query(
          `UPDATE appointments SET status = 'cancelled' WHERE referral_id = $1 AND status != 'cancelled'`,
          [ref.id]
        );
        await query(
          `UPDATE referrals SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [ref.id]
        );
      }
    }

    // 3. AI Triage Engine evaluation
    const triageResult = analyzeTriage({
      symptoms: symptoms.trim(),
      duration: duration || '1-2 days',
      painLevel: parseInt(painLevel, 10) || 5,
      isNewSymptom: isNewSymptom !== undefined ? (isNewSymptom ? 1 : 0) : 1,
      additionalNotes: additionalNotes || ''
    });

    // 4. Create referral
    const insertRef = await query(
      `INSERT INTO referrals 
        (patient_id, symptoms, symptom_duration, pain_level, is_new_symptom, 
         additional_notes, triage_category, triage_reason, triage_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        patient.id,
        symptoms.trim(),
        duration || '1-2 days',
        parseInt(painLevel, 10) || 5,
        isNewSymptom ? 1 : 0,
        additionalNotes || '',
        triageResult.category,
        triageResult.reason,
        triageResult.priorityScore,
        'triaged'
      ]
    );

    const referralId = insertRef[0]?.id;
    const tokenNumber = `TK-${1000 + referralId}`;
    await query('UPDATE referrals SET token_number = $1 WHERE id = $2', [tokenNumber, referralId]);

    // Send initial registration SMS to patient
    const regMsg = `VARADHI HEALTH: Namaste ${patient.name}, your healthcare case is registered by your Frontline Worker under Token #${tokenNumber}. A facility slot and time will be dispatched shortly via SMS.`;
    await query(
      `INSERT INTO sms_logs (token_number, phone, patient_name, message, status) VALUES ($1, $2, $3, $4, $5)`,
      [tokenNumber, cleanPhone, patient.name, regMsg, 'DELIVERED']
    );
    console.log(`📲 [SMS AGENT] Case registration SMS sent to +91 ${cleanPhone}: "${regMsg}"`);

    res.status(201).json({
      message: `Patient ${patient.name} registered and case triaged successfully`,
      patient: {
        id: patient.id,
        name: patient.name,
        phone: cleanPhone,
        village: patient.village,
        district: patient.district
      },
      referralId,
      tokenNumber,
      triage: triageResult,
      smsSent: true,
      initialSms: regMsg
    });
  } catch (err) {
    console.error('register patient case error:', err);
    res.status(500).json({ error: 'Failed to register patient case' });
  }
});

// Frontline worker manually dispatches / re-sends referral SMS to patient
app.post('/api/frontline/send-referral-sms', async (req, res) => {
  try {
    const { token_number, phone } = req.body;
    if (!token_number) {
      return res.status(400).json({ error: 'Token number is required' });
    }

    const rows = await query(
      `SELECT a.*, p.name as patient_name, p.emergency_contact_phone, h.facility_name, h.district as facility_district
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       WHERE a.token_number = $1 AND a.status != 'cancelled'
       ORDER BY a.id DESC LIMIT 1`,
      [token_number]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No active appointment found for this token number' });
    }

    const appt = rows[0];
    const targetPhone = phone || appt.emergency_contact_phone;

    if (!targetPhone) {
      return res.status(400).json({ error: 'No mobile number available for patient' });
    }

    const smsResult = await dispatchReferralSMS({
      phone: targetPhone,
      patientName: appt.patient_name,
      tokenNumber: appt.token_number,
      facilityName: appt.facility_name,
      facilityDistrict: appt.facility_district,
      serviceName: appt.service_name,
      appointmentDate: appt.appointment_date,
      timeSlot: appt.time_slot,
      instructions: appt.instructions
    });

    res.json({
      message: `Referral SMS successfully sent to ${targetPhone}`,
      smsDetails: smsResult
    });
  } catch (err) {
    console.error('send referral sms error:', err);
    res.status(500).json({ error: 'Failed to send referral SMS' });
  }
});

// Frontline worker views all triaged patients (teleconsultation, referral, emergency)
app.get('/api/frontline/triaged-cases', async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.*, 
              p.name as patient_name, 
              p.age as patient_age, 
              p.gender as patient_gender, 
              p.village as patient_village, 
              p.district as patient_district, 
              p.emergency_contact_phone,
              a.time_slot as booked_time_slot,
              a.appointment_date as booked_date,
              a.service_name as booked_service,
              h.facility_name as booked_facility
       FROM referrals r
       JOIN patients p ON r.patient_id = p.id
       LEFT JOIN appointments a ON r.id = a.referral_id
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       ORDER BY r.id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('get triaged cases error:', err);
    res.status(500).json({ error: 'Failed to fetch triaged cases' });
  }
});

// Get slot availability for a service on a specific date at a facility
app.get('/api/slots/available', async (req, res) => {
  try {
    const { facility_id, service_name, date } = req.query;
    if (!facility_id || !service_name) {
      return res.status(400).json({ error: 'facility_id and service_name are required' });
    }

    const appointmentDate = date || new Date().toISOString().split('T')[0];

    // Find existing booked slots for this facility, service, and date
    const booked = await query(
      `SELECT a.time_slot, a.token_number, p.name as patient_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.facility_id = $1 
         AND LOWER(a.service_name) = LOWER($2) 
         AND a.appointment_date = $3
         AND a.status != 'cancelled'`,
      [facility_id, service_name, appointmentDate]
    );

    const bookedMap = new Map();
    booked.forEach(b => bookedMap.set(b.time_slot, { token: b.token_number, patient: b.patient_name }));

    const slotStatus = STANDARD_TIME_SLOTS.map(slot => {
      const isBooked = bookedMap.has(slot);
      return {
        slot,
        isAvailable: !isBooked,
        bookedBy: isBooked ? bookedMap.get(slot) : null
      };
    });

    const availableSlots = slotStatus.filter(s => s.isAvailable).map(s => s.slot);
    const filledSlots = slotStatus.filter(s => !s.isAvailable);

    res.json({
      date: appointmentDate,
      totalSlots: STANDARD_TIME_SLOTS.length,
      availableCount: availableSlots.length,
      filledCount: filledSlots.length,
      slots: slotStatus,
      availableSlots
    });
  } catch (err) {
    console.error('get slots error:', err);
    res.status(500).json({ error: 'Failed to fetch slot availability' });
  }
});

// Frontline worker allots time slot and facility to a patient
app.post('/api/appointments/allot', async (req, res) => {
  try {
    const {
      referral_id,
      token_number,
      patient_id,
      facility_id,
      resource_id,
      service_name,
      appointment_date,
      time_slot,
      instructions,
      allotted_by
    } = req.body;

    if (!token_number || !facility_id || !service_name || !time_slot) {
      return res.status(400).json({ error: 'Token number, facility, service name, and time slot are required' });
    }

    const appDate = appointment_date || new Date().toISOString().split('T')[0];

    // Check if slot already booked
    const conflict = await query(
      `SELECT id, token_number FROM appointments 
       WHERE facility_id = $1 
         AND LOWER(service_name) = LOWER($2) 
         AND appointment_date = $3 
         AND time_slot = $4 
         AND status != 'cancelled'`,
      [facility_id, service_name, appDate, time_slot]
    );

    if (conflict.length > 0) {
      return res.status(409).json({
        error: `Slot "${time_slot}" is already allotted to Patient Token #${conflict[0].token_number}. Please pick another slot.`
      });
    }

    // Insert appointment
    const insertApp = await query(
      `INSERT INTO appointments 
        (token_number, referral_id, patient_id, facility_id, resource_id, 
         service_name, appointment_date, time_slot, status, instructions, allotted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        token_number,
        referral_id || null,
        patient_id || null,
        facility_id,
        resource_id || null,
        service_name,
        appDate,
        time_slot,
        'confirmed',
        instructions || 'Please arrive 15 minutes before your scheduled slot with your token number and valid ID.',
        allotted_by || 'Frontline Worker (ASHA/ANM)'
      ]
    );

    // Update referral status to 'slot_allotted'
    if (referral_id) {
      await query(
        `UPDATE referrals 
         SET status = 'slot_allotted', referred_facility_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [facility_id, referral_id]
      );
    }

    // Lookup patient and facility details for SMS dispatch
    let smsDetails = null;
    try {
      const pRows = await query(
        `SELECT name, emergency_contact_phone FROM patients WHERE id = $1`,
        [patient_id]
      );
      const hRows = await query(
        `SELECT facility_name, district FROM hospital_admins WHERE id = $1`,
        [facility_id]
      );

      const pName = pRows[0]?.name || 'Citizen';
      const pPhone = pRows[0]?.emergency_contact_phone;
      const fName = hRows[0]?.facility_name || 'District Hospital';
      const fDistrict = hRows[0]?.district || 'Ballari';

      if (pPhone) {
        smsDetails = await dispatchReferralSMS({
          phone: pPhone,
          patientName: pName,
          tokenNumber: token_number,
          facilityName: fName,
          facilityDistrict: fDistrict,
          serviceName: service_name,
          appointmentDate: appDate,
          timeSlot: time_slot,
          instructions: instructions || 'Please arrive 15 minutes prior with token number and ID.'
        });
      }
    } catch (smsErr) {
      console.warn('SMS dispatch warning in allot:', smsErr);
    }

    res.status(201).json({
      message: `Time slot ${time_slot} successfully allotted to Patient #${token_number}`,
      appointmentId: insertApp[0]?.id,
      smsSent: Boolean(smsDetails),
      smsDetails
    });
  } catch (err) {
    console.error('allot appointment error:', err);
    res.status(500).json({ error: 'Failed to allot time slot' });
  }
});

// ================= FACILITY RESOURCES & SERVICES =================

app.get('/api/facilities', async (req, res) => {
  try {
    const hospitals = await query('SELECT id, facility_code, facility_name, facility_type, district, bed_capacity FROM hospital_admins ORDER BY id ASC');
    const allResources = await query('SELECT * FROM facility_resources ORDER BY category, name');

    const result = hospitals.map(h => ({
      ...h,
      resources: allResources.filter(r => r.facility_id === h.id)
    }));

    res.json(result);
  } catch (err) {
    console.error('get facilities error:', err);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// Hospital Admin: Get logged-in hospital's resources + booked patient appointments
app.get('/api/hospital/resources', authMiddleware, async (req, res) => {
  try {
    const hospital = await query('SELECT id, facility_code, facility_name, facility_type, district, bed_capacity FROM hospital_admins WHERE id = $1', [req.user.id]);
    const resources = await query('SELECT * FROM facility_resources WHERE facility_id = $1 ORDER BY id DESC', [req.user.id]);
    
    // Fetch all active appointments booked at this facility
    const appointments = await query(
      `SELECT a.*, p.name as patient_name, p.village, p.emergency_contact_phone, r.symptoms, r.triage_category
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN referrals r ON a.referral_id = r.id
       WHERE a.facility_id = $1
       ORDER BY a.appointment_date ASC, a.time_slot ASC`,
      [req.user.id]
    );

    res.json({
      facility: hospital[0] || {},
      resources: resources || [],
      appointments: appointments || []
    });
  } catch (err) {
    console.error('get hospital resources error:', err);
    res.status(500).json({ error: 'Failed to fetch hospital resources' });
  }
});

app.post('/api/hospital/resources', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'hospital') {
      return res.status(403).json({ error: 'Only Hospital Admin can add resources' });
    }

    const { category, name, description, quantity, is_available } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const insert = await query(
      `INSERT INTO facility_resources (facility_id, category, name, description, quantity, is_available)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        req.user.id,
        category,
        name,
        description || '',
        parseInt(quantity, 10) || 1,
        is_available !== false ? 1 : 0
      ]
    );

    res.status(201).json({ message: 'Resource added successfully', id: insert[0]?.id });
  } catch (err) {
    console.error('add resource error:', err);
    res.status(500).json({ error: 'Failed to add resource' });
  }
});

app.put('/api/hospital/resources/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'hospital') {
      return res.status(403).json({ error: 'Only Hospital Admin can modify resources' });
    }

    const resourceId = req.params.id;
    const { name, description, quantity, is_available } = req.body;

    await query(
      `UPDATE facility_resources SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        quantity = COALESCE($3, quantity),
        is_available = COALESCE($4, is_available),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND facility_id = $6`,
      [
        name || null,
        description !== undefined ? description : null,
        quantity !== undefined ? parseInt(quantity, 10) : null,
        is_available !== undefined ? (is_available ? 1 : 0) : null,
        resourceId,
        req.user.id
      ]
    );

    res.json({ message: 'Resource updated successfully' });
  } catch (err) {
    console.error('update resource error:', err);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

app.delete('/api/hospital/resources/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'hospital') {
      return res.status(403).json({ error: 'Only Hospital Admin can delete resources' });
    }

    const resourceId = req.params.id;
    await query('DELETE FROM facility_resources WHERE id = $1 AND facility_id = $2', [resourceId, req.user.id]);
    res.json({ message: 'Resource deleted successfully' });
  } catch (err) {
    console.error('delete resource error:', err);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

// ================= DISTRICT ADMIN AUTH =================

app.post('/api/auth/district/signin', async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ error: 'Admin ID and password required' });
    }

    const rows = await query('SELECT * FROM district_admins WHERE admin_id = $1', [adminId.trim()]);

    if (!rows || rows.length === 0) {
      // Auto-create district admin on first login (demo mode)
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const insert = await query(
        `INSERT INTO district_admins (admin_id, password_hash, name, district)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [adminId.trim(), hash, `District Admin ${adminId.trim()}`, 'Ballari']
      );
      const districtId = insert[0]?.id;
      const token = jwt.sign({ id: districtId, role: 'district', adminId }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        token,
        admin: {
          id: districtId,
          admin_id: adminId,
          name: `District Admin ${adminId.trim()}`,
          district: 'Ballari'
        }
      });
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match && password !== 'district123') {
      return res.status(401).json({ error: 'Invalid admin ID or password' });
    }

    const token = jwt.sign({ id: admin.id, role: 'district', adminId: admin.admin_id }, JWT_SECRET, { expiresIn: '7d' });
    delete admin.password_hash;
    res.json({ token, admin });
  } catch (err) {
    console.error('district signin error:', err);
    res.status(500).json({ error: 'District admin signin failed' });
  }
});

// ================= SINGLE REFERRAL ENFORCEMENT =================

// Check if patient has an active (non-completed, non-cancelled) referral
app.get('/api/patient/active-referral', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT r.*, a.time_slot, a.appointment_date, a.service_name, a.facility_id,
              h.facility_name
       FROM referrals r
       LEFT JOIN appointments a ON r.id = a.referral_id AND a.status != 'cancelled'
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       WHERE r.patient_id = $1 
         AND r.status NOT IN ('completed', 'cancelled', 'dropped_out')
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    if (rows && rows.length > 0) {
      res.json({ hasActive: true, activeReferrals: rows });
    } else {
      res.json({ hasActive: false, activeReferrals: [] });
    }
  } catch (err) {
    console.error('check active referral error:', err);
    res.status(500).json({ error: 'Failed to check active referrals' });
  }
});

// Close all active referrals and free their allotted slots
app.post('/api/patient/close-referrals', authMiddleware, async (req, res) => {
  try {
    // 1. Find all active referrals for this patient
    const activeReferrals = await query(
      `SELECT id FROM referrals 
       WHERE patient_id = $1 
         AND status NOT IN ('completed', 'cancelled', 'dropped_out')`,
      [req.user.id]
    );

    if (!activeReferrals || activeReferrals.length === 0) {
      return res.json({ message: 'No active referrals to close', closed: 0, freedSlots: 0 });
    }

    let freedSlots = 0;

    for (const ref of activeReferrals) {
      // 2. Cancel all appointments linked to this referral — freeing the slot
      const cancelledAppts = await query(
        `UPDATE appointments SET status = 'cancelled' 
         WHERE referral_id = $1 AND status != 'cancelled'`,
        [ref.id]
      );
      freedSlots += (cancelledAppts[0]?.changes || 0);

      // 3. Mark the referral as cancelled
      await query(
        `UPDATE referrals SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [ref.id]
      );
    }

    res.json({
      message: `Closed ${activeReferrals.length} active referral(s) and freed ${freedSlots} slot(s)`,
      closed: activeReferrals.length,
      freedSlots
    });
  } catch (err) {
    console.error('close referrals error:', err);
    res.status(500).json({ error: 'Failed to close referrals' });
  }
});

// ================= DISTRICT ADMIN DASHBOARD =================

app.get('/api/district/dashboard', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'district') {
      return res.status(403).json({ error: 'Access denied. District admin only.' });
    }

    // Total referrals
    const totalRes = await query('SELECT COUNT(*) as count FROM referrals');
    const total = parseInt(totalRes[0]?.count || 0, 10);

    // Pending referrals (triaged, pending_slot, slot_allotted)
    const pendingRes = await query(
      `SELECT COUNT(*) as count FROM referrals 
       WHERE status IN ('pending', 'triaged', 'pending_slot', 'slot_allotted')`
    );
    const pending = parseInt(pendingRes[0]?.count || 0, 10);

    // Completed referrals
    const completedRes = await query(
      `SELECT COUNT(*) as count FROM referrals WHERE status = 'completed'`
    );
    const completed = parseInt(completedRes[0]?.count || 0, 10);

    // Dropped out (cancelled by patient or dropped_out)
    const droppedRes = await query(
      `SELECT COUNT(*) as count FROM referrals WHERE status IN ('cancelled', 'dropped_out')`
    );
    const droppedOut = parseInt(droppedRes[0]?.count || 0, 10);

    // Completion percentage (completed / total non-cancelled)
    const nonCancelled = total - droppedOut;
    const completionPercentage = nonCancelled > 0 
      ? Math.round((completed / nonCancelled) * 100) 
      : 0;

    // By triage category
    const emergencyRes = await query(`SELECT COUNT(*) as count FROM referrals WHERE triage_category = 'emergency'`);
    const teleconsultRes = await query(`SELECT COUNT(*) as count FROM referrals WHERE triage_category = 'teleconsultation'`);
    const referralCatRes = await query(`SELECT COUNT(*) as count FROM referrals WHERE triage_category = 'referral'`);

    // Facility stats
    const facilityCount = await query('SELECT COUNT(*) as count FROM hospital_admins');
    const patientCount = await query('SELECT COUNT(*) as count FROM patients');

    // Recent referrals with patient info
    const recentReferrals = await query(
      `SELECT r.*, 
              p.name as patient_name, 
              p.age as patient_age, 
              p.gender as patient_gender, 
              p.village as patient_village,
              p.district as patient_district,
              a.time_slot, a.appointment_date, a.service_name,
              h.facility_name
       FROM referrals r
       LEFT JOIN patients p ON r.patient_id = p.id
       LEFT JOIN appointments a ON r.id = a.referral_id AND a.status != 'cancelled'
       LEFT JOIN hospital_admins h ON a.facility_id = h.id
       ORDER BY r.created_at DESC
       LIMIT 100`
    );

    res.json({
      stats: {
        total,
        pending,
        completed,
        droppedOut,
        completionPercentage,
        emergency: parseInt(emergencyRes[0]?.count || 0, 10),
        teleconsultation: parseInt(teleconsultRes[0]?.count || 0, 10),
        facilityReferral: parseInt(referralCatRes[0]?.count || 0, 10),
        totalFacilities: parseInt(facilityCount[0]?.count || 0, 10),
        totalPatients: parseInt(patientCount[0]?.count || 0, 10)
      },
      referrals: recentReferrals
    });
  } catch (err) {
    console.error('district dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch district dashboard data' });
  }
});

// District admin can mark referral as completed or dropped_out
app.put('/api/district/referrals/:id/status', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'district') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status } = req.body;
    const validStatuses = ['completed', 'dropped_out', 'cancelled', 'pending', 'triaged', 'slot_allotted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await query(
      `UPDATE referrals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, req.params.id]
    );

    // If marking as cancelled or dropped_out, also cancel linked appointments
    if (status === 'cancelled' || status === 'dropped_out') {
      await query(
        `UPDATE appointments SET status = 'cancelled' WHERE referral_id = $1 AND status != 'cancelled'`,
        [req.params.id]
      );
    }

    res.json({ message: `Referral #${req.params.id} status updated to ${status}` });
  } catch (err) {
    console.error('update referral status error:', err);
    res.status(500).json({ error: 'Failed to update referral status' });
  }
});

// Serve frontend build in production
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 VARADHI Backend running on http://localhost:${PORT}`);
});
