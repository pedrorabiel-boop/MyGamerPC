// Acciones del jugador y del modo debug. Todas mutan el estado directamente.
import { config } from "../config";
import { BUILDING_BY_ID, JOBS, NODE_DEFS, UNLOCK_MESSAGES, type ResId } from "../content";
import { TECHS, TECH_BY_ID, techCost } from "../data/tree";
import { add, canAfford, has, pay, stageOf } from "./economy";
import { jobUnlocked } from "./step";
import { log, newVillager, type GameState } from "./state";

// ---------- Libro ----------

export type TechStatus = "sellada" | "legible" | "estudiable" | "comprendida";

export function techStatus(s: GameState, id: string): TechStatus {
  const t = TECH_BY_ID[id];
  if (s.techs[id]) return "comprendida";
  if (t.era > s.erasOpen) return "sellada";
  if (!t.requires.every((r) => s.techs[r])) return "legible";
  if (typeof t.requiresPopulation === "number" && s.villagers.length < t.requiresPopulation) return "legible";
  return "estudiable";
}

export function tapBook(s: GameState) {
  add(s, "comprension", config.TOQUE_BASE);
}

export function study(s: GameState, id: string): boolean {
  if (techStatus(s, id) !== "estudiable") return false;
  if (!pay(s, { comprension: techCost(TECH_BY_ID[id]) })) return false;
  unlock(s, id);
  return true;
}

export function unlock(s: GameState, id: string) {
  if (s.techs[id]) return;
  s.techs[id] = true;
  log(s, `📖 Comprendido: ${TECH_BY_ID[id].name}.`);
  if (UNLOCK_MESSAGES[id]) log(s, UNLOCK_MESSAGES[id]);
}

// ---------- Construcción ----------

export function canPlace(s: GameState, type: string, x: number, y: number): boolean {
  const def = BUILDING_BY_ID[type];
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  if (s.tiles[y][x] !== def.place) return false;
  if (s.nodes.some((n) => n.x === x && n.y === y)) return false;
  if (s.buildings.some((b) => b.x === x && b.y === y)) return false;
  return true;
}

export function place(s: GameState, type: string, x: number, y: number): string | null {
  const def = BUILDING_BY_ID[type];
  if (!def.unlockedBy || !has(s, def.unlockedBy)) return "Todavía no sabes construir eso.";
  if (!canPlace(s, type, x, y)) return def.place === "orilla" ? "Tiene que ir en la orilla del río, en una casilla libre." : "Esa casilla no está libre.";
  if (!canAfford(s, def.cost)) return "No alcanzan los materiales.";
  pay(s, def.cost);
  s.buildings.push({ id: s.nextId++, type, x, y, progress: 0, built: false });
  log(s, `Plano colocado: ${def.name}. Los aldeanos lo van a construir.`);
  return null;
}

// ---------- Aldeanos ----------

/** "Señalar": un solo viaje de recolección hacia un nodo. */
export function orderGather(s: GameState, villagerId: number, nodeId: number): string | null {
  const v = s.villagers.find((x) => x.id === villagerId);
  const n = s.nodes.find((x) => x.id === nodeId);
  if (!v || !n) return null;
  if (stageOf(v) !== "adult") return `${v.name} no puede trabajar (${stageOf(v) === "child" ? "es un niño" : "es anciano"}).`;
  const res = (Object.keys(NODE_DEFS[n.type].stocks) as ResId[]).find((r) => (n.stock[r] ?? 0) >= 1);
  if (!res) return "Ahí no queda nada por ahora.";
  v.order = { nodeId, res };
  v.task = { kind: "idle", t: 0 };
  return null;
}

export function setJob(s: GameState, villagerId: number, jobId: string | null) {
  const v = s.villagers.find((x) => x.id === villagerId);
  if (!v || stageOf(v) !== "adult") return;
  if (jobId && !jobUnlocked(s, jobId)) return;
  v.job = jobId;
  v.order = null;
  v.task = { kind: "idle", t: 0 };
  syncQuotas(s);
}

/** +1 / −1 aldeano en un oficio. Con Jefatura, además queda como cuota. */
export function changeJobCount(s: GameState, jobId: string, delta: 1 | -1) {
  if (!jobUnlocked(s, jobId)) return;
  const adults = s.villagers.filter((v) => stageOf(v) === "adult");
  if (delta === 1) {
    const free = adults.find((v) => v.job === null);
    if (free) { free.job = jobId; free.order = null; free.task = { kind: "idle", t: 0 }; }
  } else {
    const holder = adults.find((v) => v.job === jobId);
    if (holder) { holder.job = null; holder.task = { kind: "idle", t: 0 }; }
  }
  syncQuotas(s);
}

function syncQuotas(s: GameState) {
  for (const j of JOBS) s.quotas[j.id] = s.villagers.filter((v) => v.job === j.id && stageOf(v) === "adult").length;
}

// ---------- Debug ----------

export function debugSetAmount(s: GameState, res: ResId, value: number) {
  s.inv[res] = Math.max(0, value);
}

export function debugToggleInfinite(s: GameState, res: ResId) {
  s.debug.infinite[res] = !s.debug.infinite[res];
}

export function debugUnlockUpToEra(s: GameState, era: number) {
  for (const t of TECHS) if (t.era <= era) s.techs[t.id] = true;
  s.erasOpen = Math.max(s.erasOpen, era);
  log(s, `🐞 Debug: todas las tecnologías hasta la era ${era} desbloqueadas.`);
}

export function debugResetTechs(s: GameState) {
  s.techs = {};
  s.erasOpen = 1;
  s.prototypeEnded = false;
  log(s, "🐞 Debug: tecnologías reiniciadas.");
}

export function debugAddVillagers(s: GameState, n: number) {
  const pila = s.buildings.find((b) => b.type === "pila")!;
  for (let i = 0; i < n; i++) newVillager(s, 18 + Math.random() * 10, pila.x + 0.5 + Math.random() - 0.5, pila.y + 0.5 + Math.random() - 0.5);
  log(s, `🐞 Debug: +${n} aldeanos adultos.`);
}
