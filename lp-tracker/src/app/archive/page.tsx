"use client";

import Link from "next/link";
import { CategoryBadge, StatusBadge } from "@/components/Badges";
import { daysUntil, formatDate, parseDate } from "@/lib/date";
import { usePrograms } from "@/lib/store";
import { useToday } from "@/lib/useToday";

export default function ArchivePage() {
  const { programs, loading, error } = usePrograms();
  const today = useToday();

  if (!today || loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
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

  // 마감일이 지난 공고, 최근 마감순
  const past = programs
    .filter((p) => daysUntil(p.deadline, today) < 0)
    .sort((a, b) => parseDate(b.deadline).getTime() - parseDate(a.deadline).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">아카이브</h1>
        <p className="mt-1 text-sm text-slate-500">
          접수가 마감된 공고 {past.length}건 (최근 마감순)
        </p>
      </div>

      {past.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
          마감된 공고가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-400">
                <th className="px-5 py-3 font-semibold">공고</th>
                <th className="px-5 py-3 font-semibold">분야</th>
                <th className="px-5 py-3 font-semibold">접수 마감일</th>
                <th className="px-5 py-3 font-semibold">선정 발표</th>
                <th className="px-5 py-3 font-semibold">진행상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {past.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link href={`/program/${p.id}`} className="group block">
                      <p className="text-xs text-slate-400">{p.institution}</p>
                      <p className="font-semibold text-slate-900 group-hover:text-blue-600">
                        {p.title}
                      </p>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <CategoryBadge category={p.category} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(p.deadline)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(p.result_date)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={p.our_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
