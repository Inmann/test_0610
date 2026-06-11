import { ddayLabel } from "@/lib/date";
import type { Category, OurStatus } from "@/lib/types";

const CATEGORY_STYLES: Record<Category, string> = {
  PEF: "bg-blue-50 text-blue-700",
  VC: "bg-purple-50 text-purple-700",
  크레딧: "bg-amber-50 text-amber-700",
  세컨더리: "bg-teal-50 text-teal-700",
  인프라: "bg-lime-50 text-lime-700",
};

const STATUS_STYLES: Record<OurStatus, string> = {
  미검토: "bg-slate-100 text-slate-600",
  검토중: "bg-sky-50 text-sky-700",
  지원예정: "bg-indigo-50 text-indigo-700",
  제안서제출: "bg-amber-50 text-amber-700",
  PT: "bg-violet-50 text-violet-700",
  선정: "bg-emerald-50 text-emerald-700",
  미선정: "bg-rose-50 text-rose-600",
  패스: "bg-slate-100 text-slate-400",
};

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[category]}`}
    >
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: OurStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

// diff: 마감일까지 남은 일수 (0 = 오늘 마감, 음수 = 마감 지남)
// 7일 이내 빨강, 14일 이내 주황, 그 외 회색
export function DdayBadge({ diff }: { diff: number }) {
  const style =
    diff < 0
      ? "bg-slate-100 text-slate-400"
      : diff <= 7
        ? "bg-red-100 text-red-700"
        : diff <= 14
          ? "bg-orange-100 text-orange-700"
          : "bg-slate-200 text-slate-600";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ${style}`}
    >
      {diff < 0 ? "마감" : ddayLabel(diff)}
    </span>
  );
}
