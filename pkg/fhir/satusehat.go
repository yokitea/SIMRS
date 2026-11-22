package fhir

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// BuildEncounter builds a SATUSEHAT Kemenkes compliant FHIR R4 Encounter resource.
func BuildEncounter(orgID, visitNumber, patientIHS, patientName, practitionerIHS, practitionerName, encounterClass, locationID, locationName string, start time.Time) map[string]any {
	classCode := "AMB"
	classDisplay := "ambulatory"
	switch strings.ToUpper(encounterClass) {
	case "IGD", "EMER":
		classCode, classDisplay = "EMER", "emergency"
	case "RI", "IMP":
		classCode, classDisplay = "IMP", "inpatient encounter"
	}
	return map[string]any{
		"resourceType": "Encounter",
		"identifier": []map[string]any{
			{
				"system": fmt.Sprintf("http://sys-ids.kemkes.go.id/encounter/%s", orgID),
				"value":  visitNumber,
			},
		},
		"status": "arrived",
		"class": map[string]any{
			"system":  "http://terminology.hl7.org/CodeSystem/v3-ActCode",
			"code":    classCode,
			"display": classDisplay,
		},
		"subject": map[string]any{
			"reference": "Patient/" + patientIHS,
			"display":   patientName,
		},
		"participant": []map[string]any{
			{
				"type": []map[string]any{
					{
						"coding": []map[string]any{
							{
								"system":  "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
								"code":    "ATND",
								"display": "attender",
							},
						},
					},
				},
				"individual": map[string]any{
					"reference": "Practitioner/" + practitionerIHS,
					"display":   practitionerName,
				},
			},
		},
		"period": map[string]any{
			"start": start.UTC().Format(time.RFC3339),
		},
		"location": []map[string]any{
			{
				"location": map[string]any{
					"reference": "Location/" + locationID,
					"display":   locationName,
				},
			},
		},
		"serviceProvider": map[string]any{
			"reference": "Organization/" + orgID,
		},
	}
}

// BuildCondition builds a SATUSEHAT FHIR R4 Condition resource using ICD-10.
func BuildCondition(patientIHS, patientName, encounterID, icd10Code, icd10Display string, recordedAt time.Time) map[string]any {
	return map[string]any{
		"resourceType": "Condition",
		"clinicalStatus": map[string]any{
			"coding": []map[string]any{
				{
					"system":  "http://terminology.hl7.org/CodeSystem/condition-clinical",
					"code":    "active",
					"display": "Active",
				},
			},
		},
		"category": []map[string]any{
			{
				"coding": []map[string]any{
					{
						"system":  "http://terminology.hl7.org/CodeSystem/condition-category",
						"code":    "encounter-diagnosis",
						"display": "Encounter Diagnosis",
					},
				},
			},
		},
		"code": map[string]any{
			"coding": []map[string]any{
				{
					"system":  "http://hl7.org/fhir/sid/icd-10",
					"code":    icd10Code,
					"display": icd10Display,
				},
			},
		},
		"subject": map[string]any{
			"reference": "Patient/" + patientIHS,
			"display":   patientName,
		},
		"encounter": map[string]any{
			"reference": "Encounter/" + encounterID,
		},
		"recordedDate": recordedAt.UTC().Format(time.RFC3339),
	}
}

// BuildMedicationRequest builds a SATUSEHAT FHIR R4 MedicationRequest using Kemenkes KFA code.
func BuildMedicationRequest(orgID, rxNumber, patientIHS, encounterID, kfaCode, drugName, dosageText string, qty int) map[string]any {
	return map[string]any{
		"resourceType": "MedicationRequest",
		"identifier": []map[string]any{
			{
				"system": fmt.Sprintf("http://sys-ids.kemkes.go.id/prescription/%s", orgID),
				"value":  rxNumber,
			},
		},
		"status": "active",
		"intent": "order",
		"medicationCodeableConcept": map[string]any{
			"coding": []map[string]any{
				{
					"system":  "http://sys-ids.kemkes.go.id/kfa",
					"code":    kfaCode,
					"display": drugName,
				},
			},
		},
		"subject":   map[string]any{"reference": "Patient/" + patientIHS},
		"encounter": map[string]any{"reference": "Encounter/" + encounterID},
		"dosageInstruction": []map[string]any{
			{"text": dosageText},
		},
		"dispenseRequest": map[string]any{
			"quantity": map[string]any{"value": qty},
		},
	}
}

// FetchOAuth2Token tests live OAuth2 client_credentials authentication against SATUSEHAT Kemenkes.
func FetchOAuth2Token(ctx context.Context, env, clientID, clientSecret string) (string, int, error) {
	base := "https://api-satusehat-stg.dto.kemkes.go.id"
	if strings.EqualFold(env, "production") || strings.EqualFold(env, "prod") {
		base = "https://api-satusehat.kemkes.go.id"
	}
	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/oauth2/v1/accesstoken?grant_type=client_credentials", strings.NewReader(form.Encode()))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", resp.StatusCode, fmt.Errorf("SATUSEHAT OAuth2 HTTP %d: %s", resp.StatusCode, string(body))
	}
	var parsed struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", resp.StatusCode, err
	}
	return parsed.AccessToken, resp.StatusCode, nil
}
