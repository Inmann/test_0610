/**
 * 한국벤처투자(KVIC) 출자사업 공고 게시판 스크래퍼
 * URL: https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice
 *
 * ※ 목록은 <tbody class="data-List"> 내부의 <tr>들.
 *   각 행: 번호 / 카테고리(<strong>[출자계획]</strong>) / 첨부 / 제목(a) / 날짜.
 * ※ 상세 링크는 javascript:board_view(ID) 형태.
 *   board_view(no) = location.href = "?" + $("#searchForm").serialize() + "&id=" + no
 *   → 상세 URL은 목록 URL + "?id=<ID>" 로 합성 (ID로 고유성 보장).
 * ※ 정부/협회 게시판 비정상 HTML 대응 위해 node-html-parser 대신 정규식 파싱.
 * ※ 페이지네이션: ?pageNo=N (한 페이지 10건).
 */

import { curlGet, fetchHtml, stripTags } from './fetch.mjs'

const LIST_URL = 'https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice'
const SCRAPER_ID = 'kvic'
const INSTITUTION = '한국벤처투자'
const REQUEST_DELAY_MS = 800
const ROWS_PER_PAGE = 10

export async function scrapeKvic({ maxPages = 3, knownUrls = new Set() } = {}) {
  const results = []

  for (let page = 1; page <= maxPages; page++) {
    const url = `${LIST_URL}?pageNo=${page}`
    let html

    try {
      html = curlGet(url)
    } catch (err) {
      console.error(`  [kvic] 페이지 ${page} 요청 실패: ${err.message}`)
      break
    }

    let items = parseListPage(html)

    // curl 결과가 비거나 파싱 0건이면 ScrapingBee fallback
    if (items.length === 0) {
      try {
        const { html: beeHtml } = fetchHtml(url, { forceBee: true })
        items = parseListPage(beeHtml)
      } catch (err) {
        console.error(`  [kvic] 페이지 ${page} ScrapingBee fallback 실패: ${err.message}`)
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

  // tbody 블록 추출 (class="data-List"). 없으면 전체에서 tr 파싱 시도.
  const tbodyMatch = html.match(/<tbody[^>]*class="[^"]*data-List[^"]*"[^>]*>([\s\S]*?)<\/tbody>/)
  const scope = tbodyMatch ? tbodyMatch[1] : html

  const trBlocks = scope.match(/<tr>[\s\S]*?<\/tr>/g) ?? []

  for (const tr of trBlocks) {
    // 상세 ID 추출: board_view(4883)
    const idMatch = tr.match(/board_view\((\d+)\)/)
    if (!idMatch) continue
    const id = idMatch[1]
    const sourceUrl = `${LIST_URL}?id=${id}`

    // 제목: 상세 링크 <a ...>제목</a> 내부 텍스트
    const titleAnchorMatch = tr.match(/<a[^>]*board_view\(\d+\)[^>]*>([\s\S]*?)<\/a>/)
    if (!titleAnchorMatch) continue
    const rawTitle = stripTags(titleAnchorMatch[1])
    if (!rawTitle) continue

    // 카테고리 태그: <strong>[출자계획]</strong> (기관명 아님 → 제목 앞에 보존)
    const catMatch = tr.match(/<strong>\s*(\[[^\]]+\])\s*<\/strong>/)
    const category = catMatch ? catMatch[1].trim() : null

    // 날짜: YYYY-MM-DD 패턴 (마지막 td)
    const dateMatch = tr.match(/(\d{4}-\d{2}-\d{2})/)
    const announcedAt = dateMatch ? dateMatch[1] : null

    // institution은 한국벤처투자 고정. 카테고리는 title 앞에 표기.
    const title = category ? `${category} ${rawTitle}` : rawTitle

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
