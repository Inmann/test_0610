/**
 * LLM 기반 공고 관련성 분류기 (Claude Haiku 4.5)
 *
 * 키워드 규칙(classify.mjs)을 대체. 제목 여러 개를 한 요청에 묶어 보내고
 * 구조화 출력(JSON 스키마)으로 분류 결과를 강제한다.
 *
 * - 동기(sync) 경로: classifyTitlesLLM() — scrape.mjs의 일일 신규분에 사용.
 * - 배치(batch) 경로: buildBatchRequest()/parseClassification() — backfill 스크립트가 사용.
 *
 * 모델은 가장 저렴한 Haiku 4.5. 정확도가 부족하면 MODEL만 바꾸면 된다
 * (claude-sonnet-4-6 / claude-opus-4-8). Haiku는 effort/thinking 미지원이라 쓰지 않는다.
 */

import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-haiku-4-5'
export const CHUNK_SIZE = 30 // 한 요청에 묶을 제목 수

// irrelevant_reason으로 쓰는 고정 분류 (UI 배지와 동일 표기)
export const REASON_CATEGORIES = [
  '채용',
  'MMF·단기자금',
  '리츠',
  '결과·현황',
  '거래·수탁기관',
  '전통자산(주식·채권)',
  '행사·안내·용역',
  '기타',
]

const SYSTEM = `당신은 LP 출자사업 트래커의 공고 분류기입니다.
우리 도메인 = 연기금·공제회·정책기관이 PEF·VC·대체투자 위탁운용사를 선정하거나 출자하는 "지원 기회".

[관련 있음 relevant=true]
- PEF, VC(벤처), 사모투자, 블라인드펀드, 모태펀드, 프로젝트펀드, 신기술투자조합
- 크레딧/사모대출(PDF), 세컨더리, 인프라, (블라인드)부동산 등 대체투자 위탁운용사 "선정/출자 공고·계획"

[관련 없음 relevant=false] — reason에 아래 분류 중 하나:
- "채용": 직원·임원·전문위원 채용/공개모집
- "MMF·단기자금": MMF, 머니마켓, 단기자금, RP
- "리츠": 리츠/REITs/상장 부동산투자회사
- "결과·현황": 선정 결과·발표, 서류심사 결과, 접수 현황, 낙찰/유찰 (신규 지원 기회 아님)
- "거래·수탁기관": 거래증권사·주관증권사·수탁기관·금고은행 선정
- "전통자산(주식·채권)": 상장·공모 주식/채권 위탁운용(국내주식, 해외채권, OCIO, 대형주 등)
- "행사·안내·용역": 설명회·포럼·세미나·연구용역·공모전·기념식 등
- "기타": 위에 안 맞지만 명백히 무관

규칙:
- 애매하면 relevant=true (기회를 놓치는 것보다 노이즈가 낫다).
- "위탁운용사 선정/출자사업 공고·계획"이면 설명회가 함께 언급돼도 relevant=true.
- 입력의 모든 제목에 대해 정확히 하나씩, 입력 번호(i)와 함께 결과를 반환.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          i: { type: 'integer' },
          relevant: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['i', 'relevant', 'reason'],
      },
    },
  },
  required: ['results'],
}

export function hasAnthropicKey() {
  return !!process.env.ANTHROPIC_API_KEY
}

function userPrompt(titles) {
  const lines = titles.map((t, i) => `${i}. ${String(t).replace(/\s+/g, ' ').trim()}`)
  return `다음 공고들을 분류하세요. 각 줄은 "번호. 제목" 형식입니다.\n\n${lines.join('\n')}`
}

/** sync/batch 공용 요청 파라미터 */
export function buildParams(titles) {
  return {
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt(titles) }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  }
}

/** 응답 메시지 → titles 길이에 정렬된 [{irrelevant, irrelevant_reason}] */
export function parseClassification(message, titles) {
  const textBlock = (message.content || []).find((b) => b.type === 'text')
  let parsed = { results: [] }
  try {
    parsed = JSON.parse(textBlock?.text ?? '{}')
  } catch {
    /* 파싱 실패 → 전부 관련 있음으로 안전 처리 */
  }

  const byIndex = new Map()
  for (const r of parsed.results ?? []) {
    if (typeof r.i === 'number') byIndex.set(r.i, r)
  }

  return titles.map((_, idx) => {
    const r = byIndex.get(idx)
    if (!r || r.relevant !== false) {
      // 누락되었거나 relevant면 관련 있음
      return { irrelevant: false, irrelevant_reason: null }
    }
    const reason = REASON_CATEGORIES.includes(r.reason) ? r.reason : '기타'
    return { irrelevant: true, irrelevant_reason: reason }
  })
}

/**
 * 동기 분류 (일일 신규분). 제목 배열 → [{irrelevant, irrelevant_reason}] (정렬 유지).
 * 30개씩 끊어서 순차 호출. 키 없으면 throw (호출부에서 키워드로 폴백).
 */
export async function classifyTitlesLLM(titles, { chunkSize = CHUNK_SIZE } = {}) {
  if (!hasAnthropicKey()) throw new Error('ANTHROPIC_API_KEY 환경변수 누락')
  const client = new Anthropic()
  const out = []
  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize)
    const message = await client.messages.create(buildParams(chunk))
    out.push(...parseClassification(message, chunk))
  }
  return out
}
