import { chromium } from "playwright";
const SCRATCH = "/tmp/claude-0/-home-user-irf-website/7663fdfa-9af3-5f09-9356-2b2631251bed/scratchpad";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const scheme of ["dark", "light"]) {
  const page = await browser.newPage({ viewportSize: { width: 900, height: 800 }, colorScheme: scheme, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3141/dev-chart-preview", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Hover a point in the ETF era (right side of the plot) to open the tooltip.
  const chart = await page.locator(".recharts-wrapper").boundingBox();
  await page.mouse.move(chart.x + chart.width * 0.85, chart.y + chart.height * 0.4);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SCRATCH}/tip-spark-${scheme}.png` });
  await page.close();
}
await browser.close();
