// Contenido jugable del prototipo (Eras 1 y 2): recursos, nodos del mapa, oficios y edificios.
// El árbol (qué tecnología existe y qué requiere) viene de data/tech-tree.json;
// aquí se define qué HACE cada cosa en la simulación.

export type ResId =
  | "comida" | "ramas" | "piedra" | "fibras" | "madera" | "pieles" | "pigmento"
  | "arcilla" | "ceramica" | "lana" | "tela" | "comprension";

export type Cost = Partial<Record<ResId, number>>;

export const RESOURCES: { id: ResId; name: string; icon: string }[] = [
  { id: "comprension", name: "Comprensión", icon: "💡" },
  { id: "comida", name: "Comida", icon: "🍖" },
  { id: "ramas", name: "Ramas", icon: "🌿" },
  { id: "piedra", name: "Piedra", icon: "🪨" },
  { id: "fibras", name: "Fibras", icon: "🧵" },
  { id: "madera", name: "Madera", icon: "🪵" },
  { id: "pieles", name: "Pieles", icon: "🐾" },
  { id: "pigmento", name: "Pigmento", icon: "🎨" },
  { id: "arcilla", name: "Arcilla", icon: "🟫" },
  { id: "ceramica", name: "Cerámica", icon: "🏺" },
  { id: "lana", name: "Lana", icon: "🐑" },
  { id: "tela", name: "Tela", icon: "🧶" },
];
export const RES_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r])) as Record<ResId, (typeof RESOURCES)[number]>;

// ---------- Nodos de recursos silvestres (con techo natural: se agotan y regeneran) ----------

export type NodeType = "arbusto" | "arbol" | "roca" | "pasto" | "arcilla" | "manada";

export const NODE_DEFS: Record<NodeType, { name: string; color: number; stocks: Partial<Record<ResId, { max: number; regen: number }>> }> = {
  arbusto: { name: "Arbusto de bayas", color: 0x4f9a3c, stocks: { comida: { max: 8, regen: 0.1 } } },
  arbol: { name: "Árbol", color: 0x2f6b2a, stocks: { ramas: { max: 10, regen: 0.08 }, madera: { max: 12, regen: 0.03 } } },
  roca: { name: "Rocas", color: 0x8a8a8a, stocks: { piedra: { max: 20, regen: 0.02 }, pigmento: { max: 5, regen: 0.01 } } },
  pasto: { name: "Pasto alto", color: 0x9cc25a, stocks: { fibras: { max: 8, regen: 0.06 } } },
  arcilla: { name: "Arcilla", color: 0xa0704a, stocks: { arcilla: { max: 15, regen: 0.05 } } },
  manada: { name: "Manada", color: 0x8b5a2b, stocks: { comida: { max: 20, regen: 0.15 }, pieles: { max: 6, regen: 0.02 } } },
};

// ---------- Oficios ----------

export interface JobDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  unlockedBy: string; // tecnología que lo desbloquea
  kind: "gather" | "work" | "build";
  node?: NodeType; // gather
  res?: ResId; // gather
  bonus?: { res: ResId; amt: number }; // gather: recurso extra por viaje
  building?: string; // work
  cycle?: number; // work: segundos por ciclo
  inputs?: Cost; // work
  outputs?: Cost; // work
}

export const JOBS: JobDef[] = [
  { id: "recolector", name: "Recolector de bayas", icon: "🫐", color: 0xd94f70, unlockedBy: "P01", kind: "gather", node: "arbusto", res: "comida" },
  { id: "ramero", name: "Recolector de ramas", icon: "🌿", color: 0x6fae4a, unlockedBy: "P01", kind: "gather", node: "arbol", res: "ramas" },
  { id: "pedrero", name: "Recolector de piedras", icon: "🪨", color: 0xb0b0b0, unlockedBy: "P01", kind: "gather", node: "roca", res: "piedra" },
  { id: "fibrero", name: "Recolector de fibras", icon: "🧵", color: 0xe0d070, unlockedBy: "P01", kind: "gather", node: "pasto", res: "fibras" },
  { id: "constructor", name: "Constructor", icon: "🔨", color: 0xf0a030, unlockedBy: "P06", kind: "build" },
  { id: "cazador", name: "Cazador", icon: "🏹", color: 0xa0522d, unlockedBy: "P05", kind: "gather", node: "manada", res: "comida", bonus: { res: "pieles", amt: 0.5 } },
  { id: "lenador", name: "Leñador", icon: "🪓", color: 0x8b6b3a, unlockedBy: "P07", kind: "gather", node: "arbol", res: "madera" },
  { id: "pigmentero", name: "Recolector de pigmento", icon: "🎨", color: 0xc0504d, unlockedBy: "P11", kind: "gather", node: "roca", res: "pigmento" },
  { id: "chaman", name: "Chamán", icon: "🔮", color: 0x9b6bd0, unlockedBy: "P12", kind: "work", building: "circulo", cycle: 2.5, outputs: { comprension: 10 } },
  { id: "agricultor", name: "Agricultor", icon: "🌾", color: 0xe8c547, unlockedBy: "N01", kind: "work", building: "parcela", cycle: 2.5, outputs: { comida: 1 } },
  { id: "pastor", name: "Pastor", icon: "🐐", color: 0xd8d8c0, unlockedBy: "N02", kind: "work", building: "corral", cycle: 5, outputs: { comida: 0.75, lana: 0.5 } },
  { id: "arcillero", name: "Recolector de arcilla", icon: "🟫", color: 0xa0704a, unlockedBy: "N03", kind: "gather", node: "arcilla", res: "arcilla" },
  { id: "alfarero", name: "Alfarero", icon: "🏺", color: 0xc87941, unlockedBy: "N03", kind: "work", building: "horno", cycle: 4, inputs: { arcilla: 1, ramas: 1 }, outputs: { ceramica: 1 } },
  { id: "tejedor", name: "Tejedor", icon: "🧶", color: 0xe07ab0, unlockedBy: "N05", kind: "work", building: "telar", cycle: 4, inputs: { lana: 1 }, outputs: { tela: 1 } },
  { id: "curandero", name: "Curandero", icon: "🌱", color: 0x70c070, unlockedBy: "N08", kind: "work", building: "huerto", cycle: 5 },
  { id: "pescador", name: "Pescador", icon: "🎣", color: 0x4a90d0, unlockedBy: "N10", kind: "work", building: "muelle", cycle: 3, outputs: { comida: 1 } },
];
export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j])) as Record<string, JobDef>;

// ---------- Edificios ----------

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  unlockedBy: string | null; // null = no se puede construir (viene puesto)
  cost: Cost;
  buildTime: number; // segundos de trabajo de un constructor
  place: "pasto" | "orilla";
  slots?: number; // trabajadores
  housing?: number;
  storage?: boolean; // punto de entrega de recolectores
  passive?: { res: ResId; rate: number }; // producción sin trabajadores, por segundo
  animo?: number;
  desc: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: "pila", name: "Pila", icon: "📦", color: 0x6b5a40, unlockedBy: null, cost: {}, buildTime: 0, place: "pasto", storage: true, desc: "Donde la tribu deja lo que recolecta." },
  { id: "fogata", name: "Fogata", icon: "🔥", color: 0x7a3b1a, unlockedBy: "P04", cost: { ramas: 5, piedra: 3 }, buildTime: 5, place: "pasto", animo: 0.1, desc: "Ánimo ↑ y natalidad ↑. Los ancianos se juntan alrededor." },
  { id: "choza", name: "Choza de ramas", icon: "🛖", color: 0x7a6a3a, unlockedBy: "P06", cost: { ramas: 10, fibras: 5 }, buildTime: 8, place: "pasto", housing: 3, desc: "+3 de capacidad de población." },
  { id: "trampa", name: "Trampa", icon: "🪤", color: 0x5a4a2a, unlockedBy: "P09", cost: { ramas: 3, fibras: 2 }, buildTime: 4, place: "pasto", passive: { res: "comida", rate: 0.06 }, desc: "Produce comida de a poco, sin que nadie la atienda." },
  { id: "pared", name: "Pared pintada", icon: "🖼️", color: 0x6a4a6a, unlockedBy: "P11", cost: { piedra: 5, pigmento: 3 }, buildTime: 6, place: "pasto", animo: 0.05, desc: "Ánimo ↑. El primer RGB de la historia." },
  { id: "circulo", name: "Círculo de piedras", icon: "🗿", color: 0x5a5a6a, unlockedBy: "P12", cost: { piedra: 10 }, buildTime: 8, place: "pasto", slots: 1, desc: "Aquí trabaja el chamán (Comprensión)." },
  { id: "parcela", name: "Parcela", icon: "🌾", color: 0x8a7a30, unlockedBy: "N01", cost: { madera: 4, fibras: 2 }, buildTime: 5, place: "pasto", slots: 2, desc: "Los agricultores producen comida: rompe el techo natural." },
  { id: "corral", name: "Corral", icon: "🐐", color: 0x7a6a50, unlockedBy: "N02", cost: { madera: 8, ramas: 4 }, buildTime: 8, place: "pasto", slots: 1, desc: "El pastor produce comida y lana." },
  { id: "horno", name: "Horno de barro", icon: "🏺", color: 0x8a4a2a, unlockedBy: "N03", cost: { arcilla: 8, piedra: 5 }, buildTime: 8, place: "pasto", slots: 1, desc: "Arcilla + ramas → cerámica." },
  { id: "telar", name: "Telar manual", icon: "🪡", color: 0x8a5a7a, unlockedBy: "N05", cost: { madera: 6, fibras: 6 }, buildTime: 8, place: "pasto", slots: 1, desc: "Lana → tela." },
  { id: "adobe", name: "Casa de adobe", icon: "🏠", color: 0x9a6a4a, unlockedBy: "N06", cost: { arcilla: 12, madera: 4 }, buildTime: 12, place: "pasto", housing: 6, desc: "+6 de capacidad de población." },
  { id: "granero", name: "Granero", icon: "🏚️", color: 0x7a5a3a, unlockedBy: "N07", cost: { madera: 15, arcilla: 8 }, buildTime: 12, place: "pasto", storage: true, desc: "Más almacenamiento. También sirve de punto de entrega." },
  { id: "huerto", name: "Huerto medicinal", icon: "🌱", color: 0x3a7a4a, unlockedBy: "N08", cost: { madera: 4, fibras: 4 }, buildTime: 6, place: "pasto", slots: 1, desc: "Con un curandero trabajando, las enfermedades matan menos." },
  { id: "muelle", name: "Muelle", icon: "⛵", color: 0x4a6a8a, unlockedBy: "N10", cost: { madera: 8 }, buildTime: 8, place: "orilla", slots: 2, desc: "Los pescadores producen comida. Va en la orilla del río." },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, BuildingDef>;

// ---------- Recursos resueltos (autosuficiencia) ----------
// Mientras existan los edificios y estén asignados los aldeanos, el recurso deja de tener
// cantidad: se muestra "resuelto" y nunca falta. Es el nivel máximo de un recurso básico.
// Ver docs/01-arbol-tecnologico.md, "Recursos resueltos".

export interface ResolutionDef {
  res: ResId;
  tech: string; // tecnología necesaria
  buildings: Record<string, number>; // edificio → cantidad mínima construida
  workers: Record<string, number>; // oficio → aldeanos adultos asignados
}

export const RESOLUTIONS: ResolutionDef[] = [
  // Prototipo: en el diseño final la comida se resuelve en la Era 3 (Arado + Irrigación).
  { res: "comida", tech: "N07", buildings: { parcela: 4, granero: 1 }, workers: { agricultor: 8 } },
];

// Mensajes al desbloquear tecnologías con efectos especiales.
export const UNLOCK_MESSAGES: Record<string, string> = {
  P01: "¡Lenguaje! Ahora existen los oficios: asigna aldeanos en la pestaña Aldeanos.",
  P02: "Herramientas de piedra: todos recolectan más rápido.",
  P08: "Cestas: los recolectores cargan el doble por viaje.",
  P10: "Abrigo de pieles: mortalidad ↓ y Ánimo ↑.",
  N03: "Vasijas: el almacenamiento sube.",
  N04: "Tradición oral (la maestría aún no existe en el prototipo).",
  N09: "¡Conteo! Ahora ves números exactos.",
  N11: "Jefatura: la tribu mantiene sola las cuotas de cada oficio.",
  N12: "Antorcha: la Cueva ya se puede explorar… en una versión futura del prototipo.",
};

export const VILLAGER_NAMES = [
  "Ug", "Grok", "Mamba", "Tuk", "Ola", "Brum", "Kira", "Zog", "Nana", "Pum", "Gonzalo", "Rocco",
  "Tita", "Bam", "Ika", "Dodo", "Mura", "Pek", "Lalo", "Sisa", "Torvo", "Ñaco", "Uma", "Krak",
  "Bebo", "Fifa", "Gorgo", "Pipa", "Rula", "Tano", "Yaya", "Zuri", "Moco", "Chumi", "Dante", "Kuka",
];
