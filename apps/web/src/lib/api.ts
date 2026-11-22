export const SIMRS_API_URL =
  process.env.NEXT_PUBLIC_SIMRS_API_URL || "http://localhost:8090";

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

export function formatIDR(n: number): string {
  return "Rp " + (n || 0).toLocaleString("id-ID");
}
