// 화면 캡처: node scripts/screenshot.mjs (개발 서버 실행 중이어야 함)
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

mkdirSync("screenshots", { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const shots = [
  ["/", "dashboard"],
  ["/program/a1b2c3d4-0001-4000-8000-000000000001", "detail"],
  ["/new", "new"],
  ["/archive", "archive"],
];
for (const [path, name] of shots) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  console.log(`saved screenshots/${name}.png`);
}
await browser.close();
