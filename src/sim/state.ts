import { config } from "../config";
import { NODE_DEFS, RESOURCES, VILLAGER_NAMES, type NodeType, type ResId, type Role } from "../content";

export type Tile = "pasto" | "rio" | "orilla" | "cueva" | "suelo" | "pared" | "salida";

/** Zonas del mundo: cada una es su propia grilla. Ver docs/01-arbol-tecnologico.md, "Zonas del mapa". */
export type ZoneId = "valle" | "cueva";

export interface ZoneMap {
  w: number;
  h: number;
  tiles: Tile[][]; // [y][x]
  entrance: { x: number; y: number }; // casilla que conecta con la otra zona
}

export const ZONES: { id: ZoneId; name: string; label: string; icon: string; unlockedBy: string | null }[] = [
  { id: "valle", name: "Valle", label: "el Valle", icon: "🏞️", unlockedBy: null },
  { id: "cueva", name: "Cueva", label: "la Cueva", icon: "🕳️", unlockedBy: "N10" },
];
export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z])) as Record<ZoneId, (typeof ZONES)[number]>;

/** La Jefatura (N11): especialidades elegidas y prioridades de las categorías. */
export interface JefaturaState {
  priorities: Role[]; // orden de prioridad (Zipf: 1, 1/2, 1/3…)
  specialties: Record<string, { full: boolean; n: number }>; // tipo de edificio → puestos pedidos
  timer: number;
}
export const defaultJefatura = (): JefaturaState => ({ priorities: ["comida", "materiales", "construccion"], specialties: {}, timer: 0 });

export type Task =
  | { kind: "idle"; t: number }
  | { kind: "toNode"; nodeId: number; res: ResId }
  | { kind: "gather"; nodeId: number; res: ResId; t: number }
  | { kind: "toBuilding"; bId: number }
  | { kind: "work"; bId: number; t: number }
  | { kind: "toSite"; bId: number }
  | { kind: "build"; bId: number };

export interface Villager {
  id: number;
  name: string;
  age: number; // años
  lifespan: number; // años
  role: Role | null; // categoría de oficio
  workplace: number | null; // id del edificio si es especialista
  manual: boolean; // tarea asignada a mano: queda fuera de la Jefatura
  wasAdult: boolean;
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
}

export interface Building {
  id: number;
  type: string;
  zone: ZoneId;
  x: number;
  y: number;
  progress: number; // segundos de construcción acumulados
  built: boolean;
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
  animo: number;
  stats: { births: number; deaths: number };
  log: LogEntry[];
  debug: { infinite: Partial<Record<ResId, boolean>>; unlockOnTap: boolean };
  resolved: Partial<Record<ResId, boolean>>; // recursos resueltos por infraestructura
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

function valleMap(): ZoneMap {
  const w = 8, h = 12;
  const tiles: Tile[][] = [];
  for (let y = 0; y < h; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < w; x++) row.push(x === 7 ? "rio" : x === 6 ? "orilla" : "pasto");
    tiles.push(row);
  }
  tiles[0][0] = "cueva";
  return { w, h, tiles, entrance: { x: 0, y: 0 } };
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
  return { w: 8, h: tiles.length, tiles, entrance: { x: 3, y: 9 } };
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
    zones: { valle: valleMap(), cueva: cuevaMap() },
    nodes: [],
    buildings: [],
    villagers: [],
    nextId: 1,
    inv,
    techs: {},
    erasOpen: 1,
    jefatura: defaultJefatura(),
    animo: 1,
    stats: { births: 0, deaths: 0 },
    log: [],
    debug: { infinite: {}, unlockOnTap: false },
    resolved: {},
    introQueue: [],
    prototypeEnded: false,
    birthAcc: 0,
    savedAt: Date.now(),
  };

  for (const [type, x, y] of VALLE_NODES) addNode(s, "valle", type, x, y);
  s.buildings.push({ id: s.nextId++, type: "pila", zone: "valle", x: 3, y: 6, progress: 0, built: true });
  addCave(s);

  for (const age of [19, 22, 31, 13, 6]) {
    newVillager(s, age, 3.5 + (rand(s) - 0.5) * 2, 6.5 + (rand(s) - 0.5) * 2);
  }
  log(s, "Despiertas frente a cinco personas que gruñen. Toca el Libro.");
  return s;
}

/** Partidas guardadas antes de las zonas: todo pasa al Valle y se agrega la Cueva. */
export function migrateToZones(s: GameState & { w?: number; h?: number; tiles?: Tile[][] }) {
  if (s.zones) return;
  s.zones = { valle: { w: s.w ?? 8, h: s.h ?? 12, tiles: s.tiles ?? valleMap().tiles, entrance: { x: 0, y: 0 } } } as GameState["zones"];
  delete s.w; delete s.h; delete s.tiles;
  for (const v of s.villagers) { v.zone ??= "valle"; v.transit ??= null; }
  for (const n of s.nodes) n.zone ??= "valle";
  for (const b of s.buildings) b.zone ??= "valle";
  addCave(s);
}
