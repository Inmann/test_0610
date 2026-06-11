// 2단계 Supabase 연동 E2E 검증
// 사전 조건: 개발 서버가 http://localhost:3000 에서 실행 중
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3000";
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

  // ── 대시보드: Supabase에서 데이터 로드 ──────────────────────
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  // 로딩 스켈레톤이 사라지고 실제 데이터가 나타날 때까지 대기
  await page.waitForFunction(
    () => !document.querySelector(".animate-pulse"),
    { timeout: 15000 }
  );

  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/program/"]')].map((a) => ({
      institution: a.querySelector("p")?.textContent.trim(),
      title: a.querySelector("h3")?.textContent.trim(),
    }))
  );

  check("Supabase에서 접수중 3건 로드", cards.length === 3, `${cards.length}건 로드됨`);
  check(
    "시드 데이터 기관명 확인 (성장금융 → 국민연금 → 교직원)",
    cards[0]?.institution?.includes("성장금융") &&
    cards[1]?.institution?.includes("국민연금") &&
    cards[2]?.institution?.includes("교직원"),
    cards.map(c => c.institution).join(" / ")
  );

  // ── 상세: 상태 변경이 Supabase에 영구 저장되는지 ──────────
  await page.goto(`${BASE}/program/a1b2c3d4-0001-4000-8000-000000000001`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 10000 });
  await page.waitForSelector("select", { timeout: 10000 });

  // 현재 상태 확인
  const beforeStatus = await page.evaluate(() =>
    document.querySelector("select")?.value
  );
  check("초기 상태 '지원예정' 로드", beforeStatus === "지원예정", `현재: ${beforeStatus}`);

  // 상태를 '제안서제출'로 변경
  await page.select("select", "제안서제출");
  // '저장됨 ✓' 플래시 대기
  await page.waitForFunction(
    () => document.body.textContent.includes("저장됨"),
    { timeout: 10000 }
  );
  check("상태 변경 → '저장됨 ✓' 표시", true);

  // 페이지 새로고침 후 상태가 유지되는지 확인 (DB 영구 저장 검증)
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 10000 });
  await page.waitForSelector("select", { timeout: 10000 });
  const afterReloadStatus = await page.evaluate(() =>
    document.querySelector("select")?.value
  );
  check("새로고침 후 상태 유지 (DB 영구저장 확인)", afterReloadStatus === "제안서제출", `새로고침 후: ${afterReloadStatus}`);

  // 원래 상태로 복원
  await page.select("select", "지원예정");
  await page.waitForFunction(() => document.body.textContent.includes("저장됨"), { timeout: 10000 });

  // ── 메모 저장 + 새로고침 후 유지 ─────────────────────────
  const timestamp = "_E2E" + Date.now().toString().slice(-6);
  const ta = await page.$("textarea");
  await ta.click({ clickCount: 3 }); // 전체 선택
  await page.keyboard.press("End");  // 커서를 맨 끝으로
  await page.keyboard.type(timestamp);

  await page.waitForFunction(
    () => ![...document.querySelectorAll("button")].find(b => b.textContent.trim() === "메모 저장")?.disabled,
    { timeout: 5000 }
  );
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "메모 저장")?.click();
  });
  await page.waitForFunction(() => document.body.textContent.includes("저장됨"), { timeout: 10000 });
  check("메모 저장 → '저장됨 ✓' 표시", true);

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 10000 });
  await page.waitForSelector("textarea", { timeout: 10000 });
  const memoAfterReload = await page.evaluate(() =>
    document.querySelector("textarea")?.value ?? ""
  );
  check("새로고침 후 메모 유지 (DB 영구저장 확인)", memoAfterReload.includes(timestamp), `textarea: ${memoAfterReload.slice(0, 80)}`);

  // 원래 메모로 복원 (timestamp 부분 삭제)
  const ta2 = await page.$("textarea");
  const origLen = memoAfterReload.length - timestamp.length;
  await ta2.click({ clickCount: 3 });
  await page.keyboard.press("End");
  for (let i = 0; i < timestamp.length; i++) await page.keyboard.press("Backspace");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "메모 저장")?.click();
  });
  await page.waitForFunction(() => document.body.textContent.includes("저장됨"), { timeout: 10000 });
  void origLen; // suppress unused var

  // ── 공고 등록 + 새로고침 후 대시보드에 유지 ───────────────
  await page.goto(`${BASE}/new`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#institution", { timeout: 10000 });

  const newTitle = `E2E등록테스트_${Date.now().toString().slice(-6)}`;
  await page.type("#institution", "테스트기관공단");
  await page.type("#title", newTitle);
  await page.evaluate(() => {
    const el = document.querySelector("#deadline");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, "2026-08-31");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "저장")?.click();
  });
  await page.waitForFunction(() => location.pathname === "/", { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 10000 });

  const newCardOnDash = await page.evaluate((title) =>
    [...document.querySelectorAll('a[href^="/program/"]')].some(a => a.textContent.includes(title)),
    newTitle
  );
  check("등록한 공고가 대시보드에 표시", newCardOnDash);

  // 새로고침 후에도 남아있는지 (Supabase 영구 저장)
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 10000 });
  const newCardAfterReload = await page.evaluate((title) =>
    [...document.querySelectorAll('a[href^="/program/"]')].some(a => a.textContent.includes(title)),
    newTitle
  );
  check("새로고침 후 등록한 공고 유지 (DB 영구저장 확인)", newCardAfterReload);

  // ── 아카이브: 마감 지난 2건 ────────────────────────────────
  await page.goto(`${BASE}/archive`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), { timeout: 10000 });
  const archiveRows = await page.evaluate(() =>
    document.querySelectorAll("table tbody tr").length
  );
  check("아카이브 2건 이상 (마감 지난 공고)", archiveRows >= 2, `${archiveRows}건`);

} finally {
  await browser.close();
}

if (failed > 0) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전체 통과 — Supabase 연동 정상 확인");
