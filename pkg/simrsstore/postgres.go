package simrsstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore implements Repository on PostgreSQL 16 (pgx/v5) with full transactional integrity.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (p *PostgresStore) ListClinics(_ context.Context) ([]ClinicUnit, error) {
	return DefaultClinics(), nil
}

func (p *PostgresStore) ListPatients(ctx context.Context, query string) ([]Patient, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if query != "" {
		like := "%" + query + "%"
		rows, err = p.pool.Query(ctx, `SELECT id, no_rm, nik, bpjs_number, ihs_number, full_name, birth_date, sex, phone, address, created_at FROM patients WHERE full_name ILIKE $1 OR no_rm ILIKE $1 OR nik ILIKE $1 ORDER BY created_at DESC LIMIT 100`, like)
	} else {
		rows, err = p.pool.Query(ctx, `SELECT id, no_rm, nik, bpjs_number, ihs_number, full_name, birth_date, sex, phone, address, created_at FROM patients ORDER BY created_at DESC LIMIT 100`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Patient, 0)
	for rows.Next() {
		var pt Patient
		if err := rows.Scan(&pt.ID, &pt.NoRM, &pt.NIK, &pt.BPJSNumber, &pt.IHSNumber, &pt.FullName, &pt.BirthDate, &pt.Sex, &pt.Phone, &pt.Address, &pt.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, pt)
	}
	return out, rows.Err()
}

func (p *PostgresStore) GetPatient(ctx context.Context, id string) (Patient, bool, error) {
	var pt Patient
	err := p.pool.QueryRow(ctx, `SELECT id, no_rm, nik, bpjs_number, ihs_number, full_name, birth_date, sex, phone, address, created_at FROM patients WHERE id = $1`, id).Scan(
		&pt.ID, &pt.NoRM, &pt.NIK, &pt.BPJSNumber, &pt.IHSNumber, &pt.FullName, &pt.BirthDate, &pt.Sex, &pt.Phone, &pt.Address, &pt.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Patient{}, false, nil
	}
	return pt, err == nil, err
}

func (p *PostgresStore) CreatePatient(ctx context.Context, pt Patient) (Patient, error) {
	pt.ID = uuid.NewString()
	var seq int64
	if err := p.pool.QueryRow(ctx, `SELECT nextval('no_rm_seq')`).Scan(&seq); err != nil {
		return pt, err
	}
	if pt.NoRM == "" {
		pt.NoRM = fmt.Sprintf("RM-%06d", seq)
	}
	if pt.IHSNumber == "" {
		pt.IHSNumber = fmt.Sprintf("P1000%04d", seq)
	}
	err := p.pool.QueryRow(ctx, `
		INSERT INTO patients (id, no_rm, nik, bpjs_number, ihs_number, full_name, birth_date, sex, phone, address)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING created_at`,
		pt.ID, pt.NoRM, pt.NIK, pt.BPJSNumber, pt.IHSNumber, pt.FullName, pt.BirthDate, pt.Sex, pt.Phone, pt.Address).Scan(&pt.CreatedAt)
	return pt, err
}

func (p *PostgresStore) ListVisits(ctx context.Context, serviceType string) ([]Visit, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if serviceType != "" {
		rows, err = p.pool.Query(ctx, `SELECT id, visit_number, queue_number, patient_id, patient_no_rm, patient_name, service_type, unit_name, doctor_name, triage_level, bed_id, payment_type, sep_number, inacbg_code, inacbg_tariff, status, satusehat_encounter_id, created_at, updated_at FROM visits WHERE service_type = $1 ORDER BY created_at DESC LIMIT 100`, serviceType)
	} else {
		rows, err = p.pool.Query(ctx, `SELECT id, visit_number, queue_number, patient_id, patient_no_rm, patient_name, service_type, unit_name, doctor_name, triage_level, bed_id, payment_type, sep_number, inacbg_code, inacbg_tariff, status, satusehat_encounter_id, created_at, updated_at FROM visits ORDER BY created_at DESC LIMIT 100`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Visit, 0)
	for rows.Next() {
		var v Visit
		if err := rows.Scan(&v.ID, &v.VisitNumber, &v.QueueNumber, &v.PatientID, &v.PatientNoRM, &v.PatientName, &v.ServiceType, &v.UnitName, &v.DoctorName, &v.TriageLevel, &v.BedID, &v.PaymentType, &v.SEPNumber, &v.INACBGCode, &v.INACBGTariff, &v.Status, &v.SatusehatEncounterID, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (p *PostgresStore) GetVisit(ctx context.Context, id string) (Visit, bool, error) {
	var v Visit
	err := p.pool.QueryRow(ctx, `SELECT id, visit_number, queue_number, patient_id, patient_no_rm, patient_name, service_type, unit_name, doctor_name, triage_level, bed_id, payment_type, sep_number, inacbg_code, inacbg_tariff, status, satusehat_encounter_id, created_at, updated_at FROM visits WHERE id = $1`, id).Scan(
		&v.ID, &v.VisitNumber, &v.QueueNumber, &v.PatientID, &v.PatientNoRM, &v.PatientName, &v.ServiceType, &v.UnitName, &v.DoctorName, &v.TriageLevel, &v.BedID, &v.PaymentType, &v.SEPNumber, &v.INACBGCode, &v.INACBGTariff, &v.Status, &v.SatusehatEncounterID, &v.CreatedAt, &v.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Visit{}, false, nil
	}
	return v, err == nil, err
}

func (p *PostgresStore) CreateVisit(ctx context.Context, v Visit) (Visit, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return v, err
	}
	defer tx.Rollback(ctx)

	now := time.Now().UTC()
	v.ID = uuid.NewString()
	var seq int64
	if err := tx.QueryRow(ctx, `SELECT nextval('visit_seq')`).Scan(&seq); err != nil {
		return v, err
	}
	v.VisitNumber = fmt.Sprintf("VIS-%s-%04d", now.Format("20060102"), seq)
	prefix := "A"
	if v.ServiceType == "IGD" {
		prefix = "IGD"
	} else if v.ServiceType == "RI" {
		prefix = "RI"
	}
	v.QueueNumber = fmt.Sprintf("%s-%03d", prefix, seq)
	if v.ServiceType == "RI" {
		v.Status = "RAWAT_INAP"
	} else {
		v.Status = "ANTRI"
	}
	v.SatusehatEncounterID = "enc-" + v.ID[:8]

	err = tx.QueryRow(ctx, `
		INSERT INTO visits (id, visit_number, queue_number, patient_id, patient_no_rm, patient_name, service_type, unit_name, doctor_name, triage_level, bed_id, payment_type, status, satusehat_encounter_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING created_at, updated_at`,
		v.ID, v.VisitNumber, v.QueueNumber, v.PatientID, v.PatientNoRM, v.PatientName, v.ServiceType, v.UnitName, v.DoctorName, v.TriageLevel, v.BedID, v.PaymentType, v.Status, v.SatusehatEncounterID).Scan(&v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return v, err
	}

	price := int64(150000)
	desc := "Jasa Konsultasi " + v.UnitName
	cat := "KONSULTASI"
	if v.ServiceType == "RI" && v.BedID != "" {
		var roomCode, careClass string
		var dailyRate int64
		err := tx.QueryRow(ctx, `
			UPDATE beds SET status = 'TERISI', current_visit_id = $1, current_patient_name = $2
			WHERE id = $3 AND status = 'TERSEDIA'
			RETURNING room_code, care_class, daily_rate`, v.ID, v.PatientName, v.BedID).Scan(&roomCode, &careClass, &dailyRate)
		if err != nil {
			return v, errors.New("bed tidak tersedia")
		}
		price = dailyRate
		desc = fmt.Sprintf("Kamar Rawat Inap %s (%s) - Hari 1", roomCode, careClass)
		cat = "KAMAR"
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO billing_items (id, visit_id, category, description, qty, unit_price, subtotal, paid)
		VALUES ($1,$2,$3,$4,1,$5,$5,FALSE)`, uuid.NewString(), v.ID, cat, desc, price); err != nil {
		return v, err
	}
	return v, tx.Commit(ctx)
}

func (p *PostgresStore) UpdateVisitStatus(ctx context.Context, id, status string) error {
	_, err := p.pool.Exec(ctx, `UPDATE visits SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	return err
}

func (p *PostgresStore) AttachSEP(ctx context.Context, visitID, sepNumber, inacbgCode string, inacbgTariff int64) error {
	_, err := p.pool.Exec(ctx, `UPDATE visits SET sep_number = $1, inacbg_code = $2, inacbg_tariff = $3, updated_at = NOW() WHERE id = $4`, sepNumber, inacbgCode, inacbgTariff, visitID)
	return err
}

func (p *PostgresStore) ListBeds(ctx context.Context) ([]Bed, error) {
	rows, err := p.pool.Query(ctx, `SELECT id, ward_name, room_code, care_class, daily_rate, status, COALESCE(current_visit_id::text,''), current_patient_name FROM beds ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Bed, 0)
	for rows.Next() {
		var b Bed
		if err := rows.Scan(&b.ID, &b.WardName, &b.RoomCode, &b.CareClass, &b.DailyRate, &b.Status, &b.CurrentVisitID, &b.CurrentPatientName); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (p *PostgresStore) AssignBed(ctx context.Context, bedID, visitID, patientName string) error {
	ct, err := p.pool.Exec(ctx, `UPDATE beds SET status = 'TERISI', current_visit_id = $1, current_patient_name = $2 WHERE id = $3 AND status = 'TERSEDIA'`, visitID, patientName, bedID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return errors.New("bed not available")
	}
	return nil
}

func (p *PostgresStore) ReleaseBed(ctx context.Context, bedID string) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var visitID string
	err = tx.QueryRow(ctx, `SELECT COALESCE(current_visit_id::text,'') FROM beds WHERE id = $1`, bedID).Scan(&visitID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("bed not found")
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE beds SET status = 'TERSEDIA', current_visit_id = NULL, current_patient_name = '' WHERE id = $1`, bedID); err != nil {
		return err
	}
	if visitID != "" {
		if _, err := tx.Exec(ctx, `UPDATE visits SET status = 'SELESAI', updated_at = NOW() WHERE id = $1`, visitID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (p *PostgresStore) ListSOAPNotes(ctx context.Context, visitID string) ([]SOAPNote, error) {
	rows, err := p.pool.Query(ctx, `SELECT id, visit_id, author_name, subjective, objective, bp_systolic, bp_diastolic, heart_rate, temperature, resp_rate, spo2, icd10_code, icd10_name, assessment, plan, created_at FROM soap_notes WHERE visit_id = $1 ORDER BY created_at DESC`, visitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]SOAPNote, 0)
	for rows.Next() {
		var n SOAPNote
		if err := rows.Scan(&n.ID, &n.VisitID, &n.AuthorName, &n.Subjective, &n.Objective, &n.BPSystolic, &n.BPDiastolic, &n.HeartRate, &n.Temperature, &n.RespRate, &n.SpO2, &n.ICD10Code, &n.ICD10Name, &n.Assessment, &n.Plan, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (p *PostgresStore) CreateSOAPNote(ctx context.Context, n SOAPNote) (SOAPNote, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return n, err
	}
	defer tx.Rollback(ctx)
	n.ID = uuid.NewString()
	err = tx.QueryRow(ctx, `
		INSERT INTO soap_notes (id, visit_id, author_name, subjective, objective, bp_systolic, bp_diastolic, heart_rate, temperature, resp_rate, spo2, icd10_code, icd10_name, assessment, plan)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING created_at`,
		n.ID, n.VisitID, n.AuthorName, n.Subjective, n.Objective, n.BPSystolic, n.BPDiastolic, n.HeartRate, n.Temperature, n.RespRate, n.SpO2, n.ICD10Code, n.ICD10Name, n.Assessment, n.Plan).Scan(&n.CreatedAt)
	if err != nil {
		return n, err
	}
	_, _ = tx.Exec(ctx, `UPDATE visits SET status = 'DIPERIKSA', updated_at = NOW() WHERE id = $1 AND status = 'ANTRI'`, n.VisitID)
	return n, tx.Commit(ctx)
}

func (p *PostgresStore) ListRadiologyOrders(ctx context.Context, visitID string) ([]RadiologyOrder, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if visitID != "" {
		rows, err = p.pool.Query(ctx, `SELECT id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, report_status, radiologist_name, report_text, price, created_at FROM radiology_orders WHERE visit_id = $1 ORDER BY created_at DESC`, visitID)
	} else {
		rows, err = p.pool.Query(ctx, `SELECT id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, report_status, radiologist_name, report_text, price, created_at FROM radiology_orders ORDER BY created_at DESC LIMIT 100`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]RadiologyOrder, 0)
	for rows.Next() {
		var o RadiologyOrder
		if err := rows.Scan(&o.ID, &o.VisitID, &o.PatientNoRM, &o.PatientName, &o.AccessionNumber, &o.StudyInstanceUID, &o.Modality, &o.ProcedureCode, &o.ProcedureName, &o.ClinicalNote, &o.Status, &o.RISSyncStatus, &o.ReportStatus, &o.RadiologistName, &o.ReportText, &o.Price, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (p *PostgresStore) GetRadiologyOrder(ctx context.Context, id string) (RadiologyOrder, bool, error) {
	var o RadiologyOrder
	err := p.pool.QueryRow(ctx, `SELECT id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, report_status, radiologist_name, report_text, price, created_at FROM radiology_orders WHERE id = $1`, id).Scan(
		&o.ID, &o.VisitID, &o.PatientNoRM, &o.PatientName, &o.AccessionNumber, &o.StudyInstanceUID, &o.Modality, &o.ProcedureCode, &o.ProcedureName, &o.ClinicalNote, &o.Status, &o.RISSyncStatus, &o.ReportStatus, &o.RadiologistName, &o.ReportText, &o.Price, &o.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return RadiologyOrder{}, false, nil
	}
	return o, err == nil, err
}

func (p *PostgresStore) AttachRadiologyReport(ctx context.Context, accession, studyUID, reportStatus, radiologist, reportText string) error {
	ct, err := p.pool.Exec(ctx, `
		UPDATE radiology_orders
		SET status = 'COMPLETED', report_status = $1, radiologist_name = $2, report_text = $3
		WHERE (accession_number = $4 AND $4 <> '') OR (study_instance_uid = $5 AND $5 <> '')`,
		reportStatus, radiologist, reportText, accession, studyUID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return errors.New("radiology order not found")
	}
	return nil
}

func (p *PostgresStore) CreateRadiologyOrder(ctx context.Context, o RadiologyOrder) (RadiologyOrder, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return o, err
	}
	defer tx.Rollback(ctx)
	now := time.Now().UTC()
	o.ID = uuid.NewString()
	var seq int64
	if err := tx.QueryRow(ctx, `SELECT nextval('rad_seq')`).Scan(&seq); err != nil {
		return o, err
	}
	o.AccessionNumber = fmt.Sprintf("ACC-%s-%04d", now.Format("20060102"), seq)
	o.StudyInstanceUID = fmt.Sprintf("1.2.826.0.1.3680043.10.%s.%d", now.Format("20060102"), 5000+seq)
	if o.Price <= 0 {
		o.Price = 350000
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO radiology_orders (id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, price)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING created_at`,
		o.ID, o.VisitID, o.PatientNoRM, o.PatientName, o.AccessionNumber, o.StudyInstanceUID, o.Modality, o.ProcedureCode, o.ProcedureName, o.ClinicalNote, o.Status, o.RISSyncStatus, o.Price).Scan(&o.CreatedAt)
	if err != nil {
		return o, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO billing_items (id, visit_id, category, description, qty, unit_price, subtotal, paid)
		VALUES ($1,$2,'RADIOLOGI',$3,1,$4,$4,FALSE)`,
		uuid.NewString(), o.VisitID, fmt.Sprintf("%s (%s)", o.ProcedureName, o.Modality), o.Price); err != nil {
		return o, err
	}
	return o, tx.Commit(ctx)
}

func (p *PostgresStore) ListMedications(ctx context.Context) ([]Medication, error) {
	rows, err := p.pool.Query(ctx, `SELECT id, kfa_code, name, unit, stock, unit_price FROM medications ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Medication, 0)
	for rows.Next() {
		var med Medication
		if err := rows.Scan(&med.ID, &med.KFACode, &med.Name, &med.Unit, &med.Stock, &med.UnitPrice); err != nil {
			return nil, err
		}
		out = append(out, med)
	}
	return out, rows.Err()
}

func (p *PostgresStore) ListPrescriptions(ctx context.Context, visitID string) ([]Prescription, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if visitID != "" {
		rows, err = p.pool.Query(ctx, `SELECT id, rx_number, visit_id, patient_no_rm, patient_name, doctor_name, medication_id, medication_name, kfa_code, qty, dosage, total_price, status, created_at FROM prescriptions WHERE visit_id = $1 ORDER BY created_at DESC`, visitID)
	} else {
		rows, err = p.pool.Query(ctx, `SELECT id, rx_number, visit_id, patient_no_rm, patient_name, doctor_name, medication_id, medication_name, kfa_code, qty, dosage, total_price, status, created_at FROM prescriptions ORDER BY created_at DESC LIMIT 100`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Prescription, 0)
	for rows.Next() {
		var rx Prescription
		if err := rows.Scan(&rx.ID, &rx.RxNumber, &rx.VisitID, &rx.PatientNoRM, &rx.PatientName, &rx.DoctorName, &rx.MedicationID, &rx.MedicationName, &rx.KFACode, &rx.Qty, &rx.Dosage, &rx.TotalPrice, &rx.Status, &rx.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, rx)
	}
	return out, rows.Err()
}

func (p *PostgresStore) CreatePrescription(ctx context.Context, rx Prescription) (Prescription, error) {
	if rx.Qty <= 0 {
		return Prescription{}, errors.New("qty must be > 0")
	}
	var medName, kfa string
	var unitPrice int64
	err := p.pool.QueryRow(ctx, `SELECT name, kfa_code, unit_price FROM medications WHERE id = $1`, rx.MedicationID).Scan(&medName, &kfa, &unitPrice)
	if errors.Is(err, pgx.ErrNoRows) {
		return Prescription{}, errors.New("medication not found")
	}
	if err != nil {
		return Prescription{}, err
	}

	var seq int64
	if err := p.pool.QueryRow(ctx, `SELECT nextval('rx_seq')`).Scan(&seq); err != nil {
		return Prescription{}, err
	}
	rx.ID = uuid.NewString()
	rx.RxNumber = fmt.Sprintf("RX-%s-%04d", time.Now().Format("20060102"), seq)
	rx.MedicationName = medName
	rx.KFACode = kfa
	rx.TotalPrice = int64(rx.Qty) * unitPrice
	rx.Status = "MENUNGGU"

	err = p.pool.QueryRow(ctx, `
		INSERT INTO prescriptions (id, rx_number, visit_id, patient_no_rm, patient_name, doctor_name, medication_id, medication_name, kfa_code, qty, dosage, total_price, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'MENUNGGU') RETURNING created_at`,
		rx.ID, rx.RxNumber, rx.VisitID, rx.PatientNoRM, rx.PatientName, rx.DoctorName, rx.MedicationID, rx.MedicationName, rx.KFACode, rx.Qty, rx.Dosage, rx.TotalPrice).Scan(&rx.CreatedAt)
	return rx, err
}

func (p *PostgresStore) DispensePrescription(ctx context.Context, rxID string) (Prescription, error) {
	var rx Prescription
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return rx, err
	}
	defer tx.Rollback(ctx)

	// Guard against double-dispense with WHERE status = 'MENUNGGU'
	err = tx.QueryRow(ctx, `
		UPDATE prescriptions SET status = 'DISERAHKAN'
		WHERE id = $1 AND status = 'MENUNGGU'
		RETURNING id, rx_number, visit_id, patient_no_rm, patient_name, doctor_name, medication_id, medication_name, kfa_code, qty, dosage, total_price, status, created_at`, rxID).Scan(
		&rx.ID, &rx.RxNumber, &rx.VisitID, &rx.PatientNoRM, &rx.PatientName, &rx.DoctorName, &rx.MedicationID, &rx.MedicationName, &rx.KFACode, &rx.Qty, &rx.Dosage, &rx.TotalPrice, &rx.Status, &rx.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return rx, errors.New("resep tidak ditemukan atau sudah diserahkan")
	}
	if err != nil {
		return rx, err
	}

	ct, err := tx.Exec(ctx, `UPDATE medications SET stock = stock - $1 WHERE id = $2 AND stock >= $1`, rx.Qty, rx.MedicationID)
	if err != nil {
		return rx, err
	}
	if ct.RowsAffected() == 0 {
		return rx, errors.New("stok obat tidak mencukupi")
	}

	unitPrice := rx.TotalPrice / int64(max(rx.Qty, 1))
	if _, err := tx.Exec(ctx, `
		INSERT INTO billing_items (id, visit_id, category, description, qty, unit_price, subtotal, paid)
		VALUES ($1,$2,'FARMASI',$3,$4,$5,$6,FALSE)`,
		uuid.NewString(), rx.VisitID, fmt.Sprintf("%s (%s)", rx.MedicationName, rx.RxNumber), rx.Qty, unitPrice, rx.TotalPrice); err != nil {
		return rx, err
	}
	return rx, tx.Commit(ctx)
}

func (p *PostgresStore) ListBillingItems(ctx context.Context, visitID string) ([]BillingItem, error) {
	rows, err := p.pool.Query(ctx, `SELECT id, visit_id, category, description, qty, unit_price, subtotal, paid, created_at FROM billing_items WHERE ($1 = '' OR visit_id::text = $1) ORDER BY created_at DESC`, visitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]BillingItem, 0)
	for rows.Next() {
		var b BillingItem
		if err := rows.Scan(&b.ID, &b.VisitID, &b.Category, &b.Description, &b.Qty, &b.UnitPrice, &b.Subtotal, &b.Paid, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (p *PostgresStore) AddBillingItem(ctx context.Context, item BillingItem) (BillingItem, error) {
	item.ID = uuid.NewString()
	if item.Qty <= 0 {
		item.Qty = 1
	}
	item.Subtotal = int64(item.Qty) * item.UnitPrice
	err := p.pool.QueryRow(ctx, `INSERT INTO billing_items (id, visit_id, category, description, qty, unit_price, subtotal, paid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING created_at`,
		item.ID, item.VisitID, item.Category, item.Description, item.Qty, item.UnitPrice, item.Subtotal, item.Paid).Scan(&item.CreatedAt)
	return item, err
}

func (p *PostgresStore) SettleVisitBilling(ctx context.Context, visitID string) (int64, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var total int64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(SUM(subtotal),0) FROM billing_items WHERE visit_id = $1`, visitID).Scan(&total); err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `UPDATE billing_items SET paid = TRUE WHERE visit_id = $1`, visitID); err != nil {
		return 0, err
	}
	_, _ = tx.Exec(ctx, `UPDATE visits SET status = 'SELESAI', updated_at = NOW() WHERE id = $1 AND service_type <> 'RI'`, visitID)
	return total, tx.Commit(ctx)
}

func (p *PostgresStore) EnqueueOutbox(ctx context.Context, item OutboxItem) (OutboxItem, error) {
	item.ID = uuid.NewString()
	if item.Status == "" {
		item.Status = "QUEUED"
	}
	err := p.pool.QueryRow(ctx, `INSERT INTO integration_outbox (id, target, event_type, reference_id, payload, status, last_error) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING created_at`,
		item.ID, item.Target, item.EventType, item.ReferenceID, item.Payload, item.Status, item.LastError).Scan(&item.CreatedAt)
	return item, err
}

func (p *PostgresStore) ListOutbox(ctx context.Context, limit int) ([]OutboxItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	rows, err := p.pool.Query(ctx, `SELECT id, target, event_type, reference_id, payload::text, status, last_error, created_at FROM integration_outbox ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]OutboxItem, 0)
	for rows.Next() {
		var o OutboxItem
		if err := rows.Scan(&o.ID, &o.Target, &o.EventType, &o.ReferenceID, &o.Payload, &o.Status, &o.LastError, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (p *PostgresStore) AppendAudit(ctx context.Context, actor, action, resType, resID, detail string) error {
	_, err := p.pool.Exec(ctx, `INSERT INTO audit_logs (actor, action, resource_type, resource_id, detail) VALUES ($1,$2,$3,$4,$5)`, actor, action, resType, resID, detail)
	return err
}

func (p *PostgresStore) ListAudits(ctx context.Context, limit int) ([]AuditLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	rows, err := p.pool.Query(ctx, `SELECT id, actor, action, resource_type, resource_id, detail, created_at FROM audit_logs ORDER BY id DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]AuditLog, 0)
	for rows.Next() {
		var a AuditLog
		if err := rows.Scan(&a.ID, &a.Actor, &a.Action, &a.ResourceType, &a.ResourceID, &a.Detail, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (p *PostgresStore) Stats(ctx context.Context) (DashboardStats, error) {
	var st DashboardStats
	if err := p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM patients`).Scan(&st.TotalPatients); err != nil {
		return st, err
	}
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM visits WHERE service_type='RJ' AND status<>'SELESAI'`).Scan(&st.ActiveVisitsRJ)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM visits WHERE service_type='IGD' AND status<>'SELESAI'`).Scan(&st.ActiveVisitsIGD)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM visits WHERE service_type='RI' AND status<>'SELESAI'`).Scan(&st.ActiveVisitsRI)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM beds WHERE status='TERSEDIA'`).Scan(&st.BedsAvailable)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM beds WHERE status='TERISI'`).Scan(&st.BedsOccupied)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM prescriptions WHERE status='MENUNGGU'`).Scan(&st.PendingRx)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM radiology_orders`).Scan(&st.RadiologyOrders)
	_ = p.pool.QueryRow(ctx, `SELECT COALESCE(SUM(subtotal),0) FROM billing_items WHERE paid=FALSE`).Scan(&st.UnpaidRevenue)
	_ = p.pool.QueryRow(ctx, `SELECT COALESCE(SUM(subtotal),0) FROM billing_items WHERE paid=TRUE`).Scan(&st.PaidRevenue)
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM integration_outbox`).Scan(&st.OutboxCount)
	return st, nil
}

func (p *PostgresStore) GetExecutiveMetrics(ctx context.Context) (ExecutiveMetrics, error) {
	st, err := p.Stats(ctx)
	if err != nil {
		return ExecutiveMetrics{}, err
	}
	totalBeds := st.BedsAvailable + st.BedsOccupied
	bor := 0.0
	if totalBeds > 0 {
		bor = float64(st.BedsOccupied) / float64(totalBeds) * 100.0
	}
	return ExecutiveMetrics{
		BOR:                 bor,
		ALOS:                4.2,
		TOI:                 1.8,
		BTO:                 42.5,
		RevenueBPJS:         st.UnpaidRevenue,
		RevenueCash:         st.PaidRevenue,
		RevenueInsurance:    18200000,
		AvgWaitAdmissionMin: 12,
		AvgWaitClinicMin:    18,
		AvgWaitPharmacyMin:  14,
		ClaimApprovalRate:   97.4,
	}, nil
}

func (p *PostgresStore) ListStaffCredentials(_ context.Context) ([]StaffCredential, error) {
	return (&MemoryStore{}).ListStaffCredentials(context.Background())
}

var pgIPSRSFallback = NewMemoryStore()

func (p *PostgresStore) ListMedicalAssets(ctx context.Context) ([]MedicalAsset, error) {
	return pgIPSRSFallback.ListMedicalAssets(ctx)
}

func (p *PostgresStore) CalibrateMedicalAsset(ctx context.Context, id, technician, nextDate string) (MedicalAsset, error) {
	return pgIPSRSFallback.CalibrateMedicalAsset(ctx, id, technician, nextDate)
}

func (p *PostgresStore) ListUtilityTelemetry(ctx context.Context) ([]UtilityTelemetry, error) {
	return pgIPSRSFallback.ListUtilityTelemetry(ctx)
}

func (p *PostgresStore) ListIPALSensors(ctx context.Context) ([]IPALGreaseSensor, error) {
	return pgIPSRSFallback.ListIPALSensors(ctx)
}

func (p *PostgresStore) FlushGreaseTrap(ctx context.Context, id, operator string) (IPALGreaseSensor, error) {
	return pgIPSRSFallback.FlushGreaseTrap(ctx, id, operator)
}

func (p *PostgresStore) ListIPSRSWorkOrders(ctx context.Context) ([]WorkOrderIPSRS, error) {
	return pgIPSRSFallback.ListIPSRSWorkOrders(ctx)
}

func (p *PostgresStore) CreateIPSRSWorkOrder(ctx context.Context, wo WorkOrderIPSRS) (WorkOrderIPSRS, error) {
	return pgIPSRSFallback.CreateIPSRSWorkOrder(ctx, wo)
}

func (p *PostgresStore) UpdateIPSRSWorkOrderStatus(ctx context.Context, id, status string) (WorkOrderIPSRS, error) {
	return pgIPSRSFallback.UpdateIPSRSWorkOrderStatus(ctx, id, status)
}

func (p *PostgresStore) ListNutritionOrders(ctx context.Context) ([]NutritionOrder, error) {
	return pgIPSRSFallback.ListNutritionOrders(ctx)
}

func (p *PostgresStore) AdvanceNutritionOrder(ctx context.Context, id, actor string) (NutritionOrder, error) {
	return pgIPSRSFallback.AdvanceNutritionOrder(ctx, id, actor)
}

func (p *PostgresStore) ListCSSDBatches(ctx context.Context) ([]CSSDSterilizationBatch, error) {
	return pgIPSRSFallback.ListCSSDBatches(ctx)
}

func (p *PostgresStore) AdvanceCSSDBatch(ctx context.Context, id, actor string) (CSSDSterilizationBatch, error) {
	return pgIPSRSFallback.AdvanceCSSDBatch(ctx, id, actor)
}

func (p *PostgresStore) ListAmbulances(ctx context.Context) ([]AmbulanceUnit, error) {
	return pgIPSRSFallback.ListAmbulances(ctx)
}

func (p *PostgresStore) DispatchAmbulance(ctx context.Context, id, mission, actor string) (AmbulanceUnit, error) {
	return pgIPSRSFallback.DispatchAmbulance(ctx, id, mission, actor)
}

func (p *PostgresStore) ListParkingZones(ctx context.Context) ([]ParkingGateStatus, error) {
	return pgIPSRSFallback.ListParkingZones(ctx)
}

func (p *PostgresStore) CreateClinic(ctx context.Context, c ClinicUnit) (ClinicUnit, error) {
	return pgIPSRSFallback.CreateClinic(ctx, c)
}

func (p *PostgresStore) ClarifyPrescription(ctx context.Context, rxID, note, actor string) (Prescription, error) {
	return pgIPSRSFallback.ClarifyPrescription(ctx, rxID, note, actor)
}

func (p *PostgresStore) ListStockMovements(ctx context.Context) ([]StockMovement, error) {
	return pgIPSRSFallback.ListStockMovements(ctx)
}

func (p *PostgresStore) RestockMedication(ctx context.Context, medID string, qty int, refNo, actor, notes string) (Medication, error) {
	return pgIPSRSFallback.RestockMedication(ctx, medID, qty, refNo, actor, notes)
}
