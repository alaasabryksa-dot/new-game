#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.GAME_SMOKE_URL || "http://127.0.0.1:8080/";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
});

try {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 800, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(response?.status(), 200, `${viewport.name}: app should return HTTP 200`);
    await page.getByText("توكتوك شارع الفيوم", { exact: true }).waitFor({ timeout: 30000 });
    await page.locator("canvas").first().waitFor({ state: "attached" });
    await page.getByRole("button", { name: /ابدأ الوردية/ }).waitFor({ state: "visible", timeout: 30000 });

    const canvasSize = await page.locator("canvas").first().evaluate((canvas) => ({
      width: canvas.width,
      height: canvas.height,
      rect: canvas.getBoundingClientRect().toJSON(),
    }));
    assert.ok(canvasSize.width > 0 && canvasSize.height > 0, `${viewport.name}: game canvas has a drawing buffer`);
    assert.ok(canvasSize.rect.width > 0 && canvasSize.rect.height > 0, `${viewport.name}: game canvas is visible`);

    await page.getByRole("button", { name: /ابدأ الوردية/ }).click();
    await page.getByRole("button", { name: "كلاكس" }).waitFor({ state: "visible", timeout: 15000 });
    if (viewport.isMobile) {
      await page.getByRole("button", { name: "بنزين" }).waitFor({ state: "visible" });
      await page.getByRole("button", { name: "فرامل" }).waitFor({ state: "visible" });
      await page.getByRole("button", { name: "يسار" }).waitFor({ state: "visible" });
      await page.getByRole("button", { name: "يمين" }).waitFor({ state: "visible" });
    }

    await page.getByRole("button", { name: "إيقاف" }).click();
    await page.getByText("وقفة", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /كمّل/ }).click();
    await page.getByRole("button", { name: "إيقاف" }).waitFor({ state: "visible" });

    assert.deepEqual(pageErrors, [], `${viewport.name}: no uncaught browser errors`);
    console.log(`PASS ${viewport.name}: load, canvas, start, controls, pause and resume`);
    await context.close();
  }
} finally {
  await browser.close();
}
