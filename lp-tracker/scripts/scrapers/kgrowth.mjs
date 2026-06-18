/**
 * 한국성장금융(K-Growth) 출자사업공고 게시판 스크래퍼
 * URL: https://www.kgrowth.or.kr/notice.asp  (str_type=1&tab=1 == "출자사업공고" 탭)
 *
 * ※ 이 사이트는 EUC-KR 인코딩이라 공용 curlGet/fetchHtml(utf8 디코딩)을 그대로
 *   쓰면 한글이 깨진다 → curl로 raw 바이트를 받아 TextDecoder('euc-kr')로 디코딩한다.
 *   (kofia가 정규식 파싱을 쓰는 것과 동일한 맥락의 사이트별 예외 처리)
 * ※ <tbody> 태그가 없으므로 <tr> 단위로 직접 정규식 파싱한다.
 * ※ curl 실패/행 0건이면 fetchHtml(url,{forceBee:true})로 ScrapingBee fallback
 *   (ScrapingBee는 UTF-8로 반환하므로 별도 디코딩 불필요).
 * ※ 제목 앞 카테고리는 전각 대괄호 【】 형태라 parseBracketTitle([])로는 안 잡힌다 →
 *   전용 파서 사용. institution은 '한국성장금융'으로 고정.
 */

import { execFileSync } from 'child_process'
import { platform } from 'os'
import { fetchHtml, stripTags } from './fetch.mjs'

const BASE_URL = 'https://www.kgrowth.or.kr/'
const LIST_PATH = 'notice.asp'
const SCRAPER_ID = 'kgrowth'
const INSTITUTION = '한국성장금융'
const REQUEST_DELAY_MS = 800
const CURL = platform() === 'win32' ? 'curl.exe' : 'curl'
const MAX_BUFFER = 32 * 1024 * 1024

export async function scrapeKgrowth({ maxPages = 3, knownUrls = new Set() } = {}) {
  const results = []
  const seen = new Set() // 실행 내 중복(공지 고정행이 매 페이지 반복됨) 제거용

  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE_URL}${LIST_PATH}?str_type=1&tab=1&page=${page}`

    let html
    try {
      html = fetchEucKr(url)
    } catch (err) {
      console.error(`  [kgrowth] 페이지 ${page} 요청 실패: ${err.message}`)
      break
    }

    let items = parseListPage(html)

    // curl 결과가 비거나 행 파싱 0건이면 ScrapingBee fallback (UTF-8 반환)
    if (items.length === 0) {
      try {
        const { html: beeHtml } = fetchHtml(url, { forceBee: true })
        items = parseListPage(beeHtml)
      } catch (err) {
        console.error(`  [kgrowth] 페이지 ${page} ScrapingBee 실패: ${err.message}`)
      }
    }

    if (items.length === 0) break

    let hitKnown = false
    let newOnThisPage = 0
    for (const item of items) {
      if (seen.has(item.source_url)) continue // 고정 공지 등 실행 내 중복 제거
      seen.add(item.source_url)
      newOnThisPage++
      if (knownUrls.has(item.source_url)) {
        hitKnown = true
        break
      }
      results.push(item)
    }

    if (hitKnown) break
    // 새 항목이 없으면(전부 이전 페이지와 동일) 마지막 페이지로 간주
    if (newOnThisPage === 0) break
    if (page < maxPages) await sleep(REQUEST_DELAY_MS)
  }

  return results
}

function parseListPage(html) {
  const items = []
  if (!html) return items

  // <tbody>가 없으므로 <tr> 단위로 직접 분리
  const trBlocks = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []

  for (const tr of trBlocks) {
    // 상세 링크의 idx가 고유 키
    const idxMatch = tr.match(/notice_view\.asp\?[^"']*idx=(\d+)/)
    if (!idxMatch) continue
    const idx = idxMatch[1]

    // source_url 정규화: idx와 tab만 유지
    const tabMatch = tr.match(/notice_view\.asp\?[^"']*tab=(\d+)/)
    const tab = tabMatch ? tabMatch[1] : '1'
    const sourceUrl = `${BASE_URL}notice_view.asp?idx=${idx}&tab=${tab}`

    // 제목: <a>...</a> 내부 텍스트 (이미지/공백 제거)
    const aMatch = tr.match(/<a[^>]*notice_view\.asp[^>]*>([\s\S]*?)<\/a>/)
    if (!aMatch) continue
    const rawTitle = stripTags(aMatch[1])
    if (!rawTitle) continue

    // 작성일: tr 내 첫 YYYY-MM-DD
    const dateMatch = tr.match(/(\d{4})-(\d{2})-(\d{2})/)
    const announcedAt = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null

    const title = parseFullwidthBracketTitle(rawTitle)

    items.push({
      scraper: SCRAPER_ID,
      source_url: sourceUrl,
      raw_title: rawTitle,
      institution: INSTITUTION,
      title,
      announced_at: announcedAt,
    })
  }

  return items
}

/**
 * 제목 앞 전각 대괄호 카테고리(예: "【선정공고】「…」 …")는 제거하고 본문만 정제.
 * institution 은 '한국성장금융' 고정이므로 카테고리는 title 정제용으로만 사용.
 */
function parseFullwidthBracketTitle(raw) {
  const m = raw.match(/^\s*【[^】]*】\s*(.+)$/)
  if (m && m[1].trim()) return m[1].trim()
  return raw.trim()
}

/** curl로 raw 바이트를 받아 EUC-KR로 디코딩 */
function fetchEucKr(url) {
  const buf = execFileSync(CURL, [
    '-sL', '--max-time', '30', '--compressed',
    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
    url,
  ], { encoding: 'buffer', timeout: 35000, maxBuffer: MAX_BUFFER })
  return new TextDecoder('euc-kr').decode(buf)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
