package simrsstore

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore provides a rich, concurrency-safe in-memory Repository pre-seeded for instant standalone demo & tests.
type MemoryStore struct {
	mu            sync.RWMutex
	patients      map[string]*Patient
	beds          map[string]*Bed
	visits        map[string]*Visit
	soaps         map[string][]*SOAPNote
	radOrders     []*RadiologyOrder
	medications   map[string]*Medication
	prescriptions map[string]*Prescription
	billing       map[string][]*BillingItem
	outbox        []OutboxItem
	audits        []AuditLog
	seq           int64
	auditSeq      int64
}

func NewMemoryStore() *MemoryStore {
	m := &MemoryStore{
		patients:      make(map[string]*Patient),
		beds:          make(map[string]*Bed),
		visits:        make(map[string]*Visit),
		soaps:         make(map[string][]*SOAPNote),
		medications:   make(map[string]*Medication),
		prescriptions: make(map[string]*Prescription),
		billing:       make(map[string][]*BillingItem),
	}
	m.seedDefaults()
	return m
}

func (m *MemoryStore) seedDefaults() {
	now := time.Now().UTC()
	today := now.Format("20060102")

	// 1. Seed 8 Inpatient Beds
	beds := []Bed{
		{ID: "BED-VIP-01", WardName: "Paviliun Anggrek", RoomCode: "VIP-101", CareClass: "VIP", DailyRate: 1250000, Status: "TERSEDIA"},
		{ID: "BED-K1-01", WardName: "Paviliun Anggrek", RoomCode: "K1-201", CareClass: "KELAS_1", DailyRate: 650000, Status: "TERSEDIA"},
		{ID: "BED-K1-02", WardName: "Paviliun Anggrek", RoomCode: "K1-202", CareClass: "KELAS_1", DailyRate: 650000, Status: "TERSEDIA"},
		{ID: "BED-K2-01", WardName: "Ruang Melati", RoomCode: "K2-301", CareClass: "KELAS_2", DailyRate: 400000, Status: "TERSEDIA"},
		{ID: "BED-K2-02", WardName: "Ruang Melati", RoomCode: "K2-302", CareClass: "KELAS_2", DailyRate: 400000, Status: "TERSEDIA"},
		{ID: "BED-K3-01", WardName: "Ruang Kenanga", RoomCode: "K3-401", CareClass: "KELAS_3", DailyRate: 225000, Status: "TERSEDIA"},
		{ID: "BED-K3-02", WardName: "Ruang Kenanga", RoomCode: "K3-402", CareClass: "KELAS_3", DailyRate: 225000, Status: "PEMBERSIHAN"},
		{ID: "BED-ICU-01", WardName: "ICU Sentral", RoomCode: "ICU-01", CareClass: "ICU", DailyRate: 1850000, Status: "TERSEDIA"},
	}
	for _, b := range beds {
		cp := b
		m.beds[b.ID] = &cp
	}

	// 2. Seed 8 KFA-mapped Medications
	meds := []Medication{
		{ID: "MED-01", KFACode: "93001011", Name: "Paracetamol 500 mg Tablet", Unit: "Tablet", Stock: 450, UnitPrice: 1500},
		{ID: "MED-02", KFACode: "93001024", Name: "Amoxicillin 500 mg Kapsul", Unit: "Kapsul", Stock: 320, UnitPrice: 3500},
		{ID: "MED-03", KFACode: "93001055", Name: "Amlodipine 5 mg Tablet", Unit: "Tablet", Stock: 280, UnitPrice: 2800},
		{ID: "MED-04", KFACode: "93001089", Name: "Omeprazole 20 mg Kapsul", Unit: "Kapsul", Stock: 210, UnitPrice: 4200},
		{ID: "MED-05", KFACode: "93001102", Name: "Ceftriaxone 1 g Injeksi", Unit: "Vial", Stock: 85, UnitPrice: 45000},
		{ID: "MED-06", KFACode: "93001140", Name: "NaCl 0.9% Infus 500 ml", Unit: "Botol", Stock: 160, UnitPrice: 18000},
		{ID: "MED-07", KFACode: "93001188", Name: "Metformin 500 mg Tablet", Unit: "Tablet", Stock: 390, UnitPrice: 1800},
		{ID: "MED-08", KFACode: "93001205", Name: "Salbutamol Nebulizer 2.5 mg", Unit: "Ampul", Stock: 95, UnitPrice: 14500},
	}
	for _, med := range meds {
		cp := med
		m.medications[med.ID] = &cp
	}

	// 3. Seed 4 Sample Patients & Visits (RJ, IGD, RI) aligned with PACS demo StudyUIDs!
	p1 := &Patient{ID: uuid.NewString(), NoRM: "RM-001024", NIK: "3171011405780001", BPJSNumber: "0001234500101", IHSNumber: "P10002001", FullName: "Budi Santoso", BirthDate: "1978-05-14", Sex: "M", Phone: "081234567801", Address: "Jl. Sudirman No. 12, Jakarta", CreatedAt: now}
	p2 := &Patient{ID: uuid.NewString(), NoRM: "RM-001089", NIK: "3171022209910002", BPJSNumber: "0001234500102", IHSNumber: "P10002002", FullName: "Siti Rahmawati", BirthDate: "1991-09-22", Sex: "F", Phone: "081234567802", Address: "Jl. Gatot Subroto No. 45, Jakarta", CreatedAt: now}
	p3 := &Patient{ID: uuid.NewString(), NoRM: "RM-001142", NIK: "3273010803650003", BPJSNumber: "", IHSNumber: "P10002003", FullName: "Ahmad Fauzi", BirthDate: "1965-03-08", Sex: "M", Phone: "081234567803", Address: "Jl. Diponegoro No. 8, Bandung", CreatedAt: now}
	p4 := &Patient{ID: uuid.NewString(), NoRM: "RM-001205", NIK: "3174053011860004", BPJSNumber: "0001234500104", IHSNumber: "P10002004", FullName: "Dewi Lestari", BirthDate: "1986-11-30", Sex: "F", Phone: "081234567804", Address: "Jl. Ahmad Yani No. 19, Surabaya", CreatedAt: now}
	for _, p := range []*Patient{p1, p2, p3, p4} {
		m.patients[p.ID] = p
	}

	v1 := &Visit{
		ID: uuid.NewString(), VisitNumber: "VIS-" + today + "-0001", QueueNumber: "A-001",
		PatientID: p1.ID, PatientNoRM: p1.NoRM, PatientName: p1.FullName,
		ServiceType: "RJ", UnitName: "Poli Penyakit Dalam", DoctorName: "dr. Hendra Wijaya, Sp.PD",
		PaymentType: "BPJS", SEPNumber: "0112R0011126V000101", INACBGCode: "Q-5-44-0", INACBGTariff: 185000,
		Status: "DIPERIKSA", SatusehatEncounterID: "enc-simrs-001", CreatedAt: now.Add(-45 * time.Minute), UpdatedAt: now,
	}
	v2 := &Visit{
		ID: uuid.NewString(), VisitNumber: "VIS-" + today + "-0002", QueueNumber: "IGD-01",
		PatientID: p2.ID, PatientNoRM: p2.NoRM, PatientName: p2.FullName,
		ServiceType: "IGD", UnitName: "IGD Triase", DoctorName: "dr. Rina Kusuma", TriageLevel: "KUNING",
		PaymentType: "BPJS", SEPNumber: "0112R0011126V000102", INACBGCode: "Q-5-44-0", INACBGTariff: 185000,
		Status: "DIPERIKSA", SatusehatEncounterID: "enc-simrs-002", CreatedAt: now.Add(-30 * time.Minute), UpdatedAt: now,
	}
	v3 := &Visit{
		ID: uuid.NewString(), VisitNumber: "VIS-" + today + "-0003", QueueNumber: "RI-01",
		PatientID: p3.ID, PatientNoRM: p3.NoRM, PatientName: p3.FullName,
		ServiceType: "RI", UnitName: "Paviliun Anggrek", DoctorName: "dr. Hendra Wijaya, Sp.PD", BedID: "BED-K1-01",
		PaymentType: "UMUM", Status: "RAWAT_INAP", SatusehatEncounterID: "enc-simrs-003", CreatedAt: now.Add(-6 * time.Hour), UpdatedAt: now,
	}
	m.beds["BED-K1-01"].Status = "TERISI"
	m.beds["BED-K1-01"].CurrentVisitID = v3.ID
	m.beds["BED-K1-01"].CurrentPatientName = p3.FullName

	for _, v := range []*Visit{v1, v2, v3} {
		m.visits[v.ID] = v
	}

	// Sample SOAP note
	m.soaps[v1.ID] = []*SOAPNote{{
		ID: uuid.NewString(), VisitID: v1.ID, AuthorName: v1.DoctorName,
		Subjective: "Batuk berdahak 3 minggu, sesak napas ringan saat aktivitas.",
		Objective:  "Keadaan umum sedang, compos mentis, ronki halus basal paru kanan.",
		BPSystolic: 132, BPDiastolic: 84, HeartRate: 88, Temperature: 37.2, RespRate: 22, SpO2: 96,
		ICD10Code: "J18.9", ICD10Name: "Pneumonia, unspecified",
		Assessment: "Suspek Pneumonia Komunitas (CAP)",
		Plan:       "Order CT Thorax Non Kontras ke RIS/PACS, terapi antibiotik & mukolitik.",
		CreatedAt:  now.Add(-25 * time.Minute),
	}}

	// Sample Radiology Order pointing to the exact StudyInstanceUID seeded in Core PACS!
	m.radOrders = append(m.radOrders, &RadiologyOrder{
		ID: uuid.NewString(), VisitID: v1.ID, PatientNoRM: p1.NoRM, PatientName: p1.FullName,
		AccessionNumber: "ACC-" + today + "-0001", StudyInstanceUID: "1.2.826.0.1.3680043.10.2026.1001",
		Modality: "CT", ProcedureCode: "24627-2", ProcedureName: "CT Thorax Non Kontras",
		ClinicalNote: "Evaluasi infiltrat / nodul paru kanan", Status: "COMPLETED", RISSyncStatus: "SYNCED_HL7",
		Price: 1450000, CreatedAt: now.Add(-20 * time.Minute),
	})

	// Sample Prescription waiting in Pharmacy
	rx1 := &Prescription{
		ID: uuid.NewString(), RxNumber: "RX-" + today + "-0001", VisitID: v1.ID,
		PatientNoRM: p1.NoRM, PatientName: p1.FullName, DoctorName: v1.DoctorName,
		MedicationID: "MED-02", MedicationName: "Amoxicillin 500 mg Kapsul", KFACode: "93001024",
		Qty: 15, Dosage: "3 x 1 kapsul sesudah makan (habiskan)", TotalPrice: 52500, Status: "MENUNGGU",
		CreatedAt: now.Add(-15 * time.Minute),
	}
	m.prescriptions[rx1.ID] = rx1

	// Sample Billing items
	m.billing[v1.ID] = []*BillingItem{
		{ID: uuid.NewString(), VisitID: v1.ID, Category: "KONSULTASI", Description: "Konsultasi Dokter Spesialis Penyakit Dalam", Qty: 1, UnitPrice: 175000, Subtotal: 175000, CreatedAt: now},
		{ID: uuid.NewString(), VisitID: v1.ID, Category: "RADIOLOGI", Description: "CT Thorax Non Kontras", Qty: 1, UnitPrice: 1450000, Subtotal: 1450000, CreatedAt: now},
	}
	m.billing[v3.ID] = []*BillingItem{
		{ID: uuid.NewString(), VisitID: v3.ID, Category: "KAMAR", Description: "Rawat Inap Kelas 1 (K1-201) - 1 Hari", Qty: 1, UnitPrice: 650000, Subtotal: 650000, CreatedAt: now},
	}
	m.seq = 10
}

func (m *MemoryStore) ListPatients(_ context.Context, query string) ([]Patient, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	q := strings.ToLower(strings.TrimSpace(query))
	out := make([]Patient, 0, len(m.patients))
	for _, p := range m.patients {
		if q != "" {
			hay := strings.ToLower(p.NoRM + " " + p.FullName + " " + p.NIK + " " + p.BPJSNumber)
			if !strings.Contains(hay, q) {
				continue
			}
		}
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *MemoryStore) GetPatient(_ context.Context, id string) (Patient, bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.patients[id]
	if !ok {
		return Patient{}, false, nil
	}
	return *p, true, nil
}

func (m *MemoryStore) CreatePatient(_ context.Context, p Patient) (Patient, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seq++
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.NoRM == "" {
		p.NoRM = fmt.Sprintf("RM-%06d", 1200+m.seq)
	}
	if p.IHSNumber == "" {
		p.IHSNumber = fmt.Sprintf("P1000%04d", 2000+m.seq)
	}
	p.CreatedAt = time.Now().UTC()
	cp := p
	m.patients[p.ID] = &cp
	return p, nil
}

func (m *MemoryStore) ListVisits(_ context.Context, serviceType string) ([]Visit, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Visit, 0, len(m.visits))
	for _, v := range m.visits {
		if serviceType != "" && !strings.EqualFold(v.ServiceType, serviceType) {
			continue
		}
		out = append(out, *v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *MemoryStore) GetVisit(_ context.Context, id string) (Visit, bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, ok := m.visits[id]
	if !ok {
		return Visit{}, false, nil
	}
	return *v, true, nil
}

func (m *MemoryStore) CreateVisit(_ context.Context, v Visit) (Visit, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seq++
	now := time.Now().UTC()
	if v.ID == "" {
		v.ID = uuid.NewString()
	}
	if v.VisitNumber == "" {
		v.VisitNumber = fmt.Sprintf("VIS-%s-%04d", now.Format("20060102"), m.seq)
	}
	if v.QueueNumber == "" {
		prefix := "A"
		if v.ServiceType == "IGD" {
			prefix = "IGD"
		} else if v.ServiceType == "RI" {
			prefix = "RI"
		}
		v.QueueNumber = fmt.Sprintf("%s-%03d", prefix, m.seq)
	}
	if v.Status == "" {
		if v.ServiceType == "RI" {
			v.Status = "RAWAT_INAP"
		} else {
			v.Status = "ANTRI"
		}
	}
	if v.SatusehatEncounterID == "" {
		v.SatusehatEncounterID = "enc-" + v.ID[:8]
	}
	v.CreatedAt = now
	v.UpdatedAt = now
	cp := v
	m.visits[v.ID] = &cp

	// Auto-add initial consultation or room charge
	price := int64(150000)
	desc := "Jasa Konsultasi " + v.UnitName
	cat := "KONSULTASI"
	if v.ServiceType == "RI" && v.BedID != "" {
		if bed, ok := m.beds[v.BedID]; ok {
			bed.Status = "TERISI"
			bed.CurrentVisitID = v.ID
			bed.CurrentPatientName = v.PatientName
			price = bed.DailyRate
			desc = fmt.Sprintf("Kamar Rawat Inap %s (%s) - Hari 1", bed.RoomCode, bed.CareClass)
			cat = "KAMAR"
		}
	}
	m.billing[v.ID] = append(m.billing[v.ID], &BillingItem{
		ID: uuid.NewString(), VisitID: v.ID, Category: cat, Description: desc,
		Qty: 1, UnitPrice: price, Subtotal: price, CreatedAt: now,
	})
	return v, nil
}

func (m *MemoryStore) UpdateVisitStatus(_ context.Context, id, status string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.visits[id]
	if !ok {
		return errors.New("visit not found")
	}
	v.Status = status
	v.UpdatedAt = time.Now().UTC()
	return nil
}

func (m *MemoryStore) AttachSEP(_ context.Context, visitID, sepNumber, inacbgCode string, inacbgTariff int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.visits[visitID]
	if !ok {
		return errors.New("visit not found")
	}
	v.SEPNumber = sepNumber
	v.INACBGCode = inacbgCode
	v.INACBGTariff = inacbgTariff
	v.UpdatedAt = time.Now().UTC()
	return nil
}

func (m *MemoryStore) ListBeds(_ context.Context) ([]Bed, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Bed, 0, len(m.beds))
	for _, b := range m.beds {
		out = append(out, *b)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (m *MemoryStore) AssignBed(_ context.Context, bedID, visitID, patientName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.beds[bedID]
	if !ok {
		return errors.New("bed not found")
	}
	b.Status = "TERISI"
	b.CurrentVisitID = visitID
	b.CurrentPatientName = patientName
	return nil
}

func (m *MemoryStore) ReleaseBed(_ context.Context, bedID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.beds[bedID]
	if !ok {
		return errors.New("bed not found")
	}
	if b.CurrentVisitID != "" {
		if v, exists := m.visits[b.CurrentVisitID]; exists {
			v.Status = "SELESAI"
		}
	}
	b.Status = "TERSEDIA"
	b.CurrentVisitID = ""
	b.CurrentPatientName = ""
	return nil
}

func (m *MemoryStore) ListSOAPNotes(_ context.Context, visitID string) ([]SOAPNote, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	list := m.soaps[visitID]
	out := make([]SOAPNote, 0, len(list))
	for i := len(list) - 1; i >= 0; i-- {
		out = append(out, *list[i])
	}
	return out, nil
}

func (m *MemoryStore) CreateSOAPNote(_ context.Context, n SOAPNote) (SOAPNote, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	n.CreatedAt = time.Now().UTC()
	cp := n
	m.soaps[n.VisitID] = append(m.soaps[n.VisitID], &cp)
	if v, ok := m.visits[n.VisitID]; ok && v.Status == "ANTRI" {
		v.Status = "DIPERIKSA"
	}
	return n, nil
}

func (m *MemoryStore) ListRadiologyOrders(_ context.Context, visitID string) ([]RadiologyOrder, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]RadiologyOrder, 0)
	for i := len(m.radOrders) - 1; i >= 0; i-- {
		o := m.radOrders[i]
		if visitID != "" && o.VisitID != visitID {
			continue
		}
		out = append(out, *o)
	}
	return out, nil
}

func (m *MemoryStore) GetRadiologyOrder(_ context.Context, id string) (RadiologyOrder, bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, o := range m.radOrders {
		if o.ID == id {
			return *o, true, nil
		}
	}
	return RadiologyOrder{}, false, nil
}

func (m *MemoryStore) AttachRadiologyReport(_ context.Context, accession, studyUID, reportStatus, radiologist, reportText string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, o := range m.radOrders {
		if (accession != "" && o.AccessionNumber == accession) || (studyUID != "" && o.StudyInstanceUID == studyUID) {
			o.Status = "COMPLETED"
			o.ReportStatus = reportStatus
			o.RadiologistName = radiologist
			o.ReportText = reportText
			return nil
		}
	}
	return errors.New("radiology order not found for accession/studyUID")
}

func (m *MemoryStore) CreateRadiologyOrder(_ context.Context, o RadiologyOrder) (RadiologyOrder, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.seq++
	now := time.Now().UTC()
	if o.ID == "" {
		o.ID = uuid.NewString()
	}
	if o.AccessionNumber == "" {
		o.AccessionNumber = fmt.Sprintf("ACC-%s-%04d", now.Format("20060102"), m.seq)
	}
	if o.StudyInstanceUID == "" {
		o.StudyInstanceUID = fmt.Sprintf("1.2.826.0.1.3680043.10.%s.%d", now.Format("20060102"), 5000+m.seq)
	}
	if o.Price <= 0 {
		o.Price = 350000
	}
	o.CreatedAt = now
	cp := o
	m.radOrders = append(m.radOrders, &cp)

	m.billing[o.VisitID] = append(m.billing[o.VisitID], &BillingItem{
		ID: uuid.NewString(), VisitID: o.VisitID, Category: "RADIOLOGI",
		Description: fmt.Sprintf("%s (%s)", o.ProcedureName, o.Modality),
		Qty: 1, UnitPrice: o.Price, Subtotal: o.Price, CreatedAt: now,
	})
	return o, nil
}

func (m *MemoryStore) ListMedications(_ context.Context) ([]Medication, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Medication, 0, len(m.medications))
	for _, med := range m.medications {
		out = append(out, *med)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (m *MemoryStore) ListPrescriptions(_ context.Context, visitID string) ([]Prescription, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Prescription, 0, len(m.prescriptions))
	for _, rx := range m.prescriptions {
		if visitID != "" && rx.VisitID != visitID {
			continue
		}
		out = append(out, *rx)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (m *MemoryStore) CreatePrescription(_ context.Context, rx Prescription) (Prescription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	med, ok := m.medications[rx.MedicationID]
	if !ok {
		return Prescription{}, errors.New("medication not found")
	}
	m.seq++
	now := time.Now().UTC()
	rx.ID = uuid.NewString()
	rx.RxNumber = fmt.Sprintf("RX-%s-%04d", now.Format("20060102"), m.seq)
	rx.MedicationName = med.Name
	rx.KFACode = med.KFACode
	if rx.Qty <= 0 {
		rx.Qty = 1
	}
	rx.TotalPrice = int64(rx.Qty) * med.UnitPrice
	rx.Status = "MENUNGGU"
	rx.CreatedAt = now
	cp := rx
	m.prescriptions[rx.ID] = &cp
	return rx, nil
}

func (m *MemoryStore) DispensePrescription(_ context.Context, rxID string) (Prescription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rx, ok := m.prescriptions[rxID]
	if !ok {
		return Prescription{}, errors.New("prescription not found")
	}
	if rx.Status == "DISERAHKAN" {
		return *rx, nil
	}
	if med, exists := m.medications[rx.MedicationID]; exists {
		if med.Stock < rx.Qty {
			return Prescription{}, errors.New("stok obat tidak mencukupi")
		}
		med.Stock -= rx.Qty
	}
	rx.Status = "DISERAHKAN"
	m.billing[rx.VisitID] = append(m.billing[rx.VisitID], &BillingItem{
		ID: uuid.NewString(), VisitID: rx.VisitID, Category: "FARMASI",
		Description: fmt.Sprintf("%s (%s)", rx.MedicationName, rx.RxNumber),
		Qty: rx.Qty, UnitPrice: rx.TotalPrice / int64(max(rx.Qty, 1)), Subtotal: rx.TotalPrice, CreatedAt: time.Now().UTC(),
	})
	return *rx, nil
}

func (m *MemoryStore) ListBillingItems(_ context.Context, visitID string) ([]BillingItem, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]BillingItem, 0)
	if visitID != "" {
		for _, item := range m.billing[visitID] {
			out = append(out, *item)
		}
		return out, nil
	}
	for _, list := range m.billing {
		for _, item := range list {
			out = append(out, *item)
		}
	}
	return out, nil
}

func (m *MemoryStore) AddBillingItem(_ context.Context, item BillingItem) (BillingItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	if item.Qty <= 0 {
		item.Qty = 1
	}
	item.Subtotal = int64(item.Qty) * item.UnitPrice
	item.CreatedAt = time.Now().UTC()
	cp := item
	m.billing[item.VisitID] = append(m.billing[item.VisitID], &cp)
	return item, nil
}

func (m *MemoryStore) SettleVisitBilling(_ context.Context, visitID string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var total int64
	for _, item := range m.billing[visitID] {
		item.Paid = true
		total += item.Subtotal
	}
	if v, ok := m.visits[visitID]; ok && v.ServiceType != "RI" {
		v.Status = "SELESAI"
	}
	return total, nil
}

func (m *MemoryStore) EnqueueOutbox(_ context.Context, item OutboxItem) (OutboxItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if item.ID == "" {
		item.ID = uuid.NewString()
	}
	if item.Status == "" {
		item.Status = "QUEUED"
	}
	item.CreatedAt = time.Now().UTC()
	m.outbox = append(m.outbox, item)
	return item, nil
}

func (m *MemoryStore) ListOutbox(_ context.Context, limit int) ([]OutboxItem, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if limit <= 0 {
		limit = 50
	}
	out := make([]OutboxItem, 0, min(len(m.outbox), limit))
	for i := len(m.outbox) - 1; i >= 0 && len(out) < limit; i-- {
		out = append(out, m.outbox[i])
	}
	return out, nil
}

func (m *MemoryStore) AppendAudit(_ context.Context, actor, action, resType, resID, detail string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.auditSeq++
	m.audits = append(m.audits, AuditLog{
		ID: m.auditSeq, Actor: actor, Action: action, ResourceType: resType, ResourceID: resID, Detail: detail, CreatedAt: time.Now().UTC(),
	})
	return nil
}

func (m *MemoryStore) ListAudits(_ context.Context, limit int) ([]AuditLog, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if limit <= 0 {
		limit = 50
	}
	out := make([]AuditLog, 0, min(len(m.audits), limit))
	for i := len(m.audits) - 1; i >= 0 && len(out) < limit; i-- {
		out = append(out, m.audits[i])
	}
	return out, nil
}

func (m *MemoryStore) Stats(_ context.Context) (DashboardStats, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var st DashboardStats
	st.TotalPatients = len(m.patients)
	st.RadiologyOrders = len(m.radOrders)
	st.OutboxCount = len(m.outbox)
	for _, v := range m.visits {
		if v.Status == "SELESAI" {
			continue
		}
		switch v.ServiceType {
		case "RJ":
			st.ActiveVisitsRJ++
		case "IGD":
			st.ActiveVisitsIGD++
		case "RI":
			st.ActiveVisitsRI++
		}
	}
	for _, b := range m.beds {
		if b.Status == "TERSEDIA" {
			st.BedsAvailable++
		} else if b.Status == "TERISI" {
			st.BedsOccupied++
		}
	}
	for _, rx := range m.prescriptions {
		if rx.Status == "MENUNGGU" {
			st.PendingRx++
		}
	}
	for _, list := range m.billing {
		for _, item := range list {
			if item.Paid {
				st.PaidRevenue += item.Subtotal
			} else {
				st.UnpaidRevenue += item.Subtotal
			}
		}
	}
	return st, nil
}
