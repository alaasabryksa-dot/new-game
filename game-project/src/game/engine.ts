import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  GAS_COST,
  JOBS_NEED,
  RENT,
  SHIFT_SECONDS,
  UPGRADES,
  type Hud,
  type Pax,
  type Phase,
  type PreviewCfg,
  type UpgradeId,
  type Upgrades,
  type VehicleId,
  vehicleById,
} from "./types";
import { ROAD_HALF, buildTrack, laneLat, wrapAngle, wrapDelta, type Track } from "./track";

export type GameHandle = {
  getHud: () => Hud;
  setPreview: (cfg: PreviewCfg) => void;
  start: (cfg: PreviewCfg) => void;
  pause: () => void;
  resume: () => void;
  quit: () => void;
  finish: () => void;
  setTouch: (t: { steer: number; throttle: number; brake: number }) => void;
  horn: () => void;
  cycleCam: () => void;
  toggleSound: () => void;
  buy: (id: UpgradeId) => void;
  dispose: () => void;
};

type Npc = {
  alive: boolean;
  kind: VehicleId;
  s: number;
  lane: number;
  laneTarget: number;
  speed: number;
  cruise: number;
  brake: number;
  stopTimer: number;
  stopAt: number;
  color: THREE.Color;
  nextLane: number;
};

type Wrong = { s: number; speed: number; lat: number };

const SAVE_KEY = "daralsalam-save-v2";
const RADAR_LIMIT = 78 / 3.6;
const TOLL_LIMIT = 36 / 3.6;

type Save = {
  v: 2;
  bestMoney: number;
  bestKm: number;
  bestTrial: number | null;
  sound: boolean;
  wallet: number;
  upgrades: Upgrades;
};

function blankUpgrades(): Upgrades {
  return { motor: 0, fuel: 0, seats: 0, tires: 0 };
}

function clampLvl(n: unknown) {
  const v = Math.floor(Number.isFinite(Number(n)) ? Number(n) : 0);
  return Math.max(0, Math.min(3, v));
}

function loadSave(): Save {
  const blank: Save = {
    v: 2,
    bestMoney: 0,
    bestKm: 0,
    bestTrial: null,
    sound: true,
    wallet: 0,
    upgrades: blankUpgrades(),
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blank;
    const p = JSON.parse(raw) as Partial<Save>;
    if (p.v !== 2) return blank;
    const u = (p.upgrades ?? {}) as Partial<Upgrades>;
    return {
      v: 2,
      bestMoney: Math.max(0, Number(p.bestMoney) || 0),
      bestKm: Math.max(0, Number(p.bestKm) || 0),
      bestTrial: typeof p.bestTrial === "number" && Number.isFinite(p.bestTrial) && p.bestTrial >= 0 ? p.bestTrial : null,
      sound: p.sound !== false,
      wallet: Math.max(0, Math.floor(Number(p.wallet) || 0)),
      upgrades: {
        motor: clampLvl(u.motor),
        fuel: clampLvl(u.fuel),
        seats: clampLvl(u.seats),
        tires: clampLvl(u.tires),
      },
    };
  } catch {
    return blank;
  }
}

function writeSave(s: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts, false) ?? parts[0];
}

const KINDS: VehicleId[] = ["malaky", "taxi", "micro", "tuktuk", "truck"];

function trafficGeoms(kind: VehicleId) {
  const body: THREE.BufferGeometry[] = [];
  const glass: THREE.BufferGeometry[] = [];
  const wheels: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const wheel = () => {
    const g = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 8);
    g.rotateZ(Math.PI / 2);
    return g;
  };
  const addW = (x: number, y: number, z: number, s = 1) => {
    const g = wheel();
    g.scale(s, s, s);
    g.translate(x, y, z);
    wheels.push(g);
  };

  if (kind === "micro") {
    body.push(box(2.05, 1.45, 4.9, 0, 1.2, 0.05));
    glass.push(box(1.85, 0.55, 1.3, 0, 1.85, -1.05));
    glass.push(box(1.7, 0.42, 2.2, 0, 1.78, 0.85));
    lights.push(box(0.2, 0.22, 0.08, -0.75, 0.95, 2.5));
    lights.push(box(0.2, 0.22, 0.08, 0.75, 0.95, 2.5));
    addW(-1.05, 0.36, -1.6, 1.05);
    addW(1.05, 0.36, -1.6, 1.05);
    addW(-1.05, 0.36, 1.5, 1.05);
    addW(1.05, 0.36, 1.5, 1.05);
  } else if (kind === "tuktuk") {
    body.push(box(1.3, 1.15, 2.15, 0, 0.95, 0.05));
    body.push(box(1.35, 0.08, 1.5, 0, 1.58, 0.15));
    glass.push(box(1.15, 0.55, 0.9, 0, 1.25, -0.15));
    lights.push(box(0.12, 0.12, 0.06, -0.45, 0.7, 1.15));
    lights.push(box(0.12, 0.12, 0.06, 0.45, 0.7, 1.15));
    addW(-0.62, 0.3, 0.55, 0.85);
    addW(0.62, 0.3, 0.55, 0.85);
    addW(0, 0.3, -0.85, 0.85);
  } else if (kind === "truck") {
    body.push(box(2.35, 1.55, 7.2, 0, 1.25, 1.35));
    body.push(box(2.2, 1.7, 2.3, 0, 1.45, -3.15));
    glass.push(box(1.9, 0.55, 0.9, 0, 1.9, -3.55));
    lights.push(box(0.22, 0.18, 0.08, -0.8, 0.85, 4.95));
    lights.push(box(0.22, 0.18, 0.08, 0.8, 0.85, 4.95));
    addW(-1.15, 0.42, -3.3, 1.2);
    addW(1.15, 0.42, -3.3, 1.2);
    addW(-1.15, 0.42, 1.2, 1.2);
    addW(1.15, 0.42, 1.2, 1.2);
    addW(-1.15, 0.42, 3.5, 1.2);
    addW(1.15, 0.42, 3.5, 1.2);
  } else {
    body.push(box(1.72, 0.48, 4.25, 0, 0.62, 0));
    body.push(box(1.55, 0.42, 2.05, 0, 1.05, 0.28));
    if (kind === "taxi") body.push(box(0.34, 0.16, 0.34, 0, 1.38, 0.15));
    glass.push(box(1.4, 0.36, 1.15, 0, 1.08, -0.15));
    lights.push(box(0.22, 0.14, 0.06, -0.62, 0.72, 2.12));
    lights.push(box(0.22, 0.14, 0.06, 0.62, 0.72, 2.12));
    addW(-0.78, 0.32, -1.35);
    addW(0.78, 0.32, -1.35);
    addW(-0.78, 0.32, 1.28);
    addW(0.78, 0.32, 1.28);
  }
  return {
    body: merge(body),
    glass: merge(glass),
    wheels: merge(wheels),
    lights: merge(lights),
  };
}

function buildPlayer(kind: VehicleId, hex: string) {
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  const paint = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0.18 });
  const glass = new THREE.MeshStandardMaterial({
    color: "#b7dbe3",
    roughness: 0.12,
    metalness: 0.28,
    transparent: true,
    opacity: 0.84,
  });
  const dark = new THREE.MeshStandardMaterial({ color: "#17191d", roughness: 0.7 });
  const tail = new THREE.MeshStandardMaterial({
    color: "#ff3b3b",
    emissive: "#ff2020",
    emissiveIntensity: 1.05,
  });
  const head = new THREE.MeshStandardMaterial({
    color: "#fff6d8",
    emissive: "#ffe7a8",
    emissiveIntensity: 0.48,
  });
  const wheels: THREE.Mesh[] = [];
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const addWheels = (x: number, z: number, r: number) => {
    const geo = new THREE.CylinderGeometry(r, r, r * 0.7, 16);
    geo.rotateZ(Math.PI / 2);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(geo, dark);
      m.position.set(sx * x, r, z);
      g.add(m);
      wheels.push(m);
    }
  };

  if (kind === "micro") {
    put(new THREE.BoxGeometry(2.08, 1.18, 4.9), paint, 0, 1.05, 0.05);
    put(new THREE.BoxGeometry(1.92, 0.5, 1.35), glass, 0, 1.78, -0.95);
    put(new THREE.BoxGeometry(1.78, 0.42, 2.1), glass, 0, 1.72, 0.9);
    put(new THREE.BoxGeometry(0.22, 0.26, 0.08), tail, -0.72, 0.95, 2.52);
    put(new THREE.BoxGeometry(0.22, 0.26, 0.08), tail, 0.72, 0.95, 2.52);
    put(new THREE.BoxGeometry(0.42, 0.22, 0.08), head, -0.65, 0.95, -2.42);
    put(new THREE.BoxGeometry(0.42, 0.22, 0.08), head, 0.65, 0.95, -2.42);
    addWheels(1.02, -1.55, 0.38);
    addWheels(1.02, 1.5, 0.38);
  } else if (kind === "tuktuk") {
    put(new THREE.BoxGeometry(1.32, 0.92, 2.1), paint, 0, 0.85, 0.05);
    put(new THREE.BoxGeometry(1.44, 0.09, 1.58), paint, 0, 1.55, 0.1);
    put(new THREE.BoxGeometry(1.48, 0.05, 1.64), dark, 0, 1.62, 0.1);
    put(new THREE.BoxGeometry(1.12, 0.48, 0.85), glass, 0, 1.15, -0.1);
    put(new THREE.BoxGeometry(0.12, 0.12, 0.06), tail, -0.42, 0.62, 1.12);
    put(new THREE.BoxGeometry(0.12, 0.12, 0.06), tail, 0.42, 0.62, 1.12);
    put(new THREE.BoxGeometry(0.2, 0.16, 0.06), head, 0, 0.7, -1.02);
    addWheels(0.62, 0.55, 0.3);
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, dark);
    m.position.set(0, 0.3, -0.85);
    g.add(m);
    wheels.push(m);
  } else if (kind === "truck") {
    put(new THREE.BoxGeometry(2.42, 1.48, 7.1), paint, 0, 1.2, 1.4);
    put(new THREE.BoxGeometry(2.18, 1.58, 2.35), paint, 0, 1.4, -3.1);
    put(new THREE.BoxGeometry(1.85, 0.5, 0.85), glass, 0, 1.9, -3.5);
    put(new THREE.BoxGeometry(0.24, 0.18, 0.08), tail, -0.85, 0.8, 4.95);
    put(new THREE.BoxGeometry(0.24, 0.18, 0.08), tail, 0.85, 0.8, 4.95);
    put(new THREE.BoxGeometry(0.3, 0.18, 0.08), head, -0.7, 0.85, -4.25);
    put(new THREE.BoxGeometry(0.3, 0.18, 0.08), head, 0.7, 0.85, -4.25);
    addWheels(1.15, -3.25, 0.42);
    addWheels(1.15, 1.15, 0.42);
    addWheels(1.15, 3.45, 0.42);
  } else {
    put(new THREE.BoxGeometry(1.74, 0.48, 4.3), paint, 0, 0.62, 0);
    put(new THREE.BoxGeometry(1.55, 0.42, 1.9), paint, 0, 1.02, 0.32);
    put(new THREE.BoxGeometry(1.35, 0.34, 1.05), glass, 0, 1.05, -0.2);
    if (kind === "taxi") {
      const lamp = new THREE.MeshStandardMaterial({
        color: "#f0b429",
        emissive: "#f0b429",
        emissiveIntensity: 0.8,
      });
      put(new THREE.BoxGeometry(0.28, 0.14, 0.28), lamp, 0, 1.32, 0.15);
    }
    put(new THREE.BoxGeometry(0.24, 0.14, 0.06), tail, -0.6, 0.7, 2.16);
    put(new THREE.BoxGeometry(0.24, 0.14, 0.06), tail, 0.6, 0.7, 2.16);
    put(new THREE.BoxGeometry(0.32, 0.14, 0.06), head, -0.55, 0.62, -2.16);
    put(new THREE.BoxGeometry(0.32, 0.14, 0.06), head, 0.55, 0.62, -2.16);
    addWheels(0.78, -1.32, 0.32);
    addWheels(0.78, 1.28, 0.32);
  }

  const spotL = new THREE.SpotLight("#fff1cc", 0, 52, Math.PI / 9, 0.42, 1);
  spotL.position.set(-0.45, 0.9, -1.6);
  const spotR = new THREE.SpotLight("#fff1cc", 0, 46, Math.PI / 8, 0.45, 1);
  spotR.position.set(0.45, 0.9, -1.6);
  const target = new THREE.Object3D();
  target.position.set(0, 0.4, -18);
  g.add(spotL, spotR, target);
  spotL.target = target;
  spotR.target = target;

  const rider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.2, 0.4, 4, 10),
    new THREE.MeshStandardMaterial({ color: "#1d3557", roughness: 0.7 }),
  );
  rider.position.set(0.02, 1.22, 0.28);
  rider.visible = false;
  g.add(rider);

  return { group: g, wheels, paint, spots: [spotL, spotR], rider };
}

function facadeTexture(base: string) {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;

  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);

  // Subtle plaster variation and horizontal floor bands.
  for (let y = 0; y < c.height; y += 3) {
    const shade = Math.sin(y * 0.17) * 3;
    g.fillStyle = shade > 0 ? "rgba(255,255,255,0.035)" : "rgba(45,35,25,0.025)";
    g.fillRect(0, y, c.width, 1.5);
  }
  for (let y = 0; y <= c.height; y += 128) {
    g.fillStyle = "rgba(70,55,42,0.16)";
    g.fillRect(0, y, c.width, 5);
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.fillRect(0, y + 5, c.width, 2);
  }

  // Repeated apartment windows with frames, recessed glass and occasional balconies.
  for (let floor = 0; floor < 4; floor++) {
    const y = 20 + floor * 124;
    for (let col = 0; col < 4; col++) {
      const x = 12 + col * 88;
      const warm = (floor * 7 + col * 11 + base.length) % 5 === 0;
      g.fillStyle = "rgba(65,52,42,0.28)";
      g.fillRect(x - 4, y - 4, 45, 78);
      g.fillStyle = "#d7d0c2";
      g.fillRect(x - 2, y - 2, 41, 74);
      g.fillStyle = warm ? "#b6a17e" : "#8299a3";
      g.fillRect(x + 2, y + 2, 33, 66);
      g.fillStyle = "rgba(245,248,238,0.72)";
      g.fillRect(x + 4, y + 4, 4, 58);
      g.fillStyle = "rgba(35,48,54,0.55)";
      g.fillRect(x + 18, y + 2, 2, 66);
      g.fillRect(x + 2, y + 33, 33, 2);

      if ((floor + col) % 3 === 0) {
        g.fillStyle = "#b9b2a5";
        g.fillRect(x - 7, y + 70, 47, 5);
        g.fillStyle = "#6e7778";
        g.fillRect(x - 7, y + 75, 47, 3);
        g.fillStyle = "#aeb9b8";
        g.fillRect(x - 5, y + 57, 2, 15);
        g.fillRect(x + 36, y + 57, 2, 15);
        g.fillRect(x + 8, y + 57, 2, 15);
        g.fillRect(x + 20, y + 57, 2, 15);
      }
      if ((floor * 3 + col) % 4 === 0) {
        g.fillStyle = "#e7e2d8";
        g.fillRect(x + 35, y + 20, 10, 16);
        g.fillStyle = "#737b7d";
        g.fillRect(x + 33, y + 36, 14, 3);
      }
    }
  }

  // Weathering near the lower edge and small facade details.
  g.fillStyle = "rgba(80,65,50,0.13)";
  g.fillRect(0, 478, c.width, 34);
  for (let x = 8; x < 250; x += 31) {
    g.fillStyle = "rgba(45,45,42,0.18)";
    g.fillRect(x, 486 + (x % 3) * 3, 12, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function emissiveWindows() {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 248; y += 27) {
    for (let x = 10; x < 150; x += 24) {
      if (Math.sin(x * 3.1 + y * 1.7) > 0.15) {
        g.fillStyle = "#ffcc77";
        g.fillRect(x, y, 12, 16);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(title: string, sub: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#163e86";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#f0b429";
  g.fillRect(0, 0, 512, 10);
  g.fillStyle = "#f6f1e7";
  g.direction = "rtl";
  g.textAlign = "center";
  g.font = "800 72px Tajawal, sans-serif";
  g.fillText(title, 256, 120);
  g.font = "500 36px Tajawal, sans-serif";
  g.fillStyle = "#d6e4ff";
  g.fillText(sub, 256, 185);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Sfx {
  ctx: AudioContext | null = null;
  gain: GainNode | null = null;
  osc: OscillatorNode | null = null;
  filter: BiquadFilterNode | null = null;
  on = true;

  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 260;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 44;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.ctx = ctx;
      this.gain = gain;
      this.osc = osc;
      this.filter = filter;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  engine(speed: number, throttle: number) {
    if (!this.ctx || !this.osc || !this.gain || !this.filter || !this.on) {
      if (this.gain) this.gain.gain.value = 0.0001;
      return;
    }
    const k = Math.abs(speed);
    this.osc.frequency.value = 40 + k * 3.25 + throttle * 20;
    this.filter.frequency.value = 190 + k * 19;
    this.gain.gain.value = 0.016 + Math.min(0.045, k * 0.0016);
  }

  blip(freq: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.on) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.stop(this.ctx.currentTime + dur + 0.02);
  }

  horn() {
    this.blip(340, 0.18, "square", 0.05);
    setTimeout(() => this.blip(280, 0.16, "square", 0.04), 90);
  }

  cash() {
    this.blip(660, 0.08, "sine", 0.05);
    setTimeout(() => this.blip(880, 0.1, "sine", 0.04), 70);
  }

  crash() {
    this.blip(90, 0.22, "sawtooth", 0.07);
  }

  radar() {
    this.blip(980, 0.12, "square", 0.05);
  }

  stop() {
    if (this.gain) this.gain.gain.value = 0.0001;
    void this.ctx?.close();
    this.ctx = null;
  }
}

const defaultCfg: PreviewCfg = {
  mode: "shift",
  vehicle: "tuktuk",
  night: false,
  density: 1,
  paint: "#f0b429",
  sound: true,
};

export function mountGame(
  canvas: HTMLCanvasElement,
  map: HTMLCanvasElement,
  onHud: (h: Hud) => void,
): GameHandle {
  const track = buildTrack();
  const save = loadSave();
  const sfx = new Sfx();
  sfx.on = save.sound;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor("#9ec9e8");
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#b7d4ea", 76, 650);
  const camera = new THREE.PerspectiveCamera(69, 1, 0.12, 1000);

  const hemi = new THREE.HemisphereLight("#d5ecf8", "#b7a07a", 1.1);
  const sun = new THREE.DirectionalLight("#fff2d2", 1.5);
  sun.position.set(-135, 190, 72);
  scene.add(hemi, sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(980, 48),
    new THREE.MeshStandardMaterial({ color: "#c6b48a", roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  scene.add(ground);

  buildRoad(scene, track);
  buildCrosswalks(scene, track);
  const animateTrafficSignals = buildTrafficSignals(scene, track);
  buildStreetSigns(scene, track);
  buildElectricalPoles(scene, track);
  const buildings = buildCity(scene, track);
  buildRooftopLife(scene, track);
  const lamps = buildLamps(scene, track);
  buildStreetFurniture(scene, track);
  const animatePedestrians = buildPedestrians(scene, track);
  buildGantries(scene, track);
  buildQuarter(scene, track);
  const signs: THREE.Mesh[] = [];

  const pools = new Map<VehicleId, { body: THREE.InstancedMesh; glass: THREE.InstancedMesh; wheels: THREE.InstancedMesh; lights: THREE.InstancedMesh }>();
  const POOL = 64;
  const glassMat = new THREE.MeshStandardMaterial({ color: "#1c3c48", roughness: 0.18, metalness: 0.2 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.7 });
  const lightMat = new THREE.MeshStandardMaterial({ color: "#ff3030", emissive: "#ff2020", emissiveIntensity: 0.85 });
  for (const kind of KINDS) {
    const ge = trafficGeoms(kind);
    const bodyMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, metalness: 0.08 });
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, mat, POOL);
      m.frustumCulled = false;
      m.count = POOL;
      scene.add(m);
      return m;
    };
    pools.set(kind, {
      body: mk(ge.body, bodyMat),
      glass: mk(ge.glass, glassMat),
      wheels: mk(ge.wheels, wheelMat),
      lights: mk(ge.lights, lightMat),
    });
  }

  const dummy = new THREE.Object3D();
  const tukColor = new THREE.Color("#d4654a");
  const PEOPLE = 80;
  const people = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.22, 0.5, 4, 7),
    new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.78 }),
    PEOPLE,
  );
  people.frustumCulled = false;
  scene.add(people);
  const cloth = ["#1d3557", "#c45c3e", "#e6c27a", "#2f6f4a", "#f6f1e7", "#6b3a5d"].map((hex) => new THREE.Color(hex));
  const hideAll = () => {
    dummy.position.set(0, -20, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (const p of pools.values()) {
      for (let i = 0; i < POOL; i++) {
        p.body.setMatrixAt(i, dummy.matrix);
        p.glass.setMatrixAt(i, dummy.matrix);
        p.wheels.setMatrixAt(i, dummy.matrix);
        p.lights.setMatrixAt(i, dummy.matrix);
      }
    }
  };
  hideAll();

  let playerMesh = buildPlayer("tuktuk", "#f0b429");
  scene.add(playerMesh.group);

  const sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const sparkMat = new THREE.MeshBasicMaterial({ color: "#f0b429" });
  const sparks: { m: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false;
    scene.add(m);
    sparks.push({ m, v: new THREE.Vector3(), life: 0 });
  }

  const keys = new Set<string>();
  let probeKeys: Set<string> | null = null;
  let probeSteer: number | null = null;
  const touch = { steer: 0, throttle: 0, brake: 0 };

  const player = {
    x: 0,
    z: 0,
    yaw: 0,
    speed: 0,
    hint: 0,
    spin: 0,
  };

  let cfg: PreviewCfg = { ...defaultCfg, sound: save.sound };
  let phase: Phase = "menu";
  let money = 0;
  let km = 0;
  let time = 0;
  let trafficClock = 0;
  let crashes = 0;
  let pax: Pax[] = [];
  let waiting = track.stops.map(() => 2 + Math.floor(Math.random() * 3));
  let queueClock = 0;
  let stopHold = 0;
  let serviced = -1;
  let message = "";
  let messageT = 0;
  let alert: Hud["alert"] = null;
  let alertT = 0;
  let hitCd = 0;
  let hornCd = 0;
  let radarCd = 0;
  let tollLatch = false;
  let camMode = 1;
  let shake = 0;
  let steerVis = 0;
  let wheelSpin = 0;
  let saveTick = 0;
  const npcs: Npc[] = [];
  const wrongs: Wrong[] = [
    { s: 80, speed: 7.2, lat: 6.4 },
    { s: 260, speed: 6.4, lat: -6.2 },
    { s: 480, speed: 7.6, lat: 6.6 },
    { s: 720, speed: 6.2, lat: -5.8 },
    { s: 940, speed: 7, lat: 6.1 },
  ];
  let fuel = 100;
  let gasLatch = false;
  let fuelWarned = false;
  let halfWarned = false;
  let bumpCd = 0;
  let fuelBeep = 0;
  let hitstop = 0;
  let jobs: number[] = [];
  let jobIndex = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const camPos = new THREE.Vector3(0, 8, 20);
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();
  let last = performance.now();
  let acc = 0;
  let hudAcc = 0;
  let raf = 0;
  let running = true;

  const placeOn = (s: number, lane: number) => {
    const sm = track.sample(s);
    const rx = Math.cos(sm.yaw);
    const rz = -Math.sin(sm.yaw);
    const lat = laneLat(lane);
    player.x = sm.x + rx * lat;
    player.z = sm.z + rz * lat;
    player.yaw = sm.yaw;
    player.hint = 0;
    player.speed = 0;
  };

  const bootCinematic = () => {
    placeOn(track.stops[0].s, 1);
    player.speed = 16;
  };
  bootCinematic();

  function densityCount() {
    return cfg.density === 0 ? 18 : cfg.density === 2 ? 44 : 30;
  }

  function spawnTraffic(around: number) {
    npcs.length = 0;
    const n = densityCount();
    const weights: VehicleId[] = [
      "tuktuk",
      "tuktuk",
      "tuktuk",
      "micro",
      "micro",
      "taxi",
      "malaky",
      "tuktuk",
      "truck",
    ];
    for (let i = 0; i < n; i++) {
      const kind = weights[i % weights.length];
      const spec = vehicleById(kind);
      const col = new THREE.Color(
        ["#f4f1ea", "#cfd3d8", "#24527e", "#c45c3e", "#e6c27a", "#3d6b62", "#8d939c"][i % 7],
      );
      if (kind === "taxi") col.set("#f0d78c");
      npcs.push({
        alive: true,
        kind,
        s: around + 18 + (i * 280) / n + (i % 5) * 7,
        lane: i % 4,
        laneTarget: i % 4,
        speed: spec.max * (0.42 + (i % 5) * 0.075),
        cruise: spec.max * (0.4 + (i % 4) * 0.095),
        brake: 0,
        stopTimer: 0,
        stopAt: -1,
        color: col,
        nextLane: 5 + (i % 7),
      });
    }
    for (const pool of pools.values()) {
      if (pool.body.instanceColor) pool.body.instanceColor.needsUpdate = true;
    }
  }
  spawnTraffic(track.stops[0].s);

  function burst(x: number, z: number) {
    for (const s of sparks) {
      if (s.life > 0) continue;
      s.life = 0.45;
      s.m.visible = true;
      s.m.position.set(x, 0.6, z);
      s.v.set((Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 8);
    }
  }

  function say(text: string) {
    message = text;
    messageT = 2.4;
  }

  function flash(kind: Hud["alert"]) {
    alert = kind;
    alertT = 0.45;
  }

  function swapPlayer(kind: VehicleId, hex: string) {
    scene.remove(playerMesh.group);
    playerMesh.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    playerMesh = buildPlayer(kind, hex);
    scene.add(playerMesh.group);
    applyDusk(duskNow());
  }

  const skyDay = new THREE.Color("#c9e4f2");
  const skyNight = new THREE.Color("#070b14");
  const sky = new THREE.Color();
  const fogDay = new THREE.Color("#d5e6f0");
  const fogNight = new THREE.Color("#070b14");
  const fogC = new THREE.Color();
  const hemiDay = new THREE.Color("#d5ecf8");
  const hemiNight = new THREE.Color("#31445c");
  const groundDay = new THREE.Color("#c4a882");
  const groundNight = new THREE.Color("#1a140e");

  function applyDusk(t: number) {
    const n = Math.max(0, Math.min(1, t));
    sky.copy(skyDay).lerp(skyNight, n);
    fogC.copy(fogDay).lerp(fogNight, n);
    renderer.setClearColor(sky);
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(fogC);
    fog.near = 78 - n * 36;
    fog.far = 520 - n * 160;
    hemi.color.copy(hemiDay).lerp(hemiNight, n);
    hemi.groundColor.copy(groundDay).lerp(groundNight, n);
    hemi.intensity = 1.05 - n * 0.78;
    sun.intensity = 1.4 - n * 1.22;
    for (const mat of buildings) mat.emissiveIntensity = n * 0.95;
    lamps.emissiveIntensity = 0.08 + n * 1.35;
    const spot = 0.2 + n * 7.2;
    for (const spotL of playerMesh.spots) spotL.intensity = spot;
  }

  function duskNow() {
    if (phase !== "play" && phase !== "pause" && phase !== "summary") return cfg.night ? 0.92 : 0.18;
    if (cfg.night) return Math.min(1, 0.78 + time / 500);
    if (cfg.mode === "shift") return Math.min(1, time / (SHIFT_SECONDS * 0.92));
    return 0.22;
  }
  applyDusk(cfg.night ? 0.92 : 0.18);

  function drawSigns() {
    for (const s of signs) {
      scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    }
    signs.length = 0;
    for (const stop of track.stops) {
      const tex = signTexture(stop.name, "دار السلام");
      if (!tex) continue;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const sm = track.sample(stop.s - 70);
      const rx = Math.cos(sm.yaw);
      const rz = -Math.sin(sm.yaw);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), mat);
      mesh.position.set(sm.x + rx * 11.2, 3.3, sm.z + rz * 11.2);
      mesh.rotation.y = sm.yaw;
      scene.add(mesh);
      signs.push(mesh);
    }
    const gasTex = signTexture("بنزينة", "اهدى يمين");
    if (gasTex) {
      const mat = new THREE.MeshStandardMaterial({ map: gasTex, roughness: 0.55 });
      const sm = track.sample(track.gasS - 36);
      const rx = Math.cos(sm.yaw);
      const rz = -Math.sin(sm.yaw);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), mat);
      mesh.position.set(sm.x + rx * 10.4, 3.1, sm.z + rz * 10.4);
      mesh.rotation.y = sm.yaw;
      scene.add(mesh);
      signs.push(mesh);
    }
  }
  void document.fonts?.ready.then(() => drawSigns());

  function persist() {
    money = Number.isFinite(money) ? Math.max(0, money) : 0;
    km = Number.isFinite(km) ? Math.max(0, km) : 0;
    fuel = Number.isFinite(fuel) ? Math.max(0, Math.min(100, fuel)) : 0;
    if (Number.isFinite(money) && money > save.bestMoney) save.bestMoney = money;
    if (Number.isFinite(km) && km > save.bestKm) save.bestKm = km;
    save.sound = sfx.on;
    writeSave(save);
  }

  function specNow() {
    const base = vehicleById("tuktuk");
    const u = save.upgrades;
    return {
      ...base,
      max: base.max + u.motor * 1.65,
      accel: base.accel + u.motor * 1.1,
      turn: base.turn + u.tires * 0.18,
      fare: base.fare * (1 + u.seats * 0.22),
      name: "توكتوك",
    };
  }

  function pay(cost: number) {
    if (Number.isFinite(cost) && cost >= 0 && money >= cost) {
      money -= cost;
      return true;
    }
    if (Number.isFinite(cost) && cost >= 0 && money + save.wallet >= cost) {
      save.wallet -= cost - money;
      money = 0;
      return true;
    }
    return false;
  }

  function rollJobs(fromStop: number) {
    jobs = [];
    let i = fromStop;
    for (let k = 0; k < JOBS_NEED; k++) {
      const hop = 2 + Math.floor(Math.random() * 3);
      i = (i + hop) % track.stops.length;
      jobs.push(i);
    }
    jobIndex = 0;
  }

  function resetRun(startS: number) {
    money = 0;
    km = 0;
    time = 0;
    crashes = 0;
    fuel = 100;
    gasLatch = false;
    fuelWarned = false;
    halfWarned = false;
    bumpCd = 0;
    pax = [];
    waiting = track.stops.map(() => 2 + Math.floor(Math.random() * 3));
    queueClock = 0;
    stopHold = 0;
    serviced = -1;
    hitCd = 0;
    radarCd = 0;
    tollLatch = false;
    message = "";
    alert = null;
    placeOn(startS, 2);
    spawnTraffic(startS);
    const here = track.stops.reduce((best, stop, i) => {
      const d = Math.abs(stop.s - startS);
      return d < best.d ? { d, i } : best;
    }, { d: Infinity, i: 0 }).i;
    rollJobs(here);
    if (cfg.mode === "shift") say("سدّد الإيجار قبل ما الشمس تغيب");
    else if (cfg.mode === "rush") say(`أول توصيلة: ${track.stops[jobs[0]].name}`);
    else say("الشارع ليك، خلي بالك من البنزين");
  }

  function settle() {
    if (money > save.bestMoney) save.bestMoney = money;
    if (km > save.bestKm) save.bestKm = km;
    if (cfg.mode === "shift") {
      if (money >= RENT) {
        save.wallet += money - RENT;
        say("الإيجار اتسدد");
        sfx.cash();
      } else if (save.wallet >= RENT - money) {
        save.wallet -= RENT - money;
        say("كمّلت الإيجار من المحفظة");
      } else {
        say(`فاضل ${RENT - money - save.wallet} ج على الإيجار`);
      }
    } else if (cfg.mode === "rush") {
      save.wallet += money;
      if (jobIndex >= JOBS_NEED) {
        if (save.bestTrial == null || time < save.bestTrial) {
          save.bestTrial = time;
          say("رقم جديد في التوصيلات");
        } else say("خلّصت الأربع توصيلات");
        sfx.cash();
      } else say("وقفت التوصيلات");
    } else {
      save.wallet += Math.max(0, money);
      say("خلّصت اللفة");
    }
    persist();
  }

  function start(next: PreviewCfg) {
    cfg = { ...next, vehicle: "tuktuk" };
    sfx.on = cfg.sound;
    swapPlayer("tuktuk", cfg.paint);
    phase = "play";
    const startS = track.stops[0].s + 18;
    resetRun(startS);
    sfx.unlock();
    publish();
  }

  function forwardDist(targetS: number, fromS: number) {
    let d = targetS - fromS;
    while (d < 0) d += track.total;
    while (d >= track.total) d -= track.total;
    return d;
  }

  function hud(): Hud {
    const spec = specNow();
    const proj = track.project(player.x, player.z, player.hint);
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < track.stops.length; i++) {
      const d = forwardDist(track.stops[i].s, proj.s);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    let targetI = bestI;
    let targetD = bestD;
    if (cfg.mode === "rush" && jobs[jobIndex] != null) {
      targetI = jobs[jobIndex];
      targetD = forwardDist(track.stops[targetI].s, proj.s);
    }
    const stop = track.stops[targetI];
    let hint = "";
    if (phase === "play") {
      const gasD = Math.abs(wrapDelta(track.gasS, proj.s, track.total));
      if (fuel < 22 && gasD < 90) hint = "البنزينة على اليمين";
      else if (cfg.mode === "rush") {
        if (targetD < 80 && proj.lat < 3.2) hint = "اهدى يمين المحطة";
      } else {
        const relevant = waiting[targetI] > 0 || pax.some((person) => person.dest === targetI);
        if (relevant && targetD < 90 && proj.lat < 3.2) hint = "خش يمين وهدّي";
        else if (relevant && targetD < 40 && player.speed > 4.5) hint = "هدّي عند المحطة";
        else if (relevant && targetD < 22 && Math.abs(player.speed) >= 2.8) hint = "قف عند المحطة لاستلام الركاب";
        else if (relevant && targetD < 22 && stopHold < 0.85) hint = "ثبّت لحظة لاستلام الركاب";
      }
    }
    return {
      phase,
      speed: Math.round(Math.abs(player.speed) * 3.6),
      money: Math.round(money),
      km: Math.round(km * 10) / 10,
      time,
      crashes,
      passengers: pax.map((person) => ({ dest: track.stops[person.dest].name, fare: person.fare })),
      onboardFareTotal: pax.reduce((sum, person) => sum + person.fare, 0),
      waitingPassengers: Math.max(0, waiting[targetI] ?? 0),
      seats: spec.seats,
      stopName: stop?.name ?? "",
      stopDist: Math.max(0, Math.round(targetD)),
      hint,
      mode: cfg.mode,
      vehicleName: spec.name,
      message: messageT > 0 ? message : "",
      alert: alertT > 0 ? alert : null,
      fuel: Math.max(0, Math.min(100, fuel)),
      rent: RENT,
      shiftLeft: Math.max(0, SHIFT_SECONDS - time),
      wallet: save.wallet,
      upgrades: save.upgrades,
      lowFuel: fuel <= 18,
      jobsDone: jobIndex,
      jobsNeed: JOBS_NEED,
      jobName: jobs[jobIndex] != null ? track.stops[jobs[jobIndex]].name : "خلّصت",
      bestMoney: Math.round(save.bestMoney),
      bestKm: Math.round(save.bestKm * 10) / 10,
      bestTrial: save.bestTrial,
      night: cfg.night,
      sound: sfx.on,
      progress: proj.s / track.total,
    };
  }

  function publish() {
    onHud(hud());
  }

  function step(dt: number) {
    trafficClock += dt;
    const spec = specNow();
    const down = (code: string) => (probeKeys ? probeKeys.has(code) : keys.has(code));

    let steer = 0;
    let throttle = 0;
    let brake = 0;
    if (phase === "play") {
      if (probeSteer != null) steer = probeSteer;
      else {
        if (down("KeyA") || down("ArrowLeft")) steer += 1;
        if (down("KeyD") || down("ArrowRight")) steer -= 1;
        steer += touch.steer;
      }
      if (down("KeyW") || down("ArrowUp")) throttle = 1;
      if (down("KeyS") || down("ArrowDown")) brake = 1;
      throttle = Math.max(throttle, touch.throttle);
      brake = Math.max(brake, touch.brake);
      if (brake > 0) throttle = 0;
      steer = Math.max(-1, Math.min(1, steer));
    } else if (phase === "menu") {
      throttle = 0.62;
      const proj0 = track.project(player.x, player.z, player.hint);
      const want = laneLat(1);
      const err = want - proj0.lat;
      const dy = wrapAngle(proj0.yaw - player.yaw);
      steer = Math.max(-1, Math.min(1, err * 0.18 + dy * 1.4));
    }

    steerVis = steer;

    if (phase === "play" || phase === "menu") {
      if (throttle > 0 && brake === 0) player.speed += spec.accel * throttle * (fuel <= 0 ? 0.35 : 1) * dt;
      else if (brake > 0) {
        if (player.speed > 0.5) player.speed -= spec.brake * 1.08 * dt;
        else player.speed -= spec.accel * 0.42 * dt;
      } else {
        const sign = Math.sign(player.speed);
        const mag = Math.max(0, Math.abs(player.speed) - 3.2 * dt);
        player.speed = sign * mag;
      }
      const cap = phase === "play" && fuel <= 0 ? 2.8 : spec.max;
      player.speed = Math.max(-5, Math.min(cap, player.speed));

      const sp = Math.min(1, Math.abs(player.speed) / 8);
      const reverse = player.speed < -0.5 ? -1 : 1;
      const turnMul = 0.3 + 0.7 * sp;
      player.yaw += steer * spec.turn * turnMul * reverse * dt * (Math.abs(player.speed) < 1 ? 0.82 : 1);

      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      player.x += fx * player.speed * dt;
      player.z += fz * player.speed * dt;

      const proj = track.project(player.x, player.z, player.hint);
      player.hint = proj.i;
      const limit = ROAD_HALF - spec.width * 0.5 - 0.08;
      if (Math.abs(proj.lat) > limit) {
        const clamped = Math.sign(proj.lat) * limit;
        const rx = Math.cos(proj.yaw);
        const rz = -Math.sin(proj.yaw);
        player.x = proj.x + rx * clamped;
        player.z = proj.z + rz * clamped;
        const impact = Math.abs(proj.lat) - limit;
        if (impact > 0.06) {
          player.speed *= impact > 0.65 ? 0.74 : 0.88;
          shake = Math.max(shake, 0.14);
        }
      }

      const along = (() => {
        const tx = -Math.sin(proj.yaw);
        const tz = -Math.cos(proj.yaw);
        return (fx * tx + fz * tz) * player.speed;
      })();

      if (phase === "play") {
        if (along > 0) km += (along * dt) / 1000;
        time += dt;
        const eff = Math.max(0.42, 1 - save.upgrades.fuel * 0.19);
        const moving = Math.abs(player.speed) > 0.35 ? 1 : 0.08;
        const loadFactor = pax.length > 0 ? 1 + Math.min(0.24, pax.length * 0.045) : 1;
        fuel -= (0.3 * moving + throttle * 0.62) * eff * loadFactor * dt;
        if (fuel < 0 || !Number.isFinite(fuel)) fuel = 0;
        fuelBeep = Math.max(0, fuelBeep - dt);
        if (fuel < 20 && fuelBeep <= 0) {
          fuelBeep = 5;
          sfx.blip(560, 0.06, "sine", 0.025);
        }
      }
    }

    hitCd = Math.max(0, hitCd - dt);
    hornCd = Math.max(0, hornCd - dt);
    radarCd = Math.max(0, radarCd - dt);
    bumpCd = Math.max(0, bumpCd - dt);
    messageT = Math.max(0, messageT - dt);
    alertT = Math.max(0, alertT - dt);
    shake = Math.max(0, shake - dt);

    updateNpcs(dt, spec.length);
    if (phase === "play") gameplay(dt);

    sfx.engine(player.speed, throttle);
    saveTick += dt;
    if (saveTick > 1.2) {
      saveTick = 0;
      if (money > save.bestMoney) save.bestMoney = money;
      if (km > save.bestKm) save.bestKm = km;
      writeSave(save);
    }
  }

  function updateNpcs(dt: number, _len: number) {
    const proj = track.project(player.x, player.z, player.hint);
    for (const n of npcs) {
      if (!n.alive) continue;
      const spec = vehicleById(n.kind);
      let target = n.cruise;
      const ahead = wrapDelta(n.s, proj.s, track.total);
      if (n.kind === "micro") {
        n.stopTimer = Math.max(0, n.stopTimer - dt);
        for (let i = 0; i < track.stops.length; i++) {
          const d = wrapDelta(track.stops[i].s, n.s, track.total);
          // Microbuses in the curb-side lanes slow down and briefly wait at stops.
          if (n.lane > 1.5 && d > -12 && d < 38) {
            const stopApproachSpeed = Math.min(3, Math.max(0, (d - 2.5) * 0.46));
            target = Math.min(target, stopApproachSpeed);
            if (d < 3.5 && d > -1.2 && n.stopAt !== i && n.stopTimer <= 0 && n.speed < 4.5) {
              n.stopAt = i;
              n.stopTimer = 2.2 + Math.random() * 1.9;
            }
            // A bus fully stops while boarding/alighting instead of crawling forward.
            if (n.stopTimer > 0 && n.stopAt === i) target = 0;
          } else if (n.stopAt === i && d < -6) {
            n.stopAt = -1;
          }
        }
        n.brake -= dt;
        if (n.brake <= 0 && Math.random() < dt * 0.1) n.brake = 1.35;
        if (n.brake > 0) target = Math.min(target, 1.6);
      }
      // Obey the same 14-second cycle shown by the signal heads.
      // Red: 0-7s, amber: 7-8.2s, green: remainder.
      const signalCycle = trafficClock % 15;
      const redLight = signalCycle < 7.5;
      const amberLight = signalCycle >= 7.5 && signalCycle < 8.8;
      let redStopDistance = Infinity;
      let nearestSignalDistance = Infinity;
      let nearestSignalStopS = -1;
      for (const stop of track.stops) {
        const distanceToLine = wrapDelta(stop.s, n.s, track.total);
        if (distanceToLine <= 0 || distanceToLine > 38) continue;
        if (distanceToLine < nearestSignalDistance) {
          nearestSignalDistance = distanceToLine;
          nearestSignalStopS = stop.s;
        }
        if (redLight) {
          redStopDistance = Math.min(redStopDistance, distanceToLine);
          const approachSpeed = distanceToLine > 3.2
            ? Math.max(0, (distanceToLine - 3.2) * 0.64)
            : 0;
          target = Math.min(target, approachSpeed);
        } else if (amberLight && distanceToLine > 8) {
          const amberApproach = Math.max(3, Math.min(5, (distanceToLine - 2.8) * 0.54));
          target = Math.min(target, amberApproach);
        }
      }
      // Release a queue in sequence after green: vehicles closest to the line
      // move first, while following vehicles wait briefly for space to open.
      if (!redLight && !amberLight && nearestSignalDistance < Infinity) {
        let queueAhead = 0;
        for (const other of npcs) {
          if (other === n || !other.alive || Math.abs(other.lane - n.lane) > 0.72) continue;
          const otherDistance = wrapDelta(nearestSignalStopS, other.s, track.total);
          if (otherDistance > 0 && otherDistance < nearestSignalDistance && otherDistance <= 30) {
            queueAhead++;
          }
        }
        const releaseAt = Math.min(14.2, 8.8 + queueAhead * 0.52);
        const greenElapsed = Math.max(0, signalCycle - releaseAt);
        target = Math.min(target, greenElapsed <= 0 ? 0 : greenElapsed * 2.65);
      }
      // Follow traffic with a longer buffer for large vehicles and higher closing speeds.
      let leadGap = Infinity;
      let leadSpeed = target;
      // Treat the player as part of traffic so NPCs naturally slow down instead of
      // driving into the player's rear when both occupy the same lane.
      const playerLane = Math.round(Math.max(0, Math.min(3,
        [0, 1, 2, 3].reduce((best, lane) =>
          Math.abs(laneLat(lane) - proj.lat) < Math.abs(laneLat(best) - proj.lat) ? lane : best, 0),
      )));
      const playerGap = wrapDelta(proj.s, n.s, track.total);
      if (playerGap > 0 && playerGap < leadGap && Math.abs(playerLane - n.lane) < 0.72) {
        leadGap = playerGap;
        leadSpeed = Math.max(0, player.speed);
      }
      for (const o of npcs) {
        if (o === n || !o.alive || Math.abs(o.lane - n.lane) > 0.72) continue;
        const gap = wrapDelta(o.s, n.s, track.total);
        if (gap > 0 && gap < leadGap) {
          leadGap = gap;
          leadSpeed = o.speed;
        }
      }
      // Vehicle-specific driving profiles: long/heavy vehicles leave more room,
      // while small agile vehicles can react and merge more readily.
      const gapFactor = n.kind === "truck" ? 1.3
        : n.kind === "micro" ? 1.12
        : n.kind === "tuktuk" ? 0.82
        : n.kind === "taxi" ? 1.04 : 0.94;
      const safeGap = (6.4 + spec.length * 0.8
        + Math.max(0, n.speed - leadSpeed) * 1.05) * gapFactor;
      if (leadGap < safeGap + 15) {
        const followFactor = Math.max(0, Math.min(1, (leadGap - safeGap) / 15));
        const queueCreep = leadSpeed < 0.5 ? 0 : Math.max(0, leadGap - safeGap) * 0.09;
        target = Math.min(target, leadSpeed * followFactor + queueCreep);
      }
      const brakeResponse = n.kind === "truck" ? 2.65 : n.kind === "micro" ? 3.1 : 3.85;
      const accelResponse = n.kind === "truck" ? 0.66 : n.kind === "tuktuk" ? 1.45 : n.kind === "taxi" ? 1.42 : 1.16;
      n.speed += (target - n.speed) * Math.min(1,
        dt * (target < n.speed ? brakeResponse : accelResponse));
      // Allow a true standstill at red lights and in queues. Keep a small
      // physical buffer before the line so vehicles do not creep through it.
      n.speed = Math.max(0, n.speed);
      if (redStopDistance < Infinity) {
        const room = Math.max(0, redStopDistance - 2.8);
        if (n.speed * dt > room) n.speed = room / Math.max(dt, 0.0001);
      }
      n.s += n.speed * dt;

      n.nextLane -= dt;
      if (n.nextLane <= 0) {
        n.nextLane = 5.5 + Math.random() * 5.5;
        const dir = Math.random() < 0.5 ? -1 : 1;
        let desiredLane = Math.max(0, Math.min(3, Math.round(n.lane + dir)));
        if (n.kind === "tuktuk" && Math.random() < 0.22) {
          desiredLane = Math.random() < 0.5 ? 0 : 3;
        }
        const laneIsSafe = (lane: number) => {
          if (lane === playerLane) {
            const frontGap = wrapDelta(proj.s, n.s, track.total);
            const rearGap = wrapDelta(n.s, proj.s, track.total);
            if ((frontGap > 0 && frontGap < 16 + spec.length * 0.45)
              || (rearGap > 0 && rearGap < 12)) return false;
          }
          return npcs.every((o) => {
            if (o === n || !o.alive || Math.abs(o.lane - lane) > 0.68) return true;
            const frontGap = wrapDelta(o.s, n.s, track.total);
            const rearGap = wrapDelta(n.s, o.s, track.total);
            return !(frontGap > 0 && frontGap < 14 + spec.length * 0.45)
              && !(rearGap > 0 && rearGap < 10 + vehicleById(o.kind).length * 0.35);
          });
        };
        // Tuk-tuks are more willing to use a clear neighboring lane when boxed in,
        // but only after the same front/rear safety checks as other traffic.
        if (n.kind === "tuktuk" && leadGap < 24) {
          const candidates = [0, 1, 2, 3]
            .filter((lane) => Math.abs(lane - Math.round(n.lane)) === 1 && laneIsSafe(lane))
            .map((lane) => {
              let front = 42;
              for (const o of npcs) {
                if (o === n || !o.alive || Math.abs(o.lane - lane) > 0.68) continue;
                const gap = wrapDelta(o.s, n.s, track.total);
                if (gap > 0) front = Math.min(front, gap);
              }
              if (lane === playerLane) {
                const gap = wrapDelta(proj.s, n.s, track.total);
                if (gap > 0) front = Math.min(front, gap);
              }
              return { lane, score: front - Math.abs(lane - n.lane) * 2.4 };
            })
            .sort((a, b) => b.score - a.score);
          if (candidates.length && candidates[0].score > 14) {
            n.laneTarget = candidates[0].lane;
          } else {
            n.laneTarget = Math.round(n.lane);
          }
        } else if (desiredLane !== Math.round(n.lane) && laneIsSafe(desiredLane)) {
          n.laneTarget = desiredLane;
        } else {
          n.laneTarget = Math.round(n.lane);
        }
      }

      // Keep vehicles committed to their approach lane close to a signal.
      // This prevents late lane changes from cutting around a stopped queue.
      if (nearestSignalDistance < 28) {
        n.laneTarget = Math.round(n.lane);
      }

      const targetLaneSafe = (() => {
        if (n.laneTarget === playerLane) {
          const frontGap = wrapDelta(proj.s, n.s, track.total);
          const rearGap = wrapDelta(n.s, proj.s, track.total);
          if ((frontGap > 0 && frontGap < 12 + spec.length * 0.4)
            || (rearGap > 0 && rearGap < 10)) return false;
        }
        return npcs.every((o) => {
          if (o === n || !o.alive || Math.abs(o.lane - n.laneTarget) > 0.68) return true;
          const frontGap = wrapDelta(o.s, n.s, track.total);
          const rearGap = wrapDelta(n.s, o.s, track.total);
          return !(frontGap > 0 && frontGap < 11 + spec.length * 0.4)
            && !(rearGap > 0 && rearGap < 9 + vehicleById(o.kind).length * 0.3);
        });
      })();
      if (leadGap < safeGap + 5 && n.speed < 3.5) {
        n.laneTarget = Math.round(n.lane);
      }
      if (targetLaneSafe) {
        const diff = n.laneTarget - n.lane;
        const laneRate = n.kind === "truck" ? 0.32
          : n.kind === "micro" ? 0.44
          : n.kind === "tuktuk" ? 0.78
          : n.kind === "taxi" ? 0.56 : 0.62;
        const stepL = Math.max(-1, Math.min(1, diff)) * dt * laneRate;
        n.lane += stepL;
      } else {
        n.laneTarget = Math.round(n.lane);
      }
      if (ahead < -35 || ahead > 320) {
        n.s = proj.s + 180 + Math.random() * 150;
        n.lane = Math.floor(Math.random() * 4);
        n.laneTarget = n.lane;
        n.cruise = spec.max * (0.4 + Math.random() * 0.35);
      }
    }

    for (const w of wrongs) {
      w.s -= w.speed * dt;
      const rel = wrapDelta(w.s, proj.s, track.total);
      if (rel < -45) w.s = proj.s + 180 + Math.random() * 80;
      if (phase !== "play" || hitCd > 0) continue;
      const sm = track.sample(w.s);
      const rx = Math.cos(sm.yaw);
      const rz = -Math.sin(sm.yaw);
      const x = sm.x + rx * w.lat;
      const z = sm.z + rz * w.lat;
      const d = Math.hypot(player.x - x, player.z - z);
      if (d < specNow().length * 0.42 + 1.3) collide(d, player.x - x, player.z - z, 10);
    }
  }

  function collide(dist: number, dx: number, dz: number, otherSpeed: number) {
    const spec = specNow();
    const d = Math.max(0.001, dist);
    const push = 0.65;
    player.x += (dx / d) * push;
    player.z += (dz / d) * push;
    const rel = Math.abs(player.speed - otherSpeed);
    player.speed *= 0.58;
    hitCd = 0.8;
    shake = 0.3;
    if (rel > 4.2 && phase === "play") {
      crashes += 1;
      player.yaw += (Math.random() - 0.5) * 0.35;
      if (cfg.mode === "shift") {
        money = Math.max(0, money - 35);
        if (pax.length) {
          pax.pop();
          say("راكب نزل غصب — غرامة");
        } else say("خبطة! غرامة ٤٠ ج");
      } else if (cfg.mode === "rush") {
        time += 2;
        say("خبطة +٢ ث");
      } else say("خبطة! خد بالك");
      flash("crash");
      hitstop = reduceMotion ? 0 : 0.06;
      sfx.crash();
      burst(player.x, player.z);
    }
  }

  function gameplay(dt: number) {
    // Passenger demand keeps evolving while the shift is active, even when the player
    // is away from a stop. Busy hubs attract queues faster than quieter side stops.
    queueClock += dt;
    while (queueClock >= 9) {
      queueClock -= 9;
      const demand = [0.9, 1, 0.78, 0.72, 0.42, 0.62, 0.58, 0.92, 0.76, 0.5];
      for (let i = 0; i < waiting.length; i++) {
        if (waiting[i] >= 8 || Math.random() > demand[i % demand.length]) continue;
        waiting[i] = Math.min(8, waiting[i] + 1 + (Math.random() < 0.16 ? 1 : 0));
      }
    }
    const spec = specNow();
    const proj = track.project(player.x, player.z, player.hint);
    for (const n of npcs) {
      if (!n.alive || hitCd > 0) continue;
      const sm = track.sample(n.s);
      const rx = Math.cos(sm.yaw);
      const rz = -Math.sin(sm.yaw);
      const lat = laneLat(n.lane);
      const x = sm.x + rx * lat;
      const z = sm.z + rz * lat;
      const reach = spec.length * 0.42 + vehicleById(n.kind).length * 0.4;
      const d = Math.hypot(player.x - x, player.z - z);
      if (d < reach) {
        n.speed *= 0.68;
        collide(d, player.x - x, player.z - z, n.speed);
        break;
      }
    }

    if (hornCd > 0.72) {
      for (const n of npcs) {
        const gap = wrapDelta(n.s, proj.s, track.total);
        if (gap > 0 && gap < 26 && Math.abs(laneLat(n.lane) - proj.lat) < 4.5) {
          n.laneTarget = proj.lat > laneLat(n.lane) ? Math.max(0, n.lane - 1) : Math.min(3, n.lane + 1);
        }
      }
    }

    const nearStop = (index: number) => {
      const d = Math.abs(wrapDelta(track.stops[index].s, proj.s, track.total));
      return d < 17 && proj.lat > 3.2 && Math.abs(player.speed) < 2.8;
    };

    // Require a brief, steady stop at the curb before serving passengers or a delivery.
    // This prevents a fast brush past the stop from counting as a successful pickup.
    const stoppedAtStop = track.stops.some((_, index) => nearStop(index));
    stopHold = stoppedAtStop ? Math.min(1.2, stopHold + dt) : 0;

    if (serviced >= 0) {
      const away = Math.abs(wrapDelta(track.stops[serviced].s, proj.s, track.total));
      if (away > 32) {
        waiting[serviced] = Math.min(8, waiting[serviced] + 1 + Math.floor(Math.random() * 3));
        serviced = -1;
      }
    }

    if (cfg.mode !== "rush" && spec.seats > 0) {
      for (let i = 0; i < track.stops.length; i++) {
        if (!nearStop(i) || serviced === i || stopHold < 0.85) continue;
        const dropping = pax.filter((person) => person.dest === i);
        if (dropping.length) {
          const earned = Math.round(dropping.reduce((sum, person) => sum + person.fare, 0));
          money += earned;
          pax = pax.filter((person) => person.dest !== i);
          say(`نزلوا — +${earned} ج`);
          flash("cash");
          sfx.cash();
        }
        const free = Math.max(0, spec.seats - pax.length);
        if (free > 0 && waiting[i] > 0) {
          const n = Math.max(0, Math.min(free, waiting[i], 3));
          const boarded: Pax[] = [];
          for (let k = 0; k < n; k++) {
            const hop = 2 + Math.floor(Math.random() * 3);
            const dest = (i + hop) % track.stops.length;
            // Fare is fixed at pickup and scales with trip length and seat upgrades.
            const fare = Math.max(1, Math.round((24 + hop * 12) * spec.fare));
            const passenger = { dest, fare };
            pax.push(passenger);
            boarded.push(passenger);
          }
          waiting[i] = Math.max(0, waiting[i] - boarded.length);
          const destinations = boarded.map((person) => track.stops[person.dest].name).join("، ");
          say(`ركّبنا ${boarded.length}: ${destinations}`);
          sfx.cash();
        }
        serviced = i;
      }
    }

    if (cfg.mode === "rush" && phase === "play" && jobs[jobIndex] != null && nearStop(jobs[jobIndex]) && stopHold >= 0.85) {
      jobIndex += 1;
      money += 45;
      flash("cash");
      sfx.cash();
      if (jobIndex >= JOBS_NEED) {
        phase = "summary";
        settle();
        publish();
        return;
      }
      say(`وصلت — الجاية ${track.stops[jobs[jobIndex]].name}`);
    }

    if (radarCd <= 0) {
      for (const rs of track.radarS) {
        if (Math.abs(wrapDelta(rs, proj.s, track.total)) < 19 && Math.abs(player.speed) > RADAR_LIMIT) {
          radarCd = 8;
          flash("radar");
          sfx.radar();
          const which = track.radarS.indexOf(rs);
          if (cfg.mode === "rush") {
            time += 1.5;
            say(which === 1 ? "كمين +١.٥ ث" : "رادار +١.٥ ث");
          } else {
            money = Math.max(0, money - 70);
            say(which === 1 ? "كمين! غرامة ٧٠ ج" : "رادار! غرامة ٧٠ ج");
          }
          break;
        }
      }
    }

    const tollD = wrapDelta(track.tollS, proj.s, track.total);
    if (tollD > -8 && tollD < 16) {
      if (!tollLatch && player.speed > TOLL_LIMIT) {
        tollLatch = true;
        player.speed = Math.min(player.speed, TOLL_LIMIT);
        if (cfg.mode === "rush") {
          time += 1;
          say("الكوبري عايز تهدية");
        } else {
          money = Math.max(0, money - 15);
          say("كارتة الكوبري — ١٥ ج");
        }
      }
    } else if (Math.abs(tollD) > 40) tollLatch = false;

    const gasD = Math.abs(wrapDelta(track.gasS, proj.s, track.total));
    if (gasD < 18 && proj.lat > 2.5 && Math.abs(player.speed) < 2.8 && fuel < 98) {
      if (!gasLatch) {
        if (pay(GAS_COST)) {
          fuel = 100;
          fuelWarned = false;
          gasLatch = true;
          say(`تملى التانك — ${GAS_COST} ج`);
          flash("cash");
          sfx.cash();
        } else {
          gasLatch = true;
          say("الفلوس مش مكفية البنزين");
        }
      }
    } else if (gasD > 30) gasLatch = false;

    if (bumpCd <= 0) {
      for (const b of track.bumps) {
        if (Math.abs(wrapDelta(b, proj.s, track.total)) < 3.2 && Math.abs(player.speed) > 9) {
          bumpCd = 1.15;
          player.speed *= 0.48;
          shake = Math.max(shake, reduceMotion ? 0 : 0.3);
          if (messageT <= 0) say("مطب!");
          sfx.blip(120, 0.07, "triangle", 0.04);
          burst(player.x, player.z);
          break;
        }
      }
    }

    if (phase === "play" && fuel <= 0 && !fuelWarned) {
      fuelWarned = true;
      say("البنزين خلّص — دور على البنزينة");
      flash("fuel");
    }
    if (phase === "play" && cfg.mode === "shift" && !halfWarned && time >= SHIFT_SECONDS - 30) {
      halfWarned = true;
      say("فاضل نص دقيقة");
    }
    if (phase === "play" && cfg.mode === "shift" && time >= SHIFT_SECONDS) {
      phase = "summary";
      settle();
      publish();
      return;
    }

    if (alongWrong(proj) && messageT <= 0) say("إنت عكس الاتجاه");
  }

  function alongWrong(proj: { yaw: number }) {
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    const tx = -Math.sin(proj.yaw);
    const tz = -Math.cos(proj.yaw);
    return fx * tx + fz * tz < -0.45 && Math.abs(player.speed) > 3;
  }

  function drawPeople() {
    let i = 0;
    const bobT = performance.now() / 1000;
    for (let sIdx = 0; sIdx < track.stops.length; sIdx++) {
      const n = Math.min(8, waiting[sIdx] ?? 0);
      const sm = track.sample(track.stops[sIdx].s);
      const rx = Math.cos(sm.yaw);
      const rz = -Math.sin(sm.yaw);
      for (let k = 0; k < n; k++) {
        const bob = Math.sin(bobT * 2.2 + sIdx + k) * 0.04;
        dummy.position.set(sm.x + rx * (7.15 + k * 0.72), 0.64 + bob, sm.z + rz * (7.15 + k * 0.72));
        dummy.rotation.set(0, sm.yaw + k, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        people.setMatrixAt(i, dummy.matrix);
        people.setColorAt(i, cloth[(sIdx + k) % cloth.length]);
        i += 1;
      }
    }
    dummy.scale.set(0, 0, 0);
    dummy.position.set(0, -24, 0);
    dummy.updateMatrix();
    for (; i < PEOPLE; i++) people.setMatrixAt(i, dummy.matrix);
    people.instanceMatrix.needsUpdate = true;
    if (people.instanceColor) people.instanceColor.needsUpdate = true;
  }

  function render(dt: number) {
    applyDusk(duskNow());
    const fwX = -Math.sin(player.yaw);
    const fwZ = -Math.cos(player.yaw);
    const dist = camMode === 0 ? 6.5 : camMode === 2 ? 16 : camMode === 3 ? 0.2 : 11;
    const height = camMode === 3 ? 1.35 : 3.1 + camMode * 0.45;
    const back = camMode === 3 ? -1.15 : dist;
    desired.set(player.x - fwX * back, height, player.z - fwZ * back);
    if (shake > 0 && !reduceMotion) {
      desired.x += (Math.random() - 0.5) * shake * 1.4;
      desired.y += (Math.random() - 0.5) * shake;
    }
    const k = 1 - Math.exp(-5.8 * dt);
    camPos.lerp(desired, phase === "menu" ? Math.min(1, k * 1.2) : k);
    camera.position.copy(camPos);
    const lookAhead = camMode === 3 ? 15 : 8;
    look.set(player.x + fwX * lookAhead, camMode === 3 ? 1.1 : 1.2, player.z + fwZ * lookAhead);
    camera.lookAt(look);
    const base = camMode === 3 ? 78 : 68;
    camera.fov = base + Math.min(1, Math.abs(player.speed) / 34) * 7;
    camera.updateProjectionMatrix();

    playerMesh.group.position.set(player.x, 0, player.z);
    playerMesh.group.rotation.y = player.yaw;
    playerMesh.group.rotation.z = steerVis * -0.052;
    playerMesh.group.rotation.x = (player.speed > 1 ? -0.02 : 0.03) * Math.min(1, Math.abs(player.speed) / 20);
    wheelSpin += player.speed * dt * 2.35;
    for (const w of playerMesh.wheels) w.rotation.x = wheelSpin;
    playerMesh.rider.visible = pax.length > 0 && phase !== "menu";

    const cursors: Record<VehicleId, number> = {
      malaky: 0,
      taxi: 0,
      micro: 0,
      tuktuk: 0,
      truck: 0,
    };
    const paintNpc = (kind: VehicleId, s: number, yaw: number, lat: number, color?: THREE.Color) => {
      const pool = pools.get(kind)!;
      const i = cursors[kind]++;
      if (i >= POOL) return;
      const sm = track.sample(s);
      const rx = Math.cos(sm.yaw);
      const rz = -Math.sin(sm.yaw);
      dummy.position.set(sm.x + rx * lat, 0, sm.z + rz * lat);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pool.body.setMatrixAt(i, dummy.matrix);
      pool.glass.setMatrixAt(i, dummy.matrix);
      pool.wheels.setMatrixAt(i, dummy.matrix);
      pool.lights.setMatrixAt(i, dummy.matrix);
      if (color) pool.body.setColorAt(i, color);
    };

    for (const n of npcs) {
      if (!n.alive) continue;
      const sm = track.sample(n.s);
      paintNpc(n.kind, n.s, sm.yaw, laneLat(n.lane), n.color);
    }
    for (const w of wrongs) {
      const sm = track.sample(w.s);
      paintNpc("tuktuk", w.s, sm.yaw + Math.PI, w.lat, tukColor);
    }
    dummy.scale.set(0, 0, 0);
    dummy.position.set(0, -30, 0);
    dummy.updateMatrix();
    for (const kind of KINDS) {
      const pool = pools.get(kind)!;
      for (let i = cursors[kind]; i < POOL; i++) {
        pool.body.setMatrixAt(i, dummy.matrix);
        pool.glass.setMatrixAt(i, dummy.matrix);
        pool.wheels.setMatrixAt(i, dummy.matrix);
        pool.lights.setMatrixAt(i, dummy.matrix);
      }
      pool.body.instanceMatrix.needsUpdate = true;
      pool.glass.instanceMatrix.needsUpdate = true;
      pool.wheels.instanceMatrix.needsUpdate = true;
      pool.lights.instanceMatrix.needsUpdate = true;
      if (pool.body.instanceColor) pool.body.instanceColor.needsUpdate = true;
    }

    drawPeople();

    for (const spark of sparks) {
      if (spark.life <= 0) continue;
      spark.life -= dt;
      spark.v.y -= 9 * dt;
      spark.m.position.addScaledVector(spark.v, dt);
      if (spark.life <= 0) spark.m.visible = false;
    }

    drawMap();
    renderer.render(scene, camera);
  }

  const mapPts = track.pts.filter((_, i) => i % 2 === 0);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of mapPts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  function drawMap() {
    const ctx = map.getContext("2d");
    if (!ctx) return;
    const w = map.width;
    const h = map.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(20,24,30,0.72)";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    const pad = 16;
    const sx = (w - pad * 2) / (maxX - minX || 1);
    const sy = (h - pad * 2) / (maxZ - minZ || 1);
    const sc = Math.min(sx, sy);
    const ox = w / 2 - ((minX + maxX) / 2) * sc;
    const oy = h / 2 - ((minZ + maxZ) / 2) * sc;
    const px = (x: number, z: number) => [ox + x * sc, oy + z * sc] as const;
    ctx.beginPath();
    mapPts.forEach((p, i) => {
      const [x, y] = px(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = "#f0b429";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#1aa6a6";
    track.stops.forEach((stop, i) => {
      const sm = track.sample(stop.s);
      const [x, y] = px(sm.x, sm.z);
      const hot = cfg.mode === "rush" ? jobs[jobIndex] === i : false;
      ctx.fillStyle = hot ? "#f0b429" : "#1aa6a6";
      ctx.fillRect(x - (hot ? 3 : 1.6), y - (hot ? 3 : 1.6), hot ? 6 : 3.2, hot ? 6 : 3.2);
    });
    const gas = track.sample(track.gasS);
    const [gx, gy] = px(gas.x, gas.z);
    ctx.fillStyle = "#f0b429";
    ctx.beginPath();
    ctx.arc(gx, gy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    const [x, y] = px(player.x, player.z);
    ctx.fillStyle = "#f6f1e7";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    const [hx, hy] = px(player.x + fx * 22, player.z + fz * 22);
    ctx.strokeStyle = "#f6f1e7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }

  function frame(now: number) {
    if (!running) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 5) {
      if (hitstop > 0) hitstop = Math.max(0, hitstop - 1 / 60);
      else if (phase !== "pause" && phase !== "summary") step(1 / 60);
      acc -= 1 / 60;
      steps++;
    }
    animatePedestrians(now / 1000, player.x, player.z);
    animateTrafficSignals(trafficClock);
    render(dt);
    hudAcc += dt;
    if (hudAcc > 0.12) {
      hudAcc = 0;
      if (phase === "play" || phase === "summary" || phase === "pause") publish();
    }
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    if (!running) return;
    const w = Math.max(1, canvas.clientWidth || 1);
    const h = Math.max(1, canvas.clientHeight || 1);
    const dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.35 : 1.6);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const onDown = (e: KeyboardEvent) => {
    const target = e.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.closest("input, textarea, select, button, [contenteditable='true']"))
    ) return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "KeyH") honk();
    if (e.code === "KeyC") cycleCam();
    if (e.code === "Escape") {
      e.preventDefault();
      if (phase === "play") {
        pauseForInterruption();
      } else if (phase === "pause") {
        keys.clear();
        touch.steer = touch.throttle = touch.brake = 0;
        last = performance.now();
        acc = 0;
        phase = "play";
        publish();
      }
    }
  };
  const onUp = (e: KeyboardEvent) => keys.delete(e.code);
  const pauseForInterruption = () => {
    keys.clear();
    touch.steer = 0;
    touch.throttle = 0;
    touch.brake = 0;
    if (phase === "play") {
      phase = "pause";
      last = performance.now();
      acc = 0;
      publish();
    }
  };
  const onBlur = () => pauseForInterruption();
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") pauseForInterruption();
  };
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);

  function honk() {
    if (hornCd > 0) return;
    hornCd = 0.85;
    sfx.unlock();
    sfx.horn();
  }

  function cycleCam() {
    camMode = (camMode + 1) % 4;
  }

  window.__controlsTest = {
    getYaw: () => player.yaw,
    getSpeed: () => player.speed,
    setKeys: (codes: string[]) => {
      probeKeys = codes.length ? new Set(codes) : null;
      if (probeKeys && phase !== "play") start(cfg);
    },
    setSteer: (v: number) => {
      probeSteer = v;
    },
  };

  publish();
  raf = requestAnimationFrame(frame);

  return {
    getHud: hud,
    setPreview: (next) => {
      const paintChanged = next.paint !== cfg.paint;
      const nightChanged = next.night !== cfg.night;
      cfg = { ...next, vehicle: "tuktuk" };
      sfx.on = cfg.sound;
      save.sound = cfg.sound;
      writeSave(save);
      if (paintChanged && phase === "menu") swapPlayer("tuktuk", cfg.paint);
      if (nightChanged) applyDusk(duskNow());
      if (phase === "menu") publish();
    },
    start,
    pause: () => {
      keys.clear();
      touch.steer = touch.throttle = touch.brake = 0;
      if (phase === "play") {
        phase = "pause";
        publish();
      }
    },
    resume: () => {
      keys.clear();
      touch.steer = touch.throttle = touch.brake = 0;
      last = performance.now();
      acc = 0;
      if (phase === "pause") {
        phase = "play";
        publish();
      }
    },
    quit: () => {
      keys.clear();
      touch.steer = touch.throttle = touch.brake = 0;
      persist();
      phase = "menu";
      probeKeys = null;
      bootCinematic();
      spawnTraffic(track.stops[0].s);
      publish();
    },
    finish: () => {
      if (phase !== "play") return;
      phase = "summary";
      settle();
      publish();
    },
    buy: (id: UpgradeId) => {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return;
      const lvl = save.upgrades[id];
      if (lvl >= def.max) return;
      const cost = def.costs[lvl];
      if (save.wallet < cost) return;
      save.wallet -= cost;
      save.upgrades[id] = lvl + 1;
      writeSave(save);
      sfx.unlock();
      sfx.cash();
      publish();
    },
    setTouch: (t) => {
      touch.steer = Number.isFinite(t.steer) ? Math.max(-1, Math.min(1, t.steer)) : 0;
      touch.throttle = Number.isFinite(t.throttle) ? Math.max(0, Math.min(1, t.throttle)) : 0;
      touch.brake = Number.isFinite(t.brake) ? Math.max(0, Math.min(1, t.brake)) : 0;
    },
    horn: honk,
    cycleCam,
    toggleSound: () => {
      sfx.on = !sfx.on;
      cfg.sound = sfx.on;
      save.sound = sfx.on;
      writeSave(save);
      if (sfx.on) sfx.unlock();
      publish();
    },
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (window.__controlsTest?.getYaw === (() => player.yaw) || window.__controlsTest) {
        delete window.__controlsTest;
      }
      sfx.stop();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh) return;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const material = mesh.material;
        for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
          materials.add(mat);
          for (const value of Object.values(mat)) {
            if (value && typeof value === "object" && (value as THREE.Texture).isTexture) {
              textures.add(value as THREE.Texture);
            }
          }
        }
      });
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      const loseContext = renderer.getContext().getExtension("WEBGL_lose_context");
      loseContext?.loseContext();
    },
  };
}

const LANE_STEP = 3.6;

function buildRoad(scene: THREE.Scene, track: Track) {
  const pts = track.pts;
  const half = ROAD_HALF;
  const positions: number[] = [];
  const colors: number[] = [];
  const n = pts.length;
  const edge = (i: number, lat: number) => {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    return [p.x + rx * lat, 0.02, p.z + rz * lat] as const;
  };
  for (let i = 0; i < n; i++) {
    const a = edge(i, -half);
    const b = edge(i, half);
    const c = edge((i + 1) % n, -half);
    const d = edge((i + 1) % n, half);
    positions.push(...a, ...b, ...d, ...a, ...d, ...c);
    for (let k = 0; k < 6; k++) {
      const shade = 0.28 + ((i + k) % 5) * 0.012;
      colors.push(shade, shade + 0.005, shade + 0.01);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  scene.add(new THREE.Mesh(geo, mat));

  // Raised pedestrian sidewalks with a continuous curb on both sides.
  const walkPositions: number[] = [];
  const curbPositions: number[] = [];
  const walkEdge = (i: number, lat: number, y: number) => {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    return [p.x + rx * lat, y, p.z + rz * lat] as const;
  };
  for (let i = 0; i < n; i++) {
    for (const side of [-1, 1]) {
      const inner = side * (half + 0.85);
      const outer = side * (half + 4.7);
      const a = walkEdge(i, inner, 0.035);
      const b = walkEdge(i, outer, 0.035);
      const c = walkEdge((i + 1) % n, inner, 0.035);
      const d = walkEdge((i + 1) % n, outer, 0.035);
      walkPositions.push(...a, ...b, ...d, ...a, ...d, ...c);
      const ci = walkEdge(i, side * (half + 0.55), 0.12);
      const co = walkEdge(i, side * (half + 0.82), 0.12);
      const ni = walkEdge((i + 1) % n, side * (half + 0.55), 0.12);
      const no = walkEdge((i + 1) % n, side * (half + 0.82), 0.12);
      curbPositions.push(...ci, ...co, ...no, ...ci, ...no, ...ni);
    }
  }
  const sidewalkGeo = new THREE.BufferGeometry();
  sidewalkGeo.setAttribute("position", new THREE.Float32BufferAttribute(walkPositions, 3));
  sidewalkGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(sidewalkGeo, new THREE.MeshStandardMaterial({
    color: "#aaa69b", roughness: 0.96, metalness: 0, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1,
  })));
  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute("position", new THREE.Float32BufferAttribute(curbPositions, 3));
  curbGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(curbGeo, new THREE.MeshStandardMaterial({ color: "#d4cbb9", roughness: 0.88, side: THREE.DoubleSide })));

  // Subtle transverse paving joints, instanced to keep draw calls low.
  const joints: THREE.Matrix4[] = [];
  const joint = new THREE.Object3D();
  for (let i = 0; i < n; i += 8) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    for (const side of [-1, 1]) {
      joint.position.set(p.x + rx * side * (half + 2.75), 0.052, p.z + rz * side * (half + 2.75));
      joint.rotation.set(0, p.yaw, 0);
      joint.scale.set(1, 1, 1);
      joint.updateMatrix();
      joints.push(joint.matrix.clone());
    }
  }
  const jointMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.7, 0.018, 0.045),
    new THREE.MeshStandardMaterial({ color: "#85847e", roughness: 1 }),
    joints.length,
  );
  joints.forEach((m, i) => jointMesh.setMatrixAt(i, m));
  scene.add(jointMesh);

  const dashes: THREE.Matrix4[] = [];
  const dash = new THREE.Object3D();
  for (let i = 0; i < n; i += 3) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    for (const boundary of [-LANE_STEP, 0, LANE_STEP]) {
      dash.position.set(p.x + rx * boundary, 0.05, p.z + rz * boundary);
      dash.rotation.set(0, p.yaw, 0);
      dash.scale.set(1, 1, 1);
      dash.updateMatrix();
      dashes.push(dash.matrix.clone());
    }
  }
  const dashMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 0.02, 2.4),
    new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.5 }),
    dashes.length,
  );
  dashes.forEach((m, i) => dashMesh.setMatrixAt(i, m));
  scene.add(dashMesh);

  const bars: THREE.Matrix4[] = [];
  const bar = new THREE.Object3D();
  for (let i = 0; i < n; i += 2) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    for (const side of [-1, 1]) {
      bar.position.set(p.x + rx * side * (half + 0.45), 0.42, p.z + rz * side * (half + 0.45));
      bar.rotation.set(0, p.yaw, 0);
      bar.updateMatrix();
      bars.push(bar.matrix.clone());
    }
  }
  const barMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 0.82, 3.3),
    new THREE.MeshStandardMaterial({ color: "#d9d3c6", roughness: 0.8 }),
    bars.length,
  );
  bars.forEach((m, i) => barMesh.setMatrixAt(i, m));
  scene.add(barMesh);

  const edgeMat = new THREE.MeshStandardMaterial({ color: "#f0b429", roughness: 0.45 });
  const edges: number[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = edge(i, side * (half - 0.18));
      const b = edge(i, side * (half - 0.02));
      const c = edge((i + 1) % n, side * (half - 0.18));
      const d = edge((i + 1) % n, side * (half - 0.02));
      edges.push(...a, ...b, ...d, ...a, ...d, ...c);
    }
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
  eg.computeVertexNormals();
  scene.add(new THREE.Mesh(eg, edgeMat));
}

function buildCrosswalks(scene: THREE.Scene, track: Track) {
  const paint = new THREE.MeshStandardMaterial({
    color: "#eee9dc",
    roughness: 0.78,
    metalness: 0,
  });
  const stripes: THREE.Matrix4[] = [];
  const stops: THREE.Matrix4[] = [];
  const o = new THREE.Object3D();

  // Zebra crossings at the existing stop locations, aligned to the curved road.
  for (const stop of track.stops) {
    const p = track.sample(stop.s);
    const forwardX = -Math.sin(p.yaw);
    const forwardZ = -Math.cos(p.yaw);
    for (let stripe = -3; stripe <= 3; stripe++) {
      const offset = stripe * 0.72;
      o.position.set(
        p.x + forwardX * offset,
        0.066,
        p.z + forwardZ * offset,
      );
      o.rotation.set(0, p.yaw, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      stripes.push(o.matrix.clone());
    }

    // A pair of short stop bars gives drivers a clear visual cue before each crossing.
    for (const offset of [-3.35, 3.35]) {
      o.position.set(
        p.x + forwardX * offset,
        0.067,
        p.z + forwardZ * offset,
      );
      o.rotation.set(0, p.yaw, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      stops.push(o.matrix.clone());
    }
  }

  const stripeMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 0.025, ROAD_HALF * 2 - 1.1),
    paint,
    stripes.length,
  );
  stripes.forEach((matrix, index) => stripeMesh.setMatrixAt(index, matrix));
  stripeMesh.instanceMatrix.needsUpdate = true;

  const stopMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.18, 0.028, ROAD_HALF * 2 - 0.8),
    paint,
    stops.length,
  );
  stops.forEach((matrix, index) => stopMesh.setMatrixAt(index, matrix));
  stopMesh.instanceMatrix.needsUpdate = true;
  scene.add(stripeMesh, stopMesh);
}

function buildTrafficSignals(scene: THREE.Scene, track: Track) {
  const poleMat = new THREE.MeshStandardMaterial({ color: "#555b60", roughness: 0.72, metalness: 0.55 });
  const housingMat = new THREE.MeshStandardMaterial({ color: "#202428", roughness: 0.62, metalness: 0.25 });
  const bulbMats = [
    new THREE.MeshStandardMaterial({ color: "#e52d32", emissive: "#ff1717", emissiveIntensity: 1.8 }),
    new THREE.MeshStandardMaterial({ color: "#e6a52c", emissive: "#ffad19", emissiveIntensity: 0.08 }),
    new THREE.MeshStandardMaterial({ color: "#36a85a", emissive: "#16e65a", emissiveIntensity: 0.08 }),
  ];
  const heads: THREE.Mesh[][] = [];
  const poleGeo = new THREE.CylinderGeometry(0.075, 0.09, 4.2, 7);
  const housingGeo = new THREE.BoxGeometry(0.48, 1.35, 0.42);
  const bulbGeo = new THREE.SphereGeometry(0.135, 10, 8);

  for (const stop of track.stops) {
    const p = track.sample(stop.s);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    for (const side of [-1, 1]) {
      const x = p.x + rx * side * (ROAD_HALF + 1.05);
      const z = p.z + rz * side * (ROAD_HALF + 1.05);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2.1, z);
      scene.add(pole);
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(x, 3.55, z);
      scene.add(housing);
      const bulbs: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const bulb = new THREE.Mesh(bulbGeo, bulbMats[i]);
        bulb.position.set(x, 3.98 - i * 0.43, z + 0.225);
        scene.add(bulb);
        bulbs.push(bulb);
      }
      heads.push(bulbs);
    }
  }

  return (time: number) => {
    const cycle = time % 14;
    const active = cycle < 7 ? 0 : cycle < 8.2 ? 1 : 2;
    for (const bulbs of heads) {
      bulbs.forEach((bulb, index) => {
        const material = bulb.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = index === active ? 1.8 : 0.06;
      });
    }
  };
}

function buildStreetSigns(scene: THREE.Scene, track: Track) {
  const postMat = new THREE.MeshStandardMaterial({ color: "#777b7c", roughness: 0.78, metalness: 0.35 });
  const frameMat = new THREE.MeshStandardMaterial({ color: "#d4bd8a", roughness: 0.7, metalness: 0.12 });
  const labels = [
    { title: "شارع الفيوم", subtitle: "دار السلام", color: "#174b68" },
    { title: "منطقة سكنية", subtitle: "خفف السرعة", color: "#286044" },
    { title: "تنبيه مروري", subtitle: "يرجى الانتباه", color: "#8b4b2d" },
    { title: "دار السلام", subtitle: "أهلاً بيك", color: "#174b68" },
    { title: "خفف السرعة", subtitle: "قدامك عبور مشاة", color: "#286044" },
    { title: "شارع الفيوم", subtitle: "طريق رئيسي", color: "#174b68" },
  ];
  const postGeo = new THREE.CylinderGeometry(0.075, 0.11, 3.4, 7);
  const boardGeo = new THREE.PlaneGeometry(3.15, 1.12);
  const frameGeo = new THREE.BoxGeometry(3.28, 1.25, 0.09);

  labels.forEach((label, index) => {
    const s = track.stops[index % track.stops.length].s + (index >= track.stops.length ? 38 : 0);
    const p = track.sample(s);
    const side = index % 2 === 0 ? 1 : -1;
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const x = p.x + rx * side * (ROAD_HALF + 5.15);
    const z = p.z + rz * side * (ROAD_HALF + 5.15);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = p.yaw + (side < 0 ? Math.PI : 0);

    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1.7;
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, 3.05, 0);
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 272;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = label.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#e5cf9d";
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff4d9";
      ctx.font = "bold 76px Tajawal, sans-serif";
      ctx.fillText(label.title, 384, 112);
      ctx.fillStyle = "#f0d79f";
      ctx.font = "bold 43px Tajawal, sans-serif";
      ctx.fillText(label.subtitle, 384, 207);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const boardMat = new THREE.MeshStandardMaterial({
      map: texture, roughness: 0.68, side: THREE.DoubleSide,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 3.05, 0.055);
    group.add(post, frame, board);
    scene.add(group);
  });
}

function buildElectricalPoles(scene: THREE.Scene, track: Track) {
  const poleMat = new THREE.MeshStandardMaterial({ color: "#777d80", roughness: 0.82, metalness: 0.22 });
  const armMat = new THREE.MeshStandardMaterial({ color: "#555d62", roughness: 0.78, metalness: 0.28 });
  const insulatorMat = new THREE.MeshStandardMaterial({ color: "#d7d1c2", roughness: 0.55 });
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.22, 8.2, 7);
  const armGeo = new THREE.BoxGeometry(2.15, 0.16, 0.18);
  const insulatorGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.28, 6);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 64);
  const arms = new THREE.InstancedMesh(armGeo, armMat, 64);
  const insulators = new THREE.InstancedMesh(insulatorGeo, insulatorMat, 192);
  const dummy = new THREE.Object3D();
  const wirePoints: THREE.Vector3[] = [];
  let count = 0;
  let previous: { x: number; z: number; yaw: number } | null = null;

  // A single utility line follows the street edge; sagged segments keep the silhouette readable.
  for (let i = 18; i < track.pts.length && count < 64; i += 92) {
    const p = track.pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const offset = ROAD_HALF + 7.1;
    const x = p.x + rx * offset;
    const z = p.z + rz * offset;

    dummy.position.set(x, 4.1, z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(count, dummy.matrix);

    dummy.position.set(x, 7.55, z);
    dummy.updateMatrix();
    arms.setMatrixAt(count, dummy.matrix);

    for (let wire = 0; wire < 3; wire++) {
      dummy.position.set(x + rx * ((wire - 1) * 0.72), 7.72, z + rz * ((wire - 1) * 0.72));
      dummy.rotation.set(Math.PI / 2, 0, p.yaw);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      insulators.setMatrixAt(count * 3 + wire, dummy.matrix);
    }

    if (previous) {
      for (let wire = 0; wire < 3; wire++) {
        const a = new THREE.Vector3(
          previous.x + Math.cos(previous.yaw) * ((wire - 1) * 0.72),
          7.88,
          previous.z - Math.sin(previous.yaw) * ((wire - 1) * 0.72),
        );
        const b = new THREE.Vector3(
          x + rx * ((wire - 1) * 0.72),
          7.88,
          z + rz * ((wire - 1) * 0.72),
        );
        const steps = 5;
        for (let step = 0; step < steps; step++) {
          const t0 = step / steps;
          const t1 = (step + 1) / steps;
          const sag = 0.42;
          wirePoints.push(
            new THREE.Vector3(
              THREE.MathUtils.lerp(a.x, b.x, t0),
              THREE.MathUtils.lerp(a.y, b.y, t0) - Math.sin(Math.PI * t0) * sag,
              THREE.MathUtils.lerp(a.z, b.z, t0),
            ),
            new THREE.Vector3(
              THREE.MathUtils.lerp(a.x, b.x, t1),
              THREE.MathUtils.lerp(a.y, b.y, t1) - Math.sin(Math.PI * t1) * sag,
              THREE.MathUtils.lerp(a.z, b.z, t1),
            ),
          );
        }
      }
    }
    previous = { x, z, yaw: p.yaw };
    count++;
  }

  poles.count = count;
  arms.count = count;
  insulators.count = count * 3;
  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  insulators.instanceMatrix.needsUpdate = true;
  scene.add(poles, arms, insulators);

  if (wirePoints.length) {
    const geometry = new THREE.BufferGeometry().setFromPoints(wirePoints);
    const wires = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: "#343a3d", transparent: true, opacity: 0.82 }),
    );
    scene.add(wires);
  }
}

function buildCity(scene: THREE.Scene, track: Track) {
  const bases = ["#e7d3b5", "#e2b39a", "#efe6d6", "#cfc8ba", "#c46a52"];
  const emissive = emissiveWindows();
  const mats: THREE.MeshStandardMaterial[] = [];
  const geos = new THREE.BoxGeometry(1, 1, 1);
  const meshes: THREE.InstancedMesh[] = [];
  bases.forEach((hex) => {
    const map = facadeTexture(hex);
    const mat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: map ?? undefined,
      emissive: "#ffcc77",
      emissiveMap: emissive ?? undefined,
      emissiveIntensity: 0,
      roughness: 0.9,
    });
    mats.push(mat);
    const mesh = new THREE.InstancedMesh(geos, mat, 180);
    mesh.count = 0;
    scene.add(mesh);
    meshes.push(mesh);
  });

  const counts = bases.map(() => 0);
  const dummy = new THREE.Object3D();
  const tanks: THREE.Matrix4[] = [];
  const tankO = new THREE.Object3D();
  const pts = track.pts;

  // Repeated low-cost details add visible street-facing depth without hundreds of draw calls.
  const balconyGeo = new THREE.BoxGeometry(1.15, 0.16, 1);
  const balconyMat = new THREE.MeshStandardMaterial({ color: "#c9c0b2", roughness: 0.86 });
  const balconyMesh = new THREE.InstancedMesh(balconyGeo, balconyMat, 260);
  const railGeo = new THREE.BoxGeometry(0.09, 0.72, 1.15);
  const railMat = new THREE.MeshStandardMaterial({ color: "#aeb6b5", metalness: 0.28, roughness: 0.58 });
  const railMesh = new THREE.InstancedMesh(railGeo, railMat, 260);
  const awningGeo = new THREE.BoxGeometry(1.1, 0.18, 1);
  const awningMats = ["#b84f3d", "#d6a23b", "#397f7a", "#e7e0d2"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.76 }),
  );
  const awnings = awningMats.map((mat) => new THREE.InstancedMesh(awningGeo, mat, 100));
  const signGeo = new THREE.BoxGeometry(0.16, 0.72, 1);
  const signLabels = ["بقالة", "صيدلية", "مطعم", "موبايلات"];
  const signColors = ["#174b70", "#176b55", "#a84a32", "#55447c"];
  const signMeshes = signLabels.map((label, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = signColors[index];
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#f5e9c9";
      ctx.fillRect(0, 0, 512, 7);
      ctx.fillRect(0, 121, 512, 7);
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 66px Tajawal, sans-serif";
      ctx.fillText(label, 256, 67);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.InstancedMesh(signGeo, new THREE.MeshStandardMaterial({
      color: "#ffffff", map: texture, roughness: 0.72,
    }), 100);
  });
  const shopGlassGeo = new THREE.BoxGeometry(0.12, 1.75, 1);
  const shopGlassMat = new THREE.MeshStandardMaterial({
    color: "#79a5ad", roughness: 0.22, metalness: 0.12,
    emissive: "#203b42", emissiveIntensity: 0.12,
  });
  const shopGlass = new THREE.InstancedMesh(shopGlassGeo, shopGlassMat, 100);
  const shopDoorGeo = new THREE.BoxGeometry(0.14, 1.9, 0.72);
  const shopDoorMat = new THREE.MeshStandardMaterial({ color: "#4b4540", roughness: 0.55 });
  const shopDoors = new THREE.InstancedMesh(shopDoorGeo, shopDoorMat, 100);
  const shopLightGeo = new THREE.BoxGeometry(0.1, 0.12, 1.2);
  const shopLightMat = new THREE.MeshStandardMaterial({
    color: "#ffe0a0", emissive: "#ffbd55", emissiveIntensity: 0.75, roughness: 0.42,
  });
  const shopLights = new THREE.InstancedMesh(shopLightGeo, shopLightMat, 100);
  const shopShelfGeo = new THREE.BoxGeometry(0.48, 0.72, 1.55);
  const shopShelfMat = new THREE.MeshStandardMaterial({ color: "#8a6544", roughness: 0.88 });
  const shopShelves = new THREE.InstancedMesh(shopShelfGeo, shopShelfMat, 100);
  const shopGoodsGeo = new THREE.BoxGeometry(0.28, 0.32, 0.28);
  const shopGoodsMats = ["#d7a83d", "#a84f3c", "#4c8b72", "#d8d4c8"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.68 }),
  );
  const shopGoods = shopGoodsMats.map((mat) => new THREE.InstancedMesh(shopGoodsGeo, mat, 300));
  const shopGoodsCounts = shopGoodsMats.map(() => 0);
  let shopDisplayCount = 0;
  // Exterior split AC condensers mounted beside upper-floor windows.
  const acGeo = new THREE.BoxGeometry(0.72, 0.48, 0.42);
  const acMat = new THREE.MeshStandardMaterial({ color: "#d9d9d2", roughness: 0.78 });
  const acUnits = new THREE.InstancedMesh(acGeo, acMat, 220);
  const acGrilleGeo = new THREE.BoxGeometry(0.035, 0.3, 0.32);
  const acGrilleMat = new THREE.MeshStandardMaterial({ color: "#737b7c", roughness: 0.82 });
  const acGrilles = new THREE.InstancedMesh(acGrilleGeo, acGrilleMat, 220);
  // Street-facing apartment entrances: recessed-looking door panels, stone steps and lamps.
  const entryDoorGeo = new THREE.BoxGeometry(0.16, 2.25, 1.12);
  const entryDoorMat = new THREE.MeshStandardMaterial({ color: "#4a3930", roughness: 0.68 });
  const entryDoors = new THREE.InstancedMesh(entryDoorGeo, entryDoorMat, 140);
  const entryFrameGeo = new THREE.BoxGeometry(0.2, 2.48, 1.42);
  const entryFrameMat = new THREE.MeshStandardMaterial({ color: "#c3aa83", roughness: 0.82 });
  const entryFrames = new THREE.InstancedMesh(entryFrameGeo, entryFrameMat, 140);
  const entryStepGeo = new THREE.BoxGeometry(0.62, 0.18, 1.62);
  const entryStepMat = new THREE.MeshStandardMaterial({ color: "#77736c", roughness: 0.9 });
  const entrySteps = new THREE.InstancedMesh(entryStepGeo, entryStepMat, 140);
  const entryLampGeo = new THREE.BoxGeometry(0.18, 0.3, 0.22);
  const entryLampMat = new THREE.MeshStandardMaterial({
    color: "#f5d69a", emissive: "#ffbd62", emissiveIntensity: 0.65, roughness: 0.45,
  });
  const entryLamps = new THREE.InstancedMesh(entryLampGeo, entryLampMat, 140);
  // Distinct Arabic building-number plaques above selected residential entrances.
  const buildingNumberLabels = ["١٢", "١٤", "١٦", "٢١", "٢٣", "٢٥", "٣٢", "٣٤", "٤١", "٤٣", "٥٢", "٥٤"];
  const numberPlateGeo = new THREE.BoxGeometry(0.12, 0.42, 0.96);
  const numberPlateMeshes = buildingNumberLabels.map((label, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#25333a";
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = "#d8bd83";
      ctx.lineWidth = 8;
      ctx.strokeRect(5, 5, 246, 118);
      ctx.fillStyle = "#f5e7c7";
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 78px Tajawal, sans-serif";
      ctx.fillText(label, 128, 66);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.InstancedMesh(numberPlateGeo, new THREE.MeshStandardMaterial({
      color: "#ffffff", map: texture, roughness: 0.68,
    }), 16);
  });
  const numberPlateCounts = buildingNumberLabels.map(() => 0);
  let entryCount = 0;
  let acCount = 0;
  let balconyCount = 0;
  let awningCount = 0;
  let signCount = 0;
  let shopFrontCount = 0;
  const awningCounts = [0, 0, 0, 0];
  const signCounts = [0, 0, 0, 0];

  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const hsh = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const side = Math.floor(i / 4) % 2 === 0 ? -1 : 1;
    const shop = hsh > 0.68;
    const depth = 15.5 + hsh * 5.5;
    const floors = shop ? 1 : 2 + Math.floor(hsh * 4.5);
    const height = shop ? 3.8 : 5.2 + floors * 2.65;
    const width = 8 + hsh * 5;
    const deep = 7 + (1 - hsh) * 4;
    const idx = (i / 4) % meshes.length;
    if (counts[idx] >= 180) continue;

    dummy.position.set(p.x + rx * side * depth, height / 2, p.z + rz * side * depth);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(width, height, deep);
    dummy.updateMatrix();
    meshes[idx].setMatrixAt(counts[idx]++, dummy.matrix);

    // Wall-mounted AC units on selected apartment floors.
    if (!shop && hsh > 0.18 && acCount < 220) {
      const frontX = -side * (width / 2 + 0.28);
      const acFloors = Math.min(3, floors);
      for (let floor = 1; floor <= acFloors && acCount < 220; floor++) {
        const y = 2.05 + floor * 2.65 + (hsh > 0.62 ? 0.48 : -0.28);
        const zOffset = (floor % 2 === 0 ? -1 : 1) * Math.min(2.2, deep * 0.24);
        dummy.position.set(p.x + rx * (side * depth + frontX), y, p.z + rz * (side * depth + frontX) + zOffset);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        acUnits.setMatrixAt(acCount, dummy.matrix);
        dummy.position.set(
          p.x + rx * (side * depth + frontX - side * 0.22),
          y,
          p.z + rz * (side * depth + frontX - side * 0.22) + zOffset,
        );
        dummy.updateMatrix();
        acGrilles.setMatrixAt(acCount, dummy.matrix);
        acCount++;
      }
    }

    // Give selected residential buildings a clearly readable street entrance.
    if (!shop && hsh > 0.24 && entryCount < 140) {
      const frontX = -side * (width / 2 + 0.24);
      const entryX = p.x + rx * (side * depth + frontX);
      const entryZ = p.z + rz * (side * depth + frontX);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.position.set(entryX, 1.22, entryZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      entryFrames.setMatrixAt(entryCount, dummy.matrix);
      dummy.position.set(
        p.x + rx * (side * depth + frontX - side * 0.12),
        1.12,
        p.z + rz * (side * depth + frontX - side * 0.12),
      );
      dummy.updateMatrix();
      entryDoors.setMatrixAt(entryCount, dummy.matrix);
      dummy.position.set(
        p.x + rx * (side * depth + frontX - side * 0.36),
        0.12,
        p.z + rz * (side * depth + frontX - side * 0.36),
      );
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      entrySteps.setMatrixAt(entryCount, dummy.matrix);
      dummy.position.set(
        p.x + rx * (side * depth + frontX - side * 0.2),
        2.62,
        p.z + rz * (side * depth + frontX - side * 0.2) - rz * 0.82,
      );
      dummy.updateMatrix();
      entryLamps.setMatrixAt(entryCount, dummy.matrix);

      const numberIndex = (Math.floor(i / 4) + 3) % numberPlateMeshes.length;
      const plateX = p.x + rx * (side * depth + frontX - side * 0.18);
      const plateZ = p.z + rz * (side * depth + frontX - side * 0.18) - rz * 1.12;
      dummy.position.set(plateX, 3.05, plateZ);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      const plateSlot = numberPlateCounts[numberIndex]++;
      if (plateSlot < 16) numberPlateMeshes[numberIndex].setMatrixAt(plateSlot, dummy.matrix);
      entryCount++;
    }

    // Balconies face the road; their local X side is the street-facing wall.
    if (!shop && balconyCount < 260) {
      const frontX = -side * (width / 2 + 0.22);
      const balconyFloors = Math.min(3, Math.max(1, floors - 1));
      for (let floor = 1; floor <= balconyFloors && balconyCount < 260; floor++) {
        const y = 2.2 + floor * 2.65;
        dummy.position.set(p.x + rx * (side * depth + frontX), y, p.z + rz * (side * depth + frontX));
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(1, 1, deep * 0.62);
        dummy.updateMatrix();
        balconyMesh.setMatrixAt(balconyCount, dummy.matrix);
        dummy.position.set(
          p.x + rx * (side * depth + frontX - side * 0.56),
          y + 0.42,
          p.z + rz * (side * depth + frontX - side * 0.56),
        );
        dummy.scale.set(1, 1, deep * 0.62);
        dummy.updateMatrix();
        railMesh.setMatrixAt(balconyCount, dummy.matrix);
        balconyCount++;
      }
    }

    if (shop && awningCount < 100 && signCount < 100) {
      const frontX = -side * (width / 2 + 0.45);
      const awningIndex = Math.floor(hsh * 1000) % awnings.length;
      dummy.position.set(p.x + rx * (side * depth + frontX), 2.55, p.z + rz * (side * depth + frontX));
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, deep * 0.92);
      dummy.updateMatrix();
      awnings[awningIndex].setMatrixAt(awningCounts[awningIndex]++, dummy.matrix);
      awningCount++;

      dummy.position.set(p.x + rx * (side * depth + frontX - side * 0.12), 3.22, p.z + rz * (side * depth + frontX - side * 0.12));
      dummy.scale.set(1, 1, deep * 0.72);
      dummy.updateMatrix();
      const signIndex = Math.floor(hsh * 1000) % signMeshes.length;
      signMeshes[signIndex].setMatrixAt(signCounts[signIndex]++, dummy.matrix);
      signCount++;

      // Full-height shop glazing and a distinct entrance door below the sign.
      dummy.position.set(p.x + rx * (side * depth + frontX - side * 0.1), 1.25, p.z + rz * (side * depth + frontX - side * 0.1));
      dummy.scale.set(1, 1, deep * 0.78);
      dummy.updateMatrix();
      shopGlass.setMatrixAt(shopFrontCount, dummy.matrix);
      dummy.position.set(p.x + rx * (side * depth + frontX - side * 0.2), 1.08, p.z + rz * (side * depth + frontX - side * 0.2));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shopDoors.setMatrixAt(shopFrontCount, dummy.matrix);
      dummy.position.set(
        p.x + rx * (side * depth + frontX - side * 0.54),
        2.43,
        p.z + rz * (side * depth + frontX - side * 0.54),
      );
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, deep * 0.58);
      dummy.updateMatrix();
      shopLights.setMatrixAt(shopFrontCount, dummy.matrix);

      // Simple shelves and colorful packaged goods behind the storefront glazing.
      const inside = frontX + side * 0.58;
      const shelfZ = p.z + rz * (side * depth + inside);
      const shelfX = p.x + rx * (side * depth + inside);
      dummy.position.set(shelfX, 0.72, shelfZ);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      if (shopDisplayCount < 100) shopShelves.setMatrixAt(shopDisplayCount, dummy.matrix);
      for (let item = 0; item < 6; item++) {
        const goodsIndex = (item + Math.floor(hsh * 10)) % shopGoods.length;
        const tangent = (item % 3 - 1) * 0.38;
        const row = Math.floor(item / 3);
        dummy.position.set(
          shelfX + fx * tangent,
          0.62 + row * 0.36,
          shelfZ + fz * tangent,
        );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        const goodsSlot = shopGoodsCounts[goodsIndex]++;
        if (goodsSlot < 300) shopGoods[goodsIndex].setMatrixAt(goodsSlot, dummy.matrix);
      }
      shopDisplayCount++;
      shopFrontCount++;
    }

    if (hsh > 0.57) {
      tankO.position.set(p.x + rx * side * depth, height + 0.72, p.z + rz * side * depth);
      tankO.scale.set(1, 1, 1);
      tankO.rotation.set(0, 0, 0);
      tankO.updateMatrix();
      tanks.push(tankO.matrix.clone());
    }
  }

  meshes.forEach((m, i) => {
    m.count = counts[i];
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  });
  balconyMesh.count = balconyCount;
  railMesh.count = balconyCount;
  acUnits.count = acCount;
  acGrilles.count = acCount;
  entryDoors.count = entryCount;
  entryFrames.count = entryCount;
  entrySteps.count = entryCount;
  entryLamps.count = entryCount;
  entryDoors.instanceMatrix.needsUpdate = true;
  entryFrames.instanceMatrix.needsUpdate = true;
  entrySteps.instanceMatrix.needsUpdate = true;
  entryLamps.instanceMatrix.needsUpdate = true;
  numberPlateMeshes.forEach((mesh, i) => {
    mesh.count = numberPlateCounts[i];
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });
  acUnits.instanceMatrix.needsUpdate = true;
  acGrilles.instanceMatrix.needsUpdate = true;
  balconyMesh.instanceMatrix.needsUpdate = true;
  railMesh.instanceMatrix.needsUpdate = true;
  shopGlass.count = shopFrontCount;
  shopDoors.count = shopFrontCount;
  shopLights.count = shopFrontCount;
  shopLights.instanceMatrix.needsUpdate = true;
  shopShelves.count = shopDisplayCount;
  shopShelves.instanceMatrix.needsUpdate = true;
  shopGoods.forEach((mesh, index) => {
    mesh.count = shopGoodsCounts[index];
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });
  shopGlass.instanceMatrix.needsUpdate = true;
  shopDoors.instanceMatrix.needsUpdate = true;
  signMeshes.forEach((mesh, i) => {
    mesh.count = signCounts[i];
    mesh.instanceMatrix.needsUpdate = true;
  });
  scene.add(balconyMesh, railMesh, shopGlass, shopDoors, shopLights, shopShelves, acUnits, acGrilles, entryDoors, entryFrames, entrySteps, entryLamps);
  signMeshes.forEach((mesh) => scene.add(mesh));
  awnings.forEach((mesh, i) => {
    mesh.count = awningCounts[i];
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });

  if (tanks.length) {
    const tankMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.3, 8),
      new THREE.MeshStandardMaterial({ color: "#9aa1a8", roughness: 0.55, metalness: 0.2 }),
      tanks.length,
    );
    tanks.forEach((m, i) => tankMesh.setMatrixAt(i, m));
    scene.add(tankMesh);
  }
  return mats;
}


function buildRooftopLife(scene: THREE.Scene, track: Track) {
  const dishGeo = new THREE.SphereGeometry(0.48, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const dishMat = new THREE.MeshStandardMaterial({ color: "#b8bec0", roughness: 0.62, metalness: 0.28, side: THREE.DoubleSide });
  const dishes = new THREE.InstancedMesh(dishGeo, dishMat, 90);
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: "#777b78", metalness: 0.35, roughness: 0.7 });
  const lines = new THREE.InstancedMesh(poleGeo, poleMat, 90);
  const clothGeo = new THREE.BoxGeometry(0.62, 0.72, 0.055);
  const clothMats = ["#e9dfc9", "#a84f42", "#557b87", "#d5b65e"].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide }),
  );
  const clothes = clothMats.map((mat) => new THREE.InstancedMesh(clothGeo, mat, 180));
  const clothCounts = clothMats.map(() => 0);
  const o = new THREE.Object3D();
  let dishCount = 0;
  let lineCount = 0;

  // Rooftop dishes and balcony laundry are sparse, deterministic details.
  for (let i = 0; i < track.pts.length; i += 4) {
    const p = track.pts[i];
    const hash = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    if (hash <= 0.57) continue;
    const side = i % 12 === 0 ? -1 : 1;
    const depth = 15.5 + hash * 5.5;
    const floors = 2 + Math.floor(hash * 4.5);
    const height = 5.2 + floors * 2.65;
    const width = 8 + hash * 5;
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);

    if (dishCount < 90 && i % 8 === 0) {
      o.position.set(p.x + rx * side * depth, height + 0.95, p.z + rz * side * depth);
      o.rotation.set(0, p.yaw, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      dishes.setMatrixAt(dishCount++, o.matrix);
    }

    if (i % 12 === 0 && lineCount < 90) {
      const front = -side * (width / 2 + 0.22);
      const floor = 2.2 + Math.min(2, Math.max(1, floors - 1)) * 2.65;
      const centerX = p.x + rx * (side * depth + front - side * 0.5);
      const centerZ = p.z + rz * (side * depth + front - side * 0.5);
      o.position.set(centerX, floor + 0.85, centerZ);
      o.rotation.set(0, p.yaw, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      lines.setMatrixAt(lineCount++, o.matrix);

      for (let n = 0; n < 3; n++) {
        const color = (Math.floor(hash * 1000) + n) % clothMats.length;
        o.position.set(
          centerX + rx * (n - 1) * 0.72,
          floor + 0.35,
          centerZ + rz * (n - 1) * 0.72,
        );
        o.rotation.set(0, p.yaw, (n - 1) * 0.035);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        clothes[color].setMatrixAt(clothCounts[color]++, o.matrix);
      }
    }
  }

  dishes.count = dishCount;
  lines.count = lineCount;
  dishes.instanceMatrix.needsUpdate = true;
  lines.instanceMatrix.needsUpdate = true;
  scene.add(dishes, lines);
  clothes.forEach((mesh, i) => {
    mesh.count = clothCounts[i];
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });
}

function buildLamps(scene: THREE.Scene, track: Track) {
  const mats: THREE.Matrix4[] = [];
  const heads: THREE.Matrix4[] = [];
  const arms: THREE.Matrix4[] = [];
  const fixtures: THREE.Matrix4[] = [];
  const o = new THREE.Object3D();
  const pts = track.pts;
  for (let i = 0; i < pts.length; i += 8) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    o.position.set(p.x + rx * 11.4, 3.1, p.z + rz * 11.4);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    mats.push(o.matrix.clone());
    o.position.y = 6.3;
    o.updateMatrix();
    heads.push(o.matrix.clone());
    // Short cantilever arm and a flattened fixture facing over the roadway.
    o.position.set(p.x + rx * 11.4 - rx * 0.72, 6.05, p.z + rz * 11.4 - rz * 0.72);
    o.rotation.set(0, p.yaw, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    arms.push(o.matrix.clone());
    o.position.set(p.x + rx * 11.4 - rx * 1.42, 5.92, p.z + rz * 11.4 - rz * 1.42);
    o.scale.set(1.25, 1, 0.72);
    o.updateMatrix();
    fixtures.push(o.matrix.clone());
  }
  const pole = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 6.2, 6),
    new THREE.MeshStandardMaterial({ color: "#2c3138", roughness: 0.6 }),
    mats.length,
  );
  mats.forEach((m, i) => pole.setMatrixAt(i, m));
  scene.add(pole);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: "#fff1cc",
    emissive: "#ffd78a",
    emissiveIntensity: 0.05,
  });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 8), bulbMat, heads.length);
  heads.forEach((m, i) => bulbs.setMatrixAt(i, m));
  const armMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.55, 0.13, 0.13),
    new THREE.MeshStandardMaterial({ color: "#343a40", roughness: 0.48, metalness: 0.35 }),
    arms.length,
  );
  arms.forEach((m, i) => armMesh.setMatrixAt(i, m));
  const fixtureMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.92, 0.16, 0.48),
    new THREE.MeshStandardMaterial({
      color: "#e7e1d2", roughness: 0.52,
      emissive: "#ffd78a", emissiveIntensity: 0.08,
    }),
    fixtures.length,
  );
  fixtures.forEach((m, i) => fixtureMesh.setMatrixAt(i, m));
  scene.add(bulbs, armMesh, fixtureMesh);
  return bulbMat;
}

function buildStreetFurniture(scene: THREE.Scene, track: Track) {
  const pts = track.pts;
  const trunkMatrices: THREE.Matrix4[] = [];
  const canopyMatrices: THREE.Matrix4[] = [];
  const binMatrices: THREE.Matrix4[] = [];
  const bollardMatrices: THREE.Matrix4[] = [];
  const o = new THREE.Object3D();

  // Small street trees on the quieter sidewalk; keep clear of the lamp line.
  for (let i = 12; i < pts.length; i += 28) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const jitter = Math.sin(i * 2.17) * 0.42;
    const lat = -(ROAD_HALF + 2.55 + jitter);
    o.position.set(p.x + rx * lat, 1.05, p.z + rz * lat);
    o.rotation.set(0, 0, 0);
    o.scale.set(0.22, 1.05, 0.22);
    o.updateMatrix();
    trunkMatrices.push(o.matrix.clone());
    o.position.set(p.x + rx * lat, 2.65, p.z + rz * lat);
    o.scale.set(1.05, 1.28, 1.05);
    o.updateMatrix();
    canopyMatrices.push(o.matrix.clone());
  }

  // Waste bins and short protective bollards make the pavement feel inhabited.
  for (let i = 18; i < pts.length; i += 44) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const lat = ROAD_HALF + 2.65;
    o.position.set(p.x + rx * lat, 0.52, p.z + rz * lat);
    o.rotation.set(0, p.yaw, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    binMatrices.push(o.matrix.clone());
  }
  for (let i = 0; i < pts.length; i += 18) {
    const p = pts[i];
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    for (const side of [-1, 1]) {
      o.position.set(p.x + rx * side * (ROAD_HALF + 0.98), 0.48, p.z + rz * side * (ROAD_HALF + 0.98));
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      bollardMatrices.push(o.matrix.clone());
    }
  }

  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.22, 2.1, 7),
    new THREE.MeshStandardMaterial({ color: "#725039", roughness: 1 }),
    trunkMatrices.length,
  );
  trunkMatrices.forEach((m, i) => trunk.setMatrixAt(i, m));
  const canopy = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 7, 6),
    new THREE.MeshStandardMaterial({ color: "#47734a", roughness: 1 }),
    canopyMatrices.length,
  );
  canopyMatrices.forEach((m, i) => canopy.setMatrixAt(i, m));
  const bins = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: "#526b68", roughness: 0.82, metalness: 0.08 }),
    binMatrices.length,
  );
  binMatrices.forEach((m, i) => bins.setMatrixAt(i, m));
  const bollards = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: "#d5c9ae", roughness: 0.8 }),
    bollardMatrices.length,
  );
  bollardMatrices.forEach((m, i) => bollards.setMatrixAt(i, m));
  scene.add(trunk, canopy, bins, bollards);
}

function buildPedestrians(scene: THREE.Scene, track: Track): (time: number, playerX: number, playerZ: number) => void {
  type Walker = {
    s: number;
    side: number;
    direction: number;
    speed: number;
    phase: number;
    sprite: THREE.Sprite;
  };
  const walkers: Walker[] = [];
  const loader = new THREE.TextureLoader();
  const spritePaths = [
    "/assets/legacy-dar-salam/pedestrian_01.svg",
    "/assets/legacy-dar-salam/pedestrian_02.svg",
    "/assets/legacy-dar-salam/pedestrian_03.svg",
    "/assets/legacy-dar-salam/pedestrian_04.svg",
  ];
  const materials = spritePaths.map((path) => {
    const texture = loader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      sizeAttenuation: true,
    });
  });

  // Use the imported legacy Dar El Salam pedestrian artwork as camera-facing
  // sprites. Each walker keeps a stable variant and follows the sidewalk loop.
  for (let i = 22; i < track.pts.length && walkers.length < 32; i += 31) {
    const p = track.pts[i];
    const index = walkers.length;
    const sprite = new THREE.Sprite(materials[index % materials.length]);
    sprite.center.set(0.5, 0);
    sprite.scale.set(1.6, 2.2, 1);
    sprite.renderOrder = 2;
    scene.add(sprite);
    walkers.push({
      s: p.s,
      side: index % 2 === 0 ? 1 : -1,
      direction: index % 3 === 0 ? -1 : 1,
      speed: 0.55 + (index % 4) * 0.12,
      phase: index * 1.73,
      sprite,
    });
  }

  return (time: number, playerX: number, playerZ: number) => {
    walkers.forEach((walker) => {
      const p = track.sample(walker.s + time * walker.speed * walker.direction);
      const rx = Math.cos(p.yaw);
      const rz = -Math.sin(p.yaw);
      const baseOffset = ROAD_HALF + 3.65;
      const baseX = p.x + rx * walker.side * baseOffset;
      const baseZ = p.z + rz * walker.side * baseOffset;
      const distanceToPlayer = Math.hypot(playerX - baseX, playerZ - baseZ);
      // Keep pedestrians on the pavement and give the player a little clearance.
      const avoidance = Math.max(0, 1 - distanceToPlayer / 9) * 1.15;
      const sidewalkOffset = baseOffset + avoidance;
      const x = p.x + rx * walker.side * sidewalkOffset;
      const z = p.z + rz * walker.side * sidewalkOffset;
      walker.sprite.position.set(x, 0.02 + Math.abs(Math.sin(time * 5 + walker.phase)) * 0.035, z);
    });
  };
}

function buildGantries(scene: THREE.Scene, track: Track) {
  const metal = new THREE.MeshStandardMaterial({ color: "#cfd5dc", roughness: 0.4, metalness: 0.3 });
  const cam = new THREE.MeshStandardMaterial({ color: "#f0b429", emissive: "#f0b429", emissiveIntensity: 0.3 });
  const add = (s: number, toll: boolean) => {
    const sm = track.sample(s);
    const rx = Math.cos(sm.yaw);
    const rz = -Math.sin(sm.yaw);
    const g = new THREE.Group();
    g.position.set(sm.x, 0, sm.z);
    g.rotation.y = sm.yaw;
    const poleL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), metal);
    poleL.position.set(-10, 3.1, 0);
    const poleR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.2, 0.35), metal);
    poleR.position.set(10, 3.1, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.45, 0.7), metal);
    beam.position.set(0, 6.2, 0);
    g.add(poleL, poleR, beam);
    if (!toll) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), cam);
      eye.position.set(0, 5.7, 0.4);
      g.add(eye);
    }
    scene.add(g);
  };
  for (const s of track.radarS) add(s, false);
  add(track.tollS, true);
}

function buildQuarter(_scene: THREE.Scene, _track: Track) {
  // Keep the route free of invented landmark claims. Location-specific mosques,
  // hospitals, stations and named markets will be added only after their positions
  // and appearance have been verified against real references.
}


declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
  }
}
