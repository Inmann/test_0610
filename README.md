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

## 주의
`.env` 파일은 `.gitignore`로 제외됩니다. 각 프로젝트의 `.env.example`을 참고해 직접 생성하세요.
