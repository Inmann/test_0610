import type { Metadata } from "next";
import Header from "@/components/Header";
import { ProgramsProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "LP 출자사업 트래커",
  description:
    "연기금·공제회·정책기관 출자사업 공고와 지원 진행 상황을 한눈에 관리하는 사내 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900">
        <ProgramsProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </ProgramsProvider>
      </body>
    </html>
  );
}
