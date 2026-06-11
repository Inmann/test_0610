"use client";

import { useState } from "react";
import ClubCard, { type ClubCardData } from "@/components/ClubCard";

const CATEGORIES = ["전체", "스포츠", "문화·예술", "학습", "봉사", "취미"] as const;

export default function ClubsClient({ clubs }: { clubs: ClubCardData[] }) {
  const [selected, setSelected] = useState<string>("전체");
  const [query, setQuery] = useState("");

  const filtered = clubs.filter((c) => {
    const matchCategory = selected === "전체" || c.category === selected;
    const matchQuery =
      query === "" ||
      c.name.includes(query) ||
      c.description.includes(query) ||
      c.tags.some((t) => t.includes(query));
    return matchCategory && matchQuery;
  });

  return (
    <>
      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-gray-light p-5 mb-8 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="동아리 이름, 설명, 태그 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border border-gray-light rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelected(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                selected === cat
                  ? "bg-primary text-white"
                  : "bg-gray-light text-gray-dark hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-dark mb-5">
        총 <strong className="text-primary">{filtered.length}개</strong>의 동아리
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-dark">
          <p className="text-4xl mb-4">🔍</p>
          <p className="font-semibold text-gray-900 text-lg mb-1">검색 결과가 없습니다</p>
          <p className="text-sm">다른 검색어나 카테고리를 선택해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>
      )}
    </>
  );
}
