import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ui = await readFile(new URL("../src/components/dar-salam.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("Android menu and canvas expose stable accessible names", () => {
  assert.match(ui, /aria-label="لعبة توكتوك دار السلام"/);
  assert.match(ui, /aria-hidden="true" className="game-canvas/);
  assert.match(ui, /aria-label="القائمة الرئيسية وإعدادات اللعبة"/);
  assert.match(ui, /role="alert" className="absolute inset-0 z-50/);
  assert.match(ui, /aria-label=\{\x60\$\{u\.name\}: المستوى/);
});

test("menu controls have larger targets and visible keyboard focus", () => {
  assert.match(ui, /min-h-14 rounded-xl bg-amber/);
  assert.match(ui, /min-h-14 rounded-xl bg-panel-2/);
  assert.match(ui, /min-h-16 rounded-xl bg-panel-2/);
  assert.match(ui, /min-h-14 w-full rounded-xl bg-amber/);
  assert.match(ui, /focus-visible:outline/);
});

test("wallet and workshop values remain readable and aligned", () => {
  assert.match(ui, /className="tabular-nums">\{snap\?\.wallet/);
  assert.match(ui, /السعر \$\{cost\} جنيه/);
  assert.match(ui, /tracking-wide text-brick/);
  assert.match(ui, /leading-relaxed text-muted/);
});

test("driving HUD respects Android safe areas", () => {
  assert.match(ui, /env\(safe-area-inset-top\)/);
  assert.match(ui, /env\(safe-area-inset-bottom\)/);
  assert.match(ui, /bottom-\[calc\(9rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(ui, /bottom-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
});

test("driving buttons provide press feedback and reachable touch targets", () => {
  assert.match(ui, /min-h-12 min-w-12 rounded-full/);
  assert.match(ui, /active:scale-95 active:bg-panel-2/);
  assert.match(ui, /active:scale-95 active:bg-panel /);
  assert.match(ui, /active:scale-95 active:bg-amber\/80/);
  assert.match(ui, /shadow-lg/);
});

test("pause and summary surfaces remain accessible and legible", () => {
  assert.match(ui, /role="dialog" aria-modal="true"/);
  assert.match(ui, /shadow-2xl/);
  assert.match(ui, /min-h-12 flex-1/);
  assert.match(ui, /bg-panel\/95/);
});

test("CSS provides touch, focus, reduced-motion and short-landscape safeguards", () => {
  assert.match(css, /\.game-root \{/);
  assert.match(css, /overscroll-behavior: none/);
  assert.match(css, /\.game-canvas \{/);
  assert.match(css, /touch-action: none/);
  assert.match(css, /\.game-menu-scroll \{/);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
  assert.match(css, /button:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-height: 420px/);
  assert.match(css, /min-height: 100dvh/);
});
