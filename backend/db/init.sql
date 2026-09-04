-- ===== VARADHI Database Schema =====

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  aadhar        VARCHAR(14)  NOT NULL UNIQUE,
  name          VARCHAR(200),
  age           INTEGER,
  gender        VARCHAR(20),
  village       VARCHAR(200),
  district      VARCHAR(200),
  state         VARCHAR(100) DEFAULT 'Karnataka',
  emergency_contact_name  VARCHAR(200),
  emergency_contact_phone VARCHAR(15),
  profile_complete BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Frontline workers table
CREATE TABLE IF NOT EXISTS frontline_workers (
  id            SERIAL PRIMARY KEY,
  worker_id     VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(200),
  phone         VARCHAR(15),
  assigned_area VARCHAR(200),
  district      VARCHAR(200),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hospital admins table
CREATE TABLE IF NOT EXISTS hospital_admins (
  id             SERIAL PRIMARY KEY,
  facility_code  VARCHAR(50) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  facility_name  VARCHAR(300),
  facility_type  VARCHAR(100),
  district       VARCHAR(200),
  bed_capacity   INTEGER DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Facility Resources & Services table
CREATE TABLE IF NOT EXISTS facility_resources (
  id             SERIAL PRIMARY KEY,
  facility_id    INTEGER REFERENCES hospital_admins(id) ON DELETE CASCADE,
  category       VARCHAR(50) NOT NULL, -- 'equipment', 'test', 'doctor', 'other'
  name           VARCHAR(200) NOT NULL,
  description    TEXT,
  quantity       INTEGER DEFAULT 1,
  is_available   BOOLEAN DEFAULT TRUE,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- District admins table
CREATE TABLE IF NOT EXISTS district_admins (
  id            SERIAL PRIMARY KEY,
  admin_id      VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(200),
  district      VARCHAR(200),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referrals / Cases table with Token Number
CREATE TABLE IF NOT EXISTS referrals (
  id              SERIAL PRIMARY KEY,
  token_number    VARCHAR(50),
  patient_id      INTEGER REFERENCES patients(id),
  symptoms        TEXT,
  symptom_duration VARCHAR(100),
  pain_level      INTEGER CHECK (pain_level BETWEEN 1 AND 10),
  is_new_symptom  BOOLEAN DEFAULT TRUE,
  additional_notes TEXT,
  triage_category VARCHAR(50), -- emergency, teleconsultation, referral
  triage_reason   TEXT,
  triage_score    INTEGER,
  status          VARCHAR(50) DEFAULT 'pending',
  assigned_worker_id INTEGER REFERENCES frontline_workers(id),
  referred_facility_id INTEGER REFERENCES hospital_admins(id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments / Time Slot Allotments
CREATE TABLE IF NOT EXISTS appointments (
  id              SERIAL PRIMARY KEY,
  token_number    VARCHAR(50) NOT NULL,
  referral_id     INTEGER REFERENCES referrals(id),
  patient_id      INTEGER REFERENCES patients(id),
  facility_id     INTEGER REFERENCES hospital_admins(id),
  resource_id     INTEGER REFERENCES facility_resources(id),
  service_name    VARCHAR(200) NOT NULL,
  appointment_date VARCHAR(50) NOT NULL,
  time_slot       VARCHAR(50) NOT NULL,
  status          VARCHAR(50) DEFAULT 'confirmed',
  instructions    TEXT,
  allotted_by     VARCHAR(100) DEFAULT 'Frontline Worker (ASHA/ANM)',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
