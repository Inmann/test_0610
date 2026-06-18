/**
 * 공용 HTML fetch 유틸 (모든 스크래퍼 공유)
 *
 * 전략:
 *   1) curl 직접 요청 (빠르고 무료) — 대부분의 정부/협회 게시판은 이걸로 충분
 *   2) validate 실패 또는 forceBee 시 → ScrapingBee (JS 렌더링 + 프록시 우회)
 *
 * ScrapingBee/SerpAPI 키는 .env.local 에서 주입:
 *   node --env-file=.env.local ...
 */

import { execFileSync } from 'child_process'
import { platform } from 'os'

const CURL = platform() === 'win32' ? 'curl.exe' : 'curl'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const MAX_BUFFER = 32 * 1024 * 1024

/** curl 직접 GET */
export function curlGet(url, { headers = [], timeoutSec = 30 } = {}) {
  const args = [
    '-sL',
    '--max-time', String(timeoutSec),
    '--compressed',
    '-H', `User-Agent: ${UA}`,
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Language: ko-KR,ko;q=0.9,en;q=0.8',
  ]
  for (const h of headers) args.push('-H', h)
  args.push(url)
  return execFileSync(CURL, args, {
    encoding: 'utf8',
    timeout: (timeoutSec + 5) * 1000,
    maxBuffer: MAX_BUFFER,
  })
}

/** ScrapingBee GET (JS 렌더링 + 프리미엄 프록시 옵션) */
export function scrapingBeeGet(url, { renderJs = true, premiumProxy = false, wait = 0 } = {}) {
  const key = process.env.SCRAPINGBEE_API_KEY
  if (!key) throw new Error('SCRAPINGBEE_API_KEY 환경변수 누락 (node --env-file=.env.local 로 실행하세요)')

  const params = new URLSearchParams({
    api_key: key,
    url,
    render_js: renderJs ? 'true' : 'false',
  })
  if (premiumProxy) params.set('premium_proxy', 'true')
  if (wait > 0) params.set('wait', String(wait))
  // 한국 사이트는 한국 지오로 받는 게 안정적
  params.set('country_code', 'kr')

  const endpoint = `https://app.scrapingbee.com/api/v1/?${params.toString()}`
  return execFileSync(CURL, ['-sL', '--max-time', '120', endpoint], {
    encoding: 'utf8',
    timeout: 125000,
    maxBuffer: MAX_BUFFER,
  })
}

/**
 * 스마트 fetch: curl 우선, 실패 시 ScrapingBee fallback.
 *
 * @param {string} url
 * @param {object} opts
 * @param {(html:string)=>boolean} [opts.validate]  성공 판정 함수 (false면 fallback)
 * @param {boolean} [opts.forceBee]  처음부터 ScrapingBee 사용
 * @param {boolean} [opts.renderJs]  ScrapingBee JS 렌더링 (기본 true)
 * @param {boolean} [opts.premiumProxy]  ScrapingBee 프리미엄 프록시
 * @param {string[]} [opts.headers]  curl 추가 헤더
 * @returns {{ html: string, via: 'curl'|'scrapingbee' }}
 */
export function fetchHtml(url, { validate, forceBee = false, renderJs = true, premiumProxy = false, headers = [] } = {}) {
  if (!forceBee) {
    try {
      const html = curlGet(url, { headers })
      if (!validate || validate(html)) return { html, via: 'curl' }
    } catch {
      /* curl 실패 → ScrapingBee 시도 */
    }
  }
  const html = scrapingBeeGet(url, { renderJs, premiumProxy })
  return { html, via: 'scrapingbee' }
}

/** HTML 태그 제거 + 엔티티 디코딩 */
export function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** "[기관명] 제목" → { institution, title } */
export function parseBracketTitle(raw) {
  const m = raw.match(/^\[([^\]]+)\]\s*(.+)/)
  if (m) return { institution: m[1].trim(), title: m[2].trim() }
  return { institution: null, title: raw }
}
