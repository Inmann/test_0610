/**
 * 금융투자협회(KOFIA) 안내사항 게시판 스크래퍼
 * URL: https://www.kofia.or.kr/brd/m_212/list.do
 *
 * ※ Node.js fetch(undici)가 KOFIA에서 차단 → curl 사용
 * ※ HTML이 비정상 구조(<a>가 <span> 경계를 넘음)라 node-html-parser가
 *   tbody/tr을 복원하지 못함 → 정규식으로 직접 파싱
 */

import { execFileSync } from 'child_process'
import { platform } from 'os'

const BASE_URL = 'https://www.kofia.or.kr/brd/m_212'
const SCRAPER_ID = 'kofia'
const REQUEST_DELAY_MS = 800
const CURL = platform() === 'win32' ? 'curl.exe' : 'curl'

export async function scrapeKofia({ maxPages = 3, knownUrls = new Set() } = {}) {
  const results = []

  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE_URL}/list.do?page=${page}`
    let html

    try {
      html = curlGet(url)
    } catch (err) {
      console.error(`  [kofia] 페이지 ${page} 요청 실패: ${err.message}`)
      break
    }

    const items = parseListPage(html)
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
    if (items.length < 10) break
    if (page < maxPages) await sleep(REQUEST_DELAY_MS)
  }

  return results
}

function parseListPage(html) {
  const items = []

  // tbody 블록 추출
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return items
  const tbody = tbodyMatch[1]

  // <tr>...</tr> 블록 분리
  const trBlocks = tbody.match(/<tr>[\s\S]*?<\/tr>/g) ?? []

  for (const tr of trBlocks) {
    // seq=N 링크 추출 (공고 상세 링크)
    const seqMatch = tr.match(/view\.do\?seq=(\d+)/)
    if (!seqMatch) continue
    const seq = seqMatch[1]
    const sourceUrl = `${BASE_URL}/view.do?seq=${seq}`

    // 제목: <td class="left ...">...</td> 내부 텍스트
    const titleTdMatch = tr.match(/<td[^>]*class="[^"]*left[^"]*"[^>]*>([\s\S]*?)<\/td>/)
    if (!titleTdMatch) continue
    const rawTitle = stripTags(titleTdMatch[1]).replace(/\s+/g, ' ').trim()
    if (!rawTitle) continue

    // 날짜: YYYY-MM-DD 패턴 (첨부파일 td 뒤에 등장)
    const dates = tr.match(/\d{4}-\d{2}-\d{2}/g) ?? []
    const announcedAt = dates[0] ?? null

    const { institution, title } = parseTitle(rawTitle)

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

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
}

function parseTitle(raw) {
  const match = raw.match(/^\[([^\]]+)\]\s*(.+)/)
  if (match) return { institution: match[1].trim(), title: match[2].trim() }
  return { institution: null, title: raw }
}

function curlGet(url) {
  return execFileSync(CURL, [
    '-sL', '--max-time', '30', '--compressed',
    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Language: ko-KR,ko;q=0.9',
    url,
  ], { encoding: 'utf8', timeout: 35000 })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
