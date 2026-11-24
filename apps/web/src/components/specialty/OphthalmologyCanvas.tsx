"use client";

import React, { useState } from "react";

interface Props {
  onExportToSOAP?: (objectiveText: string, icd10Code?: string, icd10Name?: string) => void;
}

export default function OphthalmologyCanvas({ onExportToSOAP }: Props) {
  // Visus Naturalis
  const [visusOD, setVisusOD] = useState<string>("6/18");
  const [visusOS, setVisusOS] = useState<string>("6/24");

  // Refraction Correction (OD)
  const [sphOD, setSphOD] = useState<string>("-1.50");
  const [cylOD, setCylOD] = useState<string>("-0.50");
  const [axisOD, setAxisOD] = useState<string>("90");
  const [addOD, setAddOD] = useState<string>("+1.50");

  // Refraction Correction (OS)
  const [sphOS, setSphOS] = useState<string>("-2.00");
  const [cylOS, setCylOS] = useState<string>("-0.75");
  const [axisOS, setAxisOS] = useState<string>("85");
  const [addOS, setAddOS] = useState<string>("+1.50");

  const [pdMm, setPdMm] = useState<string>("62");

  // Intraocular Pressure (TIO in mmHg)
  const [tioOD, setTioOD] = useState<number>(16);
  const [tioOS, setTioOS] = useState<number>(17);

  // Slit Lamp / Lens
  const [lensStatus, setLensStatus] = useState<string>("Jernih (Clear)");

  // Glaucoma check
  const isHighTioOD = tioOD > 21;
  const isHighTioOS = tioOS > 21;
  const hasGlaucomaRisk = isHighTioOD || isHighTioOS;

  const handleExport = () => {
    const text = [
      `[PEMERIKSAAN OFTALMOLOGI / POLI MATA]`,
      `• Visus Naturalis: OD ${visusOD} | OS ${visusOS}`,
      `• Koreksi Kacamata (Refraksi):`,
      `  - OD: S ${sphOD} C ${cylOD} x ${axisOD}° (Add ${addOD}) ➔ Visus 6/6`,
      `  - OS: S ${sphOS} C ${cylOS} x ${axisOS}° (Add ${addOS}) ➔ Visus 6/6`,
      `  - Jarak Pupil (PD): ${pdMm} mm`,
      `• Tekanan Intraokular (TIO Tonometri):`,
      `  - OD: ${tioOD} mmHg ${isHighTioOD ? "(⚠️ Di atas normal > 21 mmHg)" : "(Normal)"}`,
      `  - OS: ${tioOS} mmHg ${isHighTioOS ? "(⚠️ Di atas normal > 21 mmHg)" : "(Normal)"}`,
      `• Segmen Anterior & Lensa: ${lensStatus}`,
      hasGlaucomaRisk ? `• Peringatan: Waspada Suspek Glaukoma Sudut Terbuka / Hipertensi Okular.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const icd10 = hasGlaucomaRisk
      ? { code: "H40.0", name: "Glaucoma suspect (Hipertensi Okular)" }
      : lensStatus.includes("Katarak")
      ? { code: "H25.9", name: "Senile cataract, unspecified" }
      : cylOD !== "0.00" || cylOS !== "0.00"
      ? { code: "H52.2", name: "Astigmatism" }
      : { code: "H52.1", name: "Myopia" };

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
          <span style={{ fontSize: 18 }}>👁️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              Skema Refraksi Visus (OD / OS) & Tekanan Intraokular (TIO)
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              Pemeriksaan tajam penglihatan Snellen, resep kacamata & tonometri glaukoma.
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
              Visus: <strong>OD {visusOD} / OS {visusOS}</strong>
            </span>
            <span>•</span>
            <span>
              TIO:{" "}
              <strong style={{ color: hasGlaucomaRisk ? "#ef4444" : "#10b981" }}>
                {tioOD} / {tioOS} mmHg
              </strong>
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

      {/* Visus & Tonometri Section */}
      <div
        style={{
          background: "#080b11",
          padding: 14,
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* Mata Kanan (Oculus Dexter / OD) */}
        <div
          style={{
            background: "#0d121c",
            padding: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)", display: "flex", justifyContent: "space-between" }}>
            <span>Oculus Dexter (Mata Kanan / OD)</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Normal: 6/6</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 2 }}>
                Visus Naturalis
              </label>
              <select
                className="select"
                value={visusOD}
                onChange={(e) => setVisusOD(e.target.value)}
              >
                {["6/6", "6/7.5", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "3/60", "1/300", "1/~", "0 (No Light)"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 2 }}>
                TIO Tonometri (mmHg)
              </label>
              <input
                className="input"
                type="number"
                value={tioOD}
                onChange={(e) => setTioOD(Number(e.target.value))}
                style={{
                  borderColor: isHighTioOD ? "#ef4444" : undefined,
                  color: isHighTioOD ? "#ef4444" : undefined,
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Koreksi Refraksi Kacamata (OD):</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            <input className="input" placeholder="Sph" value={sphOD} onChange={(e) => setSphOD(e.target.value)} title="Sferis" />
            <input className="input" placeholder="Cyl" value={cylOD} onChange={(e) => setCylOD(e.target.value)} title="Silinder" />
            <input className="input" placeholder="Axis" value={axisOD} onChange={(e) => setAxisOD(e.target.value)} title="Axis (0-180)" />
            <input className="input" placeholder="Add" value={addOD} onChange={(e) => setAddOD(e.target.value)} title="Addisi Baca" />
          </div>
        </div>

        {/* Mata Kiri (Oculus Sinister / OS) */}
        <div
          style={{
            background: "#0d121c",
            padding: 12,
            borderRadius: 6,
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)", display: "flex", justifyContent: "space-between" }}>
            <span>Oculus Sinister (Mata Kiri / OS)</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Normal: 6/6</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 2 }}>
                Visus Naturalis
              </label>
              <select
                className="select"
                value={visusOS}
                onChange={(e) => setVisusOS(e.target.value)}
              >
                {["6/6", "6/7.5", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "3/60", "1/300", "1/~", "0 (No Light)"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 2 }}>
                TIO Tonometri (mmHg)
              </label>
              <input
                className="input"
                type="number"
                value={tioOS}
                onChange={(e) => setTioOS(Number(e.target.value))}
                style={{
                  borderColor: isHighTioOS ? "#ef4444" : undefined,
                  color: isHighTioOS ? "#ef4444" : undefined,
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Koreksi Refraksi Kacamata (OS):</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            <input className="input" placeholder="Sph" value={sphOS} onChange={(e) => setSphOS(e.target.value)} title="Sferis" />
            <input className="input" placeholder="Cyl" value={cylOS} onChange={(e) => setCylOS(e.target.value)} title="Silinder" />
            <input className="input" placeholder="Axis" value={axisOS} onChange={(e) => setAxisOS(e.target.value)} title="Axis (0-180)" />
            <input className="input" placeholder="Add" value={addOS} onChange={(e) => setAddOS(e.target.value)} title="Addisi Baca" />
          </div>
        </div>
      </div>

      {/* Slit Lamp & Lens Details */}
      <div
        style={{
          background: "#0d121c",
          padding: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
            Pupil Distance (PD):
          </label>
          <input
            className="input"
            style={{ width: 80, height: 30, fontSize: 12 }}
            value={pdMm}
            onChange={(e) => setPdMm(e.target.value)}
          />
          <span style={{ fontSize: 11, color: "var(--muted)" }}>mm</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, maxWidth: 450 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
            Status Lensa (Katarak):
          </label>
          <select
            className="select"
            value={lensStatus}
            onChange={(e) => setLensStatus(e.target.value)}
          >
            <option value="Jernih (Clear)">Jernih / Transparan (Normal)</option>
            <option value="Katarak Imatur (Kekeruhan Sebagian)">Katarak Imatur (Kekeruhan Sebagian)</option>
            <option value="Katarak Matur (Kekeruhan Total / Fundus Tak Tampak)">Katarak Matur (Kekeruhan Total)</option>
            <option value="Pseudofakia (IOL Pasca Operasi)">Pseudofakia (Intraocular Lens / Pasca Fako)</option>
            <option value="Afakia (Tanpa Lensa)">Afakia (Tanpa Lensa)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
