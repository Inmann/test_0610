# 카카오톡 IR 모니터

VC 단톡방을 실시간 모니터링하여 IR 메시지를 자동 요약 · HTML 대시보드로 표시합니다.

---

## 구조

```
kakao-ir-monitor/
├── main.py               진입점 (실시간 모니터링 루프)
├── kakao_reader.py       Windows UI Automation 기반 카톡 메시지 읽기
├── ir_processor.py       IR 감지 + Claude API 요약 (API key 없으면 규칙 기반)
├── dashboard.py          HTML 대시보드 생성
├── data/summaries.json   누적 요약 데이터 (자동 생성)
└── dashboard.html        대시보드 출력 (자동 생성)
```

---

## 설치

```powershell
cd C:\Users\Henry\kakao-ir-monitor
pip install -r requirements.txt
```

---

## 설정

1. `.env` 파일 생성 (`.env.example` 복사):

```powershell
Copy-Item .env.example .env
```

2. `.env` 파일 편집:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx   # https://console.anthropic.com 에서 발급
KAKAO_ROOM_NAME=IR 단톡방            # 모니터링할 단톡방 이름 (정확히)
POLL_INTERVAL=15                     # 폴링 주기(초)
```

> API key 없이도 규칙 기반 파싱 모드로 동작합니다.

---

## 실행

1. **카카오톡 PC를 먼저 실행**하고 모니터링할 단톡방이 목록에 보이는 상태로 둡니다.
2. 스크립트 실행:

```powershell
python main.py
```

3. 브라우저에서 `dashboard.html` 파일을 열면 30초마다 자동 갱신됩니다.

---

## Anthropic API Key 발급 (무료)

1. https://console.anthropic.com 접속 → 회원가입
2. **API Keys** 메뉴 → **Create Key**
3. 발급된 키(`sk-ant-...`)를 `.env`의 `ANTHROPIC_API_KEY`에 붙여넣기

---

## 주의사항

- 카카오톡 PC가 실행 중이어야 합니다.
- Windows UI Automation이 카카오톡 버전에 따라 동작하지 않을 수 있습니다.
  - 이 경우 클립보드 폴백 방식으로 자동 전환됩니다.
- 관리자 권한으로 실행하면 UI Automation 접근이 더 안정적입니다.
