# LP 출자사업 트래커

연기금·공제회·정책기관의 PEF/VC 출자사업 공고를 등록하고, 접수 마감 D-day와
우리 회사의 지원 진행 상태를 한 화면에서 관리하는 사내 대시보드.

Next.js (App Router) + TypeScript + Tailwind CSS v4. 추후 Supabase 연동 + Vercel 배포 예정.

## 현재 단계 (1단계: 더미 데이터)

- DB 연동 전 단계. `src/data/programs.ts`의 더미 데이터 5건으로 동작.
- 등록/상태 변경/메모 수정은 화면에서 동작하지만 **새로고침하면 초기화**됨 (인메모리 스토어 `src/lib/store.tsx`).
- 다음 단계에서 스토어 내부를 Supabase 호출로 교체.

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
