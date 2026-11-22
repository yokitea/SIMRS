package fhir

import (
	"testing"
	"time"
)

func TestFHIRBuilders(t *testing.T) {
	now := time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC)
	enc := BuildEncounter("10000000", "VIS-2026-001", "P001", "Budi", "N001", "dr. Andi", "IGD", "LOC-IGD", "IGD", now)
	if enc["resourceType"] != "Encounter" {
		t.Fatalf("expected Encounter, got %v", enc["resourceType"])
	}
	cls := enc["class"].(map[string]any)
	if cls["code"] != "EMER" {
		t.Fatalf("expected EMER for IGD, got %v", cls["code"])
	}

	cond := BuildCondition("P001", "Budi", "enc-1", "J18.9", "Pneumonia, unspecified", now)
	if cond["resourceType"] != "Condition" {
		t.Fatalf("expected Condition")
	}

	med := BuildMedicationRequest("10000000", "RX-001", "P001", "enc-1", "93001234", "Paracetamol 500mg", "3x1 tab sesudah makan", 10)
	if med["resourceType"] != "MedicationRequest" {
		t.Fatalf("expected MedicationRequest")
	}
}
