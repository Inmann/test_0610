/**
 * 한국벤처캐피탈협회(KVCA) 출자공고 게시판 스크래퍼
 * URL: https://www.kvca.or.kr/Program/invest/list.html?a_gb=board&a_cd=8&a_item=0&sm=2_2_2
 *
 * ※ 목록은 정적 HTML(EUC-KR 헤더이나 실제 본문은 UTF-8) — curl 직접 수신 가능.
 * ※ HTML이 비정상(주석 안에 <td> 잔재 등)이라 node-html-parser 대신 정규식으로 파싱.
 * ※ 행 구조: <tr> 안에 <td>들이 있고, 각 셀의 텍스트가 동일한 listbody.html 링크로 감싸짐.
 *     td[0]=번호, td[1]=기관명(institution), td[2]=제목, td[3]=공고일, td[4]=마감일(무시)
 */

import { curlGet, fetchHtml, stripTags } from './fetch.mjs'

const BASE_URL = 'https://www.kvca.or.kr/Program/invest'
const LIST_PATH = 'list.html'
const LIST_QUERY = 'a_gb=board&a_cd=8&a_item=0&sm=2_2_2'
const SCRAPER_ID = 'kvca'
const REQUEST_DELAY_MS = 800

export async function scrapeKvca({ maxPages = 3, knownUrls = new Set() } = {}) {
  const results = []

  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE_URL}/${LIST_PATH}?${LIST_QUERY}&page=${page}`

    let html
    try {
      html = curlGet(url)
    } catch (err) {
      console.error(`  [kvca] 페이지 ${page} curl 실패: ${err.message}`)
      html = ''
    }

    let items = parseListPage(html)

    // curl 결과가 비거나 행 파싱이 0건이면 ScrapingBee fallback
    if (items.length === 0) {
      try {
        const { html: beeHtml } = fetchHtml(url, { forceBee: true })
        items = parseListPage(beeHtml)
      } catch (err) {
        console.error(`  [kvca] 페이지 ${page} ScrapingBee 실패: ${err.message}`)
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
    // 마지막 페이지(행 수가 적음)면 중단
    if (items.length < 10) break
    if (page < maxPages) await sleep(REQUEST_DELAY_MS)
  }

  return results
}

function parseListPage(html) {
  const items = []
  if (!html) return items

  // <tr>...</tr> 블록 분리 (tbody가 없을 수 있으므로 tr 단위)
  const trBlocks = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []

  for (const tr of trBlocks) {
    // po_no=N 추출 (공고 고유 키). 주석/잔재 영향 줄이려 첫 매치만 사용.
    const poMatch = tr.match(/listbody\.html\?[^"'<>]*?po_no=(\d+)/)
    if (!poMatch) continue
    const poNo = poMatch[1]
    // source_url 정규화: 원본 href는 &amp; 엔티티와 page/keyfield 등 부수 파라미터를
    // 포함하므로, 고유 키인 po_no 기준으로 깨끗한 절대 URL을 재구성한다.
    const sourceUrl = `${BASE_URL}/listbody.html?${LIST_QUERY}&po_no=${poNo}`

    // 각 <td> 셀 텍스트 추출. HTML 주석은 셀로 카운트하지 않도록 제거.
    const trClean = tr.replace(/<!--[\s\S]*?-->/g, '')
    const tdBlocks = trClean.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []
    const cells = tdBlocks.map((td) => stripTags(td))

    // 헤더행 등 셀 수가 부족하면 스킵
    if (cells.length < 4) continue

    const institutionRaw = cells[1] || ''
    const rawTitle = cells[2] || ''
    if (!rawTitle) continue

    const institution = institutionRaw || null
    const title = rawTitle

    // 공고일: td[3]에서 YYYY-MM-DD. 없으면 행 전체에서 첫 날짜.
    const announcedAt = pickDate(cells[3]) ?? pickDate(trClean) ?? null

    items.push({
      scraper: SCRAPER_ID,
      source_url: sourceUrl,
      raw_title: rawTitle,
      institution,
      title,
      announced_at: announcedAt,
    })
  }

  return items
}

function pickDate(text) {
  if (!text) return null
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? m[0] : null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
