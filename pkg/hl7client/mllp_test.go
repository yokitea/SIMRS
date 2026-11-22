package hl7client

import (
	"strings"
	"testing"
	"time"
)

func TestBuildORM(t *testing.T) {
	msg := BuildORM(RadiologyOrderHL7{
		ControlID:        "RAD-001",
		PatientID:        "RM-0001",
		PatientName:      "Budi Santoso",
		PatientBirthDate: "1985-04-12",
		PatientSex:       "M",
		AccessionNumber:  "ACC-20261122-0001",
		StudyInstanceUID: "1.2.826.0.1.3680043.10.1.1",
		ProcedureCode:    "24627-2",
		ProcedureName:    "Foto Thorax PA",
		Modality:         "DX",
	}, time.Now())

	if !strings.Contains(msg, "ORM^O01") || !strings.Contains(msg, "BUDI^SANTOSO") || !strings.Contains(msg, "ZDS|1.2.826.0.1.3680043.10.1.1") {
		t.Fatalf("unexpected ORM message: %s", msg)
	}
}
