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
	outbox           []OutboxItem
	audits           []AuditLog
	clinics          []ClinicUnit
	medicalAssets    []MedicalAsset
	utilityTelemetry []UtilityTelemetry
	ipalSensors      []IPALGreaseSensor
	ipsrsWorkOrders  []WorkOrderIPSRS
	seq              int64
	auditSeq         int64
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
		clinics:       DefaultClinics(),
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

	// 3. Seed 10 Complete Sample Patients & Visits aligned with RIS & PACS demo studies
	type seedPat struct {
		NoRM, NIK, BPJS, IHS, FullName, DOB, Sex, Phone, MotherName, Address string
		VisitNum, Unit, Doctor, Pay, SEP, INACBG, Service, Bed               string
		DiagCode, DiagName, SOAPSubj, SOAPObj, SOAPAssess, SOAPPlan          string
		AccNum, StudyUID, Modality, ProcCode, ProcName, RadNote              string
		RadStatus, RptStatus, RadText                                        string
		MedID, MedName, KFA, Dosage                                          string
		Price                                                                int64
	}

	samples := []seedPat{
		{
			NoRM: "RM-2026-001", NIK: "3171011204850001", BPJS: "0001234500101", IHS: "P0123456001",
			FullName: "Tn. Budi Santoso", DOB: "1985-04-12", Sex: "M", Phone: "081234567801", MotherName: "Siti Aminah", Address: "Jl. Sudirman No. 12, Jakarta",
			VisitNum: "VIS-" + today + "-0001", Unit: "Poli Penyakit Dalam", Doctor: "dr. Hendra Wijaya, Sp.PD",
			Pay: "BPJS", SEP: "0112R0011126V000101", INACBG: "Q-5-44-0", Service: "RJ",
			DiagCode: "J18.9", DiagName: "Pneumonia, unspecified",
			SOAPSubj:   "Batuk kronis > 2 minggu, sedikit sesak saat aktivitas berat.",
			SOAPObj:    "KU sedang, CM. Ronki halus basal paru kanan (+), Wheezing (-). SpO2 97%.",
			SOAPAssess: "Suspek Pneumonia Komunitas (CAP) ec bakterial",
			SOAPPlan:   "Foto Thorax PA, terapi Amoxicillin 500mg 3x1, edukasi istirahat cukup.",
			AccNum:     "ACC-" + today + "-0001", StudyUID: "1.2.826.0.1.3680043.10.2026.1001", Modality: "DX",
			ProcCode: "24627-2", ProcName: "Foto Thorax PA", RadNote: "Evaluasi infiltrat paru",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nCor tidak membesar (CTR < 50%). Aorta tidak dilatasi.\nPulmo: hilus tidak menebal, corakan normal, tidak tampak infiltrat.\n\nKESAN:\nCor dan pulmo dalam batas normal.",
			MedID:   "MED-02", MedName: "Amoxicillin 500 mg Kapsul", KFA: "93001024", Dosage: "3 x 1 kapsul sesudah makan (habiskan)", Price: 350000,
		},
		{
			NoRM: "RM-2026-002", NIK: "3171022508780002", BPJS: "0001234500102", IHS: "P0123456002",
			FullName: "Ny. Siti Aminah", DOB: "1978-08-25", Sex: "F", Phone: "081234567802", MotherName: "Mariam binti Hasan", Address: "Jl. Gatot Subroto No. 45, Jakarta",
			VisitNum: "VIS-" + today + "-0002", Unit: "Poli Saraf", Doctor: "dr. Farhan Malik, Sp.S",
			Pay: "BPJS", SEP: "0112R0011126V000102", INACBG: "N-4-10-0", Service: "RJ",
			DiagCode: "R51", DiagName: "Headache",
			SOAPSubj:   "Cephalgia kronis hilang timbul sejak 1 bulan, disertai rasa pusing berputar.",
			SOAPObj:    "CM, TD 125/80 mmHg. Nistagmus (-), Romberg sign (-), defisit neurologis fokal (-).",
			SOAPAssess: "Cephalgia kronis + vertigo perifer dd sentral",
			SOAPPlan:   "CT Scan kepala non kontras, Betahistine 6mg 3x1, Paracetamol 500mg 3x1 prn.",
			AccNum:     "ACC-" + today + "-0002", StudyUID: "1.2.826.0.1.3680043.10.2026.1002", Modality: "CT",
			ProcCode: "24725-4", ProcName: "CT Scan Kepala Non Kontras", RadNote: "Cephalgia & vertigo",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nSulci dan gyri normal. Diferensiasi alba-grisea baik.\nTidak tampak lesi hipodens/hiperdens patologis. Sistem ventrikel simetris.\n\nKESAN:\nCT Scan kepala saat ini dalam batas normal.",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "3 x 1 tablet bila nyeri", Price: 1250000,
		},
		{
			NoRM: "RM-2026-003", NIK: "3273011503900003", BPJS: "", IHS: "P0123456003",
			FullName: "Tn. Hendra Wijaya", DOB: "1990-03-15", Sex: "M", Phone: "081234567803", MotherName: "Ratna Kusuma Dewi", Address: "Jl. Diponegoro No. 8, Bandung",
			VisitNum: "VIS-" + today + "-0003", Unit: "Paviliun Anggrek", Doctor: "dr. Farhan Malik, Sp.S", Bed: "BED-K1-01",
			Pay: "ASURANSI", Service: "RI",
			DiagCode: "G40.9", DiagName: "Epilepsy, unspecified",
			SOAPSubj:   "Kejang fokal pada lengan dan tungkai kanan 2x dalam 1 bulan terakhir.",
			SOAPObj:    "GCS 15. Refleks fisiologis normal, refleks patologis (-/-).",
			SOAPAssess: "Focal onset aware motor seizure, etiologi belum diketahui",
			SOAPPlan:   "Rawat inap Paviliun Anggrek K1-201, MRI Brain non kontras, Asam Valproat 250mg 2x1.",
			AccNum:     "ACC-" + today + "-0003", StudyUID: "1.2.826.0.1.3680043.10.2026.1003", Modality: "MR",
			ProcCode: "24727-0", ProcName: "MRI Brain T1 T2 Non Kontras", RadNote: "Evaluasi kejang fokal",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nT1W/T2W/FLAIR: parenkim serebri dan batang otak intensitas normal.\nCorpus callosum intak. Tidak tampak restriksi difusi maupun massa intrakranial.\n\nKESAN:\nMRI Brain dalam batas normal.",
			MedID:   "MED-03", MedName: "Metformin 500 mg Tablet", KFA: "93001050", Dosage: "1 x 1 tablet", Price: 2400000,
		},
		{
			NoRM: "RM-2026-004", NIK: "3174050411820004", BPJS: "", IHS: "P0123456004",
			FullName: "Ny. Ratna Dewi", DOB: "1982-11-04", Sex: "F", Phone: "081234567804", MotherName: "Sri Rahayu", Address: "Jl. Ahmad Yani No. 19, Surabaya",
			VisitNum: "VIS-" + today + "-0004", Unit: "Poli Penyakit Dalam", Doctor: "dr. Hendra Wijaya, Sp.PD",
			Pay: "UMUM", Service: "RJ",
			DiagCode: "K80.2", DiagName: "Calculus of gallbladder without cholecystitis",
			SOAPSubj:   "Nyeri kolik perut kanan atas hilang timbul pasca santap santan/gorengan.",
			SOAPObj:    "Abdomen supel, nyeri tekan kuadran kanan atas (+), Murphy sign (+).",
			SOAPAssess: "Suspek Kolelitiasis simtomatik",
			SOAPPlan:   "USG Abdomen whole, Omeprazole 20mg 2x1 ac, konsul Bedah Digestif.",
			AccNum:     "ACC-" + today + "-0004", StudyUID: "1.2.826.0.1.3680043.10.2026.1004", Modality: "US",
			ProcCode: "24606-6", ProcName: "USG Abdomen Whole", RadNote: "Nyeri perut kanan atas",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nHepar normal, ekostruktur homogen. Kandung empedu tampak batu soliter 0.8 cm acoustic shadow (+).\nPankreas, lien dan ginjal normal.\n\nKESAN:\nCholelithiasis soliter tanpa tanda kolesistitis akut.",
			MedID:   "MED-05", MedName: "Omeprazole 20 mg Kapsul", KFA: "93001089", Dosage: "2 x 1 kapsul 30 menit sebelum makan", Price: 650000,
		},
		{
			NoRM: "RM-2026-005", NIK: "3172031906650005", BPJS: "0001234500105", IHS: "P0123456005",
			FullName: "Tn. Agus Salim", DOB: "1965-06-19", Sex: "M", Phone: "081234567805", MotherName: "Halimah", Address: "Jl. Malioboro No. 34, Yogyakarta",
			VisitNum: "VIS-" + today + "-0005", Unit: "Poli Jantung", Doctor: "dr. Bambang Soediro, Sp.JP",
			Pay: "BPJS", SEP: "0112R0011126V000105", INACBG: "I-4-10-0", Service: "RJ",
			DiagCode: "I11.9", DiagName: "Hypertensive heart disease without heart failure",
			SOAPSubj:   "Sesak napas saat berjalan jauh (DOE), riwayat hipertensi 10 tahun tidak terkontrol.",
			SOAPObj:    "TD 165/95 mmHg, HR 82x/m. Iktus kordis bergeser ke lateral 2 cm.",
			SOAPAssess: "HHD derajat II, Hipertensi stage II un-controlled",
			SOAPPlan:   "Foto Thorax PA evaluasi CTR, Amlodipine 10mg 1x1, Captopril 25mg 2x1.",
			AccNum:     "ACC-" + today + "-0005", StudyUID: "1.2.826.0.1.3680043.10.2026.1005", Modality: "DX",
			ProcCode: "24627-2", ProcName: "Foto Thorax PA", RadNote: "Sesak napas & evaluasi kardiomegali",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nCor membesar ke kiri (CTR 58%) dengan elongasio aorta.\nPulmo: corakan vaskular meningkat di kedua lapangan bawah.\n\nKESAN:\nKardiomegali dengan elongasio aorta (suspek HHD).",
			MedID:   "MED-04", MedName: "Amlodipine 10 mg Tablet", KFA: "93001072", Dosage: "1 x 1 tablet pagi hari", Price: 350000,
		},
		{
			NoRM: "RM-2026-006", NIK: "3374011002940006", BPJS: "", IHS: "P0123456006",
			FullName: "Nn. Putri Maharani", DOB: "1994-02-10", Sex: "F", Phone: "081234567806", MotherName: "Endang Susilowati", Address: "Jl. Pahlawan No. 71, Semarang",
			VisitNum: "VIS-" + today + "-0006", Unit: "Poli Orthopedi", Doctor: "dr. Rizky Kurnia, Sp.OT",
			Pay: "ASURANSI", Service: "RJ",
			DiagCode: "M25.5", DiagName: "Pain in joint, knee",
			SOAPSubj:   "Nyeri lutut kanan tajam setelah terkilir saat bermain basket 2 hari lalu.",
			SOAPObj:    "Oedem genu dekstra minimal, ballotement test (-), nyeri tekan joint line medial (+).",
			SOAPAssess: "Suspek Sprain Ligamen Genu Dekstra dd lesi meniskus medial",
			SOAPPlan:   "Rontgen Genu AP/Lat dekstra, RICE therapy, Meloxicam 15mg 1x1.",
			AccNum:     "ACC-" + today + "-0006", StudyUID: "1.2.826.0.1.3680043.10.2026.1006", Modality: "DX",
			ProcCode: "24640-5", ProcName: "Foto Genu AP Lateral Dekstra", RadNote: "Post trauma olahraga",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nAlignment sendi genu dekstra baik. Tidak tampak fraktur maupun dislokasi.\nCelah sendi femorotibial normal.\n\nKESAN:\nTidak tampak fraktur maupun kelainan tulang pada genu dekstra.",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "3 x 1 tablet", Price: 350000,
		},
		{
			NoRM: "RM-2026-007", NIK: "3175042809720007", BPJS: "0001234500107", IHS: "P0123456007",
			FullName: "Tn. Dedi Kurniawan", DOB: "1972-09-28", Sex: "M", Phone: "081234567807", MotherName: "Dewi Sartika", Address: "Jl. Pemuda No. 15, Bekasi",
			VisitNum: "VIS-" + today + "-0007", Unit: "Poli Paru", Doctor: "dr. Dian Anggraini, Sp.P",
			Pay: "BPJS", SEP: "0112R0011126V000107", INACBG: "J-4-15-0", Service: "RJ",
			DiagCode: "R91.1", DiagName: "Solitary pulmonary nodule",
			SOAPSubj:   "Batuk disertai dahak bercak darah 2x kemarin, perokok 20 tahun.",
			SOAPObj:    "KU cukup, suara napas vesikuler melemah di apex dextra. Tidak tampak sianosis.",
			SOAPAssess: "Solitary pulmonary nodule lobus superior dekstra ec suspek massa dd TB",
			SOAPPlan:   "CT Thorax dengan kontras, Cefixime 200mg 2x1, evaluasi dahak SPS.",
			AccNum:     "ACC-" + today + "-0007", StudyUID: "1.2.826.0.1.3680043.10.2026.1007", Modality: "CT",
			ProcCode: "24628-0", ProcName: "CT Thorax dengan Kontras", RadNote: "Batuk darah & nodul paru",
			RadStatus: "COMPLETED", RptStatus: "FINAL",
			RadText: "TEMUAN:\nTampak nodul solid berbatas tegas ukuran 1.1 cm di lobus superior paru kanan.\nPenyangatan kontras minimal. Tidak tampak limfadenopati mediastinum.\n\nKESAN:\nNodul paru soliter lobus superior dekstra; saran follow-up CT 3 bulan.",
			MedID:   "MED-06", MedName: "Cefixime 200 mg Kapsul", KFA: "93001048", Dosage: "2 x 1 kapsul sesudah makan", Price: 1750000,
		},
		{
			NoRM: "RM-2026-008", NIK: "3275021407880008", BPJS: "", IHS: "P0123456008",
			FullName: "Ny. Lestari Wulandari", DOB: "1988-07-14", Sex: "F", Phone: "081234567808", MotherName: "Kartini", Address: "Jl. Riau No. 88, Bandung",
			VisitNum: "VIS-" + today + "-0008", Unit: "Poli MCU", Doctor: "dr. Hendra Wijaya, Sp.PD",
			Pay: "UMUM", Service: "RJ",
			DiagCode: "Z00.0", DiagName: "General medical examination",
			SOAPSubj:   "Pemeriksaan kesehatan rutin tahunan kantor, tidak ada keluhan berarti.",
			SOAPObj:    "TTV normal, BMI 22.4 (normoweight). Pemeriksaan fisik umum baik.",
			SOAPAssess: "Medical Check Up Rutin Eksekutif",
			SOAPPlan:   "USG Abdomen screening, cek profil lipid, asam urat, fungsi ginjal.",
			AccNum:     "ACC-" + today + "-0008", StudyUID: "1.2.826.0.1.3680043.10.2026.1008", Modality: "US",
			ProcCode: "24606-6", ProcName: "USG Abdomen Screening", RadNote: "Screening MCU tahunan",
			RadStatus: "SCHEDULED", RptStatus: "",
			RadText: "",
			MedID:   "MED-05", MedName: "Omeprazole 20 mg Kapsul", KFA: "93001089", Dosage: "1 x 1 bila perlu", Price: 550000,
		},
		{
			NoRM: "RM-2026-009", NIK: "3173060312960009", BPJS: "0001234500109", IHS: "P0123456009",
			FullName: "Tn. Rizky Pratama", DOB: "1996-12-03", Sex: "M", Phone: "081234567809", MotherName: "Nurhayati", Address: "Jl. Gajah Mada No. 102, Jakarta",
			VisitNum: "VIS-" + today + "-0009", Unit: "Poli Saraf", Doctor: "dr. Farhan Malik, Sp.S",
			Pay: "BPJS", SEP: "0112R0011126V000109", INACBG: "N-4-10-0", Service: "RJ",
			DiagCode: "G43.9", DiagName: "Migraine, unspecified",
			SOAPSubj:   "Migrain berulang sejak 6 bulan, berdenyut hebat sisi kiri disertai silau.",
			SOAPObj:    "Tekanan darah 120/75 mmHg, pemeriksaan nervus kranialis I-XII intak.",
			SOAPAssess: "Migraine with aura refrakter terapi lini pertama",
			SOAPPlan:   "MRI Brain axial coronal, profilaksis flunarizine, abortif sumatriptan.",
			AccNum:     "ACC-" + today + "-0009", StudyUID: "1.2.826.0.1.3680043.10.2026.1009", Modality: "MR",
			ProcCode: "24727-0", ProcName: "MRI Brain Axial Coronal", RadNote: "Migrain berulang refrakter",
			RadStatus: "SCHEDULED", RptStatus: "",
			RadText: "",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "3 x 1 tablet", Price: 2200000,
		},
		{
			NoRM: "RM-2026-010", NIK: "3171082105800010", BPJS: "0001234500110", IHS: "P0123456010",
			FullName: "Ny. Yulia Permata", DOB: "1980-05-21", Sex: "F", Phone: "081234567810", MotherName: "Rohana", Address: "Jl. Hayam Wuruk No. 55, Jakarta",
			VisitNum: "VIS-" + today + "-0010", Unit: "IGD Triase", Doctor: "dr. Rina Kusuma",
			Pay: "BPJS", SEP: "0112R0011126V000110", INACBG: "Z-4-12-0", Service: "RJ",
			DiagCode: "Z01.8", DiagName: "Other specified special examinations",
			SOAPSubj:   "Persiapan operasi laparoskopi kolesistektomi elektif besok pagi.",
			SOAPObj:    "KU baik, CM, tanda vital stabil. Cor dan pulmo normal pada auskultasi.",
			SOAPAssess: "Evaluasi pra-anestesi dan pra-bedah kolesistektomi",
			SOAPPlan:   "Rontgen dada PA pre-op, EKG 12 lead, puasa mulai pukul 24.00.",
			AccNum:     "ACC-" + today + "-0010", StudyUID: "1.2.826.0.1.3680043.10.2026.1010", Modality: "DX",
			ProcCode: "24627-2", ProcName: "Foto Thorax Pre Operasi", RadNote: "Skrining pra operasi elektif",
			RadStatus: "ORDERED", RptStatus: "",
			RadText: "",
			MedID:   "MED-07", MedName: "Ceftriaxone 1 g Injeksi", KFA: "93001112", Dosage: "1 x 1 g IV pra-operasi", Price: 350000,
		},
		{
			NoRM: "RM-2026-011", NIK: "3171051508920011", BPJS: "0001234500111", IHS: "P0123456011",
			FullName: "Tn. Fajar Nugraha", DOB: "1992-08-15", Sex: "M", Phone: "081234567811", MotherName: "Sri Wahyuni", Address: "Jl. Tebet Raya No. 42, Jakarta",
			VisitNum: "VIS-" + today + "-0011", Unit: "Poli Umum", Doctor: "dr. Ahmad Fauzi",
			Pay: "BPJS", SEP: "0112R0011126V000111", INACBG: "A-4-10-0", Service: "RJ",
			DiagCode: "A90", DiagName: "Dengue fever [classical dengue]",
			SOAPSubj:   "Demam tinggi mendadak sejak 3 hari, menggigil, nyeri otot & sendi hebat, mual.",
			SOAPObj:    "Suhu 38.8 C, TD 110/75 mmHg, HR 92x/m. Uji Tourniquet (Rumple Leede) (+), petekie (-).",
			SOAPAssess: "Dengue Fever suspek trombositopenia grade I",
			SOAPPlan:   "Cek Darah Lengkap (DL) cito, NS1 Ag, terapi hidrasi oralit & cairan 2.5L/hari, Paracetamol 500mg 3x1.",
			AccNum:     "ACC-" + today + "-0011", StudyUID: "1.2.826.0.1.3680043.10.2026.1011", Modality: "DX",
			ProcCode: "24627-2", ProcName: "Foto Thorax Screening Efusi", RadNote: "Skrining efusi pleura dekstra ec DHF",
			RadStatus: "ORDERED", RptStatus: "",
			RadText: "",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "3 x 1 tablet bila demam", Price: 350000,
		},
		{
			NoRM: "RM-2026-012", NIK: "3171093010950012", BPJS: "0001234500112", IHS: "P0123456012",
			FullName: "Ny. Anisa Fitri", DOB: "1995-10-30", Sex: "F", Phone: "081234567812", MotherName: "Nurul Aini", Address: "Jl. Melawai No. 18, Jakarta",
			VisitNum: "VIS-" + today + "-0012", Unit: "Poli Gigi & Mulut", Doctor: "drg. Maya Indah, Sp.KG",
			Pay: "BPJS", SEP: "0112R0011126V000112", INACBG: "U-4-12-0", Service: "RJ",
			DiagCode: "K04.0", DiagName: "Pulpitis irreversible",
			SOAPSubj:   "Sakit gigi geraham bawah kanan berdenyut hebat sejak 2 hari, bertambah sakit saat minum dingin.",
			SOAPObj:    "Kavitas profunda gigi 46 (molar 1 bawah kanan), sondasi (+), perkusi (+), palpasi (-).",
			SOAPAssess: "Pulpitis Ireversibel Gigi 46 molar 1 mandibular dekstra",
			SOAPPlan:   "Rontgen Dental Panoramic / Periapikal, Trepanasi pulpa, ekstirpasi, analgesik Asam Mefenamat.",
			AccNum:     "ACC-" + today + "-0012", StudyUID: "1.2.826.0.1.3680043.10.2026.1012", Modality: "DX",
			ProcCode: "24640-5", ProcName: "Rontgen Panoramic Dental", RadNote: "Evaluasi apeks akar gigi 46",
			RadStatus: "ORDERED", RptStatus: "",
			RadText: "",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "3 x 1 tablet bila nyeri", Price: 350000,
		},
		{
			NoRM: "RM-2026-013", NIK: "3171092005240013", BPJS: "0001234500113", IHS: "P0123456013",
			FullName: "An. Kevin Pratama", DOB: "2024-05-20", Sex: "M", Phone: "081234567813", MotherName: "Dewi Lestari", Address: "Jl. Tebet Barat No. 22, Jakarta",
			VisitNum: "VIS-" + today + "-0013", Unit: "Poli Anak", Doctor: "dr. Siti Nurhaliza, Sp.A",
			Pay: "BPJS", SEP: "0112R0011126V000113", INACBG: "P-8-14-0", Service: "RJ",
			DiagCode: "Z00.1", DiagName: "Routine child health examination",
			SOAPSubj:   "Ibu membawa anak usia 18 bulan untuk kontrol tumbuh kembang rutin dan jadwal vaksin booster DPT-HB-Hib serta MR.",
			SOAPObj:    "BB: 11.2 kg, TB: 82.5 cm, Lingkar Kepala: 47 cm. Z-score BB/U normal, TB/U normal (tidak stunting). Anak aktif, berjalan lancar.",
			SOAPAssess: "Anak sehat usia 18 bulan, gizi baik, tumbuh kembang sesuai usia mileston Denver II.",
			SOAPPlan:   "Edukasi MPASI gizi seimbang, pemberian vaksin booster DPT-HB-Hib dan Campak-Rubella, vitamin A.",
			AccNum:     "ACC-" + today + "-0013", StudyUID: "1.2.826.0.1.3680043.10.2026.1013", Modality: "DX",
			ProcCode: "", ProcName: "", RadNote: "",
			RadStatus: "", RptStatus: "",
			RadText: "",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "Sirup Paracetamol bila demam pasca imunisasi", Price: 150000,
		},
		{
			NoRM: "RM-2026-014", NIK: "3171091503790014", BPJS: "0001234500114", IHS: "P0123456014",
			FullName: "Ny. Rina Marlina", DOB: "1979-03-15", Sex: "F", Phone: "081234567814", MotherName: "Siti Maryam", Address: "Jl. Panglima Polim No. 40, Jakarta",
			VisitNum: "VIS-" + today + "-0014", Unit: "Poli Mata", Doctor: "dr. Aris Setiawan, Sp.M",
			Pay: "UMUM", SEP: "", INACBG: "", Service: "RJ",
			DiagCode: "H52.1", DiagName: "Myopia and Astigmatism",
			SOAPSubj:   "Penglihatan buram melihat jauh sejak 6 bulan terakhir, sering pusing saat membaca lama di depan monitor.",
			SOAPObj:    "Visus OD 6/18 koreksi S -1.50 C -0.50 x 90 -> 6/6. Visus OS 6/24 koreksi S -2.00 C -0.75 x 85 -> 6/6. TIO OD 16 mmHg, OS 17 mmHg. Lensa jernih.",
			SOAPAssess: "Miopia dan Astigmatisme Miopia Kompositus ODS, Presbiopia dini.",
			SOAPPlan:   "Resep kacamata koreksi bifokal / progresif, edukasi 20-20-20 rule saat bekerja di depan layar komputer.",
			AccNum:     "ACC-" + today + "-0014", StudyUID: "1.2.826.0.1.3680043.10.2026.1014", Modality: "DX",
			ProcCode: "", ProcName: "", RadNote: "",
			RadStatus: "", RptStatus: "",
			RadText: "",
			MedID:   "MED-01", MedName: "Paracetamol 500 mg Tablet", KFA: "93001001", Dosage: "Tetes mata artificial tears 3x1 ODS", Price: 250000,
		},
	}

	for idx, s := range samples {
		p := &Patient{
			ID: uuid.NewString(), NoRM: s.NoRM, NIK: s.NIK, BPJSNumber: s.BPJS, IHSNumber: s.IHS,
			FullName: s.FullName, BirthDate: s.DOB, Sex: s.Sex, Phone: s.Phone, MotherName: s.MotherName, Address: s.Address, CreatedAt: now.Add(-time.Duration(10-idx) * time.Hour),
		}
		m.patients[p.ID] = p

		v := &Visit{
			ID: uuid.NewString(), VisitNumber: s.VisitNum, QueueNumber: fmt.Sprintf("A-%03d", idx+1),
			PatientID: p.ID, PatientNoRM: p.NoRM, PatientName: p.FullName,
			ServiceType: s.Service, UnitName: s.Unit, DoctorName: s.Doctor, BedID: s.Bed,
			PaymentType: s.Pay, SEPNumber: s.SEP, INACBGCode: s.INACBG, INACBGTariff: 185000,
			Status: "DIPERIKSA", SatusehatEncounterID: fmt.Sprintf("enc-simrs-%03d", idx+1),
			CreatedAt: now.Add(-time.Duration(10-idx) * 45 * time.Minute), UpdatedAt: now,
		}
		if s.Service == "RI" {
			v.Status = "RAWAT_INAP"
			if s.Bed != "" && m.beds[s.Bed] != nil {
				m.beds[s.Bed].Status = "TERISI"
				m.beds[s.Bed].CurrentVisitID = v.ID
				m.beds[s.Bed].CurrentPatientName = p.FullName
			}
		}
		m.visits[v.ID] = v

		// SOAP note
		m.soaps[v.ID] = []*SOAPNote{{
			ID: uuid.NewString(), VisitID: v.ID, AuthorName: s.Doctor,
			Subjective: s.SOAPSubj, Objective: s.SOAPObj,
			BPSystolic: 120, BPDiastolic: 80, HeartRate: 78, Temperature: 36.8, RespRate: 20, SpO2: 98,
			ICD10Code: s.DiagCode, ICD10Name: s.DiagName, Assessment: s.SOAPAssess, Plan: s.SOAPPlan,
			CreatedAt: now.Add(-time.Duration(10-idx) * 30 * time.Minute),
		}}

		// Radiology Order
		rad := &RadiologyOrder{
			ID: uuid.NewString(), VisitID: v.ID, PatientNoRM: p.NoRM, PatientName: p.FullName,
			AccessionNumber: s.AccNum, StudyInstanceUID: s.StudyUID,
			Modality: s.Modality, ProcedureCode: s.ProcCode, ProcedureName: s.ProcName,
			ClinicalNote: s.RadNote, Status: s.RadStatus, RISSyncStatus: "SYNCED_HL7",
			ReportStatus: s.RptStatus, RadiologistName: "dr. Andi Pratama, Sp.Rad", ReportText: s.RadText,
			Price: s.Price, CreatedAt: now.Add(-time.Duration(10-idx) * 20 * time.Minute),
		}
		m.radOrders = append(m.radOrders, rad)

		// Prescription
		rx := &Prescription{
			ID: uuid.NewString(), RxNumber: fmt.Sprintf("RX-%s-%04d", today, idx+1), VisitID: v.ID,
			PatientNoRM: p.NoRM, PatientName: p.FullName, DoctorName: s.Doctor,
			MedicationID: s.MedID, MedicationName: s.MedName, KFACode: s.KFA,
			Qty: 15, Dosage: s.Dosage, TotalPrice: 45000, Status: "MENUNGGU",
			CreatedAt: now.Add(-time.Duration(10-idx) * 15 * time.Minute),
		}
		if s.RadStatus == "COMPLETED" {
			rx.Status = "SELESAI"
		}
		m.prescriptions[rx.ID] = rx

		// Billing item
		m.billing[v.ID] = []*BillingItem{
			{ID: uuid.NewString(), VisitID: v.ID, Category: "KONSULTASI", Description: "Konsultasi " + s.Unit, Qty: 1, UnitPrice: 175000, Subtotal: 175000, CreatedAt: now},
			{ID: uuid.NewString(), VisitID: v.ID, Category: "RADIOLOGI", Description: s.ProcName, Qty: 1, UnitPrice: s.Price, Subtotal: s.Price, CreatedAt: now},
		}
	}
	m.seq = 20

	// Seed realistic initial audit trail for clinical governance & UU PDP compliance
	ctx := context.Background()
	_ = m.AppendAudit(ctx, "admin", "INIT_SYSTEM", "SYSTEM", "SIMRS_SERVER", "Sistem SIMRS diinisialisasi & parameter keamanan aktif")
	_ = m.AppendAudit(ctx, "admisi", "REGISTER_PATIENT", "PATIENT", "RM-2026-001", "Pendaftaran pasien baru Tn. Budi Santoso (BPJS)")
	_ = m.AppendAudit(ctx, "admisi", "CREATE_VISIT", "VISIT", "V-20261124-0001", "Kunjungan Rawat Jalan Poli Penyakit Dalam")
	_ = m.AppendAudit(ctx, "dokter", "CREATE_SOAP", "RME", "RM-2026-001", "Pemeriksaan medis & diagnosa J18.9 Pneumonia")
	_ = m.AppendAudit(ctx, "dokter", "ORDER_RADIOLOGY", "RIS", "ACC-20261124-0001", "Order Foto Thorax PA ke Instalasi Radiologi")
	_ = m.AppendAudit(ctx, "radiolog", "VIEW_PACS", "PACS", "1.2.826.0.1.3680043.10.2026.1001", "Inspeksi citra rontgen dada via Diagnostic Viewer")
	_ = m.AppendAudit(ctx, "radiolog", "FINAL_REPORT", "RME", "ACC-20261124-0001", "Finalisasi hasil ekspertise radiologi")
	_ = m.AppendAudit(ctx, "farmasi", "DISPENSE_RX", "FARMASI", "RX-20261124-0001", "Verifikasi KFA & penyerahan obat Azithromycin 500mg")
	_ = m.AppendAudit(ctx, "kasir", "ISSUE_SEP", "BPJS", "0001R0011124V000001", "Penerbitan SEP Rawat Jalan & klaim INA-CBG")
	m.seedIPSRS(now)
	_ = m.AppendAudit(ctx, "kasir", "SETTLE_BILLING", "BILLING", "V-20261124-0001", "Pelunasan tagihan pasien BPJS")
}

func (m *MemoryStore) ListClinics(_ context.Context) ([]ClinicUnit, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]ClinicUnit, len(m.clinics))
	copy(out, m.clinics)
	return out, nil
}

func DefaultClinics() []ClinicUnit {
	return []ClinicUnit{
		{
			Code: "POLI-UMUM", Name: "Poli Umum", Specialty: "Pelayanan Medis Dasar / Dokter Umum",
			BPJSPoliCode: "UMU", RoomNumber: "R.101", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "dr. Ahmad Fauzi", DoctorList: []string{"dr. Ahmad Fauzi", "dr. Rina Kusuma"},
			OperatingHours: "07:30 - 21:00 WIB",
		},
		{
			Code: "POLI-PD", Name: "Poli Penyakit Dalam", Specialty: "Spesialis Penyakit Dalam (Sp.PD)",
			BPJSPoliCode: "INT", RoomNumber: "R.201", Floor: "Lantai 2",
			DefaultDoctor: "dr. Hendra Wijaya, Sp.PD", DoctorList: []string{"dr. Hendra Wijaya, Sp.PD"},
			OperatingHours: "08:00 - 14:00 WIB",
		},
		{
			Code: "POLI-GIGI", Name: "Poli Gigi & Mulut", Specialty: "Dokter Gigi & Konservasi Gigi (Sp.KG)",
			BPJSPoliCode: "GIG", RoomNumber: "R.105", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "drg. Maya Indah, Sp.KG", DoctorList: []string{"drg. Maya Indah, Sp.KG", "drg. Anisa Rahma"},
			OperatingHours: "08:30 - 15:00 WIB",
		},
		{
			Code: "POLI-SARAF", Name: "Poli Saraf (Neurologi)", Specialty: "Spesialis Neurologi (Sp.N / Sp.S)",
			BPJSPoliCode: "SAR", RoomNumber: "R.203", Floor: "Lantai 2",
			DefaultDoctor: "dr. Farhan Malik, Sp.S", DoctorList: []string{"dr. Farhan Malik, Sp.S"},
			OperatingHours: "08:30 - 14:00 WIB",
		},
		{
			Code: "POLI-JANTUNG", Name: "Poli Jantung & Pembuluh Darah", Specialty: "Spesialis Jantung & Pembuluh Darah (Sp.JP)",
			BPJSPoliCode: "JAN", RoomNumber: "R.205", Floor: "Lantai 2",
			DefaultDoctor: "dr. Bambang Soediro, Sp.JP", DoctorList: []string{"dr. Bambang Soediro, Sp.JP"},
			OperatingHours: "09:00 - 13:30 WIB",
		},
		{
			Code: "POLI-ANAK", Name: "Poli Anak (Pediatri)", Specialty: "Spesialis Kesehatan Anak (Sp.A)",
			BPJSPoliCode: "ANA", RoomNumber: "R.108", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "dr. Siti Nurhaliza, Sp.A", DoctorList: []string{"dr. Siti Nurhaliza, Sp.A"},
			OperatingHours: "08:00 - 14:00 WIB",
		},
		{
			Code: "POLI-ORTHO", Name: "Poli Bedah & Orthopedi", Specialty: "Spesialis Orthopedi & Traumatologi (Sp.OT)",
			BPJSPoliCode: "ORT", RoomNumber: "R.207", Floor: "Lantai 2",
			DefaultDoctor: "dr. Rizky Kurnia, Sp.OT", DoctorList: []string{"dr. Rizky Kurnia, Sp.OT"},
			OperatingHours: "10:00 - 15:00 WIB",
		},
		{
			Code: "POLI-PARU", Name: "Poli Paru & Respirasi", Specialty: "Spesialis Pulmonologi & Kedokteran Respirasi (Sp.P)",
			BPJSPoliCode: "PAR", RoomNumber: "R.209", Floor: "Lantai 2",
			DefaultDoctor: "dr. Dian Anggraini, Sp.P", DoctorList: []string{"dr. Dian Anggraini, Sp.P"},
			OperatingHours: "08:00 - 13:00 WIB",
		},
		{
			Code: "POLI-MATA", Name: "Poli Mata (Oftalmologi)", Specialty: "Spesialis Mata (Sp.M)",
			BPJSPoliCode: "MAT", RoomNumber: "R.110", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "dr. Aris Setiawan, Sp.M", DoctorList: []string{"dr. Aris Setiawan, Sp.M"},
			OperatingHours: "08:30 - 14:00 WIB",
		},
		{
			Code: "POLI-THT", Name: "Poli THT-KL", Specialty: "Spesialis Telinga Hidung Tenggorok (Sp.THT-KL)",
			BPJSPoliCode: "THT", RoomNumber: "R.112", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "dr. Nadia Utami, Sp.THT-KL", DoctorList: []string{"dr. Nadia Utami, Sp.THT-KL"},
			OperatingHours: "09:00 - 14:00 WIB",
		},
		{
			Code: "POLI-OBGYN", Name: "Poli Kebidanan & Kandungan", Specialty: "Spesialis Obstetri & Ginekologi (Sp.OG)",
			BPJSPoliCode: "OBG", RoomNumber: "R.212", Floor: "Lantai 2",
			DefaultDoctor: "dr. Ratna Juwita, Sp.OG", DoctorList: []string{"dr. Ratna Juwita, Sp.OG"},
			OperatingHours: "08:00 - 14:00 WIB",
		},
		{
			Code: "POLI-MCU", Name: "Poli Medical Check Up", Specialty: "Pemeriksaan Kesehatan Rutin & Skrining Okupasi",
			BPJSPoliCode: "MCU", RoomNumber: "Gedung Diagnostic Lt.1", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "dr. Hendra Wijaya, Sp.PD", DoctorList: []string{"dr. Hendra Wijaya, Sp.PD"},
			OperatingHours: "07:30 - 12:00 WIB",
		},
		{
			Code: "IGD", Name: "Instalasi Gawat Darurat (IGD)", Specialty: "Pelayanan Gawat Darurat & Triase 24 Jam",
			BPJSPoliCode: "IGD", RoomNumber: "Zona Triase (Merah/Kuning/Hijau)", Floor: "Lantai 1 Dasar",
			DefaultDoctor: "dr. Rina Kusuma", DoctorList: []string{"dr. Rina Kusuma", "dr. Ahmad Fauzi"},
			OperatingHours: "24 Jam Non-Stop",
		},
		{
			Code: "RAWAT-INAP", Name: "Instalasi Rawat Inap", Specialty: "Bangsal Perawatan & Intensive Care (ICU)",
			BPJSPoliCode: "RANAP", RoomNumber: "Paviliun Anggrek & Melati", Floor: "Lantai 3 & 4",
			DefaultDoctor: "dr. Hendra Wijaya, Sp.PD", DoctorList: []string{"dr. Hendra Wijaya, Sp.PD", "dr. Farhan Malik, Sp.S"},
			OperatingHours: "24 Jam Non-Stop",
		},
	}
}

func (m *MemoryStore) ListPatients(_ context.Context, query string) ([]Patient, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	q := strings.ToLower(strings.TrimSpace(query))
	out := make([]Patient, 0, len(m.patients))
	for _, p := range m.patients {
		if q != "" {
			hay := strings.ToLower(p.NoRM + " " + p.FullName + " " + p.NIK + " " + p.Phone + " " + p.MotherName + " " + p.BPJSNumber)
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
		Qty:         1, UnitPrice: o.Price, Subtotal: o.Price, CreatedAt: now,
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
		Qty:         rx.Qty, UnitPrice: rx.TotalPrice / int64(max(rx.Qty, 1)), Subtotal: rx.TotalPrice, CreatedAt: time.Now().UTC(),
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

func (m *MemoryStore) GetExecutiveMetrics(_ context.Context) (ExecutiveMetrics, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	occupied := 0
	totalBeds := len(m.beds)
	for _, b := range m.beds {
		if b.Status == "TERISI" {
			occupied++
		}
	}
	bor := 0.0
	if totalBeds > 0 {
		bor = float64(occupied) / float64(totalBeds) * 100.0
	}
	var bpjsRev, cashRev, insRev int64
	for _, items := range m.billing {
		for _, it := range items {
			if it.Paid {
				cashRev += it.Subtotal
			} else {
				bpjsRev += it.Subtotal
			}
		}
	}
	if bpjsRev == 0 {
		bpjsRev = 48500000
	}
	if cashRev == 0 {
		cashRev = 12750000
	}
	insRev = 18200000

	return ExecutiveMetrics{
		BOR:                 bor,
		ALOS:                4.2,
		TOI:                 1.8,
		BTO:                 42.5,
		RevenueBPJS:         bpjsRev,
		RevenueCash:         cashRev,
		RevenueInsurance:    insRev,
		AvgWaitAdmissionMin: 12,
		AvgWaitClinicMin:    18,
		AvgWaitPharmacyMin:  14,
		ClaimApprovalRate:   97.4,
	}, nil
}

func (m *MemoryStore) ListStaffCredentials(_ context.Context) ([]StaffCredential, error) {
	return []StaffCredential{
		{
			ID: "STF-01", FullName: "dr. Hendra Wijaya, Sp.PD", Role: "DOKTER_SPESIALIS",
			Specialty: "Spesialis Penyakit Dalam", NIP: "198003152006041002",
			STRNumber: "31.1.1.100.2.18.123456", STRExpiryDate: "2027-03-15",
			SIPNumber: "503/SIP.DS/0412/DPMPTSP/2022", SIPExpiryDate: "2027-03-15",
			ClinicalPrivilege: "Kewenangan Klinis Spesialis Penyakit Dalam Tingkat Utama (SPK/RKK-01)", Status: "AKTIF",
		},
		{
			ID: "STF-02", FullName: "drg. Maya Indah, Sp.KG", Role: "DOKTER_GIGI",
			Specialty: "Dokter Gigi & Konservasi Gigi", NIP: "198904122014022005",
			STRNumber: "31.2.1.200.3.19.654321", STRExpiryDate: "2026-12-31",
			SIPNumber: "503/SIP.DG/0819/DPMPTSP/2023", SIPExpiryDate: "2026-12-31",
			ClinicalPrivilege: "Kewenangan Konservasi Gigi & Bedah Minor Oral (SPK/RKK-02)", Status: "WASPADA_60_HARI",
		},
		{
			ID: "STF-03", FullName: "dr. Farhan Malik, Sp.S", Role: "DOKTER_SPESIALIS",
			Specialty: "Spesialis Neurologi / Saraf", NIP: "198302182009031004",
			STRNumber: "31.1.1.100.2.16.789012", STRExpiryDate: "2028-02-18",
			SIPNumber: "503/SIP.DS/0218/DPMPTSP/2023", SIPExpiryDate: "2028-02-18",
			ClinicalPrivilege: "Kewenangan Neurologi Klinis, EEG, & Trombolisis Stroke (SPK/RKK-03)", Status: "AKTIF",
		},
		{
			ID: "STF-04", FullName: "dr. Ahmad Fauzi", Role: "DOKTER_UMUM",
			Specialty: "Dokter Pelayanan Medis Dasar", NIP: "199406202020121006",
			STRNumber: "31.1.1.100.1.21.345678", STRExpiryDate: "2029-06-20",
			SIPNumber: "503/SIP.DU/0620/DPMPTSP/2024", SIPExpiryDate: "2029-06-20",
			ClinicalPrivilege: "Pelayanan Medis Dasar & Emergency Basic Life Support (SPK/RKK-04)", Status: "AKTIF",
		},
		{
			ID: "STF-05", FullName: "apt. Nadia Putri, S.Farm", Role: "APOTEKER",
			Specialty: "Farmasi Klinis & Dispensing", NIP: "199104122014022006",
			STRNumber: "STRA-19910412/KFN/2015/012", STRExpiryDate: "2027-04-12",
			SIPNumber: "SIPA-503/0412/DPMPTSP/2022", SIPExpiryDate: "2027-04-12",
			ClinicalPrivilege: "Kewenangan Pelayanan & Telaah Obat Klinis (SPK/RKK-05)", Status: "AKTIF",
		},
		{
			ID: "STF-06", FullName: "Ns. Andi Pratama, S.Kep", Role: "PERAWAT",
			Specialty: "Perawat Klinis Rawat Inap & ICU", NIP: "199205102015031005",
			STRNumber: "STRP-19920510/PPNI/2016/088", STRExpiryDate: "2026-11-30",
			SIPNumber: "SIPP-503/0510/DPMPTSP/2021", SIPExpiryDate: "2026-11-30",
			ClinicalPrivilege: "Asuhan Keperawatan Komprehensif & Tindakan Invasif Dasar (SPK/RKK-06)", Status: "KRITIS_30_HARI",
		},
	}, nil
}

func (m *MemoryStore) seedIPSRS(now time.Time) {
	ts := now.Format(time.RFC3339)
	m.medicalAssets = []MedicalAsset{
		{
			ID: "ALK-01", AssetCode: "EM-ICU-001", Name: "Ventilator ICU Mindray SV600",
			Category: "LIFE_SUPPORT", Location: "ICU Sentral Bed 01", BrandModel: "Mindray SV600",
			SerialNumber: "SN-SV600-8821", LastCalibration: "2026-06-15", NextCalibration: "2026-12-15",
			CalibrationStatus: "MENDEKATI_JATUH_TEMPO", PPMIntervalDays: 180,
		},
		{
			ID: "ALK-02", AssetCode: "RAD-CT-001", Name: "CT-Scan 128 Slice",
			Category: "RADIOLOGY", Location: "Instalasi Radiologi R.CT", BrandModel: "Siemens SOMATOM go.Top",
			SerialNumber: "SN-CT128-4410", LastCalibration: "2026-09-01", NextCalibration: "2027-09-01",
			CalibrationStatus: "LAIK_PAKAI", PPMIntervalDays: 365,
		},
		{
			ID: "ALK-03", AssetCode: "EM-IGD-004", Name: "Defibrillator Biphasic + AED",
			Category: "LIFE_SUPPORT", Location: "IGD Zona Resusitasi Merah", BrandModel: "Zoll R-Series Plus",
			SerialNumber: "SN-ZOLL-1903", LastCalibration: "2025-11-10", NextCalibration: "2026-11-10",
			CalibrationStatus: "LEWAT_JATUH_TEMPO", PPMIntervalDays: 365,
		},
		{
			ID: "ALK-04", AssetCode: "EM-OK-002", Name: "Mesin Anestesi Modular",
			Category: "ELECTROMEDIC", Location: "Kamar Operasi OK-1", BrandModel: "Dräger Primus",
			SerialNumber: "SN-DRG-5529", LastCalibration: "2026-08-20", NextCalibration: "2027-08-20",
			CalibrationStatus: "LAIK_PAKAI", PPMIntervalDays: 365,
		},
		{
			ID: "ALK-05", AssetCode: "EM-OBG-001", Name: "USG 4D Doppler ObGyn",
			Category: "ELECTROMEDIC", Location: "Poli Kebidanan R.212", BrandModel: "GE Voluson E10",
			SerialNumber: "SN-GE-7741", LastCalibration: "2026-07-05", NextCalibration: "2027-07-05",
			CalibrationStatus: "LAIK_PAKAI", PPMIntervalDays: 365,
		},
		{
			ID: "ALK-06", AssetCode: "EM-ICU-005", Name: "Patient Monitor 5-Parameter",
			Category: "ELECTROMEDIC", Location: "Paviliun Anggrek VIP-101", BrandModel: "Mindray iMEC10",
			SerialNumber: "SN-IMEC-3302", LastCalibration: "2026-06-01", NextCalibration: "2026-12-01",
			CalibrationStatus: "MENDEKATI_JATUH_TEMPO", PPMIntervalDays: 180,
		},
	}

	m.utilityTelemetry = []UtilityTelemetry{
		{
			ID: "UTL-01", SystemName: "Oksigen Sentral (Liquid VIE Tank)", Category: "GAS_MEDIS",
			Location: "Area Gas Medis Belakang", MetricLabel: "Level Tangki & Tekanan Manifold",
			CurrentValue: "82% • 4.6 Bar", ThresholdInfo: "Min 30% • 4.0–5.0 Bar",
			BackupStock: "24 Tabung O2 6m³ Cadangan Penuh", Status: "NORMAL", UpdatedAt: ts,
		},
		{
			ID: "UTL-02", SystemName: "Medical Compressed Air & Vacuum", Category: "GAS_MEDIS",
			Location: "Ruang Kompresor Sentral", MetricLabel: "Tekanan Output & Suction",
			CurrentValue: "4.2 Bar / -520 mmHg", ThresholdInfo: "4.0 Bar / -450 mmHg",
			BackupStock: "Dual Redundant Compressor Aktif", Status: "NORMAL", UpdatedAt: ts,
		},
		{
			ID: "UTL-03", SystemName: "HVAC Ruang Isolasi & Kamar Operasi", Category: "HVAC",
			Location: "Lt. 3 Isolasi & OK Sentral", MetricLabel: "Tekanan Diferensial & HEPA",
			CurrentValue: "-15 Pa (Isolasi) / +18 Pa (OK)", ThresholdInfo: "Isolasi <= -15 Pa • OK >= +15 Pa",
			BackupStock: "HEPA Filter Efficiency 99.97%", Status: "NORMAL", UpdatedAt: ts,
		},
		{
			ID: "UTL-04", SystemName: "Chiller AC Central Gedung Utama", Category: "HVAC",
			Location: "Rooftop Gedung A", MetricLabel: "Suhu Supply & Beban Kompresor",
			CurrentValue: "7.8°C • Beban 88%", ThresholdInfo: "6.0–8.5°C • Maks 90%",
			BackupStock: "Chiller #2 Standby Auto-Switch", Status: "WASPADA", UpdatedAt: ts,
		},
		{
			ID: "UTL-05", SystemName: "Genset Utama 1000 kVA + ATS", Category: "LISTRIK",
			Location: "Power House RS", MetricLabel: "Kapasitas Solar & Waktu Transfer",
			CurrentValue: "Solar 91% • ATS < 8 dtk", ThresholdInfo: "Min Solar 50% • KARS < 10 dtk",
			BackupStock: "UPS ICU & OK: 100% (45 mnt)", Status: "NORMAL", UpdatedAt: ts,
		},
		{
			ID: "UTL-06", SystemName: "Water Treatment Plant (RO Hemodialisa)", Category: "AIR_BERSIH",
			Location: "Unit Hemodialisa & Boiler", MetricLabel: "TDS Output & Klorinasi",
			CurrentValue: "TDS 4 ppm • pH 7.1", ThresholdInfo: "Maks TDS 10 ppm (AAMI)",
			BackupStock: "Reservoir Ground Tank 120.000 L", Status: "NORMAL", UpdatedAt: ts,
		},
	}

	m.ipalSensors = []IPALGreaseSensor{
		{
			ID: "IPAL-01", ZoneName: "Grease Trap Dapur Gizi Utama", SensorType: "GREASE_TRAP",
			LevelPct: 84, PHValue: 6.4, TempC: 34.2, Status: "BUTUH_KURAS",
			LastCleanedAt: "2026-11-10T08:00:00Z", Notes: "Akumulasi lemak > 80% — berisiko sumbat pipa & bau jika tidak segera dikuras",
		},
		{
			ID: "IPAL-02", ZoneName: "Grease Trap Laundry & CSSD", SensorType: "GREASE_TRAP",
			LevelPct: 38, PHValue: 7.4, TempC: 31.0, Status: "OPTIMAL",
			LastCleanedAt: "2026-11-20T09:30:00Z", Notes: "Aliran lancar, filter deterjen & lemak dalam batas aman",
		},
		{
			ID: "IPAL-03", ZoneName: "Bak Aerasi & Biofilter IPAL Sentral", SensorType: "BOD_COD",
			LevelPct: 52, PHValue: 7.2, TempC: 29.5, Status: "OPTIMAL",
			LastCleanedAt: "2026-11-18T14:00:00Z", Notes: "DO 4.2 mg/L, COD 42 mg/L (Baku Mutu KLHK < 80 mg/L)",
		},
		{
			ID: "IPAL-04", ZoneName: "Outlet Effluent & Desinfeksi Klorin", SensorType: "PH_OUTLET",
			LevelPct: 45, PHValue: 7.1, TempC: 28.8, Status: "OPTIMAL",
			LastCleanedAt: "2026-11-22T07:15:00Z", Notes: "Debit 64 m³/hari • Aman dibuang ke saluran kota",
		},
	}

	m.ipsrsWorkOrders = []WorkOrderIPSRS{
		{
			ID: "WO-01", TicketNo: "WO-IPSRS-2026-001", AssetOrZone: "Grease Trap Dapur Gizi Utama",
			IssueType: "IPAL_KURAS", Priority: "TINGGI", Technician: "Tim Sanitasi & IPSRS",
			Status: "OPEN", Notes: "Sensor ultrasonik mendeteksi ketebalan lemak 84%. Jadwalkan sedot grease trap hari ini.",
			CreatedAt: ts,
		},
		{
			ID: "WO-02", TicketNo: "WO-IPSRS-2026-002", AssetOrZone: "Defibrillator Biphasic + AED (IGD)",
			IssueType: "KALIBRASI", Priority: "DARURAT", Technician: "Teknisi Elektromedik (ATEM)",
			Status: "IN_PROGRESS", Notes: "Lewat jatuh tempo kalibrasi BPFK. Pengujian joule & baterai sedang berlangsung.",
			CreatedAt: ts,
		},
		{
			ID: "WO-03", TicketNo: "WO-IPSRS-2026-003", AssetOrZone: "Chiller AC Central Gedung Utama",
			IssueType: "PREVENTIVE", Priority: "SEDANG", Technician: "Teknisi HVAC & Mekanikal",
			Status: "OPEN", Notes: "Beban kompresor mencapai 88%, bersihkan kondensor & cek tekanan freon.",
			CreatedAt: ts,
		},
	}
}

func (m *MemoryStore) ListMedicalAssets(_ context.Context) ([]MedicalAsset, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]MedicalAsset, len(m.medicalAssets))
	copy(out, m.medicalAssets)
	return out, nil
}

func (m *MemoryStore) CalibrateMedicalAsset(ctx context.Context, id, technician, nextDate string) (MedicalAsset, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	today := time.Now().UTC().Format("2006-01-02")
	for i := range m.medicalAssets {
		if m.medicalAssets[i].ID == id {
			m.medicalAssets[i].LastCalibration = today
			if strings.TrimSpace(nextDate) != "" {
				m.medicalAssets[i].NextCalibration = strings.TrimSpace(nextDate)
			} else {
				m.medicalAssets[i].NextCalibration = time.Now().UTC().AddDate(0, 0, m.medicalAssets[i].PPMIntervalDays).Format("2006-01-02")
			}
			m.medicalAssets[i].CalibrationStatus = "LAIK_PAKAI"
			updated := m.medicalAssets[i]
			m.mu.Unlock()
			_ = m.AppendAudit(ctx, technician, "CALIBRATE_ASSET", "IPSRS_ASSET", updated.AssetCode, fmt.Sprintf("Kalibrasi %s selesai, berlaku s.d. %s", updated.Name, updated.NextCalibration))
			m.mu.Lock()
			return updated, nil
		}
	}
	return MedicalAsset{}, errors.New("aset medis tidak ditemukan")
}

func (m *MemoryStore) ListUtilityTelemetry(_ context.Context) ([]UtilityTelemetry, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]UtilityTelemetry, len(m.utilityTelemetry))
	copy(out, m.utilityTelemetry)
	return out, nil
}

func (m *MemoryStore) ListIPALSensors(_ context.Context) ([]IPALGreaseSensor, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]IPALGreaseSensor, len(m.ipalSensors))
	copy(out, m.ipalSensors)
	return out, nil
}

func (m *MemoryStore) FlushGreaseTrap(ctx context.Context, id, operator string) (IPALGreaseSensor, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	nowStr := time.Now().UTC().Format(time.RFC3339)
	for i := range m.ipalSensors {
		if m.ipalSensors[i].ID == id {
			m.ipalSensors[i].LevelPct = 8
			m.ipalSensors[i].Status = "OPTIMAL"
			m.ipalSensors[i].LastCleanedAt = nowStr
			m.ipalSensors[i].Notes = fmt.Sprintf("Dikuras & sensor di-reset oleh %s", operator)
			updated := m.ipalSensors[i]
			m.mu.Unlock()
			_ = m.AppendAudit(ctx, operator, "FLUSH_GREASE_TRAP", "IPAL_SENSOR", updated.ID, fmt.Sprintf("Kuras %s selesai (level turun ke 8%%)", updated.ZoneName))
			m.mu.Lock()
			return updated, nil
		}
	}
	return IPALGreaseSensor{}, errors.New("sensor IPAL tidak ditemukan")
}

func (m *MemoryStore) ListIPSRSWorkOrders(_ context.Context) ([]WorkOrderIPSRS, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]WorkOrderIPSRS, len(m.ipsrsWorkOrders))
	copy(out, m.ipsrsWorkOrders)
	return out, nil
}

func (m *MemoryStore) CreateIPSRSWorkOrder(ctx context.Context, wo WorkOrderIPSRS) (WorkOrderIPSRS, error) {
	m.mu.Lock()
	m.seq++
	wo.ID = uuid.NewString()
	wo.TicketNo = fmt.Sprintf("WO-IPSRS-%s-%03d", time.Now().UTC().Format("2006"), m.seq)
	if wo.Status == "" {
		wo.Status = "OPEN"
	}
	if wo.Priority == "" {
		wo.Priority = "SEDANG"
	}
	wo.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	m.ipsrsWorkOrders = append([]WorkOrderIPSRS{wo}, m.ipsrsWorkOrders...)
	m.mu.Unlock()
	_ = m.AppendAudit(ctx, wo.Technician, "CREATE_IPSRS_WO", "IPSRS_WO", wo.TicketNo, wo.AssetOrZone+": "+wo.Notes)
	return wo, nil
}

func (m *MemoryStore) UpdateIPSRSWorkOrderStatus(ctx context.Context, id, status string) (WorkOrderIPSRS, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.ipsrsWorkOrders {
		if m.ipsrsWorkOrders[i].ID == id {
			m.ipsrsWorkOrders[i].Status = strings.ToUpper(strings.TrimSpace(status))
			updated := m.ipsrsWorkOrders[i]
			m.mu.Unlock()
			_ = m.AppendAudit(ctx, "ipsrs", "UPDATE_IPSRS_WO", "IPSRS_WO", updated.TicketNo, "Status diubah ke "+updated.Status)
			m.mu.Lock()
			return updated, nil
		}
	}
	return WorkOrderIPSRS{}, errors.New("tiket work order tidak ditemukan")
}
