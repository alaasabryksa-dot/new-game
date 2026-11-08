import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [activity, manifest, gradle, engine, gameView, readiness] = await Promise.all([
  read("../android/app/src/main/java/com/tuktok/darelsalam/MainActivity.kt"),
  read("../android/app/src/main/AndroidManifest.xml"),
  read("../android/app/build.gradle.kts"),
  read("../src/game/engine.ts"),
  read("../src/components/dar-salam.tsx"),
  read("../ANDROID-RELEASE-READINESS.md"),
]);

test("Android WebView only serves the packaged local game origin", () => {
  assert.match(activity, /url\.host == "appassets\.androidplatform\.net"/);
  assert.match(activity, /url\.path\.orEmpty\(\)\.startsWith\("\/assets\/"\)/);
  assert.match(activity, /assetLoader\.shouldInterceptRequest\(url\)/);
  assert.match(activity, /Blocked by offline game policy/);
  assert.match(activity, /403/);
  assert.match(activity, /shouldOverrideUrlLoading/);
  assert.match(activity, /Blocked navigation outside packaged game/);
});

test("Android WebView keeps local storage and disables unsafe file access", () => {
  assert.match(activity, /domStorageEnabled = true/);
  assert.match(activity, /allowFileAccess = false/);
  assert.match(activity, /allowContentAccess = false/);
  assert.match(activity, /setSupportMultipleWindows\(false\)/);
  assert.match(activity, /javaScriptEnabled = true/);
});

test("Android package identity and landscape WebGL requirements stay fixed", () => {
  assert.match(gradle, /applicationId = "com\.tuktok\.darelsalam"/);
  assert.match(gradle, /minSdk = 24/);
  assert.match(manifest, /android:screenOrientation="landscape"/);
  assert.match(manifest, /android:glEsVersion="0x00030000"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
});

test("native lifecycle pauses the WebView and releases it on Activity destruction", () => {
  assert.match(activity, /override fun onPause\(\)[\s\S]*?dispatchEvent\(new Event\('blur'\)\)/);
  assert.match(activity, /webView\?\.onPause\(\)/);
  assert.match(activity, /override fun onResume\(\)[\s\S]*?webView\?\.onResume\(\)/);
  assert.match(activity, /override fun onDestroy\(\)[\s\S]*?view\.stopLoading\(\)[\s\S]*?view\.destroy\(\)/);
});

test("a dead WebView renderer is destroyed and reported instead of reused", () => {
  assert.match(activity, /override fun onRenderProcessGone/);
  assert.match(activity, /view\.destroy\(\)/);
  assert.match(activity, /if \(webView === view\) webView = null/);
  assert.match(activity, /محرك عرض اللعبة توقف/);
});

test("native JavaScript diagnostics expose startup failures to the user", () => {
  assert.match(activity, /fun onGameReady\(\)/);
  assert.match(activity, /fun onGameError\(message: String\)/);
  assert.match(activity, /GAME_STARTUP_ERROR/);
  assert.match(activity, /تعذر تشغيل محرك اللعبة/);
  assert.match(gameView, /AndroidDiagnostics/);
  assert.match(gameView, /onGameError/);
});

test("GAME_READY waits for a valid WebGL2 drawing surface after animation frames", () => {
  assert.match(gameView, /requestAnimationFrame\(\(\) => \{/);
  assert.match(gameView, /readyFrame2 = requestAnimationFrame/);
  assert.match(gameView, /canvas\.getContext\("webgl2"\)/);
  assert.match(gameView, /gl\.isContextLost\(\)/);
  assert.match(gameView, /canvas\.width < 1 \|\| canvas\.height < 1/);
  assert.match(gameView, /androidBridge\?\.onGameReady\?\.\(\)/);
});

test("game teardown releases sprite materials and their textures as well as meshes", () => {
  assert.match(engine, /const renderable = object as THREE\.Mesh \| THREE\.Sprite/);
  assert.match(engine, /const geometry = \(renderable as THREE\.Mesh\)\.geometry/);
  assert.match(engine, /const material = renderable\.material/);
  assert.match(engine, /if \(value && typeof value === "object" && \(value as THREE\.Texture\)\.isTexture\)/);
  assert.match(engine, /for \(const texture of textures\) texture\.dispose\(\)/);
  assert.match(engine, /for \(const material of materials\) material\.dispose\(\)/);
  assert.match(engine, /for \(const geometry of geometries\) geometry\.dispose\(\)/);
});

test("release checklist does not confuse browser smoke tests with physical device proof", () => {
  assert.match(readiness, /do not prove successful operation on every physical Android phone/i);
  assert.match(readiness, /physical-device verification/i);
  assert.match(readiness, /airplane-mode play/i);
  assert.match(readiness, /signed AAB/i);
});
