import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { I18nProvider } from "@/components/i18n-provider";

export const metadata: Metadata = {
  title: "CivicPin",
  description: "지도 기반 시민 민원 접수와 처리 현황",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body>
        <a className="skip-link" href="#main-content">본문 바로가기</a>
        <I18nProvider><AuthProvider><div id="main-content" tabIndex={-1}>{children}</div></AuthProvider></I18nProvider>
      </body>
    </html>
  );
}
