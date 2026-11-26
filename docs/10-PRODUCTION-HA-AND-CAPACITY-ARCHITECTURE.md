# Arsitektur Produksi High-Availability, CPU Pinning & Backup (Skala RS 300+ Bed)

Dokumen ini menjadi standar implementasi infrastruktur **Core SIMRS + RIS + PACS** untuk Rumah Sakit Tipe B/A dengan kapasitas **300+ Tempat Tidur Rawat Inap** dan lalu lintas tinggi Rawat Jalan / IGD.

---

## 1. Isolasi Proses & CPU Core Pinning (Anti *Noisy Neighbor*)

Alih-alih mengandalkan *auto-distribution* OS scheduler yang dapat membuat proses berat (rekap klaim BPJS, grafik Barber-Johnson Direksi, streaming DICOM 3D) mengganggu responsivitas layanan kritis (IGD, Kasir, Farmasi), setiap layanan dikunci ke grup core spesifik melalui `cpuset` dan `GOMAXPROCS`:

- **Baseline Host**: 32 vCPU / 64 GB RAM / NVMe Enterprise RAID-10
- **Zona 1 — Real-Time OLTP Critical Path (Cores `0–7`, 8 Core)**:
  - `simrs-api` + `pgbouncer` + `simrs-web`: pinned ke **Cores `0–3`** (`GOMAXPROCS=4`)
  - `pg-primary` (PostgreSQL OLTP): pinned ke **Cores `4–7`**
- **Zona 2 — Heavy Reporting & Bridging Worker (Cores `8–15`, 8 Core)**:
  - `pg-replica` (Read Replica OLAP): pinned ke **Cores `8–11`** (`statement_timeout = 15s`, `max_parallel_workers = 4`)
  - `simrs-outbox-worker` (SATUSEHAT FHIR, BPJS VClaim, HL7 MLLP): pinned ke **Cores `12–15`** (`GOMAXPROCS=4`)
- **Zona 3 — Imaging Core RIS & PACS (Cores `16–23`, 8 Core — disarankan node terpisah)**:
  - `pacs-api` + `dicom-scp` + `ris-api` + `hl7-sync`
- **Zona 4 — Contingency Reserve Pool (Cores `24–31`, 8 Core = 25% Headroom)**:
  - **Tidak di-pin ke proses harian normal.** Disediakan khusus untuk lonjakan beban ekstrem (KLB/IGD, tutup buku akhir bulan BPJS) atau menampung beban *failover*.

Referensi implementasi: [docker-compose.prod.yml](file:///Volumes/krupuk/SIMRS/deploy/docker-compose.prod.yml).

---

## 2. Optimasi Database Skala RME 5+ Tahun

Mengacu pada [002_production_scale.sql](file:///Volumes/krupuk/SIMRS/deploy/migrations/002_production_scale.sql):
1. **Native Range Partitioning**: Tabel pertumbuhan tinggi (`stock_movements`, `audit_logs`) dipartisi bulanan agar query operasional hanya menyentuh partisi aktif.
2. **Partial Hot-Path Indexes**: Index parsial pada tagihan belum lunas (`WHERE paid = FALSE`), antrean outbox (`WHERE status = 'QUEUED'`), resep menunggu/klarifikasi, dan bed tersedia (`WHERE status = 'TERSEDIA'`).
3. **Connection Pooling (`PgBouncer` Transaction Mode)**: Menampung hingga `1.500` koneksi client dengan pool efektif `60` koneksi ke PostgreSQL Primary.

---

## 3. Redundansi Server & Backup Storage Aman (Pola 3-2-1-1-0)

1. **High Availability (Active-Standby)**:
   - Node Primary + Node Hot Standby (Streaming Replication) di rack/jalur UPS berbeda, dengan Virtual IP (Keepalived/Patroni) untuk auto-failover `< 15 detik`.
2. **Backup 3-2-1-1-0 Anti-Ransomware & UU PDP No. 27/2022**:
   - **Continuous WAL Archiving** (`archive_mode = on`) untuk RPO `< 5 menit`.
   - **Enkripsi AES-256** untuk seluruh arsip RME/PHI sebelum dikirim ke penyimpanan cadangan.
   - **Immutable Object Lock (WORM)** via MinIO S3 (`minio-backup`) sehingga file backup tidak dapat dihapus atau dienkripsi ulang oleh ransomware.
   - **Automated Weekly Restore Verification**: Dijalankan via [backup-verify.sh](file:///Volumes/krupuk/SIMRS/deploy/scripts/backup-verify.sh) ke database sementara untuk memastikan **0 error** saat dibutuhkan.
