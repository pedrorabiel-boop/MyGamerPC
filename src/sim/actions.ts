// Acciones del jugador y del modo debug. Todas mutan el estado directamente.
import { config } from "../config";
import { BUILDING_BY_ID, NODE_DEFS, TECH_INTRO, UPGRADES, type Cost, type ResId, type Role } from "../content";
import { TECHS, TECH_BY_ID, techCost } from "../data/tree";
import { add, canAfford, has, isFree, pay, roleUnlocked, staffCount, stageOf, youngestFirst } from "./economy";
import { changeSpecialtyTarget, hasJefatura } from "./jefatura";
import { log, newVillager, ZONE_BY_ID, type GameState, type Villager, type ZoneId } from "./state";

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

export function canPlace(s: GameState, type: string, x: number, y: number, zone: ZoneId = "valle"): boolean {
  const def = BUILDING_BY_ID[type];
  const z = s.zones[zone];
  if (x < 0 || y < 0 || x >= z.w || y >= z.h) return false;
  if (!def.place.includes(z.tiles[y][x])) return false;
  if (s.buildings.some((b) => b.zone === zone && b.x === x && b.y === y)) return false;
  const node = s.nodes.find((n) => n.zone === zone && n.x === x && n.y === y);
  // Las minas van encima de su veta; el resto, en casillas sin recursos.
  if (def.onNode ? node?.type !== def.onNode : !!node) return false;
  if (def.nearWater) {
    const water = (tx: number, ty: number) => {
      const tile = z.tiles[ty]?.[tx];
      return tile === "rio" || tile === "orilla" || s.buildings.some((b) => b.zone === zone && b.type === "canal" && b.x === tx && b.y === ty);
    };
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => water(x + dx, y + dy))) return false;
  }
  return true;
}

/** ¿Se puede construir este edificio en alguna casilla de esta zona? */
export const placeableIn = (s: GameState, type: string, zone: ZoneId) =>
  s.zones[zone].tiles.some((row) => row.some((t) => BUILDING_BY_ID[type].place.includes(t)));

export function place(s: GameState, type: string, x: number, y: number, zone: ZoneId = "valle"): string | null {
  const def = BUILDING_BY_ID[type];
  if (!def.unlockedBy || !has(s, def.unlockedBy)) return "Todavía no sabes construir eso.";
  if (!canPlace(s, type, x, y, zone)) {
    if (def.onNode) return `Tiene que ir encima de: ${def.onNode === "veta" ? "una veta verde (Cueva)" : "una veta de estaño (Montañas)"}.`;
    if (def.nearWater) return "El canal tiene que tocar el río, la orilla u otro canal.";
    return def.place.includes("orilla") ? "Tiene que ir en la orilla del río, en una casilla libre." : "Esa casilla no está libre.";
  }
  if (!canAfford(s, def.cost)) return "No alcanzan los materiales.";
  pay(s, def.cost);
  s.buildings.push({ id: s.nextId++, type, zone, x, y, progress: 0, built: false });
  log(s, `Plano colocado: ${def.name}. Los aldeanos lo van a construir.`);
  return null;
}

/** Demuele un edificio (o cancela una obra). Libera a sus trabajadores y devuelve materiales. */
export function demolish(s: GameState, buildingId: number): string | null {
  const b = s.buildings.find((x) => x.id === buildingId);
  if (!b) return null;
  const def = BUILDING_BY_ID[b.type];
  if (!def.unlockedBy) return "Eso no se puede demoler.";
  if (b.upgradeTo) cancelUpgrade(s, b.id);
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

// ---------- Mejoras ----------

/** Costo de mejorar: el del edificio nuevo, con descuento. */
export function upgradeCost(to: string): Cost {
  const out: Cost = {};
  for (const [r, n] of Object.entries(BUILDING_BY_ID[to].cost)) out[r as ResId] = Math.ceil((n ?? 0) * (1 - config.DESCUENTO_MEJORA));
  return out;
}

/** A qué se puede mejorar este edificio ahora (o null). */
export function upgradeTarget(s: GameState, buildingId: number): string | null {
  const b = s.buildings.find((x) => x.id === buildingId);
  const to = b ? UPGRADES[b.type] : undefined;
  if (!b || !to || !b.built || b.upgradeTo) return null;
  const req = BUILDING_BY_ID[to].unlockedBy;
  return req && has(s, req) ? to : null;
}

export function startUpgrade(s: GameState, buildingId: number): string | null {
  const to = upgradeTarget(s, buildingId);
  if (!to) return "Este edificio no se puede mejorar ahora.";
  const cost = upgradeCost(to);
  if (!pay(s, cost)) return "No alcanzan los materiales.";
  const b = s.buildings.find((x) => x.id === buildingId)!;
  b.upgradeTo = to;
  b.upgradeProgress = 0;
  log(s, `Mejora en curso: ${BUILDING_BY_ID[b.type].name} → ${BUILDING_BY_ID[to].name}. Sigue funcionando mientras tanto.`);
  return null;
}

export function cancelUpgrade(s: GameState, buildingId: number) {
  const b = s.buildings.find((x) => x.id === buildingId);
  if (!b?.upgradeTo) return;
  for (const [r, n] of Object.entries(upgradeCost(b.upgradeTo))) add(s, r as ResId, n ?? 0);
  delete b.upgradeTo;
  delete b.upgradeProgress;
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

/** +1 / −1 aldeano en una categoría, entre los que están en `zone` (manual, antes de la Jefatura). */
export function changeRoleCount(s: GameState, role: Role, delta: 1 | -1, zone: ZoneId = "valle") {
  if (!roleUnlocked(s, role)) return;
  const here = (v: Villager) => v.zone === zone && !v.transit;
  if (delta === 1) {
    const free = s.villagers.find((v) => isFree(v) && here(v));
    if (free) { free.role = role; free.order = null; free.task = { kind: "idle", t: 0 }; }
  } else {
    const holder = s.villagers.find((v) => v.role === role && stageOf(v) === "adult" && here(v));
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
    // Solo gente que ya está en la zona del edificio; para los puestos que lo admiten (chamán), primero un anciano.
    const here = (v: Villager) => v.zone === b.zone && !v.transit;
    const elder = staff.elders ? s.villagers.find((v) => stageOf(v) === "elder" && v.workplace == null && here(v)) : undefined;
    const free = elder ?? youngestFirst(s.villagers.filter((v) => isFree(v) && here(v)))[0];
    if (!free) {
      return b.zone === "valle"
        ? "No hay aldeanos libres: quita a alguien de una categoría en 👥 Aldeanos."
        : `No hay aldeanos libres en ${ZONE_BY_ID[b.zone].label}: envía gente desde el Valle (toca su entrada).`;
    }
    free.workplace = b.id;
    free.order = null;
    free.task = { kind: "idle", t: 0 };
  } else {
    const worker = s.villagers.find((v) => v.workplace === b.id);
    if (worker) { worker.workplace = null; worker.task = { kind: "idle", t: 0 }; }
  }
  return null;
}

// ---------- Zonas ----------

export const zoneUnlocked = (s: GameState, zone: ZoneId) => {
  const req = ZONE_BY_ID[zone].unlockedBy;
  return !req || has(s, req);
};

/** Adultos que están en una zona (sin contar los que van en camino). */
export const adultsIn = (s: GameState, zone: ZoneId) =>
  s.villagers.filter((v) => v.zone === zone && !v.transit && stageOf(v) === "adult");

export const travelingTo = (s: GameState, zone: ZoneId) => s.villagers.filter((v) => v.transit === zone).length;

/**
 * Manda un adulto de una zona a otra. Prefiere a los libres, después a quien esté en la categoría
 * con más gente. Los especialistas no se mueven (su puesto está en su edificio).
 */
export function transferVillager(s: GameState, from: ZoneId, to: ZoneId, auto = false): string | null {
  if (!zoneUnlocked(s, to) || !zoneUnlocked(s, from)) return "Esa zona todavía no se puede explorar.";
  // Los traslados automáticos (metas por zona) no mueven a quien tiene una tarea manual.
  const pool = adultsIn(s, from).filter((v) => v.workplace == null && !v.order && !(auto && v.manual));
  if (!pool.length) return `No hay adultos disponibles en ${ZONE_BY_ID[from].label}.`;
  // A una zona lejana se manda a los más jóvenes (así duran más antes de volverse ancianos);
  // de vuelta al Valle se trae a los más viejos.
  const ordered = to === "valle" ? youngestFirst(pool).reverse() : youngestFirst(pool);
  const counts = new Map<string, number>();
  for (const v of ordered) counts.set(v.role ?? "", (counts.get(v.role ?? "") ?? 0) + 1);
  const v = ordered.find((x) => x.role === null)
    ?? ordered.find((x) => x.role === [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0])!;
  v.transit = to;
  v.task = { kind: "idle", t: 0 };
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
  const pila = s.buildings.find((b) => b.type === "pila" && b.zone === "valle")!;
  for (let i = 0; i < n; i++) newVillager(s, 18 + Math.random() * 10, pila.x + 0.5 + Math.random() - 0.5, pila.y + 0.5 + Math.random() - 0.5);
  log(s, `🐞 Debug: +${n} aldeanos adultos.`);
}
