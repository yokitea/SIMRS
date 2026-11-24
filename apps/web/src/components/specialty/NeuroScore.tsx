"use client";

import React, { useState } from "react";

interface Props {
  onExportToSOAP?: (objectiveText: string, icd10Code?: string, icd10Name?: string) => void;
}

export default function NeuroScore({ onExportToSOAP }: Props) {
  // GCS State
  const [gcsEye, setGcsEye] = useState<number>(4);
  const [gcsVerbal, setGcsVerbal] = useState<number>(5);
  const [gcsMotor, setGcsMotor] = useState<number>(6);

  // NIHSS State
  const [nihss1a, setNihss1a] = useState<number>(0); // LOC
  const [nihss1b, setNihss1b] = useState<number>(0); // LOC Questions
  const [nihss1c, setNihss1c] = useState<number>(0); // LOC Commands
  const [nihss2, setNihss2] = useState<number>(0);   // Gaze
  const [nihss3, setNihss3] = useState<number>(0);   // Visual
  const [nihss4, setNihss4] = useState<number>(1);   // Facial palsy (minor)
  const [nihss5a, setNihss5a] = useState<number>(0); // Motor Arm Left
  const [nihss5b, setNihss5b] = useState<number>(1); // Motor Arm Right (drift)
  const [nihss6a, setNihss6a] = useState<number>(0); // Motor Leg Left
  const [nihss6b, setNihss6b] = useState<number>(0); // Motor Leg Right
  const [nihss7, setNihss7] = useState<number>(0);   // Ataxia
  const [nihss8, setNihss8] = useState<number>(0);   // Sensory
  const [nihss9, setNihss9] = useState<number>(0);   // Language
  const [nihss10, setNihss10] = useState<number>(1); // Dysarthria (mild)
  const [nihss11, setNihss11] = useState<number>(0); // Inattention

  // Active Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<"gcs" | "nihss">("gcs");

  // GCS Calculation
  const totalGCS = gcsEye + gcsVerbal + gcsMotor;
  let gcsCategory = "Compos Mentis";
  let gcsColor = "#10b981";
  if (totalGCS <= 3) {
    gcsCategory = "Koma (Coma)";
    gcsColor = "#ef4444";
  } else if (totalGCS <= 8) {
    gcsCategory = "Sopor / Koma Ringan";
    gcsColor = "#f97316";
  } else if (totalGCS <= 11) {
    gcsCategory = "Somnolen";
    gcsColor = "#f59e0b";
  } else if (totalGCS <= 13) {
    gcsCategory = "Apatis";
    gcsColor = "#3b82f6";
  }

  // NIHSS Calculation
  const totalNIHSS =
    nihss1a +
    nihss1b +
    nihss1c +
    nihss2 +
    nihss3 +
    nihss4 +
    nihss5a +
    nihss5b +
    nihss6a +
    nihss6b +
    nihss7 +
    nihss8 +
    nihss9 +
    nihss10 +
    nihss11;

  let strokeSeverity = "Normal / Tidak Ada Defisit";
  let strokeColor = "#10b981";
  let rtPARecommendation = "";

  if (totalNIHSS >= 21) {
    strokeSeverity = "Stroke Berat (Severe Stroke)";
    strokeColor = "#ef4444";
    rtPARecommendation = "⚠️ Risiko tinggi transformasi hemoragik bila rtPA diberikan tanpa pertimbangan cermat.";
  } else if (totalNIHSS >= 16) {
    strokeSeverity = "Stroke Sedang-Berat (Moderate to Severe Stroke)";
    strokeColor = "#f97316";
    rtPARecommendation = "⚡ Indikasi evaluasi cepat trombektomi mekanik / rtPA bila onset < 4.5 jam.";
  } else if (totalNIHSS >= 5) {
    strokeSeverity = "Stroke Sedang (Moderate Stroke)";
    strokeColor = "#f59e0b";
    rtPARecommendation = "🎯 Jendela Emas Trombolisis rtPA (Alteplase) terbuka bila onset < 4.5 jam!";
  } else if (totalNIHSS >= 1) {
    strokeSeverity = "Stroke Ringan (Minor Stroke)";
    strokeColor = "#06b6d4";
    rtPARecommendation = "Evaluasi DAPT (Aspirin + Clopidogrel) untuk pencegahan sekunder.";
  }

  const handleExport = () => {
    const text = [
      `[SKORING NEUROLOGI & STROKE]`,
      `• Glasgow Coma Scale (GCS): E${gcsEye} V${gcsVerbal} M${gcsMotor} = ${totalGCS}/15 (${gcsCategory})`,
      `• NIHSS Stroke Scale: ${totalNIHSS}/42 (${strokeSeverity})`,
      `  - Paresis Wajah: Skor ${nihss4}`,
      `  - Motorik Lengan: Ka ${nihss5b} | Ki ${nihss5a}`,
      `  - Motorik Tungkai: Ka ${nihss6b} | Ki ${nihss6a}`,
      `  - Disartria / Pelo: Skor ${nihss10}`,
      rtPARecommendation ? `• Rekomendasi Klinis: ${rtPARecommendation}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const icd10 =
      totalNIHSS >= 1
        ? { code: "I63.9", name: "Cerebral infarction, unspecified (Stroke Iskemik Akut)" }
        : { code: "R40.2", name: "Coma, unspecified / Altered level of consciousness" };

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
          <span style={{ fontSize: 18 }}>🧠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Skoring Neurologi: GCS & NIHSS Stroke Scale
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Kalkulator otomatis kesadaran & skala keparahan stroke iskemik akut.
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
              GCS: <strong style={{ color: gcsColor }}>{totalGCS}/15</strong> ({gcsCategory})
            </span>
            <span>•</span>
            <span>
              NIHSS: <strong style={{ color: strokeColor }}>{totalNIHSS}/42</strong> ({strokeSeverity.split(" ")[0]})
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

      {/* Sub-tab Switcher */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("gcs")}
          style={{
            fontSize: 12,
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 700,
            background: activeSubTab === "gcs" ? "var(--panel-2)" : "transparent",
            color: activeSubTab === "gcs" ? "var(--cyan)" : "var(--muted)",
            border: activeSubTab === "gcs" ? "1px solid var(--cyan)" : "1px solid var(--border)",
          }}
        >
          👁️ Glasgow Coma Scale (GCS)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("nihss")}
          style={{
            fontSize: 12,
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 700,
            background: activeSubTab === "nihss" ? "var(--panel-2)" : "transparent",
            color: activeSubTab === "nihss" ? "var(--cyan)" : "var(--muted)",
            border: activeSubTab === "nihss" ? "1px solid var(--cyan)" : "1px solid var(--border)",
          }}
        >
          ⚡ NIHSS Stroke Scale ({totalNIHSS} Poin)
        </button>
      </div>

      {/* GCS TAB */}
      {activeSubTab === "gcs" && (
        <div
          style={{
            background: "#080b11",
            padding: 16,
            borderRadius: 8,
            border: "1px solid var(--border)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
          }}
        >
          {/* Eye Response */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}>
              1. Respon Membuka Mata (Eye / E)
            </div>
            {[
              { score: 4, label: "4 - Spontan (Normal)" },
              { score: 3, label: "3 - Terhadap Perintah Suara" },
              { score: 2, label: "2 - Terhadap Rangsang Nyeri" },
              { score: 1, label: "1 - Tidak Ada Respon" },
            ].map((opt) => (
              <label
                key={opt.score}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: gcsEye === opt.score ? "rgba(6, 182, 212, 0.15)" : "#0d121c",
                  border: gcsEye === opt.score ? "1px solid var(--cyan)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="gcsEye"
                  checked={gcsEye === opt.score}
                  onChange={() => setGcsEye(opt.score)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Verbal Response */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}>
              2. Respon Verbal (Verbal / V)
            </div>
            {[
              { score: 5, label: "5 - Terorientasi Baik (Normal)" },
              { score: 4, label: "4 - Bingung / Disorientasi" },
              { score: 3, label: "3 - Kata-kata Tidak Tepat" },
              { score: 2, label: "2 - Suara Mengerang (Incomprehensible)" },
              { score: 1, label: "1 - Tidak Ada Respon Verbal" },
            ].map((opt) => (
              <label
                key={opt.score}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: gcsVerbal === opt.score ? "rgba(6, 182, 212, 0.15)" : "#0d121c",
                  border: gcsVerbal === opt.score ? "1px solid var(--cyan)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="gcsVerbal"
                  checked={gcsVerbal === opt.score}
                  onChange={() => setGcsVerbal(opt.score)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Motor Response */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}>
              3. Respon Motorik (Motor / M)
            </div>
            {[
              { score: 6, label: "6 - Mematuhi Perintah (Normal)" },
              { score: 5, label: "5 - Melokalisasi Rangsang Nyeri" },
              { score: 4, label: "4 - Fleksi Menghindar (Normal Flexion)" },
              { score: 3, label: "3 - Fleksi Abnormal (Dekortikasi)" },
              { score: 2, label: "2 - Ekstensi Abnormal (Deserebrasi)" },
              { score: 1, label: "1 - Tidak Ada Respon Motorik" },
            ].map((opt) => (
              <label
                key={opt.score}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: gcsMotor === opt.score ? "rgba(6, 182, 212, 0.15)" : "#0d121c",
                  border: gcsMotor === opt.score ? "1px solid var(--cyan)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="gcsMotor"
                  checked={gcsMotor === opt.score}
                  onChange={() => setGcsMotor(opt.score)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* NIHSS TAB */}
      {activeSubTab === "nihss" && (
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
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 6,
              fontSize: 12,
              color: "#fbbf24",
            }}
          >
            <strong>Status Stroke: {strokeSeverity} ({totalNIHSS} Poin)</strong> — {rtPARecommendation}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {/* 1a LOC */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                1a. Tingkat Kesadaran (LOC)
              </label>
              <select
                className="select"
                value={nihss1a}
                onChange={(e) => setNihss1a(Number(e.target.value))}
              >
                <option value={0}>0 - Sadar penuh, waspada</option>
                <option value={1}>1 - Somnolen, bangun dengan stimulasi minor</option>
                <option value={2}>2 - Stupor, butuh stimulasi nyeri berulang</option>
                <option value={3}>3 - Koma / Respon motorik refleks saja</option>
              </select>
            </div>

            {/* 4 Facial Palsy */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                4. Paresis Wajah (Bibir / Pipi / Senyum)
              </label>
              <select
                className="select"
                value={nihss4}
                onChange={(e) => setNihss4(Number(e.target.value))}
              >
                <option value={0}>0 - Simetris / Gerakan normal</option>
                <option value={1}>1 - Paresis minor (asimetri lipatan nasolabial saat senyum)</option>
                <option value={2}>2 - Paresis parsial (wajah bawah lumpuh total/nyata)</option>
                <option value={3}>3 - Paresis komplit satu atau kedua sisi</option>
              </select>
            </div>

            {/* 5a Motor Arm Left */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                5a. Motorik Lengan Kiri (Angkat 10 Detik)
              </label>
              <select
                className="select"
                value={nihss5a}
                onChange={(e) => setNihss5a(Number(e.target.value))}
              >
                <option value={0}>0 - Tanpa drift, tahan 10 detik penuh</option>
                <option value={1}>1 - Drift (lengan turun sebelum 10 detik, tak sampai sentuh ranjang)</option>
                <option value={2}>2 - Jatuh ke ranjang sebelum 10 detik namun ada usaha melawan gravitasi</option>
                <option value={3}>3 - Tak mampu lawan gravitasi (hanya geser)</option>
                <option value={4}>4 - Paralisis total / Tak ada gerakan</option>
              </select>
            </div>

            {/* 5b Motor Arm Right */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                5b. Motorik Lengan Kanan (Angkat 10 Detik)
              </label>
              <select
                className="select"
                value={nihss5b}
                onChange={(e) => setNihss5b(Number(e.target.value))}
              >
                <option value={0}>0 - Tanpa drift, tahan 10 detik penuh</option>
                <option value={1}>1 - Drift (lengan turun sebelum 10 detik)</option>
                <option value={2}>2 - Jatuh ke ranjang sebelum 10 detik</option>
                <option value={3}>3 - Tak mampu lawan gravitasi</option>
                <option value={4}>4 - Paralisis total</option>
              </select>
            </div>

            {/* 10 Dysarthria */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                10. Disartria / Artikulasi Kata (Pelo)
              </label>
              <select
                className="select"
                value={nihss10}
                onChange={(e) => setNihss10(Number(e.target.value))}
              >
                <option value={0}>0 - Artikulasi normal</option>
                <option value={1}>1 - Ringan hingga sedang (kata pelo tapi masih dimengerti)</option>
                <option value={2}>2 - Berat (bicara sangat pelo / anartria tidak dapat dipahami)</option>
              </select>
            </div>

            {/* 9 Best Language */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                9. Bahasa / Afasia (Menamai Benda & Membaca)
              </label>
              <select
                className="select"
                value={nihss9}
                onChange={(e) => setNihss9(Number(e.target.value))}
              >
                <option value={0}>0 - Tidak ada afasia (normal)</option>
                <option value={1}>1 - Afasia ringan - sedang (masih dapat berkomunikasi)</option>
                <option value={2}>2 - Afasia berat (komunikasi sangat terbatas / terfragmentasi)</option>
                <option value={3}>3 - Afasia global / Bisu total</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
