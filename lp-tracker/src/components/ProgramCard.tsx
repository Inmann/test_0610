"use client";

import Link from "next/link";
import { CategoryBadge, DdayBadge, StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/date";
import type { Program } from "@/lib/types";

export default function ProgramCard({
  program,
  dday,
}: {
  program: Program;
  dday: number;
}) {
  return (
    <Link
      href={`/program/${program.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {program.institution}
          </p>
          <h3 className="mt-0.5 font-bold leading-snug text-slate-900">
            {program.title}
          </h3>
        </div>
        <DdayBadge diff={dday} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={program.category} />
        <StatusBadge status={program.our_status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-baseline gap-1.5">
          <dt className="shrink-0 text-xs text-slate-400">출자규모</dt>
          <dd className="truncate font-medium text-slate-700">
            {program.total_size || "-"}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="shrink-0 text-xs text-slate-400">접수마감</dt>
          <dd className="font-medium text-slate-700">
            {formatDate(program.deadline)}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
