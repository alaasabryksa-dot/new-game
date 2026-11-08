import { useEffect, useRef, useState, type PointerEvent as ReactPointer, type RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Fuel,
  Gauge,
  MapPin,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import {
  DENSITIES,
  GAS_COST,
  JOBS_NEED,
  MODES,
  PAINTS,
  RENT,
  UPGRADES,
  type Hud,
  type PreviewCfg,
  type UpgradeId,
} from "@/game/types";
import type { GameHandle } from "@/game/engine";

const INITIAL: PreviewCfg = {
  mode: "shift",
  vehicle: "tuktuk",
  night: false,
  density: 1,
  paint: "#f0b429",
  sound: true,
};

function formatTime(t: number) {
  const m = Math.floor(Math.max(0, t) / 60);
  const s = Math.floor(Math.max(0, t) % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DarSalam() {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const holds = useRef({ l: false, r: false, g: false, b: false });
  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState<PreviewCfg>(INITIAL);
  const [snap, setSnap] = useState<Hud | null>(null);

  useEffect(() => {
    const canvas = viewRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;
    let dead = false;
    let handle: GameHandle | null = null;
    const releaseInputs = () => {
      holds.current = { l: false, r: false, g: false, b: false };
      gameRef.current?.setTouch({ steer: 0, throttle: 0, brake: 0 });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") releaseInputs();
    };
    window.addEventListener("blur", releaseInputs);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void import("@/game/engine").then(({ mountGame }) => {
      if (dead) return;
      handle = mountGame(canvas, map, setSnap);
      gameRef.current = handle;
      const heard = handle.getHud();
      setCfg((c) => ({ ...c, sound: heard.sound }));
      setReady(true);
    });
    return () => {
      dead = true;
      window.removeEventListener("blur", releaseInputs);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      releaseInputs();
      handle?.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setPreview(cfg);
  }, [cfg]);

  const phase = snap?.phase ?? "menu";

  const syncTouch = () => {
    const h = holds.current;
    const steer = (h.l ? 1 : 0) + (h.r ? -1 : 0);
    gameRef.current?.setTouch({
      steer,
      throttle: h.g ? 1 : 0,
      brake: h.b ? 1 : 0,
    });
  };

  const hold = (key: "l" | "r" | "g" | "b") => ({
    onPointerDown: (e: ReactPointer<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      holds.current[key] = true;
      syncTouch();
    },
    onPointerUp: () => {
      holds.current[key] = false;
      syncTouch();
    },
    onPointerCancel: () => {
      holds.current[key] = false;
      syncTouch();
    },
    onLostPointerCapture: () => {
      holds.current[key] = false;
      syncTouch();
    },
  });

  const patch = (partial: Partial<PreviewCfg>) => setCfg((c) => ({ ...c, ...partial }));
  const startLabel =
    cfg.mode === "rush" ? "ابدأ التوصيلات" : cfg.mode === "cruise" ? "انزل الشارع" : "ابدأ الوردية";
  const startGame = () => {
    // Android installed PWAs can lock orientation after a user gesture.
    // Browsers that do not support the API still work in landscape manually.
    const orientation = screen.orientation as unknown as {
      lock?: (value: string) => Promise<void>;
    };
    if (typeof orientation?.lock === "function") {
      void orientation.lock("landscape").catch(() => undefined);
    }
    gameRef.current?.start(cfg);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-asphalt font-sans text-ink touch-none select-none">
      <canvas ref={viewRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={mapRef}
        width={180}
        height={180}
        className={
          phase === "play" || phase === "pause"
            ? "absolute top-2 left-1/2 z-20 h-14 w-14 -translate-x-1/2 rounded-full border border-line md:top-4 md:h-24 md:w-24"
            : "pointer-events-none absolute h-px w-px opacity-0"
        }
      />

      {snap?.alert === "radar" ? <div className="pointer-events-none absolute inset-0 z-10 bg-brick/25" /> : null}
      {snap?.alert === "crash" ? <div className="pointer-events-none absolute inset-0 z-10 bg-brick/35" /> : null}
      {snap?.lowFuel && phase === "play" ? (
        <div className="pointer-events-none absolute inset-0 z-10 bg-brick/15" />
      ) : null}

      {phase === "menu" ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <section className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-panel/95 shadow-xl">
            <div className="h-1.5 bg-amber" />
            <div className="overflow-y-auto p-4 sm:p-5">
              <p className="text-xs font-bold text-brick">حلقة العشرين</p>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">TukTuk Dar El Salam</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                ركّب من اليمين، نزّل الركاب، وخلّي بالك من البنزين والمطب والكمين.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => patch({ mode: m.id })}
                    className={
                      cfg.mode === m.id
                        ? "rounded-xl bg-amber px-2 py-3 text-amber-ink"
                        : "rounded-xl bg-panel-2 px-2 py-3 text-ink"
                    }
                  >
                    <span className="block text-sm font-extrabold">{m.name}</span>
                    <span className="mt-1 block text-xs leading-snug opacity-80">{m.blurb}</span>
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs font-bold text-muted">لون التوكتوك</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {PAINTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={p.name}
                    onClick={() => patch({ paint: p.hex })}
                    className={
                      cfg.paint === p.hex
                        ? `h-11 w-11 rounded-full border-2 border-ink ${p.swatch}`
                        : `h-11 w-11 rounded-full border-2 border-line ${p.swatch}`
                    }
                  />
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {DENSITIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => patch({ density: d.id })}
                    className={
                      cfg.density === d.id
                        ? "rounded-full bg-nile px-3 py-2 text-xs font-bold text-asphalt"
                        : "rounded-full bg-panel-2 px-3 py-2 text-xs font-bold text-ink"
                    }
                  >
                    {d.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => patch({ night: !cfg.night })}
                  className="rounded-full bg-panel-2 px-3 py-2 text-xs font-bold"
                >
                  {cfg.night ? "ليل الحتة" : "الضهر"}
                </button>
                <button
                  type="button"
                  onClick={() => patch({ sound: !cfg.sound })}
                  className="rounded-full bg-panel-2 p-2"
                  aria-label={cfg.sound ? "كتم الصوت" : "تشغيل الصوت"}
                >
                  {cfg.sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-extrabold">الورشة</p>
                <p className="flex items-center gap-1 text-sm font-extrabold text-amber">
                  <Wallet className="size-4" />
                  <span dir="ltr">{snap?.wallet ?? 0}</span>
                  <span className="text-xs font-bold text-muted">ج</span>
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {UPGRADES.map((u) => {
                  const lvl = snap?.upgrades[u.id] ?? 0;
                  const maxed = lvl >= u.max;
                  const cost = u.costs[lvl] ?? 0;
                  const afford = (snap?.wallet ?? 0) >= cost;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!ready || maxed || !afford}
                      onClick={() => gameRef.current?.buy(u.id as UpgradeId)}
                      className="rounded-xl bg-panel-2 px-3 py-2 text-right disabled:opacity-45"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold">{u.name}</span>
                        <span className="text-xs font-bold text-amber">{maxed ? "كامل" : `${cost} ج`}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{u.blurb}</span>
                      <span className="mt-2 flex gap-1">
                        {Array.from({ length: u.max }, (_, i) => (
                          <span
                            key={i}
                            className={i < lvl ? "h-1.5 flex-1 rounded-full bg-amber" : "h-1.5 flex-1 rounded-full bg-line"}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>

              {snap && (snap.bestMoney > 0 || snap.bestKm > 0 || snap.bestTrial != null) ? (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  أحسن وردية {snap.bestMoney} ج · أطول لفة {snap.bestKm} كم
                  {snap.bestTrial != null ? ` · أسرع توصيلات ${formatTime(snap.bestTrial)}` : ""}
                </p>
              ) : null}

              <p className="mt-3 text-center text-xs leading-relaxed text-muted">
                كمبيوتر: W بنزين · S فرامل · A شمال · D يمين · H كلاكس · C كاميرا
                <br />
                الإيجار {RENT} ج في ٣ دقايق · التانك {GAS_COST} ج يمين الشارع
              </p>
              <p className="mt-3 text-center text-[10px] text-muted">
                بيانات الطريق © مساهمو OpenStreetMap ·
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  ترخيص ODbL
                </a>
              </p>
            </div>
            <div className="border-t border-line p-3">
              <button
                type="button"
                disabled={!ready}
                onClick={startGame}
                className="w-full rounded-xl bg-amber py-3 text-lg font-extrabold text-amber-ink disabled:opacity-60"
              >
                {ready ? startLabel : "لحظة، بنجهّز التوكتوك"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {phase !== "menu" && snap ? (
        <PlayHud snap={snap} hold={hold} game={gameRef} onAgain={() => gameRef.current?.start(cfg)} />
      ) : null}
    </main>
  );
}

function PlayHud({
  snap,
  hold,
  game,
  onAgain,
}: {
  snap: Hud;
  hold: (key: "l" | "r" | "g" | "b") => {
    onPointerDown: (e: ReactPointer<HTMLButtonElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
  game: RefObject<GameHandle | null>;
  onAgain: () => void;
}) {
  const shift = snap.mode === "shift";
  const rush = snap.mode === "rush";
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto w-32 rounded-2xl border border-line bg-panel/90 px-3 py-2 sm:w-40">
          <div className="flex items-center gap-1 text-xs text-muted">
            <Gauge className="size-3.5 text-amber" />
            كم/س
          </div>
          <p dir="ltr" className="text-3xl font-extrabold leading-none tabular-nums">
            {snap.speed}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted">
            <Fuel className={snap.lowFuel ? "size-3.5 text-brick" : "size-3.5 text-amber"} />
            بنزين
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className={snap.lowFuel ? "h-full bg-brick" : "h-full bg-nile"}
              style={{ width: `${Math.max(0, Math.min(100, snap.fuel))}%` }}
            />
          </div>
          {shift ? (
            <>
              <p className="mt-2 text-lg font-extrabold tabular-nums" dir="ltr">
                {snap.money} <span className="text-xs font-bold text-muted">ج</span>
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-amber"
                  style={{ width: `${Math.min(100, (snap.money / snap.rent) * 100)}%` }}
                />
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <Timer className="size-3.5 text-amber" />
                <span dir="ltr">{formatTime(snap.shiftLeft)}</span>
                <span>· إيجار {snap.rent}</span>
              </p>
            </>
          ) : rush ? (
            <>
              <p className="mt-2 text-lg font-extrabold tabular-nums" dir="ltr">
                {snap.jobsDone}/{snap.jobsNeed || JOBS_NEED}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm font-extrabold tabular-nums" dir="ltr">
                <Timer className="size-3.5 text-amber" />
                {formatTime(snap.time)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-lg font-extrabold tabular-nums" dir="ltr">
                {snap.money} <span className="text-xs font-bold text-muted">ج</span>
              </p>
              <p className="mt-1 text-xs text-muted">{snap.km} كم</p>
            </>
          )}
          {snap.seats > 0 && !rush ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
                <span>ركاب {snap.passengers.length}/{snap.seats}</span>
                <span>منتظرين {snap.waitingPassengers}/8</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-nile transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (snap.waitingPassengers / 8) * 100))}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {snap.passengers.map((passenger, index) => (
                  <span key={`${passenger.dest}-${index}`} className="rounded-md bg-panel-2 px-1.5 py-1 text-[10px] font-bold">
                    {passenger.dest} · {passenger.fare}ج
                  </span>
                ))}
              </div>
              {snap.passengers.length > 0 ? (
                <p className="text-xs font-extrabold text-amber">أجرة متوقعة {snap.onboardFareTotal} ج</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto w-32 rounded-2xl border border-line bg-panel/90 px-3 py-2 sm:w-40">
          <div className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3.5 text-nile" />
            {rush ? "التوصيلة" : "النزلة"}
          </div>
          <p className="truncate text-base font-extrabold leading-snug">{rush ? snap.jobName : snap.stopName}</p>
          <p dir="ltr" className="text-sm font-bold text-amber tabular-nums">
            {snap.stopDist} m
          </p>
          {snap.hint ? <p className="mt-1 text-xs font-bold text-amber">{snap.hint}</p> : null}
        </div>
      </div>

      {snap.message ? (
        <p className="pointer-events-none absolute bottom-52 left-1/2 z-20 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-asphalt/80 px-4 py-2 text-center text-sm font-bold md:bottom-24">
          {snap.message}
        </p>
      ) : null}

      <div className="absolute bottom-36 left-1/2 z-30 flex -translate-x-1/2 gap-2">
        <button
          type="button"
          className="rounded-full bg-panel/90 p-3"
          aria-label="إيقاف"
          onClick={() => (snap.phase === "pause" ? game.current?.resume() : game.current?.pause())}
        >
          {snap.phase === "pause" ? <Play className="size-5" /> : <Pause className="size-5" />}
        </button>
        <button
          type="button"
          className="rounded-full bg-panel/90 p-3"
          aria-label="كلاكس"
          onClick={() => game.current?.horn()}
        >
          <Megaphone className="size-5" />
        </button>
        <button
          type="button"
          className="rounded-full bg-panel/90 px-3 py-2 text-xs font-bold"
          onClick={() => game.current?.cycleCam()}
        >
          كاميرا
        </button>
      </div>

      <div dir="ltr" className="absolute inset-x-0 bottom-4 z-30 flex items-end justify-between px-3">
        <div className="flex gap-2">
          <button type="button" className="h-16 w-16 touch-none rounded-2xl bg-panel/90 text-ink" aria-label="يسار" {...hold("l")}>
            <ChevronLeft className="mx-auto size-8" />
          </button>
          <button type="button" className="h-16 w-16 touch-none rounded-2xl bg-panel/90 text-ink" aria-label="يمين" {...hold("r")}>
            <ChevronRight className="mx-auto size-8" />
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="فرامل" className="h-16 w-20 touch-none rounded-2xl bg-panel-2 text-sm font-extrabold" {...hold("b")}>
            فرامل
          </button>
          <button
            type="button"
            className="h-16 w-20 touch-none rounded-2xl bg-amber text-sm font-extrabold text-amber-ink"
            aria-label="بنزين"
            {...hold("g")}
          >
            بنزين
          </button>
        </div>
      </div>

      {snap.phase === "pause" || snap.phase === "summary" ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-asphalt/75 p-4">
          <section className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 text-center">
            <h2 className="text-2xl font-extrabold text-amber">
              {snap.phase === "pause" ? "وقفة" : rush ? "التوصيلات" : shift ? "خلصت الوردية" : "خلصت اللفة"}
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-muted">{rush ? "المشاوير" : "المكسب"}</span>
                <span className="font-extrabold">
                  {rush ? `${snap.jobsDone}/${snap.jobsNeed}` : `${snap.money} ج`}
                </span>
              </li>
              {shift ? (
                <li className="flex justify-between">
                  <span className="text-muted">الإيجار</span>
                  <span className="font-extrabold">{snap.rent} ج</span>
                </li>
              ) : null}
              <li className="flex justify-between">
                <span className="text-muted">المحفظة</span>
                <span className="font-extrabold">{snap.wallet} ج</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">المسافة</span>
                <span className="font-extrabold">{snap.km} كم</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">الوقت</span>
                <span className="font-extrabold" dir="ltr">
                  {formatTime(snap.time)}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">الخبطات</span>
                <span className="font-extrabold">{snap.crashes}</span>
              </li>
            </ul>
            {snap.message ? <p className="mt-3 text-sm font-bold text-amber">{snap.message}</p> : null}
            <div className="mt-5 flex gap-2">
              {snap.phase === "pause" ? (
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber py-3 font-extrabold text-amber-ink"
                  onClick={() => game.current?.resume()}
                >
                  <Play className="size-4" />
                  كمّل
                </button>
              ) : (
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber py-3 font-extrabold text-amber-ink"
                  onClick={onAgain}
                >
                  <RotateCcw className="size-4" />
                  تاني
                </button>
              )}
              {snap.phase === "pause" ? (
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-panel-2 py-3 font-bold"
                  onClick={() => game.current?.finish()}
                >
                  <Flag className="size-4" />
                  خلّص
                </button>
              ) : null}
              <button
                type="button"
                className="flex-1 rounded-xl bg-panel-2 py-3 font-bold"
                onClick={() => game.current?.quit()}
              >
                القائمة
              </button>
            </div>
          </section>
        </div>
      ) : (
        <button
          type="button"
          className="absolute bottom-6 left-4 z-20 hidden rounded-full bg-panel/80 px-4 py-2 text-xs font-bold text-muted md:block"
          onClick={() => game.current?.finish()}
        >
          خلّص المشوار
        </button>
      )}
    </>
  );
}
