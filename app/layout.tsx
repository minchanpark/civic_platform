import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
