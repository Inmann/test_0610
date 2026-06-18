"use client";

import { useState } from "react";
import Link from "next/link";
import ProgramCard from "@/components/ProgramCard";
import { daysUntil } from "@/lib/date";
import { usePrograms } from "@/lib/store";
import { useToday } from "@/lib/useToday";
import { useUntriagedCount } from "@/lib/announcements";
import { CATEGORIES, STATUSES, type Category, type OurStatus } from "@/lib/types";

const IN_PROGRESS_STATUSES: OurStatus[] = ["지원예정", "제안서제출", "PT"];

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? "bg-slate-800 font-semibold text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { programs, loading, error } = usePrograms();
  const today = useToday();
  const untriaged = useUntriagedCount();
  const [category, setCategory] = useState<Category | "전체">("전체");
  const [status, setStatus] = useState<OurStatus | "전체">("전체");

  if (!today || loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        데이터를 불러오는 중 오류가 발생했습니다: {error}
      </div>
    );
  }

  // 접수중(마감일이 오늘이거나 이후) 공고만, 마감 임박순으로 정렬
  const open = programs
    .filter((p) => daysUntil(p.deadline, today) >= 0)
    .sort((a, b) => daysUntil(a.deadline, today) - daysUntil(b.deadline, today));

  const filtered = open.filter(
    (p) =>
      (category === "전체" || p.category === category) &&
      (status === "전체" || p.our_status === status)
  );

  const closingSoon = open.filter((p) => daysUntil(p.deadline, today) <= 7);
  const inProgress = open.filter((p) =>
    IN_PROGRESS_STATUSES.includes(p.our_status)
  );
  const archived = programs.length - open.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">접수중인 출자사업</h1>
        <p className="mt-1 text-sm text-slate-500">
          마감 임박순으로 정렬됩니다. 카드를 누르면 상세 화면으로 이동합니다.
        </p>
      </div>

      {untriaged !== null && untriaged > 0 && (
        <Link
          href="/inbox"
          className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100"
        >
          <span className="text-sm text-blue-800">
            📥 매일 자동 수집된 공고{" "}
            <strong>{untriaged.toLocaleString()}건</strong>이 검토를 기다리고 있어요. 추적할 공고를 골라보세요.
          </span>
          <span className="shrink-0 text-sm font-semibold text-blue-700">
            수집함 열기 →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="접수중 공고" value={`${open.length}건`} />
        <StatCard label="7일 이내 마감" value={`${closingSoon.length}건`} />
        <StatCard label="지원 진행중" value={`${inProgress.length}건`} />
        <StatCard label="마감(아카이브)" value={`${archived}건`} />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">
            분야
          </span>
          <FilterButton
            label="전체"
            active={category === "전체"}
            onClick={() => setCategory("전체")}
          />
          {CATEGORIES.map((c) => (
            <FilterButton
              key={c}
              label={c}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">
            진행상태
          </span>
          <FilterButton
            label="전체"
            active={status === "전체"}
            onClick={() => setStatus("전체")}
          />
          {STATUSES.map((s) => (
            <FilterButton
              key={s}
              label={s}
              active={status === s}
              onClick={() => setStatus(s)}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
          조건에 맞는 접수중 공고가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              dday={daysUntil(p.deadline, today)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
