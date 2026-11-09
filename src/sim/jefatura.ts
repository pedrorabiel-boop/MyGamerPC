// La Jefatura (N11 Aldea organizada): "alguien decide por uno".
// 1. Especialidades elegidas por el jugador (ocupación total o una cantidad).
// 2. El resto de la gente se reparte entre categorías con la regla de Zipf según las prioridades.
// 3. Nadie va a donde no hay trabajo.
// Los aldeanos con tarea manual quedan fuera hasta que el jugador los devuelve.
import { config } from "../config";
import { BUILDINGS, BUILDING_BY_ID, MATERIALS, type Role } from "../content";
import { has, roleUnlocked, staffCount, stageOf, storageCap, unlimited } from "./economy";
import type { Building, GameState, Villager } from "./state";

export const JEFATURA_TECH = "N11";
export const hasJefatura = (s: GameState) => has(s, JEFATURA_TECH);

const isSpecialtyDef = (type: string) => BUILDING_BY_ID[type]?.staff?.by === "especialista";

/** Tipos de edificio de especialidad que ya tienen al menos un edificio construido. */
export function specialtyTypes(s: GameState): string[] {
  return BUILDINGS.filter((d) => isSpecialtyDef(d.id) && s.buildings.some((b) => b.built && b.type === d.id)).map((d) => d.id);
}

export function specialtySlots(s: GameState, type: string): number {
  const slots = BUILDING_BY_ID[type].staff?.slots ?? 0;
  return s.buildings.filter((b) => b.built && b.type === type).length * slots;
}

export function specialtyStaffed(s: GameState, type: string): number {
  return s.buildings.filter((b) => b.built && b.type === type).reduce((acc, b) => acc + staffCount(s, b), 0);
}

/** Configuración de una especialidad. Si es nueva, arranca con la gente que ya tiene (no se llena sola). */
export function specialtyConfig(s: GameState, type: string) {
  return (s.jefatura.specialties[type] ??= { full: false, n: specialtyStaffed(s, type) });
}

export function specialtyTarget(s: GameState, type: string): number {
  const c = specialtyConfig(s, type);
  const slots = specialtySlots(s, type);
  return c.full ? slots : Math.min(c.n, slots);
}

/** Cuánta gente puede aprovechar cada categoría ahora (0 = no hay trabajo). */
export function roleCap(s: GameState, role: Role): number {
  if (!roleUnlocked(s, role)) return 0;
  if (role === "comida") {
    if (!s.resolved.comida) return Infinity;
    // Con la comida resuelta, solo hacen falta los puestos de parcelas y muelle.
    return s.buildings.filter((b) => b.built && BUILDING_BY_ID[b.type].staff?.by === "comida")
      .reduce((acc, b) => acc + (BUILDING_BY_ID[b.type].staff?.slots ?? 0), 0);
  }
  if (role === "materiales") {
    const needed = MATERIALS.some((m) => has(s, m.tech) && !unlimited(s, m.res) && s.inv[m.res] < storageCap(s, m.res) - 1);
    return needed ? Infinity : 0;
  }
  return s.buildings.some((b) => !b.built) ? Infinity : 0; // construcción: solo si hay planos
}

/**
 * Reparte `total` personas entre las categorías activas con pesos de Zipf (1, 1/2, 1/3…)
 * según el orden de prioridad, respetando el tope de cada una. Usa el método de D'Hondt,
 * que da enteros y proporciones justas.
 */
export function zipfTargets(s: GameState, total: number): Map<Role, number> {
  const active = s.jefatura.priorities.filter((r) => roleCap(s, r) > 0);
  const out = new Map<Role, number>(s.jefatura.priorities.map((r) => [r, 0]));
  for (let k = 0; k < total; k++) {
    let best: Role | null = null, bestScore = -1;
    active.forEach((r, i) => {
      const n = out.get(r)!;
      if (n >= roleCap(s, r)) return;
      const score = (1 / (i + 1)) / (n + 1);
      if (score > bestScore) { bestScore = score; best = r; }
    });
    if (!best) break;
    out.set(best, out.get(best)! + 1);
  }
  return out;
}

const managed = (v: Villager) => stageOf(v) === "adult" && !v.manual;
const movable = (v: Villager) => managed(v) && !v.carry && !v.order;

function reset(v: Villager) { v.task = { kind: "idle", t: 0 }; }

/** Un paso de la Jefatura: hace como mucho un cambio de especialidad y uno de categoría. */
export function runJefatura(s: GameState, dt: number) {
  s.jefatura.timer -= dt;
  if (s.jefatura.timer > 0) return;
  s.jefatura.timer = config.JEFATURA_INTERVALO;

  // 1. Especialidades
  for (const type of specialtyTypes(s)) {
    const target = specialtyTarget(s, type);
    const staffed = specialtyStaffed(s, type);
    const inType = (x: Villager) => x.workplace != null && s.buildings.find((b) => b.id === x.workplace)?.type === type;
    if (staffed < target) {
      const b = s.buildings.find((x) => x.built && x.type === type && staffCount(s, x) < (BUILDING_BY_ID[type].staff?.slots ?? 0));
      const v = pickDonor(s, type);
      if (b && v) { v.workplace = b.id; v.role = null; reset(v); }
    } else if (staffed > target) {
      // Se libera primero a un adulto (los ancianos se quedan en su puesto si pueden).
      const v = s.villagers.find((x) => !x.manual && inType(x) && stageOf(x) === "adult") ?? s.villagers.find((x) => !x.manual && inType(x));
      if (v) { v.workplace = null; reset(v); }
    } else if (BUILDING_BY_ID[type].staff?.elders) {
      // Privilegiar a los ancianos: si un adulto ocupa un puesto que puede ocupar un anciano libre, se cambian.
      const elder = s.villagers.find(isFreeElder);
      const adult = s.villagers.find((x) => !x.manual && inType(x) && stageOf(x) === "adult" && !x.carry);
      if (elder && adult) { elder.workplace = adult.workplace; reset(elder); adult.workplace = null; reset(adult); }
    }
  }

  // 2. Categorías (Zipf)
  const pool = s.villagers.filter((v) => managed(v) && v.workplace == null);
  const targets = zipfTargets(s, pool.length);
  const count = (r: Role) => pool.filter((v) => v.role === r).length;
  const under = s.jefatura.priorities.filter((r) => count(r) < (targets.get(r) ?? 0));
  if (!under.length) return;
  const to = under[0];
  // Primero los libres; si no hay, alguien de una categoría que tenga de sobra.
  const free = pool.find((v) => v.role === null && movable(v));
  if (free) { free.role = to; reset(free); return; }
  const over = s.jefatura.priorities.filter((r) => count(r) > (targets.get(r) ?? 0));
  for (const r of over) {
    const v = pool.find((x) => x.role === r && movable(x));
    if (v) { v.role = to; reset(v); return; }
  }
}

const isFreeElder = (v: Villager) => stageOf(v) === "elder" && v.workplace == null && !v.manual;

/** Alguien para un puesto de especialista: un anciano libre (si el puesto lo admite), un libre, o de la categoría que más gente tiene. */
function pickDonor(s: GameState, type: string): Villager | null {
  if (BUILDING_BY_ID[type].staff?.elders) {
    const elder = s.villagers.find(isFreeElder);
    if (elder) return elder;
  }
  const pool = s.villagers.filter((v) => movable(v) && v.workplace == null);
  const free = pool.find((v) => v.role === null);
  if (free) return free;
  const counts = new Map<Role, number>();
  for (const v of pool) if (v.role) counts.set(v.role, (counts.get(v.role) ?? 0) + 1);
  const biggest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return biggest ? pool.find((v) => v.role === biggest) ?? null : null;
}

/** Edificio de especialidad: el jugador cambia cuántos puestos quiere (con Jefatura). */
export function changeSpecialtyTarget(s: GameState, type: string, delta: number) {
  const c = specialtyConfig(s, type);
  c.full = false;
  c.n = Math.max(0, Math.min(specialtySlots(s, type), c.n + delta));
}

export function setSpecialtyFull(s: GameState, type: string, full: boolean) {
  const c = specialtyConfig(s, type);
  c.full = full;
  if (!full) c.n = Math.min(c.n, specialtySlots(s, type));
}

export function movePriority(s: GameState, role: Role, dir: -1 | 1) {
  const p = s.jefatura.priorities;
  const i = p.indexOf(role);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.length) return;
  [p[i], p[j]] = [p[j], p[i]];
}

/** Devuelve a la Jefatura a un aldeano con tarea manual. */
export function returnToJefatura(s: GameState, villagerId: number) {
  const v = s.villagers.find((x) => x.id === villagerId);
  if (v) v.manual = false;
}

export const manualVillagers = (s: GameState) => s.villagers.filter((v) => v.manual && stageOf(v) === "adult");

export const isSpecialtyBuilding = (b: Building) => isSpecialtyDef(b.type);
