/**
 * LLM 기반 공고 관련성 분류기 — Google Gemini (무료 티어)
 *
 * 키워드 규칙(classify.mjs)을 대체. 제목 여러 개를 한 요청에 묶어 JSON으로 받는다.
 * 무료 키: https://aistudio.google.com → Get API key. 환경변수 GEMINI_API_KEY.
 *
 * - classifyTitlesLLM(titles): 제목 배열 → [{irrelevant, irrelevant_reason}] (정렬 유지)
 *   scrape.mjs(일일 신규분)와 backfill(전체) 양쪽에서 사용.
 * - 모델은 무료 Flash. 정확도가 아쉬우면 MODEL만 교체(gemini-2.0-flash 등).
 * - 무료 티어 RPM 제한 대응: 청크마다 지연 + 429 백오프 재시도.
 */

import { GoogleGenAI } from '@google/genai'

// 이 무료 키는 모델마다 하루 20요청 한도. 큰 청크로 묶어 ~18요청에 전체를 끝낸다.
// 정확도가 아쉬우면 MODEL/CHUNK_SIZE 조정.
export const MODEL = 'gemini-flash-lite-latest'
export const CHUNK_SIZE = 150 // 누락 인덱스는 관련으로 안전 처리
const REQUEST_DELAY_MS = 4500 // 분당 요청수(RPM) 회피용 청크 간 지연

/** 오늘 회복 불가한 한도(일일/할당0)면 true → 즉시 중단해야 함 */
export function isDailyQuotaError(err) {
  return /PerDay|limit:\s*0|GenerateRequestsPerDay/i.test(String(err?.message ?? err))
}

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

const INSTRUCTION = `당신은 LP 출자사업 트래커의 공고 분류기입니다.
우리 도메인 = 연기금·공제회·정책기관이 PEF·VC·대체투자 위탁운용사를 선정하거나 출자하는 "지원 기회".

[관련 있음 relevant=true]
- PEF, VC(벤처), 사모투자, 블라인드펀드, 모태펀드, 프로젝트펀드, 신기술투자조합
- 크레딧/사모대출(PDF), 세컨더리, 인프라, (블라인드)부동산 등 대체투자 위탁운용사 "선정/출자 공고·계획"

[관련 없음 relevant=false] — reason에 아래 분류 중 하나(정확히 이 문자열로):
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

출력: 오직 JSON만. 형식은
{"results":[{"i":0,"relevant":true,"reason":""},{"i":1,"relevant":false,"reason":"채용"}, ...]}
입력의 모든 번호(i)에 대해 정확히 하나씩 포함하세요. relevant=true면 reason은 "".`

export function hasGeminiKey() {
  return !!process.env.GEMINI_API_KEY
}

function buildContents(titles) {
  const lines = titles.map((t, i) => `${i}. ${String(t).replace(/\s+/g, ' ').trim()}`)
  return `${INSTRUCTION}\n\n분류할 공고 목록:\n${lines.join('\n')}`
}

/** 응답 텍스트 → titles 길이에 정렬된 [{irrelevant, irrelevant_reason}] */
export function parseClassification(text, titles) {
  let parsed = { results: [] }
  try {
    // 코드펜스/잡텍스트 방어: 첫 { 부터 마지막 } 까지만 파싱
    const raw = String(text ?? '')
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    parsed = JSON.parse(s >= 0 && e > s ? raw.slice(s, e + 1) : raw)
  } catch {
    /* 파싱 실패 → 전부 관련 있음으로 안전 처리 */
  }

  const byIndex = new Map()
  for (const r of parsed.results ?? []) {
    if (typeof r.i === 'number') byIndex.set(r.i, r)
  }

  return titles.map((_, idx) => {
    const r = byIndex.get(idx)
    if (!r || r.relevant !== false) return { irrelevant: false, irrelevant_reason: null }
    const reason = REASON_CATEGORIES.includes(r.reason) ? r.reason : '기타'
    return { irrelevant: true, irrelevant_reason: reason }
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function classifyChunk(ai, titles) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: buildContents(titles),
        config: { responseMimeType: 'application/json', temperature: 0 },
      })
      return parseClassification(res.text, titles)
    } catch (err) {
      // 일일 한도/할당0은 오늘 회복 불가 → 즉시 중단(백필이 진행분 저장 후 종료)
      if (isDailyQuotaError(err)) throw err
      const msg = String(err?.message ?? err)
      // 분당 한도(RPM)·일시 오류(503)만 백오프 재시도
      if (/429|rate|PerMinute|RESOURCE_EXHAUSTED|503|overloaded|UNAVAILABLE/i.test(msg) && attempt < 3) {
        await sleep(REQUEST_DELAY_MS * (attempt + 2))
        continue
      }
      throw err
    }
  }
  // 도달 불가
  return titles.map(() => ({ irrelevant: false, irrelevant_reason: null }))
}

/**
 * 제목 배열을 30개씩 묶어 분류. onProgress(done, total) 콜백 선택.
 * 키 없으면 throw → 호출부에서 키워드 규칙으로 폴백.
 */
export async function classifyTitlesLLM(titles, { chunkSize = CHUNK_SIZE, onProgress, onChunk } = {}) {
  if (!hasGeminiKey()) throw new Error('GEMINI_API_KEY 환경변수 누락')
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const out = []
  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize)
    const verdicts = await classifyChunk(ai, chunk)
    out.push(...verdicts)
    // 청크 결과를 즉시 넘겨 부분 진행을 저장할 수 있게 함 (백필 중단 대비)
    if (onChunk) await onChunk(verdicts, i)
    if (onProgress) onProgress(Math.min(i + chunkSize, titles.length), titles.length)
    if (i + chunkSize < titles.length) await sleep(REQUEST_DELAY_MS)
  }
  return out
}
