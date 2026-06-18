/**
 * 공고 관련성 분류기 (키워드 규칙 기반)
 *
 * 우리 도메인: PEF·VC·크레딧·세컨더리·인프라 등 대체투자 출자사업/위탁운용사 선정 공고.
 * 노이즈: 채용, MMF·단기자금, 리츠, 결과·접수현황, 거래·수탁기관, 전통자산(상장주식·채권)
 *         위탁운용, 설명회·포럼 등.
 *
 * ※ 삭제하지 않고 flag만 단다. 수집함이 기본적으로 irrelevant=false만 보여주되
 *   토글로 전부 볼 수 있어, 오분류(진짜 기회 누락)를 사람이 검토·복구할 수 있다.
 * ※ 기회 누락(false positive)이 노이즈 잔존(false negative)보다 훨씬 해롭다.
 *   → "기회 신호"가 있으면 약한 규칙(행사·안내)으로는 제외하지 않는다.
 *
 * @param {string} rawTitle
 * @returns {{ irrelevant: boolean, irrelevant_reason: string | null }}
 */

// 출자사업/펀드 위탁운용사 선정 등 "기회" 신호 — 있으면 약한(SOFT) 규칙 면제
const OPPORTUNITY =
  /출자\s*사업|위탁\s*운용사\s*선정|운용사\s*선정\s*(공고|계획)|블라인드\s*펀드|신기술투자조합|모태펀드|프로젝트\s*펀드|앵커\s*출자|co-?gp/i;

// 항상 제외 (HARD)
const HARD_RULES = [
  ["채용", /채용|경력직|신입사원|인력\s*모집|직원\s*모집|공개\s*모집|리크루트|인재\s*모집|전문위원\s*모집/],
  [
    "결과·현황",
    /선정\s*결과|심사\s*결과|평가\s*결과|서류\s*결과|결과\s*발표|결과\s*공고|접수\s*현황|접수\s*결과|선정\s*완료|우선\s*협상|최종\s*확정|낙찰|유찰/,
  ],
  ["MMF·단기자금", /MMF|머니\s*마켓|환매조건부|단기\s*자금|콜론|\bRP\b/i],
  ["리츠", /리\s*츠|REITs?|부동산투자회사/i],
  [
    "거래·수탁기관",
    /거래\s*증권사|증권사\s*선정|거래기관\s*선정|매매\s*증권사|주관\s*증권사|중개\s*기관|수탁\s*기관|사무\s*수탁|금고\s*은행|외화\s*금고|채권\s*거래|주식\s*거래/,
  ],
  [
    "전통자산(주식·채권)",
    /국내\s*주식|해외\s*주식|국내\s*채권|해외\s*채권|글로벌\s*주식|글로벌\s*채권|주식형|채권형|active\s*주식|액티브\s*주식|패시브|지분증권\s*거래|의안\s*분석|의결권|TDF|타겟데이트|OCIO|대형주|중소형주/i,
  ],
]

// 기회 신호가 없을 때만 제외 (SOFT)
const SOFT_RULES = [
  [
    "행사·안내·용역",
    /설명회|포럼|세미나|워크숍|워크샵|간담회|박람회|컨퍼런스|연구\s*용역|용역\s*입찰|교육\s*과정|공청회|출범식|발대식|기념식|위\s*크|\bweek\b|개최\s*안내|공모전/i,
  ],
]

export function classifyTitle(rawTitle) {
  const t = rawTitle || ""

  for (const [reason, re] of HARD_RULES) {
    if (re.test(t)) return { irrelevant: true, irrelevant_reason: reason }
  }

  if (!OPPORTUNITY.test(t)) {
    for (const [reason, re] of SOFT_RULES) {
      if (re.test(t)) return { irrelevant: true, irrelevant_reason: reason }
    }
  }

  return { irrelevant: false, irrelevant_reason: null }
}
