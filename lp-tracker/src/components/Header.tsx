"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/archive", label: "아카이브" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold text-slate-900"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-xs font-extrabold text-white">
            LP
          </span>
          <span className="hidden sm:inline">출자사업 트래커</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-slate-100 font-semibold text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/new"
          className="ml-auto shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <span className="sm:hidden">+ 등록</span>
          <span className="hidden sm:inline">+ 공고 등록</span>
        </Link>
      </div>
    </header>
  );
}
