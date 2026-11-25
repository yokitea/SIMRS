"use client";

import React, { useState } from "react";
import { authHeaders, formatIDR, OpsOverview, SIMRS_API_URL } from "@/lib/api";

interface OpsDashboardProps {
  data: OpsOverview | null;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export default function OpsDashboard({ data, onRefresh, onNotify }: OpsDashboardProps) {
  const [subTab, setSubTab] = useState<"gizi" | "cssd" | "ambulans" | "parkir">("gizi");
  const [busyId, setBusyId] = useState("");
  const [missionInput, setMissionInput] = useState<Record<string, string>>({});

  const nutrition = data?.nutrition_orders ?? [];
  const cssd = data?.cssd_batches ?? [];
  const ambulances = data?.ambulances ?? [];
  const parking = data?.parking_zones ?? [];

  const pendingNutrition = nutrition.filter((n) => n.status !== "DITERIMA_PASIEN").length;
  const readyCSSD = cssd.filter((c) => c.status === "STERIL_SIAP_PAKAI").length;
  const standbyAmb = ambulances.filter((a) => a.status === "STANDBY").length;
  const totalParkingRev = parking.reduce((acc, p) => acc + p.daily_revenue, 0);

  async function handleAdvanceNutrition(id: string, patientName: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ops/nutrition/${id}/advance`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Gagal update status diet");
      onNotify(`✅ Status diet ${patientName} diperbarui`);
      onRefresh();
    } catch (err) {
      onNotify(`❌ ${(err as Error).message}`);
    } finally {
      setBusyId("");
    }
  }

  async function handleAdvanceCSSD(id: string, batchNo: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ops/cssd/${id}/advance`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Gagal update status sterilisasi CSSD");
      onNotify(`✅ Batch CSSD ${batchNo} dilanjutkan ke tahap berikutnya`);
      onRefresh();
    } catch (err) {
      onNotify(`❌ ${(err as Error).message}`);
    } finally {
      setBusyId("");
    }
  }

  async function handleDispatchAmbulance(id: string, unitName: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ops/ambulances/${id}/dispatch`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mission: missionInput[id] || "" }),
      });
      if (!res.ok) throw new Error("Gagal dispatch ambulans");
      onNotify(`🚑 Status ${unitName} diperbarui`);
      onRefresh();
    } catch (err) {
      onNotify(`❌ ${(err as Error).message}`);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <section
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.75) 100%)",
          border: "1px solid rgba(16, 185, 129, 0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
              <span>🍽️ Dapur Gizi, CSSD Sterilisasi, Ambulans &amp; Parkir RS</span>
              <span className="badge badge-green" style={{ fontSize: 11 }}>Penunjang Operasional &amp; Logistik</span>
            </h3>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Kontrol distribusi diet pasien (Kemenkes PGRS), sterilisasi instrumen bedah CSSD (indikator biologi spora), dispatch ambulans IGD, dan okupansi parkir RS.
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: 12, padding: "6px 12px" }}>
            🔄 Refresh Data
          </button>
        </div>
      </section>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Dapur Gizi (Sesi Siang)</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: "#34d399" }}>
            {pendingNutrition} <span style={{ fontSize: 13 }}>Porsi Proses</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Total {nutrition.length} order diet rawat inap</div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid #38bdf8" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>CSSD Sterilisasi Instrumen</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: "#38bdf8" }}>
            {readyCSSD}/{cssd.length} <span style={{ fontSize: 13 }}>Siap Pakai</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Lulus uji indikator biologi spora</div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid #f43f5e" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Armada Ambulans RS</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: "#fb7185" }}>
            {standbyAmb}/{ambulances.length} <span style={{ fontSize: 13 }}>Standby</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Siap evakuasi &amp; rujukan 24 jam</div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Pendapatan Parkir Hari Ini</div>
          <div style={{ fontSize: 24, fontWeight: 700, margin: "4px 0", color: "#fbbf24" }}>
            {formatIDR(totalParkingRev)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Integrasi gate otomatis &amp; QRIS</div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`tab-btn ${subTab === "gizi" ? "active" : ""}`} onClick={() => setSubTab("gizi")}>
          🍽️ Dapur Gizi &amp; Diet ({nutrition.length})
        </button>
        <button className={`tab-btn ${subTab === "cssd" ? "active" : ""}`} onClick={() => setSubTab("cssd")}>
          🧪 CSSD Sterilisasi ({cssd.length})
        </button>
        <button className={`tab-btn ${subTab === "ambulans" ? "active" : ""}`} onClick={() => setSubTab("ambulans")}>
          🚑 Armada Ambulans ({ambulances.length})
        </button>
        <button className={`tab-btn ${subTab === "parkir" ? "active" : ""}`} onClick={() => setSubTab("parkir")}>
          🅿️ Parkir RS ({parking.length} Zona)
        </button>
      </div>

      {/* Panel 1: Dapur Gizi */}
      {subTab === "gizi" && (
        <div className="card">
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>🍽️ Daftar Distribusi Diet Pasien Rawat Inap</h4>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Pasien &amp; Bangsal</th>
                  <th>Jenis Diet &amp; Kalori</th>
                  <th>Alergi</th>
                  <th>Jadwal</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {nutrition.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.patient_name}</strong>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{n.ward_room}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{n.diet_type}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{n.calories_kcal} kkal</div>
                    </td>
                    <td>
                      <span className={`badge ${n.allergies !== "Tidak ada" ? "badge-red" : "badge-green"}`} style={{ fontSize: 10 }}>
                        {n.allergies}
                      </span>
                    </td>
                    <td>{n.meal_slot}</td>
                    <td>
                      <span
                        className={`badge ${
                          n.status === "DITERIMA_PASIEN" ? "badge-green" : n.status === "DIANTAR" ? "badge-cyan" : "badge-amber"
                        }`}
                        style={{ fontSize: 10 }}
                      >
                        {n.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      {n.status !== "DITERIMA_PASIEN" ? (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          disabled={busyId === n.id}
                          onClick={() => handleAdvanceNutrition(n.id, n.patient_name)}
                        >
                          {n.status === "DIRACIK" ? "🚚 Kirim ke Bangsal" : "✓ Konfirmasi Diterima"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#34d399" }}>Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel 2: CSSD */}
      {subTab === "cssd" && (
        <div className="card">
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>🧪 Pelacakan Batch Sterilisasi Instrumen Bedah (CSSD)</h4>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>No. Batch</th>
                  <th>Set Instrumen &amp; Unit Asal</th>
                  <th>Metode &amp; Parameter</th>
                  <th>Indikator Biologi</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {cssd.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.batch_no}</strong>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Exp: {c.expires_at}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.set_name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Asal: {c.unit_origin}</div>
                    </td>
                    <td>
                      <div>{c.method}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.temp_c}°C • {c.pressure_bar} Bar</div>
                    </td>
                    <td>
                      <span className={`badge ${c.bio_indicator === "LULUS_SPORA" ? "badge-green" : "badge-amber"}`} style={{ fontSize: 10 }}>
                        {c.bio_indicator.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${c.status === "STERIL_SIAP_PAKAI" ? "badge-green" : "badge-cyan"}`} style={{ fontSize: 10 }}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      {c.status !== "STERIL_SIAP_PAKAI" ? (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          disabled={busyId === c.id}
                          onClick={() => handleAdvanceCSSD(c.id, c.batch_no)}
                        >
                          {c.status === "DEKONTAMINASI" ? "🔥 Masuk Autoclave" : "✓ Lulus Spora & Siap"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#34d399" }}>Siap Distribusi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel 3: Armada Ambulans */}
      {subTab === "ambulans" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 12 }}>
          {ambulances.map((a) => {
            const isStandby = a.status === "STANDBY";
            return (
              <div
                key={a.id}
                className="card"
                style={{ borderLeft: `4px solid ${isStandby ? "#10b981" : "#f43f5e"}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.unit_name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Plat: <strong>{a.plate_no}</strong> • {a.type}</div>
                  </div>
                  <span className={`badge ${isStandby ? "badge-green" : "badge-red"}`} style={{ fontSize: 10 }}>
                    {a.status}
                  </span>
                </div>
                <div style={{ margin: "10px 0", fontSize: 12 }}>
                  <div>Driver: <strong>{a.driver_name}</strong> | Paramedis: <strong>{a.paramedic_name}</strong></div>
                  <div style={{ color: "#cbd5e1", marginTop: 4 }}>📍 Misi: {a.current_mission}</div>
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>
                    ⛽ BBM: <strong>{a.fuel_pct}%</strong> {a.oxygen_bar > 0 ? `• 🫧 O2 Tabung: ${a.oxygen_bar} Bar` : ""}
                  </div>
                </div>
                {isStandby && (
                  <input
                    className="input"
                    style={{ marginBottom: 8, fontSize: 12 }}
                    placeholder="Tujuan / misi penjemputan (opsional)..."
                    value={missionInput[a.id] || ""}
                    onChange={(e) => setMissionInput((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                )}
                <button
                  className={`btn ${isStandby ? "btn-primary" : "btn-secondary"}`}
                  style={{ width: "100%", fontSize: 12 }}
                  disabled={busyId === a.id}
                  onClick={() => handleDispatchAmbulance(a.id, a.unit_name)}
                >
                  {busyId === a.id ? "Memproses..." : isStandby ? "🚨 Berangkatkan (Dispatch)" : "🏠 Tandai Kembali Standby"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel 4: Parkir RS */}
      {subTab === "parkir" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
          {parking.map((p) => {
            const pct = Math.round((p.occupied_slots / p.total_slots) * 100);
            const barColor = pct >= 90 ? "#f43f5e" : pct >= 70 ? "#f59e0b" : "#10b981";
            return (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.zone_name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Tipe: {p.vehicle_type}</div>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: 10 }}>{p.gate_status}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>Kapasitas Terisi</span>
                  <strong>{p.occupied_slots}/{p.total_slots} ({pct}%)</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
                </div>
                <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Pendapatan Gate Hari Ini:</span>
                  <strong style={{ color: "#34d399" }}>{formatIDR(p.daily_revenue)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
