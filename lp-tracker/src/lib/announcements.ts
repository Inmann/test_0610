"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 자동 수집된 공고(announcements 테이블). 검토 후 programs로 "승격"한다.
export type Announcement = {
  id: string;
  source_url: string;
  scraper: string;
  raw_title: string;
  institution: string | null;
  title: string;
  announced_at: string | null; // YYYY-MM-DD
  promoted: boolean;
  program_id: string | null;
  created_at: string;
  irrelevant: boolean; // 자동 분류: 우리 도메인과 무관(채용·MMF·리츠·결과 등)
  irrelevant_reason: string | null;
};

// 수집 출처 코드 → 표시용 한글 라벨
export const SCRAPER_LABELS: Record<string, string> = {
  kofia: "금융투자협회",
  kvic: "한국벤처투자",
  kvca: "벤처캐피탈협회",
  kgrowth: "한국성장금융",
  nps: "국민연금",
};

export const SCRAPERS = ["kofia", "kvic", "kvca", "kgrowth", "nps"] as const;

const PAGE_SIZE = 50;

/**
 * 수집함 목록 훅. 기관/검색/미처리 필터 + "더 보기" 페이지네이션.
 * 2,000건이 넘으므로 전체를 한 번에 불러오지 않고 필터 + range로 조회한다.
 */
export function useAnnouncementInbox() {
  const [scraper, setScraperRaw] = useState<string | null>(null);
  const [q, setQRaw] = useState("");
  const [untriagedOnly, setUntriagedOnlyRaw] = useState(true);
  const [relevantOnly, setRelevantOnlyRaw] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);

  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // loading은 초기값(true) + 아래 .then에서 false로만 전환한다.
    // (이펙트 본문에서 동기 setState 호출은 react-hooks 규칙 위반)
    let cancelled = false;
    const supabase = createClient();

    let query = supabase
      .from("announcements")
      .select("*", { count: "exact" })
      .order("announced_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(0, limit - 1);

    if (untriagedOnly) query = query.eq("promoted", false);
    if (relevantOnly) query = query.eq("irrelevant", false);
    if (scraper) query = query.eq("scraper", scraper);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);

    query.then(({ data, error: err, count }) => {
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setItems((data ?? []) as Announcement[]);
        setTotal(count ?? 0);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [scraper, q, untriagedOnly, relevantOnly, limit, reloadKey]);

  // 필터를 바꾸면 페이지를 처음으로 되돌린다.
  const setScraper = (s: string | null) => {
    setLimit(PAGE_SIZE);
    setScraperRaw(s);
  };
  const setQ = (v: string) => {
    setLimit(PAGE_SIZE);
    setQRaw(v);
  };
  const setUntriagedOnly = (b: boolean) => {
    setLimit(PAGE_SIZE);
    setUntriagedOnlyRaw(b);
  };
  const setRelevantOnly = (b: boolean) => {
    setLimit(PAGE_SIZE);
    setRelevantOnlyRaw(b);
  };

  return {
    items,
    total,
    loading,
    error,
    scraper,
    q,
    untriagedOnly,
    relevantOnly,
    setScraper,
    setQ,
    setUntriagedOnly,
    setRelevantOnly,
    hasMore: items.length < total,
    loadMore: () => setLimit((l) => l + PAGE_SIZE),
    reload: () => setReloadKey((k) => k + 1),
  };
}

/** 미처리(promoted=false) 공고 개수 — Header 배지용. */
export function useUntriagedCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("announcements")
      .select("*", { count: "exact", head: true })
      .eq("promoted", false)
      .eq("irrelevant", false)
      .then(({ count: c, error }) => {
        if (!cancelled && !error) setCount(c ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}

/** 단건 조회 (/new prefill용). */
export async function fetchAnnouncement(id: string): Promise<Announcement | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Announcement;
}

/** 패스: 추적하지 않고 처리 완료 표시 (목록에서 사라짐). */
export async function dismissAnnouncement(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ promoted: true, program_id: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** 승격: programs로 등록 후 해당 announcement를 연결. */
export async function linkAnnouncementToProgram(
  id: string,
  programId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ promoted: true, program_id: programId })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
