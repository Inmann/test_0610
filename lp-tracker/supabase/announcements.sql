-- LP 출자사업 트래커: 자동 수집 공고 임시 보관 테이블
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  source_url    text not null unique,          -- 원본 URL (중복 방지 키)
  scraper       text not null,                 -- 수집 출처: 'kofia' | 'kvca' | 'kvic' | 'kgrowth' | 'nps'
  raw_title     text not null,                 -- 원본 제목 그대로
  institution   text,                          -- [기관명] 파싱 결과
  title         text not null,                 -- [기관명] 제거한 순수 제목
  announced_at  date,                          -- 공고 작성일
  promoted      boolean not null default false, -- programs 테이블로 승격 여부
  program_id    uuid references public.programs(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index announcements_announced_at_idx on public.announcements (announced_at desc);
create index announcements_not_promoted_idx on public.announcements (promoted) where not promoted;

-- RLS: 사내 전용이므로 anon 포함 전체 허용 (현재 programs 테이블과 동일 정책)
alter table public.announcements enable row level security;

create policy "announcements_select_all" on public.announcements
  for select to anon, authenticated using (true);

create policy "announcements_insert_all" on public.announcements
  for insert to anon, authenticated with check (true);

create policy "announcements_update_all" on public.announcements
  for update to anon, authenticated using (true) with check (true);

create policy "announcements_delete_all" on public.announcements
  for delete to anon, authenticated using (true);
