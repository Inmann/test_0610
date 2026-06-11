// 브라우저 E2E 검증: node scripts/e2e-check.mjs
// 사전 조건: 개발 서버가 http://localhost:3100 에서 실행 중
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3100";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let failed = 0;
function check(name, ok, extra = "") {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // ── 대시보드 ──────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.waitForSelector('a[href^="/program/"]', { timeout: 15000 });

  const cards = await page.evaluate(() => {
    return [...document.querySelectorAll('a[href^="/program/"]')].map((a) => {
      const badge = [...a.querySelectorAll("span")].find((s) =>
        /^(D-DAY|D-\d+|D\+\d+|마감)$/.test(s.textContent.trim())
      );
      return {
        institution: a.querySelector("p")?.textContent.trim(),
        title: a.querySelector("h3")?.textContent.trim(),
        badge: badge?.textContent.trim(),
        badgeClass: badge?.className ?? "",
      };
    });
  });

  check("대시보드 접수중 카드 3건", cards.length === 3, `실제 ${cards.length}건`);
  check(
    "마감 임박순 정렬 (성금 → 국민연금 → 교직원)",
    cards[0]?.institution === "한국성장금융" &&
      cards[1]?.institution === "국민연금공단" &&
      cards[2]?.institution === "한국교직원공제회"
  );
  check("D-6 빨간 배지", cards[0]?.badge === "D-6" && cards[0]?.badgeClass.includes("bg-red-100"));
  check("D-13 주황 배지", cards[1]?.badge === "D-13" && cards[1]?.badgeClass.includes("bg-orange-100"));
  check("D-40 회색 배지", cards[2]?.badge === "D-40" && cards[2]?.badgeClass.includes("bg-slate-200"));

  const stats = await page.evaluate(() =>
    [...document.querySelectorAll("p")]
      .filter((p) => /^(접수중 공고|7일 이내 마감|지원 진행중|마감\(아카이브\))$/.test(p.textContent.trim()))
      .map((p) => p.nextElementSibling?.textContent.trim())
  );
  check(
    "통계 카드 (3/1/1/2건)",
    stats.join(",") === "3건,1건,1건,2건",
    `실제 ${stats.join(",")}`
  );

  // 분야 필터: VC 클릭 → 1건
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "VC")?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  let count = await page.evaluate(() => document.querySelectorAll('a[href^="/program/"]').length);
  check("분야 필터 VC → 1건", count === 1, `실제 ${count}건`);

  // 진행상태 필터: 검토중 추가 → 여전히 1건(국민연금이 검토중), 미검토로 바꾸면 0건
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "검토중")?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  count = await page.evaluate(() => document.querySelectorAll('a[href^="/program/"]').length);
  check("VC+검토중 필터 → 1건", count === 1, `실제 ${count}건`);

  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "미검토")?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  count = await page.evaluate(() => document.querySelectorAll('a[href^="/program/"]').length);
  check("VC+미검토 필터 → 0건 (빈 상태 문구)", count === 0, `실제 ${count}건`);

  // ── 아카이브 ──────────────────────────────────────────────
  await page.goto(`${BASE}/archive`, { waitUntil: "networkidle0" });
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("table tbody tr")].map(
      (tr) => tr.querySelector("p + p")?.textContent.trim()
    )
  );
  check("아카이브 2건, 최근 마감순 (우정 → KDB)", rows.length === 2 && rows[0]?.includes("인프라펀드") && rows[1]?.includes("세컨더리"));

  // ── 상세: 상태 변경 + 메모 저장 ───────────────────────────
  await page.goto(`${BASE}/program/a1b2c3d4-0001-4000-8000-000000000001`, { waitUntil: "networkidle0" });
  await page.waitForSelector("select", { timeout: 15000 });
  await page.select("select", "제안서제출");
  await new Promise((r) => setTimeout(r, 300));
  const afterStatus = await page.evaluate(() => ({
    flash: !!document.body.textContent.includes("저장됨"),
    badge: [...document.querySelectorAll("span")].some((s) => s.textContent.trim() === "제안서제출"),
  }));
  check("상태 변경 → 배지 즉시 반영 + 저장 표시", afterStatus.flash && afterStatus.badge);

  await page.type("textarea", " [E2E 메모]");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "메모 저장")?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const memoSaved = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "메모 저장");
    return btn?.disabled === true; // 저장 후 draft === 저장값 → 버튼 비활성화
  });
  check("메모 저장 → 버튼 비활성화(저장 완료)", memoSaved === true);

  // 상태 변경이 대시보드에도 반영됐는지 (클라이언트 내비게이션으로 이동)
  await page.evaluate(() => {
    [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/" && a.textContent.includes("대시보드"))?.click();
  });
  await page.waitForSelector('a[href^="/program/"]', { timeout: 15000 });
  const statusPropagated = await page.evaluate(() => {
    const card = [...document.querySelectorAll('a[href^="/program/"]')].find((a) =>
      a.textContent.includes("한국성장금융")
    );
    return card?.textContent.includes("제안서제출") ?? false;
  });
  check("변경한 상태가 대시보드 카드에 반영", statusPropagated);

  // ── 등록 플로우 ───────────────────────────────────────────
  await page.goto(`${BASE}/new`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#institution", { timeout: 15000 });
  await page.type("#institution", "산재보험기금");
  await page.type("#title", "2026년 PEF 위탁운용사 선정 (E2E)");
  await page.evaluate(() => {
    const el = document.querySelector("#deadline");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "2026-07-30");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "저장")?.click();
  });
  await page.waitForFunction(() => location.pathname === "/", { timeout: 15000 });
  await page.waitForSelector('a[href^="/program/"]', { timeout: 15000 });
  const newCardVisible = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/program/"]')].some((a) =>
      a.textContent.includes("E2E")
    )
  );
  check("등록 후 대시보드 이동 + 새 카드 표시", newCardVisible);

  // ── 모바일 헤더 오버플로 ──────────────────────────────────
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const headerOk = await page.evaluate(() => {
    const bar = document.querySelector("header > div");
    return bar.scrollWidth <= 375 && bar.getBoundingClientRect().height <= 60;
  });
  check("375px 모바일에서 헤더 한 줄 유지", headerOk);
} finally {
  await browser.close();
}

if (failed > 0) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전체 통과");
