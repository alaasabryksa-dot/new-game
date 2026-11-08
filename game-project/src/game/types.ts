export type VehicleId = "malaky" | "taxi" | "micro" | "tuktuk" | "truck";
export type Mode = "shift" | "cruise" | "rush";
export type Phase = "menu" | "play" | "pause" | "summary";
export type UpgradeId = "motor" | "fuel" | "seats" | "tires";
export type Upgrades = Record<UpgradeId, number>;

export type VehicleSpec = {
  id: VehicleId;
  name: string;
  blurb: string;
  max: number;
  accel: number;
  brake: number;
  turn: number;
  width: number;
  length: number;
  seats: number;
  fare: number;
  freight: number;
  speed: number;
  grip: number;
  haul: number;
};

export const VEHICLES: VehicleSpec[] = [
  {
    id: "malaky",
    name: "ملاكي",
    blurb: "عدّى بسرعة",
    max: 32,
    accel: 15,
    brake: 28,
    turn: 1.55,
    width: 1.8,
    length: 4.4,
    seats: 3,
    fare: 1,
    freight: 0,
    speed: 4,
    grip: 4,
    haul: 2,
  },
  {
    id: "taxi",
    name: "تاكسي",
    blurb: "واقف على الخط",
    max: 30,
    accel: 14,
    brake: 26,
    turn: 1.5,
    width: 1.8,
    length: 4.5,
    seats: 3,
    fare: 1.3,
    freight: 0,
    speed: 4,
    grip: 3,
    haul: 3,
  },
  {
    id: "micro",
    name: "ميكروباص",
    blurb: "بيقف فجأة",
    max: 24,
    accel: 11,
    brake: 18,
    turn: 1.15,
    width: 2.1,
    length: 5.1,
    seats: 11,
    fare: 1,
    freight: 0,
    speed: 3,
    grip: 2,
    haul: 5,
  },
  {
    id: "tuktuk",
    name: "توكتوك",
    blurb: "بتاع الحتة",
    max: 16,
    accel: 14,
    brake: 24,
    turn: 2.55,
    width: 1.35,
    length: 2.55,
    seats: 2,
    fare: 0.85,
    freight: 0,
    speed: 2,
    grip: 5,
    haul: 1,
  },
  {
    id: "truck",
    name: "نقل",
    blurb: "خد بالك منه",
    max: 20,
    accel: 7,
    brake: 12,
    turn: 0.85,
    width: 2.45,
    length: 8.4,
    seats: 0,
    fare: 0,
    freight: 0,
    speed: 2,
    grip: 1,
    haul: 5,
  },
];

export const PAINTS = [
  { id: "yellow", hex: "#f0b429", name: "أصفر", swatch: "bg-amber" },
  { id: "nile", hex: "#1aa6a6", name: "زيتي", swatch: "bg-nile" },
  { id: "brick", hex: "#d4654a", name: "أحمر", swatch: "bg-brick" },
  { id: "white", hex: "#f4f1ea", name: "أبيض", swatch: "bg-ink" },
  { id: "soot", hex: "#2a3340", name: "فحمي", swatch: "bg-panel-2" },
] as const;

export const MODES: { id: Mode; name: string; blurb: string }[] = [
  { id: "shift", name: "وردية", blurb: "سدّد إيجار اليوم" },
  { id: "rush", name: "توصيلات", blurb: "أربع مشاوير على الساعة" },
  { id: "cruise", name: "فضاوة", blurb: "لف في الحتة" },
];

export const DENSITIES = [
  { id: 0, name: "سالكة" },
  { id: 1, name: "زحمة" },
  { id: 2, name: "واقفة" },
] as const;

export const UPGRADES: {
  id: UpgradeId;
  name: string;
  blurb: string;
  max: number;
  costs: number[];
}[] = [
  { id: "motor", name: "موتور", blurb: "يمشي أسرع", max: 3, costs: [80, 160, 280] },
  { id: "fuel", name: "بنزين أوفر", blurb: "التانك يطول", max: 3, costs: [70, 140, 240] },
  { id: "seats", name: "فرش", blurb: "الأجرة أعلى", max: 3, costs: [90, 180, 300] },
  { id: "tires", name: "كاوتش", blurb: "يلف في الزحمة", max: 3, costs: [60, 130, 220] },
];

export const EMPTY_UPGRADES: Upgrades = { motor: 0, fuel: 0, seats: 0, tires: 0 };

export const RENT = 160;
export const SHIFT_SECONDS = 180;
export const GAS_COST = 22;
export const JOBS_NEED = 4;

export type Pax = { dest: number; fare: number };

export type Hud = {
  phase: Phase;
  speed: number;
  money: number;
  km: number;
  time: number;
  crashes: number;
  passengers: { dest: string; fare: number }[];
  onboardFareTotal: number;
  nextDropoffName: string;
  nextDropoffDist: number;
  waitingPassengers: number;
  seats: number;
  stopName: string;
  stopSide: "left" | "right";
  stopDist: number;
  hint: string;
  mode: Mode;
  vehicleName: string;
  message: string;
  alert: null | "radar" | "crash" | "cash" | "fuel";
  fuel: number;
  fuelRange: number;
  gasStationDist: number;
  rent: number;
  rentPaid: number;
  rentRemaining: number;
  walletChange: number;
  shiftLeft: number;
  wallet: number;
  upgrades: Upgrades;
  lowFuel: boolean;
  jobsDone: number;
  jobsNeed: number;
  jobName: string;
  bestMoney: number;
  bestKm: number;
  bestTrial: number | null;
  night: boolean;
  sound: boolean;
  progress: number;
};

export type PreviewCfg = {
  mode: Mode;
  vehicle: "tuktuk";
  night: boolean;
  density: number;
  paint: string;
  sound: boolean;
};

// Older candidate names retained until each one is checked against the local map.
const LEGACY_STOP_NAMES = [
  "شارع خيري الجندي",
  "شارع الشهيد حمدي جودة",
  "شارع سيد حنفي",
  "شارع إسماعيل الليثي",
  "شارع حسن منصور",
  "شارع السيدة زينب",
  "شارع لاشين",
  "شارع المهدي",
  "شارع الجمعية",
  "شارع الإخلاص",
  "شارع هاشم العطار",
  "شارع رشاد عبد الهادي",
  "شارع حسين الفخراني",
  "شارع المطبعة",
  "شارع المحجر",
  "شارع التل",
  "شارع محمد عبد الكريم",
  "شارع الهدى",
  "شارع عبد القادر",
  "شارع أحمد متولي",
  "شارع الأكحل",
  "شارع أبو أشرف",
  "شارع الجامع",
  "شارع إبراهيم عبد الهادي",
  "شارع سعيد النسناس",
  "شارع الجمهورية",
  "شارع المشير",
  "شارع صالح عابدين",
  "شارع فايدة كامل",
  "شارع فرج يوسف",
  "شارع سعد سليمان",
  "شارع الحاج حسين",
  "شارع جوهر الصقلي",
  "شارع أمين الشيمي",
  "شارع جمعة ضياء",
  "شارع إسماعيل متولي",
  "شارع الأشراف",
  "شارع محمود طه",
  "شارع عبد الرحيم الخياط",
  "شارع زين العتال",
  "شارع الجسر البراني",
  "شارع صافي العطار",
  "شارع إبراهيم سليمان",
  "شارع محمد غريب",
  "شارع محمد علي",
  "شارع مطر",
  "شارع عبد السلام",
  "شارع سيد عبد الرازق",
  "امتداد شارع رشاد عبد الهادي",
];

// Street entrance reference data supplied by the player.
// Side-local order is preserved; cross-side timing and exact route positions remain unassigned
// until the real entrances are mapped against the route.
export type StreetEntrance = {
  name: string;
  side: "left" | "right";
  sideOrder: number;
};

export const STREET_ENTRANCES: readonly StreetEntrance[] = [
  ...[
    "شارع حسن مطر",
    "شارع محمد رزق",
    "كشري الدكتور",
    "شارع قدري الصياد",
    "شارع كمال عبد الحميد",
    "شارع فهيم عبد الخالق",
    "شارع تاج الدين عمرو",
    "شارع أبو أشرف",
    "شارع عزت مطر",
    "شارع عبد القادر",
    "شارع أحمد متولي",
    "شارع إسماعيل الليثي",
  ].map((name, index) => ({ name, side: "left" as const, sideOrder: index + 1 })),
  ...[
    "شارع أحمد عسلاقي",
    "شارع محمد حسين مطر",
    "شارع أحمد محمود",
    "شارع أحمد المصري",
    "شارع السيد أبو كريشة",
    "شارع أبو طالب",
    "شارع علي زينهم",
    "شارع عبد الغفار عزيز",
    "شارع أحمد زكي",
    "شارع صالح عبدين",
    "شارع المشير",
    "شارع الحرية",
  ].map((name, index) => ({ name, side: "right" as const, sideOrder: index + 1 })),
];

// Ten neutral gameplay pickup points. These are not claims about real street entrances.
export const STOP_NAMES = [
  "نقطة ركاب ١",
  "نقطة ركاب ٢",
  "نقطة ركاب ٣",
  "نقطة ركاب ٤",
  "نقطة ركاب ٥",
  "نقطة ركاب ٦",
  "نقطة ركاب ٧",
  "نقطة ركاب ٨",
  "نقطة ركاب ٩",
  "نقطة ركاب ١٠",
];

export function vehicleById(id: VehicleId) {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[3];
}
