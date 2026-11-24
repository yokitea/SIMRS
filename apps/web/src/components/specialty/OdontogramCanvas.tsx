"use client";

import React, { useState } from "react";

export type ToothCondition =
  | "SOUND" // Sehat
  | "CAR"   // Karies (Berlubang)
  | "AMF"   // Tambalan Amalgam / Komposit
  | "MIS"   // Gigi Hilang (Missing)
  | "RCT"   // Perawatan Saluran Akar (Endodontik)
  | "CRN"   // Mahkota Tiruan (Crown)
  | "IMP"   // Impaksi (Gigi Tertanam)
  | "RAD";  // Sisa Akar (Radix)

export interface ToothData {
  id: number; // 11-18, 21-28, 31-38, 41-48
  condition: ToothCondition;
  surfaces: {
    occlusal?: ToothCondition;
    mesial?: ToothCondition;
    distal?: ToothCondition;
    buccal?: ToothCondition;
    lingual?: ToothCondition;
  };
  note?: string;
}

const CONDITION_META: Record<
  ToothCondition,
  { label: string; color: string; badge: string; icd10?: { code: string; name: string } }
> = {
  SOUND: { label: "Sehat / Normal", color: "#10b981", badge: "✓ Sound" },
  CAR: { label: "Karies Dentin", color: "#ef4444", badge: "● Karies", icd10: { code: "K02.1", name: "Caries of dentine" } },
  AMF: { label: "Tambalan (Filled)", color: "#3b82f6", badge: "■ Tumpatan" },
  MIS: { label: "Gigi Hilang (Missing)", color: "#64748b", badge: "✕ Missing", icd10: { code: "K08.1", name: "Loss of teeth due to accident, extraction" } },
  RCT: { label: "Saluran Akar (RCT)", color: "#a855f7", badge: "▲ Endodontik", icd10: { code: "K04.0", name: "Pulpitis / Necrosis of pulp" } },
  CRN: { label: "Mahkota (Crown)", color: "#f59e0b", badge: "◆ Crown" },
  IMP: { label: "Impaksi M3", color: "#f97316", badge: "◎ Impaksi", icd10: { code: "K01.1", name: "Impacted teeth" } },
  RAD: { label: "Sisa Akar (Radix)", color: "#dc2626", badge: "▼ Sisa Akar", icd10: { code: "K08.3", name: "Retained dental root" } },
};

// 32 teeth in FDI order: Maxilla (18-11, 21-28), Mandibula (48-41, 31-38)
const MAXILLA_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const MAXILLA_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const MANDIBLE_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const MANDIBLE_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

interface Props {
  onExportToSOAP?: (objectiveText: string, icd10Code?: string, icd10Name?: string) => void;
}

export default function OdontogramCanvas({ onExportToSOAP }: Props) {
  // Initialize with all sound teeth, except standard demo anomalies
  const [teeth, setTeeth] = useState<Record<number, ToothData>>(() => {
    const init: Record<number, ToothData> = {};
    const all = [...MAXILLA_RIGHT, ...MAXILLA_LEFT, ...MANDIBLE_RIGHT, ...MANDIBLE_LEFT];
    all.forEach((id) => {
      init[id] = { id, condition: "SOUND", surfaces: {} };
    });
    // Set a realistic sample patient odontogram
    init[16] = { id: 16, condition: "CAR", surfaces: { occlusal: "CAR" }, note: "Karies Oklusal profunda" };
    init[24] = { id: 24, condition: "AMF", surfaces: { occlusal: "AMF", mesial: "AMF" }, note: "Restorasi komposit baik" };
    init[36] = { id: 36, condition: "RCT", surfaces: { occlusal: "RCT" }, note: "PSA selesai, evaluasi tumpatan" };
    init[48] = { id: 48, condition: "IMP", surfaces: {}, note: "Impaksi mesioangular" };
    init[46] = { id: 46, condition: "MIS", surfaces: {}, note: "Riwayat ekstraksi 2 tahun lalu" };
    return init;
  });

  const [selectedToothId, setSelectedToothId] = useState<number>(16);
  const [activeTool, setActiveTool] = useState<ToothCondition>("CAR");

  const currentTooth = teeth[selectedToothId] || { id: selectedToothId, condition: "SOUND", surfaces: {} };

  // Calculate DMF-T Index
  // D = Decayed (Karies, Sisa Akar), M = Missing (Hilang), F = Filled (Tambalan, Crown)
  const dCount = Object.values(teeth).filter((t) => t.condition === "CAR" || t.condition === "RAD").length;
  const mCount = Object.values(teeth).filter((t) => t.condition === "MIS").length;
  const fCount = Object.values(teeth).filter((t) => t.condition === "AMF" || t.condition === "CRN").length;
  const dmftTotal = dCount + mCount + fCount;

  const handleApplyCondition = (toothId: number, cond: ToothCondition) => {
    setTeeth((prev) => ({
      ...prev,
      [toothId]: {
        ...prev[toothId],
        condition: cond,
        surfaces: cond === "SOUND" ? {} : prev[toothId].surfaces,
      },
    }));
  };

  const handleExport = () => {
    const abnormalTeeth = Object.values(teeth).filter((t) => t.condition !== "SOUND");
    const summaryLines = abnormalTeeth.map(
      (t) => `• Gigi ${t.id}: ${CONDITION_META[t.condition].label}${t.note ? ` (${t.note})` : ""}`
    );

    const text = [
      `[ODONTOGRAM GIGI & MULUT]`,
      `Indeks DMF-T: ${dmftTotal} (D=${dCount}, M=${mCount}, F=${fCount})`,
      `Temuan Khusus:`,
      summaryLines.length > 0 ? summaryLines.join("\n") : "• Semua gigi dalam batas normal (Sound).",
    ].join("\n");

    const primaryDiagnosis = abnormalTeeth.find((t) => t.condition === "CAR")
      ? CONDITION_META.CAR.icd10
      : abnormalTeeth.find((t) => t.condition === "IMP")
      ? CONDITION_META.IMP.icd10
      : abnormalTeeth.find((t) => t.condition === "RAD")
      ? CONDITION_META.RAD.icd10
      : { code: "K02.9", name: "Dental caries, unspecified" };

    if (onExportToSOAP) {
      onExportToSOAP(text, primaryDiagnosis?.code, primaryDiagnosis?.name);
    }
  };

  const renderToothCell = (id: number) => {
    const data = teeth[id] || { id, condition: "SOUND", surfaces: {} };
    const meta = CONDITION_META[data.condition];
    const isSelected = selectedToothId === id;

    return (
      <div
        key={id}
        onClick={() => {
          setSelectedToothId(id);
          handleApplyCondition(id, activeTool);
        }}
        title={`Gigi ${id}: ${meta.label}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          padding: 4,
          borderRadius: 6,
          background: isSelected ? "rgba(6, 182, 212, 0.2)" : "rgba(255, 255, 255, 0.02)",
          border: isSelected ? "1px solid var(--cyan)" : "1px solid rgba(255, 255, 255, 0.08)",
          transition: "all 0.15s ease",
          minWidth: 38,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? "var(--cyan)" : "var(--muted)", marginBottom: 2 }}>
          {id}
        </div>
        {/* SVG schematic representation of tooth */}
        <svg width="28" height="28" viewBox="0 0 40 40" style={{ overflow: "visible" }}>
          {data.condition === "MIS" ? (
            <g stroke="#ef4444" strokeWidth="4" strokeLinecap="round">
              <line x1="6" y1="6" x2="34" y2="34" />
              <line x1="34" y1="6" x2="6" y2="34" />
            </g>
          ) : (
            <>
              {/* Outer boundary */}
              <rect x="4" y="4" width="32" height="32" rx="4" fill="#182030" stroke="#475569" strokeWidth="1.5" />
              {/* Occlusal / Center */}
              <polygon
                points="12,12 28,12 28,28 12,28"
                fill={data.condition === "CAR" ? "#ef4444" : data.condition === "AMF" ? "#3b82f6" : data.condition === "RCT" ? "#a855f7" : data.condition === "CRN" ? "#f59e0b" : "#243047"}
                stroke="#64748b"
                strokeWidth="1"
              />
              {/* Buccal/Vestibular (top) */}
              <polygon points="4,4 36,4 28,12 12,12" fill={meta.color === "#ef4444" ? "rgba(239, 68, 68, 0.3)" : "none"} stroke="#475569" strokeWidth="1" />
              {/* Lingual/Palatal (bottom) */}
              <polygon points="12,28 28,28 36,36 4,36" fill="none" stroke="#475569" strokeWidth="1" />
              {/* Mesial (left) */}
              <polygon points="4,4 12,12 12,28 4,36" fill="none" stroke="#475569" strokeWidth="1" />
              {/* Distal (right) */}
              <polygon points="36,4 36,36 28,28 28,12" fill="none" stroke="#475569" strokeWidth="1" />
            </>
          )}
        </svg>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: meta.color,
            marginTop: 4,
            whiteSpace: "nowrap",
          }}
        >
          {meta.badge.split(" ")[0]}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top action bar & DMF-T Scoreboard */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          background: "rgba(18, 23, 34, 0.8)",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>🦷</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Odontogram Interaktif 32 Gigi (Notasi Internasional FDI)
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Klik nomor gigi untuk menerapkan patologi atau tindakan dental.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              background: "#0d121c",
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 11,
            }}
          >
            <span>
              <strong>D</strong> (Decayed): <span style={{ color: "#ef4444", fontWeight: 700 }}>{dCount}</span>
            </span>
            <span>•</span>
            <span>
              <strong>M</strong> (Missing): <span style={{ color: "#64748b", fontWeight: 700 }}>{mCount}</span>
            </span>
            <span>•</span>
            <span>
              <strong>F</strong> (Filled): <span style={{ color: "#3b82f6", fontWeight: 700 }}>{fCount}</span>
            </span>
            <span>•</span>
            <span>
              <strong>DMF-T Total:</strong>{" "}
              <span style={{ color: "var(--cyan)", fontWeight: 700 }}>{dmftTotal}</span>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "6px 12px", fontSize: 11 }}
            onClick={handleExport}
          >
            📥 Masukkan ke Catatan O / SOAP
          </button>
        </div>
      </div>

      {/* Pathology / Treatment Palette */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4 }}>Pilih Kondisi:</span>
        {(Object.keys(CONDITION_META) as ToothCondition[]).map((cond) => {
          const m = CONDITION_META[cond];
          const isActive = activeTool === cond;
          return (
            <button
              key={cond}
              type="button"
              onClick={() => {
                setActiveTool(cond);
                if (selectedToothId) {
                  handleApplyCondition(selectedToothId, cond);
                }
              }}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                background: isActive ? m.color : "rgba(255, 255, 255, 0.05)",
                color: isActive ? "#ffffff" : m.color,
                border: `1px solid ${isActive ? m.color : "rgba(255, 255, 255, 0.1)"}`,
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              {m.badge}
            </button>
          );
        })}
      </div>

      {/* Odontogram Grid (Maxilla & Mandible) */}
      <div
        style={{
          background: "#080b11",
          padding: 16,
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Rahang Atas (Maxilla) */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textAlign: "center" }}>
            ─── RAHANG ATAS (MAXILLA) ───
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            {/* Kuadran 1: Kanan Atas (18-11) */}
            <div style={{ display: "flex", gap: 4 }}>{MAXILLA_RIGHT.map(renderToothCell)}</div>
            <div style={{ width: 1, background: "var(--border)", height: 50, margin: "auto 0" }} />
            {/* Kuadran 2: Kiri Atas (21-28) */}
            <div style={{ display: "flex", gap: 4 }}>{MAXILLA_LEFT.map(renderToothCell)}</div>
          </div>
        </div>

        <div style={{ borderBottom: "1px dashed var(--border)", margin: "4px 0" }} />

        {/* Rahang Bawah (Mandibula) */}
        <div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            {/* Kuadran 4: Kanan Bawah (48-41) */}
            <div style={{ display: "flex", gap: 4 }}>{MANDIBLE_RIGHT.map(renderToothCell)}</div>
            <div style={{ width: 1, background: "var(--border)", height: 50, margin: "auto 0" }} />
            {/* Kuadran 3: Kiri Bawah (31-38) */}
            <div style={{ display: "flex", gap: 4 }}>{MANDIBLE_LEFT.map(renderToothCell)}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>
            ─── RAHANG BAWAH (MANDIBULA) ───
          </div>
        </div>
      </div>

      {/* Selected Tooth Detail Editor */}
      <div
        style={{
          background: "#0d121c",
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--cyan)" }}>
            Gigi #{currentTooth.id}
          </div>
          <div style={{ fontSize: 12 }}>
            Kondisi:{" "}
            <span style={{ color: CONDITION_META[currentTooth.condition].color, fontWeight: 700 }}>
              {CONDITION_META[currentTooth.condition].label}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 450 }}>
          <input
            className="input"
            style={{ fontSize: 12, height: 32 }}
            placeholder="Catatan permukaan / tindakan (misal: Karies Oklusal-Distal)..."
            value={currentTooth.note || ""}
            onChange={(e) => {
              const val = e.target.value;
              setTeeth((prev) => ({
                ...prev,
                [currentTooth.id]: {
                  ...prev[currentTooth.id],
                  note: val,
                },
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
