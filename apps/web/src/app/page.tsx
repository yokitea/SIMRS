"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  authHeaders,
  Bed,
  BillingItem,
  BRAND_CONFIG,
  DashboardData,
  formatIDR,
  getToken,
  Medication,
  OutboxItem,
  PACS_VIEWER_URL,
  Patient,
  Prescription,
  RadiologyOrder,
  RIS_URL,
  SIMRS_API_URL,
  SOAPNote,
  Visit,
} from "@/lib/api";

type Tab = "admisi" | "rme" | "ranap" | "farmasi" | "kasir" | "outbox";

export default function SIMRSConsolePage() {
  const [token, setToken] = useState("");
  const [userLabel, setUserLabel] = useState("");
  const [loginUser, setLoginUser] = useState("admin");
  const [loginPass, setLoginPass] = useState("admin123");
  const [loginErr, setLoginErr] = useState("");
  const [tab, setTab] = useState<Tab>("admisi");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [radOrders, setRadOrders] = useState<RadiologyOrder[]>([]);
  const [billing, setBilling] = useState<BillingItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Selected visit for RME
  const [activeVisitId, setActiveVisitId] = useState("");
  const [soaps, setSoaps] = useState<SOAPNote[]>([]);

  // Forms
  const [newPat, setNewPat] = useState({ full_name: "", nik: "", bpjs_number: "", birth_date: "1990-01-01", sex: "M", phone: "" });
  const [newVisit, setNewVisit] = useState({
    patient_id: "",
    service_type: "RJ",
    unit_name: "Poli Penyakit Dalam",
    doctor_name: "dr. Hendra Wijaya, Sp.PD",
    triage_level: "KUNING",
    bed_id: "",
    payment_type: "BPJS",
  });
  const [soapForm, setSoapForm] = useState({
    subjective: "",
    objective: "",
    bp_systolic: 120,
    bp_diastolic: 80,
    heart_rate: 80,
    temperature: 36.7,
    resp_rate: 18,
    spo2: 98,
    icd10_code: "J18.9",
    icd10_name: "Pneumonia, unspecified",
    assessment: "",
    plan: "",
  });
  const [radForm, setRadForm] = useState({
    modality: "CT",
    procedure_code: "24627-2",
    procedure_name: "CT Thorax Non Kontras",
    clinical_note: "",
    price: 1250000,
  });
  const [rxForm, setRxForm] = useState({
    medication_id: "MED-01",
    qty: 10,
    dosage: "3 x 1 sesudah makan",
  });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    const tok = getToken();
    if (!tok) return;
    const h = { headers: authHeaders() };
    try {
      const [dRes, pRes, vRes, bRes, mRes, rxRes, rRes, bilRes, oRes] = await Promise.all([
        fetch(`${SIMRS_API_URL}/api/v1/dashboard`, h),
        fetch(`${SIMRS_API_URL}/api/v1/patients`, h),
        fetch(`${SIMRS_API_URL}/api/v1/visits`, h),
        fetch(`${SIMRS_API_URL}/api/v1/beds`, h),
        fetch(`${SIMRS_API_URL}/api/v1/medications`, h),
        fetch(`${SIMRS_API_URL}/api/v1/prescriptions`, h),
        fetch(`${SIMRS_API_URL}/api/v1/radiology-orders`, h),
        fetch(`${SIMRS_API_URL}/api/v1/billing`, h),
        fetch(`${SIMRS_API_URL}/api/v1/outbox`, h),
      ]);
      if (dRes.status === 401) {
        localStorage.removeItem("simrs_jwt");
        setToken("");
        return;
      }
      if (dRes.ok) setDashboard(await dRes.json());
      if (pRes.ok) {
        const j = await pRes.json();
        const list: Patient[] = j.patients || [];
        setPatients(list);
        setNewVisit((prev) => (prev.patient_id || list.length === 0 ? prev : { ...prev, patient_id: list[0].id }));
      }
      if (vRes.ok) {
        const j = await vRes.json();
        const list: Visit[] = j.visits || [];
        setVisits(list);
        setActiveVisitId((prev) => (prev || list.length === 0 ? prev : list[0].id));
      }
      if (bRes.ok) setBeds((await bRes.json()).beds || []);
      if (mRes.ok) setMedications((await mRes.json()).medications || []);
      if (rxRes.ok) setPrescriptions((await rxRes.json()).prescriptions || []);
      if (rRes.ok) setRadOrders((await rRes.json()).radiology_orders || []);
      if (bilRes.ok) setBilling((await bilRes.json()).billing_items || []);
      if (oRes.ok) setOutbox((await oRes.json()).outbox || []);
    } catch {
      notify("Gagal menghubungi SIMRS API (" + SIMRS_API_URL + ")");
    }
  }, []);

  useEffect(() => {
    const saved = getToken();
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) loadAll();
  }, [token, loadAll]);

  useEffect(() => {
    if (!activeVisitId || !token) return;
    fetch(`${SIMRS_API_URL}/api/v1/visits/${activeVisitId}/soap`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setSoaps(j.soap_notes || []))
      .catch(() => {});
  }, [activeVisitId, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const j = await res.json();
      if (!res.ok) {
        setLoginErr(j.error || "Login gagal");
        return;
      }
      localStorage.setItem("simrs_jwt", j.token);
      setToken(j.token);
      setUserLabel(`${j.user?.full_name || loginUser} (${j.user?.role || ""})`);
    } catch {
      setLoginErr("Tidak dapat terhubung ke SIMRS API");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("simrs_jwt");
    setToken("");
  };

  const activeVisit = visits.find((v) => v.id === activeVisitId) || null;
  const activeVisitRads = radOrders.filter((r) => r.visit_id === activeVisitId);
  const activeVisitRxs = prescriptions.filter((rx) => rx.visit_id === activeVisitId);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPat.full_name.trim()) return;
    const res = await fetch(`${SIMRS_API_URL}/api/v1/patients`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(newPat),
    });
    if (res.ok) {
      const saved: Patient = await res.json();
      setNewPat({ full_name: "", nik: "", bpjs_number: "", birth_date: "1990-01-01", sex: "M", phone: "" });
      setNewVisit((prev) => ({ ...prev, patient_id: saved.id }));
      notify(`Pasien ${saved.full_name} (${saved.no_rm}) terdaftar`);
      await loadAll();
    }
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisit.patient_id) return;
    const res = await fetch(`${SIMRS_API_URL}/api/v1/visits`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(newVisit),
    });
    if (res.ok) {
      const saved: Visit = await res.json();
      setActiveVisitId(saved.id);
      notify(`Kunjungan ${saved.visit_number} dibuat${saved.sep_number ? " + SEP " + saved.sep_number : ""}`);
      await loadAll();
    }
  };

  const handleSaveSOAP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisitId) return;
    const res = await fetch(`${SIMRS_API_URL}/api/v1/visits/${activeVisitId}/soap`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(soapForm),
    });
    if (res.ok) {
      notify("CPPT/SOAP tersimpan & FHIR Condition diantrekan ke SATUSEHAT");
      setSoapForm((prev) => ({ ...prev, subjective: "", objective: "", assessment: "", plan: "" }));
      const sRes = await fetch(`${SIMRS_API_URL}/api/v1/visits/${activeVisitId}/soap`, { headers: authHeaders() });
      if (sRes.ok) setSoaps((await sRes.json()).soap_notes || []);
      await loadAll();
    }
  };

  const handleOrderRadiology = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisitId) return;
    const res = await fetch(`${SIMRS_API_URL}/api/v1/visits/${activeVisitId}/radiology-orders`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(radForm),
    });
    if (res.ok) {
      const saved: RadiologyOrder = await res.json();
      notify(`Order Radiologi ${saved.accession_number} terkirim ke RIS (${saved.ris_sync_status})`);
      await loadAll();
    }
  };

  const handleCreateRx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisitId) return;
    const res = await fetch(`${SIMRS_API_URL}/api/v1/visits/${activeVisitId}/prescriptions`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(rxForm),
    });
    if (res.ok) {
      notify("E-Resep terkirim ke Instalasi Farmasi & SATUSEHAT Outbox");
      await loadAll();
    }
  };

  const handleDispense = async (rxId: string) => {
    const res = await fetch(`${SIMRS_API_URL}/api/v1/prescriptions/${rxId}/dispense`, { method: "POST", headers: authHeaders() });
    if (res.ok) {
      notify("Obat diserahkan, stok dipotong & tagihan ditambahkan ke Kasir");
      await loadAll();
    }
  };

  const handleReleaseBed = async (bedId: string) => {
    const res = await fetch(`${SIMRS_API_URL}/api/v1/beds/${bedId}/release`, { method: "POST", headers: authHeaders() });
    if (res.ok) {
      notify(`Bed ${bedId} dikosongkan (pasien pulang)`);
      await loadAll();
    }
  };

  const handleSettle = async (visitId: string) => {
    const res = await fetch(`${SIMRS_API_URL}/api/v1/visits/${visitId}/settle`, { method: "POST", headers: authHeaders() });
    if (res.ok) {
      const j = await res.json();
      notify(`Tagihan lunas: ${formatIDR(j.total_paid)}`);
      await loadAll();
    }
  };

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <form onSubmit={handleLogin} className="card" style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="brand" style={{ justifyContent: "center", marginBottom: 4 }}>
            <div className="brand-mark">RS</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{BRAND_CONFIG.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>JWT + RBAC Protected Console</div>
            </div>
          </div>
          {loginErr && <div style={{ color: "#fca5a5", fontSize: 12, textAlign: "center" }}>{loginErr}</div>}
          <input className="input" placeholder="Username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
          <input className="input" type="password" placeholder="Password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
          <button className="btn btn-primary" type="submit" style={{ justifyContent: "center" }}>
            Masuk ke {BRAND_CONFIG.name}
          </button>
          <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
            Demo: <span className="mono">admin/admin123</span> · <span className="mono">dokter/dokter123</span> · <span className="mono">farmasi/farmasi123</span> · <span className="mono">kasir/kasir123</span>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="topbar">
        <div className="brand">
          {BRAND_CONFIG.logoUrl ? (
            <img src={BRAND_CONFIG.logoUrl} alt={BRAND_CONFIG.name} style={{ width: 34, height: 34, borderRadius: 8 }} />
          ) : (
            <div className="brand-mark">RS</div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {dashboard?.system.brand || BRAND_CONFIG.name}{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>
                · {dashboard?.system.hospital || "RS Digital Indonesia"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{BRAND_CONFIG.subtitle}</div>
          </div>
        </div>

        <nav className="nav-tabs">
          <button className={`tab-btn ${tab === "admisi" ? "active" : ""}`} onClick={() => setTab("admisi")}>
            Admisi & Antrean ({visits.length})
          </button>
          <button className={`tab-btn ${tab === "rme" ? "active" : ""}`} onClick={() => setTab("rme")}>
            RME / Dokter
          </button>
          <button className={`tab-btn ${tab === "ranap" ? "active" : ""}`} onClick={() => setTab("ranap")}>
            Rawat Inap ({dashboard?.stats.beds_occupied ?? 0}/{beds.length})
          </button>
          <button className={`tab-btn ${tab === "farmasi" ? "active" : ""}`} onClick={() => setTab("farmasi")}>
            Farmasi ({dashboard?.stats.pending_rx ?? 0})
          </button>
          <button className={`tab-btn ${tab === "kasir" ? "active" : ""}`} onClick={() => setTab("kasir")}>
            Kasir & BPJS
          </button>
          <button className={`tab-btn ${tab === "outbox" ? "active" : ""}`} onClick={() => setTab("outbox")}>
            SATUSEHAT & RIS ({outbox.length})
          </button>
          <a className="btn btn-cyan" style={{ padding: "6px 10px", fontSize: 12 }} href={RIS_URL} target="_blank" rel="noreferrer">
            Buka RIS ↗
          </a>
          <button className="tab-btn" onClick={handleLogout} title={userLabel}>
            Keluar
          </button>
        </nav>
      </header>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "#12241f",
            border: "1px solid var(--accent)",
            padding: "11px 16px",
            borderRadius: 10,
            fontSize: 13,
            zIndex: 100,
          }}
        >
          {toast}
        </div>
      )}

      <main className="main">
        {/* KPI Row */}
        <section className="kpi-grid">
          <div className="card">
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Pasien Terdaftar</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{dashboard?.stats.total_patients ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Master EMPI + IHS</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Kunjungan Aktif</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              RJ {dashboard?.stats.active_visits_rj ?? 0} · IGD {dashboard?.stats.active_visits_igd ?? 0} · RI {dashboard?.stats.active_visits_ri ?? 0}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Real-time pelayanan</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Ketersediaan Bed</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {dashboard?.stats.beds_available ?? 0} <span style={{ fontSize: 13, color: "var(--muted)" }}>kosong</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{dashboard?.stats.beds_occupied ?? 0} terisi</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Antrean Farmasi & Rad</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {dashboard?.stats.pending_rx ?? 0} Rx · {dashboard?.stats.radiology_orders ?? 0} Rad
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Terhubung ke RIS & PACS</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Billing / Kasir</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{formatIDR(dashboard?.stats.unpaid_revenue ?? 0)}</div>
            <div style={{ fontSize: 11, color: "#34d399" }}>Lunas: {formatIDR(dashboard?.stats.paid_revenue ?? 0)}</div>
          </div>
        </section>

        {/* TAB 1: ADMISI & ANTREAN */}
        {tab === "admisi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid-2">
              <section className="card">
                <h3 style={{ marginTop: 0 }}>Registrasi Pasien Baru (EMPI)</h3>
                <form onSubmit={handleCreatePatient} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className="input" placeholder="Nama Lengkap *" value={newPat.full_name} onChange={(e) => setNewPat({ ...newPat, full_name: e.target.value })} />
                  <input className="input" placeholder="NIK (16 digit)" value={newPat.nik} onChange={(e) => setNewPat({ ...newPat, nik: e.target.value })} />
                  <input className="input" placeholder="No. Kartu BPJS" value={newPat.bpjs_number} onChange={(e) => setNewPat({ ...newPat, bpjs_number: e.target.value })} />
                  <input className="input" type="date" value={newPat.birth_date} onChange={(e) => setNewPat({ ...newPat, birth_date: e.target.value })} />
                  <select className="select" value={newPat.sex} onChange={(e) => setNewPat({ ...newPat, sex: e.target.value })}>
                    <option value="M">Laki-laki</option>
                    <option value="F">Perempuan</option>
                  </select>
                  <input className="input" placeholder="No. HP" value={newPat.phone} onChange={(e) => setNewPat({ ...newPat, phone: e.target.value })} />
                  <button className="btn btn-primary" type="submit" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                    + Simpan Pasien Baru
                  </button>
                </form>
              </section>

              <section className="card">
                <h3 style={{ marginTop: 0 }}>Pendaftaran Kunjungan (RJ / IGD / RI)</h3>
                <form onSubmit={handleCreateVisit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <select className="select" value={newVisit.patient_id} onChange={(e) => setNewVisit({ ...newVisit, patient_id: e.target.value })}>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.no_rm} — {p.full_name}
                      </option>
                    ))}
                  </select>
                  <select className="select" value={newVisit.service_type} onChange={(e) => setNewVisit({ ...newVisit, service_type: e.target.value })}>
                    <option value="RJ">Rawat Jalan (Poliklinik)</option>
                    <option value="IGD">IGD (Gawat Darurat)</option>
                    <option value="RI">Rawat Inap (Admisi Bed)</option>
                  </select>
                  <input className="input" placeholder="Poli / Ruang" value={newVisit.unit_name} onChange={(e) => setNewVisit({ ...newVisit, unit_name: e.target.value })} />
                  <input className="input" placeholder="DPJP / Dokter" value={newVisit.doctor_name} onChange={(e) => setNewVisit({ ...newVisit, doctor_name: e.target.value })} />
                  <select className="select" value={newVisit.payment_type} onChange={(e) => setNewVisit({ ...newVisit, payment_type: e.target.value })}>
                    <option value="BPJS">BPJS Kesehatan (Auto-SEP)</option>
                    <option value="UMUM">Umum / Tunai</option>
                    <option value="ASURANSI">Asuransi Swasta</option>
                  </select>
                  {newVisit.service_type === "RI" ? (
                    <select className="select" value={newVisit.bed_id} onChange={(e) => setNewVisit({ ...newVisit, bed_id: e.target.value })}>
                      <option value="">-- Pilih Bed Kosong --</option>
                      {beds.filter((b) => b.status === "TERSEDIA").map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.room_code} ({b.care_class}) - {formatIDR(b.daily_rate)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select className="select" value={newVisit.triage_level} onChange={(e) => setNewVisit({ ...newVisit, triage_level: e.target.value })}>
                      <option value="">Triase (Opsional)</option>
                      <option value="MERAH">IGD Merah (Resusitasi)</option>
                      <option value="KUNING">IGD Kuning (Urgent)</option>
                      <option value="HIJAU">IGD Hijau (Non-Urgent)</option>
                    </select>
                  )}
                  <button className="btn btn-primary" type="submit" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                    + Daftarkan Kunjungan & Kirim Encounter SATUSEHAT
                  </button>
                </form>
              </section>
            </div>

            <section className="card">
              <h3 style={{ marginTop: 0 }}>Daftar Kunjungan Aktif</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Antrean / Visit</th>
                      <th>Pasien</th>
                      <th>Layanan & Unit</th>
                      <th>DPJP</th>
                      <th>Penjamin / SEP</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td className="mono">
                          <strong>{v.queue_number}</strong>
                          <div style={{ color: "var(--muted)" }}>{v.visit_number}</div>
                        </td>
                        <td>
                          <strong>{v.patient_name}</strong>
                          <div className="mono" style={{ color: "var(--muted)" }}>{v.patient_no_rm}</div>
                        </td>
                        <td>
                          <span className={`badge ${v.service_type === "IGD" ? "badge-red" : v.service_type === "RI" ? "badge-amber" : "badge-cyan"}`}>
                            {v.service_type}
                          </span>{" "}
                          {v.unit_name}
                        </td>
                        <td>{v.doctor_name}</td>
                        <td>
                          <span className="badge badge-muted">{v.payment_type}</span>
                          {v.sep_number && <div className="mono" style={{ color: "#34d399", marginTop: 2 }}>{v.sep_number}</div>}
                        </td>
                        <td><span className="badge">{v.status}</span></td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setActiveVisitId(v.id);
                              setTab("rme");
                            }}
                          >
                            Buka RME
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: RME / DOKTER */}
        {tab === "rme" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong>Pilih Kunjungan Pasien:</strong>
              <select className="select" style={{ maxWidth: 420 }} value={activeVisitId} onChange={(e) => setActiveVisitId(e.target.value)}>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    [{v.service_type}] {v.patient_no_rm} — {v.patient_name} ({v.unit_name})
                  </option>
                ))}
              </select>
              {activeVisit && (
                <div className="mono" style={{ color: "var(--muted)" }}>
                  Encounter SATUSEHAT: {activeVisit.satusehat_encounter_id}
                </div>
              )}
            </section>

            <div className="grid-2">
              <section className="card">
                <h3 style={{ marginTop: 0 }}>CPPT / SOAP & Tanda-Tanda Vital (Permenkes 24/2022)</h3>
                <form onSubmit={handleSaveSOAP} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    <input className="input" type="number" placeholder="Sistolik" value={soapForm.bp_systolic} onChange={(e) => setSoapForm({ ...soapForm, bp_systolic: Number(e.target.value) })} />
                    <input className="input" type="number" placeholder="Diastolik" value={soapForm.bp_diastolic} onChange={(e) => setSoapForm({ ...soapForm, bp_diastolic: Number(e.target.value) })} />
                    <input className="input" type="number" placeholder="Nadi" value={soapForm.heart_rate} onChange={(e) => setSoapForm({ ...soapForm, heart_rate: Number(e.target.value) })} />
                    <input className="input" type="number" step="0.1" placeholder="Suhu °C" value={soapForm.temperature} onChange={(e) => setSoapForm({ ...soapForm, temperature: Number(e.target.value) })} />
                  </div>
                  <textarea className="input" rows={2} placeholder="S (Subjective / Keluhan Utama)" value={soapForm.subjective} onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })} />
                  <textarea className="input" rows={2} placeholder="O (Objective / Pemeriksaan Fisik)" value={soapForm.objective} onChange={(e) => setSoapForm({ ...soapForm, objective: e.target.value })} />
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                    <input className="input mono" placeholder="ICD-10" value={soapForm.icd10_code} onChange={(e) => setSoapForm({ ...soapForm, icd10_code: e.target.value })} />
                    <input className="input" placeholder="Diagnosis ICD-10" value={soapForm.icd10_name} onChange={(e) => setSoapForm({ ...soapForm, icd10_name: e.target.value })} />
                  </div>
                  <textarea className="input" rows={2} placeholder="P (Plan / Rencana Terapi & Tindak Lanjut)" value={soapForm.plan} onChange={(e) => setSoapForm({ ...soapForm, plan: e.target.value })} />
                  <button className="btn btn-primary" type="submit">Simpan SOAP & Kirim ICD-10 ke SATUSEHAT</button>
                </form>

                {soaps.length > 0 && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {soaps.map((s) => (
                      <div key={s.id} style={{ background: "#0d121c", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <strong>{s.author_name}</strong>
                          <span className="badge badge-cyan">{s.icd10_code} · {s.icd10_name}</span>
                        </div>
                        <div className="mono" style={{ color: "var(--muted)", marginBottom: 4 }}>
                          TD {s.bp_systolic}/{s.bp_diastolic} · HR {s.heart_rate} · T {s.temperature}°C · SpO2 {s.spo2}%
                        </div>
                        <div><strong>S:</strong> {s.subjective}</div>
                        <div><strong>O:</strong> {s.objective}</div>
                        <div><strong>P:</strong> {s.plan}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section className="card">
                  <h3 style={{ marginTop: 0 }}>Order Radiologi → Core RIS & Lihat Citra Core PACS</h3>
                  <form onSubmit={handleOrderRadiology} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, marginBottom: 12 }}>
                    <select className="select" value={radForm.modality} onChange={(e) => setRadForm({ ...radForm, modality: e.target.value })}>
                      <option value="DX">DX</option>
                      <option value="CT">CT</option>
                      <option value="MR">MR</option>
                      <option value="US">US</option>
                    </select>
                    <input className="input" placeholder="Nama Tindakan Radiologi" value={radForm.procedure_name} onChange={(e) => setRadForm({ ...radForm, procedure_name: e.target.value })} />
                    <input className="input" style={{ gridColumn: "1 / -1" }} placeholder="Indikasi Klinis" value={radForm.clinical_note} onChange={(e) => setRadForm({ ...radForm, clinical_note: e.target.value })} />
                    <button className="btn btn-cyan" type="submit" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                      Kirim Order HL7 ORM^O01 ke Core RIS
                    </button>
                  </form>

                  {activeVisitRads.map((o) => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#0d121c", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 6 }}>
                      <div>
                        <strong>[{o.modality}] {o.procedure_name}</strong>
                        <div className="mono" style={{ color: "var(--muted)" }}>{o.accession_number} · {o.ris_sync_status}</div>
                      </div>
                      <a
                        className="btn btn-primary"
                        href={`${PACS_VIEWER_URL}?StudyInstanceUID=${encodeURIComponent(o.study_instance_uid)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka Citra PACS ↗
                      </a>
                    </div>
                  ))}
                </section>

                <section className="card">
                  <h3 style={{ marginTop: 0 }}>E-Resep (KFA Kemenkes → Instalasi Farmasi)</h3>
                  <form onSubmit={handleCreateRx} style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8, marginBottom: 10 }}>
                    <select className="select" value={rxForm.medication_id} onChange={(e) => setRxForm({ ...rxForm, medication_id: e.target.value })}>
                      {medications.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Stok: {m.stock})
                        </option>
                      ))}
                    </select>
                    <input className="input" type="number" min={1} value={rxForm.qty} onChange={(e) => setRxForm({ ...rxForm, qty: Number(e.target.value) })} />
                    <input className="input" style={{ gridColumn: "1 / -1" }} placeholder="Aturan Pakai (Signa)" value={rxForm.dosage} onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })} />
                    <button className="btn btn-primary" type="submit" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                      + Kirim E-Resep ke Farmasi
                    </button>
                  </form>
                  {activeVisitRxs.map((rx) => (
                    <div key={rx.id} style={{ fontSize: 12, padding: "6px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                      <span>{rx.medication_name} x{rx.qty} ({rx.dosage})</span>
                      <span className={`badge ${rx.status === "DISERAHKAN" ? "" : "badge-amber"}`}>{rx.status}</span>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RAWAT INAP (BED BOARD) */}
        {tab === "ranap" && (
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Manajemen Tempat Tidur Rawat Inap (Bed Board)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
              {beds.map((b) => (
                <div key={b.id} className="card" style={{ background: "#0d121c" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong className="mono">{b.room_code}</strong>
                    <span className={`badge ${b.status === "TERSEDIA" ? "" : b.status === "TERISI" ? "badge-red" : "badge-amber"}`}>
                      {b.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13 }}>{b.ward_name} · {b.care_class}</div>
                  <div className="mono" style={{ color: "var(--muted)", marginTop: 4 }}>{formatIDR(b.daily_rate)} / hari</div>
                  {b.current_patient_name && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12 }}>Pasien: <strong>{b.current_patient_name}</strong></span>
                      <button className="btn" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => handleReleaseBed(b.id)}>
                        Pulangkan
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: FARMASI */}
        {tab === "farmasi" && (
          <div className="grid-2">
            <section className="card">
              <h3 style={{ marginTop: 0 }}>Antrean E-Resep Farmasi</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>No. Resep & Pasien</th>
                      <th>Obat (KFA)</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx) => (
                      <tr key={rx.id}>
                        <td>
                          <div className="mono">{rx.rx_number}</div>
                          <div>{rx.patient_name}</div>
                        </td>
                        <td>
                          <div>{rx.medication_name}</div>
                          <div className="mono" style={{ color: "var(--muted)" }}>KFA {rx.kfa_code} · {rx.dosage}</div>
                        </td>
                        <td className="mono">{rx.qty}</td>
                        <td><span className={`badge ${rx.status === "DISERAHKAN" ? "" : "badge-amber"}`}>{rx.status}</span></td>
                        <td>
                          {rx.status !== "DISERAHKAN" && (
                            <button className="btn btn-primary" onClick={() => handleDispense(rx.id)}>Serahkan</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <h3 style={{ marginTop: 0 }}>Master & Stok Obat (KFA Kemenkes)</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>KFA</th>
                      <th>Nama Obat</th>
                      <th>Stok</th>
                      <th>Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((m) => (
                      <tr key={m.id}>
                        <td className="mono">{m.kfa_code}</td>
                        <td>{m.name}</td>
                        <td className="mono">{m.stock} {m.unit}</td>
                        <td className="mono">{formatIDR(m.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: KASIR & BPJS */}
        {tab === "kasir" && (
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Kasir, Billing & Klaim BPJS (SEP / INA-CBG)</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kunjungan & Pasien</th>
                    <th>Penjamin & SEP / INA-CBG</th>
                    <th>Rincian Item</th>
                    <th>Total Tagihan</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => {
                    const items = billing.filter((b) => b.visit_id === v.id);
                    const total = items.reduce((sum, i) => sum + i.subtotal, 0);
                    const allPaid = items.length > 0 && items.every((i) => i.paid);
                    return (
                      <tr key={v.id}>
                        <td>
                          <strong>{v.patient_name}</strong>
                          <div className="mono" style={{ color: "var(--muted)" }}>{v.visit_number}</div>
                        </td>
                        <td>
                          <span className="badge badge-muted">{v.payment_type}</span>
                          {v.sep_number && <div className="mono" style={{ color: "#34d399" }}>SEP: {v.sep_number}</div>}
                          {v.inacbg_code && <div className="mono" style={{ color: "var(--muted)" }}>INA-CBG {v.inacbg_code} ({formatIDR(v.inacbg_tariff || 0)})</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {items.map((i) => (
                            <div key={i.id}>• [{i.category}] {i.description} ({formatIDR(i.subtotal)})</div>
                          ))}
                        </td>
                        <td className="mono"><strong>{formatIDR(total)}</strong></td>
                        <td><span className={`badge ${allPaid ? "" : "badge-amber"}`}>{allPaid ? "LUNAS" : "BELUM LUNAS"}</span></td>
                        <td style={{ textAlign: "right" }}>
                          {!allPaid && total > 0 && (
                            <button className="btn btn-primary" onClick={() => handleSettle(v.id)}>Bayar / Lunasi</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 6: SATUSEHAT & RIS OUTBOX */}
        {tab === "outbox" && (
          <section className="card">
            <h3 style={{ marginTop: 0 }}>Interoperability Outbox (SATUSEHAT FHIR R4 & Core RIS HL7 v2)</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Event</th>
                    <th>Referensi</th>
                    <th>Status</th>
                    <th>Payload Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {outbox.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>
                        Belum ada antrean outbox. Buat kunjungan, simpan SOAP ICD-10, order radiologi, atau e-resep untuk melihat payload FHIR R4 / HL7 v2.
                      </td>
                    </tr>
                  ) : (
                    outbox.map((o) => (
                      <tr key={o.id}>
                        <td><span className="badge badge-cyan">{o.target}</span></td>
                        <td className="mono">{o.event_type}</td>
                        <td className="mono">{o.reference_id}</td>
                        <td><span className={`badge ${o.status === "SENT" ? "" : "badge-amber"}`}>{o.status}</span></td>
                        <td className="mono" style={{ maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>
                          {o.payload}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
