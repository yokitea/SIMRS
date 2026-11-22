package simrsstore

import (
	"context"
	"time"
)

type Patient struct {
	ID         string    `json:"id"`
	NoRM       string    `json:"no_rm"`
	NIK        string    `json:"nik"`
	BPJSNumber string    `json:"bpjs_number"`
	IHSNumber  string    `json:"ihs_number"`
	FullName   string    `json:"full_name"`
	BirthDate  string    `json:"birth_date"`
	Sex        string    `json:"sex"`
	Phone      string    `json:"phone"`
	Address    string    `json:"address"`
	CreatedAt  time.Time `json:"created_at"`
}

type Bed struct {
	ID                 string `json:"id"`
	WardName           string `json:"ward_name"`
	RoomCode           string `json:"room_code"`
	CareClass          string `json:"care_class"`
	DailyRate          int64  `json:"daily_rate"`
	Status             string `json:"status"` // TERSEDIA, TERISI, PEMBERSIHAN
	CurrentVisitID     string `json:"current_visit_id,omitempty"`
	CurrentPatientName string `json:"current_patient_name,omitempty"`
}

type Visit struct {
	ID                   string    `json:"id"`
	VisitNumber          string    `json:"visit_number"`
	QueueNumber          string    `json:"queue_number"`
	PatientID            string    `json:"patient_id"`
	PatientNoRM          string    `json:"patient_no_rm"`
	PatientName          string    `json:"patient_name"`
	ServiceType          string    `json:"service_type"` // RJ, IGD, RI
	UnitName             string    `json:"unit_name"`
	DoctorName           string    `json:"doctor_name"`
	TriageLevel          string    `json:"triage_level,omitempty"`
	BedID                string    `json:"bed_id,omitempty"`
	PaymentType          string    `json:"payment_type"` // BPJS, UMUM, ASURANSI
	SEPNumber            string    `json:"sep_number,omitempty"`
	INACBGCode           string    `json:"inacbg_code,omitempty"`
	INACBGTariff         int64     `json:"inacbg_tariff,omitempty"`
	Status               string    `json:"status"` // ANTRI, DIPERIKSA, RAWAT_INAP, SELESAI
	SatusehatEncounterID string    `json:"satusehat_encounter_id"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type SOAPNote struct {
	ID          string    `json:"id"`
	VisitID     string    `json:"visit_id"`
	AuthorName  string    `json:"author_name"`
	Subjective  string    `json:"subjective"`
	Objective   string    `json:"objective"`
	BPSystolic  int       `json:"bp_systolic"`
	BPDiastolic int       `json:"bp_diastolic"`
	HeartRate   int       `json:"heart_rate"`
	Temperature float64   `json:"temperature"`
	RespRate    int       `json:"resp_rate"`
	SpO2        int       `json:"spo2"`
	ICD10Code   string    `json:"icd10_code"`
	ICD10Name   string    `json:"icd10_name"`
	Assessment  string    `json:"assessment"`
	Plan        string    `json:"plan"`
	CreatedAt   time.Time `json:"created_at"`
}

type RadiologyOrder struct {
	ID               string    `json:"id"`
	VisitID          string    `json:"visit_id"`
	PatientNoRM      string    `json:"patient_no_rm"`
	PatientName      string    `json:"patient_name"`
	AccessionNumber  string    `json:"accession_number"`
	StudyInstanceUID string    `json:"study_instance_uid"`
	Modality         string    `json:"modality"`
	ProcedureCode    string    `json:"procedure_code"`
	ProcedureName    string    `json:"procedure_name"`
	ClinicalNote     string    `json:"clinical_note"`
	Status           string    `json:"status"`
	RISSyncStatus    string    `json:"ris_sync_status"`
	ReportStatus     string    `json:"report_status,omitempty"`
	RadiologistName  string    `json:"radiologist_name,omitempty"`
	ReportText       string    `json:"report_text,omitempty"`
	Price            int64     `json:"price"`
	CreatedAt        time.Time `json:"created_at"`
}

type Medication struct {
	ID        string `json:"id"`
	KFACode   string `json:"kfa_code"`
	Name      string `json:"name"`
	Unit      string `json:"unit"`
	Stock     int    `json:"stock"`
	UnitPrice int64  `json:"unit_price"`
}

type Prescription struct {
	ID             string    `json:"id"`
	RxNumber       string    `json:"rx_number"`
	VisitID        string    `json:"visit_id"`
	PatientNoRM    string    `json:"patient_no_rm"`
	PatientName    string    `json:"patient_name"`
	DoctorName     string    `json:"doctor_name"`
	MedicationID   string    `json:"medication_id"`
	MedicationName string    `json:"medication_name"`
	KFACode        string    `json:"kfa_code"`
	Qty            int       `json:"qty"`
	Dosage         string    `json:"dosage"`
	TotalPrice     int64     `json:"total_price"`
	Status         string    `json:"status"` // MENUNGGU, DISERAHKAN
	CreatedAt      time.Time `json:"created_at"`
}

type BillingItem struct {
	ID          string    `json:"id"`
	VisitID     string    `json:"visit_id"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Qty         int       `json:"qty"`
	UnitPrice   int64     `json:"unit_price"`
	Subtotal    int64     `json:"subtotal"`
	Paid        bool      `json:"paid"`
	CreatedAt   time.Time `json:"created_at"`
}

type OutboxItem struct {
	ID          string    `json:"id"`
	Target      string    `json:"target"`
	EventType   string    `json:"event_type"`
	ReferenceID string    `json:"reference_id"`
	Payload     string    `json:"payload"`
	Status      string    `json:"status"`
	LastError   string    `json:"last_error,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type AuditLog struct {
	ID           int64     `json:"id"`
	Actor        string    `json:"actor"`
	Action       string    `json:"action"`
	ResourceType string    `json:"resource_type"`
	ResourceID   string    `json:"resource_id"`
	Detail       string    `json:"detail"`
	CreatedAt    time.Time `json:"created_at"`
}

type DashboardStats struct {
	TotalPatients   int   `json:"total_patients"`
	ActiveVisitsRJ  int   `json:"active_visits_rj"`
	ActiveVisitsIGD int   `json:"active_visits_igd"`
	ActiveVisitsRI  int   `json:"active_visits_ri"`
	BedsAvailable   int   `json:"beds_available"`
	BedsOccupied    int   `json:"beds_occupied"`
	PendingRx       int   `json:"pending_rx"`
	RadiologyOrders int   `json:"radiology_orders"`
	UnpaidRevenue   int64 `json:"unpaid_revenue"`
	PaidRevenue     int64 `json:"paid_revenue"`
	OutboxCount     int   `json:"outbox_count"`
}

type Repository interface {
	ListPatients(ctx context.Context, query string) ([]Patient, error)
	GetPatient(ctx context.Context, id string) (Patient, bool, error)
	CreatePatient(ctx context.Context, p Patient) (Patient, error)

	ListVisits(ctx context.Context, serviceType string) ([]Visit, error)
	GetVisit(ctx context.Context, id string) (Visit, bool, error)
	CreateVisit(ctx context.Context, v Visit) (Visit, error)
	UpdateVisitStatus(ctx context.Context, id, status string) error
	AttachSEP(ctx context.Context, visitID, sepNumber, inacbgCode string, inacbgTariff int64) error

	ListBeds(ctx context.Context) ([]Bed, error)
	AssignBed(ctx context.Context, bedID, visitID, patientName string) error
	ReleaseBed(ctx context.Context, bedID string) error

	ListSOAPNotes(ctx context.Context, visitID string) ([]SOAPNote, error)
	CreateSOAPNote(ctx context.Context, n SOAPNote) (SOAPNote, error)

	ListRadiologyOrders(ctx context.Context, visitID string) ([]RadiologyOrder, error)
	GetRadiologyOrder(ctx context.Context, id string) (RadiologyOrder, bool, error)
	CreateRadiologyOrder(ctx context.Context, o RadiologyOrder) (RadiologyOrder, error)
	AttachRadiologyReport(ctx context.Context, accession, studyUID, reportStatus, radiologist, reportText string) error

	ListMedications(ctx context.Context) ([]Medication, error)
	ListPrescriptions(ctx context.Context, visitID string) ([]Prescription, error)
	CreatePrescription(ctx context.Context, rx Prescription) (Prescription, error)
	DispensePrescription(ctx context.Context, rxID string) (Prescription, error)

	ListBillingItems(ctx context.Context, visitID string) ([]BillingItem, error)
	AddBillingItem(ctx context.Context, item BillingItem) (BillingItem, error)
	SettleVisitBilling(ctx context.Context, visitID string) (int64, error)

	EnqueueOutbox(ctx context.Context, item OutboxItem) (OutboxItem, error)
	ListOutbox(ctx context.Context, limit int) ([]OutboxItem, error)
	AppendAudit(ctx context.Context, actor, action, resType, resID, detail string) error
	ListAudits(ctx context.Context, limit int) ([]AuditLog, error)
	Stats(ctx context.Context) (DashboardStats, error)
}
