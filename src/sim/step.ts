import { config } from "../config";
import {
  BUILDING_BY_ID, FOOD_GATHER, MATERIALS, NODE_DEFS, NODE_UPGRADES, RES_BY_ID, RESOLUTIONS,
  type NodeType, type ResId,
} from "../content";
import { ERAS } from "../data/tree";
import {
  add, adultAge, canAfford, countBuilt, has, housing, isResolutionMet, nodeMax, nodeRegen, pay, roleUnlocked, stageOf, storageCap, unlimited,
} from "./economy";
import { hasJefatura, runJefatura } from "./jefatura";
import { maintainZoneQuotas } from "./zones";
import { focusTargets } from "./guide";
import { log, newVillager, rand, type Building, type GameState, type ResNode, type Villager, type ZoneId } from "./state";

/** Avanza la simulación `dt` segundos de juego. Usar pasos pequeños (≤ 0,5 s). */
export function step(s: GameState, dt: number) {
  s.time += dt;
  updateResolutions(s);
  regenNodes(s, dt);
  passiveBuildings(s, dt);
  updateAnimo(s);
  eat(s, dt);
  ageAndDie(s, dt);
  births(s, dt);
  maintainZoneQuotas(s, dt);
  if (hasJefatura(s)) runJefatura(s, dt);
  const occ = occupancy(s);
  for (const v of s.villagers) updateVillager(s, v, dt, occ);
  elderComprension(s, dt);
  checkEras(s);
}

// ---------- mundo ----------

/** Un recurso queda resuelto mientras existan sus edificios y estén ocupados sus puestos. */
function updateResolutions(s: GameState) {
  for (const def of RESOLUTIONS) {
    const met = isResolutionMet(s, def);
    if (met === !!s.resolved[def.res]) continue;
    s.resolved[def.res] = met;
    const name = RES_BY_ID[def.res].name;
    log(s, met
      ? `✅ ¡${name} resuelta! Mientras mantengas esta infraestructura, nunca va a faltar.`
      : `⚠️ ${name} dejó de estar resuelta: falta infraestructura o gente en sus puestos.`);
  }
}

function regenNodes(s: GameState, dt: number) {
  for (const n of s.nodes) {
    for (const res of Object.keys(NODE_DEFS[n.type].stocks)) {
      const r = res as ResId;
      n.stock[r] = Math.min(nodeMax(n, r), (n.stock[r] ?? 0) + nodeRegen(n, r) * dt);
    }
  }
}

function passiveBuildings(s: GameState, dt: number) {
  for (const b of s.buildings) {
    const p = b.built ? BUILDING_BY_ID[b.type]?.passive : undefined;
    if (p) add(s, p.res, p.rate * dt * s.animo);
  }
}

function updateAnimo(s: GameState) {
  let a = 1;
  a += Math.min(countBuilt(s, "fogata"), 2) * (BUILDING_BY_ID.fogata.animo ?? 0);
  // Paredes pintadas: en la Cueva valen el doble (pinturas rupestres de verdad). Tope: 3 paredes del Valle.
  const paredes = s.buildings.filter((b) => b.built && b.type === "pared").reduce((acc, b) => acc + (b.zone === "cueva" ? 2 : 1), 0);
  a += Math.min(paredes, 3) * (BUILDING_BY_ID.pared.animo ?? 0);
  if (has(s, "P05")) a += 0.05; // abrigo de pieles
  if (s.villagers.length > housing(s)) a -= has(s, "B06") ? 0.05 : 0.2; // Leyes (B06): la sobrepoblación pesa menos
  if (s.inv.comida <= 0 && !unlimited(s, "comida")) a -= 0.3;
  s.animo = Math.max(0.4, Math.min(1.6, a));
}

function eat(s: GameState, dt: number) {
  add(s, "comida", -s.villagers.length * (config.COMIDA_POR_AÑO / config.TIEMPO_POR_AÑO) * dt);
}

function ageAndDie(s: GameState, dt: number) {
  const years = dt / config.TIEMPO_POR_AÑO;
  const hungry = s.inv.comida <= 0 && !unlimited(s, "comida");
  const healer = s.villagers.some((v) => v.workplace != null && s.buildings.find((b) => b.id === v.workplace)?.type === "huerto" && v.task.kind === "work");
  // Sin enfermedades al principio: recién aparecen cuando la tribu ya tiene cierto tamaño.
  const illness = s.villagers.length < config.POBLACION_ENFERMEDAD ? 0
    : config.MORTALIDAD_ENFERMEDAD * (healer ? 0.5 : 1) * (has(s, "P05") ? 0.8 : 1);
  const dead: Villager[] = [];
  for (const v of s.villagers) {
    v.age += years;
    if (!v.wasAdult && v.age >= adultAge(v)) v.wasAdult = true; // llega a adulto libre (sin herencia)
    // Al volverse anciano deja su puesto de especialista (el edificio queda con un puesto vacío).
    // Al volverse anciano deja su puesto, salvo que sea uno que los ancianos pueden ocupar (chamán).
    if (v.workplace != null && stageOf(v) === "elder" && !elderCanWork(s, v.workplace)) { v.workplace = null; v.task = { kind: "idle", t: 0 }; }
    let p = illness * years;
    if (hungry) p += config.MORTALIDAD_HAMBRE * years;
    if (v.age >= v.lifespan || rand(s) < p) dead.push(v);
  }
  for (const v of dead) {
    s.villagers.splice(s.villagers.indexOf(v), 1);
    s.stats.deaths++;
    const cause = v.age >= v.lifespan ? "de viejo" : hungry ? "de hambre" : "de una enfermedad";
    log(s, `Murió ${v.name} ${cause}, a los ${Math.floor(v.age)} años.`);
  }
}

function births(s: GameState, dt: number) {
  const adults = s.villagers.filter((v) => stageOf(v) === "adult");
  if (adults.length < 2) return;
  const fed = s.inv.comida > 2 || unlimited(s, "comida");
  const room = s.villagers.length < housing(s);
  if (!fed || !room) return;
  const fire = countBuilt(s, "fogata") > 0 ? 1.2 : 1;
  s.birthAcc += config.NATALIDAD * adults.length * s.animo * fire * (dt / config.TIEMPO_POR_AÑO);
  while (s.birthAcc >= 1) {
    s.birthAcc -= 1;
    const parent = adults[Math.floor(rand(s) * adults.length)];
    const pila = s.buildings.find((b) => b.type === "pila" && b.zone === "valle")!;
    const baby = newVillager(s, 0, pila.x + 0.5 + (rand(s) - 0.5), pila.y + 0.5 + (rand(s) - 0.5));
    add(s, "comida", -2);
    s.stats.births++;
    log(s, `Nació ${baby.name}, de la familia de ${parent.name}.`);
  }
}

function elderComprension(s: GameState, dt: number) {
  if (!has(s, "P01")) return;
  // Los ancianos que trabajan de chamán ya producen en su puesto (y más).
  const elders = s.villagers.filter((v) => stageOf(v) === "elder" && v.workplace == null).length;
  add(s, "comprension", elders * config.COMPRENSION_ANCIANO * dt);
}

function checkEras(s: GameState) {
  const next = ERAS.find((e) => e.id === s.erasOpen + 1);
  if (!next) return;
  const ms = next.milestone;
  if (!ms.requires.every((id) => s.techs[id])) return;
  if (ms.population && s.villagers.length < ms.population) return;
  s.erasOpen = next.id;
  log(s, `¡Hito «${ms.name}»! Se abre el capítulo: ${next.name}.`);
  if (next.id >= 4) s.prototypeEnded = true;
}

function occupancy(s: GameState): Map<number, number> {
  const m = new Map<number, number>();
  for (const v of s.villagers) {
    if (v.task.kind === "toBuilding" || v.task.kind === "work") m.set(v.task.bId, (m.get(v.task.bId) ?? 0) + 1);
  }
  return m;
}

// ---------- aldeanos ----------

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Mueve al aldeano hacia (x, y). Devuelve true si llegó. */
function moveTo(v: Villager, x: number, y: number, dt: number): boolean {
  const ox = (v.jitter - 0.5) * 0.5;
  const oy = (((v.jitter * 7) % 1) - 0.5) * 0.5;
  const tx = x + ox, ty = y + oy;
  const d = dist(v.x, v.y, tx, ty);
  const stepLen = config.VELOCIDAD_CAMINAR * dt;
  if (d <= stepLen) { v.x = tx; v.y = ty; return true; }
  v.x += ((tx - v.x) / d) * stepLen;
  v.y += ((ty - v.y) / d) * stepLen;
  return false;
}

function wander(s: GameState, v: Villager, dt: number, ax: number, ay: number, radius = 1.5) {
  if (v.task.kind !== "idle") v.task = { kind: "idle", t: 0 };
  v.task.t -= dt;
  if (v.task.t <= 0) {
    const z = s.zones[v.zone];
    v.tx = Math.max(0.3, Math.min(z.w - 0.3, ax + (rand(s) * 2 - 1) * radius));
    v.ty = Math.max(0.3, Math.min(z.h - 0.3, ay + (rand(s) * 2 - 1) * radius));
    v.task.t = 2 + rand(s) * 3;
  }
  const d = dist(v.x, v.y, v.tx, v.ty);
  const stepLen = config.VELOCIDAD_CAMINAR * 0.5 * dt;
  if (d > stepLen) { v.x += ((v.tx - v.x) / d) * stepLen; v.y += ((v.ty - v.y) / d) * stepLen; }
}

/** Punto de reunión de una zona: la fogata (si hay) o la pila. */
function anchor(s: GameState, zone: ZoneId): Building {
  return s.buildings.find((b) => b.built && b.zone === zone && b.type === "fogata") ?? s.buildings.find((b) => b.zone === zone && b.type === "pila")!;
}

/** Camina hasta la salida hacia la otra zona y aparece en la entrada de esa zona. */
function travel(s: GameState, v: Villager, dt: number) {
  const fromId = v.zone, toId = v.transit!;
  // Las zonas se conectan a través del Valle: si no hay salida directa, primero va al Valle.
  const hop: ZoneId = s.zones[fromId].exits[toId] ? toId : "valle";
  const exit = s.zones[fromId].exits[hop]!;
  if (moveTo(v, exit.x + 0.5, exit.y + 0.5, dt)) {
    const arrive = s.zones[hop].exits[fromId]!;
    v.zone = hop;
    if (hop === toId) v.transit = null;
    v.x = arrive.x + 0.5;
    v.y = arrive.y + 0.5;
    v.task = { kind: "idle", t: 0 };
  }
}

/** Lo que se produce en una zona lejana llega con pérdida. */
export const zoneEfficiency = (zone: ZoneId) => (zone === "montanas" ? config.EFICIENCIA_MONTANAS : 1);

const workSpeed = (s: GameState) => (has(s, "B03") ? config.BONO_BRONCE : 1);

/** ¿Hay un edificio de tipo `type` en alguna de las 8 casillas vecinas? */
export function hasNeighbor(s: GameState, b: Building, type: string): boolean {
  return s.buildings.some((o) => o.built && o.type === type && o.zone === b.zone && o !== b && Math.abs(o.x - b.x) <= 1 && Math.abs(o.y - b.y) <= 1);
}

function nearestStore(s: GameState, v: Villager): Building {
  let best: Building | null = null, bd = Infinity;
  for (const b of s.buildings) {
    if (!b.built || b.zone !== v.zone || !BUILDING_BY_ID[b.type]?.storage) continue;
    const d = dist(v.x, v.y, b.x + 0.5, b.y + 0.5);
    if (d < bd) { bd = d; best = b; }
  }
  return best!;
}

function nearestNode(s: GameState, v: Villager, type: NodeType, res: ResId): ResNode | null {
  let best: ResNode | null = null, bd = Infinity;
  for (const n of s.nodes) {
    if (n.type !== type || n.zone !== v.zone || (n.stock[res] ?? 0) < 1) continue;
    const d = dist(v.x, v.y, n.x + 0.5, n.y + 0.5);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

const busyGathering = (v: Villager) => !!v.carry || v.task.kind === "toNode" || v.task.kind === "gather";

function updateVillager(s: GameState, v: Villager, dt: number, occ: Map<number, number>) {
  if (v.transit) return travel(s, v, dt);
  const stage = stageOf(v);
  // Los niños y los ancianos viven en el Valle (salvo un anciano chamán, que va a su Círculo).
  const workplaceB = v.workplace != null ? s.buildings.find((x) => x.id === v.workplace && x.built) : undefined;
  const home: ZoneId = workplaceB?.zone ?? "valle";
  if (stage !== "adult" && v.zone !== home) { v.transit = home; return; }
  // Un especialista cuyo edificio está en otra zona, va para allá.
  if (stage === "adult" && workplaceB && workplaceB.zone !== v.zone && !v.carry) { v.transit = workplaceB.zone; return; }
  const a = anchor(s, v.zone);
  if (stage === "child") {
    if (goToSchool(s, v, dt, occ)) return;
    return wander(s, v, dt, a.x + 0.5, a.y + 0.5, 1.5);
  }
  if (stage === "elder") {
    const b = workplaceB;
    if (b && elderCanWork(s, b.id)) return workAt(s, v, dt, b);
    if (v.workplace != null) v.workplace = null;
    return wander(s, v, dt, a.x + 0.5, a.y + 0.5, 0.8);
  }

  // Si va cargando algo, primero lo entrega (aunque le hayan cambiado la categoría o la zona).
  if (v.carry) return gather(s, v, dt, null, null);

  // "Señalar": un solo viaje, tiene prioridad.
  if (v.order) {
    const n = s.nodes.find((x) => x.id === v.order!.nodeId);
    return gather(s, v, dt, n ? { node: n.type, res: v.order.res, carryMult: 1 } : null, v.order.nodeId);
  }

  // Especialista: trabaja en su edificio.
  if (v.workplace != null) {
    const b = s.buildings.find((x) => x.id === v.workplace && x.built);
    if (!b) { v.workplace = null; v.task = { kind: "idle", t: 0 }; }
    else return workAt(s, v, dt, b);
  }

  if (v.role && roleUnlocked(s, v.role)) {
    if (v.role === "comida") return foodWork(s, v, dt, occ);
    if (v.role === "materiales") return materialsWork(s, v, dt);
    if (v.role === "construccion") {
      if (!buildWork(s, v, dt, 1)) wander(s, v, dt, a.x + 0.5, a.y + 0.5, 2);
      return;
    }
  }
  // Libre: ayuda a construir si hay obras; si no, deambula.
  if (buildWork(s, v, dt, config.FACTOR_AYUDA_CONSTRUCCION)) return;
  wander(s, v, dt, a.x + 0.5, a.y + 0.5, 2);
}

/** Comida: el mejor método disponible. Primero edificios (parcelas, muelle), después caza, después bayas. */
function foodWork(s: GameState, v: Villager, dt: number, occ: Map<number, number>) {
  if (busyGathering(v)) return gather(s, v, dt, currentGatherSpec(s, v), null);
  if (v.task.kind === "toBuilding" || v.task.kind === "work") {
    const id = v.task.bId;
    const b = s.buildings.find((x) => x.id === id && x.built);
    if (b) return workAt(s, v, dt, b);
  }
  let best: Building | null = null, bd = Infinity;
  for (const b of s.buildings) {
    const staff = b.built && b.zone === v.zone ? BUILDING_BY_ID[b.type]?.staff : undefined;
    if (!staff || staff.by !== "comida" || (occ.get(b.id) ?? 0) >= staff.slots) continue;
    const d = dist(v.x, v.y, b.x + 0.5, b.y + 0.5);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) {
    occ.set(best.id, (occ.get(best.id) ?? 0) + 1);
    v.task = { kind: "toBuilding", bId: best.id };
    return workAt(s, v, dt, best);
  }
  for (const m of FOOD_GATHER) {
    if (!has(s, m.tech) || !nearestNode(s, v, m.node, "comida")) continue;
    return gather(s, v, dt, { node: m.node, res: "comida", carryMult: m.carryMult, bonus: m.bonus }, null);
  }
  wander(s, v, dt, v.x, v.y, 1);
}

/** Materiales: junta el material que más falta (en proporción a su límite de almacenamiento). */
function materialsWork(s: GameState, v: Villager, dt: number) {
  if (busyGathering(v)) return gather(s, v, dt, currentGatherSpec(s, v), null);
  let pick: (typeof MATERIALS)[number] | null = null, low = Infinity;
  // Recurso en foco (elegido por el jugador): si no está lleno, va primero lo que lo alimenta y se
  // junta a mano (él mismo, o lo de su cadena: ladrillo → arcilla y madera), empezando por lo más bajo.
  if (s.focus && !unlimited(s, s.focus) && s.inv[s.focus] < storageCap(s, s.focus) - 1) {
    for (const res of focusTargets(s, s.focus)) {
      if (unlimited(s, res) || s.inv[res] >= storageCap(s, res) - 1) continue;
      const m = MATERIALS.find((x) => x.res === res && has(s, x.tech) && nearestNode(s, v, x.node, x.res));
      if (!m) continue;
      const ratio = s.inv[res] / storageCap(s, res) + rand(s) * 0.05;
      if (ratio < low) { low = ratio; pick = m; }
    }
    if (pick) return gather(s, v, dt, { node: pick.node, res: pick.res, carryMult: 1 }, null);
  }
  for (const m of MATERIALS) {
    if (!has(s, m.tech) || unlimited(s, m.res) || !nearestNode(s, v, m.node, m.res)) continue;
    const ratio = s.inv[m.res] / storageCap(s, m.res) + rand(s) * 0.05; // un poco de azar para repartir
    if (ratio < low) { low = ratio; pick = m; }
  }
  if (!pick) return wander(s, v, dt, v.x, v.y, 1);
  gather(s, v, dt, { node: pick.node, res: pick.res, carryMult: 1 }, null);
}

/** Qué está recolectando ahora (para continuar el viaje en curso). */
function currentGatherSpec(s: GameState, v: Villager): GatherSpec | null {
  const res = v.carry?.res ?? (v.task.kind === "toNode" || v.task.kind === "gather" ? v.task.res : null);
  if (!res) return null;
  const nodeId = v.task.kind === "toNode" || v.task.kind === "gather" ? v.task.nodeId : null;
  const node = nodeId != null ? s.nodes.find((n) => n.id === nodeId) : null;
  const food = node ? FOOD_GATHER.find((m) => m.node === node.type) : undefined;
  return { node: node?.type ?? "arbusto", res, carryMult: food?.carryMult ?? 1, bonus: food?.bonus };
}

interface GatherSpec { node: NodeType; res: ResId; carryMult: number; bonus?: { res: ResId; amt: number } }

function gather(s: GameState, v: Villager, dt: number, spec: GatherSpec | null, fixedNode: number | null) {
  if (v.carry) {
    const store = nearestStore(s, v);
    if (moveTo(v, store.x + 0.5, store.y + 0.5, dt)) {
      add(s, v.carry.res, v.carry.amt * zoneEfficiency(v.zone));
      v.carry = null;
      v.task = { kind: "idle", t: 0 };
      if (v.order) v.order = null;
    }
    return;
  }
  if (!spec) { v.task = { kind: "idle", t: 0 }; return; }
  if (v.task.kind !== "toNode" && v.task.kind !== "gather") {
    const node = fixedNode != null ? s.nodes.find((n) => n.id === fixedNode) : nearestNode(s, v, spec.node, spec.res);
    if (!node || (node.stock[spec.res] ?? 0) < 0.5) {
      if (v.order) v.order = null;
      return wander(s, v, dt, v.x, v.y, 1);
    }
    v.task = { kind: "toNode", nodeId: node.id, res: spec.res };
  }
  const task = v.task;
  const node = s.nodes.find((n) => n.id === task.nodeId);
  if (!node) { v.task = { kind: "idle", t: 0 }; return; }
  if (task.kind === "toNode") {
    if (moveTo(v, node.x + 0.5, node.y + 0.5, dt)) v.task = { kind: "gather", nodeId: node.id, res: task.res, t: 0 };
    return;
  }
  const speed = (has(s, "P02") ? config.BONO_HERRAMIENTAS : 1) * workSpeed(s) * s.animo;
  task.t += dt * speed;
  if (task.t >= config.TIEMPO_RECOLECTAR) {
    const capacity = config.CARGA_BASE * (has(s, "P02") ? config.BONO_CESTA : 1) * (has(s, "B04") ? config.BONO_RUEDA : 1) * spec.carryMult;
    const take = Math.min(node.stock[task.res] ?? 0, capacity);
    node.stock[task.res] = (node.stock[task.res] ?? 0) - take;
    v.carry = { res: task.res, amt: take };
    if (spec.bonus) {
      const extra = Math.min(node.stock[spec.bonus.res] ?? 0, spec.bonus.amt);
      node.stock[spec.bonus.res] = (node.stock[spec.bonus.res] ?? 0) - extra;
      add(s, spec.bonus.res, extra);
    }
    v.task = { kind: "idle", t: 0 };
  }
}

/** Obra de mejora de un recurso natural (Barrero, Cantera…). false si no está en una. */
function improveWork(s: GameState, v: Villager, dt: number, rate: number): boolean {
  if (v.task.kind !== "toImprove" && v.task.kind !== "improve") return false;
  const id = v.task.nId;
  const n = s.nodes.find((x) => x.id === id && x.improving != null);
  const up = n ? NODE_UPGRADES[n.type] : undefined;
  if (!n || !up) { v.task = { kind: "idle", t: 0 }; return false; }
  if (v.task.kind === "toImprove") {
    if (moveTo(v, n.x + 0.5, n.y + 0.5, dt)) v.task = { kind: "improve", nId: n.id };
    return true;
  }
  n.improving! += dt * rate * s.animo;
  if (n.improving! >= up.buildTime) {
    delete n.improving;
    n.improved = true;
    log(s, `🌱 Mejorado: ${NODE_DEFS[n.type].name} → ${up.name}. Se regenera más rápido y guarda más.`);
    v.task = { kind: "idle", t: 0 };
  }
  return true;
}

/** ¿Hay trabajo de construcción en este edificio? (obra nueva o mejora en curso) */
export const needsBuilding = (b: Building) => !b.built || !!b.upgradeTo;

function buildWork(s: GameState, v: Villager, dt: number, rate: number): boolean {
  if (improveWork(s, v, dt, rate)) return true;
  let site: Building | undefined;
  if (v.task.kind === "toSite" || v.task.kind === "build") {
    const id = v.task.bId;
    site = s.buildings.find((b) => b.id === id && needsBuilding(b));
  }
  if (!site) {
    let bd = Infinity, node: ResNode | undefined;
    for (const b of s.buildings) {
      if (!needsBuilding(b) || b.zone !== v.zone) continue;
      const d = dist(v.x, v.y, b.x + 0.5, b.y + 0.5);
      if (d < bd) { bd = d; site = b; }
    }
    // Las mejoras de recursos naturales son obras como cualquier otra.
    for (const n of s.nodes) {
      if (n.improving == null || n.zone !== v.zone) continue;
      const d = dist(v.x, v.y, n.x + 0.5, n.y + 0.5);
      if (d < bd) { bd = d; node = n; site = undefined; }
    }
    if (node) { v.task = { kind: "toImprove", nId: node.id }; return improveWork(s, v, dt, rate); }
    if (!site) return false;
    v.task = { kind: "toSite", bId: site.id };
  }
  if (v.task.kind === "toSite") {
    if (moveTo(v, site.x + 0.5, site.y + 0.5, dt)) v.task = { kind: "build", bId: site.id };
    return true;
  }
  if (site.built && site.upgradeTo) {
    // Mejora: el edificio sigue funcionando hasta que se termina.
    site.upgradeProgress = (site.upgradeProgress ?? 0) + dt * rate * s.animo;
    const to = BUILDING_BY_ID[site.upgradeTo];
    if (site.upgradeProgress >= to.buildTime * (1 - config.DESCUENTO_MEJORA)) {
      const from = BUILDING_BY_ID[site.type].name;
      site.type = site.upgradeTo;
      delete site.upgradeTo;
      delete site.upgradeProgress;
      log(s, `⬆️ Mejorado: ${from} → ${to.name}.`);
      v.task = { kind: "idle", t: 0 };
    }
    return true;
  }
  site.progress += dt * rate * s.animo;
  const def = BUILDING_BY_ID[site.type];
  if (site.progress >= def.buildTime) {
    site.built = true;
    log(s, def.staff?.by === "especialista"
      ? `Se terminó de construir: ${def.name}. Necesita un ${def.staff.title.toLowerCase()}: tócalo para asignarlo.`
      : `Se terminó de construir: ${def.name}.`);
    v.task = { kind: "idle", t: 0 };
  }
  return true;
}

/** Trabajar en un edificio con puestos: camina hasta él y produce en ciclos. */
function workAt(s: GameState, v: Villager, dt: number, b: Building) {
  const staff = BUILDING_BY_ID[b.type].staff;
  if (!staff) { v.task = { kind: "idle", t: 0 }; return; }
  if (v.task.kind !== "toBuilding" && v.task.kind !== "work") v.task = { kind: "toBuilding", bId: b.id };
  if (v.task.kind === "toBuilding") {
    if (moveTo(v, b.x + 0.5, b.y + 0.5, dt)) v.task = { kind: "work", bId: b.id, t: 0 };
    return;
  }
  if (v.task.kind !== "work") return;
  if (staff.inputs && !canAfford(s, staff.inputs)) return; // espera materiales
  v.task.t += dt * s.animo * workSpeed(s);
  if (v.task.t >= staff.cycle) {
    v.task.t = 0;
    if (staff.inputs) pay(s, staff.inputs);
    let bonus = stageOf(v) === "elder" ? staff.elderBonus ?? 1 : 1; // los ancianos chamanes rinden más
    if (b.type === "parcela" && has(s, "B09")) bonus *= config.BONO_ARADO * (hasNeighbor(s, b, "canal") ? config.BONO_CANAL : 1);
    bonus *= zoneEfficiency(b.zone);
    for (const [r, amt] of Object.entries(staff.outputs ?? {})) add(s, r as ResId, (amt ?? 0) * bonus);
  }
}

/**
 * Escuela: el niño camina hasta una escuela con lugar y se queda adentro (no se dibuja).
 * Mientras estudia, llegará a adulto antes (config.BONO_ESCUELA).
 */
function goToSchool(s: GameState, v: Villager, dt: number, occ: Map<number, number>): boolean {
  let school: Building | undefined;
  if (v.task.kind === "toBuilding" || v.task.kind === "work") {
    const id = v.task.bId;
    school = s.buildings.find((b) => b.id === id && b.built && BUILDING_BY_ID[b.type].school);
  }
  if (!school) {
    let bd = Infinity;
    for (const b of s.buildings) {
      const cap = b.built && b.zone === v.zone ? BUILDING_BY_ID[b.type].school ?? 0 : 0;
      if (!cap || (occ.get(b.id) ?? 0) >= cap) continue;
      const d = dist(v.x, v.y, b.x + 0.5, b.y + 0.5);
      if (d < bd) { bd = d; school = b; }
    }
    if (!school) return false;
    occ.set(school.id, (occ.get(school.id) ?? 0) + 1);
    v.task = { kind: "toBuilding", bId: school.id };
  }
  if (v.task.kind === "toBuilding") {
    if (moveTo(v, school.x + 0.5, school.y + 0.5, dt)) v.task = { kind: "work", bId: school.id, t: 0 };
    return true;
  }
  v.adultAge ??= config.EDAD_ADULTO * (1 - config.BONO_ESCUELA);
  return true;
}

/** ¿Un anciano puede trabajar en este edificio? (hoy: solo el Círculo, como chamán) */
export function elderCanWork(s: GameState, buildingId: number): boolean {
  const b = s.buildings.find((x) => x.id === buildingId);
  return !!b && !!BUILDING_BY_ID[b.type].staff?.elders;
}
