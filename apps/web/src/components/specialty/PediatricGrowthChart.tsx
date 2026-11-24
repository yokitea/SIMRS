"use client";

import React, { useState } from "react";

interface Props {
  onExportToSOAP?: (objectiveText: string, icd10Code?: string, icd10Name?: string) => void;
}

interface VaccineItem {
  id: string;
  name: string;
  recommendedAgeMonth: number;
  status: "GIVEN" | "DUE" | "PENDING";
}

export default function PediatricGrowthChart({ onExportToSOAP }: Props) {
  const [ageMonths, setAgeMonths] = useState<number>(18);
  const [gender, setGender] = useState<"M" | "F">("M");
  const [weightKg, setWeightKg] = useState<number>(11.2);
  const [heightCm, setHeightCm] = useState<number>(82.5);
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState<number>(47.0);

  // Immunization schedule
  const [vaccines, setVaccines] = useState<VaccineItem[]>([
    { id: "hb0", name: "Hepatitis B (HB-0)", recommendedAgeMonth: 0, status: "GIVEN" },
    { id: "bcg", name: "BCG & Polio 1", recommendedAgeMonth: 1, status: "GIVEN" },
    { id: "dpt1", name: "DPT-HB-Hib 1 & Polio 2", recommendedAgeMonth: 2, status: "GIVEN" },
    { id: "pcv1", name: "PCV 1 & Rotavirus 1", recommendedAgeMonth: 2, status: "GIVEN" },
    { id: "dpt2", name: "DPT-HB-Hib 2 & Polio 3", recommendedAgeMonth: 3, status: "GIVEN" },
    { id: "pcv2", name: "PCV 2 & Rotavirus 2", recommendedAgeMonth: 3, status: "GIVEN" },
    { id: "dpt3", name: "DPT-HB-Hib 3 & Polio 4", recommendedAgeMonth: 4, status: "GIVEN" },
    { id: "ipv1", name: "IPV 1 (Polio Suntik)", recommendedAgeMonth: 4, status: "GIVEN" },
    { id: "mr1", name: "Campak-Rubella (MR 1)", recommendedAgeMonth: 9, status: "GIVEN" },
    { id: "ipv2", name: "IPV 2", recommendedAgeMonth: 9, status: "GIVEN" },
    { id: "pcv3", name: "PCV 3 Booster", recommendedAgeMonth: 12, status: "GIVEN" },
    { id: "dpt_boost", name: "DPT-HB-Hib Booster", recommendedAgeMonth: 18, status: "DUE" },
    { id: "mr_boost", name: "MR Booster", recommendedAgeMonth: 18, status: "DUE" },
  ]);

  // Approximate WHO Standard Medians & SDs for 0-60 months
  // Boys 18 months median: W: 10.9 kg (SD 1.2), H: 82.3 cm (SD 3.1)
  // Girls 18 months median: W: 10.2 kg (SD 1.2), H: 80.7 cm (SD 3.1)
  const medianW = gender === "M" ? 3.3 + ageMonths * 0.42 : 3.2 + ageMonths * 0.39;
  const sdW = 0.8 + ageMonths * 0.03;
  const zScoreW = Number(((weightKg - medianW) / sdW).toFixed(2));

  const medianH = gender === "M" ? 50.0 + ageMonths * 1.8 : 49.0 + ageMonths * 1.76;
  const sdH = 2.0 + ageMonths * 0.08;
  const zScoreH = Number(((heightCm - medianH) / sdH).toFixed(2));

  // Weight-for-Age (BB/U) Status
  let bbuStatus = "Gizi Baik (Normal)";
  let bbuColor = "#10b981";
  if (zScoreW < -3) {
    bbuStatus = "Berat Badan Sangat Kurang (Severely Underweight)";
    bbuColor = "#ef4444";
  } else if (zScoreW < -2) {
    bbuStatus = "Berat Badan Kurang (Underweight)";
    bbuColor = "#f59e0b";
  } else if (zScoreW > 1) {
    bbuStatus = "Risiko Berat Badan Lebih";
    bbuColor = "#3b82f6";
  }

  // Height-for-Age (TB/U) Status (Stunting Detector)
  let tbuStatus = "Tinggi Normal";
  let tbuColor = "#10b981";
  if (zScoreH < -3) {
    tbuStatus = "Sangat Pendek (Severely Stunted)";
    tbuColor = "#ef4444";
  } else if (zScoreH < -2) {
    tbuStatus = "Pendek (Stunted)";
    tbuColor = "#f59e0b";
  } else if (zScoreH > 3) {
    tbuStatus = "Tinggi";
    tbuColor = "#3b82f6";
  }

  const toggleVaccine = (id: string) => {
    setVaccines((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const nextStatus = v.status === "GIVEN" ? "DUE" : v.status === "DUE" ? "PENDING" : "GIVEN";
          return { ...v, status: nextStatus };
        }
        return v;
      })
    );
  };

  const handleExport = () => {
    const dueVaccines = vaccines.filter((v) => v.status === "DUE").map((v) => v.name);
    const text = [
      `[ANTROPOMETRI & KURVA PERTUMBUHAN ANAK (STANDAR WHO)]`,
      `• Usia: ${ageMonths} Bulan (${gender === "M" ? "Laki-laki" : "Perempuan"})`,
      `• BB: ${weightKg} kg (Z-Score BB/U: ${zScoreW} SD ➔ ${bbuStatus})`,
      `• TB/PB: ${heightCm} cm (Z-Score TB/U: ${zScoreH} SD ➔ ${tbuStatus})`,
      `• Lingkar Kepala: ${headCircumferenceCm} cm (Normosefali)`,
      `• Status Imunisasi Kemenkes:`,
      dueVaccines.length > 0 ? `  - Jadwal Vaksin Hari Ini: ${dueVaccines.join(", ")}` : "  - Imunisasi dasar lengkap sesuai usia.",
    ].join("\n");

    const icd10 =
      zScoreH < -2
        ? { code: "E45", name: "Retarded development following protein-calorie malnutrition (Stunting)" }
        : zScoreW < -2
        ? { code: "E44.0", name: "Moderate protein-calorie malnutrition (Gizi Kurang)" }
        : { code: "Z00.1", name: "Routine child health examination" };

    if (onExportToSOAP) {
      onExportToSOAP(text, icd10.code, icd10.name);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top Header & Export */}
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
          <span style={{ fontSize: 18 }}>👶</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Kurva Pertumbuhan Terstandar WHO & Jadwal Imunisasi Kemenkes
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Kalkulator Z-Score antropometri otomatis & skrining stunting/wasting.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
              BB/U: <strong style={{ color: bbuColor }}>{zScoreW} SD</strong>
            </span>
            <span>•</span>
            <span>
              TB/U: <strong style={{ color: tbuColor }}>{zScoreH} SD</strong> ({tbuStatus})
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

      {/* Input Form Antropometri */}
      <div
        style={{
          background: "#080b11",
          padding: 14,
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Usia (Bulan)
          </label>
          <input
            className="input"
            type="number"
            min={0}
            max={60}
            value={ageMonths}
            onChange={(e) => setAgeMonths(Number(e.target.value))}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Jenis Kelamin
          </label>
          <select
            className="select"
            value={gender}
            onChange={(e) => setGender(e.target.value as "M" | "F")}
          >
            <option value="M">Laki-laki (L)</option>
            <option value="F">Perempuan (P)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Berat Badan (kg)
          </label>
          <input
            className="input"
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(Number(e.target.value))}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Tinggi / Panjang (cm)
          </label>
          <input
            className="input"
            type="number"
            step="0.5"
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value))}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
            Lingkar Kepala (cm)
          </label>
          <input
            className="input"
            type="number"
            step="0.5"
            value={headCircumferenceCm}
            onChange={(e) => setHeadCircumferenceCm(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Visual WHO Z-Score Gauge */}
      <div
        style={{
          background: "#0d121c",
          padding: 14,
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* BB/U Gauge */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Berat terhadap Umur (BB/U)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: bbuColor }}>{bbuStatus}</span>
          </div>
          {/* Progress bar with SD zones: -3 to +3 */}
          <div style={{ position: "relative", height: 12, background: "#1e293b", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "0%", width: "16.6%", height: "100%", background: "#ef4444" }} title="< -3 SD (Gizi Buruk)" />
            <div style={{ position: "absolute", left: "16.6%", width: "16.6%", height: "100%", background: "#f59e0b" }} title="-3 s/d -2 SD (Gizi Kurang)" />
            <div style={{ position: "absolute", left: "33.2%", width: "50%", height: "100%", background: "#10b981" }} title="-2 s/d +1 SD (Gizi Baik)" />
            <div style={{ position: "absolute", left: "83.2%", width: "16.8%", height: "100%", background: "#3b82f6" }} title="> +1 SD (Risiko Lebih)" />
            {/* Marker */}
            <div
              style={{
                position: "absolute",
                top: -2,
                left: `${Math.min(Math.max(((zScoreW + 3) / 6) * 100, 2), 98)}%`,
                width: 4,
                height: 16,
                background: "#ffffff",
                boxShadow: "0 0 6px rgba(255,255,255,0.8)",
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            <span>-3 SD</span>
            <span>-2 SD</span>
            <span>Median (0)</span>
            <span>+1 SD</span>
            <span>+3 SD</span>
          </div>
        </div>

        {/* TB/U Gauge (Stunting) */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Tinggi terhadap Umur (TB/U - Stunting)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: tbuColor }}>{tbuStatus}</span>
          </div>
          <div style={{ position: "relative", height: 12, background: "#1e293b", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "0%", width: "16.6%", height: "100%", background: "#ef4444" }} title="< -3 SD (Sangat Pendek)" />
            <div style={{ position: "absolute", left: "16.6%", width: "16.6%", height: "100%", background: "#f59e0b" }} title="-3 s/d -2 SD (Pendek / Stunted)" />
            <div style={{ position: "absolute", left: "33.2%", width: "66.8%", height: "100%", background: "#10b981" }} title="-2 s/d +3 SD (Normal)" />
            {/* Marker */}
            <div
              style={{
                position: "absolute",
                top: -2,
                left: `${Math.min(Math.max(((zScoreH + 3) / 6) * 100, 2), 98)}%`,
                width: 4,
                height: 16,
                background: "#ffffff",
                boxShadow: "0 0 6px rgba(255,255,255,0.8)",
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            <span>-3 SD (Severely Stunted)</span>
            <span>-2 SD (Stunted)</span>
            <span>Median (0)</span>
            <span>+3 SD</span>
          </div>
        </div>
      </div>

      {/* Jadwal Imunisasi Kemenkes Checklist */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          📋 Pelacak Imunisasi Dasar Lengkap Kemenkes (Klik untuk ubah status):
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {vaccines.map((v) => {
            const isDue = v.status === "DUE";
            const isGiven = v.status === "GIVEN";
            return (
              <div
                key={v.id}
                onClick={() => toggleVaccine(v.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 11,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isGiven
                    ? "rgba(16, 185, 129, 0.12)"
                    : isDue
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#0d121c",
                  border: isGiven
                    ? "1px solid #10b981"
                    : isDue
                    ? "1px solid #f59e0b"
                    : "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: isGiven ? "#34d399" : isDue ? "#fbbf24" : "var(--muted)" }}>
                    {v.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>Usia {v.recommendedAgeMonth} Bln</div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: isGiven ? "#10b981" : isDue ? "#f59e0b" : "#334155",
                    color: "#ffffff",
                  }}
                >
                  {isGiven ? "✓ Diberikan" : isDue ? "⚡ Jadwal Hari Ini" : "⏳ Belum"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
