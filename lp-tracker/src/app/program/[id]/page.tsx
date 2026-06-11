"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { CategoryBadge, DdayBadge, StatusBadge } from "@/components/Badges";
import { daysUntil, formatDate } from "@/lib/date";
import { usePrograms } from "@/lib/store";
import { useToday } from "@/lib/useToday";
import { STATUSES, type OurStatus, type Program } from "@/lib/types";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export default function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getProgram, updateProgram, loading } = usePrograms();
  const program = getProgram(id);
  const today = useToday();

  const [memoDraft, setMemoDraft] = useState(program?.memo ?? "");
  const [flash, setFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 프로그램 데이터가 로드된 후 memoDraft 초기화 (처음 render 시 program이 undefined일 수 있음)
  const prevProgramRef = useRef<Program | undefined>(undefined);
  if (program && prevProgramRef.current?.id !== program.id) {
    prevProgramRef.current = program;
    setMemoDraft(program.memo ?? "");
  }

  if (loading && !program) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-2" />
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <p className="text-sm text-slate-500">공고를 찾을 수 없습니다.</p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
        >
          ← 대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const showFlash = () => {
    setFlash(true);
    setSaveError(null);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 2000);
  };

  const handleStatusChange = async (status: OurStatus) => {
    try {
      await updateProgram(program.id, { our_status: status });
      showFlash();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "상태 저장 중 오류가 발생했습니다.");
    }
  };

  const handleMemoSave = async () => {
    try {
      await updateProgram(program.id, { memo: memoDraft });
      showFlash();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "메모 저장 중 오류가 발생했습니다.");
    }
  };

  const dday = today ? daysUntil(program.deadline, today) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-block text-sm text-slate-500 hover:text-slate-900"
      >
        ← 대시보드
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {program.institution}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">
              {program.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={program.category} />
              <StatusBadge status={program.our_status} />
            </div>
          </div>
          {dday !== null && <DdayBadge diff={dday} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-2 font-bold text-slate-900">공고 정보</h2>
            <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-8">
              <InfoRow label="총 출자규모">{program.total_size || "-"}</InfoRow>
              <InfoRow label="선정 운용사 수">{program.num_gps || "-"}</InfoRow>
              <InfoRow label="공고일">{formatDate(program.announce_date)}</InfoRow>
              <InfoRow label="접수 마감일">
                <span className="flex items-center gap-2">
                  {formatDate(program.deadline)}
                  {dday !== null && <DdayBadge diff={dday} />}
                </span>
              </InfoRow>
              <InfoRow label="PT 예정일">
                {formatDate(program.presentation_date)}
              </InfoRow>
              <InfoRow label="선정 발표 예정일">
                {formatDate(program.result_date)}
              </InfoRow>
              <InfoRow label="공고 원문">
                {program.url ? (
                  <a
                    href={program.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 hover:underline"
                  >
                    {program.url}
                  </a>
                ) : (
                  "-"
                )}
              </InfoRow>
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {saveError}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">진행상태</h2>
              {flash && (
                <span className="text-xs font-semibold text-emerald-600">
                  저장됨 ✓
                </span>
              )}
            </div>
            <select
              aria-label="진행상태"
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={program.our_status}
              onChange={(e) => handleStatusChange(e.target.value as OurStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-400">
              선택하면 즉시 반영됩니다. (데모 단계: 새로고침 시 초기화)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold text-slate-900">내부 메모</h2>
            <textarea
              aria-label="내부 메모"
              className="mt-3 min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="검토 의견, 담당자, 준비 사항 등"
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
            />
            <button
              type="button"
              onClick={handleMemoSave}
              disabled={memoDraft === program.memo}
              className="mt-3 w-full rounded-lg bg-slate-800 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              메모 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
