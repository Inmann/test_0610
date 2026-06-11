"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "홈", href: "/" },
  { label: "동아리 목록", href: "/clubs" },
  { label: "공지사항", href: "/notices" },
  { label: "마이페이지", href: "/mypage" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-primary text-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-primary font-bold text-sm">S</span>
            </div>
            <div>
              <span className="font-bold text-lg leading-tight block">삼천리</span>
              <span className="text-xs text-primary-100 leading-tight block -mt-0.5">동아리 커뮤니티</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-white/20 text-white"
                    : "text-primary-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
              김
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
