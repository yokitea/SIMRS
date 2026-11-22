# Arsitektur Teknis — Core SIMRS (OEM White-Label)

## Port Map Ekosistem 3 Produk (Side-by-Side)

| Produk | Web UI | REST / DICOMweb API | Protokol Klinis |
| :--- | :--- | :--- | :--- |
| **Core SIMRS** | `:3002` | `:8090` | HL7 `ORM^O01` Outbound → RIS `:2575`, FHIR R4 SATUSEHAT, BPJS VClaim |
| **Core RIS** | `:3000` | `:8080` | DICOM MWL/MPPS `:11112`, HL7 MLLP `:2575` |
| **Core PACS** | `:3001` | `:8042` (`/dicom-web`) | DICOM SCP `:4242`, HL7 MLLP `:2576` |

## White-Labeling OEM
Seluruh identitas produk dikendalikan melalui `.env`:
- `BRAND_NAME` / `NEXT_PUBLIC_BRAND_NAME`
- `HOSPITAL_NAME`
- `NEXT_PUBLIC_BRAND_SUBTITLE`
- `NEXT_PUBLIC_BRAND_LOGO`
- `NEXT_PUBLIC_RIS_URL` & `NEXT_PUBLIC_PACS_VIEWER_URL`
