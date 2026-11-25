package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yokitea/SIMRS/pkg/simrsstore"
)

func loginSIMRS(t *testing.T, baseURL, user, pass string) string {
	t.Helper()
	b, _ := json.Marshal(map[string]string{"username": user, "password": pass})
	resp, err := http.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewReader(b))
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("login %s failed: status=%v err=%v", user, resp.StatusCode, err)
	}
	defer resp.Body.Close()
	var out struct {
		Token string `json:"token"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out.Token
}

func doAuthJSON(t *testing.T, method, url, token string, body []byte) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(method, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s error: %v", method, url, err)
	}
	return resp
}

func TestFullHospitalWorkflowWithRBAC(t *testing.T) {
	repo := simrsstore.NewMemoryStore()
	srv := NewServer(Config{BrandName: "Core SIMRS", HospitalName: "RS Demo", JWTSecret: "test_simrs_secret_at_least_32_bytes_ok"}, repo)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	// 0. Unauthenticated PHI read MUST fail with 401
	resp, _ := http.Get(ts.URL + "/api/v1/patients")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 unauth, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// RBAC: kasir cannot dispense pharmacy prescription (403)
	kasirTok := loginSIMRS(t, ts.URL, "kasir", "kasir123")
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/prescriptions/fake/dispense", kasirTok, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for kasir dispense, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	adminTok := loginSIMRS(t, ts.URL, "admin", "admin123")
	dokterTok := loginSIMRS(t, ts.URL, "dokter", "dokter123")
	farmasiTok := loginSIMRS(t, ts.URL, "farmasi", "farmasi123")

	// RBAC Security by Default: dokter cannot access user IAM (403)
	resp = doAuthJSON(t, http.MethodGet, ts.URL+"/api/v1/users", dokterTok, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for dokter accessing IAM users, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// RBAC: farmasi cannot access billing (403)
	resp = doAuthJSON(t, http.MethodGet, ts.URL+"/api/v1/billing", farmasiTok, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for farmasi accessing billing, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 1. Register new patient (also verify short client-supplied "id":"x" is ignored & does not panic)
	patBody := []byte(`{"id":"x","full_name":"Rina Marlina","nik":"3171099988770001","bpjs_number":"0009998887771","birth_date":"1992-07-10","sex":"F"}`)
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/patients", adminTok, patBody)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create patient failed: %d", resp.StatusCode)
	}
	var pat simrsstore.Patient
	_ = json.NewDecoder(resp.Body).Decode(&pat)
	resp.Body.Close()

	// 2. Admit outpatient visit with BPJS -> auto SEP + FHIR Encounter
	visBody, _ := json.Marshal(map[string]any{
		"id": "y", "patient_id": pat.ID, "service_type": "RJ", "unit_name": "Poli Paru", "doctor_name": "dr. Andi Sp.P", "payment_type": "BPJS",
	})
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/visits", adminTok, visBody)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create visit failed: %d", resp.StatusCode)
	}
	var vis simrsstore.Visit
	_ = json.NewDecoder(resp.Body).Decode(&vis)
	resp.Body.Close()
	if len(vis.SEPNumber) != 19 {
		t.Fatalf("expected auto-generated 19-char SEP, got %q", vis.SEPNumber)
	}

	// 3. Dokter writes SOAP note with ICD-10
	soapBody := []byte(`{"subjective":"Batuk 2 minggu","objective":"Ronki +","bp_systolic":120,"bp_diastolic":80,"icd10_code":"J18.9","icd10_name":"Pneumonia","plan":"Foto Thorax"}`)
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/visits/"+vis.ID+"/soap", dokterTok, soapBody)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create soap failed: %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 4. Dokter orders Radiology
	radBody := []byte(`{"id":"z","modality":"DX","procedure_code":"24627-2","procedure_name":"Foto Thorax PA","clinical_note":"Batuk lama","price":250000}`)
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/visits/"+vis.ID+"/radiology-orders", dokterTok, radBody)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create rad order failed: %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 5. Dokter creates Rx + Farmasi dispenses
	rxBody := []byte(`{"medication_id":"MED-01","qty":10,"dosage":"3x1 tab"}`)
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/visits/"+vis.ID+"/prescriptions", dokterTok, rxBody)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create rx failed: %d", resp.StatusCode)
	}
	var rx simrsstore.Prescription
	_ = json.NewDecoder(resp.Body).Decode(&rx)
	resp.Body.Close()

	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/prescriptions/"+rx.ID+"/dispense", farmasiTok, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("dispense failed: %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 6. Kasir settles billing
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/visits/"+vis.ID+"/settle", kasirTok, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("settle failed: %d", resp.StatusCode)
	}
	var settle map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&settle)
	resp.Body.Close()
	if int64(settle["total_paid"].(float64)) != 415000 {
		t.Fatalf("expected total_paid=415000, got %+v", settle)
	}

	outbox, _ := repo.ListOutbox(t.Context(), 20)
	if len(outbox) < 4 {
		t.Fatalf("expected >=4 outbox items, got %d", len(outbox))
	}
}

func TestExecutiveAndIPSRSWorkflows(t *testing.T) {
	repo := simrsstore.NewMemoryStore()
	srv := NewServer(Config{BrandName: "Core SIMRS", HospitalName: "RS Demo", JWTSecret: "test_simrs_secret_at_least_32_bytes_ok"}, repo)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	// 1. Direksi login & Executive Metrics (Fase 4)
	direksiTok := loginSIMRS(t, ts.URL, "direksi", "direksi123")
	resp := doAuthJSON(t, http.MethodGet, ts.URL+"/api/v1/executive/metrics", direksiTok, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("executive metrics failed: %d", resp.StatusCode)
	}
	var execPayload struct {
		Metrics simrsstore.ExecutiveMetrics `json:"metrics"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&execPayload); err != nil {
		t.Fatalf("decode executive metrics: %v", err)
	}
	resp.Body.Close()
	if execPayload.Metrics.ALOS <= 0 || execPayload.Metrics.ClaimApprovalRate <= 0 {
		t.Fatalf("unexpected executive metrics: %+v", execPayload.Metrics)
	}

	// 2. IPSRS login & Overview (Fase 6)
	ipsrsTok := loginSIMRS(t, ts.URL, "ipsrs", "ipsrs123")
	resp = doAuthJSON(t, http.MethodGet, ts.URL+"/api/v1/ipsrs/overview", ipsrsTok, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ipsrs overview failed: %d", resp.StatusCode)
	}
	var ov struct {
		Assets      []simrsstore.MedicalAsset     `json:"assets"`
		Utilities   []simrsstore.UtilityTelemetry `json:"utilities"`
		IPALSensors []simrsstore.IPALGreaseSensor `json:"ipal_sensors"`
		WorkOrders  []simrsstore.WorkOrderIPSRS   `json:"work_orders"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ov); err != nil {
		t.Fatalf("decode ipsrs overview: %v", err)
	}
	resp.Body.Close()
	if len(ov.Assets) < 6 || len(ov.Utilities) < 6 || len(ov.IPALSensors) < 4 || len(ov.WorkOrders) < 3 {
		t.Fatalf("incomplete ipsrs seed: assets=%d util=%d ipal=%d wo=%d", len(ov.Assets), len(ov.Utilities), len(ov.IPALSensors), len(ov.WorkOrders))
	}

	// 3. Calibrate overdue Defibrillator ALK-03 -> LAIK_PAKAI
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/ipsrs/assets/ALK-03/calibrate", ipsrsTok, []byte(`{}`))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("calibrate asset failed: %d", resp.StatusCode)
	}
	var calRes struct {
		Asset simrsstore.MedicalAsset `json:"asset"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&calRes)
	resp.Body.Close()
	if calRes.Asset.CalibrationStatus != "LAIK_PAKAI" {
		t.Fatalf("expected LAIK_PAKAI, got %s", calRes.Asset.CalibrationStatus)
	}

	// 4. Flush Grease Trap IPAL-01 -> OPTIMAL (8%)
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/ipsrs/ipal/IPAL-01/flush", ipsrsTok, []byte(`{}`))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("flush ipal failed: %d", resp.StatusCode)
	}
	var flushRes struct {
		Sensor simrsstore.IPALGreaseSensor `json:"sensor"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&flushRes)
	resp.Body.Close()
	if flushRes.Sensor.Status != "OPTIMAL" || flushRes.Sensor.LevelPct != 8 {
		t.Fatalf("expected OPTIMAL 8%%, got %+v", flushRes.Sensor)
	}

	// 5. Create & Resolve IPSRS Work Order
	woBody := []byte(`{"asset_or_zone":"Tabung O2 Cadangan IGD","issue_type":"PREVENTIVE","priority":"TINGGI","technician":"Ir. Bambang","notes":"Cek regulator manifold"}`)
	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/ipsrs/work-orders", ipsrsTok, woBody)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create wo failed: %d", resp.StatusCode)
	}
	var woRes struct {
		WorkOrder simrsstore.WorkOrderIPSRS `json:"work_order"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&woRes)
	resp.Body.Close()

	resp = doAuthJSON(t, http.MethodPost, ts.URL+"/api/v1/ipsrs/work-orders/"+woRes.WorkOrder.ID+"/status", ipsrsTok, []byte(`{"status":"RESOLVED"}`))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("update wo status failed: %d", resp.StatusCode)
	}
	var woUpd struct {
		WorkOrder simrsstore.WorkOrderIPSRS `json:"work_order"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&woUpd)
	resp.Body.Close()
	if woUpd.WorkOrder.Status != "RESOLVED" {
		t.Fatalf("expected RESOLVED, got %s", woUpd.WorkOrder.Status)
	}
}
