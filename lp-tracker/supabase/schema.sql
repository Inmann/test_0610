-- LP 출자사업 트래커: programs 테이블 생성 SQL
-- Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 Run 하세요.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  institution text not null,                          -- 출자기관 (예: 한국성장금융)
  title text not null,                                -- 사업명
  category text not null
    check (category in ('PEF', 'VC', '크레딧', '세컨더리', '인프라')),
  total_size text,                                    -- 총 출자규모
  num_gps text,                                       -- 선정 운용사 수
  announce_date date,                                 -- 공고일
  deadline date not null,                             -- 접수 마감일 (D-day 기준)
  presentation_date date,                             -- PT 예정일 (선택)
  result_date date,                                   -- 선정 발표 예정일 (선택)
  url text,                                           -- 공고 원문 링크
  our_status text not null default '미검토'
    check (our_status in ('미검토', '검토중', '지원예정', '제안서제출', 'PT', '선정', '미선정', '패스')),
  memo text,                                          -- 내부 메모
  created_at timestamptz not null default now()
);

-- 대시보드/아카이브가 항상 마감일 기준으로 조회하므로 인덱스 추가
create index programs_deadline_idx on public.programs (deadline);

-- RLS(행 수준 보안) 활성화 + 전체 허용 정책
-- 사내용 1단계라 누구나 읽기/쓰기 가능하게 열어둡니다.
-- 추후 로그인(Auth)을 붙이면 authenticated 전용으로 좁히세요.
alter table public.programs enable row level security;

create policy "programs_select_all" on public.programs
  for select to anon, authenticated using (true);

create policy "programs_insert_all" on public.programs
  for insert to anon, authenticated with check (true);

create policy "programs_update_all" on public.programs
  for update to anon, authenticated using (true) with check (true);

create policy "programs_delete_all" on public.programs
  for delete to anon, authenticated using (true);
