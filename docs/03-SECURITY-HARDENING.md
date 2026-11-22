# Security Hardening & EGM Readiness Checklist — Core SIMRS

Dokumen ini merangkum kontrol keamanan **EGM (Enterprise-Grade)** yang tertanam pada **Core SIMRS** untuk kepatuhan RME (Permenkes 24/2022), *penetration test* rumah sakit, dan kurasi **e-Katalog INAPROC**.

## 1. Kontrol Keamanan Aplikasi (Tertanam di Kode)
1. **Autentikasi JWT HS256 & RBAC Ketat (`pkg/auth`)**:
   - Seluruh endpoint `/api/v1/*` (kecuali `/auth/login`) wajib menyertakan `Authorization: Bearer <token>`.
   - Pemisahan peran ketat:
     - `ADMISI` / `ADMIN`: Registrasi pasien, kunjungan, bed discharge.
     - `DOKTER` / `ADMIN`: SOAP/RME, Order Radiologi → RIS, E-Resep.
     - `FARMASI` / `ADMIN`: Dispensing resep & pemotongan stok.
     - `KASIR` / `ADMIN`: Penerbitan SEP BPJS & pelunasan billing.
     - `ADMIN`: Audit log & pengujian live OAuth2 SATUSEHAT.
   - Password diverifikasi menggunakan **bcrypt** (`bcrypt.DefaultCost`); audit actor diambil langsung dari verified JWT `Claims.Sub` (anti-spoofing).
   - Fail-fast startup: server menolak start jika `DATABASE_URL` aktif namun `JWT_SECRET` default atau `< 32` karakter.
2. **Integritas Transaksional & Finansial PostgreSQL (`pkg/simrsstore`)**:
   - Sequence PostgreSQL (`no_rm_seq`, `visit_seq`, `rx_seq`, `rad_seq`) mencegah tabrakan `UNIQUE` pada transaksi konkuren.
   - Harga obat & subtotal dihitung di server dari master `medications`; `DispensePrescription` memakai guard `WHERE status = 'MENUNGGU'` dan `WHERE stock >= qty` dalam 1 transaksi bersama penambahan billing `FARMASI`.
   - `ID` dari payload JSON klien diabaikan pada semua `POST` untuk mencegah manipulasi ID atau *slice-bounds panic*.
3. **Kriptografi & Sanitasi Protokol Medis**:
   - Dekripsi BPJS VClaim `AES-256-CBC` (`pkg/bpjs/vclaim.go`) memverifikasi seluruh byte padding PKCS#7 secara *constant-time*.
   - HL7 v2 `ORM^O01` (`pkg/hl7client/mllp.go`) menyaring seluruh delimiter (`\r`, `\n`, `|`, `^`, `~`, `\`, `&`) untuk mencegah HL7 injection ke RIS/PACS.
4. **Header OWASP, DoS & Rate Limiting**:
   - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, dan `CORS_ALLOWED_ORIGIN` terkonfigurasi.
   - Bounded `RateLimiter` per-IP dengan eviksi otomatis + full `http.Server` timeouts (`ReadTimeout`, `WriteTimeout`, `IdleTimeout`, `MaxHeaderBytes`).

## 2. Checklist Deployment Produksi RS
- [ ] Reverse Proxy TLS 1.3 (Nginx/Caddy) + HSTS; jangan ekspos `:8090` langsung.
- [ ] Set `CORS_ALLOWED_ORIGIN=https://simrs.rs-anda.local` dan `JWT_SECRET` acak ≥ 32 karakter.
- [ ] Aktifkan backup harian terenkripsi untuk PostgreSQL (`simrs_core`) & `audit_logs`.
