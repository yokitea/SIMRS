package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yokitea/SIMRS/pkg/simrsstore"
)

func TestFullHospitalWorkflow(t *testing.T) {
	repo := simrsstore.NewMemoryStore()
	srv := NewServer(Config{BrandName: "Core SIMRS", HospitalName: "RS Demo"}, repo)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	// 1. Register new patient
	patBody := `{"full_name":"Rina Marlina","nik":"3171099988770001","bpjs_number":"0009998887771","birth_date":"1992-07-10","sex":"F"}`
	resp, err := http.Post(ts.URL+"/api/v1/patients", "application/json", bytes.NewBufferString(patBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create patient failed: %v %v", resp, err)
	}
	var pat simrsstore.Patient
	_ = json.NewDecoder(resp.Body).Decode(&pat)
	resp.Body.Close()

	// 2. Admit outpatient visit with BPJS -> auto SEP + FHIR Encounter outbox
	visBody, _ := json.Marshal(map[string]any{
		"patient_id":   pat.ID,
		"service_type": "RJ",
		"unit_name":    "Poli Paru",
		"doctor_name":  "dr. Andi Sp.P",
		"payment_type": "BPJS",
	})
	resp, err = http.Post(ts.URL+"/api/v1/visits", "application/json", bytes.NewReader(visBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create visit failed: %v %v", resp, err)
	}
	var vis simrsstore.Visit
	_ = json.NewDecoder(resp.Body).Decode(&vis)
	resp.Body.Close()
	if len(vis.SEPNumber) != 19 {
		t.Fatalf("expected auto-generated 19-char SEP, got %q", vis.SEPNumber)
	}

	// 3. Create SOAP note with ICD-10 -> enqueues FHIR Condition
	soapBody := `{"subjective":"Batuk 2 minggu","objective":"Ronki +","bp_systolic":120,"bp_diastolic":80,"icd10_code":"J18.9","icd10_name":"Pneumonia","plan":"Foto Thorax"}`
	resp, err = http.Post(ts.URL+"/api/v1/visits/"+vis.ID+"/soap", "application/json", bytes.NewBufferString(soapBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create soap failed: %v %v", resp, err)
	}
	resp.Body.Close()

	// 4. Order Radiology -> creates accession, StudyUID, billing, and HL7 outbox
	radBody := `{"modality":"DX","procedure_code":"24627-2","procedure_name":"Foto Thorax PA","clinical_note":"Batuk lama","price":250000}`
	resp, err = http.Post(ts.URL+"/api/v1/visits/"+vis.ID+"/radiology-orders", "application/json", bytes.NewBufferString(radBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create rad order failed: %v %v", resp, err)
	}
	resp.Body.Close()

	// 5. E-Prescribing + Dispense -> decrements stock & adds to billing
	rxBody := `{"medication_id":"MED-01","qty":10,"dosage":"3x1 tab"}`
	resp, err = http.Post(ts.URL+"/api/v1/visits/"+vis.ID+"/prescriptions", "application/json", bytes.NewBufferString(rxBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create rx failed: %v %v", resp, err)
	}
	var rx simrsstore.Prescription
	_ = json.NewDecoder(resp.Body).Decode(&rx)
	resp.Body.Close()

	resp, err = http.Post(ts.URL+"/api/v1/prescriptions/"+rx.ID+"/dispense", "application/json", nil)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("dispense failed: %v %v", resp, err)
	}
	resp.Body.Close()

	// 6. Settle Cashier Billing
	resp, err = http.Post(ts.URL+"/api/v1/visits/"+vis.ID+"/settle", "application/json", nil)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("settle failed: %v %v", resp, err)
	}
	var settle map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&settle)
	resp.Body.Close()
	// 150,000 consultation + 250,000 radiology + 15,000 paracetamol = 415,000
	if int64(settle["total_paid"].(float64)) != 415000 {
		t.Fatalf("expected total_paid=415000, got %+v", settle)
	}

	// Verify Outbox contains FHIR_ENCOUNTER, FHIR_CONDITION, ORM_O01, FHIR_MEDICATION_REQUEST
	outbox, _ := repo.ListOutbox(t.Context(), 20)
	if len(outbox) < 4 {
		t.Fatalf("expected >=4 outbox items, got %d", len(outbox))
	}
}
