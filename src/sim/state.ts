import { config } from "../config";
import { NODE_DEFS, RESOURCES, VILLAGER_NAMES, type NodeType, type ResId, type Role } from "../content";

export type Tile = "pasto" | "rio" | "orilla" | "cueva" | "suelo" | "pared" | "salida" | "sendero" | "monte" | "pico";

/** Zonas del mundo: cada una es su propia grilla. Ver docs/01-arbol-tecnologico.md, "Zonas del mapa". */
export type ZoneId = "valle" | "cueva" | "montanas";

export interface ZoneMap {
  w: number;
  h: number;
  tiles: Tile[][]; // [y][x]
  exits: Partial<Record<ZoneId, { x: number; y: number }>>; // casilla que lleva a cada zona vecina
}

export const ZONES: { id: ZoneId; name: string; label: string; icon: string; unlockedBy: string | null }[] = [
  { id: "valle", name: "Valle", label: "el Valle", icon: "🏞️", unlockedBy: null },
  { id: "cueva", name: "Cueva", label: "la Cueva", icon: "🕳️", unlockedBy: "N10" },
  { id: "montanas", name: "Montañas", label: "las Montañas", icon: "⛰️", unlockedBy: "B04" },
];
export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, (typeof ZONES)[number]>;

/** La Jefatura (N11): especialidades elegidas y prioridades de las categorías. */
export interface JefaturaState {
  priorities: Record<ZoneId, Role[]>; // orden de prioridad por zona (Zipf: 1, 1/2, 1/3…)
  specialties: Record<string, { full: boolean; n: number }>; // tipo de edificio → puestos pedidos
  timer: number;
}
/** Prioridades iniciales de cada zona: en el Valle manda la comida; en la Cueva y las Montañas no hay comida. */
export const defaultPriorities = (): Record<ZoneId, Role[]> => ({
  valle: ["comida", "materiales", "construccion"],
  cueva: ["materiales", "construccion", "comida"],
  montanas: ["materiales", "construccion", "comida"],
});
export const defaultJefatura = (): JefaturaState => ({ priorities: defaultPriorities(), specialties: {}, timer: 0 });

/** Partidas con prioridades globales (una sola lista): esa lista pasa al Valle; las demás zonas usan las de defecto. */
export function migratePriorities(j: JefaturaState) {
  const old = j.priorities as unknown;
  const base = defaultPriorities();
  if (Array.isArray(old)) j.priorities = { ...base, valle: old as Role[] };
  for (const z of Object.keys(base) as ZoneId[]) j.priorities[z] ??= base[z];
}

export type Task =
  | { kind: "idle"; t: number }
  | { kind: "toNode"; nodeId: number; res: ResId }
  | { kind: "gather"; nodeId: number; res: ResId; t: number }
  | { kind: "toBuilding"; bId: number }
  | { kind: "work"; bId: number; t: number }
  | { kind: "toSite"; bId: number }
  | { kind: "build"; bId: number }
  | { kind: "toImprove"; nId: number } // yendo a mejorar un recurso natural
  | { kind: "improve"; nId: number };

export interface Villager {
  id: number;
  name: string;
  age: number; // años
  lifespan: number; // años
  role: Role | null; // categoría de oficio
  workplace: number | null; // id del edificio si es especialista
  manual: boolean; // tarea asignada a mano: queda fuera de la Jefatura
  wasAdult: boolean;
  adultAge?: number; // si fue a la escuela, llega antes a adulto
  zone: ZoneId;
  transit: ZoneId | null; // camino a otra zona
  x: number; // posición libre, en casillas
  y: number;
  tx: number; // destino al deambular
  ty: number;
  task: Task;
  carry: { res: ResId; amt: number } | null;
  order: { nodeId: number; res: ResId } | null; // "señalar": un solo viaje
  jitter: number;
}

export interface ResNode {
  id: number;
  type: NodeType;
  zone: ZoneId;
  x: number;
  y: number;
  stock: Partial<Record<ResId, number>>;
  improved?: boolean; // mejorado con N12 (Barrero, Cantera…)
  improving?: number; // obra de mejora encargada: segundos de trabajo acumulados
}

export interface Building {
  id: number;
  type: string;
  zone: ZoneId;
  x: number;
  y: number;
  progress: number; // segundos de construcción acumulados
  built: boolean;
  upgradeTo?: string; // mejora en curso (el edificio sigue funcionando mientras tanto)
  upgradeProgress?: number;
}

export interface LogEntry { at: number; msg: string }

export interface GameState {
  version: 2;
  rng: number;
  time: number; // segundos de juego
  zones: Record<ZoneId, ZoneMap>;
  nodes: ResNode[];
  buildings: Building[];
  villagers: Villager[];
  nextId: number;
  inv: Record<ResId, number>;
  techs: Record<string, true>;
  erasOpen: number;
  jefatura: JefaturaState;
  zoneQuota: Partial<Record<ZoneId, number>>; // meta de adultos por zona (fuera del Valle)
  zoneTimer: number;
  animo: number;
  stats: { births: number; deaths: number };
  log: LogEntry[];
  debug: { infinite: Partial<Record<ResId, boolean>>; unlockOnTap: boolean };
  resolved: Partial<Record<ResId, boolean>>; // recursos resueltos por infraestructura
  focus: ResId | null; // recurso en el que se concentra la gente de Materiales
  introQueue: string[]; // tarjetas de novedad pendientes (ids de tecnología)
  prototypeEnded: boolean;
  lostDismissed?: boolean; // el jugador eligió seguir mirando tras perder
  birthAcc: number;
  savedAt: number;
}

// ---------- RNG determinista (mulberry32) ----------

export function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function log(s: GameState, msg: string) {
  s.log.push({ at: Date.now(), msg });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}

/** Los aldeanos nacen (o aparecen) en el Valle. */
export function newVillager(s: GameState, age: number, x: number, y: number): Villager {
  const name = VILLAGER_NAMES[Math.floor(rand(s) * VILLAGER_NAMES.length)];
  const v: Villager = {
    id: s.nextId++,
    name,
    age,
    lifespan: config.ESPERANZA_VIDA + (rand(s) * 2 - 1) * config.VARIACION_VIDA,
    role: null,
    workplace: null,
    manual: false,
    wasAdult: age >= config.EDAD_ADULTO,
    zone: "valle",
    transit: null,
    x, y, tx: x, ty: y,
    task: { kind: "idle", t: 0 },
    carry: null,
    order: null,
    jitter: rand(s),
  };
  s.villagers.push(v);
  return v;
}

function addNode(s: GameState, zone: ZoneId, type: NodeType, x: number, y: number) {
  const stock: Partial<Record<ResId, number>> = {};
  for (const [res, def] of Object.entries(NODE_DEFS[type].stocks)) stock[res as ResId] = def!.max;
  s.nodes.push({ id: s.nextId++, type, zone, x, y, stock });
}

// ---------- El Valle (8×12, vertical) ----------

const VALLE_NODES: [NodeType, number, number][] = [
  ["arbusto", 1, 4], ["arbusto", 2, 2], ["arbusto", 4, 3], ["arbusto", 5, 8],
  ["arbusto", 2, 9], ["arbusto", 1, 7], ["arbusto", 4, 10], ["arbusto", 5, 5],
  ["arbol", 0, 2], ["arbol", 0, 3], ["arbol", 1, 1], ["arbol", 5, 1], ["arbol", 4, 1],
  ["arbol", 0, 9], ["arbol", 0, 10], ["arbol", 1, 10],
  ["roca", 2, 0], ["roca", 3, 0], ["roca", 3, 11], ["roca", 5, 11],
  ["pasto", 2, 5], ["pasto", 3, 9], ["pasto", 2, 7], ["pasto", 4, 8],
  ["manada", 0, 6],
  ["arcilla", 6, 2], ["arcilla", 6, 5], ["arcilla", 6, 9],
];
// Arena en la orilla (Era 3: Ladrillo y vidrio). Se agrega aparte para poder migrar partidas.
const VALLE_ARENA: [number, number][] = [[6, 0], [6, 7], [6, 11]];
const SENDERO = { x: 1, y: 11 }; // camino a las Montañas

function valleMap(): ZoneMap {
  const w = 8, h = 12;
  const tiles: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < w; x++) row.push(x === 7 ? "rio" : x === 6 ? "orilla" : "pasto");
    tiles.push(row);
  }
  tiles[0][0] = "cueva";
  tiles[SENDERO.y][SENDERO.x] = "sendero";
  return { w, h, tiles, exits: { cueva: { x: 0, y: 0 }, montanas: SENDERO } };
}

// ---------- La Cueva (8×10): se entra con N10 Exploración ----------

const CUEVA_ROWS = [
  "PPPPPPPP",
  "PsssssPP",
  "PssssssP",
  "PPssssPP",
  "PssssssP",
  "PssssssP",
  "PPssssPP",
  "PssssssP",
  "PssssssP",
  "PPPSPPPP",
];
const CUEVA_NODES: [NodeType, number, number][] = [
  ["ocre", 1, 1], ["ocre", 5, 2], ["ocre", 2, 5], ["ocre", 6, 7],
  ["roca", 4, 1], ["roca", 1, 4], ["roca", 5, 5], ["roca", 2, 8],
  ["veta", 2, 2], ["veta", 6, 4], ["veta", 1, 7], ["veta", 5, 8],
];

function cuevaMap(): ZoneMap {
  const code: Record<string, Tile> = { P: "pared", s: "suelo", S: "salida" };
  const tiles = CUEVA_ROWS.map((row) => [...row].map((c) => code[c]));
  return { w: 8, h: tiles.length, tiles, exits: { valle: { x: 3, y: 9 } } };
}

// ---------- Las Montañas (8×10): se llega con B04 Rueda ----------

const MONTANAS_ROWS = [
  "PPmmPPmP",
  "PmmmmmmP",
  "mmmPmmmm",
  "mmmmmmPm",
  "PmmmmmmP",
  "mmmmPmmm",
  "mmPmmmmm",
  "PmmmmmmP",
  "mmmmmmmP",
  "PPPSPPPP",
];
const MONTANAS_NODES: [NodeType, number, number][] = [
  ["estano", 2, 1], ["estano", 5, 3], ["estano", 1, 6], ["estano", 6, 8],
  ["roca", 4, 1], ["roca", 2, 4], ["roca", 5, 6],
  ["hierro", 6, 2], ["hierro", 1, 3], ["hierro", 3, 7],
  ["arbol", 0, 2], ["arbol", 7, 5], ["arbol", 0, 8],
];

function montanasMap(): ZoneMap {
  const code: Record<string, Tile> = { P: "pico", m: "monte", S: "salida" };
  const tiles = MONTANAS_ROWS.map((row) => [...row].map((c) => code[c]));
  return { w: 8, h: tiles.length, tiles, exits: { valle: { x: 3, y: 9 } } };
}

export function addMontanas(s: GameState) {
  s.zones.montanas = montanasMap();
  for (const [type, x, y] of MONTANAS_NODES) addNode(s, "montanas", type, x, y);
  s.buildings.push({ id: s.nextId++, type: "pila", zone: "montanas", x: 3, y: 8, progress: 0, built: true });
}

/** Agrega la Cueva a una partida (nueva o de una versión anterior). */
export function addCave(s: GameState) {
  s.zones.cueva = cuevaMap();
  for (const [type, x, y] of CUEVA_NODES) addNode(s, "cueva", type, x, y);
  s.buildings.push({ id: s.nextId++, type: "pila", zone: "cueva", x: 3, y: 8, progress: 0, built: true });
}

export function createState(seed = Date.now() % 100000): GameState {
  const inv = Object.fromEntries(RESOURCES.map((r) => [r.id, 0])) as Record<ResId, number>;
  inv.comida = config.COMIDA_INICIAL;

  const s: GameState = {
    version: 2,
    rng: seed | 0,
    time: 0,
    zones: { valle: valleMap(), cueva: cuevaMap(), montanas: montanasMap() },
    nodes: [],
    buildings: [],
    villagers: [],
    nextId: 1,
    inv,
    techs: {},
    erasOpen: 1,
    jefatura: defaultJefatura(),
    zoneQuota: {},
    zoneTimer: 0,
    animo: 1,
    stats: { births: 0, deaths: 0 },
    log: [],
    debug: { infinite: {}, unlockOnTap: false },
    resolved: {},
    focus: null,
    introQueue: [],
    prototypeEnded: false,
    birthAcc: 0,
    savedAt: Date.now(),
  };

  for (const [type, x, y] of VALLE_NODES) addNode(s, "valle", type, x, y);
  for (const [x, y] of VALLE_ARENA) addNode(s, "valle", "arena", x, y);
  s.buildings.push({ id: s.nextId++, type: "pila", zone: "valle", x: 3, y: 6, progress: 0, built: true });
  addCave(s);
  addMontanas(s);

  for (const age of [19, 22, 31, 13, 6]) {
    newVillager(s, age, 3.5 + (rand(s) - 0.5) * 2, 6.5 + (rand(s) - 0.5) * 2);
  }
  log(s, "Despiertas frente a cinco personas que gruñen. Toca el Libro.");
  return s;
}

/** Pone al día partidas guardadas con versiones anteriores del mundo (zonas, Cueva, Montañas, arena). */
export function migrateToZones(s: GameState & { w?: number; h?: number; tiles?: Tile[][] }) {
  type OldZone = ZoneMap & { entrance?: { x: number; y: number } };
  if (!s.zones) {
    s.zones = { valle: { w: s.w ?? 8, h: s.h ?? 12, tiles: s.tiles ?? valleMap().tiles, exits: {} } } as unknown as GameState["zones"];
    delete s.w; delete s.h; delete s.tiles;
    for (const v of s.villagers) { v.zone ??= "valle"; v.transit ??= null; }
    for (const n of s.nodes) n.zone ??= "valle";
    for (const b of s.buildings) b.zone ??= "valle";
  }
  // Entradas: antes había una sola ("entrance"); ahora cada zona tiene salidas hacia sus vecinas.
  for (const z of Object.values(s.zones) as OldZone[]) { z.exits ??= {}; delete z.entrance; }
  const valle = s.zones.valle;
  valle.exits.cueva = { x: 0, y: 0 };
  valle.tiles[0][0] = "cueva";
  const free = (x: number, y: number) => !s.nodes.some((n) => n.zone === "valle" && n.x === x && n.y === y) && !s.buildings.some((b) => b.zone === "valle" && b.x === x && b.y === y);
  if (!valle.tiles.some((row) => row.includes("sendero"))) {
    // Casilla del sendero: la de siempre o, si está ocupada, otra libre del borde.
    const candidates = [SENDERO, { x: 0, y: 11 }, { x: 2, y: 11 }, { x: 4, y: 11 }, { x: 0, y: 8 }, { x: 0, y: 5 }, { x: 0, y: 4 }, { x: 1, y: 0 }];
    const spot = candidates.find((c) => valle.tiles[c.y]?.[c.x] === "pasto" && free(c.x, c.y)) ?? SENDERO;
    // Si ninguna está libre, se libera la de siempre (se quita lo que haya).
    s.buildings = s.buildings.filter((b) => !(b.zone === "valle" && b.x === spot.x && b.y === spot.y && b.type !== "pila"));
    s.nodes = s.nodes.filter((n) => !(n.zone === "valle" && n.x === spot.x && n.y === spot.y));
    valle.tiles[spot.y][spot.x] = "sendero";
  }
  for (let y = 0; y < valle.h; y++) for (let x = 0; x < valle.w; x++) {
    if (valle.tiles[y][x] === "sendero") valle.exits.montanas = { x, y };
  }
  if (!s.zones.cueva) addCave(s);
  s.zones.cueva.exits = { valle: { x: 3, y: 9 } };
  if (!s.zones.montanas) addMontanas(s);
  if (!s.nodes.some((n) => n.zone === "valle" && n.type === "arena")) {
    for (const [x, y] of VALLE_ARENA) if (free(x, y)) addNode(s, "valle", "arena", x, y);
  }
}
