"use client";

import React, { useState } from "react";
import { formatIDR, Prescription } from "@/lib/api";

interface Props {
  rx: Prescription;
  onVerifyAndDispense: (rxId: string) => void;
  onClarify?: (rxId: string, note: string) => Promise<void> | void;
  onClose: () => void;
}

export default function PrescriptionReviewModal({ rx, onVerifyAndDispense, onClarify, onClose }: Props) {
  // Checklist State
  const [adminChecked, setAdminChecked] = useState({
    patientIdentity: true,
    doctorIdentity: true,
    rxDate: true,
  });

  const [pharmChecked, setPharmChecked] = useState({
    dosageForm: true,
    rationalDose: true,
    clearFrequency: true,
    stability: true,
  });

  const [clinicalChecked, setClinicalChecked] = useState({
    appropriateIndication: true,
    noDuplication: true,
    noAllergyContraindication: true,
    noHarmfulInteraction: true,
  });

  const allAdminOk = Object.values(adminChecked).every(Boolean);
  const allPharmOk = Object.values(pharmChecked).every(Boolean);
  const allClinicalOk = Object.values(clinicalChecked).every(Boolean);
  const isFullyVerified = allAdminOk && allPharmOk && allClinicalOk;

  const [reviewNote, setReviewNote] = useState(
    "Telaah resep lengkap sesuai Permenkes 72/2016. Tidak ditemukan polifarmasi maupun interaksi obat mayor."
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 620,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 20,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Pengkajian & Telaah Resep Kemenkes</h3>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Standar Pelayanan Kefarmasian Rumah Sakit (Permenkes No. 72/2016)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Prescription Summary */}
        <div
          style={{
            background: "#0d121c",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>No. Resep & Pasien:</div>
            <div style={{ fontWeight: 700, color: "var(--cyan)" }}>{rx.rx_number}</div>
            <div style={{ fontWeight: 600 }}>{rx.patient_name}</div>
          </div>
          <div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>DPJP & Waktu Resep:</div>
            <div style={{ fontWeight: 600 }}>{rx.doctor_name || "dr. DPJP"}</div>
            <div style={{ color: "var(--muted)" }}>{new Date().toLocaleTimeString("id-ID")} WIB</div>
          </div>
          <div style={{ gridColumn: "1 / -1", paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>Rincian Obat & Dosis Signa:</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>
              {rx.medication_name} — {rx.qty} Unit
            </div>
            <div className="mono" style={{ color: "var(--text)", marginTop: 2 }}>
              KFA {rx.kfa_code} · Aturan: {rx.dosage}
            </div>
          </div>
        </div>

        {/* 3 Pillars of Review */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 1. Kajian Administratif */}
          <div style={{ background: "#080b11", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: allAdminOk ? "#10b981" : "#f59e0b" }}>
                1. Kajian Administratif {allAdminOk ? "✓ Lulus" : "⚠️ Periksa"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={adminChecked.patientIdentity}
                  onChange={(e) => setAdminChecked({ ...adminChecked, patientIdentity: e.target.checked })}
                />
                Identitas pasien lengkap (Nama, No RM, Umur, Berat Badan).
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={adminChecked.doctorIdentity}
                  onChange={(e) => setAdminChecked({ ...adminChecked, doctorIdentity: e.target.checked })}
                />
                Identitas dokter penulis resep lengkap (Nama, SIP DPJP terdaftar).
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={adminChecked.rxDate}
                  onChange={(e) => setAdminChecked({ ...adminChecked, rxDate: e.target.checked })}
                />
                Tanggal penulisan resep dan poliklinik asal jelas.
              </label>
            </div>
          </div>

          {/* 2. Kajian Farmasetik */}
          <div style={{ background: "#080b11", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: allPharmOk ? "#10b981" : "#f59e0b" }}>
                2. Kajian Farmasetik {allPharmOk ? "✓ Lulus" : "⚠️ Periksa"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={pharmChecked.dosageForm}
                  onChange={(e) => setPharmChecked({ ...pharmChecked, dosageForm: e.target.checked })}
                />
                Bentuk sediaan dan kekuatan obat sesuai kondisi pasien.
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={pharmChecked.rationalDose}
                  onChange={(e) => setPharmChecked({ ...pharmChecked, rationalDose: e.target.checked })}
                />
                Dosis dan jumlah obat rasional tidak melampaui batas maksimum harian.
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={pharmChecked.clearFrequency}
                  onChange={(e) => setPharmChecked({ ...pharmChecked, clearFrequency: e.target.checked })}
                />
                Rute dan frekuensi penggunaan obat tertulis jelas (Signa).
              </label>
            </div>
          </div>

          {/* 3. Kajian Klinis */}
          <div style={{ background: "#080b11", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: allClinicalOk ? "#10b981" : "#f59e0b" }}>
                3. Kajian Klinis & Keamanan Obat {allClinicalOk ? "✓ Lulus" : "⚠️ Periksa"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={clinicalChecked.appropriateIndication}
                  onChange={(e) => setClinicalChecked({ ...clinicalChecked, appropriateIndication: e.target.checked })}
                />
                Ketepatan indikasi diagnosis dan dosis obat.
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={clinicalChecked.noDuplication}
                  onChange={(e) => setClinicalChecked({ ...clinicalChecked, noDuplication: e.target.checked })}
                />
                Tidak terdapat duplikasi pengobatan (polifarmasi ganda).
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={clinicalChecked.noAllergyContraindication}
                  onChange={(e) => setClinicalChecked({ ...clinicalChecked, noAllergyContraindication: e.target.checked })}
                />
                Aman dari riwayat alergi obat dan kontraindikasi spesifik pasien.
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={clinicalChecked.noHarmfulInteraction}
                  onChange={(e) => setClinicalChecked({ ...clinicalChecked, noHarmfulInteraction: e.target.checked })}
                />
                Tidak ada interaksi obat bermakna klinis (Major Drug-Drug Interaction).
              </label>
            </div>
          </div>
        </div>

        {/* Pharmacist Note */}
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Catatan Verifikasi Apoteker:
          </label>
          <input
            className="input"
            style={{ fontSize: 12 }}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: "#ef4444" }}
            onClick={async () => {
              if (onClarify) {
                await onClarify(rx.id, reviewNote);
              }
              onClose();
            }}
          >
            ⚠️ Hubungi DPJP (Klarifikasi)
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isFullyVerified}
              onClick={() => {
                onVerifyAndDispense(rx.id);
                onClose();
              }}
            >
              ✓ Lulus Telaah & Serahkan Obat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
