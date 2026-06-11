-- ============================================================
-- Migration: 초기 스키마 생성
-- Projects: kakao-ir-monitor, streamlit-pe-practice
-- ============================================================

-- ============================================================
-- 1. ir_summaries
--    카카오톡 IR 메시지 → Claude 요약 결과 저장
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ir_summaries (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name     TEXT        NOT NULL,
    business         TEXT,                           -- 한 줄 사업 설명
    stage            TEXT,                           -- Seed, Pre-A, Series A, ...
    amount           TEXT,                           -- 목표 투자금 (e.g. "30억원")
    key_metrics      TEXT,                           -- MAU, ARR, GMV 등
    contact          TEXT,                           -- 발신자/연락처
    raw_messages     JSONB       NOT NULL DEFAULT '[]',  -- 원본 카톡 메시지 배열
    summarized_at    TIMESTAMPTZ,
    source           TEXT        NOT NULL DEFAULT 'claude'
                         CHECK (source IN ('claude', 'regex', 'manual')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ir_company   ON public.ir_summaries (company_name);
CREATE INDEX IF NOT EXISTS idx_ir_stage     ON public.ir_summaries (stage);
CREATE INDEX IF NOT EXISTS idx_ir_ts        ON public.ir_summaries (summarized_at DESC);
CREATE INDEX IF NOT EXISTS idx_ir_source    ON public.ir_summaries (source);

-- 전문 검색 인덱스 (회사명 + 사업내용)
CREATE INDEX IF NOT EXISTS idx_ir_fts ON public.ir_summaries
    USING GIN (to_tsvector('simple', coalesce(company_name, '') || ' ' || coalesce(business, '')));

-- RLS
ALTER TABLE public.ir_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ir_summaries: authenticated full access"
    ON public.ir_summaries FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ir_summaries: anon read only"
    ON public.ir_summaries FOR SELECT
    TO anon USING (true);


-- ============================================================
-- 2. pe_deals
--    PE 딜 포트폴리오 (29개 필드 → 정규화된 컬럼)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pe_deals (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 딜 식별
    deal_id         TEXT        UNIQUE NOT NULL,     -- DL-00001 형식
    company_name    TEXT        NOT NULL,
    industry        TEXT,                            -- 산업 대분류
    sector          TEXT,                            -- 세부 섹터
    hq_region       TEXT,                            -- 본사 지역
    founded_year    SMALLINT,
    headcount       INTEGER,

    -- 펀드 정보
    fund_name       TEXT,
    fund_type       TEXT        CHECK (fund_type IN (
                        'Growth', 'Buyout', 'Venture', 'Secondary', 'Special Situation'
                    )),
    vintage         SMALLINT,
    partner         TEXT,                            -- 담당 파트너
    deal_status     TEXT        CHECK (deal_status IN (
                        '소싱', '스크리닝', '실사', '투자심의',
                        '투자완료', '회수완료', '보류/철회'
                    )),

    -- 진입 재무 지표
    revenue_100m        NUMERIC(15, 2),              -- 매출 (억원)
    ebitda_100m         NUMERIC(15, 2),              -- EBITDA (억원)
    ebitda_margin_pct   NUMERIC(6, 2),               -- EBITDA 마진 (%)
    net_debt_100m       NUMERIC(15, 2),              -- 순부채 (억원)
    ev_100m             NUMERIC(15, 2),              -- EV (억원)
    entry_ev_ebitda     NUMERIC(8, 2),               -- 진입 EV/EBITDA (x)
    entry_ev_revenue    NUMERIC(8, 2),               -- 진입 EV/Revenue (x)

    -- 투자 정보 (투자완료 이후)
    investment_date         DATE,
    investment_amount_100m  NUMERIC(15, 2),          -- 투자금액 (억원)
    equity_stake_pct        NUMERIC(6, 2),           -- 지분율 (%)
    holding_period_years    NUMERIC(5, 2),           -- 보유기간 (년)
    current_valuation_100m  NUMERIC(15, 2),          -- 현재 평가가치 (억원)
    moic                    NUMERIC(8, 3),           -- MOIC (x)
    gross_irr_pct           NUMERIC(8, 2),           -- Gross IRR (%)

    -- 회수 정보 (회수완료)
    exit_date               DATE,
    exit_proceeds_100m      NUMERIC(15, 2),          -- 회수금액 (억원)
    exit_type               TEXT        CHECK (exit_type IN (
                                'IPO', '전략적매각/M&A', '재무적매각/Secondary',
                                'Recap/배당', '구주매출'
                            )),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pe_company       ON public.pe_deals (company_name);
CREATE INDEX IF NOT EXISTS idx_pe_industry      ON public.pe_deals (industry);
CREATE INDEX IF NOT EXISTS idx_pe_fund          ON public.pe_deals (fund_name);
CREATE INDEX IF NOT EXISTS idx_pe_status        ON public.pe_deals (deal_status);
CREATE INDEX IF NOT EXISTS idx_pe_vintage       ON public.pe_deals (vintage);
CREATE INDEX IF NOT EXISTS idx_pe_inv_date      ON public.pe_deals (investment_date);
CREATE INDEX IF NOT EXISTS idx_pe_fund_status   ON public.pe_deals (fund_name, deal_status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pe_deals_updated_at
    BEFORE UPDATE ON public.pe_deals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.pe_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_deals: authenticated full access"
    ON public.pe_deals FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "pe_deals: anon read only"
    ON public.pe_deals FOR SELECT
    TO anon USING (true);
