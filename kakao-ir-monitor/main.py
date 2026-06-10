"""
카카오톡 IR 모니터 — 실시간 실행 진입점
사용법: python main.py
"""
import os
import time
import logging
import sys
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

ROOM_NAME = os.getenv("KAKAO_ROOM_NAME", "")
API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "15"))


def check_env() -> None:
    if not ROOM_NAME:
        print("\n[!] .env 파일에 KAKAO_ROOM_NAME 을 설정해주세요.")
        print("    예: KAKAO_ROOM_NAME=IR 공유방\n")
        sys.exit(1)
    if not API_KEY:
        print("\n[주의] ANTHROPIC_API_KEY 가 없어서 규칙 기반 파싱 모드로 실행됩니다.")
        print("       API key 는 https://console.anthropic.com 에서 무료로 발급받을 수 있습니다.\n")


def main() -> None:
    check_env()

    from kakao_reader import KakaoReader
    from ir_processor import IRProcessor
    from dashboard import save_summary, render_dashboard

    reader = KakaoReader(room_name=ROOM_NAME)
    processor = IRProcessor(api_key=API_KEY or None)

    render_dashboard()  # 초기 대시보드 생성
    dashboard_path = os.path.join(os.path.dirname(__file__), "dashboard.html")

    print(f"\n✅ 모니터링 시작 — 채팅방: '{ROOM_NAME}'")
    print(f"   대시보드: {dashboard_path}")
    print(f"   폴링 주기: {POLL_INTERVAL}초  |  Ctrl+C 로 종료\n")

    while True:
        try:
            new_msgs = reader.get_new_messages()
            if new_msgs:
                logger.info("%d개 새 메시지 감지", len(new_msgs))
                summary = processor.process(new_msgs)
                if summary:
                    logger.info("IR 감지 → %s (%s)", summary.company_name, summary.stage)
                    save_summary(summary)
                    render_dashboard()
                    print(f"\n📌 새 IR 요약 저장됨: {summary.company_name} / {summary.stage}\n")
        except KeyboardInterrupt:
            print("\n종료합니다.")
            break
        except Exception as e:
            logger.error("오류 발생: %s", e, exc_info=True)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
