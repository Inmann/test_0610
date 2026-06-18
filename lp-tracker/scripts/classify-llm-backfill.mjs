/**
 * 기존 announcements 전체를 Claude(Batches API)로 재분류.
 *   node --env-file=.env.local scripts/classify-llm-backfill.mjs           # 실행
 *   node --env-file=.env.local scripts/classify-llm-backfill.mjs --dry     # 비용/건수만, 미제출
 *
 * Batches API는 동기 대비 50% 저렴. 제목을 30개씩 묶어 ~87개 요청 → 1개 배치로 제출.
 * 완료 후 DB 갱신 + 기존(키워드) 분류와의 차이를 리포트.
 *
 * 필요: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildParams, parseClassification, CHUNK_SIZE, MODEL } from './scrapers/classify-llm.mjs'

const DRY = process.argv.includes('--dry')

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!supaUrl || !supaKey) {
  console.error('Supabase 환경변수 누락')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY 누락 (.env.local 에 추가하세요)')
  process.exit(1)
}
const supabase = createClient(supaUrl, supaKey)
const anthropic = new Anthropic()

// ── 전체 행 조회 (id 기준 안정 페이지네이션) ──
async function fetchAll() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, irrelevant, irrelevant_reason')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const rows = await fetchAll()
console.log(`총 ${rows.length}건. ${CHUNK_SIZE}개씩 묶어 분류 (모델: ${MODEL})\n`)

// ── 청크 구성: custom_id → 해당 청크의 행들 ──
const chunks = []
for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE))
const requests = chunks.map((chunk, n) => ({
  custom_id: `c${n}`,
  params: buildParams(chunk.map((r) => r.title)),
}))

if (DRY) {
  console.log(`[DRY] 요청 ${requests.length}개 (배치 1개). 제출하지 않음.`)
  console.log(`예상 비용: Haiku 4.5 + Batches(50% 할인)로 대략 $0.2~0.4 (1회성).`)
  process.exit(0)
}

// ── 배치 제출 ──
console.log(`배치 제출 중... (요청 ${requests.length}개)`)
const batch = await anthropic.messages.batches.create({ requests })
console.log(`배치 ID: ${batch.id}  상태: ${batch.processing_status}`)

// ── 완료 대기 (대부분 1시간 내, 보통 수 분) ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let info = batch
const started = Date.now()
while (info.processing_status !== 'ended') {
  await sleep(8000)
  info = await anthropic.messages.batches.retrieve(batch.id)
  const c = info.request_counts
  const mins = Math.round((Date.now() - started) / 60000)
  console.log(`  상태: ${info.processing_status}  성공 ${c.succeeded} / 처리중 ${c.processing} / 오류 ${c.errored}  (${mins}분 경과)`)
  if (Date.now() - started > 30 * 60000) {
    console.error('30분 초과 — 나중에 같은 배치 ID로 결과를 받으세요:', batch.id)
    process.exit(1)
  }
}

// ── 결과 수집 → 행별 분류 매핑 ──
const updates = [] // { id, irrelevant, irrelevant_reason }
let errored = 0
for await (const res of await anthropic.messages.batches.results(batch.id)) {
  if (res.result.type !== 'succeeded') {
    errored++
    continue
  }
  const n = Number(res.custom_id.slice(1))
  const chunk = chunks[n]
  if (!chunk) continue
  const verdicts = parseClassification(res.result.message, chunk.map((r) => r.title))
  chunk.forEach((row, idx) => {
    updates.push({ id: row.id, prev: row, ...verdicts[idx] })
  })
}
if (errored) console.log(`\n⚠️ 오류 요청 ${errored}개 (해당 청크는 미갱신)`)

// ── 차이 리포트 (기존 키워드 분류 대비) ──
let flipToRelevant = 0
let flipToIrrelevant = 0
const reasonChanged = []
const sampleFlips = []
for (const u of updates) {
  const before = u.prev
  if (before.irrelevant && !u.irrelevant) {
    flipToRelevant++
    if (sampleFlips.length < 12) sampleFlips.push(`[무관→관련] (${before.irrelevant_reason}) ${before.title}`)
  } else if (!before.irrelevant && u.irrelevant) {
    flipToIrrelevant++
    if (sampleFlips.length < 12) sampleFlips.push(`[관련→무관:${u.irrelevant_reason}] ${before.title}`)
  } else if (u.irrelevant && before.irrelevant_reason !== u.irrelevant_reason) {
    reasonChanged.push(`(${before.irrelevant_reason}→${u.irrelevant_reason}) ${before.title}`)
  }
}
const relevant = updates.filter((u) => !u.irrelevant).length
console.log(`\n=== LLM 분류 결과 ===`)
console.log(`관련 ${relevant} / 무관 ${updates.length - relevant} (총 ${updates.length})`)
console.log(`키워드 대비 변경: 무관→관련 ${flipToRelevant}건, 관련→무관 ${flipToIrrelevant}건, 사유변경 ${reasonChanged.length}건`)
console.log(`\n--- 변경 샘플 (최대 12) ---`)
sampleFlips.forEach((s) => console.log('  ' + s.slice(0, 90)))

// ── DB 갱신 (변경분만, (irrelevant,reason) 그룹별 배치) ──
const changed = updates.filter(
  (u) => u.prev.irrelevant !== u.irrelevant || (u.prev.irrelevant_reason ?? null) !== (u.irrelevant_reason ?? null)
)
console.log(`\n변경 ${changed.length}건 DB 반영 중...`)
const groups = new Map()
for (const c of changed) {
  const k = `${c.irrelevant}|${c.irrelevant_reason ?? ''}`
  if (!groups.has(k)) groups.set(k, { irrelevant: c.irrelevant, reason: c.irrelevant_reason, ids: [] })
  groups.get(k).ids.push(c.id)
}
let done = 0
for (const { irrelevant, reason, ids } of groups.values()) {
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80)
    const { error } = await supabase
      .from('announcements')
      .update({ irrelevant, irrelevant_reason: reason })
      .in('id', slice)
    if (error) throw new Error(error.message)
    done += slice.length
  }
}
console.log(`완료: ${done}건 업데이트.`)
