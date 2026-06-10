# -*- coding: utf-8 -*-
"""
PE 딜/포트폴리오 대시보드 — Streamlit 실습용 스타터
실행:  streamlit run app.py
"""
import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="PE 딜 대시보드", page_icon="📊", layout="wide")

DATA_PATH = "data/pe_deals.csv"


@st.cache_data
def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    # 날짜 컬럼 파싱
    for col in ["투자일자", "회수일자"]:
        df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


df = load_data(DATA_PATH)

st.title("📊 PE 딜 / 포트폴리오 대시보드")
st.caption("Streamlit 실습용 더미 데이터 — 딜 파이프라인부터 회수까지")

# ------------------------------------------------------------------
# 사이드바 필터
# ------------------------------------------------------------------
with st.sidebar:
    st.header("🔎 필터")
    funds = st.multiselect("펀드", sorted(df["펀드명"].unique()))
    industries = st.multiselect("산업", sorted(df["산업"].unique()))
    statuses = st.multiselect("딜상태", df["딜상태"].unique().tolist())
    regions = st.multiselect("본사지역", sorted(df["본사지역"].unique()))

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
invested = f[f["딜상태"].isin(["투자완료(Active)", "회수완료(Exited)"])]
exited = f[f["딜상태"] == "회수완료(Exited)"]

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
