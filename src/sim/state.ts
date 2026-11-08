import { config } from "../config";
import { NODE_DEFS, RESOURCES, VILLAGER_NAMES, type NodeType, type ResId } from "../content";

export type Tile = "pasto" | "rio" | "orilla" | "cueva";

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
  job: string | null;
  parentJob: string | null;
  wasAdult: boolean;
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
  x: number;
  y: number;
  stock: Partial<Record<ResId, number>>;
}

export interface Building {
  id: number;
  type: string;
  x: number;
  y: number;
  progress: number; // segundos de construcción acumulados
  built: boolean;
}

export interface LogEntry { at: number; msg: string }

export interface GameState {
  version: 1;
  rng: number;
  time: number; // segundos de juego
  w: number;
  h: number;
  tiles: Tile[][]; // [y][x]
  nodes: ResNode[];
  buildings: Building[];
  villagers: Villager[];
  nextId: number;
  inv: Record<ResId, number>;
  techs: Record<string, true>;
  erasOpen: number;
  quotas: Record<string, number>;
  animo: number;
  stats: { births: number; deaths: number };
  log: LogEntry[];
  debug: { infinite: Partial<Record<ResId, boolean>>; unlockOnTap: boolean };
  resolved: Partial<Record<ResId, boolean>>; // recursos resueltos por infraestructura
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

export function newVillager(s: GameState, age: number, x: number, y: number, parentJob: string | null = null): Villager {
  const name = VILLAGER_NAMES[Math.floor(rand(s) * VILLAGER_NAMES.length)];
  const v: Villager = {
    id: s.nextId++,
    name,
    age,
    lifespan: config.ESPERANZA_VIDA + (rand(s) * 2 - 1) * config.VARIACION_VIDA,
    job: null,
    parentJob,
    wasAdult: age >= config.EDAD_ADULTO,
    x, y, tx: x, ty: y,
    task: { kind: "idle", t: 0 },
    carry: null,
    order: null,
    jitter: rand(s),
  };
  s.villagers.push(v);
  return v;
}

// ---------- Mapa inicial: el Valle (8×12, vertical) ----------

const W = 8;
const H = 12;
const NODE_LAYOUT: [NodeType, number, number][] = [
  ["arbusto", 1, 4], ["arbusto", 2, 2], ["arbusto", 4, 3], ["arbusto", 5, 8],
  ["arbusto", 2, 9], ["arbusto", 1, 7], ["arbusto", 4, 10], ["arbusto", 5, 5],
  ["arbol", 0, 2], ["arbol", 0, 3], ["arbol", 1, 1], ["arbol", 5, 1], ["arbol", 4, 1],
  ["arbol", 0, 9], ["arbol", 0, 10], ["arbol", 1, 10],
  ["roca", 2, 0], ["roca", 3, 0], ["roca", 3, 11], ["roca", 5, 11],
  ["pasto", 2, 5], ["pasto", 3, 9], ["pasto", 2, 7], ["pasto", 4, 8],
  ["manada", 0, 6],
  ["arcilla", 6, 2], ["arcilla", 6, 5], ["arcilla", 6, 9],
];

export function createState(seed = Date.now() % 100000): GameState {
  const tiles: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) row.push(x === 7 ? "rio" : x === 6 ? "orilla" : "pasto");
    tiles.push(row);
  }
  tiles[0][0] = "cueva";

  const inv = Object.fromEntries(RESOURCES.map((r) => [r.id, 0])) as Record<ResId, number>;
  inv.comida = config.COMIDA_INICIAL;

  const s: GameState = {
    version: 1,
    rng: seed | 0,
    time: 0,
    w: W,
    h: H,
    tiles,
    nodes: [],
    buildings: [],
    villagers: [],
    nextId: 1,
    inv,
    techs: {},
    erasOpen: 1,
    quotas: {},
    animo: 1,
    stats: { births: 0, deaths: 0 },
    log: [],
    debug: { infinite: {}, unlockOnTap: false },
    resolved: {},
    prototypeEnded: false,
    birthAcc: 0,
    savedAt: Date.now(),
  };

  const used = new Set<string>(["0,0"]);
  for (const [type, x, y] of NODE_LAYOUT) {
    const key = `${x},${y}`;
    if (used.has(key)) continue;
    used.add(key);
    const stock: Partial<Record<ResId, number>> = {};
    for (const [res, def] of Object.entries(NODE_DEFS[type].stocks)) stock[res as ResId] = def!.max;
    s.nodes.push({ id: s.nextId++, type, x, y, stock });
  }

  s.buildings.push({ id: s.nextId++, type: "pila", x: 3, y: 6, progress: 0, built: true });

  for (const age of [19, 22, 31, 13, 6]) {
    newVillager(s, age, 3.5 + (rand(s) - 0.5) * 2, 6.5 + (rand(s) - 0.5) * 2);
  }
  log(s, "Despiertas frente a cinco personas que gruñen. Toca el Libro.");
  return s;
}
