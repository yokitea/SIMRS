export const SIMRS_API_URL =
  process.env.NEXT_PUBLIC_SIMRS_API_URL || "";

export const PACS_VIEWER_URL =
  process.env.NEXT_PUBLIC_PACS_VIEWER_URL || "http://localhost:3001/viewer";

export const RIS_URL =
  process.env.NEXT_PUBLIC_RIS_URL || "http://localhost:3000";

export const BRAND_CONFIG = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Core SIMRS",
  subtitle:
    process.env.NEXT_PUBLIC_BRAND_SUBTITLE ||
    "Hospital Information System • RME • BPJS • SATUSEHAT",
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO || "",
};

export interface Patient {
  id: string;
  no_rm: string;
  nik: string;
  bpjs_number: string;
  ihs_number: string;
  full_name: string;
  birth_date: string;
  sex: string;
  phone: string;
  mother_name?: string;
  address: string;
}

export interface Visit {
  id: string;
  visit_number: string;
  queue_number: string;
  patient_id: string;
  patient_no_rm: string;
  patient_name: string;
  service_type: "RJ" | "IGD" | "RI";
  unit_name: string;
  doctor_name: string;
  triage_level?: string;
  bed_id?: string;
  payment_type: string;
  sep_number?: string;
  inacbg_code?: string;
  inacbg_tariff?: number;
  status: string;
  satusehat_encounter_id: string;
}

export interface ClinicUnit {
  code: string;
  name: string;
  specialty: string;
  bpjs_poli_code: string;
  room_number: string;
  floor: string;
  default_doctor: string;
  doctor_list: string[];
  operating_hours: string;
}

export interface Bed {
  id: string;
  ward_name: string;
  room_code: string;
  care_class: string;
  daily_rate: number;
  status: string;
  current_visit_id?: string;
  current_patient_name?: string;
}

export interface SOAPNote {
  id: string;
  visit_id: string;
  author_name: string;
  subjective: string;
  objective: string;
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature: number;
  resp_rate: number;
  spo2: number;
  icd10_code: string;
  icd10_name: string;
  assessment: string;
  plan: string;
  created_at: string;
}

export interface RadiologyOrder {
  id: string;
  visit_id: string;
  patient_no_rm: string;
  patient_name: string;
  accession_number: string;
  study_instance_uid: string;
  modality: string;
  procedure_name: string;
  clinical_note: string;
  status: string;
  ris_sync_status: string;
  report_status?: string;
  radiologist_name?: string;
  report_text?: string;
  price: number;
}

export interface Medication {
  id: string;
  kfa_code: string;
  name: string;
  unit: string;
  stock: number;
  unit_price: number;
}

export interface Prescription {
  id: string;
  rx_number: string;
  visit_id: string;
  patient_no_rm: string;
  patient_name: string;
  doctor_name: string;
  medication_name: string;
  kfa_code: string;
  qty: number;
  dosage: string;
  total_price: number;
  status: string;
}

export interface BillingItem {
  id: string;
  visit_id: string;
  category: string;
  description: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  paid: boolean;
}

export interface OutboxItem {
  id: string;
  target: string;
  event_type: string;
  reference_id: string;
  payload: string;
  status: string;
  last_error?: string;
  created_at: string;
}

export interface DashboardData {
  stats: {
    total_patients: number;
    active_visits_rj: number;
    active_visits_igd: number;
    active_visits_ri: number;
    beds_available: number;
    beds_occupied: number;
    pending_rx: number;
    radiology_orders: number;
    unpaid_revenue: number;
    paid_revenue: number;
    outbox_count: number;
  };
  system: {
    brand: string;
    hospital: string;
    ris_hl7_addr: string;
    pacs_viewer_url: string;
    satusehat_env: string;
  };
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("simrs_jwt") || "";
}

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const tok = getToken();
  return {
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    ...(extra || {}),
  };
}

export interface UserItem {
  username: string;
  role: string;
  full_name: string;
  unit: string;
  nip: string;
  active: boolean;
}

export interface AuditLogItem {
  id: number;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  detail: string;
  created_at: string;
}

export function formatIDR(n: number): string {
  return "Rp " + (n || 0).toLocaleString("id-ID");
}

export interface ExecutiveMetrics {
  bor: number;
  alos: number;
  toi: number;
  bto: number;
  revenue_bpjs: number;
  revenue_cash: number;
  revenue_insurance: number;
  avg_wait_admission_min: number;
  avg_wait_clinic_min: number;
  avg_wait_pharmacy_min: number;
  claim_approval_rate: number;
}

export interface StaffCredential {
  id: string;
  full_name: string;
  role: string;
  specialty: string;
  nip: string;
  str_number: string;
  str_expiry_date: string;
  sip_number: string;
  sip_expiry_date: string;
  clinical_privilege: string;
  status: string;
}

export interface MedicalAsset {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  location: string;
  brand_model: string;
  serial_number: string;
  last_calibration: string;
  next_calibration: string;
  calibration_status: string;
  ppm_interval_days: number;
}

export interface UtilityTelemetry {
  id: string;
  system_name: string;
  category: string;
  location: string;
  metric_label: string;
  current_value: string;
  threshold_info: string;
  backup_stock: string;
  status: string;
  updated_at: string;
}

export interface IPALGreaseSensor {
  id: string;
  zone_name: string;
  sensor_type: string;
  level_pct: number;
  ph_value: number;
  temp_c: number;
  status: string;
  last_cleaned_at: string;
  notes: string;
}

export interface WorkOrderIPSRS {
  id: string;
  ticket_no: string;
  asset_or_zone: string;
  issue_type: string;
  priority: string;
  technician: string;
  status: string;
  notes: string;
  created_at: string;
}

export interface IPSRSOverview {
  assets: MedicalAsset[];
  utilities: UtilityTelemetry[];
  ipal_sensors: IPALGreaseSensor[];
  work_orders: WorkOrderIPSRS[];
}

export interface NutritionOrder {
  id: string;
  patient_name: string;
  ward_room: string;
  diet_type: string;
  meal_slot: string;
  allergies: string;
  calories_kcal: number;
  status: string;
  updated_at: string;
}

export interface CSSDSterilizationBatch {
  id: string;
  batch_no: string;
  set_name: string;
  unit_origin: string;
  method: string;
  temp_c: number;
  pressure_bar: number;
  bio_indicator: string;
  status: string;
  expires_at: string;
}

export interface AmbulanceUnit {
  id: string;
  plate_no: string;
  unit_name: string;
  type: string;
  driver_name: string;
  paramedic_name: string;
  status: string;
  current_mission: string;
  fuel_pct: number;
  oxygen_bar: number;
}

export interface ParkingGateStatus {
  id: string;
  zone_name: string;
  vehicle_type: string;
  total_slots: number;
  occupied_slots: number;
  gate_status: string;
  daily_revenue: number;
}

export interface OpsOverview {
  nutrition_orders: NutritionOrder[];
  cssd_batches: CSSDSterilizationBatch[];
  ambulances: AmbulanceUnit[];
  parking_zones: ParkingGateStatus[];
}

export type WorkstationType =
  | "CLINIC"
  | "PHARMACY"
  | "BILLING"
  | "ADMISSION"
  | "RANAP"
  | "EXECUTIVE"
  | "HRD"
  | "IPSRS"
  | "OPS"
  | "ADMIN";

export interface WorkstationMeta {
  id: WorkstationType;
  title: string;
  department: string;
  badge: string;
  icon: string;
  description: string;
  allowedRoles: string[];
}

export const WORKSTATIONS: Record<WorkstationType, WorkstationMeta> = {
  CLINIC: {
    id: "CLINIC",
    title: "Workstation Dokter & Poliklinik",
    department: "Pelayanan Medis Rawat Jalan",
    badge: "DPJP Clinical Station",
    icon: "🩺",
    description: "Antrean terfilter per poli, Rekam Medis Elektronik (RME CPPT/SOAP), dan Order Penunjang RIS/PACS.",
    allowedRoles: ["DOKTER", "ADMIN"],
  },
  PHARMACY: {
    id: "PHARMACY",
    title: "Workstation Farmasi & Apotek",
    department: "Instalasi Farmasi & Depo Obat",
    badge: "Pharmacy Dispensing",
    icon: "💊",
    description: "Antrean e-resep masuk, telaah 3 pilar (administrasi, farmasetik, klinis), dan pemotongan stok obat KFA.",
    allowedRoles: ["FARMASI", "ADMIN"],
  },
  BILLING: {
    id: "BILLING",
    title: "Workstation Kasir & Keuangan",
    department: "Bagian Keuangan & Kasir RS",
    badge: "Cashier & Billing POS",
    icon: "💳",
    description: "Point-of-Sale kasir terpadu (tindakan, jasa medis, obat, radiologi), bridging klaim BPJS, dan kwitansi resmi.",
    allowedRoles: ["KASIR", "ADMIN"],
  },
  ADMISSION: {
    id: "ADMISSION",
    title: "Workstation Admisi & Registrasi",
    department: "Front Office & Rekam Medis",
    badge: "Patient Admission & EMPI",
    icon: "📋",
    description: "Pencarian multi-parameter EMPI, registrasi pasien baru, direktori poliklinik, dan penerbitan SEP BPJS.",
    allowedRoles: ["ADMISI", "ADMIN"],
  },
  RANAP: {
    id: "RANAP",
    title: "Workstation Rawat Inap & Bangsal",
    department: "Instalasi Rawat Inap & ICU",
    badge: "Inpatient Ward & Bed Mgmt",
    icon: "🛏️",
    description: "Status tempat tidur bangsal real-time, monitoring BOR, observasi TTV, dan pemulangan pasien.",
    allowedRoles: ["PERAWAT", "DOKTER", "ADMIN"],
  },
  EXECUTIVE: {
    id: "EXECUTIVE",
    title: "Executive Command Center",
    department: "Direksi & Manajemen Rumah Sakit",
    badge: "Hospital Intelligence",
    icon: "📊",
    description: "Grafik efisiensi Barber-Johnson (BOR/ALOS/TOI/BTO), arus kas pendapatan harian, dan SLA waktu tunggu pelayanan.",
    allowedRoles: ["DIREKSI", "ADMIN"],
  },
  HRD: {
    id: "HRD",
    title: "Workstation SDM & Kredensial Medis",
    department: "Bagian SDM & Komite Medik",
    badge: "Staff Credentialing & STR/SIP",
    icon: "👥",
    description: "Early Warning System masa berlaku STR/SIP dokter & perawat, database SPK/RKK (Buku Putih), dan roster jaga.",
    allowedRoles: ["HRD", "ADMIN"],
  },
  IPSRS: {
    id: "IPSRS",
    title: "Workstation IPSRS, Kalibrasi & IPAL IoT",
    department: "Instalasi Pemeliharaan Sarana RS & Sanitasi",
    badge: "MFK, Utility & IPAL Telemetry",
    icon: "🔧",
    description: "Kalibrasi alat kesehatan (Permenkes 40/2022), gas medis sentral & tabung O2 cadangan, HVAC, Genset, serta sensor grease trap IPAL.",
    allowedRoles: ["IPSRS", "DIREKSI", "ADMIN"],
  },
  OPS: {
    id: "OPS",
    title: "Workstation Gizi, CSSD, Ambulans & Parkir",
    department: "Instalasi Gizi, Sterilisasi & Transportasi RS",
    badge: "Hospital Support & Logistics",
    icon: "🚑",
    description: "Distribusi diet gizi pasien rawat inap, pelacakan batch sterilisasi CSSD, dispatch armada ambulans, dan okupansi gerbang parkir RS.",
    allowedRoles: ["OPS", "DIREKSI", "ADMIN"],
  },
  ADMIN: {
    id: "ADMIN",
    title: "Workstation Administrator IT & IAM",
    department: "Instalasi Teknologi Informasi & SIMRS",
    badge: "IT Security & System Control",
    icon: "🔐",
    description: "Manajemen identitas pengguna (IAM), RBAC, interactive audit trail, dan telemetri integrasi RIS/PACS & SATUSEHAT.",
    allowedRoles: ["ADMIN"],
  },
};

export function getAllowedWorkstations(role: string): WorkstationType[] {
  const r = (role || "").toUpperCase();
  if (r === "ADMIN") {
    return ["CLINIC", "PHARMACY", "BILLING", "ADMISSION", "RANAP", "EXECUTIVE", "HRD", "IPSRS", "OPS", "ADMIN"];
  }
  return (Object.keys(WORKSTATIONS) as WorkstationType[]).filter((key) =>
    WORKSTATIONS[key].allowedRoles.includes(r)
  );
}

export function getDefaultWorkstation(
  role: string,
  unit: string
): { ws: WorkstationType; tab: string; defaultPoli?: string } {
  const r = (role || "").toUpperCase();
  const u = (unit || "").toLowerCase();
  if (r === "DOKTER") {
    let poli = "ALL";
    if (u.includes("gigi")) poli = "Poli Gigi & Mulut";
    else if (u.includes("saraf")) poli = "Poli Saraf";
    else if (u.includes("anak")) poli = "Poli Anak";
    else if (u.includes("umum")) poli = "Poli Umum";
    else if (u.includes("penyakit dalam")) poli = "Poli Penyakit Dalam";
    else if (u.includes("jantung")) poli = "Poli Jantung & Pembuluh Darah";
    else if (u.includes("mata")) poli = "Poli Mata";
    return { ws: "CLINIC", tab: "rme", defaultPoli: poli };
  }
  if (r === "FARMASI") return { ws: "PHARMACY", tab: "farmasi" };
  if (r === "KASIR") return { ws: "BILLING", tab: "kasir" };
  if (r === "ADMISI") return { ws: "ADMISSION", tab: "admisi" };
  if (r === "PERAWAT") return { ws: "RANAP", tab: "ranap" };
  if (r === "DIREKSI") return { ws: "EXECUTIVE", tab: "executive" };
  if (r === "HRD") return { ws: "HRD", tab: "hrd" };
  if (r === "IPSRS") return { ws: "IPSRS", tab: "ipsrs" };
  if (r === "OPS") return { ws: "OPS", tab: "ops" };
  return { ws: "ADMIN", tab: "admin" };
}

