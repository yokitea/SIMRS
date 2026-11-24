"use client";

import React from "react";
import { formatIDR, Prescription } from "@/lib/api";

interface Props {
  rx: Prescription;
  onClose: () => void;
}

export default function MedicationLabelPrinter({ rx, onClose }: Props) {
  const handlePrint = () => {
    window.print();
  };

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
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 20,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏷️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 15 }}>Cetak Etiket Obat (5 Benar)</h3>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Format Standar Akreditasi KARS & Permenkes</div>
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

        {/* Thermal Label Preview (Simulating 80mm x 50mm label) */}
        <div
          id="printable-etiket"
          style={{
            background: "#ffffff",
            color: "#000000",
            padding: 16,
            borderRadius: 6,
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 11,
            lineHeight: 1.35,
            border: "1px dashed #94a3b8",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* Header RS */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #000000", paddingBottom: 6, marginBottom: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 13, textTransform: "uppercase" }}>RS EMC HEALTHCARE JAKARTA</div>
            <div style={{ fontSize: 9 }}>INSTALASI FARMASI RAWAT JALAN</div>
            <div style={{ fontSize: 8 }}>SIP: 503/SIP.FAR/2023 · Telp. (021) 555-8900</div>
          </div>

          {/* Patient Details */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span><strong>No. RM :</strong> {rx.patient_no_rm || "RM-2026-004"}</span>
            <span><strong>Tgl:</strong> {new Date().toLocaleDateString("id-ID")}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
            {rx.patient_name}
          </div>
          <div style={{ fontSize: 10, color: "#334155", marginBottom: 6 }}>
            DPJP: {rx.doctor_name || "dr. Spesialis"}
          </div>

          <div style={{ borderBottom: "1px dashed #475569", margin: "6px 0" }} />

          {/* Medication details */}
          <div style={{ fontWeight: 900, fontSize: 13, margin: "6px 0" }}>
            {rx.medication_name}
          </div>
          <div style={{ fontSize: 10, marginBottom: 4 }}>
            KFA Code: <strong>{rx.kfa_code}</strong> · Jml: <strong>{rx.qty} Unit</strong>
          </div>

          {/* Usage Instruction / Signa */}
          <div
            style={{
              background: "#f1f5f9",
              padding: "6px 8px",
              borderRadius: 4,
              border: "1px solid #cbd5e1",
              margin: "6px 0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.5 }}>
              {rx.dosage}
            </div>
          </div>

          {/* Timing indicators */}
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: 9, margin: "6px 0", fontWeight: 700 }}>
            <span>[✓] PAGI</span>
            <span>[✓] SIANG</span>
            <span>[✓] MALAM</span>
          </div>

          <div style={{ borderBottom: "1px dashed #475569", margin: "6px 0" }} />

          {/* Expire and Barcode */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <div style={{ fontSize: 8 }}>
              <div>ED: <strong>24/11/2027</strong></div>
              <div>BUD: <strong>30 Hari</strong></div>
            </div>
            {/* Simulated Barcode */}
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-block",
                  letterSpacing: 2,
                  fontWeight: 900,
                  fontSize: 16,
                  fontFamily: "monospace",
                }}
              >
                ||| | |||| | |||
              </div>
              <div style={{ fontSize: 8 }}>{rx.rx_number}</div>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 8, marginTop: 4, color: "#64748b" }}>
            SIMPAN DI TEMPAT SEJUK & KERING (&lt; 25°C) · JAUHKAN DARI ANAK
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal / Tutup
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            🖨️ Cetak Etiket Thermal
          </button>
        </div>
      </div>
    </div>
  );
}
