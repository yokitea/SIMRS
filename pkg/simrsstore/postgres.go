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

// PostgresStore implements Repository on PostgreSQL 16 (pgx/v5).
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
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
	if pt.ID == "" {
		pt.ID = uuid.NewString()
	}
	if pt.NoRM == "" {
		pt.NoRM = fmt.Sprintf("RM-%06d", time.Now().Unix()%1000000)
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
	now := time.Now().UTC()
	if v.ID == "" {
		v.ID = uuid.NewString()
	}
	if v.VisitNumber == "" {
		v.VisitNumber = fmt.Sprintf("VIS-%s-%04d", now.Format("20060102"), now.Unix()%10000)
	}
	if v.Status == "" {
		v.Status = "ANTRI"
	}
	err := p.pool.QueryRow(ctx, `
		INSERT INTO visits (id, visit_number, queue_number, patient_id, patient_no_rm, patient_name, service_type, unit_name, doctor_name, triage_level, bed_id, payment_type, status, satusehat_encounter_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING created_at, updated_at`,
		v.ID, v.VisitNumber, v.QueueNumber, v.PatientID, v.PatientNoRM, v.PatientName, v.ServiceType, v.UnitName, v.DoctorName, v.TriageLevel, v.BedID, v.PaymentType, v.Status, v.SatusehatEncounterID).Scan(&v.CreatedAt, &v.UpdatedAt)
	return v, err
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
	_, err := p.pool.Exec(ctx, `UPDATE beds SET status = 'TERISI', current_visit_id = $1, current_patient_name = $2 WHERE id = $3`, visitID, patientName, bedID)
	return err
}

func (p *PostgresStore) ReleaseBed(ctx context.Context, bedID string) error {
	_, err := p.pool.Exec(ctx, `UPDATE beds SET status = 'TERSEDIA', current_visit_id = NULL, current_patient_name = '' WHERE id = $1`, bedID)
	return err
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
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	err := p.pool.QueryRow(ctx, `
		INSERT INTO soap_notes (id, visit_id, author_name, subjective, objective, bp_systolic, bp_diastolic, heart_rate, temperature, resp_rate, spo2, icd10_code, icd10_name, assessment, plan)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING created_at`,
		n.ID, n.VisitID, n.AuthorName, n.Subjective, n.Objective, n.BPSystolic, n.BPDiastolic, n.HeartRate, n.Temperature, n.RespRate, n.SpO2, n.ICD10Code, n.ICD10Name, n.Assessment, n.Plan).Scan(&n.CreatedAt)
	return n, err
}

func (p *PostgresStore) ListRadiologyOrders(ctx context.Context, visitID string) ([]RadiologyOrder, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if visitID != "" {
		rows, err = p.pool.Query(ctx, `SELECT id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, price, created_at FROM radiology_orders WHERE visit_id = $1 ORDER BY created_at DESC`, visitID)
	} else {
		rows, err = p.pool.Query(ctx, `SELECT id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, price, created_at FROM radiology_orders ORDER BY created_at DESC LIMIT 100`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]RadiologyOrder, 0)
	for rows.Next() {
		var o RadiologyOrder
		if err := rows.Scan(&o.ID, &o.VisitID, &o.PatientNoRM, &o.PatientName, &o.AccessionNumber, &o.StudyInstanceUID, &o.Modality, &o.ProcedureCode, &o.ProcedureName, &o.ClinicalNote, &o.Status, &o.RISSyncStatus, &o.Price, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (p *PostgresStore) CreateRadiologyOrder(ctx context.Context, o RadiologyOrder) (RadiologyOrder, error) {
	if o.ID == "" {
		o.ID = uuid.NewString()
	}
	err := p.pool.QueryRow(ctx, `
		INSERT INTO radiology_orders (id, visit_id, patient_no_rm, patient_name, accession_number, study_instance_uid, modality, procedure_code, procedure_name, clinical_note, status, ris_sync_status, price)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING created_at`,
		o.ID, o.VisitID, o.PatientNoRM, o.PatientName, o.AccessionNumber, o.StudyInstanceUID, o.Modality, o.ProcedureCode, o.ProcedureName, o.ClinicalNote, o.Status, o.RISSyncStatus, o.Price).Scan(&o.CreatedAt)
	return o, err
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
	if rx.ID == "" {
		rx.ID = uuid.NewString()
	}
	if rx.RxNumber == "" {
		rx.RxNumber = fmt.Sprintf("RX-%s-%04d", time.Now().Format("20060102"), time.Now().Unix()%10000)
	}
	err := p.pool.QueryRow(ctx, `
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
	err = tx.QueryRow(ctx, `UPDATE prescriptions SET status = 'DISERAHKAN' WHERE id = $1 RETURNING id, rx_number, visit_id, patient_no_rm, patient_name, doctor_name, medication_id, medication_name, kfa_code, qty, dosage, total_price, status, created_at`, rxID).Scan(
		&rx.ID, &rx.RxNumber, &rx.VisitID, &rx.PatientNoRM, &rx.PatientName, &rx.DoctorName, &rx.MedicationID, &rx.MedicationName, &rx.KFACode, &rx.Qty, &rx.Dosage, &rx.TotalPrice, &rx.Status, &rx.CreatedAt,
	)
	if err != nil {
		return rx, err
	}
	_, err = tx.Exec(ctx, `UPDATE medications SET stock = GREATEST(stock - $1, 0) WHERE id = $2`, rx.Qty, rx.MedicationID)
	if err != nil {
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
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	err := p.pool.QueryRow(ctx, `INSERT INTO billing_items (id, visit_id, category, description, qty, unit_price, subtotal, paid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING created_at`,
		item.ID, item.VisitID, item.Category, item.Description, item.Qty, item.UnitPrice, item.Subtotal, item.Paid).Scan(&item.CreatedAt)
	return item, err
}

func (p *PostgresStore) SettleVisitBilling(ctx context.Context, visitID string) (int64, error) {
	var total int64
	_ = p.pool.QueryRow(ctx, `SELECT COALESCE(SUM(subtotal),0) FROM billing_items WHERE visit_id = $1`, visitID).Scan(&total)
	_, err := p.pool.Exec(ctx, `UPDATE billing_items SET paid = TRUE WHERE visit_id = $1`, visitID)
	return total, err
}

func (p *PostgresStore) EnqueueOutbox(ctx context.Context, item OutboxItem) (OutboxItem, error) {
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	err := p.pool.QueryRow(ctx, `INSERT INTO integration_outbox (id, target, event_type, reference_id, payload, status, last_error) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING created_at`,
		item.ID, item.Target, item.EventType, item.ReferenceID, item.Payload, item.Status, item.LastError).Scan(&item.CreatedAt)
	return item, err
}

func (p *PostgresStore) ListOutbox(ctx context.Context, limit int) ([]OutboxItem, error) {
	rows, err := p.pool.Query(ctx, `SELECT id, target, event_type, reference_id, payload::text, status, last_error, created_at FROM integration_outbox ORDER BY created_at DESC LIMIT $1`, max(limit, 50))
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
	rows, err := p.pool.Query(ctx, `SELECT id, actor, action, resource_type, resource_id, detail, created_at FROM audit_logs ORDER BY id DESC LIMIT $1`, max(limit, 50))
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
	_ = p.pool.QueryRow(ctx, `SELECT COUNT(*) FROM patients`).Scan(&st.TotalPatients)
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
