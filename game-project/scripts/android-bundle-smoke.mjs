#!/usr/bin/env node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const assetsRoot = resolve("android/app/src/main/assets");
const publicRoot = resolve(assetsRoot, "public");
assert.ok(existsSync(resolve(publicRoot, "android.html")), "Android HTML entry must be packaged");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (!pathname.startsWith("/assets/")) {
      res.writeHead(404).end("Not found");
      return;
    }
    const relative = decodeURIComponent(pathname.slice("/assets/".length));
    const file = resolve(assetsRoot, relative);
    if (file !== assetsRoot && !file.startsWith(assetsRoot + sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Asset not found");
  }
});

await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  // Simulate the native Android bridge so this browser test also verifies the
  // same GAME_READY signal that the emulator startup test waits for.
  await page.addInitScript(() => {
    window.__androidGameReady = false;
    window.__androidStartupError = null;
    window.AndroidDiagnostics = {
      onGameReady: () => { window.__androidGameReady = true; },
      onGameError: (message) => { window.__androidStartupError = String(message); },
    };
  });
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? "failed"}`));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === baseUrl ? route.continue() : route.abort();
  });

  const response = await page.goto(`${baseUrl}/assets/public/android.html`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  assert.equal(response?.status(), 200, "Android local entry must load from packaged assets");
  await page.getByText("توكتوك دار السلام", { exact: true }).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => typeof window.__controlsTest?.getYaw === "function", null, { timeout: 30000 });
  await page.waitForFunction(() => window.__androidGameReady === true, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__androidStartupError), null, "Android bridge must not report a startup error");
  const graphics = await page.locator("canvas").first().evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    webgl2: Boolean(canvas.getContext("webgl2")),
  }));
  assert.ok(graphics.width > 0 && graphics.height > 0, "Game renderer must create a drawing buffer");
  assert.ok(graphics.webgl2, "Three.js game must have a WebGL 2 context");

  await page.getByRole("button", { name: /ابدأ الوردية/ }).click();
  await page.getByRole("button", { name: "كلاكس" }).waitFor({ state: "visible", timeout: 15000 });
  // Exercise the same pointer handlers used by the on-screen mobile throttle,
  // rather than relying only on the keyboard test hook.
  const throttle = page.getByRole("button", { name: "بنزين" });
  await throttle.hover();
  await page.mouse.down();
  try {
    await page.waitForFunction(() => (window.__controlsTest?.getSpeed?.() ?? 0) > 0, null, { timeout: 10000 });
  } finally {
    await page.mouse.up();
  }
  await page.getByRole("button", { name: "إيقاف" }).click();
  await page.getByText("وقفة", { exact: true }).waitFor({ state: "visible", timeout: 10000 });

  assert.deepEqual(pageErrors, [], `Android bundle must not throw JavaScript errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(failedRequests, [], `Android bundle must not request missing/offline assets: ${failedRequests.join(" | ")}`);
  console.log("Android offline bundle smoke test passed: local entry, WebGL2, game start, mobile pointer throttle, pause, and no failed requests.");
  await context.close();
} finally {
  await browser.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
