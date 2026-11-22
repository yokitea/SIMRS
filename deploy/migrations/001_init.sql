-- Core SIMRS PostgreSQL 16 Schema (White-Label OEM, Zero GPL/AGPL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_rm VARCHAR(32) UNIQUE NOT NULL,
    nik VARCHAR(20) NOT NULL DEFAULT '',
    bpjs_number VARCHAR(32) NOT NULL DEFAULT '',
    ihs_number VARCHAR(64) NOT NULL DEFAULT '',
    full_name VARCHAR(160) NOT NULL,
    birth_date VARCHAR(16) NOT NULL DEFAULT '',
    sex VARCHAR(8) NOT NULL DEFAULT 'M',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beds (
    id VARCHAR(32) PRIMARY KEY,
    ward_name VARCHAR(64) NOT NULL,
    room_code VARCHAR(32) NOT NULL,
    care_class VARCHAR(24) NOT NULL, -- VIP, KELAS_1, KELAS_2, KELAS_3, ICU
    daily_rate BIGINT NOT NULL DEFAULT 350000,
    status VARCHAR(24) NOT NULL DEFAULT 'TERSEDIA', -- TERSEDIA, TERISI, PEMBERSIHAN
    current_visit_id UUID,
    current_patient_name VARCHAR(160) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number VARCHAR(32) UNIQUE NOT NULL,
    queue_number VARCHAR(16) NOT NULL DEFAULT '',
    patient_id UUID NOT NULL REFERENCES patients(id),
    patient_no_rm VARCHAR(32) NOT NULL,
    patient_name VARCHAR(160) NOT NULL,
    service_type VARCHAR(16) NOT NULL CHECK (service_type IN ('RJ', 'IGD', 'RI')),
    unit_name VARCHAR(64) NOT NULL,
    doctor_name VARCHAR(128) NOT NULL,
    triage_level VARCHAR(16) NOT NULL DEFAULT '', -- MERAH, KUNING, HIJAU (for IGD)
    bed_id VARCHAR(32) NOT NULL DEFAULT '',
    payment_type VARCHAR(24) NOT NULL DEFAULT 'BPJS', -- BPJS, UMUM, ASURANSI
    sep_number VARCHAR(32) NOT NULL DEFAULT '',
    inacbg_code VARCHAR(32) NOT NULL DEFAULT '',
    inacbg_tariff BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'ANTRI', -- ANTRI, DIPERIKSA, RAWAT_INAP, SELESAI
    satusehat_encounter_id VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soap_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    author_name VARCHAR(128) NOT NULL,
    subjective TEXT NOT NULL DEFAULT '',
    objective TEXT NOT NULL DEFAULT '',
    bp_systolic INT NOT NULL DEFAULT 120,
    bp_diastolic INT NOT NULL DEFAULT 80,
    heart_rate INT NOT NULL DEFAULT 80,
    temperature DOUBLE PRECISION NOT NULL DEFAULT 36.5,
    resp_rate INT NOT NULL DEFAULT 18,
    spo2 INT NOT NULL DEFAULT 99,
    icd10_code VARCHAR(16) NOT NULL DEFAULT '',
    icd10_name VARCHAR(160) NOT NULL DEFAULT '',
    assessment TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radiology_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_no_rm VARCHAR(32) NOT NULL,
    patient_name VARCHAR(160) NOT NULL,
    accession_number VARCHAR(64) NOT NULL,
    study_instance_uid VARCHAR(128) NOT NULL,
    modality VARCHAR(16) NOT NULL,
    procedure_code VARCHAR(32) NOT NULL DEFAULT '',
    procedure_name VARCHAR(160) NOT NULL,
    clinical_note TEXT NOT NULL DEFAULT '',
    status VARCHAR(24) NOT NULL DEFAULT 'ORDERED', -- ORDERED, SENT_TO_RIS, COMPLETED
    ris_sync_status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    price BIGINT NOT NULL DEFAULT 250000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medications (
    id VARCHAR(32) PRIMARY KEY,
    kfa_code VARCHAR(32) NOT NULL,
    name VARCHAR(160) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    unit_price BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rx_number VARCHAR(32) UNIQUE NOT NULL,
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_no_rm VARCHAR(32) NOT NULL,
    patient_name VARCHAR(160) NOT NULL,
    doctor_name VARCHAR(128) NOT NULL,
    medication_id VARCHAR(32) NOT NULL REFERENCES medications(id),
    medication_name VARCHAR(160) NOT NULL,
    kfa_code VARCHAR(32) NOT NULL DEFAULT '',
    qty INT NOT NULL DEFAULT 1,
    dosage TEXT NOT NULL DEFAULT '',
    total_price BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'MENUNGGU', -- MENUNGGU, DISERAHKAN
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL, -- KONSULTASI, RADIOLOGI, FARMASI, KAMAR, TINDAKAN
    description VARCHAR(200) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target VARCHAR(32) NOT NULL, -- SATUSEHAT_FHIR, RIS_HL7, BPJS_VCLAIM
    event_type VARCHAR(32) NOT NULL,
    reference_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
    last_error TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
