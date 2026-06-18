/**
 * 기존 announcements 전체를 Gemini로 재분류.
 *   node --env-file=.env.local scripts/classify-llm-backfill.mjs           # 실행
 *   node --env-file=.env.local scripts/classify-llm-backfill.mjs --dry     # 건수만, 호출/갱신 안 함
 *
 * 완료 후 DB 갱신 + 기존(키워드) 분류와의 차이를 리포트.
 * 필요: GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { classifyTitlesLLM, hasGeminiKey, CHUNK_SIZE, MODEL } from './scrapers/classify-llm.mjs'

const DRY = process.argv.includes('--dry')

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!supaUrl || !supaKey) {
  console.error('Supabase 환경변수 누락')
  process.exit(1)
}
if (!hasGeminiKey()) {
  console.error('GEMINI_API_KEY 누락 — https://aistudio.google.com 에서 무료 발급 후 .env.local 에 추가하세요')
  process.exit(1)
}
const supabase = createClient(supaUrl, supaKey)

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
const chunks = Math.ceil(rows.length / CHUNK_SIZE)
console.log(`총 ${rows.length}건. ${CHUNK_SIZE}개씩 ${chunks}개 요청 (모델: ${MODEL})`)

if (DRY) {
  console.log(`[DRY] 호출/갱신 안 함. 무료 티어 RPM 회피로 약 ${Math.ceil((chunks * 4) / 60)}분 예상.`)
  process.exit(0)
}

console.log('분류 중... (무료 한도 회피로 청크마다 지연)')
const verdicts = await classifyTitlesLLM(
  rows.map((r) => r.title),
  { onProgress: (done, total) => process.stdout.write(`\r  ${done}/${total}`) }
)
process.stdout.write('\n')

// ── 차이 리포트 (기존 키워드 분류 대비) ──
let flipToRelevant = 0
let flipToIrrelevant = 0
let reasonChanged = 0
const sampleFlips = []
const changed = []
rows.forEach((before, idx) => {
  const v = verdicts[idx]
  if (before.irrelevant !== v.irrelevant || (before.irrelevant_reason ?? null) !== (v.irrelevant_reason ?? null)) {
    changed.push({ id: before.id, ...v })
  }
  if (before.irrelevant && !v.irrelevant) {
    flipToRelevant++
    if (sampleFlips.length < 14) sampleFlips.push(`[무관→관련] (기존:${before.irrelevant_reason}) ${before.title}`)
  } else if (!before.irrelevant && v.irrelevant) {
    flipToIrrelevant++
    if (sampleFlips.length < 14) sampleFlips.push(`[관련→무관:${v.irrelevant_reason}] ${before.title}`)
  } else if (v.irrelevant && before.irrelevant_reason !== v.irrelevant_reason) {
    reasonChanged++
  }
})
const relevant = verdicts.filter((v) => !v.irrelevant).length
console.log(`\n=== Gemini 분류 결과 ===`)
console.log(`관련 ${relevant} / 무관 ${verdicts.length - relevant} (총 ${verdicts.length})`)
console.log(`키워드 대비 변경: 무관→관련 ${flipToRelevant} · 관련→무관 ${flipToIrrelevant} · 사유변경 ${reasonChanged}`)
console.log(`\n--- 변경 샘플 (최대 14) ---`)
sampleFlips.forEach((s) => console.log('  ' + s.slice(0, 90)))

// ── DB 갱신 (변경분만, (irrelevant,reason) 그룹별 배치) ──
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
