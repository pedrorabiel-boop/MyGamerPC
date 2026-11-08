import { config } from "../config";
import { BUILDING_BY_ID, JOB_BY_ID, NODE_DEFS, RES_BY_ID, RESOLUTIONS, type JobDef, type ResId } from "../content";
import { ERAS } from "../data/tree";
import { add, canAfford, countBuilt, has, housing, isResolutionMet, pay, stageOf, unlimited } from "./economy";
import { log, newVillager, rand, type Building, type GameState, type ResNode, type Villager } from "./state";

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
  if (has(s, "N11")) applyQuotas(s);
  const occ = occupancy(s);
  for (const v of s.villagers) updateVillager(s, v, dt, occ);
  elderComprension(s, dt);
  checkEras(s);
}

// ---------- mundo ----------

/** Un recurso queda resuelto mientras existan sus edificios y aldeanos asignados. */
function updateResolutions(s: GameState) {
  for (const def of RESOLUTIONS) {
    const met = isResolutionMet(s, def);
    if (met === !!s.resolved[def.res]) continue;
    s.resolved[def.res] = met;
    const name = RES_BY_ID[def.res].name;
    log(s, met
      ? `✅ ¡${name} resuelta! Mientras mantengas esta infraestructura, nunca va a faltar.`
      : `⚠️ ${name} dejó de estar resuelta: falta infraestructura o aldeanos asignados.`);
  }
}

function regenNodes(s: GameState, dt: number) {
  for (const n of s.nodes) {
    for (const [res, def] of Object.entries(NODE_DEFS[n.type].stocks)) {
      const r = res as ResId;
      n.stock[r] = Math.min(def!.max, (n.stock[r] ?? 0) + def!.regen * dt);
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
  a += Math.min(countBuilt(s, "pared"), 3) * (BUILDING_BY_ID.pared.animo ?? 0);
  if (has(s, "P10")) a += 0.05;
  if (s.villagers.length > housing(s)) a -= 0.2;
  if (s.inv.comida <= 0 && !unlimited(s, "comida")) a -= 0.3;
  s.animo = Math.max(0.4, Math.min(1.6, a));
}

function eat(s: GameState, dt: number) {
  add(s, "comida", -s.villagers.length * (config.COMIDA_POR_AÑO / config.TIEMPO_POR_AÑO) * dt);
}

function ageAndDie(s: GameState, dt: number) {
  const years = dt / config.TIEMPO_POR_AÑO;
  const hungry = s.inv.comida <= 0 && !unlimited(s, "comida");
  const healer = s.villagers.some((v) => v.job === "curandero" && v.task.kind === "work");
  const illness = config.MORTALIDAD_ENFERMEDAD * (healer ? 0.5 : 1) * (has(s, "P10") ? 0.8 : 1);
  const dead: Villager[] = [];
  for (const v of s.villagers) {
    v.age += years;
    if (!v.wasAdult && v.age >= config.EDAD_ADULTO) {
      v.wasAdult = true;
      if (has(s, "P01") && v.parentJob && jobUnlocked(s, v.parentJob)) v.job = v.parentJob;
    }
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
    const pila = s.buildings.find((b) => b.type === "pila")!;
    const baby = newVillager(s, 0, pila.x + 0.5 + (rand(s) - 0.5), pila.y + 0.5 + (rand(s) - 0.5), parent.job);
    add(s, "comida", -2);
    s.stats.births++;
    log(s, `Nació ${baby.name}, de la familia de ${parent.name}.`);
  }
}

function elderComprension(s: GameState, dt: number) {
  if (!has(s, "P01")) return;
  const elders = s.villagers.filter((v) => stageOf(v) === "elder").length;
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
  if (next.id >= 3) s.prototypeEnded = true;
}

// ---------- oficios y cuotas ----------

export function jobUnlocked(s: GameState, jobId: string) {
  const j = JOB_BY_ID[jobId];
  return !!j && has(s, j.unlockedBy);
}

export function applyQuotas(s: GameState) {
  for (const [jobId, quota] of Object.entries(s.quotas)) {
    if (!jobUnlocked(s, jobId)) continue;
    const holders = s.villagers.filter((v) => v.job === jobId && stageOf(v) === "adult");
    if (holders.length < quota) {
      const free = s.villagers.filter((v) => v.job === null && stageOf(v) === "adult");
      for (const v of free.slice(0, quota - holders.length)) v.job = jobId;
    } else if (holders.length > quota) {
      for (const v of holders.slice(quota)) { v.job = null; v.task = { kind: "idle", t: 0 }; }
    }
  }
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
    v.tx = Math.max(0.3, Math.min(s.w - 0.3, ax + (rand(s) * 2 - 1) * radius));
    v.ty = Math.max(0.3, Math.min(s.h - 0.3, ay + (rand(s) * 2 - 1) * radius));
    v.task.t = 2 + rand(s) * 3;
  }
  const d = dist(v.x, v.y, v.tx, v.ty);
  const stepLen = config.VELOCIDAD_CAMINAR * 0.5 * dt;
  if (d > stepLen) { v.x += ((v.tx - v.x) / d) * stepLen; v.y += ((v.ty - v.y) / d) * stepLen; }
}

function anchor(s: GameState): Building {
  return s.buildings.find((b) => b.built && b.type === "fogata") ?? s.buildings.find((b) => b.type === "pila")!;
}

function nearestStore(s: GameState, v: Villager): Building {
  let best: Building | null = null, bd = Infinity;
  for (const b of s.buildings) {
    if (!b.built || !BUILDING_BY_ID[b.type]?.storage) continue;
    const d = dist(v.x, v.y, b.x + 0.5, b.y + 0.5);
    if (d < bd) { bd = d; best = b; }
  }
  return best!;
}

function nearestNode(s: GameState, v: Villager, type: string, res: ResId): ResNode | null {
  let best: ResNode | null = null, bd = Infinity;
  for (const n of s.nodes) {
    if (n.type !== type || (n.stock[res] ?? 0) < 1) continue;
    const d = dist(v.x, v.y, n.x + 0.5, n.y + 0.5);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

function updateVillager(s: GameState, v: Villager, dt: number, occ: Map<number, number>) {
  const stage = stageOf(v);
  const a = anchor(s);
  if (stage === "child") return wander(s, v, dt, a.x + 0.5, a.y + 0.5, 1.5);
  if (stage === "elder") return wander(s, v, dt, a.x + 0.5, a.y + 0.5, 0.8);

  if (v.order) return gather(s, v, dt, v.order.res, null, v.order.nodeId);
  const job = v.job ? JOB_BY_ID[v.job] : null;
  if (!job || !jobUnlocked(s, job.id)) {
    // Sin oficio: ayuda a construir si hay obras; si no, deambula.
    if (buildWork(s, v, dt, config.FACTOR_AYUDA_CONSTRUCCION)) return;
    return wander(s, v, dt, a.x + 0.5, a.y + 0.5, 2);
  }
  if (job.kind === "gather") return gather(s, v, dt, job.res!, job, null);
  if (job.kind === "build") {
    if (!buildWork(s, v, dt, 1)) wander(s, v, dt, a.x + 0.5, a.y + 0.5, 2);
    return;
  }
  if (!work(s, v, dt, job, occ)) wander(s, v, dt, a.x + 0.5, a.y + 0.5, 2);
}

function gather(s: GameState, v: Villager, dt: number, res: ResId, job: JobDef | null, fixedNode: number | null) {
  if (v.carry) {
    const store = nearestStore(s, v);
    if (moveTo(v, store.x + 0.5, store.y + 0.5, dt)) {
      add(s, v.carry.res, v.carry.amt);
      v.carry = null;
      v.task = { kind: "idle", t: 0 };
      if (v.order) v.order = null;
    }
    return;
  }
  if (v.task.kind !== "toNode" && v.task.kind !== "gather") {
    const node = fixedNode != null ? s.nodes.find((n) => n.id === fixedNode) : nearestNode(s, v, job!.node!, res);
    if (!node || (node.stock[res] ?? 0) < 0.5) {
      if (v.order) v.order = null;
      return wander(s, v, dt, v.x, v.y, 1);
    }
    v.task = { kind: "toNode", nodeId: node.id, res };
  }
  const task = v.task;
  const node = s.nodes.find((n) => n.id === task.nodeId);
  if (!node) { v.task = { kind: "idle", t: 0 }; return; }
  if (task.kind === "toNode") {
    if (moveTo(v, node.x + 0.5, node.y + 0.5, dt)) v.task = { kind: "gather", nodeId: node.id, res, t: 0 };
    return;
  }
  // gather
  const speed = (has(s, "P02") ? config.BONO_HERRAMIENTAS : 1) * s.animo;
  task.t += dt * speed;
  if (task.t >= config.TIEMPO_RECOLECTAR) {
    const capacity = config.CARGA_BASE * (has(s, "P08") ? config.BONO_CESTA : 1);
    const take = Math.min(node.stock[res] ?? 0, capacity);
    node.stock[res] = (node.stock[res] ?? 0) - take;
    v.carry = { res, amt: take };
    if (job?.bonus) {
      const extra = Math.min(node.stock[job.bonus.res] ?? 0, job.bonus.amt);
      node.stock[job.bonus.res] = (node.stock[job.bonus.res] ?? 0) - extra;
      add(s, job.bonus.res, extra);
    }
    v.task = { kind: "idle", t: 0 };
  }
}

function buildWork(s: GameState, v: Villager, dt: number, rate: number): boolean {
  let site: Building | undefined;
  if (v.task.kind === "toSite" || v.task.kind === "build") {
    const id = v.task.bId;
    site = s.buildings.find((b) => b.id === id && !b.built);
  }
  if (!site) {
    let bd = Infinity;
    for (const b of s.buildings) {
      if (b.built) continue;
      const d = dist(v.x, v.y, b.x + 0.5, b.y + 0.5);
      if (d < bd) { bd = d; site = b; }
    }
    if (!site) return false;
    v.task = { kind: "toSite", bId: site.id };
  }
  if (v.task.kind === "toSite") {
    if (moveTo(v, site.x + 0.5, site.y + 0.5, dt)) v.task = { kind: "build", bId: site.id };
    return true;
  }
  site.progress += dt * rate * s.animo;
  const def = BUILDING_BY_ID[site.type];
  if (site.progress >= def.buildTime) {
    site.built = true;
    log(s, `Se terminó de construir: ${def.name}.`);
    v.task = { kind: "idle", t: 0 };
  }
  return true;
}

function work(s: GameState, v: Villager, dt: number, job: JobDef, occ: Map<number, number>): boolean {
  let b: Building | undefined;
  if (v.task.kind === "toBuilding" || v.task.kind === "work") {
    const id = v.task.bId;
    b = s.buildings.find((x) => x.id === id && x.built && x.type === job.building);
  }
  if (!b) {
    const slots = BUILDING_BY_ID[job.building!].slots ?? 1;
    let bd = Infinity;
    for (const x of s.buildings) {
      if (!x.built || x.type !== job.building || (occ.get(x.id) ?? 0) >= slots) continue;
      const d = dist(v.x, v.y, x.x + 0.5, x.y + 0.5);
      if (d < bd) { bd = d; b = x; }
    }
    if (!b) return false;
    occ.set(b.id, (occ.get(b.id) ?? 0) + 1);
    v.task = { kind: "toBuilding", bId: b.id };
  }
  if (v.task.kind === "toBuilding") {
    if (moveTo(v, b.x + 0.5, b.y + 0.5, dt)) v.task = { kind: "work", bId: b.id, t: 0 };
    return true;
  }
  if (v.task.kind !== "work") return true;
  if (job.inputs && !canAfford(s, job.inputs)) return true; // espera materiales
  v.task.t += dt * s.animo;
  if (v.task.t >= (job.cycle ?? 1)) {
    v.task.t = 0;
    if (job.inputs) pay(s, job.inputs);
    for (const [r, amt] of Object.entries(job.outputs ?? {})) add(s, r as ResId, amt ?? 0);
  }
  return true;
}
