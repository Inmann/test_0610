"use client";

import { useEffect, useState } from "react";
import { startOfToday } from "@/lib/date";

// D-day 계산은 사용자 브라우저의 날짜 기준이어야 하므로,
// 서버 렌더링 시점이 아닌 클라이언트 마운트 이후에만 값을 제공한다.
// (서버와 클라이언트의 날짜가 다르면 hydration 불일치가 발생할 수 있음)
// 탭을 켜둔 채 자정을 넘기거나 다음 날 다시 탭으로 돌아온 경우에도
// D-day가 낡은 값으로 남지 않도록 자정 타이머 + 탭 포커스 시 재계산한다.
export function useToday(): Date | null {
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () =>
      setToday((prev) => {
        const next = startOfToday();
        return prev && prev.getTime() === next.getTime() ? prev : next;
      });

    refresh();

    // 다음 자정 직후에 갱신하고 타이머를 다시 건다
    let timer: ReturnType<typeof setTimeout>;
    const armMidnightTimer = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      timer = setTimeout(() => {
        refresh();
        armMidnightTimer();
      }, nextMidnight.getTime() - now.getTime() + 1000);
    };
    armMidnightTimer();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return today;
}
