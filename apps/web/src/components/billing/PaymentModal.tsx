"use client";

import React, { useEffect, useState } from "react";
import { formatIDR, BillingItem, Visit } from "@/lib/api";

interface Props {
  visit: Visit;
  billingItems: BillingItem[];
  onSettleSuccess: (visitId: string, paymentMethod: string, amount: number) => void;
  onClose: () => void;
}

export default function PaymentModal({ visit, billingItems, onSettleSuccess, onClose }: Props) {
  const total = billingItems.reduce((sum, i) => sum + i.subtotal, 0);

  const [paymentMethod, setPaymentMethod] = useState<"TUNAI" | "QRIS" | "EDC" | "BPJS">("QRIS");

  // Cash state
  const [cashReceived, setCashReceived] = useState<number>(total);
  const changeAmount = Math.max(0, cashReceived - total);

  // EDC state
  const [edcBank, setEdcBank] = useState("BCA");
  const [edcCardLast4, setEdcCardLast4] = useState("4821");
  const [edcApprovalCode, setEdcApprovalCode] = useState("APV892104");

  // QRIS Countdown state (5 minutes = 300s)
  const [qrisSecondsLeft, setQrisSecondsLeft] = useState<number>(300);
  const [qrisPaid, setQrisPaid] = useState<boolean>(false);

  useEffect(() => {
    if (paymentMethod !== "QRIS" || qrisPaid) return;
    const timer = setInterval(() => {
      setQrisSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [paymentMethod, qrisPaid]);

  const qrisMinutes = Math.floor(qrisSecondsLeft / 60);
  const qrisSecs = qrisSecondsLeft % 60;
  const qrisTimerFormatted = `${String(qrisMinutes).padStart(2, "0")}:${String(qrisSecs).padStart(2, "0")}`;

  const handleSimulateQRISScan = () => {
    setQrisPaid(true);
    setTimeout(() => {
      onSettleSuccess(visit.id, "QRIS", total);
    }, 800);
  };

  const handleConfirmPayment = () => {
    onSettleSuccess(visit.id, paymentMethod, total);
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
          maxWidth: 680,
          maxHeight: "92vh",
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>💳</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Terminal Pembayaran & Billing POS Terpadu</h3>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Konsolidasi Single-Bill: Jasa Medis, Farmasi, Radiologi, & Lab
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

        {/* Invoice Summary Card */}
        <div
          style={{
            background: "#0d121c",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Pasien & Nomor Registrasi:</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{visit.patient_name}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {visit.visit_number} · {visit.patient_no_rm} ({visit.unit_name})
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Tagihan Bersih:</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--cyan)" }}>
              {formatIDR(total)}
            </div>
            <div style={{ fontSize: 11, color: "#10b981" }}>
              {billingItems.length} Rincian Item Terkonsolidasi
            </div>
          </div>
        </div>

        {/* Payment Method Selector Tabs */}
        <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          <button
            type="button"
            onClick={() => setPaymentMethod("QRIS")}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: paymentMethod === "QRIS" ? "var(--cyan)" : "transparent",
              color: paymentMethod === "QRIS" ? "#000000" : "var(--muted)",
              border: paymentMethod === "QRIS" ? "1px solid var(--cyan)" : "1px solid var(--border)",
            }}
          >
            ⚡ QRIS Dinamis (Real-Time)
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod("TUNAI")}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: paymentMethod === "TUNAI" ? "var(--cyan)" : "transparent",
              color: paymentMethod === "TUNAI" ? "#000000" : "var(--muted)",
              border: paymentMethod === "TUNAI" ? "1px solid var(--cyan)" : "1px solid var(--border)",
            }}
          >
            💵 Tunai (Cash)
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod("EDC")}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: paymentMethod === "EDC" ? "var(--cyan)" : "transparent",
              color: paymentMethod === "EDC" ? "#000000" : "var(--muted)",
              border: paymentMethod === "EDC" ? "1px solid var(--cyan)" : "1px solid var(--border)",
            }}
          >
            💳 EDC Debit / Kredit
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod("BPJS")}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: paymentMethod === "BPJS" ? "var(--cyan)" : "transparent",
              color: paymentMethod === "BPJS" ? "#000000" : "var(--muted)",
              border: paymentMethod === "BPJS" ? "1px solid var(--cyan)" : "1px solid var(--border)",
            }}
          >
            🏥 Klaim BPJS / SEP
          </button>
        </div>

        {/* PAYMENT BODY CONTENT */}
        {paymentMethod === "QRIS" && (
          <div
            style={{
              background: "#080b11",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            {/* Simulated Dynamic QR Code */}
            <div
              style={{
                background: "#ffffff",
                padding: 12,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
              }}
            >
              <div style={{ color: "#000000", fontWeight: 900, fontSize: 11, marginBottom: 4, letterSpacing: 1 }}>
                QRIS DINAMIS STANDAR BI
              </div>
              {/* SVG QR Code Simulation */}
              <svg width="140" height="140" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="#ffffff" />
                {/* Position Markers */}
                <rect x="5" y="5" width="25" height="25" fill="#000000" />
                <rect x="8" y="8" width="19" height="19" fill="#ffffff" />
                <rect x="12" y="12" width="11" height="11" fill="#000000" />

                <rect x="70" y="5" width="25" height="25" fill="#000000" />
                <rect x="73" y="8" width="19" height="19" fill="#ffffff" />
                <rect x="77" y="12" width="11" height="11" fill="#000000" />

                <rect x="5" y="70" width="25" height="25" fill="#000000" />
                <rect x="8" y="73" width="19" height="19" fill="#ffffff" />
                <rect x="12" y="77" width="11" height="11" fill="#000000" />

                {/* Random QR Pixels */}
                <rect x="35" y="10" width="6" height="6" fill="#000000" />
                <rect x="45" y="15" width="6" height="6" fill="#000000" />
                <rect x="55" y="8" width="6" height="6" fill="#000000" />
                <rect x="35" y="35" width="12" height="12" fill="#000000" />
                <rect x="52" y="38" width="8" height="8" fill="#000000" />
                <rect x="65" y="42" width="14" height="6" fill="#000000" />
                <rect x="40" y="55" width="6" height="18" fill="#000000" />
                <rect x="50" y="60" width="16" height="8" fill="#000000" />
                <rect x="75" y="70" width="10" height="10" fill="#000000" />
                <rect x="70" y="85" width="18" height="6" fill="#000000" />
              </svg>
              <div style={{ color: "#000000", fontWeight: 700, fontSize: 10, marginTop: 4 }}>
                NMID: ID1020089128001
              </div>
            </div>

            {/* QRIS Instructions & Webhook trigger */}
            <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge badge-cyan">QRIS Dynamic Gateway</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: qrisSecondsLeft < 60 ? "#ef4444" : "#f59e0b",
                    background: "rgba(245, 158, 11, 0.1)",
                    padding: "3px 8px",
                    borderRadius: 4,
                  }}
                >
                  ⏱️ Kedaluwarsa dlm {qrisTimerFormatted}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                Tunjukkan QR Code ini kepada pasien. Pasien dapat memindai melalui aplikasi m-Banking (BCA, Mandiri Livin, BRImo, BNI) atau e-Wallet (Gopay, OVO, ShopeePay).
              </div>

              <div
                style={{
                  background: "#0d121c",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <div>Nominal Terkunci: <strong>{formatIDR(total)}</strong></div>
                <div className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>
                  Billing Ref: QRIS-{visit.visit_number}-2026
                </div>
              </div>

              {qrisPaid ? (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "rgba(16, 185, 129, 0.2)",
                    border: "1px solid #10b981",
                    borderRadius: 6,
                    color: "#34d399",
                    fontWeight: 700,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  ✓ Webhook Diterima: Pembayaran Berhasil Diverifikasi!
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ justifyContent: "center", padding: "10px", fontSize: 12 }}
                  onClick={handleSimulateQRISScan}
                >
                  ⚡ Simulasikan Pasien Scan & Bayar QRIS (Webhook Instan)
                </button>
              )}
            </div>
          </div>
        )}

        {paymentMethod === "TUNAI" && (
          <div
            style={{
              background: "#080b11",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Uang Fisik Diterima dari Pasien (Rp):
              </label>
              <input
                className="input"
                type="number"
                style={{ fontSize: 16, fontWeight: 700, color: "var(--cyan)" }}
                value={cashReceived}
                onChange={(e) => setCashReceived(Number(e.target.value))}
              />
            </div>

            {/* Quick cash denomination buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 11 }}
                onClick={() => setCashReceived(total)}
              >
                Uang Pas ({formatIDR(total)})
              </button>
              {[100000, 200000, 300000, 500000, 1000000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11 }}
                  onClick={() => setCashReceived(amt)}
                >
                  {formatIDR(amt)}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                background: "#0d121c",
                padding: 12,
                borderRadius: 6,
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Total Tagihan:</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{formatIDR(total)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Uang Kembalian Pasien:</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: changeAmount >= 0 ? "#10b981" : "#ef4444" }}>
                  {formatIDR(changeAmount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {paymentMethod === "EDC" && (
          <div
            style={{
              background: "#080b11",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Mesin EDC / Bank Penerbit:
              </label>
              <select className="select" value={edcBank} onChange={(e) => setEdcBank(e.target.value)}>
                <option value="BCA">BCA (Merchant ID: 88910)</option>
                <option value="Mandiri">Bank Mandiri (MID: 77201)</option>
                <option value="BRI">BRI (MID: 66102)</option>
                <option value="BNI">BNI (MID: 55403)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                4 Digit Terakhir Kartu:
              </label>
              <input
                className="input mono"
                placeholder="misal: 4821"
                maxLength={4}
                value={edcCardLast4}
                onChange={(e) => setEdcCardLast4(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Approval Code Mesin EDC:
              </label>
              <input
                className="input mono"
                placeholder="misal: APV-99820"
                value={edcApprovalCode}
                onChange={(e) => setEdcApprovalCode(e.target.value)}
              />
            </div>
          </div>
        )}

        {paymentMethod === "BPJS" && (
          <div
            style={{
              background: "#080b11",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: "#34d399", fontWeight: 700, marginBottom: 4 }}>
              ✓ Penjaminan Terhubung dengan BPJS Kesehatan VClaim
            </div>
            <div>No. Kartu BPJS: <strong>{visit.patient_no_rm}</strong></div>
            <div>No. SEP: <strong>{visit.sep_number || "0112R0011126V000101"}</strong></div>
            <div>Tarif Paket INA-CBG: <strong>{formatIDR(visit.inacbg_tariff || total)}</strong></div>
            <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>
              Pasien dibebaskan dari iur biaya umum (Non-Co-Payment). Tagihan akan diproses ke klaim kolektif BPJS.
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "8px 18px", fontSize: 13 }}
            onClick={handleConfirmPayment}
          >
            ✓ Konfirmasi Pembayaran & Terbitkan Kuitansi
          </button>
        </div>
      </div>
    </div>
  );
}
