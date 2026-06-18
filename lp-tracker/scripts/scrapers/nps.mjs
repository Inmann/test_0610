/**
 * 국민연금공단 기금운용본부(NPS) 거래기관·위탁운용사 선정공고 스크래퍼
 * 목록: https://fund.nps.or.kr/impa/dlnginstslctnpbanclist/getOHEF0017M0.do?pageIndex=N
 *
 * ※ JS 사이트로 보이지만 목록은 서버사이드 렌더링이라 curl로 충분(ScrapingBee 불필요).
 * ※ 행 구조:
 *     <td class="no">119</td>
 *     <td class="title"><a href="javascript:fnc_goBbsDetail('ZZ...id','BS...board');">제목</a></td>
 *     <td class="writer">부서</td>
 *     <td class="date">2026/06/04</td>   ← 슬래시 날짜
 *     <td class="hit">242</td>
 * ※ 상세는 fnc_goBbsDetail(pstId, hmpgBbsCd)가 getOHEF0018M0.do로 POST.
 *   pstId가 고유 키라 상세 URL을 ?pstId=..&hmpgBbsCd=.. 로 합성(고유성 보장).
 * ※ 페이지네이션: ?pageIndex=N (10행/페이지). 비정상 HTML 대응 위해 정규식 파싱.
 * ※ 상단에 주석 처리된 템플릿 행이 있어 주석을 먼저 제거.
 */

import { curlGet, fetchHtml, stripTags } from './fetch.mjs'

const LIST_URL = 'https://fund.nps.or.kr/impa/dlnginstslctnpbanclist/getOHEF0017M0.do'
const DETAIL_URL = 'https://fund.nps.or.kr/impa/dlnginstslctnpbancdtl/getOHEF0018M0.do'
const SCRAPER_ID = 'nps'
const INSTITUTION = '국민연금공단'
const REQUEST_DELAY_MS = 800
const ROWS_PER_PAGE = 10

export async function scrapeNps({ maxPages = 3, knownUrls = new Set() } = {}) {
  const results = []

  for (let page = 1; page <= maxPages; page++) {
    const url = `${LIST_URL}?pageIndex=${page}`
    let html

    try {
      html = curlGet(url)
    } catch (err) {
      console.error(`  [nps] 페이지 ${page} 요청 실패: ${err.message}`)
      break
    }

    let items = parseListPage(html)

    // curl 결과가 비거나 파싱 0건이면 ScrapingBee fallback
    if (items.length === 0) {
      try {
        const { html: beeHtml } = fetchHtml(url, { forceBee: true })
        items = parseListPage(beeHtml)
      } catch (err) {
        console.error(`  [nps] 페이지 ${page} ScrapingBee fallback 실패: ${err.message}`)
      }
    }

    if (items.length === 0) break

    let hitKnown = false
    for (const item of items) {
      if (knownUrls.has(item.source_url)) {
        hitKnown = true
        break
      }
      results.push(item)
    }

    if (hitKnown) break
    if (items.length < ROWS_PER_PAGE) break
    if (page < maxPages) await sleep(REQUEST_DELAY_MS)
  }

  return results
}

function parseListPage(html) {
  const items = []

  // 주석 처리된 템플릿 행 제거 후 <tr> 단위 파싱
  const clean = html.replace(/<!--[\s\S]*?-->/g, '')
  const trBlocks = clean.match(/<tr>[\s\S]*?<\/tr>/g) ?? []

  for (const tr of trBlocks) {
    // 상세 링크: fnc_goBbsDetail('pstId', 'hmpgBbsCd')
    const detail = tr.match(/fnc_goBbsDetail\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/)
    if (!detail) continue
    const pstId = detail[1]
    const bbsCd = detail[2]
    const sourceUrl = `${DETAIL_URL}?pstId=${pstId}&hmpgBbsCd=${bbsCd}`

    // 제목: 상세 링크 <a ...>제목</a> 내부 텍스트
    const titleMatch = tr.match(/fnc_goBbsDetail\([^)]*\);?"\s*>([\s\S]*?)<\/a>/)
    if (!titleMatch) continue
    const rawTitle = stripTags(titleMatch[1])
    if (!rawTitle) continue

    // 날짜: <td class="date">YYYY/MM/DD</td> → YYYY-MM-DD
    const dateMatch = tr.match(/class="date"[^>]*>\s*(\d{4})\/(\d{2})\/(\d{2})/)
    const announcedAt = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null

    items.push({
      scraper: SCRAPER_ID,
      source_url: sourceUrl,
      raw_title: rawTitle,
      institution: INSTITUTION,
      title: rawTitle,
      announced_at: announcedAt,
    })
  }

  return items
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
