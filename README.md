# Core SIMRS — White-Label Hospital Information System

**Core SIMRS** adalah Sistem Informasi Manajemen Rumah Sakit generasi baru berbasis **Go + Next.js 15 (TypeScript) + PostgreSQL 16** yang dibangun 100% dari nol (*clean-sheet architecture*, **Zero GPL / Zero AGPL / Zero SSPL**), dirancang **generik / white-label** untuk kebutuhan OEM & e-Katalog INAPROC, serta terintegrasi langsung dengan **Core RIS** dan **Core PACS**.

## Modul Utama
1. **Admisi, EMPI & Antrean**: Registrasi pasien (No. RM, NIK, No. BPJS, IHS), pendaftaran Rawat Jalan (Poli), IGD (Triase Merah/Kuning/Hijau), dan Rawat Inap.
2. **Rekam Medis Elektronik (RME — Permenkes 24/2022)**: CPPT/SOAP, Tanda-Tanda Vital, Diagnosis ICD-10, Order Radiologi langsung ke Core RIS (`HL7 ORM^O01`), tautan langsung **Buka Citra Core PACS**, dan E-Resep KFA.
3. **Rawat Inap (Bed Board)**: Pemantauan ketersediaan kamar VIP / Kelas 1–3 / ICU, admisi, dan pemulangan (*discharge*).
4. **Instalasi Farmasi**: Master & stok obat berkode KFA Kemenkes, antrean e-resep, dan dispensing (otomatis potong stok & tambah ke billing).
5. **Kasir, Billing & BPJS VClaim/INA-CBG**: Akumulasi tagihan otomatis per kunjungan, generator nomor SEP BPJS 19 digit, estimasi grouping INA-CBG, utilitas kriptografi VClaim (`HMAC-SHA256` & `AES-256-CBC`), serta pelunasan kasir.
6. **SATUSEHAT Kemenkes (FHIR R4)**: Transactional Outbox (`Encounter`, `Condition`, `MedicationRequest`) + uji live OAuth2 Staging/Production.

## Quick Start

```bash
# 1. Jalankan unit & E2E test Go (dengan race detector)
go test -race -v ./...

# 2. Build binary Go
make build

# 3. Jalankan mode standalone lokal (pre-seeded data RS demo, tanpa Postgres)
./bin/simrs-api
# Di terminal lain:
cd apps/web && npm run dev   # http://localhost:3002

# 4. Jalankan stack produksi Docker Compose
make up
```
