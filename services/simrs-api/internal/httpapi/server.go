package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/yokitea/SIMRS/pkg/auth"
	"github.com/yokitea/SIMRS/pkg/bpjs"
	"github.com/yokitea/SIMRS/pkg/fhir"
	"github.com/yokitea/SIMRS/pkg/hl7client"
	"github.com/yokitea/SIMRS/pkg/simrsstore"
)

type Config struct {
	JWTSecret      string
	BrandName      string
	HospitalName   string
	SatusehatOrgID string
	SatusehatEnv   string
	RISHL7Addr     string
	PACSViewerURL  string
}

type Server struct {
	cfg     Config
	repo    simrsstore.Repository
	loginRL *auth.RateLimiter
	mux     *http.ServeMux
}

func NewServer(cfg Config, repo simrsstore.Repository) *Server {
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "changeme_simrs_jwt_secret"
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
	s := &Server{
		cfg:     cfg,
		repo:    repo,
		loginRL: auth.NewRateLimiter(20, time.Minute),
		mux:     http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler {
	return auth.SecurityHeaders(s.mux)
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	s.mux.HandleFunc("GET /api/v1/dashboard", s.handleDashboard)

	s.mux.HandleFunc("GET /api/v1/patients", s.handleListPatients)
	s.mux.HandleFunc("POST /api/v1/patients", s.handleCreatePatient)

	s.mux.HandleFunc("GET /api/v1/visits", s.handleListVisits)
	s.mux.HandleFunc("POST /api/v1/visits", s.handleCreateVisit)
	s.mux.HandleFunc("POST /api/v1/visits/{id}/sep", s.handleGenerateSEP)
	s.mux.HandleFunc("GET /api/v1/visits/{id}/soap", s.handleListSOAP)
	s.mux.HandleFunc("POST /api/v1/visits/{id}/soap", s.handleCreateSOAP)
	s.mux.HandleFunc("POST /api/v1/visits/{id}/radiology-orders", s.handleCreateRadiologyOrder)
	s.mux.HandleFunc("POST /api/v1/visits/{id}/prescriptions", s.handleCreatePrescription)
	s.mux.HandleFunc("POST /api/v1/visits/{id}/settle", s.handleSettleBilling)

	s.mux.HandleFunc("GET /api/v1/beds", s.handleListBeds)
	s.mux.HandleFunc("POST /api/v1/beds/{id}/release", s.handleReleaseBed)

	s.mux.HandleFunc("GET /api/v1/radiology-orders", s.handleListRadiologyOrders)
	s.mux.HandleFunc("GET /api/v1/medications", s.handleListMedications)
	s.mux.HandleFunc("GET /api/v1/prescriptions", s.handleListPrescriptions)
	s.mux.HandleFunc("POST /api/v1/prescriptions/{id}/dispense", s.handleDispensePrescription)

	s.mux.HandleFunc("GET /api/v1/billing", s.handleListBilling)
	s.mux.HandleFunc("GET /api/v1/outbox", s.handleListOutbox)
	s.mux.HandleFunc("GET /api/v1/audit-logs", s.handleListAudits)
	s.mux.HandleFunc("POST /api/v1/satusehat/test-oauth", s.handleTestSatusehatOAuth)
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
	var role, name string
	switch {
	case req.Username == "admin" && req.Password == "admin123":
		role, name = "ADMIN", "Administrator SIMRS"
	case req.Username == "dokter" && req.Password == "dokter123":
		role, name = "DOKTER", "dr. Hendra Wijaya, Sp.PD"
	case req.Username == "farmasi" && req.Password == "farmasi123":
		role, name = "FARMASI", "apt. Nadia Putri, S.Farm"
	case req.Username == "kasir" && req.Password == "kasir123":
		role, name = "KASIR", "Petugas Kasir & Klaim BPJS"
	default:
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	tok, err := auth.SignJWT(s.cfg.JWTSecret, auth.Claims{
		Sub:  req.Username,
		Role: role,
		Name: name,
		Exp:  time.Now().Add(12 * time.Hour).Unix(),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token error"})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), req.Username, "LOGIN", "AUTH", req.Username, "SIMRS Web Login")
	writeJSON(w, http.StatusOK, map[string]any{
		"token": tok,
		"user":  map[string]string{"username": req.Username, "role": role, "full_name": name},
	})
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := s.repo.Stats(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

func (s *Server) handleListPatients(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListPatients(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
	if strings.TrimSpace(p.FullName) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "full_name required"})
		return
	}
	saved, err := s.repo.CreatePatient(r.Context(), p)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), "admisi", "CREATE_PATIENT", "PATIENT", saved.NoRM, saved.FullName)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleListVisits(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListVisits(r.Context(), r.URL.Query().Get("service_type"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Auto-generate SEP for BPJS visits
	if strings.EqualFold(saved.PaymentType, "BPJS") {
		sep := bpjs.GenerateSEPNumber("0112R001", time.Now(), time.Now().Unix()%999999)
		code, tariff := bpjs.EstimateINACBG("Z00.0", saved.ServiceType, "KELAS_3")
		_ = s.repo.AttachSEP(r.Context(), saved.ID, sep, code, tariff)
		saved.SEPNumber = sep
		saved.INACBGCode = code
		saved.INACBGTariff = tariff
	}

	// Enqueue SATUSEHAT Encounter FHIR R4
	encPayload, _ := json.Marshal(fhir.BuildEncounter(
		s.cfg.SatusehatOrgID, saved.VisitNumber, pat.IHSNumber, pat.FullName,
		"N10000001", saved.DoctorName, saved.ServiceType, "LOC-01", saved.UnitName, saved.CreatedAt,
	))
	_, _ = s.repo.EnqueueOutbox(r.Context(), simrsstore.OutboxItem{
		Target: "SATUSEHAT_FHIR", EventType: "FHIR_ENCOUNTER", ReferenceID: saved.VisitNumber,
		Payload: string(encPayload), Status: "QUEUED",
	})
	_ = s.repo.AppendAudit(r.Context(), "admisi", "CREATE_VISIT", "VISIT", saved.VisitNumber, fmt.Sprintf("%s %s (%s)", saved.ServiceType, saved.UnitName, saved.PaymentType))
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
	sep := bpjs.GenerateSEPNumber("0112R001", time.Now(), time.Now().Unix()%999999)
	code, tariff := bpjs.EstimateINACBG(req.ICD10, v.ServiceType, req.CareClass)
	if err := s.repo.AttachSEP(r.Context(), visitID, sep, code, tariff); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), "kasir", "ISSUE_SEP", "BPJS", sep, fmt.Sprintf("INA-CBG=%s Tariff=%d", code, tariff))
	writeJSON(w, http.StatusOK, map[string]any{
		"visit_id":      visitID,
		"sep_number":    sep,
		"inacbg_code":   code,
		"inacbg_tariff": tariff,
	})
}

func (s *Server) handleListSOAP(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListSOAPNotes(r.Context(), r.PathValue("id"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
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
	n.VisitID = visitID
	if n.AuthorName == "" {
		n.AuthorName = v.DoctorName
	}
	saved, err := s.repo.CreateSOAPNote(r.Context(), n)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if n.ICD10Code != "" {
		pat, _, _ := s.repo.GetPatient(r.Context(), v.PatientID)
		condPayload, _ := json.Marshal(fhir.BuildCondition(
			pat.IHSNumber, v.PatientName, v.SatusehatEncounterID, n.ICD10Code, n.ICD10Name, saved.CreatedAt,
		))
		_, _ = s.repo.EnqueueOutbox(r.Context(), simrsstore.OutboxItem{
			Target: "SATUSEHAT_FHIR", EventType: "FHIR_CONDITION", ReferenceID: v.VisitNumber,
			Payload: string(condPayload), Status: "QUEUED",
		})
	}
	_ = s.repo.AppendAudit(r.Context(), n.AuthorName, "CREATE_SOAP", "RME", v.VisitNumber, "ICD10="+n.ICD10Code)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleListRadiologyOrders(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListRadiologyOrders(r.Context(), r.URL.Query().Get("visit_id"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"radiology_orders": list})
}

func (s *Server) handleCreateRadiologyOrder(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	v, ok, err := s.repo.GetVisit(r.Context(), visitID)
	if err != nil || !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "visit not found"})
		return
	}
	pat, _, _ := s.repo.GetPatient(r.Context(), v.PatientID)

	var o simrsstore.RadiologyOrder
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&o); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Build HL7 ORM^O01 & attempt live MLLP delivery to Core RIS (non-blocking fallback to outbox)
	orm := hl7client.BuildORM(hl7client.RadiologyOrderHL7{
		ControlID:        saved.ID[:8],
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
	_ = s.repo.AppendAudit(r.Context(), v.DoctorName, "ORDER_RADIOLOGY", "RIS_ORDER", saved.AccessionNumber, saved.ProcedureName)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleListBeds(w http.ResponseWriter, r *http.Request) {
	beds, err := s.repo.ListBeds(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
	_ = s.repo.AppendAudit(r.Context(), "perawat", "DISCHARGE_BED", "BED", bedID, "Pasien pulang / bed dikosongkan")
	writeJSON(w, http.StatusOK, map[string]string{"released": bedID})
}

func (s *Server) handleListMedications(w http.ResponseWriter, r *http.Request) {
	meds, err := s.repo.ListMedications(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"medications": meds})
}

func (s *Server) handleListPrescriptions(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListPrescriptions(r.Context(), r.URL.Query().Get("visit_id"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
	pat, _, _ := s.repo.GetPatient(r.Context(), v.PatientID)

	var rx simrsstore.Prescription
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&rx); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
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
	_ = s.repo.AppendAudit(r.Context(), v.DoctorName, "CREATE_RX", "FARMASI", saved.RxNumber, saved.MedicationName)
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) handleDispensePrescription(w http.ResponseWriter, r *http.Request) {
	rxID := r.PathValue("id")
	dispensed, err := s.repo.DispensePrescription(r.Context(), rxID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), "farmasi", "DISPENSE_RX", "FARMASI", dispensed.RxNumber, fmt.Sprintf("%s x%d", dispensed.MedicationName, dispensed.Qty))
	writeJSON(w, http.StatusOK, dispensed)
}

func (s *Server) handleListBilling(w http.ResponseWriter, r *http.Request) {
	items, err := s.repo.ListBillingItems(r.Context(), r.URL.Query().Get("visit_id"))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"billing_items": items})
}

func (s *Server) handleSettleBilling(w http.ResponseWriter, r *http.Request) {
	visitID := r.PathValue("id")
	total, err := s.repo.SettleVisitBilling(r.Context(), visitID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_ = s.repo.AppendAudit(r.Context(), "kasir", "SETTLE_BILLING", "BILLING", visitID, fmt.Sprintf("Total=Rp%d", total))
	writeJSON(w, http.StatusOK, map[string]any{"visit_id": visitID, "total_paid": total, "status": "LUNAS"})
}

func (s *Server) handleListOutbox(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListOutbox(r.Context(), 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"outbox": list})
}

func (s *Server) handleListAudits(w http.ResponseWriter, r *http.Request) {
	list, err := s.repo.ListAudits(r.Context(), 50)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusOK, map[string]any{"ok": false, "http_status": code, "error": err.Error()})
		return
	}
	preview := tok
	if len(preview) > 16 {
		preview = preview[:16] + "..."
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "http_status": code, "token_preview": preview})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
