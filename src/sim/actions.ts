// Acciones del jugador y del modo debug. Todas mutan el estado directamente.
import { config } from "../config";
import { BUILDING_BY_ID, NODE_DEFS, TECH_INTRO, type ResId, type Role } from "../content";
import { TECHS, TECH_BY_ID, techCost } from "../data/tree";
import { add, canAfford, has, isFree, pay, roleUnlocked, staffCount, stageOf } from "./economy";
import { changeSpecialtyTarget, hasJefatura } from "./jefatura";
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
  unlock(s, id, true);
  return true;
}

/** Desbloquea una tecnología. Con `intro`, encola la tarjeta que explica qué cambió. */
export function unlock(s: GameState, id: string, intro = false) {
  if (s.techs[id]) return;
  s.techs[id] = true;
  log(s, `📖 Comprendido: ${TECH_BY_ID[id].name}.`);
  if (intro && TECH_INTRO[id]) s.introQueue.push(id);
}

export function dismissIntro(s: GameState) {
  s.introQueue.shift();
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

/** Demuele un edificio (o cancela una obra). Libera a sus trabajadores y devuelve materiales. */
export function demolish(s: GameState, buildingId: number): string | null {
  const b = s.buildings.find((x) => x.id === buildingId);
  if (!b) return null;
  const def = BUILDING_BY_ID[b.type];
  if (!def.unlockedBy) return "Eso no se puede demoler.";
  const refund = b.built ? config.DEVOLUCION_DEMOLER : 1;
  for (const [r, n] of Object.entries(def.cost)) add(s, r as ResId, Math.floor((n ?? 0) * refund));
  for (const v of s.villagers) {
    if (v.workplace === b.id) v.workplace = null;
    if ("bId" in v.task && v.task.bId === b.id) v.task = { kind: "idle", t: 0 };
  }
  s.buildings.splice(s.buildings.indexOf(b), 1);
  log(s, b.built ? `🗑️ Demolido: ${def.name}. Se recuperó parte de los materiales.` : `Obra cancelada: ${def.name}. Se devolvieron los materiales.`);
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

/**
 * Asigna un aldeano a una categoría (o lo deja libre). Lo saca de su puesto de especialista.
 * Con Jefatura, el aldeano queda con tarea manual (fuera de la Jefatura) hasta que se lo devuelva.
 */
export function setRole(s: GameState, villagerId: number, role: Role | null) {
  const v = s.villagers.find((x) => x.id === villagerId);
  if (!v || stageOf(v) !== "adult") return;
  if (role && !roleUnlocked(s, role)) return;
  v.role = role;
  v.workplace = null;
  v.order = null;
  v.task = { kind: "idle", t: 0 };
  if (hasJefatura(s)) v.manual = true;
}

/** +1 / −1 aldeano en una categoría (manual, antes de la Jefatura). */
export function changeRoleCount(s: GameState, role: Role, delta: 1 | -1) {
  if (!roleUnlocked(s, role)) return;
  if (delta === 1) {
    const free = s.villagers.find(isFree);
    if (free) { free.role = role; free.order = null; free.task = { kind: "idle", t: 0 }; }
  } else {
    const holder = s.villagers.find((v) => v.role === role && stageOf(v) === "adult");
    if (holder) { holder.role = null; holder.task = { kind: "idle", t: 0 }; }
  }
}

/**
 * +1 / −1 especialista en un edificio. Antes de la Jefatura toma aldeanos libres;
 * con Jefatura cambia cuántos puestos de esa especialidad quieres ocupados.
 */
export function changeSpecialists(s: GameState, buildingId: number, delta: 1 | -1): string | null {
  const b = s.buildings.find((x) => x.id === buildingId);
  const staff = b ? BUILDING_BY_ID[b.type].staff : undefined;
  if (!b || !staff || staff.by !== "especialista") return null;
  if (!b.built) return "Primero hay que terminar de construirlo.";
  if (hasJefatura(s)) { changeSpecialtyTarget(s, b.type, delta); return null; }
  if (delta === 1) {
    if (staffCount(s, b) >= staff.slots) return "Ya no hay puestos libres.";
    // Para los puestos que lo admiten (chamán), primero un anciano libre: son los mejores.
    const elder = staff.elders ? s.villagers.find((v) => stageOf(v) === "elder" && v.workplace == null) : undefined;
    const free = elder ?? s.villagers.find(isFree);
    if (!free) return "No hay aldeanos libres: quita a alguien de una categoría en 👥 Aldeanos.";
    free.workplace = b.id;
    free.order = null;
    free.task = { kind: "idle", t: 0 };
  } else {
    const worker = s.villagers.find((v) => v.workplace === b.id);
    if (worker) { worker.workplace = null; worker.task = { kind: "idle", t: 0 }; }
  }
  return null;
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
