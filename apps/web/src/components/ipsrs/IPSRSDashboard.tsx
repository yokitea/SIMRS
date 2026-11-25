"use client";

import React, { useState } from "react";
import {
  authHeaders,
  IPSRSOverview,
  SIMRS_API_URL,
} from "@/lib/api";

interface IPSRSDashboardProps {
  data: IPSRSOverview | null;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export default function IPSRSDashboard({
  data,
  onRefresh,
  onNotify,
}: IPSRSDashboardProps) {
  const [subTab, setSubTab] = useState<"assets" | "utility" | "ipal" | "wo">("assets");
  const [busyId, setBusyId] = useState<string>("");
  const [woAsset, setWoAsset] = useState("");
  const [woType, setWoType] = useState("PREVENTIVE");
  const [woPriority, setWoPriority] = useState("SEDANG");
  const [woTech, setWoTech] = useState("Tim IPSRS & Elektromedik");
  const [woNotes, setWoNotes] = useState("");

  const assets = data?.assets ?? [];
  const utilities = data?.utilities ?? [];
  const ipalSensors = data?.ipal_sensors ?? [];
  const workOrders = data?.work_orders ?? [];

  const overdueAssets = assets.filter((a) => a.calibration_status !== "LAIK_PAKAI").length;
  const alertUtilities = utilities.filter((u) => u.status !== "NORMAL").length;
  const alertIPAL = ipalSensors.filter((s) => s.status !== "OPTIMAL").length;
  const openWOs = workOrders.filter((w) => w.status !== "RESOLVED").length;

  async function handleCalibrate(id: string, name: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ipsrs/assets/${id}/calibrate`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Gagal mencatat kalibrasi");
      onNotify(`✅ Kalibrasi ${name} tercatat & status LAIK PAKAI diperbarui`);
      onRefresh();
    } catch (err) {
      onNotify(`❌ ${(err as Error).message}`);
    } finally {
      setBusyId("");
    }
  }

  async function handleFlushIPAL(id: string, zoneName: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ipsrs/ipal/${id}/flush`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Gagal reset sensor IPAL");
      onNotify(`✅ ${zoneName} selesai dikuras — sensor level lemak kembali ke 8% (OPTIMAL)`);
      onRefresh();
    } catch (err) {
      onNotify(`❌ ${(err as Error).message}`);
    } finally {
      setBusyId("");
    }
  }

  async function handleCreateWO(e: React.FormEvent) {
    e.preventDefault();
    if (!woAsset.trim()) return;
    setBusyId("CREATE_WO");
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ipsrs/work-orders`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          asset_or_zone: woAsset.trim(),
          issue_type: woType,
          priority: woPriority,
          technician: woTech.trim() || "Tim IPSRS",
          notes: woNotes.trim() || "Tindak lanjut inspeksi lapangan",
        }),
      });
      if (!res.ok) throw new Error("Gagal membuat tiket work order");
      setWoAsset("");
      setWoNotes("");
      onNotify("✅ Tiket Work Order IPSRS berhasil diterbitkan");
      onRefresh();
    } catch (err) {
      onNotify(`❌ ${(err as Error).message}`);
    } finally {
      setBusyId("");
    }
  }

  async function handleUpdateWO(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`${SIMRS_API_URL}/api/v1/ipsrs/work-orders/${id}/status`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Gagal update status tiket");
      onNotify(`✅ Status tiket diperbarui ke ${status}`);
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
          background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.75) 100%)",
          border: "1px solid rgba(245, 158, 11, 0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
              <span>🔧 IPSRS, Kalibrasi Alkes, Gas Medis &amp; IPAL IoT</span>
              <span className="badge badge-amber" style={{ fontSize: 11 }}>Standar KARS MFK &amp; Permenkes 40/2022</span>
            </h3>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Pemeliharaan alat elektromedik, monitoring tangki oksigen sentral &amp; tabung cadangan, HVAC tekanan negatif, genset, serta sensor grease trap IPAL dapur/laundry.
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: 12, padding: "6px 12px" }}>
            🔄 Refresh Telemetri
          </button>
        </div>
      </section>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        <div className="card" style={{ borderLeft: `4px solid ${overdueAssets > 0 ? "#f59e0b" : "#10b981"}` }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Alkes Terdaftar &amp; Kalibrasi</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: overdueAssets > 0 ? "#f59e0b" : "#10b981" }}>
            {assets.length - overdueAssets}/{assets.length} <span style={{ fontSize: 13 }}>Laik Pakai</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {overdueAssets > 0 ? `⚠️ ${overdueAssets} alat butuh kalibrasi / jatuh tempo` : "✅ Semua alat tersertifikasi BPFK"}
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${alertUtilities > 0 ? "#f59e0b" : "#38bdf8"}` }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Utilitas, Gas Medis &amp; HVAC</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: alertUtilities > 0 ? "#f59e0b" : "#38bdf8" }}>
            {utilities.length - alertUtilities}/{utilities.length} <span style={{ fontSize: 13 }}>Normal</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            VIE O2 Sentral + 24 tabung cadangan aktif
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${alertIPAL > 0 ? "#f43f5e" : "#10b981"}` }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Sensor IPAL &amp; Grease Trap</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: alertIPAL > 0 ? "#fb7185" : "#10b981" }}>
            {alertIPAL > 0 ? `${alertIPAL} Alarm` : "Optimal"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {alertIPAL > 0 ? "🚨 Grease Trap Dapur >80% butuh kuras!" : "✅ Semua bak IPAL dalam baku mutu"}
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Work Order Maintenance</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0", color: "#c084fc" }}>
            {openWOs} <span style={{ fontSize: 13 }}>Tiket Aktif</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Total {workOrders.length} tiket tercatat bulan ini
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`tab-btn ${subTab === "assets" ? "active" : ""}`} onClick={() => setSubTab("assets")}>
          🩺 Kalibrasi Alkes ({assets.length})
        </button>
        <button className={`tab-btn ${subTab === "utility" ? "active" : ""}`} onClick={() => setSubTab("utility")}>
          ⚡ Gas Medis, HVAC &amp; Utility ({utilities.length})
        </button>
        <button className={`tab-btn ${subTab === "ipal" ? "active" : ""}`} onClick={() => setSubTab("ipal")}>
          💧 IPAL &amp; Sensor Grease Trap ({ipalSensors.length}) {alertIPAL > 0 ? "🔴" : ""}
        </button>
        <button className={`tab-btn ${subTab === "wo" ? "active" : ""}`} onClick={() => setSubTab("wo")}>
          🛠️ Tiket Work Order ({openWOs})
        </button>
      </div>

      {/* Panel 1: Kalibrasi Alkes */}
      {subTab === "assets" && (
        <div className="card">
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>🩺 Inventaris &amp; Jadwal Kalibrasi Alat Kesehatan (Permenkes 40/2022)</h4>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Kode Aset</th>
                  <th>Nama Alat &amp; Model</th>
                  <th>Lokasi</th>
                  <th>Kalibrasi Terakhir</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const badgeClass =
                    a.calibration_status === "LAIK_PAKAI"
                      ? "badge-green"
                      : a.calibration_status === "MENDEKATI_JATUH_TEMPO"
                      ? "badge-amber"
                      : "badge-red";
                  return (
                    <tr key={a.id}>
                      <td><strong>{a.asset_code}</strong><div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.category}</div></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{a.brand_model} • SN: {a.serial_number}</div>
                      </td>
                      <td>{a.location}</td>
                      <td>{a.last_calibration}</td>
                      <td>{a.next_calibration}</td>
                      <td><span className={`badge ${badgeClass}`} style={{ fontSize: 10 }}>{a.calibration_status.replace(/_/g, " ")}</span></td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          disabled={busyId === a.id}
                          onClick={() => handleCalibrate(a.id, a.name)}
                        >
                          {busyId === a.id ? "Menyimpan..." : "✓ Catat Kalibrasi"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel 2: Utility & Gas Medis */}
      {subTab === "utility" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {utilities.map((u) => {
            const isNormal = u.status === "NORMAL";
            return (
              <div
                key={u.id}
                className="card"
                style={{ borderLeft: `4px solid ${isNormal ? "#38bdf8" : "#f59e0b"}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{u.system_name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.location} • {u.category.replace(/_/g, " ")}</div>
                  </div>
                  <span className={`badge ${isNormal ? "badge-green" : "badge-amber"}`} style={{ fontSize: 10 }}>
                    {u.status}
                  </span>
                </div>
                <div style={{ margin: "10px 0", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.metric_label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: isNormal ? "#38bdf8" : "#fbbf24" }}>{u.current_value}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Ambang Batas: {u.threshold_info}</div>
                </div>
                <div style={{ fontSize: 11.5, color: "#cbd5e1" }}>
                  🔋 Cadangan / Redundansi: <strong>{u.backup_stock}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel 3: IPAL & Grease Trap IoT */}
      {subTab === "ipal" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
          {ipalSensors.map((s) => {
            const isAlert = s.status !== "OPTIMAL";
            const barColor = s.level_pct >= 80 ? "#f43f5e" : s.level_pct >= 60 ? "#f59e0b" : "#10b981";
            return (
              <div
                key={s.id}
                className="card"
                style={{
                  border: isAlert ? "1px solid rgba(244, 63, 94, 0.5)" : undefined,
                  background: isAlert ? "rgba(244, 63, 94, 0.06)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.zone_name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Sensor: {s.sensor_type}</div>
                  </div>
                  <span className={`badge ${isAlert ? "badge-red" : "badge-green"}`} style={{ fontSize: 10 }}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>Level Akumulasi Lemak / Lumpur</span>
                    <strong style={{ color: barColor }}>{s.level_pct}%</strong>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.1)", height: 10, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ width: `${s.level_pct}%`, height: "100%", background: barColor }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14, fontSize: 12, marginBottom: 8 }}>
                  <span>pH: <strong>{s.ph_value}</strong></span>
                  <span>Suhu: <strong>{s.temp_c}°C</strong></span>
                </div>

                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                  {s.notes}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    Kuras terakhir: {new Date(s.last_cleaned_at).toLocaleDateString("id-ID")}
                  </span>
                  {s.sensor_type === "GREASE_TRAP" && (
                    <button
                      className={`btn ${isAlert ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 11.5, padding: "5px 12px" }}
                      disabled={busyId === s.id}
                      onClick={() => handleFlushIPAL(s.id, s.zone_name)}
                    >
                      {busyId === s.id ? "Memproses..." : "🧹 Eksekusi Kuras & Reset Sensor"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel 4: Work Orders */}
      {subTab === "wo" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
          <form className="card" onSubmit={handleCreateWO} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>📝 Buat Tiket Work Order IPSRS</h4>
            <input
              className="input"
              placeholder="Aset / Zona (misal: AC Poli Anak / Ambulans 01)"
              value={woAsset}
              onChange={(e) => setWoAsset(e.target.value)}
              required
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select className="input" value={woType} onChange={(e) => setWoType(e.target.value)}>
                <option value="PREVENTIVE">PREVENTIVE</option>
                <option value="CORRECTIVE">CORRECTIVE</option>
                <option value="KALIBRASI">KALIBRASI</option>
                <option value="IPAL_KURAS">IPAL_KURAS</option>
              </select>
              <select className="input" value={woPriority} onChange={(e) => setWoPriority(e.target.value)}>
                <option value="RENDAH">RENDAH</option>
                <option value="SEDANG">SEDANG</option>
                <option value="TINGGI">TINGGI</option>
                <option value="DARURAT">DARURAT</option>
              </select>
            </div>
            <input
              className="input"
              placeholder="Teknisi Penanggung Jawab"
              value={woTech}
              onChange={(e) => setWoTech(e.target.value)}
            />
            <textarea
              className="input"
              rows={3}
              placeholder="Catatan kerusakan / tindakan..."
              value={woNotes}
              onChange={(e) => setWoNotes(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={busyId === "CREATE_WO"}>
              {busyId === "CREATE_WO" ? "Mengirim..." : "+ Terbitkan Tiket IPSRS"}
            </button>
          </form>

          <div className="card">
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14 }}>🛠️ Daftar Tiket Pemeliharaan &amp; Perbaikan</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {workOrders.map((w) => (
                <div
                  key={w.id}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <strong>{w.ticket_no}</strong> — {w.asset_or_zone}
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {w.issue_type} • Prioritas: <strong>{w.priority}</strong> • {w.technician}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        w.status === "RESOLVED" ? "badge-green" : w.status === "IN_PROGRESS" ? "badge-cyan" : "badge-amber"
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {w.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#cbd5e1", margin: "6px 0" }}>{w.notes}</div>
                  {w.status !== "RESOLVED" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {w.status === "OPEN" && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: "4px 10px" }}
                          disabled={busyId === w.id}
                          onClick={() => handleUpdateWO(w.id, "IN_PROGRESS")}
                        >
                          ▶ Kerjakan
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 11, padding: "4px 10px" }}
                        disabled={busyId === w.id}
                        onClick={() => handleUpdateWO(w.id, "RESOLVED")}
                      >
                        ✓ Selesai
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
