"""
IR 메시지 감지 및 Claude API 요약 모듈
API key 없을 때는 규칙 기반 파싱으로 폴백
"""
import re
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# IR 관련 키워드 (이 중 하나라도 포함 시 IR 메시지로 간주)
IR_KEYWORDS = [
    "투자", "펀딩", "시리즈", "라운드", "IR", "피칭", "스타트업",
    "Pre-A", "Pre A", "시드", "Seed", "Series", "억원", "억 원",
    "BM", "비즈니스 모델", "MAU", "DAU", "ARR", "MRR", "GMV",
    "누적 투자", "투자 유치", "후속 투자", "Exit", "IPO", "M&A",
    "창업자", "대표이사", "CEO", "CTO", "공동창업",
]

IR_KEYWORDS_LOWER = [k.lower() for k in IR_KEYWORDS]


@dataclass
class IRSummary:
    company_name: str
    business: str           # 사업 내용 한 줄
    stage: str              # 투자 단계 (Seed / Pre-A / Series A 등)
    amount: str             # 목표 투자 금액
    key_metrics: str        # 주요 지표
    contact: str            # 연락처 또는 발신자
    raw_messages: list[str] = field(default_factory=list)
    summarized_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    source: str = "claude"  # "claude" | "regex"

    def to_dict(self) -> dict:
        return asdict(self)


def is_ir_message(text: str) -> bool:
    """IR 관련 메시지인지 빠르게 판별"""
    text_lower = text.lower()
    return any(kw in text_lower for kw in IR_KEYWORDS_LOWER)


# ------------------------------------------------------------------
# 규칙 기반 폴백 파서
# ------------------------------------------------------------------

def _regex_extract(text: str, sender: str) -> IRSummary:
    """API key 없을 때 정규식으로 기본 정보 추출"""
    # 회사명: "OO(주)", "주식회사 OO", "(주)OO" 또는 따옴표/괄호 안 이름
    company = ""
    m = re.search(r"['\"]([^'\"]{2,20})['\"]", text)
    if m:
        company = m.group(1)
    if not company:
        m = re.search(r"(?:주식회사|㈜|\(주\))\s*([^\s,\.]{2,10})", text)
        if m:
            company = m.group(1)
    if not company:
        company = "미확인"

    # 투자 단계
    stage = "미확인"
    for kw in ["Pre-Seed", "Seed", "Pre-A", "Series A", "시리즈A", "Series B", "시리즈B", "시드"]:
        if kw.lower() in text.lower():
            stage = kw
            break

    # 금액
    amount = "미확인"
    m = re.search(r"(\d+[\.,]?\d*\s*억)", text)
    if m:
        amount = m.group(1)

    # 지표
    metrics_parts = []
    for kw in ["MAU", "DAU", "ARR", "MRR", "GMV", "누적 매출", "월 매출"]:
        m = re.search(rf"{kw}\s*[:\s]\s*([^\s,\.]+)", text, re.IGNORECASE)
        if m:
            metrics_parts.append(f"{kw}: {m.group(1)}")
    key_metrics = ", ".join(metrics_parts) if metrics_parts else "정보 없음"

    # 사업 내용: 첫 문장 또는 처음 100자
    business = text.split(".")[0].strip()[:100] if "." in text else text[:100]

    return IRSummary(
        company_name=company,
        business=business,
        stage=stage,
        amount=amount,
        key_metrics=key_metrics,
        contact=sender,
        source="regex",
    )


# ------------------------------------------------------------------
# Claude API 요약
# ------------------------------------------------------------------

def _claude_summarize(client, messages_text: str, sender: str) -> IRSummary:
    prompt = f"""다음은 VC 단톡방에 올라온 IR(투자 유치) 관련 메시지입니다.
아래 JSON 형식으로만 응답하세요. 모르는 항목은 "미확인"으로 채우세요.

메시지:
---
{messages_text}
---

응답 형식 (JSON만, 설명 없이):
{{
  "company_name": "회사명",
  "business": "한 문장 사업 설명",
  "stage": "투자 단계 (Seed/Pre-A/Series A 등)",
  "amount": "목표 투자 금액",
  "key_metrics": "주요 지표 (MAU, ARR 등)",
  "contact": "연락처 또는 발신자"
}}"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    # JSON 블록 추출
    m = re.search(r"\{[\s\S]+\}", raw)
    if not m:
        raise ValueError(f"JSON 파싱 실패: {raw[:200]}")
    data = json.loads(m.group())

    return IRSummary(
        company_name=data.get("company_name", "미확인"),
        business=data.get("business", ""),
        stage=data.get("stage", "미확인"),
        amount=data.get("amount", "미확인"),
        key_metrics=data.get("key_metrics", ""),
        contact=data.get("contact", sender),
        source="claude",
    )


# ------------------------------------------------------------------
# 공개 API
# ------------------------------------------------------------------

class IRProcessor:
    def __init__(self, api_key: Optional[str] = None):
        self._client = None
        if api_key:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=api_key)
                logger.info("Claude API 연결 완료")
            except ImportError:
                logger.warning("anthropic 패키지 미설치. pip install anthropic 실행 후 재시작하세요.")
        else:
            logger.warning("ANTHROPIC_API_KEY 없음 — 규칙 기반 파싱 모드로 실행합니다.")

    def process(self, messages: list) -> Optional[IRSummary]:
        """
        KakaoMessage 목록에서 IR 내용을 감지하고 요약 반환.
        IR 내용이 없으면 None 반환.
        """
        from kakao_reader import KakaoMessage  # 순환 import 방지

        ir_msgs = [m for m in messages if is_ir_message(m.content)]
        if not ir_msgs:
            return None

        combined_text = "\n".join(f"{m.sender}: {m.content}" for m in ir_msgs)
        sender = ir_msgs[0].sender

        summary: IRSummary
        if self._client:
            try:
                summary = _claude_summarize(self._client, combined_text, sender)
            except Exception as e:
                logger.error("Claude API 오류 (%s), 규칙 기반으로 폴백", e)
                summary = _regex_extract(combined_text, sender)
        else:
            summary = _regex_extract(combined_text, sender)

        summary.raw_messages = [m.raw_text for m in ir_msgs]
        return summary
