# test_0610

2026-06-10 작업 모음

## 프로젝트

### `kakao-ir-monitor/`
카카오톡 단톡방의 IR(투자 유치) 메시지를 수집·요약해 HTML 대시보드로 보여주는 도구.

### `streamlit-pe-practice/`
PE(사모펀드) 딜/포트폴리오 대시보드 Streamlit 실습.
- `generate_data.py` — 더미 딜 데이터 생성기 (`python generate_data.py 1500`)
- `data/pe_deals.csv` — 1,500행 × 29열 샘플 데이터
- `app.py` — Streamlit 대시보드 (`streamlit run app.py`)

### `samcheonri-club/`
삼천리 동아리 커뮤니티 — Next.js + Supabase 웹앱.
- 로컬 실행: `cd samcheonri-club; npm run dev`
- 배포 사이트: https://test-0611-omega.vercel.app

#### 배포 방법
Vercel CLI(전역 설치, 로그인 필요)로 `samcheonri-club/`을 직접 프로덕션 배포한다.
폴더는 Vercel 프로젝트 `test-0611`에 링크되어 있다 (`samcheonri-club/.vercel/`).

```powershell
.\deploy.ps1
```

스크립트가 하는 일: ① `samcheonri-club/` 변경분 커밋 여부 확인 → ② origin 푸시 →
③ `vercel deploy --prod` (CLI가 빌드·배포·도메인 연결까지 자동 처리).

환경 변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)는
Vercel 프로젝트(Production)에 등록되어 있다. 값 변경 시 `vercel env` 또는 대시보드에서 수정.

> 참고: [test_0611](https://github.com/Inmann/test_0611) 저장소를 통한 git 연동 배포
> (`git subtree push --prefix=samcheonri-club test0611 main`)도 여전히 동작하는 백업 경로다.

## 주의
`.env` 파일은 `.gitignore`로 제외됩니다. 각 프로젝트의 `.env.example`을 참고해 직접 생성하세요.
