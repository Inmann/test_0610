/**
 * LP 출자사업 공고 자동 수집 스크립트
 *
 * 실행 방법:
 *   node --env-file=.env.local scripts/scrape.mjs           # 일일 실행 (최신 3페이지)
 *   node --env-file=.env.local scripts/scrape.mjs --full    # 초기 전체 수집
 *
 * GitHub Actions에서는 위 명령어를 그대로 사용.
 */

import { createClient } from '@supabase/supabase-js'
import { scrapeKofia } from './scrapers/kofia.mjs'
import { scrapeKvic } from './scrapers/kvic.mjs'
import { scrapeKvca } from './scrapers/kvca.mjs'
import { scrapeKgrowth } from './scrapers/kgrowth.mjs'
import { scrapeNps } from './scrapers/nps.mjs'

// ── 설정 ──────────────────────────────────────────────────────

const FULL_MODE = process.argv.includes('--full')
const MAX_PAGES_DAILY = 3
const MAX_PAGES_FULL = 999

const SCRAPERS = [
  { name: 'kofia', fn: (opts) => scrapeKofia(opts) },
  { name: 'kvic', fn: (opts) => scrapeKvic(opts) },
  { name: 'kvca', fn: (opts) => scrapeKvca(opts) },
  { name: 'kgrowth', fn: (opts) => scrapeKgrowth(opts) },
  { name: 'nps', fn: (opts) => scrapeNps(opts) },
]

// ── Supabase 클라이언트 ─────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  console.error('   실행 방법: node --env-file=.env.local scripts/scrape.mjs')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ── 메인 ──────────────────────────────────────────────────────

console.log(`\n🔍 LP 출자사업 공고 수집 시작 (${FULL_MODE ? '전체' : '일일'} 모드)\n`)

let totalNew = 0
let totalSkipped = 0

for (const scraper of SCRAPERS) {
  console.log(`▶ [${scraper.name}] 수집 중...`)

  // 이미 DB에 있는 URL 목록 조회 (조기 종료 최적화)
  const { data: existingRows } = await supabase
    .from('announcements')
    .select('source_url')
    .eq('scraper', scraper.name)

  const knownUrls = new Set((existingRows ?? []).map(r => r.source_url))

  // 스크래핑
  let items = []
  try {
    items = await scraper.fn({
      maxPages: FULL_MODE ? MAX_PAGES_FULL : MAX_PAGES_DAILY,
      knownUrls,
    })
  } catch (err) {
    console.error(`  ❌ [${scraper.name}] 스크래핑 실패: ${err.message}`)
    continue
  }

  if (items.length === 0) {
    console.log(`  ✓ 새 공고 없음\n`)
    continue
  }

  // Supabase upsert (source_url 중복 시 무시)
  const { data: inserted, error } = await supabase
    .from('announcements')
    .upsert(items, { onConflict: 'source_url', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error(`  ❌ [${scraper.name}] DB 저장 실패: ${error.message}`)
    continue
  }

  const newCount = inserted?.length ?? 0
  const skippedCount = items.length - newCount
  totalNew += newCount
  totalSkipped += skippedCount

  console.log(`  ✓ 신규: ${newCount}건  스킵(중복): ${skippedCount}건\n`)
}

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`완료  신규 저장: ${totalNew}건 / 중복 스킵: ${totalSkipped}건`)
console.log(`Supabase announcements 테이블에서 확인하세요.\n`)
