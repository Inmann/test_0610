"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";
import {
  SCRAPERS,
  SCRAPER_LABELS,
  useAnnouncementInbox,
  dismissAnnouncement,
  type Announcement,
} from "@/lib/announcements";

const SCRAPER_BADGE: Record<string, string> = {
  kofia: "bg-sky-50 text-sky-700",
  kvic: "bg-indigo-50 text-indigo-700",
  kvca: "bg-violet-50 text-violet-700",
  kgrowth: "bg-amber-50 text-amber-700",
  nps: "bg-emerald-50 text-emerald-700",
};

function FilterChip({
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

function AnnouncementRow({
  a,
  onDismiss,
  pending,
}: {
  a: Announcement;
  onDismiss: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
              SCRAPER_BADGE[a.scraper] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {SCRAPER_LABELS[a.scraper] ?? a.scraper}
          </span>
          {a.institution && (
            <span className="text-xs font-medium text-slate-500">
              {a.institution}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {formatDate(a.announced_at)}
          </span>
        </div>
        <a
          href={a.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline"
        >
          {a.title}
        </a>
      </div>

      {a.promoted ? (
        a.program_id ? (
          <Link
            href={`/program/${a.program_id}`}
            className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            추적됨 →
          </Link>
        ) : (
          <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-center text-sm font-medium text-slate-400">
            패스됨
          </span>
        )
      ) : (
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/new?ann=${a.id}`}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            추적 등록
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDismiss(a.id)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "처리 중…" : "패스"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const {
    items,
    total,
    loading,
    error,
    scraper,
    q,
    untriagedOnly,
    setScraper,
    setQ,
    setUntriagedOnly,
    hasMore,
    loadMore,
    reload,
  } = useAnnouncementInbox();

  const [searchInput, setSearchInput] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDismiss = async (id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
    setActionError(null);
    try {
      await dismissAnnouncement(id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">수집함</h1>
        <p className="mt-1 text-sm text-slate-500">
          매일 자동 수집된 공고입니다. 추적할 공고는{" "}
          <span className="font-semibold text-slate-700">추적 등록</span>, 관심
          없는 공고는 <span className="font-semibold text-slate-700">패스</span>
          하세요.
        </p>
      </div>

      {/* 기관 필터 */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="전체" active={scraper === null} onClick={() => setScraper(null)} />
        {SCRAPERS.map((s) => (
          <FilterChip
            key={s}
            label={SCRAPER_LABELS[s]}
            active={scraper === s}
            onClick={() => setScraper(s)}
          />
        ))}
      </div>

      {/* 검색 + 미처리 토글 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(searchInput);
          }}
          className="flex flex-1 gap-2"
        >
          <input
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            placeholder="제목 검색 (예: 사모, 벤처, 위탁운용)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            검색
          </button>
          {q && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQ("");
              }}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
            >
              초기화
            </button>
          )}
        </form>

        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={untriagedOnly}
            onChange={(e) => setUntriagedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          미처리만 보기
        </label>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* 건수 */}
      <p className="text-xs text-slate-400">
        {loading ? "불러오는 중…" : `${total.toLocaleString()}건`}
        {untriagedOnly && !loading && " (미처리)"}
      </p>

      {/* 목록 */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          불러오기 실패: {error}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
          {untriagedOnly ? "미처리 공고가 없습니다. 🎉" : "공고가 없습니다."}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <AnnouncementRow
              key={a.id}
              a={a}
              onDismiss={handleDismiss}
              pending={pendingIds.has(a.id)}
            />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
