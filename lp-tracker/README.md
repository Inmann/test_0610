# LP 출자사업 트래커

연기금·공제회·정책기관의 PEF/VC 출자사업 공고를 등록하고, 접수 마감 D-day와
우리 회사의 지원 진행 상태를 한 화면에서 관리하는 사내 대시보드.

Next.js (App Router) + TypeScript + Tailwind CSS v4 + Supabase.

## 배포

- **프로덕션**: https://lp-tracker-iota.vercel.app
- `main` 브랜치에 push하면 Vercel이 자동으로 빌드·배포 (Root Directory: `lp-tracker`)
- 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)는 Vercel 프로젝트에 등록되어 있음
- 배포 검증: `node scripts/verify-prod.mjs` (읽기 전용 E2E 12개 항목)

## 현재 단계 (3단계 완료: Supabase 연동 + Vercel 배포)

- 모든 데이터는 Supabase `programs` 테이블에 영구 저장 (`src/lib/store.tsx`).
- 등록/상태 변경/메모 수정이 즉시 DB에 반영되고 새로고침해도 유지됨.

## 페이지

| 경로 | 설명 |
| --- | --- |
| `/` | 대시보드. 접수중 공고를 마감 임박순 카드로 표시. 분야/진행상태 필터. D-day 배지(7일 이내 빨강, 14일 이내 주황, 그 외 회색) |
| `/new` | 공고 등록 폼 |
| `/program/[id]` | 공고 상세. 진행상태 드롭다운 변경 + 메모 수정 |
| `/archive` | 마감 지난 공고 목록 |

## 실행

```powershell
cd lp-tracker
npm install
npm run dev
# http://localhost:3000
```

## Supabase 테이블

`supabase/schema.sql`을 Supabase 대시보드 > SQL Editor에 붙여넣고 실행.
