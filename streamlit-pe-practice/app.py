# -*- coding: utf-8 -*-
"""
PE 딜/포트폴리오 대시보드 — Streamlit 실습용 스타터
실행:  streamlit run app.py
"""
import os
import pandas as pd
import plotly.express as px
import streamlit as st
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="PE 딜 대시보드", page_icon="📊", layout="wide")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Supabase DB 컬럼 → 한국어 컬럼명 매핑
DB_TO_KR = {
    "deal_id": "딜ID",
    "company_name": "회사명",
    "industry": "산업",
    "sector": "섹터",
    "hq_region": "본사지역",
    "founded_year": "설립연도",
    "headcount": "임직원수",
    "fund_name": "펀드명",
    "fund_type": "펀드유형",
    "vintage": "빈티지",
    "partner": "담당파트너",
    "deal_status": "딜상태",
    "investment_date": "투자일자",
    "investment_amount_100m": "투자금액(억원)",
    "equity_stake_pct": "지분율(%)",
    "revenue_100m": "매출(억원)",
    "ebitda_100m": "EBITDA(억원)",
    "ebitda_margin_pct": "EBITDA마진(%)",
    "net_debt_100m": "순부채(억원)",
    "ev_100m": "기업가치EV(억원)",
    "entry_ev_ebitda": "진입 EV/EBITDA(x)",
    "entry_ev_revenue": "진입 EV/Revenue(x)",
    "holding_period_years": "보유기간(년)",
    "current_valuation_100m": "현재평가가치(억원)",
    "moic": "MOIC(x)",
    "gross_irr_pct": "Gross IRR(%)",
    "exit_date": "회수일자",
    "exit_proceeds_100m": "회수금액(억원)",
    "exit_type": "회수방식",
}

DISPLAY_COLS = list(DB_TO_KR.values())


def get_client():
    """Supabase 클라이언트 생성. 로그인된 경우 세션을 복원한다."""
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    if st.session_state.get("access_token") and st.session_state.get("refresh_token"):
        try:
            client.auth.set_session(
                st.session_state["access_token"],
                st.session_state["refresh_token"],
            )
        except Exception:
            # 토큰 만료 시 세션 초기화
            st.session_state.clear()
    return client


def show_auth_page():
    st.title("📊 PE 딜 대시보드")
    st.caption("로그인 후 이용하실 수 있습니다.")
    st.divider()

    col_center = st.columns([1, 2, 1])[1]
    with col_center:
        tab_login, tab_signup = st.tabs(["로그인", "회원가입"])

        with tab_login:
            with st.form("login_form"):
                email = st.text_input("이메일", placeholder="example@email.com")
                password = st.text_input("비밀번호", type="password")
                submitted = st.form_submit_button("로그인", use_container_width=True)

            if submitted:
                if not email or not password:
                    st.error("이메일과 비밀번호를 입력해주세요.")
                else:
                    try:
                        client = create_client(SUPABASE_URL, SUPABASE_KEY)
                        response = client.auth.sign_in_with_password(
                            {"email": email, "password": password}
                        )
                        st.session_state["user"] = response.user
                        st.session_state["access_token"] = response.session.access_token
                        st.session_state["refresh_token"] = response.session.refresh_token
                        st.rerun()
                    except Exception as e:
                        err = str(e)
                        if "Invalid login credentials" in err:
                            st.error("이메일 또는 비밀번호가 올바르지 않습니다.")
                        elif "Email not confirmed" in err:
                            st.warning("이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.")
                        else:
                            st.error(f"로그인 실패: {err}")

        with tab_signup:
            with st.form("signup_form"):
                new_email = st.text_input("이메일", placeholder="example@email.com", key="su_email")
                new_password = st.text_input("비밀번호 (6자 이상)", type="password", key="su_pw")
                new_password2 = st.text_input("비밀번호 확인", type="password", key="su_pw2")
                submitted_signup = st.form_submit_button("회원가입", use_container_width=True)

            if submitted_signup:
                if not new_email or not new_password:
                    st.error("이메일과 비밀번호를 입력해주세요.")
                elif new_password != new_password2:
                    st.error("비밀번호가 일치하지 않습니다.")
                elif len(new_password) < 6:
                    st.error("비밀번호는 6자 이상이어야 합니다.")
                else:
                    try:
                        client = create_client(SUPABASE_URL, SUPABASE_KEY)
                        response = client.auth.sign_up(
                            {"email": new_email, "password": new_password}
                        )
                        if response.session:
                            # 이메일 확인 비활성화 상태 → 즉시 로그인
                            st.session_state["user"] = response.user
                            st.session_state["access_token"] = response.session.access_token
                            st.session_state["refresh_token"] = response.session.refresh_token
                            st.rerun()
                        else:
                            # 이메일 확인 필요
                            st.success("회원가입 완료! 이메일함에서 인증 링크를 확인해주세요.")
                    except Exception as e:
                        err = str(e)
                        if "User already registered" in err:
                            st.error("이미 가입된 이메일입니다. 로그인 탭을 이용해주세요.")
                        else:
                            st.error(f"회원가입 실패: {err}")


@st.cache_data(ttl=60)
def load_data(_client) -> pd.DataFrame:
    res = _client.table("pe_deals").select("*").execute()
    df = pd.DataFrame(res.data)
    df.rename(columns=DB_TO_KR, inplace=True)
    for col in ["투자일자", "회수일자"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df[DISPLAY_COLS]


def show_dashboard(client):
    # ------------------------------------------------------------------
    # 사이드바
    # ------------------------------------------------------------------
    with st.sidebar:
        user_email = st.session_state["user"].email
        st.caption(f"로그인: **{user_email}**")
        if st.button("로그아웃", use_container_width=True):
            try:
                client.auth.sign_out()
            except Exception:
                pass
            st.session_state.clear()
            st.rerun()

        st.divider()

        df = load_data(client)

        st.header("🔎 필터")
        funds = st.multiselect("펀드", sorted(df["펀드명"].dropna().unique()))
        industries = st.multiselect("산업", sorted(df["산업"].dropna().unique()))
        statuses = st.multiselect("딜상태", df["딜상태"].dropna().unique().tolist())
        regions = st.multiselect("본사지역", sorted(df["본사지역"].dropna().unique()))

    f = df.copy()
    if funds:
        f = f[f["펀드명"].isin(funds)]
    if industries:
        f = f[f["산업"].isin(industries)]
    if statuses:
        f = f[f["딜상태"].isin(statuses)]
    if regions:
        f = f[f["본사지역"].isin(regions)]

    # ------------------------------------------------------------------
    # KPI 카드
    # ------------------------------------------------------------------
    st.title("📊 PE 딜 / 포트폴리오 대시보드")
    st.caption("Supabase 연동 — 딜 파이프라인부터 회수까지")

    invested = f[f["딜상태"].isin(["투자완료", "회수완료"])]
    exited = f[f["딜상태"] == "회수완료"]

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("전체 딜", f"{len(f):,}건")
    c2.metric("투자 집행", f"{len(invested):,}건")
    c3.metric("총 투자금액", f"{invested['투자금액(억원)'].sum():,.0f}억")
    c4.metric("평균 MOIC", f"{invested['MOIC(x)'].mean():.2f}x" if len(invested) else "-")
    c5.metric("회수 딜 평균 IRR", f"{exited['Gross IRR(%)'].mean():.1f}%" if len(exited) else "-")

    st.divider()

    # ------------------------------------------------------------------
    # 차트
    # ------------------------------------------------------------------
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("딜 상태 분포")
        status_cnt = f["딜상태"].value_counts().reset_index()
        status_cnt.columns = ["딜상태", "건수"]
        fig = px.bar(status_cnt, x="건수", y="딜상태", orientation="h")
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("산업별 투자금액")
        by_ind = invested.groupby("산업")["투자금액(억원)"].sum().reset_index()
        fig = px.pie(by_ind, names="산업", values="투자금액(억원)", hole=0.4)
        st.plotly_chart(fig, use_container_width=True)

    col3, col4 = st.columns(2)

    with col3:
        st.subheader("진입 EV/EBITDA vs MOIC")
        sc = invested.dropna(subset=["MOIC(x)"])
        fig = px.scatter(
            sc, x="진입 EV/EBITDA(x)", y="MOIC(x)",
            color="산업", size="투자금액(억원)", hover_name="회사명",
        )
        st.plotly_chart(fig, use_container_width=True)

    with col4:
        st.subheader("빈티지별 평균 IRR")
        by_vin = exited.groupby("빈티지")["Gross IRR(%)"].mean().reset_index()
        fig = px.bar(by_vin, x="빈티지", y="Gross IRR(%)")
        st.plotly_chart(fig, use_container_width=True)

    # ------------------------------------------------------------------
    # 원본 테이블
    # ------------------------------------------------------------------
    st.divider()
    st.subheader(f"📋 딜 목록 ({len(f):,}건)")
    st.dataframe(f, use_container_width=True, height=400)

    st.download_button(
        "필터된 데이터 CSV 다운로드",
        f.to_csv(index=False).encode("utf-8-sig"),
        "filtered_pe_deals.csv",
        "text/csv",
    )


# ------------------------------------------------------------------
# 메인 진입점
# ------------------------------------------------------------------
if st.session_state.get("user"):
    client = get_client()
    show_dashboard(client)
else:
    show_auth_page()
