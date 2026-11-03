/**
 * Mide LCP y CLS en mobile con red "4G lenta" y CPU 4x más lenta
 * (similar al perfil mobile de Lighthouse). Uso:
 *   npx playwright test --config e2e/perf.config.ts
 * Criterio de la Fase 1: LCP < 2.5 s, CLS < 0.1.
 */
import { expect, test } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:8010";

async function measure(page: import("@playwright/test").Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  // Sin caché del navegador: se mide como una primera visita real.
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) w.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    return { lcp: w.__lcp, cls: w.__cls };
  });
}

test("Web Vitals mobile: home, búsqueda y detalle de aviso", async ({
  page,
  request,
}) => {
  const listing = (
    await (await request.get(`${API}/api/v1/listings?limit=1`)).json()
  ).items[0];
  const pages = [
    "/",
    "/buscar?q=peugeot",
    "/vehiculos",
    ...(listing ? [listing.url_path] : []),
  ];
  const results: string[] = [];
  for (const path of pages) {
    // Visita previa para que ISR genere la página en el server (caché del server, no del navegador).
    await page.goto(path);
    const { lcp, cls } = await measure(page, path);
    results.push(
      `${path.padEnd(48)} LCP ${(lcp / 1000).toFixed(2)} s · CLS ${cls.toFixed(3)}`,
    );
    expect(lcp, `LCP de ${path}`).toBeLessThan(2500);
    expect(cls, `CLS de ${path}`).toBeLessThan(0.1);
  }
  console.log(`\n${results.join("\n")}`);
});
