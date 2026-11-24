"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AuditLogItem,
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
  UserItem,
  Visit,
  ClinicUnit,
  ExecutiveMetrics,
  StaffCredential,
  WorkstationType,
  WORKSTATIONS,
  getAllowedWorkstations,
  getDefaultWorkstation,
} from "@/lib/api";
import OdontogramCanvas from "@/components/specialty/OdontogramCanvas";
import NeuroScore from "@/components/specialty/NeuroScore";
import PediatricGrowthChart from "@/components/specialty/PediatricGrowthChart";
import OphthalmologyCanvas from "@/components/specialty/OphthalmologyCanvas";

const DEFAULT_CLINICS: ClinicUnit[] = [
  { code: "POLI-UMUM", name: "Poli Umum", specialty: "Pelayanan Medis Dasar / Dokter Umum", bpjs_poli_code: "UMU", room_number: "R.101", floor: "Lantai 1 Dasar", default_doctor: "dr. Ahmad Fauzi", doctor_list: ["dr. Ahmad Fauzi", "dr. Rina Kusuma"], operating_hours: "07:30 - 21:00 WIB" },
  { code: "POLI-PD", name: "Poli Penyakit Dalam", specialty: "Spesialis Penyakit Dalam (Sp.PD)", bpjs_poli_code: "INT", room_number: "R.201", floor: "Lantai 2", default_doctor: "dr. Hendra Wijaya, Sp.PD", doctor_list: ["dr. Hendra Wijaya, Sp.PD"], operating_hours: "08:00 - 14:00 WIB" },
  { code: "POLI-GIGI", name: "Poli Gigi & Mulut", specialty: "Dokter Gigi & Konservasi Gigi (Sp.KG)", bpjs_poli_code: "GIG", room_number: "R.105", floor: "Lantai 1 Dasar", default_doctor: "drg. Maya Indah, Sp.KG", doctor_list: ["drg. Maya Indah, Sp.KG", "drg. Anisa Rahma"], operating_hours: "08:30 - 15:00 WIB" },
  { code: "POLI-SARAF", name: "Poli Saraf (Neurologi)", specialty: "Spesialis Neurologi (Sp.N / Sp.S)", bpjs_poli_code: "SAR", room_number: "R.203", floor: "Lantai 2", default_doctor: "dr. Farhan Malik, Sp.S", doctor_list: ["dr. Farhan Malik, Sp.S"], operating_hours: "08:30 - 14:00 WIB" },
  { code: "POLI-JANTUNG", name: "Poli Jantung & Pembuluh Darah", specialty: "Spesialis Jantung & Pembuluh Darah (Sp.JP)", bpjs_poli_code: "JAN", room_number: "R.205", floor: "Lantai 2", default_doctor: "dr. Bambang Soediro, Sp.JP", doctor_list: ["dr. Bambang Soediro, Sp.JP"], operating_hours: "09:00 - 13:30 WIB" },
  { code: "POLI-ANAK", name: "Poli Anak (Pediatri)", specialty: "Spesialis Kesehatan Anak (Sp.A)", bpjs_poli_code: "ANA", room_number: "R.108", floor: "Lantai 1 Dasar", default_doctor: "dr. Siti Nurhaliza, Sp.A", doctor_list: ["dr. Siti Nurhaliza, Sp.A"], operating_hours: "08:00 - 14:00 WIB" },
  { code: "POLI-ORTHO", name: "Poli Bedah & Orthopedi", specialty: "Spesialis Orthopedi & Traumatologi (Sp.OT)", bpjs_poli_code: "ORT", room_number: "R.207", floor: "Lantai 2", default_doctor: "dr. Rizky Kurnia, Sp.OT", doctor_list: ["dr. Rizky Kurnia, Sp.OT"], operating_hours: "10:00 - 15:00 WIB" },
  { code: "POLI-PARU", name: "Poli Paru & Respirasi", specialty: "Spesialis Pulmonologi & Kedokteran Respirasi (Sp.P)", bpjs_poli_code: "PAR", room_number: "R.209", floor: "Lantai 2", default_doctor: "dr. Dian Anggraini, Sp.P", doctor_list: ["dr. Dian Anggraini, Sp.P"], operating_hours: "08:00 - 13:00 WIB" },
  { code: "POLI-MATA", name: "Poli Mata (Oftalmologi)", specialty: "Spesialis Mata (Sp.M)", bpjs_poli_code: "MAT", room_number: "R.110", floor: "Lantai 1 Dasar", default_doctor: "dr. Aris Setiawan, Sp.M", doctor_list: ["dr. Aris Setiawan, Sp.M"], operating_hours: "08:30 - 14:00 WIB" },
  { code: "POLI-THT", name: "Poli THT-KL", specialty: "Spesialis Telinga Hidung Tenggorok (Sp.THT-KL)", bpjs_poli_code: "THT", room_number: "R.112", floor: "Lantai 1 Dasar", default_doctor: "dr. Nadia Utami, Sp.THT-KL", doctor_list: ["dr. Nadia Utami, Sp.THT-KL"], operating_hours: "09:00 - 14:00 WIB" },
  { code: "POLI-OBGYN", name: "Poli Kebidanan & Kandungan", specialty: "Spesialis Obstetri & Ginekologi (Sp.OG)", bpjs_poli_code: "OBG", room_number: "R.212", floor: "Lantai 2", default_doctor: "dr. Ratna Juwita, Sp.OG", doctor_list: ["dr. Ratna Juwita, Sp.OG"], operating_hours: "08:00 - 14:00 WIB" },
  { code: "POLI-MCU", name: "Poli Medical Check Up", specialty: "Pemeriksaan Rutin & Skrining Okupasi", bpjs_poli_code: "MCU", room_number: "Gedung Diagnostic Lt.1", floor: "Lantai 1 Dasar", default_doctor: "dr. Hendra Wijaya, Sp.PD", doctor_list: ["dr. Hendra Wijaya, Sp.PD"], operating_hours: "07:30 - 12:00 WIB" },
  { code: "IGD", name: "Instalasi Gawat Darurat (IGD)", specialty: "Pelayanan Gawat Darurat & Triase 24 Jam", bpjs_poli_code: "IGD", room_number: "Zona Triase (Merah/Kuning/Hijau)", floor: "Lantai 1 Dasar", default_doctor: "dr. Rina Kusuma", doctor_list: ["dr. Rina Kusuma", "dr. Ahmad Fauzi"], operating_hours: "24 Jam Non-Stop" },
  { code: "RAWAT-INAP", name: "Instalasi Rawat Inap", specialty: "Bangsal Perawatan & Intensive Care (ICU)", bpjs_poli_code: "RANAP", room_number: "Paviliun Anggrek & Melati", floor: "Lantai 3 & 4", default_doctor: "dr. Hendra Wijaya, Sp.PD", doctor_list: ["dr. Hendra Wijaya, Sp.PD", "dr. Farhan Malik, Sp.S"], operating_hours: "24 Jam Non-Stop" },
];

type Tab = "admisi" | "rme" | "ranap" | "farmasi" | "kasir" | "outbox" | "admin" | "executive" | "hrd";

export default function SIMRSConsolePage() {
  const [token, setToken] = useState("");
  const [userLabel, setUserLabel] = useState("");
  const [userRole, setUserRole] = useState("ADMIN");
  const [userUnit, setUserUnit] = useState("");
  const [activeWorkstation, setActiveWorkstation] = useState<WorkstationType>("CLINIC");
  const [executiveMetrics, setExecutiveMetrics] = useState<ExecutiveMetrics | null>(null);
  const [staffCredentials, setStaffCredentials] = useState<StaffCredential[]>([]);
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
  const [users, setUsers] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [clinics, setClinics] = useState<ClinicUnit[]>(DEFAULT_CLINICS);
  const [poliFilter, setPoliFilter] = useState("ALL");
  const [rmePoliFilter, setRmePoliFilter] = useState("ALL");
  const [adminSubTab, setAdminSubTab] = useState<"users" | "matrix" | "audit">("users");
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    password: "",
    role: "DOKTER",
    full_name: "",
    unit: "Poli Penyakit Dalam",
    nip: "",
  });
  const [toast, setToast] = useState<string | null>(null);

  // Selected visit for RME
  const [activeVisitId, setActiveVisitId] = useState("");
  const [soaps, setSoaps] = useState<SOAPNote[]>([]);
  const [specialtyMode, setSpecialtyMode] = useState<"auto" | "odontogram" | "neuro" | "pediatric" | "eye" | "general">("auto");

  // Forms
  const [newPat, setNewPat] = useState({ full_name: "", nik: "", bpjs_number: "", birth_date: "1990-01-01", sex: "M", phone: "", mother_name: "" });
  const [patSearch, setPatSearch] = useState("");
  const [patCriteria, setPatCriteria] = useState<"ALL" | "NAME" | "NIK" | "PHONE" | "MOTHER" | "NORM">("ALL");
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
      const [dRes, pRes, vRes, bRes, mRes, rxRes, rRes, bilRes, oRes, uRes, aRes, cRes, execRes, hrdRes] = await Promise.all([
        fetch(`${SIMRS_API_URL}/api/v1/dashboard`, h),
        fetch(`${SIMRS_API_URL}/api/v1/patients`, h),
        fetch(`${SIMRS_API_URL}/api/v1/visits`, h),
        fetch(`${SIMRS_API_URL}/api/v1/beds`, h),
        fetch(`${SIMRS_API_URL}/api/v1/medications`, h),
        fetch(`${SIMRS_API_URL}/api/v1/prescriptions`, h),
        fetch(`${SIMRS_API_URL}/api/v1/radiology-orders`, h),
        fetch(`${SIMRS_API_URL}/api/v1/billing`, h),
        fetch(`${SIMRS_API_URL}/api/v1/outbox`, h),
        fetch(`${SIMRS_API_URL}/api/v1/users`, h),
        fetch(`${SIMRS_API_URL}/api/v1/audit-logs`, h),
        fetch(`${SIMRS_API_URL}/api/v1/clinics`, h),
        fetch(`${SIMRS_API_URL}/api/v1/executive/metrics`, h),
        fetch(`${SIMRS_API_URL}/api/v1/hrd/credentials`, h),
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
      if (uRes.ok) setUsers((await uRes.json()).users || []);
      if (aRes.ok) setAuditLogs((await aRes.json()).audit_logs || []);
      if (cRes && cRes.ok) {
        const cj = await cRes.json();
        if (cj.clinics && cj.clinics.length > 0) setClinics(cj.clinics);
      }
      if (execRes && execRes.ok) {
        const ej = await execRes.json();
        if (ej.metrics) setExecutiveMetrics(ej.metrics);
      }
      if (hrdRes && hrdRes.ok) {
        const hj = await hrdRes.json();
        if (hj.credentials) setStaffCredentials(hj.credentials);
      }
    } catch {
      notify("Gagal menghubungi SIMRS API (" + SIMRS_API_URL + ")");
    }
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.username.trim() || !newUserForm.password.trim() || !newUserForm.full_name.trim()) {
      notify("Username, password, dan nama lengkap wajib diisi");
      return;
    }
    const res = await fetch(`${SIMRS_API_URL}/api/v1/users`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(newUserForm),
    });
    if (res.ok) {
      notify(`Pengguna baru ${newUserForm.username} (${newUserForm.role}) berhasil ditambahkan`);
      setNewUserModal(false);
      setNewUserForm({
        username: "",
        password: "",
        role: "DOKTER",
        full_name: "",
        unit: "Poli Penyakit Dalam",
        nip: "",
      });
      loadAll();
    } else {
      const j = await res.json().catch(() => ({}));
      notify(`Gagal: ${j.error || "Gagal membuat pengguna"}`);
    }
  };

  const handleToggleUserStatus = async (username: string) => {
    const res = await fetch(`${SIMRS_API_URL}/api/v1/users/${encodeURIComponent(username)}/toggle`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (res.ok) {
      const j = await res.json();
      notify(`Status akun ${username}: ${j.active ? "AKTIF" : "DITANGGUHKAN"}`);
      loadAll();
    } else {
      notify("Gagal mengubah status akun");
    }
  };

  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) {
      notify("Tidak ada log audit untuk diexport");
      return;
    }
    const rows = [
      ["ID", "Waktu UTC", "Aktor", "Aksi", "Resource Type", "Resource ID", "Keterangan Detail"],
      ...auditLogs.map((a) => [
        a.id,
        a.created_at,
        a.actor,
        a.action,
        a.resource_type,
        a.resource_id,
        `"${(a.detail || "").replace(/"/g, '""')}"`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SIMRS_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Audit trail berhasil diexport ke CSV");
  };

  const allowedWorkstations = useMemo(() => getAllowedWorkstations(userRole), [userRole]);

  const switchWorkstation = useCallback(
    (ws: WorkstationType) => {
      setActiveWorkstation(ws);
      localStorage.setItem("simrs_ws", ws);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ws", ws.toLowerCase());
        window.history.replaceState(null, "", url.toString());
      }
      if (ws === "CLINIC") setTab("rme");
      else if (ws === "PHARMACY") setTab("farmasi");
      else if (ws === "BILLING") setTab("kasir");
      else if (ws === "ADMISSION") setTab("admisi");
      else if (ws === "RANAP") setTab("ranap");
      else if (ws === "EXECUTIVE") setTab("executive");
      else if (ws === "HRD") setTab("hrd");
      else if (ws === "ADMIN") setTab("admin");
      notify(`Workstation beralih ke: ${WORKSTATIONS[ws]?.title}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const saved = getToken();
    if (saved) {
      setToken(saved);
      const r = localStorage.getItem("simrs_role") || "ADMIN";
      const u = localStorage.getItem("simrs_unit") || "";
      const lbl = localStorage.getItem("simrs_user_label") || "";
      setUserRole(r);
      setUserUnit(u);
      if (lbl) setUserLabel(lbl);

      const allowed = getAllowedWorkstations(r);
      let targetWs: WorkstationType = "CLINIC";
      if (typeof window !== "undefined") {
        const paramWs = new URLSearchParams(window.location.search).get("ws")?.toUpperCase() as WorkstationType;
        if (paramWs && allowed.includes(paramWs)) {
          targetWs = paramWs;
        } else {
          const def = getDefaultWorkstation(r, u);
          targetWs = def.ws;
          if (def.defaultPoli) {
            setPoliFilter(def.defaultPoli);
            setRmePoliFilter(def.defaultPoli);
          }
        }
      }
      setActiveWorkstation(targetWs);
      localStorage.setItem("simrs_ws", targetWs);

      if (targetWs === "CLINIC") setTab("rme");
      else if (targetWs === "PHARMACY") setTab("farmasi");
      else if (targetWs === "BILLING") setTab("kasir");
      else if (targetWs === "ADMISSION") setTab("admisi");
      else if (targetWs === "RANAP") setTab("ranap");
      else if (targetWs === "EXECUTIVE") setTab("executive");
      else if (targetWs === "HRD") setTab("hrd");
      else if (targetWs === "ADMIN") setTab("admin");
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    loadAll();
    const interval = setInterval(() => {
      loadAll();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, loadAll]);

  useEffect(() => {
    if (!activeVisitId || !token) return;
    fetch(`${SIMRS_API_URL}/api/v1/visits/${activeVisitId}/soap`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setSoaps(j.soap_notes || []))
      .catch(() => { });
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
      const role = j.user?.role || "ADMIN";
      const unit = j.user?.unit || "";
      const lbl = `${j.user?.full_name || loginUser} (${role})`;
      setUserRole(role);
      setUserUnit(unit);
      setUserLabel(lbl);
      localStorage.setItem("simrs_role", role);
      localStorage.setItem("simrs_unit", unit);
      localStorage.setItem("simrs_user_label", lbl);

      // Dynamic Workstation Routing Gate
      const def = getDefaultWorkstation(role, unit);
      setActiveWorkstation(def.ws);
      setTab(def.tab as Tab);
      if (def.defaultPoli) {
        setPoliFilter(def.defaultPoli);
        setRmePoliFilter(def.defaultPoli);
      }
      localStorage.setItem("simrs_ws", def.ws);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ws", def.ws.toLowerCase());
        window.history.replaceState(null, "", url.toString());
      }
      notify(`Login Berhasil: Mengarahkan ke ${WORKSTATIONS[def.ws]?.title || def.ws}`);
    } catch {
      setLoginErr("Tidak dapat terhubung ke SIMRS API");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("simrs_jwt");
    localStorage.removeItem("simrs_role");
    localStorage.removeItem("simrs_unit");
    localStorage.removeItem("simrs_ws");
    localStorage.removeItem("simrs_user_label");
    setToken("");
    setUserLabel("");
    setUserRole("ADMIN");
    setUserUnit("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("ws");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const activeVisit = visits.find((v) => v.id === activeVisitId) || null;
  const activeVisitRads = radOrders.filter((r) => r.visit_id === activeVisitId);
  const activeVisitRxs = prescriptions.filter((rx) => rx.visit_id === activeVisitId);

  const effectiveSpecialty = useMemo(() => {
    if (specialtyMode !== "auto") return specialtyMode;
    if (!activeVisit) return "general";
    const u = (activeVisit.unit_name || "").toLowerCase();
    if (u.includes("gigi") || u.includes("mulut")) return "odontogram";
    if (u.includes("saraf") || u.includes("neuro")) return "neuro";
    if (u.includes("anak") || u.includes("pediatri")) return "pediatric";
    if (u.includes("mata") || u.includes("oftalm")) return "eye";
    return "general";
  }, [specialtyMode, activeVisit]);

  const handleExportSpecialtyToSOAP = (objectiveText: string, icd10Code?: string, icd10Name?: string) => {
    setSoapForm((prev) => ({
      ...prev,
      objective: prev.objective ? `${prev.objective}\n\n${objectiveText}` : objectiveText,
      icd10_code: icd10Code || prev.icd10_code,
      icd10_name: icd10Name || prev.icd10_name,
    }));
    notify(`Temuan spesialisasi (${icd10Code || "Objektif"}) dimasukkan ke SOAP.`);
  };

  const filteredVisits = visits.filter((v) => {
    if (poliFilter !== "ALL") {
      const vUnit = v.unit_name.toLowerCase();
      const pFilter = poliFilter.toLowerCase();
      if (!vUnit.includes(pFilter)) {
        return false;
      }
    }
    if (!patSearch.trim()) return true;
    const q = patSearch.toLowerCase().trim();
    const p = patients.find((pat) => pat.id === v.patient_id || pat.no_rm === v.patient_no_rm);
    if (!p) {
      return v.patient_name.toLowerCase().includes(q) || v.patient_no_rm.toLowerCase().includes(q) || v.visit_number.toLowerCase().includes(q);
    }
    if (patCriteria === "NAME") return p.full_name.toLowerCase().includes(q);
    if (patCriteria === "NIK") return p.nik.toLowerCase().includes(q);
    if (patCriteria === "PHONE") return p.phone.toLowerCase().includes(q);
    if (patCriteria === "MOTHER") return (p.mother_name || "").toLowerCase().includes(q);
    if (patCriteria === "NORM") return p.no_rm.toLowerCase().includes(q);
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.nik.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      (p.mother_name || "").toLowerCase().includes(q) ||
      p.no_rm.toLowerCase().includes(q) ||
      (p.bpjs_number || "").toLowerCase().includes(q) ||
      v.visit_number.toLowerCase().includes(q) ||
      v.unit_name.toLowerCase().includes(q)
    );
  });

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
      setNewPat({ full_name: "", nik: "", bpjs_number: "", birth_date: "1990-01-01", sex: "M", phone: "", mother_name: "" });
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
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>
              ⚡ Quick 1-Click Role Login Gate (Zero-Client Setup):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {[
                { label: "Admin IT", u: "admin", p: "admin123", color: "#64748b" },
                { label: "Dr. Sp.PD", u: "dokter", p: "dokter123", color: "#0ea5e9" },
                { label: "Drg. Gigi", u: "dokter_gigi", p: "dokter123", color: "#06b6d4" },
                { label: "Dr. Saraf", u: "dokter_saraf", p: "dokter123", color: "#8b5cf6" },
                { label: "Dr. Umum", u: "dokter_umum", p: "dokter123", color: "#10b981" },
                { label: "Farmasi", u: "farmasi", p: "farmasi123", color: "#14b8a6" },
                { label: "Kasir", u: "kasir", p: "kasir123", color: "#f59e0b" },
                { label: "Admisi", u: "admisi", p: "admisi123", color: "#3b82f6" },
                { label: "Perawat", u: "perawat", p: "perawat123", color: "#ec4899" },
                { label: "Direksi", u: "direksi", p: "direksi123", color: "#e11d48" },
                { label: "SDM/HRD", u: "hrd", p: "hrd123", color: "#a855f7" },
              ].map((c) => (
                <button
                  key={c.u}
                  type="button"
                  onClick={() => {
                    setLoginUser(c.u);
                    setLoginPass(c.p);
                  }}
                  style={{
                    padding: "3px 7px",
                    fontSize: 10,
                    borderRadius: 5,
                    border: `1px solid ${c.color}50`,
                    background: `${c.color}15`,
                    color: c.color,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
              Pilih akun demo di atas untuk mengisi kredensial, lalu klik <strong>Masuk</strong>.
            </div>
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
          {activeWorkstation === "CLINIC" && (
            <>
              <button className={`tab-btn ${tab === "admisi" ? "active" : ""}`} onClick={() => setTab("admisi")}>
                📋 Antrean Poliklinik ({filteredVisits.length})
              </button>
              <button className={`tab-btn ${tab === "rme" ? "active" : ""}`} onClick={() => setTab("rme")}>
                🩺 Rekam Medis (SOAP / CPPT)
              </button>
            </>
          )}

          {activeWorkstation === "PHARMACY" && (
            <button className={`tab-btn ${tab === "farmasi" ? "active" : ""}`} onClick={() => setTab("farmasi")}>
              💊 Worklist E-Resep & Telaah Obat ({dashboard?.stats.pending_rx ?? 0})
            </button>
          )}

          {activeWorkstation === "BILLING" && (
            <button className={`tab-btn ${tab === "kasir" ? "active" : ""}`} onClick={() => setTab("kasir")}>
              💳 Kasir & Billing POS Terpadu
            </button>
          )}

          {activeWorkstation === "ADMISSION" && (
            <button className={`tab-btn ${tab === "admisi" ? "active" : ""}`} onClick={() => setTab("admisi")}>
              📋 Admisi, Registrasi EMPI & Antrean ({visits.length})
            </button>
          )}

          {activeWorkstation === "RANAP" && (
            <button className={`tab-btn ${tab === "ranap" ? "active" : ""}`} onClick={() => setTab("ranap")}>
              🛏️ Rawat Inap & Bangsal ({dashboard?.stats.beds_occupied ?? 0}/{beds.length})
            </button>
          )}

          {activeWorkstation === "EXECUTIVE" && (
            <>
              <button className={`tab-btn ${tab === "executive" ? "active" : ""}`} onClick={() => setTab("executive")}>
                📊 Executive Command Center
              </button>
              <button className={`tab-btn ${tab === "ranap" ? "active" : ""}`} onClick={() => setTab("ranap")}>
                🛏️ Bangsal & Tempat Tidur ({dashboard?.stats.beds_occupied ?? 0}/{beds.length})
              </button>
            </>
          )}

          {activeWorkstation === "HRD" && (
            <button className={`tab-btn ${tab === "hrd" ? "active" : ""}`} onClick={() => setTab("hrd")}>
              👥 SDM & Kredensial Medis ({staffCredentials.length || 6})
            </button>
          )}

          {activeWorkstation === "ADMIN" && (
            <>
              <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>
                🔐 Admin & IAM ({users.length})
              </button>
              <button className={`tab-btn ${tab === "admisi" ? "active" : ""}`} onClick={() => setTab("admisi")}>
                Admisi
              </button>
              <button className={`tab-btn ${tab === "rme" ? "active" : ""}`} onClick={() => setTab("rme")}>
                RME / DPJP
              </button>
              <button className={`tab-btn ${tab === "ranap" ? "active" : ""}`} onClick={() => setTab("ranap")}>
                Ranap
              </button>
              <button className={`tab-btn ${tab === "farmasi" ? "active" : ""}`} onClick={() => setTab("farmasi")}>
                Farmasi
              </button>
              <button className={`tab-btn ${tab === "kasir" ? "active" : ""}`} onClick={() => setTab("kasir")}>
                Kasir
              </button>
              <button className={`tab-btn ${tab === "executive" ? "active" : ""}`} onClick={() => setTab("executive")}>
                Eksekutif
              </button>
              <button className={`tab-btn ${tab === "hrd" ? "active" : ""}`} onClick={() => setTab("hrd")}>
                SDM
              </button>
              <button className={`tab-btn ${tab === "outbox" ? "active" : ""}`} onClick={() => setTab("outbox")}>
                SATUSEHAT & RIS ({outbox.length})
              </button>
            </>
          )}

          <button
            className="tab-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#38bdf8" }}
            onClick={() => {
              loadAll();
              notify("Data live disinkronkan dari server");
            }}
            title="Sinkronkan status antrean, farmasi & radiologi sekarang"
          >
            <span>🔄</span> Sinkron
          </button>
          <a className="btn btn-cyan" style={{ padding: "6px 10px", fontSize: 12 }} href={RIS_URL} target="_blank" rel="noreferrer">
            Buka RIS ↗
          </a>
          <button className="tab-btn" onClick={handleLogout} title={userLabel}>
            Keluar
          </button>
        </nav>
      </header>

      {/* Dynamic Workstation Banner Bar */}
      <div
        style={{
          background: "linear-gradient(90deg, #0b1329 0%, #111e38 100%)",
          borderBottom: "1px solid rgba(56, 189, 248, 0.2)",
          padding: "8px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              display: "grid",
              placeItems: "center",
              fontSize: 20,
            }}
          >
            {WORKSTATIONS[activeWorkstation]?.icon || "🏢"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>
                {WORKSTATIONS[activeWorkstation]?.title}
              </span>
              <span className="badge badge-cyan" style={{ fontSize: 10 }}>
                {WORKSTATIONS[activeWorkstation]?.badge}
              </span>
              {userUnit && (
                <span className="badge badge-blue" style={{ fontSize: 10 }}>
                  📍 {userUnit}
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Logged in as <strong>{userLabel || "Pengguna"}</strong>
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {WORKSTATIONS[activeWorkstation]?.description}
            </div>
          </div>
        </div>

        {/* Workstation Context Switcher / Role-Locked Badge */}
        {allowedWorkstations.length > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>🔀 Ganti Workstation:</span>
            <select
              className="input"
              style={{
                padding: "4px 10px",
                fontSize: 12,
                minWidth: 220,
                cursor: "pointer",
                borderColor: "rgba(56, 189, 248, 0.4)",
                background: "rgba(15, 23, 42, 0.8)",
                color: "#38bdf8",
                fontWeight: 600,
              }}
              value={activeWorkstation}
              onChange={(e) => switchWorkstation(e.target.value as WorkstationType)}
            >
              {allowedWorkstations.map((wsKey) => (
                <option key={wsKey} value={wsKey}>
                  {WORKSTATIONS[wsKey]?.icon} {WORKSTATIONS[wsKey]?.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 11,
              color: "#94a3b8",
            }}
            title="Akses dikunci secara otomatis sesuai peran klinis (UU PDP No. 27/2022 & Need-to-Know Principle)"
          >
            <span>🔒</span>
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>Workstation Terkunci:</span>
            <span>{WORKSTATIONS[activeWorkstation]?.title}</span>
          </div>
        )}
      </div>

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
            {/* Multi-Parameter Patient Search Bar */}
            <section className="card" style={{ background: "linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0.5) 100%)", border: "1px solid rgba(6, 182, 212, 0.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
                    <span>🔍 Pencarian Pasien Multi-Parameter (Master EMPI)</span>
                    <span className="badge badge-cyan" style={{ fontSize: 10 }}>Akreditasi STARKES</span>
                  </h3>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                    Cari rekam medis instan berdasarkan <strong>Nama Pasien</strong>, <strong>NIK KTP</strong>, <strong>No. HP</strong>, <strong>Nama Ibu Kandung</strong>, atau <strong>No. RM</strong>.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(["ALL", "NAME", "NIK", "PHONE", "MOTHER", "NORM"] as const).map((crit) => (
                    <button
                      key={crit}
                      type="button"
                      className={`btn ${patCriteria === crit ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "4px 8px", fontSize: 11 }}
                      onClick={() => setPatCriteria(crit)}
                    >
                      {crit === "ALL" && "Semua Field"}
                      {crit === "NAME" && "Nama"}
                      {crit === "NIK" && "NIK KTP"}
                      {crit === "PHONE" && "No. HP"}
                      {crit === "MOTHER" && "Nama Ibu"}
                      {crit === "NORM" && "No. RM"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 260, fontSize: 13 }}
                  placeholder={
                    patCriteria === "NAME"
                      ? "🔍 Ketik Nama Pasien (contoh: Budi, Siti, Hendra)..."
                      : patCriteria === "NIK"
                        ? "🔍 Ketik NIK KTP 16 digit (contoh: 3171011204850001)..."
                        : patCriteria === "PHONE"
                          ? "🔍 Ketik No. HP / WhatsApp (contoh: 081234567801)..."
                          : patCriteria === "MOTHER"
                            ? "🔍 Ketik Nama Ibu Kandung (contoh: Siti Aminah, Mariam, Dewi Sartika)..."
                            : patCriteria === "NORM"
                              ? "🔍 Ketik No. RM (contoh: RM-2026-001)..."
                              : "🔍 Cari Nama Pasien, NIK KTP, No. HP, Nama Ibu Kandung, atau No. RM..."
                  }
                  value={patSearch}
                  onChange={(e) => setPatSearch(e.target.value)}
                />
                {patSearch && (
                  <button className="btn btn-secondary" type="button" onClick={() => setPatSearch("")}>
                    ✕ Reset
                  </button>
                )}
              </div>

              {/* Quick sample chips */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap", fontSize: 11 }}>
                <span style={{ color: "var(--muted)" }}>Tes Cepat Demo:</span>
                <button type="button" className="btn btn-secondary" style={{ padding: "2px 7px", fontSize: 10 }} onClick={() => { setPatCriteria("NAME"); setPatSearch("Budi"); }}>
                  Nama: "Budi"
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "2px 7px", fontSize: 10 }} onClick={() => { setPatCriteria("NIK"); setPatSearch("3171011204850001"); }}>
                  KTP: 3171011204850001
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "2px 7px", fontSize: 10 }} onClick={() => { setPatCriteria("PHONE"); setPatSearch("081234567802"); }}>
                  HP: 081234567802
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "2px 7px", fontSize: 10 }} onClick={() => { setPatCriteria("MOTHER"); setPatSearch("Siti Aminah"); }}>
                  Ibu: "Siti Aminah"
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "2px 7px", fontSize: 10 }} onClick={() => { setPatCriteria("MOTHER"); setPatSearch("Mariam"); }}>
                  Ibu: "Mariam"
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "2px 7px", fontSize: 10 }} onClick={() => { setPatCriteria("NORM"); setPatSearch("RM-2026-003"); }}>
                  No. RM: RM-2026-003
                </button>
              </div>
            </section>

            <div className="grid-2">
              <section className="card">
                <h3 style={{ marginTop: 0 }}>Registrasi Pasien Baru (EMPI)</h3>
                <form onSubmit={handleCreatePatient} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className="input" placeholder="Nama Lengkap *" value={newPat.full_name} onChange={(e) => setNewPat({ ...newPat, full_name: e.target.value })} />
                  <input className="input" placeholder="NIK (16 digit)" value={newPat.nik} onChange={(e) => setNewPat({ ...newPat, nik: e.target.value })} />
                  <input className="input" placeholder="Nama Ibu Kandung *" value={newPat.mother_name} onChange={(e) => setNewPat({ ...newPat, mother_name: e.target.value })} />
                  <input className="input" placeholder="No. HP" value={newPat.phone} onChange={(e) => setNewPat({ ...newPat, phone: e.target.value })} />
                  <input className="input" placeholder="No. Kartu BPJS" value={newPat.bpjs_number} onChange={(e) => setNewPat({ ...newPat, bpjs_number: e.target.value })} />
                  <input className="input" type="date" value={newPat.birth_date} onChange={(e) => setNewPat({ ...newPat, birth_date: e.target.value })} />
                  <select className="select" value={newPat.sex} onChange={(e) => setNewPat({ ...newPat, sex: e.target.value })}>
                    <option value="M">Laki-laki</option>
                    <option value="F">Perempuan</option>
                  </select>
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
                        {p.no_rm} — {p.full_name} {p.mother_name ? `(Ibu: ${p.mother_name})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={newVisit.service_type}
                    onChange={(e) => {
                      const st = e.target.value;
                      if (st === "IGD") {
                        setNewVisit({ ...newVisit, service_type: st, unit_name: "IGD Triase", doctor_name: "dr. Rina Kusuma" });
                      } else if (st === "RI") {
                        setNewVisit({ ...newVisit, service_type: st, unit_name: "Paviliun Anggrek", doctor_name: "dr. Hendra Wijaya, Sp.PD" });
                      } else {
                        setNewVisit({ ...newVisit, service_type: st, unit_name: "Poli Penyakit Dalam", doctor_name: "dr. Hendra Wijaya, Sp.PD" });
                      }
                    }}
                  >
                    <option value="RJ">Rawat Jalan (Poliklinik Spesialis)</option>
                    <option value="IGD">IGD (Gawat Darurat)</option>
                    <option value="RI">Rawat Inap (Admisi Bed)</option>
                  </select>

                  {newVisit.service_type === "RJ" ? (
                    <select
                      className="select"
                      value={newVisit.unit_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const c = clinics.find((cl) => cl.name === val);
                        setNewVisit({
                          ...newVisit,
                          unit_name: val,
                          doctor_name: c?.default_doctor || (c?.doctor_list?.[0] || newVisit.doctor_name),
                        });
                      }}
                    >
                      {clinics.filter((c) => c.code.startsWith("POLI-")).map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name} — {c.room_number} ({c.specialty.split("(")[0].trim()})
                        </option>
                      ))}
                    </select>
                  ) : newVisit.service_type === "IGD" ? (
                    <select
                      className="select"
                      value={newVisit.unit_name}
                      onChange={(e) => setNewVisit({ ...newVisit, unit_name: e.target.value })}
                    >
                      <option value="IGD Triase">IGD Triase & Resusitasi</option>
                      <option value="IGD Observasi">IGD Ruang Observasi</option>
                      <option value="IGD Isolasi">IGD Ruang Isolasi</option>
                    </select>
                  ) : (
                    <select
                      className="select"
                      value={newVisit.unit_name}
                      onChange={(e) => setNewVisit({ ...newVisit, unit_name: e.target.value })}
                    >
                      <option value="Paviliun Anggrek">Paviliun Anggrek (Kelas 1 & VIP)</option>
                      <option value="Ruang Melati">Ruang Melati (Kelas 2)</option>
                      <option value="Ruang Kenanga">Ruang Kenanga (Kelas 3)</option>
                      <option value="ICU Sentral">ICU Sentral (Intensive Care)</option>
                    </select>
                  )}

                  {newVisit.service_type === "RJ" ? (
                    <select
                      className="select"
                      value={newVisit.doctor_name}
                      onChange={(e) => setNewVisit({ ...newVisit, doctor_name: e.target.value })}
                    >
                      {(() => {
                        const currentC = clinics.find((cl) => cl.name === newVisit.unit_name);
                        const docList = currentC?.doctor_list && currentC.doctor_list.length > 0
                          ? currentC.doctor_list
                          : [newVisit.doctor_name || "dr. Hendra Wijaya, Sp.PD"];
                        return docList.map((doc) => (
                          <option key={doc} value={doc}>
                            DPJP: {doc}
                          </option>
                        ));
                      })()}
                    </select>
                  ) : (
                    <input
                      className="input"
                      placeholder="DPJP / Dokter Penanggung Jawab"
                      value={newVisit.doctor_name}
                      onChange={(e) => setNewVisit({ ...newVisit, doctor_name: e.target.value })}
                    />
                  )}

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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0 }}>
                  Daftar Kunjungan Aktif ({filteredVisits.length}{filteredVisits.length !== visits.length ? ` dari ${visits.length}` : ""})
                </h3>
                {patSearch && (
                  <span className="badge badge-cyan" style={{ fontSize: 11 }}>
                    Filter: "{patSearch}" ({filteredVisits.length} ditemukan)
                  </span>
                )}
              </div>

              {/* Interactive Poliklinik Filter Chips */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginRight: 2 }}>
                  Filter Poliklinik:
                </span>
                <button
                  type="button"
                  className={`btn ${poliFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
                  style={{ padding: "3px 8px", fontSize: 11 }}
                  onClick={() => setPoliFilter("ALL")}
                >
                  Semua ({visits.length})
                </button>
                {clinics.map((c) => {
                  const count = visits.filter(
                    (v) =>
                      v.unit_name.toLowerCase().includes(c.name.toLowerCase()) ||
                      v.unit_name.toLowerCase().includes(c.code.toLowerCase())
                  ).length;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className={`btn ${poliFilter === c.name ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => setPoliFilter(c.name)}
                    >
                      {c.name}
                      {count > 0 && (
                        <span
                          className="badge badge-cyan"
                          style={{ marginLeft: 4, padding: "1px 5px", fontSize: 10 }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Antrean / Visit</th>
                      <th>Pasien & Identitas EMPI</th>
                      <th>Layanan & Unit</th>
                      <th>DPJP</th>
                      <th>Penjamin / SEP</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                          Tidak ditemukan pasien dengan kriteria pencarian "{patSearch}". Coba reset atau periksa kata kunci.
                        </td>
                      </tr>
                    ) : (
                      filteredVisits.map((v) => {
                        const p = patients.find((pat) => pat.id === v.patient_id || pat.no_rm === v.patient_no_rm);
                        return (
                          <tr key={v.id}>
                            <td className="mono">
                              <strong>{v.queue_number}</strong>
                              <div style={{ color: "var(--muted)" }}>{v.visit_number}</div>
                            </td>
                            <td>
                              <strong>{v.patient_name}</strong>
                              <div className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{v.patient_no_rm}</div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, fontSize: 11 }}>
                                {p?.nik && (
                                  <span className="badge badge-muted" title="Nomor KTP">
                                    KTP: {p.nik}
                                  </span>
                                )}
                                {p?.phone && (
                                  <span className="badge badge-cyan" title="Nomor Telepon">
                                    HP: {p.phone}
                                  </span>
                                )}
                                {p?.mother_name && (
                                  <span className="badge badge-gold" title="Nama Ibu Kandung">
                                    Ibu: {p.mother_name}
                                  </span>
                                )}
                              </div>
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Master Directory of Poliklinik & Specialty Clinics */}
            <section className="card" style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>🏥 Direktori Master Poliklinik & Unit Layanan Terpadu</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Pemetaan resmi 14 unit pelayanan rawat jalan, gawat darurat, dan rawat inap dengan dokter penanggung jawab (DPJP), ruang praktik, dan bridging BPJS/SATUSEHAT.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge badge-cyan">{clinics.length} Unit Terpetakan</span>
                  {poliFilter !== "ALL" && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => setPoliFilter("ALL")}
                    >
                      ✕ Tampilkan Semua Poli
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {clinics.map((c) => {
                  const activeCount = visits.filter(
                    (v) =>
                      v.unit_name.toLowerCase().includes(c.name.toLowerCase()) ||
                      v.unit_name.toLowerCase().includes(c.code.toLowerCase())
                  ).length;
                  const isSelected = poliFilter === c.name;
                  return (
                    <div
                      key={c.code}
                      style={{
                        border: isSelected ? "2px solid #06b6d4" : "1px solid var(--border)",
                        background: isSelected ? "rgba(6,182,212,0.08)" : "var(--surface-hover)",
                        borderRadius: 8,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.specialty}</div>
                        </div>
                        <span className={`badge ${activeCount > 0 ? "badge-green" : "badge-muted"}`} style={{ fontSize: 10 }}>
                          {activeCount} Pasien
                        </span>
                      </div>

                      <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                        <div>
                          <span style={{ color: "var(--muted)" }}>👨‍⚕️ DPJP Utama:</span> <strong>{c.default_doctor}</strong>
                        </div>
                        <div>
                          <span style={{ color: "var(--muted)" }}>📍 Ruang & Lantai:</span> {c.room_number} ({c.floor})
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ color: "var(--muted)" }}>⏱️ Jam:</span> {c.operating_hours}
                          </div>
                          <span className="badge badge-muted mono" style={{ fontSize: 9 }}>BPJS: {c.bpjs_poli_code}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                          style={{ flex: 1, padding: "4px 8px", fontSize: 11, justifyContent: "center" }}
                          onClick={() => {
                            setPoliFilter(c.name);
                            notify(`Menyaring daftar kunjungan untuk ${c.name}`);
                          }}
                        >
                          {isSelected ? "✓ Sedang Difilter" : "Lihat Antrean"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                          title="Daftarkan Pasien ke Poli Ini"
                          onClick={() => {
                            setNewVisit({
                              ...newVisit,
                              service_type: c.code === "IGD" ? "IGD" : c.code === "RAWAT-INAP" ? "RI" : "RJ",
                              unit_name: c.name,
                              doctor_name: c.default_doctor,
                            });
                            notify(`Form pendaftaran diatur ke ${c.name} (${c.default_doctor})`);
                            window.scrollTo({ top: 400, behavior: "smooth" });
                          }}
                        >
                          + Daftar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: RME / DOKTER */}
        {tab === "rme" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <strong>Filter Poli:</strong>
                <select
                  className="select"
                  style={{ maxWidth: 220 }}
                  value={rmePoliFilter}
                  onChange={(e) => {
                    const selPoli = e.target.value;
                    setRmePoliFilter(selPoli);
                    const matched = visits.find((v) => selPoli === "ALL" || v.unit_name.toLowerCase().includes(selPoli.toLowerCase()));
                    if (matched) setActiveVisitId(matched.id);
                  }}
                >
                  <option value="ALL">Semua Poliklinik & Ruang</option>
                  {clinics.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 300 }}>
                <strong>Pilih Pasien:</strong>
                <select
                  className="select"
                  style={{ flex: 1 }}
                  value={activeVisitId}
                  onChange={(e) => setActiveVisitId(e.target.value)}
                >
                  {visits
                    .filter((v) => rmePoliFilter === "ALL" || v.unit_name.toLowerCase().includes(rmePoliFilter.toLowerCase()))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        [{v.service_type}] {v.patient_no_rm} — {v.patient_name} ({v.unit_name})
                      </option>
                    ))}
                </select>
              </div>

              {activeVisit && (
                <div className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>
                  Encounter: {activeVisit.satusehat_encounter_id}
                </div>
              )}
            </section>

            {/* KANVAS PEMERIKSAAN SPESIALISASI KLINIS */}
            <section className="card" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0 }}>🎯 Kanvas Pemeriksaan Spesialisasi Klinis</h3>
                  <span className="badge badge-cyan">
                    {effectiveSpecialty === "odontogram"
                      ? "🦷 Poli Gigi & Mulut"
                      : effectiveSpecialty === "neuro"
                      ? "🧠 Poli Saraf (Neurologi)"
                      : effectiveSpecialty === "pediatric"
                      ? "👶 Poli Anak (Pediatri)"
                      : effectiveSpecialty === "eye"
                      ? "👁️ Poli Mata (Oftalmologi)"
                      : "📋 Umum / CPPT Standar"}
                  </span>
                  {activeVisit && (
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                      Unit Pasien: {activeVisit.unit_name}
                    </span>
                  )}
                </div>

                {/* Switcher Tab Pills */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setSpecialtyMode("odontogram")}
                    className={`btn ${effectiveSpecialty === "odontogram" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "5px 10px" }}
                  >
                    🦷 Odontogram Gigi
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpecialtyMode("neuro")}
                    className={`btn ${effectiveSpecialty === "neuro" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "5px 10px" }}
                  >
                    🧠 Skoring Saraf (GCS & NIHSS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpecialtyMode("pediatric")}
                    className={`btn ${effectiveSpecialty === "pediatric" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "5px 10px" }}
                  >
                    👶 Kurva Anak WHO
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpecialtyMode("eye")}
                    className={`btn ${effectiveSpecialty === "eye" ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "5px 10px" }}
                  >
                    👁️ Refraksi & TIO Mata
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpecialtyMode("auto")}
                    className={`btn ${specialtyMode === "auto" ? "btn-cyan" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "5px 10px" }}
                    title="Deteksi otomatis spesialisasi berdasarkan poli asal pasien"
                  >
                    ⚡ Auto ({activeVisit?.unit_name?.split(" ")[1] || "Poli"})
                  </button>
                </div>
              </div>

              {/* Render Canvas */}
              {effectiveSpecialty === "odontogram" && (
                <OdontogramCanvas onExportToSOAP={handleExportSpecialtyToSOAP} />
              )}
              {effectiveSpecialty === "neuro" && (
                <NeuroScore onExportToSOAP={handleExportSpecialtyToSOAP} />
              )}
              {effectiveSpecialty === "pediatric" && (
                <PediatricGrowthChart onExportToSOAP={handleExportSpecialtyToSOAP} />
              )}
              {effectiveSpecialty === "eye" && (
                <OphthalmologyCanvas onExportToSOAP={handleExportSpecialtyToSOAP} />
              )}
              {effectiveSpecialty === "general" && (
                <div style={{ padding: "16px 20px", background: "#0d121c", borderRadius: 8, border: "1px dashed var(--border)", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                  Pasien berada di unit layanan umum / non-spesifik. Gunakan form <strong>CPPT / SOAP</strong> di bawah untuk pencatatan rutin, atau klik salah satu tombol spesialisasi di atas (Odontogram, Saraf, Anak, Mata) jika memerlukan kanvas khusus.
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
                    <div key={o.id} style={{ padding: "8px 10px", background: "#0d121c", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <strong>[{o.modality}] {o.procedure_name}</strong>
                          <div className="mono" style={{ color: "var(--muted)" }}>
                            {o.accession_number} · {o.ris_sync_status}
                            {o.report_status ? ` · REPORT ${o.report_status}` : ""}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary"
                          onClick={async () => {
                            const res = await fetch(`${SIMRS_API_URL}/api/v1/radiology-orders/${o.id}/viewer-url`, { headers: authHeaders() });
                            if (res.ok) {
                              const j = await res.json();
                              window.open(j.viewer_url, "_blank", "noopener,noreferrer");
                            } else {
                              window.open(`${PACS_VIEWER_URL}?StudyInstanceUID=${encodeURIComponent(o.study_instance_uid)}`, "_blank", "noopener,noreferrer");
                            }
                          }}
                        >
                          Buka Citra PACS (SSO) ↗
                        </button>
                      </div>
                      {o.report_text && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                          <div style={{ color: "#34d399", fontWeight: 600, marginBottom: 4 }}>
                            Hasil Expertise Radiolog ({o.radiologist_name || "Sp.Rad"}):
                          </div>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", color: "var(--text)" }}>
                            {o.report_text}
                          </pre>
                        </div>
                      )}
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
                  {activeVisitRxs.map((rx) => {
                    const isDone = rx.status === "DISERAHKAN" || rx.status === "SELESAI";
                    return (
                      <div
                        key={rx.id}
                        style={{
                          fontSize: 12,
                          padding: "6px 0",
                          borderTop: "1px solid var(--border)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: "#f8fafc" }}>{rx.medication_name}</span>{" "}
                          <span style={{ color: "var(--muted)" }}>x{rx.qty} ({rx.dosage})</span>
                        </div>
                        <span
                          className={`badge ${isDone ? "" : "badge-amber"}`}
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            borderRadius: 10,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {rx.status === "DISERAHKAN"
                            ? "✓ SELESAI (DISERAHKAN)"
                            : rx.status === "SELESAI"
                            ? "✓ SELESAI"
                            : "⏳ MENUNGGU DI FARMASI"}
                        </span>
                      </div>
                    );
                  })}
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

        {/* TAB 7: ADMIN & IAM (HAK AKSES, RBAC & AUDIT TRAIL FORENSIK) */}
        {tab === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Compliance Banner & KPI Cards */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(56, 189, 248, 0.10) 100%)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🛡️</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#f3e8ff" }}>
                    Pusat Kontrol Akses & Kepatuhan Privasi Data Medis
                  </span>
                  <span className="badge" style={{ background: "#7e22ce", color: "#f3e8ff", border: "1px solid #a855f7" }}>
                    UU PDP No. 27/2022 & Permenkes No. 24/2022 Verified
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  Enkripsi token berbasis peran (RBAC), pembatasan akses data medis (Need-to-Know Basis), dan rekam jejak forensik digital (Immutable Audit Trail).
                </div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8" }}>{users.length}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Pengguna</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80" }}>{users.filter((u) => u.active).length}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Akun Aktif</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#c084fc" }}>6</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Peran (Roles)</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24" }}>{auditLogs.length}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Log Audit</div>
                </div>
              </div>
            </div>

            {/* Sub-tab Switcher & Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                <button
                  className={`btn ${adminSubTab === "users" ? "btn-primary" : ""}`}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  onClick={() => setAdminSubTab("users")}
                >
                  👥 Direktori Pengguna ({users.length})
                </button>
                <button
                  className={`btn ${adminSubTab === "matrix" ? "btn-primary" : ""}`}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  onClick={() => setAdminSubTab("matrix")}
                >
                  🛡️ Matriks Peran & Hak Akses
                </button>
                <button
                  className={`btn ${adminSubTab === "audit" ? "btn-primary" : ""}`}
                  style={{ fontSize: 12, padding: "6px 14px" }}
                  onClick={() => setAdminSubTab("audit")}
                >
                  📜 Audit Trail Forensik ({auditLogs.length})
                </button>
              </div>

              {adminSubTab === "users" && (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: "8px 16px" }}
                  onClick={() => setNewUserModal(true)}
                >
                  + Tambah Pegawai / Dokter Baru
                </button>
              )}

              {adminSubTab === "audit" && (
                <button
                  className="btn btn-cyan"
                  style={{ fontSize: 12, padding: "8px 16px" }}
                  onClick={handleExportAuditCSV}
                >
                  📥 Export Audit Log (CSV)
                </button>
              )}
            </div>

            {/* SUBTAB 1: USER DIRECTORY */}
            {adminSubTab === "users" && (
              <section className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Daftar Pengguna & Tenaga Kesehatan Rumah Sakit</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Pengelolaan kredensial pegawai, unit penugasan, dan aktivasi/deaktivasi akun (*Deprovisioning* seketika).
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="Cari nama, username, NIP, unit..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="input"
                    style={{ maxWidth: 280, fontSize: 12, padding: "6px 12px" }}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Username & Identitas</th>
                        <th>Peran (Role)</th>
                        <th>Unit / Departemen</th>
                        <th>NIP / SIP</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter((u) => {
                          const q = userSearch.toLowerCase();
                          return (
                            !q ||
                            u.username.toLowerCase().includes(q) ||
                            (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                            (u.unit && u.unit.toLowerCase().includes(q)) ||
                            (u.nip && u.nip.toLowerCase().includes(q))
                          );
                        })
                        .map((u) => {
                          const roleColor =
                            u.role === "ADMIN"
                              ? "#c084fc"
                              : u.role === "DOKTER"
                                ? "#38bdf8"
                                : u.role === "FARMASI"
                                  ? "#4ade80"
                                  : u.role === "KASIR"
                                    ? "#fbbf24"
                                    : u.role === "PERAWAT"
                                      ? "#2dd4bf"
                                      : "#67e8f9";
                          return (
                            <tr key={u.username}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: "50%",
                                      background: "rgba(255,255,255,0.06)",
                                      border: "1px solid var(--border)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 700,
                                      fontSize: 12,
                                      color: roleColor,
                                    }}
                                  >
                                    {u.full_name ? u.full_name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name || u.username}</div>
                                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>@{u.username}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: `${roleColor}22`,
                                    color: roleColor,
                                    border: `1px solid ${roleColor}66`,
                                    fontWeight: 700,
                                  }}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td style={{ fontSize: 12 }}>{u.unit || "-"}</td>
                              <td className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{u.nip || "-"}</td>
                              <td>
                                <span className={`badge ${u.active ? "" : "badge-amber"}`} style={{ fontSize: 11 }}>
                                  {u.active ? "● AKTIF" : "○ SUSPENDED"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn"
                                  style={{
                                    fontSize: 11,
                                    padding: "4px 10px",
                                    color: u.active ? "#f87171" : "#4ade80",
                                    borderColor: u.active ? "#7f1d1d" : "#14532d",
                                  }}
                                  onClick={() => handleToggleUserStatus(u.username)}
                                  title={u.active ? "Tangguhkan akses login staf ini" : "Aktifkan kembali akses staf"}
                                >
                                  {u.active ? "Tangguhkan" : "Aktifkan"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SUBTAB 2: ROLE PERMISSION MATRIX */}
            {adminSubTab === "matrix" && (
              <section className="card">
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Matriks Hak Akses & Kewenangan Peran (RBAC Matrix)</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Pemisahan tugas (*Separation of Duties*) dan prinsip *Need-to-Know Basis* yang ter-enforce otomatis di backend API.
                  </p>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Modul & Fungsionalitas Klinis</th>
                        <th style={{ textAlign: "center" }}>DOKTER</th>
                        <th style={{ textAlign: "center" }}>PERAWAT</th>
                        <th style={{ textAlign: "center" }}>FARMASI</th>
                        <th style={{ textAlign: "center" }}>KASIR</th>
                        <th style={{ textAlign: "center" }}>ADMISI</th>
                        <th style={{ textAlign: "center" }}>ADMIN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Admisi & Registrasi Pasien</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Input NIK, No. RM, kunjungan poli/IGD</span></td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Rekam Medis (RME SOAP) - Baca</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Riwayat alergi, keluhan, diagnosa pasien</span></td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Rekam Medis (RME SOAP) - Tulis</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Input SOAP, asesmen klinis, diagnosa ICD-10</span></td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Order Resep Elektronik (e-Prescription)</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Pemilihan obat KFA, dosis, dan signa</span></td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Dispensing & Mutasi Stok Obat</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Verifikasi resep, penyerahan obat & potongan stok</span></td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Order Pemeriksaan Radiologi</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Permintaan rontgen/CT/MRI via HL7 ORM</span></td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Peluncuran PACS Diagnostic Viewer</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Buka citra DICOM dengan Study-Scoped SSO Token</span></td>
                        <td style={{ textAlign: "center" }}>✅ (Scoped)</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅ (Full)</td>
                      </tr>
                      <tr>
                        <td><strong>Penerbitan SEP BPJS & Kasir Billing</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Simulasi VClaim, INA-CBG & pelunasan kasir</span></td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                      <tr>
                        <td><strong>Manajemen Pengguna & Audit Trail</strong><br /><span style={{ fontSize: 11, color: "var(--muted)" }}>Kelola akun, reset password, inspeksi log UU PDP</span></td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>❌</td>
                        <td style={{ textAlign: "center" }}>✅</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SUBTAB 3: FORENSIC AUDIT TRAIL */}
            {adminSubTab === "audit" && (
              <section className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Live Forensik Audit Trail (Immutable Security Logs)</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      Catatan otomatis (*append-only*) atas setiap tindakan akses medis sesuai Permenkes No. 24/2022 Pasal 27.
                    </p>
                  </div>
                  <input
                    type="text"
                    placeholder="Filter aktor, aksi, No. RM, atau detail..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="input"
                    style={{ maxWidth: 280, fontSize: 12, padding: "6px 12px" }}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Waktu (UTC)</th>
                        <th>Petugas / Aktor</th>
                        <th>Aksi</th>
                        <th>Tipe Target</th>
                        <th>ID / No. RM</th>
                        <th>Keterangan Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs
                        .filter((a) => {
                          const q = auditSearch.toLowerCase();
                          return (
                            !q ||
                            a.actor.toLowerCase().includes(q) ||
                            a.action.toLowerCase().includes(q) ||
                            (a.resource_type && a.resource_type.toLowerCase().includes(q)) ||
                            (a.resource_id && a.resource_id.toLowerCase().includes(q)) ||
                            (a.detail && a.detail.toLowerCase().includes(q))
                          );
                        })
                        .map((a) => {
                          const isSecurity = a.action === "LOGIN" || a.action === "CREATE_USER" || a.action === "TOGGLE_USER_STATUS";
                          const isMedical = a.action === "CREATE_SOAP" || a.action === "VIEW_RME" || a.action === "LAUNCH_PACS";
                          return (
                            <tr key={a.id}>
                              <td className="mono" style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                                {new Date(a.created_at).toLocaleString("id-ID")}
                              </td>
                              <td>
                                <span className="mono" style={{ fontWeight: 700, color: "#38bdf8" }}>
                                  @{a.actor}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: isSecurity ? "rgba(168, 85, 247, 0.2)" : isMedical ? "rgba(56, 189, 248, 0.2)" : "rgba(34, 197, 94, 0.2)",
                                    color: isSecurity ? "#c084fc" : isMedical ? "#38bdf8" : "#4ade80",
                                    fontSize: 11,
                                  }}
                                >
                                  {a.action}
                                </span>
                              </td>
                              <td className="mono" style={{ fontSize: 11 }}>{a.resource_type}</td>
                              <td className="mono" style={{ fontWeight: 600 }}>{a.resource_id || "-"}</td>
                              <td style={{ fontSize: 12, color: "var(--muted)" }}>{a.detail}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* MODAL: TAMBAH PEGAWAI / DOKTER BARU */}
            {newUserModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                  padding: 20,
                }}
              >
                <div
                  className="card"
                  style={{
                    width: "100%",
                    maxWidth: 480,
                    background: "#0f172a",
                    border: "1px solid #334155",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Tambah Akun Pegawai / Tenaga Medis</h3>
                    <button
                      className="btn"
                      style={{ padding: "4px 8px", fontSize: 12 }}
                      onClick={() => setNewUserModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                        Nama Lengkap & Gelar *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: dr. Amanda Kartika, Sp.PD"
                        value={newUserForm.full_name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                          Username *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="amanda"
                          value={newUserForm.username}
                          onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={newUserForm.password}
                          onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                          Peran (Role) *
                        </label>
                        <select
                          value={newUserForm.role}
                          onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                          className="input"
                          style={{ width: "100%" }}
                        >
                          <option value="DOKTER">DOKTER (Klinis & SOAP)</option>
                          <option value="PERAWAT">PERAWAT (Asuhan & Rawat)</option>
                          <option value="FARMASI">FARMASI (Resep & Obat)</option>
                          <option value="KASIR">KASIR (Billing & BPJS)</option>
                          <option value="ADMISI">ADMISI (Pendaftaran)</option>
                          <option value="ADMIN">ADMIN (Superuser IT)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                          NIP / SIP Tenaga Medis
                        </label>
                        <input
                          type="text"
                          placeholder="198902142014022001"
                          value={newUserForm.nip}
                          onChange={(e) => setNewUserForm({ ...newUserForm, nip: e.target.value })}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                        Unit Kerja / Penugasan Poliklinik *
                      </label>
                      <select
                        value={newUserForm.unit}
                        onChange={(e) => setNewUserForm({ ...newUserForm, unit: e.target.value })}
                        className="input"
                        style={{ width: "100%" }}
                      >
                        {clinics.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name} — {c.specialty} ({c.room_number})
                          </option>
                        ))}
                        <option value="Instalasi Radiologi">Instalasi Radiologi & Imaging</option>
                        <option value="Farmasi Rawat Jalan">Farmasi Rawat Jalan & Gudang Obat</option>
                        <option value="Kasir & BPJS">Loket Kasir, Billing & SEP BPJS</option>
                        <option value="Admisi & Registrasi">Admisi & Pendaftaran Pasien</option>
                        <option value="Instalasi TI & SIMRS">Instalasi TI & SIMRS</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setNewUserModal(false)}
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                      >
                        Simpan Akun
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: EXECUTIVE COMMAND CENTER */}
        {tab === "executive" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header / Intro */}
            <section className="card" style={{ background: "linear-gradient(180deg, rgba(225, 29, 72, 0.08) 0%, rgba(15, 23, 42, 0.5) 100%)", border: "1px solid rgba(225, 29, 72, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
                    <span>📊 Executive Command Center & Hospital Intelligence</span>
                    <span className="badge badge-red" style={{ fontSize: 11 }}>Direksi & Manajemen RS</span>
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Monitoring indikator efisiensi rawat inap Barber-Johnson, performa finansial arus kas, dan SLA waktu tunggu pelayanan per departemen.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => loadAll()} style={{ fontSize: 12, padding: "6px 12px" }}>
                    🔄 Refresh Data
                  </button>
                </div>
              </div>
            </section>

            {/* Barber-Johnson Efficiency Indicators */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>BOR (Bed Occupancy Rate)</span>
                  <span className="badge badge-green" style={{ fontSize: 10 }}>Optimal</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#10b981" }}>
                  {executiveMetrics?.bor ?? 78.5}%
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Target Kemenkes RI: <strong>60% - 85%</strong> (Pemanfaatan bed rawat inap sangat ideal)
                </div>
              </div>

              <div className="card" style={{ borderLeft: "4px solid #06b6d4" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>ALOS (Avg Length of Stay)</span>
                  <span className="badge badge-cyan" style={{ fontSize: 10 }}>Efisien</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#06b6d4" }}>
                  {executiveMetrics?.alos ?? 4.2} <span style={{ fontSize: 14 }}>Hari</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Standar Mutu: <strong>3 - 6 Hari</strong> (Kendali mutu & biaya INA-CBG optimal)
                </div>
              </div>

              <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>TOI (Turn Over Interval)</span>
                  <span className="badge badge-amber" style={{ fontSize: 10 }}>Produktif</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#f59e0b" }}>
                  {executiveMetrics?.toi ?? 1.8} <span style={{ fontSize: 14 }}>Hari</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Standar Kemenkes: <strong>1 - 3 Hari</strong> (Jeda bed kosong sebelum terisi pasien baru)
                </div>
              </div>

              <div className="card" style={{ borderLeft: "4px solid #8b5cf6" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>BTO (Bed Turn Over)</span>
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>Efektif</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#8b5cf6" }}>
                  {executiveMetrics?.bto ?? 42} <span style={{ fontSize: 14 }}>x / bed / thn</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Standar Kemenkes: <strong>40 - 50 kali</strong> per tempat tidur setahun
                </div>
              </div>
            </div>

            {/* Financial Revenue Breakdown & SLA Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
              {/* Financial Breakdown */}
              <div className="card">
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>💰 Komposisi Pendapatan Rumah Sakit (Bulan Berjalan)</span>
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>Klaim BPJS Kesehatan</span>
                      <strong style={{ color: "#38bdf8" }}>{formatIDR(executiveMetrics?.revenue_bpjs ?? 1450000000)}</strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ width: "70%", background: "#38bdf8", height: "100%" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>Pasien Umum / Tunai (Cash & QRIS)</span>
                      <strong style={{ color: "#34d399" }}>{formatIDR(executiveMetrics?.revenue_cash ?? 380000000)}</strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ width: "19%", background: "#34d399", height: "100%" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>Asuransi Komersial & Korporasi</span>
                      <strong style={{ color: "#f59e0b" }}>{formatIDR(executiveMetrics?.revenue_insurance ?? 220000000)}</strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ width: "11%", background: "#f59e0b", height: "100%" }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Estimasi Pendapatan:</span>
                    <strong style={{ fontSize: 16, color: "#f8fafc" }}>
                      {formatIDR((executiveMetrics?.revenue_bpjs ?? 1450000000) + (executiveMetrics?.revenue_cash ?? 380000000) + (executiveMetrics?.revenue_insurance ?? 220000000))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* SLA & Waktu Tunggu */}
              <div className="card">
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>⏱️ Service Level Agreement (SLA) Waktu Tunggu Pasien</span>
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Loket Admisi & Pendaftaran</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Standar SPM: &lt; 15 menit</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{executiveMetrics?.avg_wait_admission_min ?? 12} Menit</div>
                      <span className="badge badge-green" style={{ fontSize: 10 }}>Sesuai Standar</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Antrean Konsultasi Poliklinik Dokter</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Standar SPM: &lt; 30 menit</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{executiveMetrics?.avg_wait_clinic_min ?? 18} Menit</div>
                      <span className="badge badge-green" style={{ fontSize: 10 }}>Sesuai Standar</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Penyiapan & Telaah Resep Farmasi</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Standar SPM: &lt; 30 menit non-racikan</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{executiveMetrics?.avg_wait_pharmacy_min ?? 22} Menit</div>
                      <span className="badge badge-green" style={{ fontSize: 10 }}>Sesuai Standar</span>
                    </div>
                  </div>

                  <div style={{ padding: "8px 12px", background: "rgba(56, 189, 248, 0.05)", borderRadius: 6, border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Tingkat Persetujuan Klaim BPJS</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Bebas pending & dispute INA-CBG</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#38bdf8" }}>
                      {executiveMetrics?.claim_approval_rate ?? 96.4}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: SDM & KREDENSIAL MEDIS */}
        {tab === "hrd" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header */}
            <section className="card" style={{ background: "linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 23, 42, 0.5) 100%)", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
                    <span>👥 Workstation SDM, HRD & Kredensial Tenaga Medis</span>
                    <span className="badge badge-purple" style={{ fontSize: 11 }}>Komite Medik & Keperawatan</span>
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Monitoring masa berlaku Surat Tanda Registrasi (STR), Surat Izin Praktik (SIP), Buku Putih Kewenangan Klinis (SPK/RKK), dan kepatuhan akreditasi STARKES KARS.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => loadAll()} style={{ fontSize: 12, padding: "6px 12px" }}>
                    🔄 Refresh Data
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div className="card">
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Total Tenaga Medis Terdaftar</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{staffCredentials.length || 6} Staf</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Dokter Spesialis, Umum, Apoteker, Perawat</div>
              </div>
              <div className="card" style={{ borderLeft: "4px solid #ef4444" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>STR / SIP Expired &lt; 60 Hari</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#ef4444" }}>1 Staf</div>
                <div style={{ fontSize: 11, color: "#fca5a5" }}>Peringatan Dini: Perlu Rekomendasi OP</div>
              </div>
              <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>SPK / RKK Terverifikasi</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#10b981" }}>100%</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Buku Putih Komite Medik Lengkap</div>
              </div>
              <div className="card" style={{ borderLeft: "4px solid #38bdf8" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Kepatuhan UU Tenaga Kesehatan</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#38bdf8" }}>Compliant</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>UU No. 17/2023 tentang Kesehatan</div>
              </div>
            </div>

            {/* Staff Credentials Table */}
            <section className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>📋 Matriks Kredensial & Masa Berlaku STR/SIP</h4>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Menampilkan {staffCredentials.length} Tenaga Kesehatan</div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama Tenaga Medis & NIP</th>
                      <th>Peran / Profesi</th>
                      <th>Spesialisasi & Unit</th>
                      <th>No. STR & Kedaluwarsa</th>
                      <th>No. SIP & Kedaluwarsa</th>
                      <th>Kewenangan Klinis (SPK/RKK)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffCredentials.map((c) => {
                      const isNearExp = c.str_expiry_date.includes("2026-12") || c.sip_expiry_date.includes("2026-12");
                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }} className="mono">NIP: {c.nip}</div>
                          </td>
                          <td>
                            <span className="badge badge-blue">{c.role}</span>
                          </td>
                          <td>{c.specialty}</td>
                          <td>
                            <div className="mono" style={{ fontSize: 12 }}>{c.str_number}</div>
                            <div style={{ fontSize: 11, color: isNearExp ? "#ef4444" : "var(--muted)", fontWeight: isNearExp ? 700 : 400 }}>
                              Exp: {c.str_expiry_date} {isNearExp && "⚠️ Segera Berakhir"}
                            </div>
                          </td>
                          <td>
                            <div className="mono" style={{ fontSize: 12 }}>{c.sip_number}</div>
                            <div style={{ fontSize: 11, color: isNearExp ? "#ef4444" : "var(--muted)", fontWeight: isNearExp ? 700 : 400 }}>
                              Exp: {c.sip_expiry_date}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-green" style={{ fontSize: 11 }}>
                              {c.clinical_privilege}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-cyan">{c.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
