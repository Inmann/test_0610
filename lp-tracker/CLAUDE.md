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

## Phase 분할 및 체크포인트

| Phase | 내용 | commit 메시지 | 검증 |
|-------|------|-------------|------|
| 1 (MVP) | 더미 데이터로 대시보드·상세·아카이브 화면 구현 | `phase1: 대시보드 UI 완성 (더미 데이터)` | 공고 카드, D-day 배지, 필터 정상 표시 |
| 2 | Supabase 연동 (등록 폼 → DB 저장, 목록 조회, 상태/메모 수정) | `phase2: supabase 연동 완료` | 폼 제출 → DB 저장 → 대시보드 반영 |
| 3 | Vercel 배포 + 환경변수 설정 | `phase3: vercel 배포 완료` | 배포 URL 접속, 공고 등록·조회 정상 |
| 4 (선택) | Claude API 공고문 필드 자동 추출 / Supabase Auth | — | — |

## 사용할 Skills

- `/출자공고-정리`: 공고문 원문을 입력하면 기관명·사업명·분야·출자규모·선정 운용사 수·접수마감일·핵심 지원자격을 표 형식으로 추출. (Phase 4 자동 입력의 기반)

---

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (run before deploying)
npm run lint     # ESLint check
npx tsc --noEmit # TypeScript type-check (scripts/ excluded in tsconfig)
node scripts/verify-prod.mjs  # read-only E2E check against production (12 items)
```

No test suite. `npm run lint` and `npx tsc --noEmit` are the only automated quality checks.

## Architecture

### Data flow

All program data lives in Supabase (`programs` table). The single global store is `src/lib/store.tsx` — a React Context (`ProgramsProvider`) that wraps the entire app in `layout.tsx`. Every page and component accesses data via the `usePrograms()` hook. There is no server-side data fetching; all pages are client components that read from this context.

`ProgramsProvider` applies **optimistic updates**: `updateProgram` patches local state immediately before awaiting the DB write, and reverts on error. `addProgram` inserts to DB first, then appends the returned row to local state.

### Supabase client

Only a browser client exists (`src/lib/supabase/client.ts` using `createBrowserClient`). There is no server client (`createServerClient`). The env vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### Date handling

`new Date("YYYY-MM-DD")` is intentionally avoided throughout — it parses as UTC and shifts the date in KST. All date strings are parsed with `parseDate()` from `src/lib/date.ts` which constructs a local-timezone midnight Date. Always use this function when converting date strings.

D-day values must be computed on the client only. `useToday()` (`src/lib/useToday.ts`) returns `null` on the server and the local-timezone today Date after mount, preventing SSR/client hydration mismatches. It also auto-refreshes at midnight and on tab focus.

### Pages and routing

| Route | Component type | Notes |
|-------|---------------|-------|
| `/` | `"use client"` | Dashboard: active programs filtered by `deadline >= today`, sorted by deadline |
| `/new` | `"use client"` | Registration form → calls `addProgram`, redirects to `/` |
| `/program/[id]` | `"use client"` | Detail view; status dropdown and memo textarea both call `updateProgram` |
| `/archive` | `"use client"` | Programs where `deadline < today` |

### Domain types (`src/lib/types.ts`)

`Program` is the central type. Key fields: `our_status` (not `status`), `deadline` (required, YYYY-MM-DD), all other dates nullable. `CATEGORIES` and `STATUSES` are `as const` arrays — always use these when rendering dropdowns or writing filter logic.

Active/in-progress statuses used on the dashboard: `["지원예정", "제안서제출", "PT"]`.

### Components

- `Badges.tsx` — `CategoryBadge`, `StatusBadge`, `DdayBadge`. Color maps are exhaustive Records keyed by `Category` and `OurStatus`; add entries here when adding new values to `types.ts`.
- `ProgramCard.tsx` — card used on the dashboard list.
- `Header.tsx` — top nav with links to `/` and `/new`.

### Supabase schema

`supabase/schema.sql` defines the `programs` table. RLS is enabled with open policies (anon + authenticated can do everything) — intentional for this internal-only app. `deadline` has an index. Apply schema changes via Supabase dashboard SQL Editor.

## Deployment

- Production: https://lp-tracker-iota.vercel.app
- Auto-deploys on push to `main` (Vercel root directory: `lp-tracker`)
- Env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are set in Vercel project settings, not in the repo
