# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

연기금·공제회·정책기관의 PEF/VC 출자사업 공고를 등록하고, 접수 마감 D-day와 지원 진행 상태를 한 화면에서 관리하는 사내 대시보드. 기술 스택: Next.js (App Router) + Supabase + TypeScript + Tailwind, Vercel 배포.

## 작업 원칙

- 모든 작업은 Phase 단위로 나눠서 진행한다. 한 번에 전부 구현하지 않는다.
- 각 Phase 완료 후 반드시 검증한 뒤 `git commit`으로 체크포인트를 남긴다.
- 에러 발생 시 현재 Phase만 되돌린다. 전체 재시작은 금지.
- 나는 개발자가 아니다. 내가 직접 해야 하는 일(터미널 명령어, 사이트에서 클릭할 것)은 항상 별도로 명확히 알려줄 것.
- UI 텍스트와 설명은 한국어로 작성한다.

## 검증 기준 (Phase 완료 판단)

1. 빌드 성공: `npm run build` 에러 없음
2. 로컬 실행: `npm run dev` 정상 동작
3. UI 확인: 브라우저에서 의도한 화면이 정상 표시
4. DB 연동: Supabase에 데이터 저장·조회 정상

## 실패 시 대응 (3단계 복구)

> **IMPORTANT:** 에러 발생 시 즉시 코드를 고치지 말고, 먼저 원인을 분석해 수정 계획을 제시할 것.

- 같은 에러가 2회 이상 반복되면, 코드 수정 전에 근본 원인 분석을 먼저 보고할 것.
- 3회 이상 같은 에러 반복 시 사용자에게 상황을 보고하고 대안 경로를 제안할 것.
- 코드가 완전히 꼬이면 가장 최근 정상 commit 시점으로 되돌릴 것을 권할 것.

## 보안 원칙

- 공고 정보는 공개 자료이므로 실데이터 사용 가능.
- 내부 메모(`our_status`, `memo`)는 팀 외부 노출 금지 (Auth 적용 전까지 URL 비공유).
- Supabase API Key 등 민감 정보는 `.env.local`로만 관리. `.gitignore`에 포함 여부 항상 확인. 절대 코드에 하드코딩하거나 GitHub에 올리지 않는다.
- 크롤링 키(`SCRAPINGBEE_API_KEY`, `SERPAPI_API_KEY`)도 `.env.local` + GitHub Secrets에만 둔다. CI는 secrets로 주입하므로 워크플로우/스크립트에 값을 적지 않는다.

## Phase 분할 및 체크포인트

| Phase | 내용 | commit 메시지 | 검증 |
|-------|------|-------------|------|
| 1 (MVP) | 더미 데이터로 대시보드·상세·아카이브 화면 구현 | `phase1: 대시보드 UI 완성 (더미 데이터)` | 공고 카드, D-day 배지, 필터 정상 표시 |
| 2 | Supabase 연동 (등록 폼 → DB 저장, 목록 조회, 상태/메모 수정) | `phase2: supabase 연동 완료` | 폼 제출 → DB 저장 → 대시보드 반영 |
| 3 | Vercel 배포 + 환경변수 설정 | `phase3: vercel 배포 완료` | 배포 URL 접속, 공고 등록·조회 정상 |
| 4-A | 스크래퍼 인프라 + KOFIA 연동 | `phase4-a` | KOFIA 282건 수집·저장 |
| 4-B | KVIC·KVCA·한국성장금융 스크래퍼 | `phase4-b` | 3개 기관 수집 검증 |
| 4-C | GitHub Actions 매일 자동 수집 | `phase4-c` | CI run success |
| 4-D | 국민연금(NPS) 스크래퍼 | `phase4-d` | NPS 119건 수집 |
| 4-E | 수집함(`/inbox`) 검토·승격 UI | `phase4-e` | 승격 E2E (program 생성+연결) |
| 4-F (선택, 미착수) | Claude API 공고문 필드 자동 추출 / Supabase Auth | — | — |

> 현재 5개 기관(KOFIA·KVIC·KVCA·한국성장금융·국민연금) 약 2,600건이 매일 09:00 KST 자동 수집되어 `/inbox`에서 검토·승격된다.

## 사용할 Skills

- `/출자공고-정리`: 공고문 원문을 입력하면 기관명·사업명·분야·출자규모·선정 운용사 수·접수마감일·핵심 지원자격을 표 형식으로 추출. (Phase 4-F 자동 입력의 기반 — 미착수)

---

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (run before deploying)
npm run lint     # ESLint check
npx tsc --noEmit # TypeScript type-check (scripts/ excluded in tsconfig)
node scripts/verify-prod.mjs  # read-only E2E check against production (12 items)

# 공고 자동 수집 (Supabase announcements 테이블에 적재) — .env.local 필요
npm run scrape        # 일일 증분 (최신 몇 페이지, 기존 URL 만나면 조기 종료)
npm run scrape:full   # 전체 백필 (과거 공고까지)
```

No test suite. `npm run lint` and `npx tsc --noEmit` are the only automated quality checks.

## Architecture

### Data flow

All program data lives in Supabase (`programs` table). The single global store is `src/lib/store.tsx` — a React Context (`ProgramsProvider`) that wraps the entire app in `layout.tsx`. Every page and component accesses data via the `usePrograms()` hook. There is no server-side data fetching; all pages are client components that read from this context.

`ProgramsProvider` applies **optimistic updates**: `updateProgram` patches local state immediately before awaiting the DB write, and reverts on error. `addProgram` inserts to DB first, then appends the returned row to local state.

### Supabase client

Only a browser client exists (`src/lib/supabase/client.ts` using `createBrowserClient`). There is no server client (`createServerClient`). The env vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

The scraping scripts under `scripts/` are separate Node code and use `@supabase/supabase-js` `createClient` directly (not the SSR browser client), reading the same two env vars plus `SCRAPINGBEE_API_KEY`.

### Date handling

`new Date("YYYY-MM-DD")` is intentionally avoided throughout — it parses as UTC and shifts the date in KST. All date strings are parsed with `parseDate()` from `src/lib/date.ts` which constructs a local-timezone midnight Date. Always use this function when converting date strings.

D-day values must be computed on the client only. `useToday()` (`src/lib/useToday.ts`) returns `null` on the server and the local-timezone today Date after mount, preventing SSR/client hydration mismatches. It also auto-refreshes at midnight and on tab focus.

### Pages and routing

| Route | Component type | Notes |
|-------|---------------|-------|
| `/` | `"use client"` | Dashboard: active programs filtered by `deadline >= today`, sorted by deadline |
| `/inbox` | `"use client"` | 수집함: `announcements` 목록(기관 필터·제목 검색·미처리 토글) + 추적 등록(승격)/패스 액션. `src/lib/announcements.ts` 훅 사용 |
| `/new` | `"use client"` | Registration form → `addProgram`. `?ann=<id>`이면 수집 공고를 prefill하고 저장 시 announcement 연결. `useSearchParams` → `Suspense` 래핑 필수 |
| `/program/[id]` | `"use client"` | Detail view; status dropdown and memo textarea both call `updateProgram` |
| `/archive` | `"use client"` | Programs where `deadline < today` |

### Domain types (`src/lib/types.ts`)

`Program` is the central type. Key fields: `our_status` (not `status`), `deadline` (required, YYYY-MM-DD), all other dates nullable. `CATEGORIES` and `STATUSES` are `as const` arrays — always use these when rendering dropdowns or writing filter logic.

Active/in-progress statuses used on the dashboard: `["지원예정", "제안서제출", "PT"]`.

### Components

- `Badges.tsx` — `CategoryBadge`, `StatusBadge`, `DdayBadge`. Color maps are exhaustive Records keyed by `Category` and `OurStatus`; add entries here when adding new values to `types.ts`.
- `ProgramCard.tsx` — card used on the dashboard list.
- `Header.tsx` — top nav (`/`, `/inbox`, `/archive` + `/new` 버튼). `/inbox`에 미처리 공고 수 배지(`useUntriagedCount`).

### Supabase schema

`supabase/schema.sql` defines the `programs` table; `supabase/announcements.sql` defines the `announcements` table (자동 수집 공고 보관함 — `source_url` UNIQUE 중복 방지, `promoted`/`program_id`로 승격 관리). RLS is enabled with open policies (anon + authenticated can do everything) — intentional for this internal-only app. `deadline` has an index. Apply schema changes via Supabase dashboard SQL Editor (또는 MCP `execute_sql`).

### Scraping subsystem (공고 자동 수집)

`scripts/`의 Node 스크립트가 5개 기관 공고를 수집해 Supabase `announcements` 테이블에 적재한다 (Next 앱과 분리된 독립 실행 코드).

- `scripts/scrape.mjs` — 메인 러너. `SCRAPERS` 배열의 각 스크래퍼를 순회. 일일(기본) / `--full`(전체 백필). 기존 `source_url`을 만나면 조기 종료, `upsert(onConflict: source_url, ignoreDuplicates)`로 중복 방지.
- `scripts/scrapers/*.mjs` — 기관별 파서. 각 모듈은 `scrape<Name>({ maxPages, knownUrls })`를 export하고 `{ scraper, source_url, raw_title, institution, title, announced_at }` 배열을 반환(공통 계약). `source_url`이 고유 키.
- `scripts/scrapers/fetch.mjs` — 공용 fetch 유틸. **curl 우선**(Node fetch/undici가 일부 기관에서 차단됨), 실패 시 **ScrapingBee** fallback(JS 렌더/프록시, `SCRAPINGBEE_API_KEY`).

기관별 특이사항(파서 수정 시 주의):
- **kofia**: HTML 비정상(`<a>`가 `<span>` 경계를 넘음) → 정규식 파싱.
- **kgrowth**: EUC-KR → curl raw 바이트 + `TextDecoder('euc-kr')`. 고정 공지가 매 페이지 반복돼 실행 내 dedup.
- **kvca**: 행마다 동일 링크가 모든 td를 감쌈. institution은 발주기관(지자체 등), `po_no`가 고유 키.
- **kvic / nps**: 상세가 `javascript:fn(...)` 형태 → id 기반 상세 URL 합성. nps 날짜는 `YYYY/MM/DD`.
- 실측상 5개 기관 모두 curl로 수집되며 ScrapingBee는 미발동(JS 사이트 대비 fallback으로 대기).

수집된 공고는 `/inbox`에서 검토 → "추적 등록"으로 `programs`에 승격(`/new?ann=<id>` prefill, 저장 시 `promoted=true` + `program_id` 연결) 또는 "패스"(`promoted=true, program_id=null`). 쿼리 훅·mutation은 `src/lib/announcements.ts`.

## Deployment

- Production: https://lp-tracker-iota.vercel.app
- Auto-deploys on push to `main` (Vercel root directory: `lp-tracker`)
- Env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are set in Vercel project settings, not in the repo
- 매일 자동 수집: GitHub Actions `.github/workflows/scrape.yml` (repo 루트). cron `0 0 * * *`(09:00 KST) + `workflow_dispatch` 수동 실행(full 옵션). GitHub Secrets에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SCRAPINGBEE_API_KEY` 등록됨
