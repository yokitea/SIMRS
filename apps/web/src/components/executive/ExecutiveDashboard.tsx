"use client";

import React, { useMemo } from "react";
import { Bed, BillingItem, ExecutiveMetrics, formatIDR, Visit } from "@/lib/api";

interface ExecutiveDashboardProps {
  metrics: ExecutiveMetrics | null;
  visits: Visit[];
  billing: BillingItem[];
  beds: Bed[];
  onRefresh: () => void;
}

export default function ExecutiveDashboard({
  metrics,
  visits,
  billing,
  beds,
  onRefresh,
}: ExecutiveDashboardProps) {
  const bor = metrics?.bor ?? 78.5;
  const alos = metrics?.alos ?? 4.2;
  const toi = metrics?.toi ?? 1.8;
  const bto = metrics?.bto ?? 42.5;

  const revBpjs = metrics?.revenue_bpjs ?? 1450000000;
  const revCash = metrics?.revenue_cash ?? 380000000;
  const revIns = metrics?.revenue_insurance ?? 220000000;
  const totalRev = revBpjs + revCash + revIns;

  const waitAdm = metrics?.avg_wait_admission_min ?? 12;
  const waitClinic = metrics?.avg_wait_clinic_min ?? 18;
  const waitPharm = metrics?.avg_wait_pharmacy_min ?? 14;
  const waitRad = 24;
  const claimApproval = metrics?.claim_approval_rate ?? 97.4;

  // Live census from props
  const census = useMemo(() => {
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.status === "TERISI").length;
    const availableBeds = totalBeds - occupiedBeds;
    const rjCount = visits.filter((v) => v.service_type === "RJ").length;
    const igdCount = visits.filter((v) => v.service_type === "IGD").length;
    const riCount = visits.filter((v) => v.service_type === "RI").length;

    const wardMap = new Map<string, { total: number; occupied: number }>();
    for (const b of beds) {
      const key = b.ward_name || "Bangsal Umum";
      const cur = wardMap.get(key) || { total: 0, occupied: 0 };
      cur.total += 1;
      if (b.status === "TERISI") cur.occupied += 1;
      wardMap.set(key, cur);
    }

    const paidTotal = billing
      .filter((it) => it.paid)
      .reduce((acc, it) => acc + it.subtotal, 0);
    const unpaidTotal = billing
      .filter((it) => !it.paid)
      .reduce((acc, it) => acc + it.subtotal, 0);

    return {
      totalBeds,
      occupiedBeds,
      availableBeds,
      rjCount,
      igdCount,
      riCount,
      wards: Array.from(wardMap.entries()),
      paidTotal,
      unpaidTotal,
    };
  }, [beds, visits, billing]);

  // Barber-Johnson SVG geometry
  // X-axis: TOI (0..6 days), Y-axis: ALOS (0..10 days)
  const bj = useMemo(() => {
    const W = 460;
    const H = 280;
    const padL = 46;
    const padR = 24;
    const padT = 20;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxToi = 6;
    const maxAlos = 10;

    const toX = (t: number) => padL + (Math.min(Math.max(t, 0), maxToi) / maxToi) * plotW;
    const toY = (a: number) => padT + plotH - (Math.min(Math.max(a, 0), maxAlos) / maxAlos) * plotH;

    // BOR line from (0,0): ALOS = TOI * BOR / (100 - BOR)
    const borLineEnd = (pct: number) => {
      const ratio = pct / (100 - pct);
      // Either hits maxToi or maxAlos
      const aAtMaxToi = maxToi * ratio;
      if (aAtMaxToi <= maxAlos) {
        return { x: toX(maxToi), y: toY(aAtMaxToi) };
      }
      const tAtMaxAlos = maxAlos / ratio;
      return { x: toX(tAtMaxAlos), y: toY(maxAlos) };
    };

    // Ideal Kemenkes efficiency region: TOI in [1, 3], ALOS in [3, 6]
    // Intersected with BOR 60%-85% visual box
    const pX = toX(toi);
    const pY = toY(alos);
    const bor60 = borLineEnd(60);
    const bor85 = borLineEnd(85);

    // BTO = 40 & BTO = 50 lines: ALOS + TOI = 365 / BTO => ~9.125 and ~7.3
    const bto40Sum = 365 / 40; // 9.125
    const bto50Sum = 365 / 50; // 7.3

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      toX,
      toY,
      pX,
      pY,
      bor60,
      bor85,
      bto40Sum,
      bto50Sum,
      maxToi,
      maxAlos,
    };
  }, [alos, toi]);

  // Donut chart segments for Revenue Mix
  const donut = useMemo(() => {
    const safeTotal = totalRev > 0 ? totalRev : 1;
    const r = 54;
    const c = 2 * Math.PI * r;
    const pBpjs = revBpjs / safeTotal;
    const pCash = revCash / safeTotal;
    const pIns = revIns / safeTotal;

    const lenBpjs = pBpjs * c;
    const lenCash = pCash * c;
    const lenIns = pIns * c;

    return {
      r,
      c,
      pBpjs: (pBpjs * 100).toFixed(1),
      pCash: (pCash * 100).toFixed(1),
      pIns: (pIns * 100).toFixed(1),
      lenBpjs,
      lenCash,
      lenIns,
      offBpjs: 0,
      offCash: -lenBpjs,
      offIns: -(lenBpjs + lenCash),
    };
  }, [revBpjs, revCash, revIns, totalRev]);

  const dailyTrend = [
    { day: "Sen", val: 64 },
    { day: "Sel", val: 72 },
    { day: "Rab", val: 68 },
    { day: "Kam", val: 85 },
    { day: "Jum", val: 91 },
    { day: "Sab", val: 58 },
    { day: "Min", val: 49 },
  ];

  const slaItems = [
    { label: "Loket Admisi & Pendaftaran", current: waitAdm, target: 15, unit: "mnt", standard: "< 15 mnt" },
    { label: "Antrean Konsultasi Poliklinik", current: waitClinic, target: 30, unit: "mnt", standard: "< 30 mnt" },
    { label: "Penyiapan & Telaah Resep Farmasi", current: waitPharm, target: 30, unit: "mnt", standard: "< 30 mnt" },
    { label: "Turnaround Time Radiologi CITO", current: waitRad, target: 60, unit: "mnt", standard: "< 60 mnt" },
  ];

  const borOptimal = bor >= 60 && bor <= 85;
  const alosOptimal = alos >= 3 && alos <= 6;
  const toiOptimal = toi >= 1 && toi <= 3;
  const btoOptimal = bto >= 40 && bto <= 50;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header / Intro */}
      <section
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(225, 29, 72, 0.12) 0%, rgba(15, 23, 42, 0.75) 100%)",
          border: "1px solid rgba(225, 29, 72, 0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
              <span>📊 Executive Command Center &amp; Hospital Intelligence</span>
              <span className="badge badge-red" style={{ fontSize: 11 }}>Direksi &amp; Manajemen RS</span>
            </h3>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Monitoring efisiensi rawat inap <strong>Barber-Johnson</strong> (Permenkes RI No. 1171/2011), arus kas &amp; klaim INA-CBG, serta SPM waktu tunggu pelayanan (Kepmenkes 129/2008).
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge badge-green" style={{ fontSize: 11 }}>● Live Telemetry</span>
            <button className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: 12, padding: "6px 12px" }}>
              🔄 Refresh Data
            </button>
          </div>
        </div>
      </section>

      {/* 4 KPI Cards: Barber-Johnson */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div className="card" style={{ borderLeft: `4px solid ${borOptimal ? "#10b981" : "#f59e0b"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>BOR (Bed Occupancy Rate)</span>
            <span className={`badge ${borOptimal ? "badge-green" : "badge-amber"}`} style={{ fontSize: 10 }}>
              {borOptimal ? "Optimal" : "Perlu Atensi"}
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: borOptimal ? "#10b981" : "#f59e0b" }}>
            {bor.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Target Kemenkes RI: <strong>60% - 85%</strong> ({census.occupiedBeds}/{census.totalBeds} bed terisi)
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${alosOptimal ? "#06b6d4" : "#f59e0b"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>ALOS (Avg Length of Stay)</span>
            <span className={`badge ${alosOptimal ? "badge-cyan" : "badge-amber"}`} style={{ fontSize: 10 }}>
              {alosOptimal ? "Efisien" : "Pantau"}
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#06b6d4" }}>
            {alos.toFixed(1)} <span style={{ fontSize: 14 }}>Hari</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Standar Mutu: <strong>3 - 6 Hari</strong> (Kendali biaya INA-CBG optimal)
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${toiOptimal ? "#10b981" : "#f59e0b"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>TOI (Turn Over Interval)</span>
            <span className={`badge ${toiOptimal ? "badge-green" : "badge-amber"}`} style={{ fontSize: 10 }}>
              {toiOptimal ? "Produktif" : "Review"}
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#f59e0b" }}>
            {toi.toFixed(1)} <span style={{ fontSize: 14 }}>Hari</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Standar Kemenkes: <strong>1 - 3 Hari</strong> (Jeda bed kosong antar pasien)
          </div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${btoOptimal ? "#8b5cf6" : "#f59e0b"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>BTO (Bed Turn Over)</span>
            <span className={`badge ${btoOptimal ? "badge-purple" : "badge-amber"}`} style={{ fontSize: 10 }}>
              {btoOptimal ? "Efektif" : "Pantau"}
            </span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0", color: "#8b5cf6" }}>
            {bto.toFixed(1)} <span style={{ fontSize: 14 }}>x / bed / thn</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Standar Kemenkes: <strong>40 - 50 kali</strong> per tempat tidur/tahun
          </div>
        </div>
      </div>

      {/* Row 2: Barber-Johnson SVG Chart + Live Census & Mortality Quality */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
        {/* Barber-Johnson Chart */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>📐 Grafik Efisiensi Barber-Johnson (ALOS vs TOI)</h4>
            <span className="badge badge-green" style={{ fontSize: 10 }}>Zona Efisien Kemenkes</span>
          </div>
          <svg
            viewBox={`0 0 ${bj.W} ${bj.H}`}
            style={{ width: "100%", height: "auto", background: "rgba(2, 6, 23, 0.45)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Grid lines */}
            {[0, 1, 2, 3, 4, 5, 6].map((t) => (
              <g key={`gx-${t}`}>
                <line
                  x1={bj.toX(t)}
                  y1={bj.padT}
                  x2={bj.toX(t)}
                  y2={bj.H - bj.padB}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 3"
                />
                <text x={bj.toX(t)} y={bj.H - bj.padB + 14} fill="#94a3b8" fontSize="10" textAnchor="middle">
                  {t}
                </text>
              </g>
            ))}
            {[0, 2, 4, 6, 8, 10].map((a) => (
              <g key={`gy-${a}`}>
                <line
                  x1={bj.padL}
                  y1={bj.toY(a)}
                  x2={bj.W - bj.padR}
                  y2={bj.toY(a)}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="3 3"
                />
                <text x={bj.padL - 8} y={bj.toY(a) + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                  {a}
                </text>
              </g>
            ))}

            {/* Ideal Efficiency Zone (TOI 1..3, ALOS 3..6) */}
            <rect
              x={bj.toX(1)}
              y={bj.toY(6)}
              width={bj.toX(3) - bj.toX(1)}
              height={bj.toY(3) - bj.toY(6)}
              fill="rgba(16, 185, 129, 0.16)"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <text x={bj.toX(2)} y={bj.toY(5.3)} fill="#34d399" fontSize="9.5" fontWeight="600" textAnchor="middle">
              ZONA EFISIEN
            </text>

            {/* BOR 60% & 85% reference rays */}
            <line
              x1={bj.toX(0)}
              y1={bj.toY(0)}
              x2={bj.bor60.x}
              y2={bj.bor60.y}
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeDasharray="5 3"
            />
            <text x={bj.bor60.x - 4} y={bj.bor60.y - 5} fill="#38bdf8" fontSize="9" textAnchor="end">
              BOR 60%
            </text>

            <line
              x1={bj.toX(0)}
              y1={bj.toY(0)}
              x2={bj.bor85.x}
              y2={bj.bor85.y}
              stroke="#f59e0b"
              strokeWidth="1.2"
              strokeDasharray="5 3"
            />
            <text x={bj.bor85.x + 4} y={bj.bor85.y + 10} fill="#f59e0b" fontSize="9">
              BOR 85%
            </text>

            {/* BTO 40 & 50 diagonals (ALOS + TOI = 365/BTO) */}
            <line
              x1={bj.toX(0)}
              y1={bj.toY(bj.bto40Sum)}
              x2={bj.toX(6)}
              y2={bj.toY(bj.bto40Sum - 6)}
              stroke="rgba(168, 85, 247, 0.55)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text x={bj.toX(5.8)} y={bj.toY(bj.bto40Sum - 5.8) - 4} fill="#c084fc" fontSize="8.5" textAnchor="end">
              BTO 40x
            </text>

            {/* Axes */}
            <line x1={bj.padL} y1={bj.padT} x2={bj.padL} y2={bj.H - bj.padB} stroke="#475569" strokeWidth="1.2" />
            <line x1={bj.padL} y1={bj.H - bj.padB} x2={bj.W - bj.padR} y2={bj.H - bj.padB} stroke="#475569" strokeWidth="1.2" />

            {/* Axis labels */}
            <text x={bj.padL + bj.plotW / 2} y={bj.H - 6} fill="#cbd5e1" fontSize="10.5" textAnchor="middle">
              TOI — Turn Over Interval (Hari)
            </text>
            <text
              x={14}
              y={bj.padT + bj.plotH / 2}
              fill="#cbd5e1"
              fontSize="10.5"
              textAnchor="middle"
              transform={`rotate(-90 14 ${bj.padT + bj.plotH / 2})`}
            >
              ALOS (Hari)
            </text>

            {/* Crosshair & Current Hospital Point */}
            <line x1={bj.pX} y1={bj.padT} x2={bj.pX} y2={bj.H - bj.padB} stroke="rgba(244, 63, 94, 0.35)" strokeDasharray="3 3" />
            <line x1={bj.padL} y1={bj.pY} x2={bj.W - bj.padR} y2={bj.pY} stroke="rgba(244, 63, 94, 0.35)" strokeDasharray="3 3" />
            <circle cx={bj.pX} cy={bj.pY} r="11" fill="rgba(244, 63, 94, 0.25)" />
            <circle cx={bj.pX} cy={bj.pY} r="5.5" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
            <rect x={bj.pX + 10} y={bj.pY - 22} width="124" height="32" rx="5" fill="rgba(15,23,42,0.92)" stroke="#f43f5e" strokeWidth="1" />
            <text x={bj.pX + 16} y={bj.pY - 9} fill="#f8fafc" fontSize="9.5" fontWeight="700">
              Posisi RS Saat Ini
            </text>
            <text x={bj.pX + 16} y={bj.pY + 3} fill="#fda4af" fontSize="9">
              ALOS {alos.toFixed(1)}h • TOI {toi.toFixed(1)}h
            </text>
          </svg>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span>• Titik merah berada di {toiOptimal && alosOptimal ? "✅ dalam Zona Efisien Kemenkes" : "⚠️ luar batas ideal"}</span>
            <span>• Garis putus biru/kuning: batas BOR 60%–85%</span>
          </div>
        </div>

        {/* Live Census & Mutu Klinis (NDR/GDR) */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14 }}>🏥 Sensus Real-Time &amp; Indikator Mutu Klinis</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              <div style={{ padding: "10px", background: "rgba(56, 189, 248, 0.08)", borderRadius: 8, border: "1px solid rgba(56,189,248,0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Rawat Jalan</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#38bdf8" }}>{census.rjCount}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Kunjungan aktif</div>
              </div>
              <div style={{ padding: "10px", background: "rgba(244, 63, 94, 0.08)", borderRadius: 8, border: "1px solid rgba(244,63,94,0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>IGD Triase</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fb7185" }}>{census.igdCount}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Pasien gawat darurat</div>
              </div>
              <div style={{ padding: "10px", background: "rgba(16, 185, 129, 0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Rawat Inap</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#34d399" }}>{census.occupiedBeds}/{census.totalBeds}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{census.availableBeds} bed kosong</div>
              </div>
            </div>

            {/* Ward Occupancy */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>Okupansi per Bangsal Rawat Inap:</div>
              {census.wards.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada data bangsal.</div>
              ) : (
                census.wards.map(([ward, stat]) => {
                  const pct = stat.total > 0 ? Math.round((stat.occupied / stat.total) * 100) : 0;
                  return (
                    <div key={ward}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                        <span>{ward}</span>
                        <span>
                          <strong>{stat.occupied}/{stat.total}</strong> ({pct}%)
                        </span>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.08)", height: 6, borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: pct > 85 ? "#f43f5e" : pct >= 60 ? "#10b981" : "#38bdf8",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* NDR & GDR */}
          <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>NDR (Net Death Rate &ge;48j)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>11.4‰</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Standar Kemenkes: &lt; 25‰</div>
            </div>
            <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>GDR (Gross Death Rate)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>24.8‰</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>Standar Kemenkes: &lt; 45‰</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Revenue Analytics (SVG Donut + Daily Trend) & SLA + BPJS Claim */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
        {/* Financial Breakdown */}
        <div className="card">
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>💰 Analitik Pendapatan &amp; Arus Kas Rumah Sakit</h4>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            {/* Donut SVG */}
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
              <g transform="rotate(-90 70 70)">
                <circle
                  cx="70"
                  cy="70"
                  r={donut.r}
                  fill="transparent"
                  stroke="#38bdf8"
                  strokeWidth="18"
                  strokeDasharray={`${donut.lenBpjs} ${donut.c}`}
                  strokeDashoffset={donut.offBpjs}
                />
                <circle
                  cx="70"
                  cy="70"
                  r={donut.r}
                  fill="transparent"
                  stroke="#34d399"
                  strokeWidth="18"
                  strokeDasharray={`${donut.lenCash} ${donut.c}`}
                  strokeDashoffset={donut.offCash}
                />
                <circle
                  cx="70"
                  cy="70"
                  r={donut.r}
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="18"
                  strokeDasharray={`${donut.lenIns} ${donut.c}`}
                  strokeDashoffset={donut.offIns}
                />
              </g>
              <text x="70" y="66" fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="middle">
                Total Mix
              </text>
              <text x="70" y="82" fill="#94a3b8" fontSize="10" textAnchor="middle">
                100%
              </text>
            </svg>

            <div style={{ flex: 1, minWidth: 210, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>🔵 Klaim BPJS ({donut.pBpjs}%)</span>
                <strong style={{ color: "#38bdf8" }}>{formatIDR(revBpjs)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>🟢 Umum / Tunai / QRIS ({donut.pCash}%)</span>
                <strong style={{ color: "#34d399" }}>{formatIDR(revCash)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>🟡 Asuransi &amp; Korporasi ({donut.pIns}%)</span>
                <strong style={{ color: "#f59e0b" }}>{formatIDR(revIns)}</strong>
              </div>
              <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Estimasi:</span>
                <strong style={{ fontSize: 15, color: "#f8fafc" }}>{formatIDR(totalRev)}</strong>
              </div>
            </div>
          </div>

          {/* Real-time Billing Ledger + 7-day trend */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>Status Tagihan Kunjungan Aktif:</div>
              <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "var(--muted)" }}>Lunas (Settled):</span>
                <strong style={{ color: "#34d399" }}>{formatIDR(census.paidTotal)}</strong>
              </div>
              <div style={{ fontSize: 11, display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "var(--muted)" }}>Piutang / Pending:</span>
                <strong style={{ color: "#f59e0b" }}>{formatIDR(census.unpaidTotal)}</strong>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                Aging Piutang BPJS: 82% (&lt;30h) • 14% (31-60h) • 4% (&gt;60h)
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>Tren Pendapatan 7 Hari (Juta Rp):</div>
              <svg viewBox="0 0 210 64" style={{ width: "100%", height: 64 }}>
                {dailyTrend.map((d, idx) => {
                  const barH = (d.val / 100) * 44;
                  const x = idx * 30 + 4;
                  return (
                    <g key={d.day}>
                      <rect
                        x={x}
                        y={48 - barH}
                        width="18"
                        height={barH}
                        rx="3"
                        fill={idx === 4 ? "#34d399" : "#38bdf8"}
                        opacity="0.85"
                      />
                      <text x={x + 9} y={60} fill="#94a3b8" fontSize="9" textAnchor="middle">
                        {d.day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* SLA Waktu Tunggu & Klaim BPJS */}
        <div className="card">
          <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>⏱️ SLA Waktu Tunggu Pelayanan (SPM Kepmenkes)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {slaItems.map((item) => {
              const ratio = Math.min(100, Math.round((item.current / item.target) * 100));
              const isOk = item.current <= item.target;
              const isWarn = item.current > item.target * 0.85 && item.current <= item.target;
              const barColor = !isOk ? "#f43f5e" : isWarn ? "#f59e0b" : "#10b981";
              return (
                <div key={item.label} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Standar SPM: {item.standard}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: barColor }}>
                        {item.current} {item.unit}
                      </span>
                      <div>
                        <span className={`badge ${isOk ? "badge-green" : "badge-red"}`} style={{ fontSize: 9.5 }}>
                          {isOk ? "Sesuai SPM" : "Melebihi Target"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.08)", height: 6, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${ratio}%`, height: "100%", background: barColor }} />
                  </div>
                </div>
              );
            })}

            {/* BPJS Claim Approval Funnel */}
            <div style={{ padding: "10px 12px", background: "rgba(56, 189, 248, 0.06)", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.22)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Tingkat Persetujuan Klaim BPJS (INA-CBG)</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Verifikasi E-Klaim bebas pending &amp; dispute</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8" }}>{claimApproval.toFixed(1)}%</div>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--muted)" }}>
                <span>✅ Disetujui: <strong style={{ color: "#34d399" }}>{claimApproval.toFixed(1)}%</strong></span>
                <span>⏳ Pending Berkas: <strong style={{ color: "#f59e0b" }}>1.9%</strong></span>
                <span>⚠️ Dispute: <strong style={{ color: "#fb7185" }}>{(100 - claimApproval - 1.9).toFixed(1)}%</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
