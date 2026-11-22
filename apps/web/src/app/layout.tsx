import type { Metadata, Viewport } from "next";
import "./globals.css";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Core SIMRS";

export const metadata: Metadata = {
  title: `${brandName} — Sistem Informasi Manajemen Rumah Sakit`,
  description:
    "White-Label OEM Hospital Information System with RME (Permenkes 24/2022), Farmasi KFA, Bed Management, BPJS VClaim/INA-CBG, SATUSEHAT FHIR R4, and RIS/PACS Integration",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
