// D-day 계산 로직 sanity check: node scripts/check-date-logic.mts
import { daysUntil, ddayLabel, formatDate, parseDate } from "../src/lib/date.ts";

const today = new Date(2026, 5, 11); // 2026-06-11 (로컬 자정)

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${String(actual)}${ok ? "" : ` (expected ${String(expected)})`}`);
}

check("오늘 마감 D-0", daysUntil("2026-06-11", today), 0);
check("내일 마감 D-1", daysUntil("2026-06-12", today), 1);
check("어제 마감 D+1", daysUntil("2026-06-10", today), -1);
check("더미1 마감(6/17) D-6", daysUntil("2026-06-17", today), 6);
check("더미2 마감(6/24) D-13", daysUntil("2026-06-24", today), 13);
check("더미3 마감(7/21) D-40", daysUntil("2026-07-21", today), 40);
check("더미4 마감(4/8) 지남", daysUntil("2026-04-08", today) < 0, true);
check("더미5 마감(5/7) 지남", daysUntil("2026-05-07", today) < 0, true);
check("연도 경계", daysUntil("2027-01-01", today), 204);
check("ddayLabel(0)", ddayLabel(0), "D-DAY");
check("ddayLabel(6)", ddayLabel(6), "D-6");
check("ddayLabel(-3)", ddayLabel(-3), "D+3");
check("formatDate", formatDate("2026-06-17"), "2026.06.17");
check("formatDate(null)", formatDate(null), "-");
check("parseDate 로컬 자정", parseDate("2026-06-11").getHours(), 0);

if (failed > 0) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전체 통과");
