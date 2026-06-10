"""
KakaoTalk PC 채팅방 메시지 읽기 모듈 (Windows UI Automation 기반)
"""
import re
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

try:
    import uiautomation as auto
    UI_AUTO_AVAILABLE = True
except ImportError:
    UI_AUTO_AVAILABLE = False

try:
    import win32gui
    import win32con
    import win32api
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class KakaoMessage:
    sender: str
    content: str
    raw_text: str
    captured_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def fingerprint(self) -> str:
        """중복 감지용 해시"""
        return f"{self.sender}:{self.content[:80]}"


class KakaoReader:
    # KakaoTalk PC 에서 사용하는 창 클래스명 목록 (버전별로 다를 수 있음)
    WINDOW_CLASSES = ["EVA_Window_Dblclk", "EVA_ChildWindow", "kakaotalk", "Qt5QWindowIcon"]

    def __init__(self, room_name: str):
        self.room_name = room_name
        self._seen: set[str] = set()

        if not UI_AUTO_AVAILABLE:
            raise RuntimeError(
                "uiautomation 패키지가 없습니다. pip install uiautomation 을 실행하세요."
            )

    # ------------------------------------------------------------------
    # 창 탐색
    # ------------------------------------------------------------------

    def _find_main_window(self) -> Optional["auto.WindowControl"]:
        """카카오톡 메인 창 탐색"""
        for cls in self.WINDOW_CLASSES:
            try:
                win = auto.WindowControl(ClassName=cls, searchDepth=1)
                if win.Exists(maxSearchSeconds=0):
                    return win
            except Exception:
                pass
        # 클래스명 실패 시 타이틀로 탐색
        try:
            win = auto.WindowControl(Name="카카오톡", searchDepth=1)
            if win.Exists(maxSearchSeconds=0):
                return win
        except Exception:
            pass
        return None

    def _open_room(self, main_win: "auto.WindowControl") -> bool:
        """채팅방 목록에서 단톡방 클릭하여 열기"""
        try:
            # 채팅방 목록 컨트롤 탐색 (ListControl 또는 TreeControl)
            for ctrl_type in [auto.ListControl, auto.TreeControl]:
                try:
                    list_ctrl = main_win.Control(ControlType=ctrl_type.ControlType, searchDepth=6)
                    if not list_ctrl.Exists(maxSearchSeconds=0):
                        continue
                    for item in list_ctrl.GetChildren():
                        if self.room_name in (item.Name or ""):
                            item.Click()
                            time.sleep(0.8)
                            return True
                except Exception:
                    pass

            # 이름으로 직접 탐색
            item = main_win.Control(Name=self.room_name, searchDepth=8)
            if item.Exists(maxSearchSeconds=0):
                item.Click()
                time.sleep(0.8)
                return True
        except Exception as e:
            logger.debug("채팅방 열기 실패: %s", e)
        return False

    # ------------------------------------------------------------------
    # 메시지 추출
    # ------------------------------------------------------------------

    def _extract_from_list(self, chat_win: "auto.WindowControl") -> list[str]:
        """ListControl 에서 메시지 텍스트 추출"""
        texts: list[str] = []
        try:
            list_ctrl = chat_win.ListControl(searchDepth=8)
            if not list_ctrl.Exists(maxSearchSeconds=0):
                return texts
            for item in list_ctrl.GetChildren():
                name = (item.Name or "").strip()
                if name:
                    texts.append(name)
        except Exception as e:
            logger.debug("ListControl 추출 실패: %s", e)
        return texts

    def _extract_via_clipboard(self, chat_win: "auto.WindowControl") -> list[str]:
        """Ctrl+A / Ctrl+C 로 클립보드에서 텍스트 추출 (폴백)"""
        if not WIN32_AVAILABLE:
            return []
        try:
            import win32clipboard
            chat_win.SetFocus()
            time.sleep(0.3)
            auto.SendKeys("{Ctrl}a")
            time.sleep(0.2)
            auto.SendKeys("{Ctrl}c")
            time.sleep(0.3)

            win32clipboard.OpenClipboard()
            text = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT)
            win32clipboard.CloseClipboard()

            if text:
                return text.splitlines()
        except Exception as e:
            logger.debug("클립보드 추출 실패: %s", e)
        return []

    def _parse_lines(self, lines: list[str]) -> list[KakaoMessage]:
        """
        카카오톡 메시지 텍스트 파싱.
        형식 예: "홍길동 : 안녕하세요"  또는  "오전 10:30\n홍길동\n안녕하세요"
        """
        messages: list[KakaoMessage] = []
        # 단순 "이름 : 내용" 패턴
        inline_pat = re.compile(r"^(.+?)\s*:\s+(.+)$")
        # "오전/오후 HH:MM" 타임스탬프 패턴
        time_pat = re.compile(r"^(오전|오후)\s+\d{1,2}:\d{2}$")

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line or time_pat.match(line):
                i += 1
                continue

            m = inline_pat.match(line)
            if m:
                sender, content = m.group(1).strip(), m.group(2).strip()
                if len(content) > 5:  # 너무 짧은 메시지 제외
                    messages.append(KakaoMessage(sender=sender, content=content, raw_text=line))
                i += 1
            else:
                # 이름만 있는 줄 다음 줄이 내용인 경우
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line and not time_pat.match(next_line) and not inline_pat.match(next_line):
                        messages.append(KakaoMessage(sender=line, content=next_line, raw_text=f"{line}: {next_line}"))
                        i += 2
                        continue
                i += 1

        return messages

    # ------------------------------------------------------------------
    # 공개 API
    # ------------------------------------------------------------------

    def get_new_messages(self) -> list[KakaoMessage]:
        """새 IR 관련 메시지만 반환 (이미 처리한 메시지 제외)"""
        main_win = self._find_main_window()
        if main_win is None:
            logger.warning("카카오톡 PC 창을 찾을 수 없습니다. 카카오톡이 실행 중인지 확인하세요.")
            return []

        # 채팅방 열기 시도
        self._open_room(main_win)
        time.sleep(0.5)

        # 메시지 추출 (UI Automation 우선, 클립보드 폴백)
        lines = self._extract_from_list(main_win)
        if not lines:
            logger.debug("ListControl 추출 결과 없음, 클립보드 폴백 시도")
            lines = self._extract_via_clipboard(main_win)

        all_messages = self._parse_lines(lines)

        new_messages: list[KakaoMessage] = []
        for msg in all_messages:
            fp = msg.fingerprint()
            if fp not in self._seen:
                self._seen.add(fp)
                new_messages.append(msg)

        # 메모리 절약: 오래된 fingerprint 정리 (최근 500개만 유지)
        if len(self._seen) > 500:
            # set은 순서가 없으므로 간단히 절반 삭제
            keep = list(self._seen)[-400:]
            self._seen = set(keep)

        return new_messages
