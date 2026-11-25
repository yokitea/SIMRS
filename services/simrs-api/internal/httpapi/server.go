package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/yokitea/SIMRS/pkg/auth"
	"github.com/yokitea/SIMRS/pkg/bpjs"
	"github.com/yokitea/SIMRS/pkg/fhir"
	"github.com/yokitea/SIMRS/pkg/hl7client"
	"github.com/yokitea/SIMRS/pkg/simrsstore"
)

type Config struct {
	JWTSecret      string
	SSOSecret      string
	BrandName      string
	HospitalName   string
	SatusehatOrgID string
	SatusehatEnv   string
	RISHL7Addr     string
	PACSViewerURL  string
}

type localUser struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	FullName string `json:"full_name"`
	Hash     string `json:"-"`
	Unit     string `json:"unit"`
	NIP      string `json:"nip"`
	Active   bool   `json:"active"`
}

type Server struct {
	cfg     Config
	repo    simrsstore.Repository
	loginRL *auth.RateLimiter
	usersMu sync.RWMutex
	users   map[string]localUser
	sepSeq  atomic.Int64
	mux     *http.ServeMux
}

func NewServer(cfg Config, repo simrsstore.Repository) *Server {
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "changeme_simrs_jwt_secret"
	}
	if cfg.SSOSecret == "" {
		cfg.SSOSecret = "shared_ihe_swf_sso_secret_32bytes"
	}
	if cfg.PACSViewerURL == "" {
		cfg.PACSViewerURL = "http://localhost:3001/viewer"
	}
	if cfg.BrandName == "" {
		cfg.BrandName = "Core SIMRS"
	}
	if cfg.HospitalName == "" {
		cfg.HospitalName = "RS Digital Indonesia"
	}
	if cfg.SatusehatOrgID == "" {
		cfg.SatusehatOrgID = "10000000"
	}

	adminH, _ := auth.HashPassword("admin123")
	dokH, _ := auth.HashPassword("dokter123")
	dokAnakH, _ := auth.HashPassword("dokter123")
	dokGigiH, _ := auth.HashPassword("dokter123")
	dokSarafH, _ := auth.HashPassword("dokter123")
	dokUmumH, _ := auth.HashPassword("dokter123")
	radH, _ := auth.HashPassword("rad123")
	perawatH, _ := auth.HashPassword("perawat123")
	farH, _ := auth.HashPassword("farmasi123")
	kasH, _ := auth.HashPassword("kasir123")
	admisiH, _ := auth.HashPassword("admisi123")
	direksiH, _ := auth.HashPassword("direksi123")
	hrdH, _ := auth.HashPassword("hrd123")
	ipsrsH, _ := auth.HashPassword("ipsrs123")
	opsH, _ := auth.HashPassword("ops123")

	s := &Server{
		cfg:     cfg,
		repo:    repo,
		loginRL: auth.NewRateLimiter(10, time.Minute),
		users: map[string]localUser{
			"admin":        {Username: "admin", Role: "ADMIN", FullName: "Administrator IT SIMRS", Hash: adminH, Unit: "Instalasi TI & SIMRS", NIP: "198801152010121001", Active: true},
			"dokter":       {Username: "dokter", Role: "DOKTER", FullName: "dr. Hendra Wijaya, Sp.PD", Hash: dokH, Unit: "Poli Penyakit Dalam", NIP: "198003152006041002", Active: true},
			"dokter_anak":  {Username: "dokter_anak", Role: "DOKTER", FullName: "dr. Siti Nurhaliza, Sp.A", Hash: dokAnakH, Unit: "Poli Anak", NIP: "198507202011012003", Active: true},
			"dokter_gigi":  {Username: "dokter_gigi", Role: "DOKTER", FullName: "drg. Maya Indah, Sp.KG", Hash: dokGigiH, Unit: "Poli Gigi & Mulut", NIP: "198904122014022005", Active: true},
			"dokter_saraf": {Username: "dokter_saraf", Role: "DOKTER", FullName: "dr. Farhan Malik, Sp.S", Hash: dokSarafH, Unit: "Poli Saraf", NIP: "198302182009031004", Active: true},
			"dokter_umum":  {Username: "dokter_umum", Role: "DOKTER", FullName: "dr. Ahmad Fauzi", Hash: dokUmumH, Unit: "Poli Umum", NIP: "199406202020121006", Active: true},
			"radiolog":     {Username: "radiolog", Role: "DOKTER", FullName: "dr. Kartika Putri, Sp.Rad", Hash: radH, Unit: "Instalasi Radiologi", NIP: "198711042012122004", Active: true},
			"perawat":      {Username: "perawat", Role: "PERAWAT", FullName: "Ns. Andi Pratama, S.Kep", Hash: perawatH, Unit: "Rawat Inap Pav. Anggrek", NIP: "199205102015031005", Active: true},
			"farmasi":      {Username: "farmasi", Role: "FARMASI", FullName: "apt. Nadia Putri, S.Farm", Hash: farH, Unit: "Farmasi Rawat Jalan", NIP: "199104122014022006", Active: true},
			"kasir":        {Username: "kasir", Role: "KASIR", FullName: "Rian Santoso, S.E", Hash: kasH, Unit: "Kasir & BPJS Lt. 1", NIP: "199308192017011007", Active: true},
			"admisi":       {Username: "admisi", Role: "ADMISI", FullName: "Dewi Lestari, A.Md", Hash: admisiH, Unit: "Admisi & Registrasi", NIP: "199502102018042008", Active: true},
			"direksi":      {Username: "direksi", Role: "DIREKSI", FullName: "dr. Budi Rahardjo, MARS", Hash: direksiH, Unit: "Direksi & Manajemen Eksekutif", NIP: "197509122000031001", Active: true},
			"hrd":          {Username: "hrd", Role: "HRD", FullName: "Siti Rahmawati, S.Psi", Hash: hrdH, Unit: "Bagian SDM & Kredensial Medis", NIP: "199008252016022004", Active: true},
			"ipsrs":        {Username: "ipsrs", Role: "IPSRS", FullName: "Ir. Bambang Prasetyo, ST", Hash: ipsrsH, Unit: "Instalasi Pemeliharaan Sarana RS (IPSRS)", NIP: "198604102011011009", Active: true},
			"operasional":  {Username: "operasional", Role: "OPS", FullName: "Hendra Kusuma, A.Md", Hash: opsH, Unit: "Instalasi Gizi, CSSD & Transportasi RS", NIP: "198911202014031002", Active: true},
		},
		mux: http.NewServeMux(),
	}
	s.sepSeq.Store(time.Now().Unix() % 900000)
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return auth.SecurityHeaders(s.mux)
}

func allowedWorkstationsForRole(role string) []string {
	switch strings.ToUpper(strings.TrimSpace(role)) {
	case "ADMIN":
		return []string{"CLINIC", "PHARMACY", "BILLING", "ADMISSION", "RANAP", "EXECUTIVE", "HRD", "IPSRS", "OPS", "ADMIN"}
	case "DOKTER":
		return []string{"CLINIC", "RANAP"}
	case "FARMASI":
		return []string{"PHARMACY"}
	case "KASIR":
		return []string{"BILLING"}
	case "ADMISI":
		return []string{"ADMISSION"}
	case "PERAWAT":
		return []string{"RANAP"}
	case "DIREKSI":
		return []string{"EXECUTIVE", "RANAP", "IPSRS", "OPS"}
	case "HRD":
		return []string{"HRD"}
	case "IPSRS":
		return []string{"IPSRS"}
	case "OPS":
		return []string{"OPS"}
	default:
		return []string{"CLINIC"}
	}
}

func (s *Server) routes() {
	anyAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, nil, h)
	}
	adminOnly := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN"}, h)
	}
	admisiAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN", "ADMISI", "DOKTER"}, h)
	}
	dokterAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN", "DOKTER"}, h)
	}
	farmasiAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN", "FARMASI"}, h)
	}
	kasirAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN", "KASIR"}, h)
	}
	clinicalAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN", "DOKTER", "PERAWAT"}, h)
	}
	billingViewAuth := func(h http.HandlerFunc) http.HandlerFunc {
		return auth.RequireAuth(s.cfg.JWTSecret, []string{"ADMIN", "KASIR", "DIREKSI"}, h)
	}

	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	s.mux.HandleFunc("GET /api/v1/dashboard", anyAuth(s.handleDashboard))
	s.mux.HandleFunc("GET /api/v1/clinics", anyAuth(s.handleListClinics))

	s.mux.HandleFunc("GET /api/v1/patients", anyAuth(s.handleListPatients))
	s.mux.HandleFunc("POST /api/v1/patients", admisiAuth(s.handleCreatePatient))

	s.mux.HandleFunc("GET /api/v1/visits", anyAuth(s.handleListVisits))
	s.mux.HandleFunc("POST /api/v1/visits", admisiAuth(s.handleCreateVisit))
	s.mux.HandleFunc("POST /api/v1/visits/{id}/sep", kasirAuth(s.handleGenerateSEP))
	s.mux.HandleFunc("GET /api/v1/visits/{id}/soap", clinicalAuth(s.handleListSOAP))
	s.mux.HandleFunc("POST /api/v1/visits/{id}/soap", dokterAuth(s.handleCreateSOAP))
	s.mux.HandleFunc("POST /api/v1/visits/{id}/radiology-orders", dokterAuth(s.handleCreateRadiologyOrder))
	s.mux.HandleFunc("POST /api/v1/visits/{id}/prescriptions", dokterAuth(s.handleCreatePrescription))
	s.mux.HandleFunc("POST /api/v1/visits/{id}/settle", kasirAuth(s.handleSettleBilling))

	s.mux.HandleFunc("GET /api/v1/beds", anyAuth(s.handleListBeds))
	s.mux.HandleFunc("POST /api/v1/beds/{id}/release", admisiAuth(s.handleReleaseBed))

	s.mux.HandleFunc("GET /api/v1/radiology-orders", anyAuth(s.handleListRadiologyOrders))
	s.mux.HandleFunc("GET /api/v1/radiology-orders/{id}/viewer-url", anyAuth(s.handleRadiologyViewerURL))
	s.mux.HandleFunc("POST /api/v1/radiology-orders/report", dokterAuth(s.handleAttachRadiologyReport))
	s.mux.HandleFunc("GET /api/v1/medications", anyAuth(s.handleListMedications))
	s.mux.HandleFunc("GET /api/v1/prescriptions", anyAuth(s.handleListPrescriptions))
	s.mux.HandleFunc("POST /api/v1/prescriptions/{id}/dispense", farmasiAuth(s.handleDispensePrescription))

	s.mux.HandleFunc("GET /api/v1/billing", billingViewAuth(s.handleListBilling))
	s.mux.HandleFunc("GET /api/v1/outbox", anyAuth(s.handleListOutbox))
	s.mux.HandleFunc("GET /api/v1/users", adminOnly(s.handleListUsers))
	s.mux.HandleFunc("POST /api/v1/users", adminOnly(s.handleCreateUser))
	s.mux.HandleFunc("POST /api/v1/users/{username}/toggle", adminOnly(s.handleToggleUserStatus))
	s.mux.HandleFunc("GET /api/v1/audit-logs", anyAuth(s.handleListAudits))
	s.mux.HandleFunc("POST /api/v1/satusehat/test-oauth", adminOnly(s.handleTestSatusehatOAuth))
	s.mux.HandleFunc("GET /api/v1/executive/metrics", anyAuth(s.handleExecutiveMetrics))
	s.mux.HandleFunc("GET /api/v1/hrd/credentials", anyAuth(s.handleHRDCredentials))
	s.mux.HandleFunc("GET /api/v1/ipsrs/overview", anyAuth(s.handleIPSRSOverview))
	s.mux.HandleFunc("POST /api/v1/ipsrs/assets/{id}/calibrate", anyAuth(s.handleCalibrateAsset))
	s.mux.HandleFunc("POST /api/v1/ipsrs/ipal/{id}/flush", anyAuth(s.handleFlushIPAL))
	s.mux.HandleFunc("POST /api/v1/ipsrs/work-orders", anyAuth(s.handleCreateIPSRSWorkOrder))
	s.mux.HandleFunc("POST /api/v1/ipsrs/work-orders/{id}/status", anyAuth(s.handleUpdateIPSRSWorkOrderStatus))
	s.mux.HandleFunc("GET /api/v1/ops/overview", anyAuth(s.handleOpsOverview))
	s.mux.HandleFunc("POST /api/v1/ops/nutrition/{id}/advance", anyAuth(s.handleAdvanceNutrition))
	s.mux.HandleFunc("POST /api/v1/ops/cssd/{id}/advance", anyAuth(s.handleAdvanceCSSD))
	s.mux.HandleFunc("POST /api/v1/ops/ambulances/{id}/dispatch", anyAuth(s.handleDispatchAmbulance))
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"service":  "simrs-api",
		"brand":    s.cfg.BrandName,
		"hospital": s.cfg.HospitalName,
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.loginRL.Allow(r.RemoteAddr) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many login attempts"})
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	s.usersMu.RLock()
	u, ok := s.users[strings.TrimSpace(req.Username)]
	s.usersMu.RUnlock()
	if !ok || !auth.VerifyPassword(u.Hash, req.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	if !u.Active {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "akun pengguna dinonaktifkan (suspended)"})
		return
	}
	allowedWs := allowedWorkstationsForRole(u.Role)
	tok, err := auth.SignJWT(s.cfg.JWTSecret, auth.Claims{
		Sub:          req.Username,
		Role:         u.Role,
		Name:         u.FullName,
		Unit:         u.Unit,
		NIP:          u.NIP,
		Workstations: allowedWs,
		Exp:          time.Now().Add(12 * time.Hour).Unix(),
	})
	if err != nil {
		writeInternalErr(w, "sign jwt", err)
		return
	}
	_ = s.repo.AppendAudit(r.Context(), req.Username, "LOGIN", "AUTH", req.Username, fmt.Sprintf("SIMRS Web Login (%s - %s)", u.Role, u.Unit))
	writeJSON(w, http.StatusOK, map[string]any{
		"token": tok,
		"user": map[string]any{
			"username":     req.Username,
			"role":         u.Role,
			"full_name":    u.FullName,
			"unit":         u.Unit,
			"nip":          u.NIP,
			"workstations": allowedWs,
		},
	})
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := s.repo.Stats(r.Context())
	if err != nil {
		writeInternalErr(w, "dashboard", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"stats": stats,
		"system": map[string]string{
			"brand":           s.cfg.BrandName,
			"hospital":        s.cfg.HospitalName,
			"ris_hl7_addr":    s.cfg.RISHL7Addr,
			"pacs_viewer_url": s.cfg.PACSViewerURL,
			"satusehat_env":   s.cfg.SatusehatEnv,
		},
	})
}

func (s *Server) handleListClinics(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListClinics(r.Context())
	if err != nil {
		writeInternalErr(w, "list clinics", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"clinics": list})
}

func (s *Server) handleListPatients(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListPatients(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		writeInternalErr(w, "list patients", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"patients": list})
}

func (s *Server) handleCreatePatient(w http.ResponseWriter, r *http.Request) {
	var p simrsstore.Patient
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	p.ID = "" // never trust client-supplied ID
	if strings.TrimSpace(p.FullName) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "full_name required"})
		return
	}
	saved, err := s.repo.CreatePatient(r.Context(), p)
	if err != nil {
		writeInternalErr(w, "create patient", err)
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "CREATE_PATIENT", "PATIENT", saved.NoRM, saved.FullName)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleListVisits(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListVisits(r.Context(), r.URL.Query().Get("service_type"))
	if err != nil {
		writeInternalErr(w, "list visits", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"visits": list})
}

func (s *Server) handleCreateVisit(w http.ResponseWriter, r *http.Request) {
	var req simrsstore.Visit
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	req.ID = "" // prevent client-supplied short ID slice panic
	pat, ok, err := s.repo.GetPatient(r.Context(), req.PatientID)
	if err != nil || !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "patient_id not found"})
		return
	}
	req.PatientNoRM = pat.NoRM
	req.PatientName = pat.FullName
	if req.ServiceType == "" {
		req.ServiceType = "RJ"
	}
	if req.UnitName == "" {
		req.UnitName = "Poli Umum"
	}
	if req.DoctorName == "" {
		req.DoctorName = "dr. Hendra Wijaya, Sp.PD"
	}
	if req.PaymentType == "" {
		req.PaymentType = "UMUM"
	}

	saved, err := s.repo.CreateVisit(r.Context(), req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if strings.EqualFold(saved.PaymentType, "BPJS") {
		sep := bpjs.GenerateSEPNumber("0112R001", time.Now(), s.sepSeq.Add(1))
		code, tariff := bpjs.EstimateINACBG("Z00.0", saved.ServiceType, "KELAS_3")
		_ = s.repo.AttachSEP(r.Context(), saved.ID, sep, code, tariff)
		saved.SEPNumber = sep
		saved.INACBGCode = code
		saved.INACBGTariff = tariff
	}

	encPayload, _ := json.Marshal(fhir.BuildEncounter(
		s.cfg.SatusehatOrgID, saved.VisitNumber, pat.IHSNumber, pat.FullName,
		"N10000001", saved.DoctorName, saved.ServiceType, "LOC-01", saved.UnitName, saved.CreatedAt,
	))
	_, _ = s.repo.EnqueueOutbox(r.Context(), simrsstore.OutboxItem{
		Target: "SATUSEHAT_FHIR", EventType: "FHIR_ENCOUNTER", ReferenceID: saved.VisitNumber,
		Payload: string(encPayload), Status: "QUEUED",
	})
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "CREATE_VISIT", "VISIT", saved.VisitNumber, fmt.Sprintf("%s %s (%s)", saved.ServiceType, saved.UnitName, saved.PaymentType))
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleGenerateSEP(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	v, ok, err := s.repo.GetVisit(r.Context(), visitID)
	if err != nil || !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "visit not found"})
		return
	}
	var req struct {
		ICD10     string `json:"icd10"`
		CareClass string `json:"care_class"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req)
	sep := bpjs.GenerateSEPNumber("0112R001", time.Now(), s.sepSeq.Add(1))
	code, tariff := bpjs.EstimateINACBG(req.ICD10, v.ServiceType, req.CareClass)
	if err := s.repo.AttachSEP(r.Context(), visitID, sep, code, tariff); err != nil {
		writeInternalErr(w, "attach sep", err)
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "ISSUE_SEP", "BPJS", sep, fmt.Sprintf("INA-CBG=%s Tariff=%d", code, tariff))
	writeJSON(w, http.StatusOK, map[string]any{
		"visit_id": visitID, "sep_number": sep, "inacbg_code": code, "inacbg_tariff": tariff,
	})
}

func (s *Server) handleListSOAP(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	list, err := s.repo.ListSOAPNotes(r.Context(), visitID)
	if err != nil {
		writeInternalErr(w, "list soap", err)
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "VIEW_RME", "SOAP_NOTE", visitID, "Inspeksi rekam medis pasien")
	writeJSON(w, http.StatusOK, map[string]any{"soap_notes": list})
}

func (s *Server) handleCreateSOAP(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	v, ok, err := s.repo.GetVisit(r.Context(), visitID)
	if err != nil || !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "visit not found"})
		return
	}
	var n simrsstore.SOAPNote
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&n); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	n.ID = ""
	n.VisitID = visitID
	if claims, ok := auth.ClaimsFromContext(r.Context()); ok && claims.Name != "" {
		n.AuthorName = claims.Name
	} else {
		n.AuthorName = v.DoctorName
	}
	saved, err := s.repo.CreateSOAPNote(r.Context(), n)
	if err != nil {
		writeInternalErr(w, "create soap", err)
		return
	}
	if n.ICD10Code != "" {
		if pat, ok, err := s.repo.GetPatient(r.Context(), v.PatientID); err == nil && ok {
			condPayload, _ := json.Marshal(fhir.BuildCondition(
				pat.IHSNumber, v.PatientName, v.SatusehatEncounterID, n.ICD10Code, n.ICD10Name, saved.CreatedAt,
			))
			_, _ = s.repo.EnqueueOutbox(r.Context(), simrsstore.OutboxItem{
				Target: "SATUSEHAT_FHIR", EventType: "FHIR_CONDITION", ReferenceID: v.VisitNumber,
				Payload: string(condPayload), Status: "QUEUED",
			})
		}
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "CREATE_SOAP", "RME", v.VisitNumber, "ICD10="+n.ICD10Code)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleListRadiologyOrders(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListRadiologyOrders(r.Context(), r.URL.Query().Get("visit_id"))
	if err != nil {
		writeInternalErr(w, "list rad orders", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"radiology_orders": list})
}

// handleRadiologyViewerURL mints a 5-minute study-scoped SSO token for zero-login Core PACS Viewer launch.
func (s *Server) handleRadiologyViewerURL(w http.ResponseWriter, r *http.Request) {
	ord, ok, err := s.repo.GetRadiologyOrder(r.Context(), r.PathValue("id"))
	if err != nil || !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "radiology order not found"})
		return
	}
	actor := auth.ActorFromRequest(r)
	tok, err := auth.SignJWT(s.cfg.SSOSecret, auth.Claims{
		Sub:        actor,
		Role:       "VIEWER",
		Name:       actor,
		StudyScope: ord.StudyInstanceUID,
		Exp:        time.Now().Add(5 * time.Minute).Unix(),
	})
	if err != nil {
		writeInternalErr(w, "sign sso viewer token", err)
		return
	}
	base := strings.TrimRight(s.cfg.PACSViewerURL, "/")
	launchURL := fmt.Sprintf("%s?StudyInstanceUID=%s&accession=%s&token=%s", base, ord.StudyInstanceUID, ord.AccessionNumber, tok)
	_ = s.repo.AppendAudit(r.Context(), actor, "LAUNCH_PACS", "PACS_VIEWER", ord.AccessionNumber, "Membuka citra diagnostik DICOM "+ord.ProcedureName)
	writeJSON(w, http.StatusOK, map[string]any{
		"viewer_url":         launchURL,
		"study_instance_uid": ord.StudyInstanceUID,
		"expires_in_sec":     300,
	})
}

// handleAttachRadiologyReport attaches a finalized/amended radiology report from Core RIS into SIMRS RME (IHE RAD-28).
func (s *Server) handleAttachRadiologyReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccessionNumber  string `json:"accession_number"`
		StudyInstanceUID string `json:"study_instance_uid"`
		ReportStatus     string `json:"report_status"`
		RadiologistName  string `json:"radiologist_name"`
		ReportText       string `json:"report_text"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if req.ReportStatus == "" {
		req.ReportStatus = "FINAL"
	}
	if err := s.repo.AttachRadiologyReport(r.Context(), req.AccessionNumber, req.StudyInstanceUID, req.ReportStatus, req.RadiologistName, req.ReportText); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "RECEIVE_RAD_REPORT", "RME", req.AccessionNumber, "Status="+req.ReportStatus)
	writeJSON(w, http.StatusOK, map[string]string{"status": "attached", "accession_number": req.AccessionNumber})
}

func (s *Server) handleCreateRadiologyOrder(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	v, ok, err := s.repo.GetVisit(r.Context(), visitID)
	if err != nil || !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "visit not found"})
		return
	}
	pat, ok, err := s.repo.GetPatient(r.Context(), v.PatientID)
	if err != nil || !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "patient record missing"})
		return
	}

	var o simrsstore.RadiologyOrder
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&o); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	o.ID = "" // prevent client-supplied short ID slice panic
	o.VisitID = visitID
	o.PatientNoRM = v.PatientNoRM
	o.PatientName = v.PatientName
	if o.Modality == "" {
		o.Modality = "DX"
	}
	if o.ProcedureName == "" {
		o.ProcedureName = "Foto Thorax PA"
	}
	o.Status = "ORDERED"
	o.RISSyncStatus = "QUEUED"

	saved, err := s.repo.CreateRadiologyOrder(r.Context(), o)
	if err != nil {
		writeInternalErr(w, "create rad order", err)
		return
	}

	ctrlID := saved.ID
	if len(ctrlID) > 8 {
		ctrlID = ctrlID[:8]
	}
	orm := hl7client.BuildORM(hl7client.RadiologyOrderHL7{
		ControlID:        ctrlID,
		PatientID:        pat.NoRM,
		PatientName:      pat.FullName,
		PatientBirthDate: pat.BirthDate,
		PatientSex:       pat.Sex,
		AccessionNumber:  saved.AccessionNumber,
		StudyInstanceUID: saved.StudyInstanceUID,
		ProcedureCode:    saved.ProcedureCode,
		ProcedureName:    saved.ProcedureName,
		Modality:         saved.Modality,
	}, time.Now())

	outStatus := "QUEUED"
	lastErr := ""
	if s.cfg.RISHL7Addr != "" {
		sendCtx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
		_, err := hl7client.SendMLLP(sendCtx, s.cfg.RISHL7Addr, orm)
		cancel()
		if err == nil {
			outStatus = "SENT"
			saved.RISSyncStatus = "SENT_HL7"
		} else {
			lastErr = err.Error()
		}
	}

	hl7JSON, _ := json.Marshal(map[string]string{"hl7": orm, "target": s.cfg.RISHL7Addr})
	_, _ = s.repo.EnqueueOutbox(r.Context(), simrsstore.OutboxItem{
		Target: "RIS_HL7", EventType: "ORM_O01", ReferenceID: saved.AccessionNumber,
		Payload: string(hl7JSON), Status: outStatus, LastError: lastErr,
	})
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "ORDER_RADIOLOGY", "RIS_ORDER", saved.AccessionNumber, saved.ProcedureName)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleListBeds(w http.ResponseWriter, r *http.Request) {
	beds, err := s.repo.ListBeds(r.Context())
	if err != nil {
		writeInternalErr(w, "list beds", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"beds": beds})
}

func (s *Server) handleReleaseBed(w http.ResponseWriter, r *http.Request) {
	bedID := r.PathValue("id")
	if err := s.repo.ReleaseBed(r.Context(), bedID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "DISCHARGE_BED", "BED", bedID, "Pasien pulang / bed dikosongkan")
	writeJSON(w, http.StatusOK, map[string]string{"released": bedID})
}

func (s *Server) handleListMedications(w http.ResponseWriter, r *http.Request) {
	meds, err := s.repo.ListMedications(r.Context())
	if err != nil {
		writeInternalErr(w, "list meds", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"medications": meds})
}

func (s *Server) handleListPrescriptions(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListPrescriptions(r.Context(), r.URL.Query().Get("visit_id"))
	if err != nil {
		writeInternalErr(w, "list rx", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"prescriptions": list})
}

func (s *Server) handleCreatePrescription(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	v, ok, err := s.repo.GetVisit(r.Context(), visitID)
	if err != nil || !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "visit not found"})
		return
	}
	pat, ok, err := s.repo.GetPatient(r.Context(), v.PatientID)
	if err != nil || !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "patient record missing"})
		return
	}

	var rx simrsstore.Prescription
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&rx); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if rx.Qty <= 0 || rx.Qty > 1000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "qty must be between 1 and 1000"})
		return
	}
	rx.ID = ""
	rx.VisitID = visitID
	rx.PatientNoRM = v.PatientNoRM
	rx.PatientName = v.PatientName
	rx.DoctorName = v.DoctorName

	saved, err := s.repo.CreatePrescription(r.Context(), rx)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	medPayload, _ := json.Marshal(fhir.BuildMedicationRequest(
		s.cfg.SatusehatOrgID, saved.RxNumber, pat.IHSNumber, v.SatusehatEncounterID,
		saved.KFACode, saved.MedicationName, saved.Dosage, saved.Qty,
	))
	_, _ = s.repo.EnqueueOutbox(r.Context(), simrsstore.OutboxItem{
		Target: "SATUSEHAT_FHIR", EventType: "FHIR_MEDICATION_REQUEST", ReferenceID: saved.RxNumber,
		Payload: string(medPayload), Status: "QUEUED",
	})
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "CREATE_RX", "FARMASI", saved.RxNumber, saved.MedicationName)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleDispensePrescription(w http.ResponseWriter, r *http.Request) {
	rxID := r.PathValue("id")
	dispensed, err := s.repo.DispensePrescription(r.Context(), rxID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "DISPENSE_RX", "FARMASI", dispensed.RxNumber, fmt.Sprintf("%s x%d", dispensed.MedicationName, dispensed.Qty))
	writeJSON(w, http.StatusOK, dispensed)
}

func (s *Server) handleListBilling(w http.ResponseWriter, r *http.Request) {
	items, err := s.repo.ListBillingItems(r.Context(), r.URL.Query().Get("visit_id"))
	if err != nil {
		writeInternalErr(w, "list billing", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"billing_items": items})
}

func (s *Server) handleSettleBilling(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	total, err := s.repo.SettleVisitBilling(r.Context(), visitID)
	if err != nil {
		writeInternalErr(w, "settle billing", err)
		return
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "SETTLE_BILLING", "BILLING", visitID, fmt.Sprintf("Total=Rp%d", total))
	writeJSON(w, http.StatusOK, map[string]any{"visit_id": visitID, "total_paid": total, "status": "LUNAS"})
}

func (s *Server) handleListOutbox(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListOutbox(r.Context(), 50)
	if err != nil {
		writeInternalErr(w, "list outbox", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"outbox": list})
}

func (s *Server) handleListUsers(w http.ResponseWriter, _ *http.Request) {
	s.usersMu.RLock()
	defer s.usersMu.RUnlock()
	list := make([]localUser, 0, len(s.users))
	for _, u := range s.users {
		list = append(list, localUser{
			Username: u.Username,
			Role:     u.Role,
			FullName: u.FullName,
			Unit:     u.Unit,
			NIP:      u.NIP,
			Active:   u.Active,
		})
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].Username < list[j].Username
	})
	writeJSON(w, http.StatusOK, map[string]any{"users": list})
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
		FullName string `json:"full_name"`
		Unit     string `json:"unit"`
		NIP      string `json:"nip"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username dan password wajib diisi"})
		return
	}
	if req.Role == "" {
		req.Role = "DOKTER"
	}
	h, err := auth.HashPassword(req.Password)
	if err != nil {
		writeInternalErr(w, "hash pw", err)
		return
	}
	u := localUser{
		Username: req.Username,
		Role:     strings.ToUpper(req.Role),
		FullName: req.FullName,
		Hash:     h,
		Unit:     req.Unit,
		NIP:      req.NIP,
		Active:   true,
	}
	s.usersMu.Lock()
	s.users[req.Username] = u
	s.usersMu.Unlock()

	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "CREATE_USER", "IAM", req.Username, fmt.Sprintf("Akun baru: %s (%s - %s)", req.FullName, req.Role, req.Unit))
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "user": u})
}

func (s *Server) handleToggleUserStatus(w http.ResponseWriter, r *http.Request) {
	un := strings.ToLower(strings.TrimSpace(r.PathValue("username")))
	s.usersMu.Lock()
	u, ok := s.users[un]
	if !ok {
		s.usersMu.Unlock()
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	u.Active = !u.Active
	s.users[un] = u
	s.usersMu.Unlock()

	statusStr := "AKTIF"
	if !u.Active {
		statusStr = "DITANGGUHKAN (SUSPENDED)"
	}
	_ = s.repo.AppendAudit(r.Context(), auth.ActorFromRequest(r), "TOGGLE_USER_STATUS", "IAM", un, "Status akun diubah menjadi: "+statusStr)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": un, "active": u.Active})
}

func (s *Server) handleListAudits(w http.ResponseWriter, r *http.Request) {
	limit := 100
	list, err := s.repo.ListAudits(r.Context(), limit)
	if err != nil {
		writeInternalErr(w, "list audits", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"audit_logs": list})
}

func (s *Server) handleTestSatusehatOAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Env          string `json:"env"`
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	tok, code, err := fhir.FetchOAuth2Token(r.Context(), req.Env, req.ClientID, req.ClientSecret)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "http_status": code, "error": "OAuth2 handshake failed"})
		return
	}
	preview := tok
	if len(preview) > 16 {
		preview = preview[:16] + "..."
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "http_status": code, "token_preview": preview})
}

func (s *Server) handleExecutiveMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := s.repo.GetExecutiveMetrics(r.Context())
	if err != nil {
		writeInternalErr(w, "executive metrics", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"metrics": metrics})
}

func (s *Server) handleHRDCredentials(w http.ResponseWriter, r *http.Request) {
	creds, err := s.repo.ListStaffCredentials(r.Context())
	if err != nil {
		writeInternalErr(w, "hrd credentials", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"credentials": creds})
}

func (s *Server) handleIPSRSOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	assets, err := s.repo.ListMedicalAssets(ctx)
	if err != nil {
		writeInternalErr(w, "ipsrs assets", err)
		return
	}
	utilities, err := s.repo.ListUtilityTelemetry(ctx)
	if err != nil {
		writeInternalErr(w, "ipsrs utilities", err)
		return
	}
	ipal, err := s.repo.ListIPALSensors(ctx)
	if err != nil {
		writeInternalErr(w, "ipsrs ipal", err)
		return
	}
	wos, err := s.repo.ListIPSRSWorkOrders(ctx)
	if err != nil {
		writeInternalErr(w, "ipsrs work orders", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"assets":       assets,
		"utilities":    utilities,
		"ipal_sensors": ipal,
		"work_orders":  wos,
	})
}

func (s *Server) handleCalibrateAsset(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		NextCalibration string `json:"next_calibration"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	actor := "ipsrs"
	if claims, ok := auth.ClaimsFromContext(r.Context()); ok && claims.Name != "" {
		actor = claims.Name
	}
	updated, err := s.repo.CalibrateMedicalAsset(r.Context(), id, actor, req.NextCalibration)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"asset": updated})
}

func (s *Server) handleFlushIPAL(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	actor := "ipsrs"
	if claims, ok := auth.ClaimsFromContext(r.Context()); ok && claims.Name != "" {
		actor = claims.Name
	}
	updated, err := s.repo.FlushGreaseTrap(r.Context(), id, actor)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sensor": updated})
}

func (s *Server) handleCreateIPSRSWorkOrder(w http.ResponseWriter, r *http.Request) {
	var req simrsstore.WorkOrderIPSRS
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "payload tidak valid"})
		return
	}
	if strings.TrimSpace(req.AssetOrZone) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "asset_or_zone wajib diisi"})
		return
	}
	if strings.TrimSpace(req.Technician) == "" {
		req.Technician = "Tim IPSRS"
	}
	wo, err := s.repo.CreateIPSRSWorkOrder(r.Context(), req)
	if err != nil {
		writeInternalErr(w, "create ipsrs wo", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"work_order": wo})
}

func (s *Server) handleUpdateIPSRSWorkOrderStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Status) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "status wajib diisi"})
		return
	}
	updated, err := s.repo.UpdateIPSRSWorkOrderStatus(r.Context(), id, req.Status)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"work_order": updated})
}

func (s *Server) handleOpsOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	nutrition, err := s.repo.ListNutritionOrders(ctx)
	if err != nil {
		writeInternalErr(w, "ops nutrition", err)
		return
	}
	cssd, err := s.repo.ListCSSDBatches(ctx)
	if err != nil {
		writeInternalErr(w, "ops cssd", err)
		return
	}
	ambulances, err := s.repo.ListAmbulances(ctx)
	if err != nil {
		writeInternalErr(w, "ops ambulances", err)
		return
	}
	parking, err := s.repo.ListParkingZones(ctx)
	if err != nil {
		writeInternalErr(w, "ops parking", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"nutrition_orders": nutrition,
		"cssd_batches":     cssd,
		"ambulances":       ambulances,
		"parking_zones":    parking,
	})
}

func (s *Server) handleAdvanceNutrition(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	actor := "operasional"
	if claims, ok := auth.ClaimsFromContext(r.Context()); ok && claims.Name != "" {
		actor = claims.Name
	}
	updated, err := s.repo.AdvanceNutritionOrder(r.Context(), id, actor)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"order": updated})
}

func (s *Server) handleAdvanceCSSD(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	actor := "operasional"
	if claims, ok := auth.ClaimsFromContext(r.Context()); ok && claims.Name != "" {
		actor = claims.Name
	}
	updated, err := s.repo.AdvanceCSSDBatch(r.Context(), id, actor)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"batch": updated})
}

func (s *Server) handleDispatchAmbulance(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Mission string `json:"mission"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	actor := "operasional"
	if claims, ok := auth.ClaimsFromContext(r.Context()); ok && claims.Name != "" {
		actor = claims.Name
	}
	updated, err := s.repo.DispatchAmbulance(r.Context(), id, req.Mission, actor)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ambulance": updated})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeInternalErr(w http.ResponseWriter, op string, err error) {
	log.Printf("[simrs-api] %s error: %v", op, err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}
