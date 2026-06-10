# -*- coding: utf-8 -*-
"""
PE(사모펀드) 딜 트래킹 / 포트폴리오 더미 데이터 생성기
- Streamlit 대시보드 실습용 대량 CSV 생성
- PE 실무에서 쓰는 엑셀 시트(딜 파이프라인 + 포트폴리오 트래커)와 유사한 컬럼 구성
- 내부 정합성 유지: EBITDA = 매출 * 마진, EV = EBITDA * 멀티플, MOIC -> IRR 등

사용법:
    python generate_data.py            # 기본 1,000행
    python generate_data.py 3000       # 행 수 지정
"""
import csv
import sys
import random
from datetime import date, timedelta

random.seed(42)

TODAY = date(2026, 6, 10)
OUT_PATH = "data/pe_deals.csv"

# ------------------------------------------------------------------
# 마스터 데이터 (실무 분류 체계 모사)
# ------------------------------------------------------------------
INDUSTRY_SECTORS = {
    "제조/소재": ["자동차부품", "산업기계", "정밀화학", "2차전지소재", "철강금속"],
    "IT/소프트웨어": ["SaaS", "핀테크", "정보보안", "데이터/AI", "시스템통합"],
    "바이오/헬스케어": ["제약", "의료기기", "체외진단", "디지털헬스", "CRO/CDMO"],
    "소비재": ["식음료", "화장품", "패션/리빙", "리테일"],
    "물류/유통": ["3PL물류", "이커머스", "콜드체인", "도소매유통"],
    "에너지/환경": ["신재생에너지", "폐기물처리", "전력/전기", "수처리"],
    "미디어/콘텐츠": ["게임", "광고/마케팅", "엔터테인먼트", "교육"],
    "금융서비스": ["여신전문", "자산관리", "인슈어테크", "결제"],
    "B2B서비스": ["인력아웃소싱", "시설관리", "엔지니어링", "MRO"],
}

NAME_PREFIX = [
    "한국", "대한", "동방", "미래", "신성", "우진", "태광", "서연", "한라", "삼정",
    "코리아", "글로벌", "정밀", "케이", "에스", "디에이치", "누리", "가온", "아이엠",
    "제이", "성안", "동성", "유진", "한솔", "대명", "세진", "광림", "보광", "현우", "중앙",
]
NAME_SUFFIX_BY_IND = {
    "제조/소재": ["산업", "정밀", "소재", "테크", "메탈", "케미칼"],
    "IT/소프트웨어": ["소프트", "테크", "시스템", "솔루션", "랩스", "정보기술"],
    "바이오/헬스케어": ["바이오", "제약", "메디컬", "헬스케어", "파마", "진단"],
    "소비재": ["식품", "코스메틱", "리빙", "F&B", "푸드", "유통"],
    "물류/유통": ["로지스틱스", "물류", "유통", "커머스", "익스프레스"],
    "에너지/환경": ["에너지", "환경", "이엔지", "파워", "그린텍"],
    "미디어/콘텐츠": ["엔터", "미디어", "스튜디오", "게임즈", "콘텐츠"],
    "금융서비스": ["파이낸셜", "캐피탈", "에셋", "페이", "금융"],
    "B2B서비스": ["서비스", "이엔지", "솔루션", "파트너스", "매니지먼트"],
}

REGIONS = [
    ("서울", 0.30), ("경기", 0.22), ("인천", 0.06), ("부산", 0.06), ("대구", 0.04),
    ("대전", 0.04), ("광주", 0.03), ("울산", 0.03), ("충남", 0.03), ("충북", 0.02),
    ("경북", 0.03), ("경남", 0.03), ("전북", 0.02), ("전남", 0.02), ("강원", 0.01),
    ("제주", 0.01), ("해외(미국)", 0.01), ("해외(베트남)", 0.01), ("해외(싱가포르)", 0.01),
]

FUNDS = [
    ("그로쓰 1호 PEF", 2016, "Growth"),
    ("그로쓰 2호 PEF", 2019, "Growth"),
    ("그로쓰 3호 PEF", 2022, "Growth"),
    ("바이아웃 1호 PEF", 2017, "Buyout"),
    ("바이아웃 2호 PEF", 2021, "Buyout"),
    ("벤처그로쓰 1호", 2020, "Venture"),
    ("스페셜시츄에이션 1호", 2018, "Special Situation"),
    ("세컨더리 1호", 2023, "Secondary"),
]

# 담당 파트너(심사역) 명단
PARTNERS = [
    "김도현", "이서준", "박민재", "정우성", "최예린", "강태호", "윤지호", "임수빈",
    "한승우", "오세훈", "서지원", "남기훈", "배준영", "고은채",
]

# 딜 상태(파이프라인 단계) 및 가중치
DEAL_STATUS = [
    ("소싱(Sourcing)", 0.14),
    ("스크리닝(Screening)", 0.12),
    ("실사(DD)", 0.10),
    ("투자심의(IC)", 0.06),
    ("투자완료(Active)", 0.38),
    ("회수완료(Exited)", 0.15),
    ("보류/철회(Dropped)", 0.05),
]

EXIT_TYPES = ["IPO", "전략적매각(M&A)", "재무적매각(Secondary)", "Recap/배당", "구주매출"]


def weighted_choice(pairs):
    r = random.random()
    cum = 0.0
    for value, w in pairs:
        cum += w
        if r <= cum:
            return value
    return pairs[-1][0]


def make_company_name(industry, used):
    for _ in range(50):
        name = random.choice(NAME_PREFIX) + random.choice(NAME_SUFFIX_BY_IND[industry])
        if name not in used:
            used.add(name)
            return name
    # 충돌 시 숫자 접미
    name = random.choice(NAME_PREFIX) + random.choice(NAME_SUFFIX_BY_IND[industry]) + str(random.randint(2, 99))
    used.add(name)
    return name


def rand_date(start: date, end: date) -> date:
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def fmt(x, nd=1):
    return round(x, nd)


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    used_names = set()
    rows = []

    for i in range(1, n + 1):
        industry = random.choice(list(INDUSTRY_SECTORS.keys()))
        sector = random.choice(INDUSTRY_SECTORS[industry])
        name = make_company_name(industry, used_names)
        region = weighted_choice(REGIONS)
        fund_name, vintage, fund_type = random.choice(FUNDS)
        partner = random.choice(PARTNERS)
        status = weighted_choice(DEAL_STATUS)
        founded = random.randint(1985, 2021)

        # --- 타깃 재무(모든 딜에 존재: 실사 대상 재무) ---
        revenue = round(random.lognormvariate(6.0, 0.9))   # 억원, 대략 50~5,000
        revenue = max(30, min(revenue, 8000))
        margin = round(random.uniform(0.05, 0.40), 3)       # EBITDA 마진
        ebitda = revenue * margin
        entry_ev_ebitda = round(random.uniform(5.0, 15.0), 1)
        ev = ebitda * entry_ev_ebitda
        net_debt = ev * random.uniform(0.0, 0.5)
        equity_value = max(ev - net_debt, ev * 0.3)
        ev_revenue = ev / revenue
        employees = max(10, int(revenue * random.uniform(0.8, 3.0)))

        # --- 딜 단계별 채움 ---
        is_invested = status in ("투자완료(Active)", "회수완료(Exited)")
        is_pipeline = status in ("소싱(Sourcing)", "스크리닝(Screening)", "실사(DD)", "투자심의(IC)")

        entry_date = ""
        invest_amt = ""
        stake = ""
        hold_years = ""
        current_val = ""
        moic = ""
        irr = ""
        exit_date = ""
        exit_amt = ""
        exit_type = ""

        if is_invested:
            edate = rand_date(date(max(vintage, 2016), 1, 1), date(2025, 6, 30))
            entry_date = edate.isoformat()
            stake_v = round(random.uniform(20, 100), 1)
            invest_amt_v = equity_value * (stake_v / 100.0) * random.uniform(1.0, 1.25)  # 경영권 프리미엄
            stake = stake_v
            invest_amt = fmt(invest_amt_v)

            if status == "회수완료(Exited)":
                # 보유기간 1.5~7년
                hold_d = random.randint(int(1.5 * 365), int(7 * 365))
                xdate = min(edate + timedelta(days=hold_d), TODAY)
                yrs = max((xdate - edate).days / 365.25, 0.5)
                moic_v = max(0.1, random.lognormvariate(0.65, 0.45))   # 중앙값 ~1.9x
                moic_v = min(moic_v, 8.0)
                exit_amt_v = invest_amt_v * moic_v
                irr_v = (moic_v ** (1.0 / yrs) - 1.0) * 100.0
                exit_date = xdate.isoformat()
                hold_years = fmt(yrs)
                exit_amt = fmt(exit_amt_v)
                moic = fmt(moic_v, 2)
                irr = fmt(irr_v)
                exit_type = random.choice(EXIT_TYPES)
            else:  # Active: 현재 평가가치(미실현)
                yrs = max((TODAY - edate).days / 365.25, 0.3)
                moic_v = max(0.2, random.lognormvariate(0.45, 0.4))    # 중앙값 ~1.5x
                moic_v = min(moic_v, 6.0)
                cur_v = invest_amt_v * moic_v
                irr_v = (moic_v ** (1.0 / yrs) - 1.0) * 100.0
                hold_years = fmt(yrs)
                current_val = fmt(cur_v)
                moic = fmt(moic_v, 2)
                irr = fmt(irr_v)

        rows.append({
            "딜ID": f"DL-{i:05d}",
            "회사명": name,
            "산업": industry,
            "섹터": sector,
            "본사지역": region,
            "설립연도": founded,
            "임직원수": employees,
            "펀드명": fund_name,
            "펀드유형": fund_type,
            "빈티지": vintage,
            "담당파트너": partner,
            "딜상태": status,
            "투자일자": entry_date,
            "투자금액(억원)": invest_amt,
            "지분율(%)": stake,
            "매출(억원)": fmt(revenue, 0),
            "EBITDA(억원)": fmt(ebitda),
            "EBITDA마진(%)": fmt(margin * 100),
            "순부채(억원)": fmt(net_debt),
            "기업가치EV(억원)": fmt(ev),
            "진입 EV/EBITDA(x)": entry_ev_ebitda,
            "진입 EV/Revenue(x)": fmt(ev_revenue, 2),
            "보유기간(년)": hold_years,
            "현재평가가치(억원)": current_val,
            "MOIC(x)": moic,
            "Gross IRR(%)": irr,
            "회수일자": exit_date,
            "회수금액(억원)": exit_amt,
            "회수방식": exit_type,
        })

    fieldnames = list(rows[0].keys())
    # Excel 한글 호환을 위해 utf-8-sig(BOM)
    with open(OUT_PATH, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"생성 완료: {OUT_PATH}  ({len(rows):,}행 x {len(fieldnames)}열)")


if __name__ == "__main__":
    main()
