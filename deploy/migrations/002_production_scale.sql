-- Core SIMRS Enterprise — Production Scale Migration (300+ Beds, RJ/IGD High Concurrency)
-- Covers: Phases 4, 6, 7, Core Feedback (Clinics, Roles, Rx Clarification, Warehouse Stock Ledger),
--         EMPI Mother's Name Parity, Partial Hot-Path Indexes, and Native Range Partitioning.

-- 1. EMPI Parity & Prescription Clarification Columns
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_patients_mother_name ON patients (lower(mother_name));
CREATE INDEX IF NOT EXISTS idx_patients_nik ON patients (nik) WHERE nik <> '';
CREATE INDEX IF NOT EXISTS idx_patients_bpjs ON patients (bpjs_number) WHERE bpjs_number <> '';

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS clarification_note TEXT NOT NULL DEFAULT '';

-- 2. Partial Hot-Path Indexes (OLTP Worklist Speed < 10ms)
CREATE INDEX IF NOT EXISTS idx_billing_unpaid ON billing_items (visit_id, created_at) WHERE paid = FALSE;
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON integration_outbox (created_at) WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_rx_pending ON prescriptions (created_at DESC) WHERE status IN ('MENUNGGU', 'KLARIFIKASI_DPJP');
CREATE INDEX IF NOT EXISTS idx_beds_available ON beds (ward_name, care_class) WHERE status = 'TERSEDIA';
CREATE INDEX IF NOT EXISTS idx_visits_active ON visits (service_type, unit_name, created_at DESC) WHERE status <> 'SELESAI';

-- 3. Clinics & Custom RBAC Roles
CREATE TABLE IF NOT EXISTS clinics (
    code            TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    specialty       TEXT NOT NULL DEFAULT '',
    bpjs_poli_code  TEXT NOT NULL DEFAULT '',
    room_number     TEXT NOT NULL DEFAULT '',
    floor           TEXT NOT NULL DEFAULT '',
    default_doctor  TEXT NOT NULL DEFAULT '',
    doctor_list     JSONB NOT NULL DEFAULT '[]'::jsonb,
    operating_hours TEXT NOT NULL DEFAULT '08:00 - 15:00 WIB',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    name         TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    workstations JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_custom    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. HRD & Staff Credentials (STARKES / KARS)
CREATE TABLE IF NOT EXISTS staff_credentials (
    id                 TEXT PRIMARY KEY,
    full_name          TEXT NOT NULL,
    role               TEXT NOT NULL,
    specialty          TEXT NOT NULL DEFAULT '',
    nip                TEXT NOT NULL DEFAULT '',
    str_number         TEXT NOT NULL DEFAULT '',
    str_expiry_date    DATE NOT NULL,
    sip_number         TEXT NOT NULL DEFAULT '',
    sip_expiry_date    DATE NOT NULL,
    clinical_privilege TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL DEFAULT 'AKTIF',
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_expiry ON staff_credentials (str_expiry_date, sip_expiry_date);

-- 5. Warehouse Stock Movements (Partitioned by Month for 5+ Years Retention)
CREATE TABLE IF NOT EXISTS stock_movements (
    id              TEXT NOT NULL,
    medication_id   TEXT NOT NULL,
    kfa_code        TEXT NOT NULL DEFAULT '',
    medication_name TEXT NOT NULL,
    movement_type   TEXT NOT NULL CHECK (movement_type IN ('MASUK', 'KELUAR')),
    qty             INTEGER NOT NULL CHECK (qty > 0),
    balance_after   INTEGER NOT NULL,
    reference_no    TEXT NOT NULL DEFAULT '',
    actor           TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS stock_movements_2026_11 PARTITION OF stock_movements
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS stock_movements_2026_12 PARTITION OF stock_movements
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE IF NOT EXISTS stock_movements_default PARTITION OF stock_movements DEFAULT;

CREATE INDEX IF NOT EXISTS idx_stock_movements_med_time ON stock_movements (medication_id, created_at DESC);

-- 6. Phase 6: IPSRS, Medical Asset Calibration (Permenkes 40/2022), Utility & IPAL IoT
CREATE TABLE IF NOT EXISTS medical_assets (
    id                 TEXT PRIMARY KEY,
    asset_code         TEXT NOT NULL UNIQUE,
    name               TEXT NOT NULL,
    category           TEXT NOT NULL,
    location           TEXT NOT NULL,
    brand_model        TEXT NOT NULL DEFAULT '',
    serial_number      TEXT NOT NULL DEFAULT '',
    last_calibration   DATE,
    next_calibration   DATE,
    calibration_status TEXT NOT NULL DEFAULT 'LAIK_PAKAI',
    ppm_interval_days  INTEGER NOT NULL DEFAULT 365,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS utility_telemetry (
    id             TEXT PRIMARY KEY,
    system_name    TEXT NOT NULL,
    category       TEXT NOT NULL,
    location       TEXT NOT NULL,
    metric_label   TEXT NOT NULL,
    current_value  TEXT NOT NULL,
    threshold_info TEXT NOT NULL,
    backup_stock   TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'NORMAL',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ipal_sensors (
    id              TEXT PRIMARY KEY,
    zone_name       TEXT NOT NULL,
    sensor_type     TEXT NOT NULL,
    level_pct       INTEGER NOT NULL DEFAULT 0,
    ph_value        NUMERIC(4,2) NOT NULL DEFAULT 7.0,
    temp_c          NUMERIC(4,1) NOT NULL DEFAULT 28.0,
    status          TEXT NOT NULL DEFAULT 'OPTIMAL',
    last_cleaned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ipsrs_work_orders (
    id            TEXT PRIMARY KEY,
    ticket_no     TEXT NOT NULL UNIQUE,
    asset_or_zone TEXT NOT NULL,
    issue_type    TEXT NOT NULL,
    priority      TEXT NOT NULL DEFAULT 'SEDANG',
    technician    TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'OPEN',
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Phase 7: Nutrition, CSSD Sterilization, Ambulances & Parking
CREATE TABLE IF NOT EXISTS nutrition_orders (
    id            TEXT PRIMARY KEY,
    patient_name  TEXT NOT NULL,
    ward_room     TEXT NOT NULL,
    diet_type     TEXT NOT NULL,
    meal_slot     TEXT NOT NULL,
    allergies     TEXT NOT NULL DEFAULT 'Tidak ada',
    calories_kcal INTEGER NOT NULL DEFAULT 1800,
    status        TEXT NOT NULL DEFAULT 'DIRACIK',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cssd_batches (
    id            TEXT PRIMARY KEY,
    batch_no      TEXT NOT NULL UNIQUE,
    set_name      TEXT NOT NULL,
    unit_origin   TEXT NOT NULL,
    method        TEXT NOT NULL,
    temp_c        NUMERIC(5,1) NOT NULL DEFAULT 134.0,
    pressure_bar  NUMERIC(4,2) NOT NULL DEFAULT 2.1,
    bio_indicator TEXT NOT NULL DEFAULT 'PROSES',
    status        TEXT NOT NULL DEFAULT 'DEKONTAMINASI',
    expires_at    DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS ambulances (
    id              TEXT PRIMARY KEY,
    plate_no        TEXT NOT NULL UNIQUE,
    unit_name       TEXT NOT NULL,
    type            TEXT NOT NULL,
    driver_name     TEXT NOT NULL DEFAULT '',
    paramedic_name  TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'STANDBY',
    current_mission TEXT NOT NULL DEFAULT '',
    fuel_pct        INTEGER NOT NULL DEFAULT 100,
    oxygen_bar      INTEGER NOT NULL DEFAULT 150
);

CREATE TABLE IF NOT EXISTS parking_zones (
    id             TEXT PRIMARY KEY,
    zone_name      TEXT NOT NULL,
    vehicle_type   TEXT NOT NULL,
    total_slots    INTEGER NOT NULL,
    occupied_slots INTEGER NOT NULL DEFAULT 0,
    gate_status    TEXT NOT NULL DEFAULT 'OPEN_AUTO',
    daily_revenue  BIGINT NOT NULL DEFAULT 0
);
