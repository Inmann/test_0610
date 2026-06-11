// "YYYY-MM-DD" 문자열을 로컬 타임존 자정 기준 Date로 변환
// (new Date("YYYY-MM-DD")는 UTC로 해석돼 한국 시간과 어긋날 수 있어 직접 파싱)
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// 오늘부터 dateStr까지 남은 일수. 0 = 오늘 마감(D-DAY), 음수 = 마감 지남
export function daysUntil(dateStr: string, today: Date): number {
  return Math.round((parseDate(dateStr).getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}

export function ddayLabel(diff: number): string {
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
