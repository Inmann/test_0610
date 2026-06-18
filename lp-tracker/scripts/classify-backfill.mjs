/**
 * 기존 announcements 전체를 분류해 irrelevant/irrelevant_reason을 갱신.
 *   node --env-file=.env.local scripts/classify-backfill.mjs           # 적용
 *   node --env-file=.env.local scripts/classify-backfill.mjs --dry     # 집계/샘플만, DB 미변경
 * 재실행 가능(규칙 수정 후 다시 돌리면 됨).
 */
import { createClient } from "@supabase/supabase-js"
import { classifyTitle } from "./scrapers/classify.mjs"

const DRY = process.argv.includes("--dry")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error("환경변수 누락 (node --env-file=.env.local ...)")
  process.exit(1)
}
const supabase = createClient(url, key)

// 전체 행 페이지네이션 조회 (supabase 기본 1000행 제한)
async function fetchAll() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, scraper, title, irrelevant, irrelevant_reason")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const rows = await fetchAll()
console.log(`총 ${rows.length}건 분류 중...\n`)

const byReason = new Map()
const changed = [] // { id, irrelevant, irrelevant_reason }
const samplesExcluded = new Map() // reason -> [titles]
const samplesKept = []

for (const r of rows) {
  const { irrelevant, irrelevant_reason } = classifyTitle(r.title)
  const reasonKey = irrelevant ? irrelevant_reason : "(관련 있음)"
  byReason.set(reasonKey, (byReason.get(reasonKey) ?? 0) + 1)

  if (irrelevant) {
    const arr = samplesExcluded.get(irrelevant_reason) ?? []
    if (arr.length < 6) arr.push(`[${r.scraper}] ${r.title}`)
    samplesExcluded.set(irrelevant_reason, arr)
  } else if (samplesKept.length < 15) {
    samplesKept.push(`[${r.scraper}] ${r.title}`)
  }

  if (r.irrelevant !== irrelevant || (r.irrelevant_reason ?? null) !== (irrelevant_reason ?? null)) {
    changed.push({ id: r.id, irrelevant, irrelevant_reason })
  }
}

// 집계 출력
const total = rows.length
const excluded = total - (byReason.get("(관련 있음)") ?? 0)
console.log("=== 분류 집계 ===")
for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason.padEnd(20)} ${n}건  (${((n / total) * 100).toFixed(1)}%)`)
}
console.log(`\n  → 제외(노이즈): ${excluded}건 / 관련: ${total - excluded}건\n`)

console.log("=== 제외 샘플 (사유별 최대 6건) ===")
for (const [reason, arr] of samplesExcluded.entries()) {
  console.log(`\n[${reason}]`)
  arr.forEach((s) => console.log("  - " + s.slice(0, 80)))
}

console.log("\n=== 관련 있음(유지) 샘플 15건 ===")
samplesKept.forEach((s) => console.log("  + " + s.slice(0, 80)))

if (DRY) {
  console.log(`\n[DRY-RUN] DB 미변경. 적용하려면 --dry 빼고 실행. (변경 예정 ${changed.length}건)`)
  process.exit(0)
}

// 변경분만 (irrelevant, reason) 그룹별 배치 업데이트
console.log(`\n변경 ${changed.length}건 DB 반영 중...`)
const groups = new Map() // key -> { irrelevant, reason, ids[] }
for (const c of changed) {
  const k = `${c.irrelevant}|${c.irrelevant_reason ?? ""}`
  if (!groups.has(k)) groups.set(k, { irrelevant: c.irrelevant, reason: c.irrelevant_reason, ids: [] })
  groups.get(k).ids.push(c.id)
}
let done = 0
for (const { irrelevant, reason, ids } of groups.values()) {
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80)
    const { error } = await supabase
      .from("announcements")
      .update({ irrelevant, irrelevant_reason: reason })
      .in("id", chunk)
    if (error) throw new Error(error.message)
    done += chunk.length
  }
}
console.log(`완료: ${done}건 업데이트.`)
