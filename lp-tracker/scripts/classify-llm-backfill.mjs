/**
 * 기존 announcements를 Gemini로 재분류 (resumable).
 *   node --env-file=.env.local scripts/classify-llm-backfill.mjs
 *
 * - classified_by IS NULL(아직 LLM 미분류) 행만 처리하고, 끝낸 행은 classified_by='llm' 표시.
 * - 청크마다 즉시 DB 반영. 무료 일일 한도에 막히면 진행분만 저장하고 깔끔히 종료(exit 0).
 *   → 같은 명령을 다시 실행하면 "남은 미분류 행"부터 이어서 처리(quota 회복 후).
 * 필요: GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { classifyTitlesLLM, hasGeminiKey, isDailyQuotaError, CHUNK_SIZE, MODEL } from './scrapers/classify-llm.mjs'

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!supaUrl || !supaKey) { console.error('Supabase 환경변수 누락'); process.exit(1) }
if (!hasGeminiKey()) { console.error('GEMINI_API_KEY 누락'); process.exit(1) }
const supabase = createClient(supaUrl, supaKey)

// 아직 LLM 분류 안 된 행만
async function fetchUnclassified() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, irrelevant, irrelevant_reason')
      .is('classified_by', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function persist(items) {
  // (irrelevant,reason) 그룹별로 묶어 classified_by='llm'과 함께 갱신
  const groups = new Map()
  for (const c of items) {
    const k = `${c.irrelevant}|${c.irrelevant_reason ?? ''}`
    if (!groups.has(k)) groups.set(k, { irrelevant: c.irrelevant, reason: c.irrelevant_reason, ids: [] })
    groups.get(k).ids.push(c.id)
  }
  for (const { irrelevant, reason, ids } of groups.values()) {
    for (let i = 0; i < ids.length; i += 80) {
      const { error } = await supabase
        .from('announcements')
        .update({ irrelevant, irrelevant_reason: reason, classified_by: 'llm' })
        .in('id', ids.slice(i, i + 80))
      if (error) throw new Error(error.message)
    }
  }
}

const rows = await fetchUnclassified()
if (rows.length === 0) {
  console.log('모든 행이 이미 LLM 분류됨. 할 일 없음.')
  process.exit(0)
}
console.log(`미분류 ${rows.length}건. ${CHUNK_SIZE}개씩 ${Math.ceil(rows.length / CHUNK_SIZE)}요청 (모델: ${MODEL})`)

const tally = { toRelevant: 0, toIrrelevant: 0, persisted: 0 }
const samples = []
let stoppedByQuota = false

try {
  await classifyTitlesLLM(
    rows.map((r) => r.title),
    {
      onProgress: (done, total) => process.stdout.write(`\r  ${done}/${total}`),
      onChunk: async (verdicts, start) => {
        const items = []
        verdicts.forEach((v, j) => {
          const before = rows[start + j]
          if (!before) return
          items.push({ id: before.id, ...v })
          if (before.irrelevant && !v.irrelevant) {
            tally.toRelevant++
            if (samples.length < 16) samples.push(`[무관→관련] (기존:${before.irrelevant_reason}) ${before.title}`)
          } else if (!before.irrelevant && v.irrelevant) {
            tally.toIrrelevant++
            if (samples.length < 16) samples.push(`[관련→무관:${v.irrelevant_reason}] ${before.title}`)
          }
        })
        await persist(items)
        tally.persisted += items.length
      },
    }
  )
} catch (err) {
  if (isDailyQuotaError(err)) {
    stoppedByQuota = true
  } else {
    process.stdout.write('\n')
    throw err
  }
}
process.stdout.write('\n')

console.log(`\n=== ${stoppedByQuota ? '일일 한도 도달 — 진행분 저장 후 종료' : 'Gemini 분류 완료'} ===`)
console.log(`이번 실행 LLM 분류: ${tally.persisted}건 (키워드 대비 무관→관련 ${tally.toRelevant} · 관련→무관 ${tally.toIrrelevant})`)
if (stoppedByQuota) {
  const remaining = rows.length - tally.persisted
  console.log(`남은 미분류: 약 ${remaining}건 → 무료 한도 회복(보통 다음날) 후 같은 명령 재실행하면 이어서 처리.`)
}
console.log(`\n--- 변경 샘플 (최대 16) ---`)
samples.forEach((s) => console.log('  ' + s.slice(0, 90)))
