// 프로덕션 배포 검증 (읽기 전용 — DB를 변경하지 않음)
// 사용법: node scripts/verify-prod.mjs [BASE_URL]
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "https://lp-tracker-iota.vercel.app";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let failed = 0;
function check(name, ok, extra = "") {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // ── 대시보드 ──────────────────────────────────────────────
  const res = await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 60000 });
  check("대시보드 HTTP 200", res.status() === 200, `status: ${res.status()}`);

  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 20000 });

  const dash = await page.evaluate(() => ({
    title: document.title,
    cards: [...document.querySelectorAll('a[href^="/program/"]')].map((a) => ({
      institution: a.querySelector("p")?.textContent.trim(),
      title: a.querySelector("h3")?.textContent.trim(),
    })),
    hasError: document.body.textContent.includes("오류가 발생했습니다"),
  }));
  check("페이지 타이틀에 'LP' 포함", dash.title.includes("LP"), dash.title);
  check("Supabase 데이터 로드 (접수중 공고 표시)", dash.cards.length >= 1 && !dash.hasError, `${dash.cards.length}건`);
  check(
    "시드 데이터 기관명 확인",
    dash.cards.some((c) => c.institution?.includes("성장금융")),
    dash.cards.map((c) => c.institution).join(" / ")
  );

  // ── 상세 페이지 (동적 라우트, 서버 렌더링) ───────────────
  const res2 = await page.goto(`${BASE}/program/a1b2c3d4-0001-4000-8000-000000000001`, {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  check("상세 페이지 HTTP 200", res2.status() === 200, `status: ${res2.status()}`);
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 20000 });
  const detail = await page.evaluate(() => ({
    hasSelect: !!document.querySelector("select"),
    hasTextarea: !!document.querySelector("textarea"),
    notFound: document.body.textContent.includes("찾을 수 없습니다"),
  }));
  check("상세 페이지 데이터 렌더링", detail.hasSelect && detail.hasTextarea && !detail.notFound);

  // ── 등록 페이지 ──────────────────────────────────────────
  const res3 = await page.goto(`${BASE}/new`, { waitUntil: "networkidle0", timeout: 60000 });
  check("등록 페이지 HTTP 200", res3.status() === 200, `status: ${res3.status()}`);
  const hasForm = await page.evaluate(() => !!document.querySelector("#institution"));
  check("등록 폼 렌더링", hasForm);

  // ── 아카이브 ─────────────────────────────────────────────
  const res4 = await page.goto(`${BASE}/archive`, { waitUntil: "networkidle0", timeout: 60000 });
  check("아카이브 HTTP 200", res4.status() === 200, `status: ${res4.status()}`);
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 20000 });
  const archiveRows = await page.evaluate(() => document.querySelectorAll("table tbody tr").length);
  check("아카이브 마감 공고 표시", archiveRows >= 1, `${archiveRows}건`);

  // ── 존재하지 않는 ID → '찾을 수 없습니다' 처리 ──────────
  await page.goto(`${BASE}/program/00000000-0000-4000-8000-000000000000`, {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 20000 });
  const notFoundOk = await page.evaluate(() =>
    document.body.textContent.includes("찾을 수 없습니다")
  );
  check("존재하지 않는 공고 → 안내 메시지", notFoundOk);

  // ── JS 런타임 에러 없음 ──────────────────────────────────
  check("페이지 JS 에러 없음", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

if (failed > 0) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전체 통과 — 프로덕션 배포 정상");
