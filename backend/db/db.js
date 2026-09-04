const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let usePg = false;
let pgPool = null;
let sqliteDb = null;

// Initialize SQLite database
const sqlitePath = path.join(__dirname, '..', 'varadhi.db');
sqliteDb = new sqlite3.Database(sqlitePath, (err) => {
  if (err) {
    console.error('Error opening sqlite db:', err);
  } else {
    console.log('SQLite ready at:', sqlitePath);
    initSqliteTables();
  }
});

// Try connecting to PostgreSQL
if (process.env.DATABASE_URL) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000
  });

  pgPool.connect((err, client, release) => {
    if (err) {
      console.log('⚠️ PostgreSQL not reachable yet, running with local SQLite storage:', err.message);
      usePg = false;
    } else {
      console.log(' Connected to PostgreSQL database!');
      usePg = true;
      release();
      initPgTables();
    }
  });
}

function initPgTables() {
  const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
  pgPool.query(initSql, (err) => {
    if (err) console.error('Error initializing PostgreSQL tables:', err);
    else {
      console.log('PostgreSQL tables initialized.');
      seedDefaultData();
    }
  });
}

function initSqliteTables() {
  sqliteDb.serialize(() => {
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      aadhar TEXT UNIQUE NOT NULL,
      name TEXT,
      age INTEGER,
      gender TEXT,
      village TEXT,
      district TEXT,
      state TEXT DEFAULT 'Karnataka',
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      profile_complete INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS frontline_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      assigned_area TEXT,
      district TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS hospital_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_code TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      facility_name TEXT,
      facility_type TEXT,
      district TEXT,
      bed_capacity INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS facility_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id INTEGER,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      is_available INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(facility_id) REFERENCES hospital_admins(id) ON DELETE CASCADE
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS district_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      district TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number TEXT,
      patient_id INTEGER,
      symptoms TEXT,
      symptom_duration TEXT,
      pain_level INTEGER,
      is_new_symptom INTEGER DEFAULT 1,
      additional_notes TEXT,
      triage_category TEXT,
      triage_reason TEXT,
      triage_score INTEGER,
      status TEXT DEFAULT 'pending',
      assigned_worker_id INTEGER,
      referred_facility_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    )`);

    // Add token_number column to referrals if older table existed
    sqliteDb.run(`ALTER TABLE referrals ADD COLUMN token_number TEXT`, () => {});

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number TEXT NOT NULL,
      referral_id INTEGER,
      patient_id INTEGER,
      facility_id INTEGER,
      resource_id INTEGER,
      service_name TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      instructions TEXT,
      allotted_by TEXT DEFAULT 'Frontline Worker',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(referral_id) REFERENCES referrals(id),
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(facility_id) REFERENCES hospital_admins(id),
      FOREIGN KEY(resource_id) REFERENCES facility_resources(id)
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS sms_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number TEXT,
      phone TEXT NOT NULL,
      patient_name TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'DELIVERED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    seedDefaultData();
  });
}

async function seedDefaultData() {
  const salt = bcrypt.genSaltSync(10);
  const defaultPw = bcrypt.hashSync('hospital123', salt);
  const patientPw = bcrypt.hashSync('patient123', salt);

  // 1. Seed default hospital
  const hospitals = await query('SELECT id FROM hospital_admins WHERE facility_code = $1', ['HF-KA-2024-0056']);
  let hospitalId = hospitals[0]?.id;

  if (!hospitalId) {
    const insertHosp = await query(
      `INSERT INTO hospital_admins (facility_code, password_hash, facility_name, facility_type, district, bed_capacity)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['HF-KA-2024-0056', defaultPw, 'District General Hospital Ballari', 'District Hospital', 'Ballari', 150]
    );
    hospitalId = insertHosp[0]?.id || 1;
  }

  // 2. Seed resources if empty
  const existingResources = await query('SELECT COUNT(*) as count FROM facility_resources WHERE facility_id = $1', [hospitalId]);
  const count = parseInt(existingResources[0]?.count || 0, 10);

  if (count === 0) {
    const initialResources = [
      { cat: 'equipment', name: 'General Ward Beds', desc: 'Standard inpatient care beds with monitoring support', qty: 45, avail: 1 },
      { cat: 'equipment', name: 'ICU Beds with Ventilator', desc: 'Critical intensive care units equipped with oxygen & vital monitors', qty: 12, avail: 1 },
      { cat: 'equipment', name: 'Medical Oxygen Cylinders & Concentrators', desc: 'Continuous medical-grade oxygen supply units (D-type)', qty: 25, avail: 1 },
      { cat: 'equipment', name: 'Emergency Cardiac Defibrillator', desc: 'Biphasic automated defibrillator units in ER', qty: 4, avail: 1 },
      { cat: 'test', name: 'Digital X-Ray Scanning', desc: 'High-resolution chest, extremity and skeletal radiography', qty: 1, avail: 1 },
      { cat: 'test', name: 'Complete Blood Count (CBC) & Biochemistry', desc: 'Automated 5-part hematology and blood chemistry analyzer', qty: 1, avail: 1 },
      { cat: 'test', name: 'Multi-Slice CT Scan (16 Slice)', desc: 'Full-body computed tomography for trauma, stroke, and internal scans', qty: 1, avail: 1 },
      { cat: 'test', name: 'Ultrasound (USG) & Doppler', desc: 'Abdominal, pelvic, obstetric, and vascular color Doppler imaging', qty: 2, avail: 1 },
      { cat: 'test', name: '12-Lead ECG & Cardiac Biomarkers', desc: 'Instant electrocardiogram with Troponin-I rapid card testing', qty: 3, avail: 1 },
      { cat: 'doctor', name: 'Cardiologist', desc: 'Treat heart and blood vessel conditions like high blood pressure and heart failure.', qty: 2, avail: 1 },
      { cat: 'doctor', name: 'Dermatologist', desc: 'Treat skin, hair, and nail problems such as acne and skin cancer.', qty: 1, avail: 1 },
      { cat: 'doctor', name: 'Endocrinologist', desc: 'Manage hormone and metabolism disorders like diabetes and thyroid disease.', qty: 1, avail: 1 },
      { cat: 'doctor', name: 'Gastroenterologist', desc: 'Treat digestive system issues involving the stomach, intestines, and liver.', qty: 2, avail: 1 },
      { cat: 'doctor', name: 'Neurologist', desc: 'Focus on disorders of the brain, spinal cord, and nervous system.', qty: 1, avail: 1 },
      { cat: 'doctor', name: 'Oncologist', desc: 'Diagnose and treat cancer using chemotherapy, radiation, or other therapies.', qty: 1, avail: 1 },
      { cat: 'doctor', name: 'Pediatrician', desc: 'Provide medical care for infants, children, and teens.', qty: 3, avail: 1 },
      { cat: 'doctor', name: 'Pulmonologist', desc: 'Specialize in lung and respiratory conditions like asthma and pneumonia.', qty: 2, avail: 1 },
      { cat: 'doctor', name: 'Psychiatrist', desc: 'Diagnose and treat mental health and emotional disorders.', qty: 1, avail: 1 }
    ];

    for (const res of initialResources) {
      await query(
        `INSERT INTO facility_resources (facility_id, category, name, description, quantity, is_available)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [hospitalId, res.cat, res.name, res.desc, res.qty, res.avail]
      );
    }
  }

  // 3. Seed demo patient 1023 & 1024 if not present
  const p1 = await query('SELECT id FROM patients WHERE username = $1', ['ramesh_patil']);
  let p1Id = p1[0]?.id;
  if (!p1Id) {
    const resP1 = await query(
      `INSERT INTO patients (username, password_hash, aadhar, name, age, gender, village, district, emergency_contact_name, emergency_contact_phone, profile_complete)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['ramesh_patil', patientPw, '1023 4455 6677', 'Ramesh Patil', 48, 'Male', 'Rampura Village', 'Ballari', 'Suresh (Son)', '9876543210', 1]
    );
    p1Id = resP1[0]?.id || 1;

    // Seed referral for patient 1023
    await query(
      `INSERT INTO referrals (token_number, patient_id, symptoms, symptom_duration, pain_level, is_new_symptom, additional_notes, triage_category, triage_reason, triage_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['1023', p1Id, 'Severe joint pain and persistent fatigue requiring blood evaluation', '1-2 weeks', 6, 1, 'Needs Complete Blood Count (CBC) test', 'teleconsultation', 'Sub-acute duration suitable for frontline evaluation; Moderate pain (6/10)', 62, 'pending_slot']
    );
  }

  const p2 = await query('SELECT id FROM patients WHERE username = $1', ['sunita_devi']);
  let p2Id = p2[0]?.id;
  if (!p2Id) {
    const resP2 = await query(
      `INSERT INTO patients (username, password_hash, aadhar, name, age, gender, village, district, emergency_contact_name, emergency_contact_phone, profile_complete)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['sunita_devi', patientPw, '1024 8899 0011', 'Sunita Devi', 56, 'Female', 'Kudligi Hobli', 'Ballari', 'Ravi (Husband)', '9123456780', 1]
    );
    p2Id = resP2[0]?.id || 2;

    await query(
      `INSERT INTO referrals (token_number, patient_id, symptoms, symptom_duration, pain_level, is_new_symptom, additional_notes, triage_category, triage_reason, triage_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['1024', p2Id, 'Palpitations and high blood pressure spikes', '3-5 days', 7, 0, 'History of hypertension; specialist review required', 'referral', 'Specialist/Facility care indicator: high blood pressure', 74, 'pending_slot']
    );
  }
}

/**
 * Unified query helper:
 * Converts PostgreSQL syntax ($1, $2) to SQLite (?) when needed
 */
async function query(sql, params = []) {
  if (usePg && pgPool) {
    try {
      const res = await pgPool.query(sql, params);
      return res.rows;
    } catch (err) {
      console.warn('PG query error, fallback query:', err.message);
    }
  }

  return new Promise((resolve, reject) => {
    let sqliteSql = sql.replace(/\$\d+/g, '?');
    const isSelect = /^\s*SELECT/i.test(sqliteSql);

    if (isSelect) {
      sqliteDb.all(sqliteSql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    } else {
      sqliteDb.run(sqliteSql, params, function (err) {
        if (err) reject(err);
        else resolve([{ id: this.lastID, changes: this.changes }]);
      });
    }
  });
}

module.exports = { query, getUsePg: () => usePg };
