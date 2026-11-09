// Contenido jugable del prototipo (Eras 1 y 2): recursos, nodos del mapa, categorías,
// edificios y tarjetas de novedad. El árbol (qué tecnología existe y qué requiere) viene de
// data/tech-tree.json; aquí se define qué HACE cada cosa en la simulación.

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

// ---------- Categorías de oficio ----------
// Los aldeanos se asignan a una categoría; las tecnologías mejoran CÓMO trabaja cada una.

export type Role = "comida" | "materiales" | "construccion";

export const ROLES: { id: Role; name: string; icon: string; color: number; unlockedBy: string; desc: string }[] = [
  { id: "comida", name: "Comida", icon: "🍖", color: 0xd94f70, unlockedBy: "P01", desc: "Consiguen comida con el mejor método que conozca la tribu." },
  { id: "materiales", name: "Materiales", icon: "🧱", color: 0xb08850, unlockedBy: "P01", desc: "Juntan el material que más falta." },
  { id: "construccion", name: "Construcción", icon: "🔨", color: 0xf0a030, unlockedBy: "P06", desc: "Levantan los planos mucho más rápido que cualquiera." },
];
export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<Role, (typeof ROLES)[number]>;
export const SPECIALIST_COLOR = 0x9b6bd0;

/** Métodos de recolección de la categoría Comida, del mejor al peor. */
export const FOOD_GATHER: { node: NodeType; tech: string; label: string; carryMult: number; bonus?: { res: ResId; amt: number } }[] = [
  { node: "manada", tech: "P05", label: "cazando", carryMult: 1.5, bonus: { res: "pieles", amt: 0.5 } },
  { node: "arbusto", tech: "P01", label: "recolectando bayas", carryMult: 1 },
];

/** Materiales que junta la categoría Materiales (elige el que más falta). */
export const MATERIALS: { res: ResId; node: NodeType; tech: string }[] = [
  { res: "ramas", node: "arbol", tech: "P01" },
  { res: "piedra", node: "roca", tech: "P01" },
  { res: "fibras", node: "pasto", tech: "P01" },
  { res: "madera", node: "arbol", tech: "P02" },
  { res: "pigmento", node: "roca", tech: "P11" },
  { res: "arcilla", node: "arcilla", tech: "N03" },
];

// ---------- Edificios ----------

export interface StaffDef {
  slots: number;
  by: "comida" | "especialista"; // quién ocupa los puestos
  title: string; // nombre del puesto
  icon: string;
  cycle: number; // segundos por ciclo de trabajo
  inputs?: Cost;
  outputs?: Cost;
  elders?: boolean; // los ancianos pueden ocupar el puesto
  elderBonus?: number; // multiplicador de producción si lo ocupa un anciano
}

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  unlockedBy: string | null; // null = no se puede construir (viene puesto)
  cost: Cost;
  buildTime: number; // segundos de trabajo de un constructor
  place: "pasto" | "orilla";
  staff?: StaffDef;
  housing?: number;
  storage?: boolean; // punto de entrega de los recolectores
  passive?: { res: ResId; rate: number }; // producción sin trabajadores, por segundo
  animo?: number;
  desc: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: "pila", name: "Pila", icon: "📦", color: 0x6b5a40, unlockedBy: null, cost: {}, buildTime: 0, place: "pasto", storage: true, desc: "Donde la tribu deja lo que recolecta." },
  { id: "fogata", name: "Fogata", icon: "🔥", color: 0x7a3b1a, unlockedBy: "P04", cost: { ramas: 5, piedra: 3 }, buildTime: 5, place: "pasto", animo: 0.1, desc: "Ánimo ↑ y natalidad ↑. Los ancianos se juntan alrededor." },
  { id: "choza", name: "Choza de ramas", icon: "🛖", color: 0x7a6a3a, unlockedBy: "P06", cost: { ramas: 10, fibras: 5 }, buildTime: 8, place: "pasto", housing: 3, desc: "+3 de capacidad de población." },
  { id: "trampa", name: "Trampa", icon: "🪤", color: 0x5a4a2a, unlockedBy: "P05", cost: { ramas: 3, fibras: 2 }, buildTime: 4, place: "pasto", passive: { res: "comida", rate: 0.06 }, desc: "Produce comida de a poco, sin que nadie la atienda." },
  { id: "pared", name: "Pared pintada", icon: "🖼️", color: 0x6a4a6a, unlockedBy: "P11", cost: { piedra: 5, pigmento: 3 }, buildTime: 6, place: "pasto", animo: 0.05, desc: "Ánimo ↑. El primer RGB de la historia." },
  { id: "circulo", name: "Círculo de piedras", icon: "🗿", color: 0x5a5a6a, unlockedBy: "P11", cost: { piedra: 10 }, buildTime: 8, place: "pasto", desc: "El chamán genera mucha Comprensión. Los ancianos son los mejores chamanes (×1,5).",
    staff: { slots: 1, by: "especialista", title: "Chamán", icon: "🔮", cycle: 2.5, outputs: { comprension: 10 }, elders: true, elderBonus: 1.5 } },
  { id: "parcela", name: "Parcela", icon: "🌾", color: 0x8a7a30, unlockedBy: "N01", cost: { madera: 4, fibras: 2 }, buildTime: 5, place: "pasto", desc: "La gente de Comida la trabaja sola. Rompe el techo de la naturaleza.",
    staff: { slots: 2, by: "comida", title: "Agricultor", icon: "🌾", cycle: 2.5, outputs: { comida: 1 } } },
  { id: "granero", name: "Granero", icon: "🏚️", color: 0x7a5a3a, unlockedBy: "N01", cost: { madera: 15, piedra: 8 }, buildTime: 12, place: "pasto", storage: true, desc: "Más almacenamiento. También sirve de punto de entrega." },
  { id: "corral", name: "Corral", icon: "🐐", color: 0x7a6a50, unlockedBy: "N02", cost: { madera: 8, ramas: 4 }, buildTime: 8, place: "pasto", desc: "El pastor produce comida y lana.",
    staff: { slots: 1, by: "especialista", title: "Pastor", icon: "🐐", cycle: 5, outputs: { comida: 0.75, lana: 0.5 } } },
  { id: "telar", name: "Telar manual", icon: "🪡", color: 0x8a5a7a, unlockedBy: "N02", cost: { madera: 6, fibras: 6 }, buildTime: 8, place: "pasto", desc: "El tejedor convierte lana en tela.",
    staff: { slots: 1, by: "especialista", title: "Tejedor", icon: "🧶", cycle: 4, inputs: { lana: 1 }, outputs: { tela: 1 } } },
  { id: "horno", name: "Horno de barro", icon: "🏺", color: 0x8a4a2a, unlockedBy: "N03", cost: { arcilla: 8, piedra: 5 }, buildTime: 8, place: "pasto", desc: "El alfarero convierte arcilla y ramas en cerámica.",
    staff: { slots: 1, by: "especialista", title: "Alfarero", icon: "🏺", cycle: 4, inputs: { arcilla: 1, ramas: 1 }, outputs: { ceramica: 1 } } },
  { id: "adobe", name: "Casa de adobe", icon: "🏠", color: 0x9a6a4a, unlockedBy: "N03", cost: { arcilla: 12, madera: 4 }, buildTime: 12, place: "pasto", housing: 6, desc: "+6 de capacidad de población." },
  { id: "muelle", name: "Muelle", icon: "⛵", color: 0x4a6a8a, unlockedBy: "N10", cost: { madera: 8 }, buildTime: 8, place: "orilla", desc: "La gente de Comida pesca aquí. Va en la orilla del río.",
    staff: { slots: 2, by: "comida", title: "Pescador", icon: "🎣", cycle: 3, outputs: { comida: 1 } } },
  { id: "huerto", name: "Huerto medicinal", icon: "🌱", color: 0x3a7a4a, unlockedBy: "N11", cost: { madera: 4, fibras: 4 }, buildTime: 6, place: "pasto", desc: "Con un curandero trabajando, las enfermedades matan menos.",
    staff: { slots: 1, by: "especialista", title: "Curandero", icon: "🌱", cycle: 5 } },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, BuildingDef>;

// ---------- Recursos resueltos (autosuficiencia) ----------
// Mientras existan los edificios y estén ocupados sus puestos, el recurso deja de tener
// cantidad: se muestra "resuelto" y nunca falta. Es el nivel máximo de un recurso básico.

export interface ResolutionDef {
  res: ResId;
  tech: string;
  buildings: Record<string, number>; // edificio → cantidad mínima construida
  staffed: Record<string, number>; // edificio → puestos ocupados en total
}

export const RESOLUTIONS: ResolutionDef[] = [
  // Prototipo: en el diseño final la comida se resuelve en la Era 3 (Arado + Irrigación).
  { res: "comida", tech: "N01", buildings: { parcela: 4, granero: 1 }, staffed: { parcela: 8 } },
];

// ---------- Tarjetas de novedad (al estudiar una tecnología) ----------

export const TECH_INTRO: Record<string, string[]> = {
  P01: [
    "Aparecen las categorías 🍖 Comida y 🧱 Materiales: ve a 👥 Aldeanos y asigna gente con +.",
    "Cada aldeano repite su trabajo solo, ya no hace falta señalar.",
    "Los ancianos empiezan a generar 💡 Comprensión.",
    "Los niños llegan a adultos libres: asígnalos tú (hasta que exista la Jefatura).",
  ],
  P02: [
    "Todos recolectan más rápido y cargan el doble por viaje.",
    "La gente de 🧱 Materiales ahora también junta 🪵 madera.",
  ],
  P04: [
    "Puedes construir la 🔥 Fogata (pestaña 🔨 Construir).",
    "Sube el Ánimo y nacen más niños. Los ancianos se juntan alrededor.",
  ],
  P05: [
    "La gente de 🍖 Comida ahora caza en la manada: trae más comida y 🐾 pieles.",
    "Puedes construir 🪤 Trampas: dan comida solas, sin nadie.",
    "Abrigo de pieles: mueren menos y sube el Ánimo.",
  ],
  P06: [
    "Puedes construir 🛖 Chozas: +3 de capacidad de población.",
    "Aparece la categoría 🔨 Construcción: levantan los planos mucho más rápido.",
  ],
  P11: [
    "Puedes construir la 🖼️ Pared pintada (Ánimo ↑) y el 🗿 Círculo de piedras.",
    "El Círculo necesita un 🔮 chamán: tócalo en el mapa y asígnale a alguien. Da mucha 💡 Comprensión.",
    "Los 🧓 ancianos también pueden ser chamanes, y son los mejores (×1,5).",
    "La gente de 🧱 Materiales ahora junta 🎨 pigmento.",
  ],
  N01: [
    "Puedes construir 🌾 Parcelas: la gente de 🍖 Comida las trabaja sola y deja de depender de la naturaleza.",
    "Puedes construir el 🏚️ Granero: más almacenamiento.",
    "Meta: con 4 parcelas llenas (8 personas) y un granero, la comida queda ✅ resuelta.",
  ],
  N02: [
    "Puedes construir el 🐐 Corral: un pastor produce comida y 🐑 lana.",
    "Y el 🪡 Telar: un tejedor convierte lana en 🧶 tela.",
    "Los dos necesitan un especialista: tócalos en el mapa para asignarlo.",
  ],
  N03: [
    "Vasijas: el almacenamiento sube.",
    "La gente de 🧱 Materiales junta 🟫 arcilla en la orilla del río.",
    "Puedes construir el 🏺 Horno (necesita un alfarero) y la 🏠 Casa de adobe (+6 de capacidad).",
  ],
  N09: [
    "Ahora ves números exactos en vez de «pocos» o «muchos».",
    "La tradición oral protegerá la maestría cuando exista (todavía no en el prototipo).",
  ],
  N10: [
    "Puedes construir el ⛵ Muelle en la orilla: la gente de 🍖 Comida pesca ahí.",
    "La Cueva y la Costa ya se pueden explorar… en una versión futura del prototipo.",
  ],
  N11: [
    "¡Jefatura! Ahora la tribu se reparte sola: en 👥 Aldeanos eliges qué especialidades llenar y el orden de prioridad de las categorías.",
    "Si le das una tarea a mano a un aldeano, queda fuera de la Jefatura hasta que lo devuelvas.",
    "Puedes construir el 🌱 Huerto medicinal: con un curandero, mueren menos por enfermedad.",
  ],
};

export const VILLAGER_NAMES = [
  "Ug", "Grok", "Mamba", "Tuk", "Ola", "Brum", "Kira", "Zog", "Nana", "Pum", "Gonzalo", "Rocco",
  "Tita", "Bam", "Ika", "Dodo", "Mura", "Pek", "Lalo", "Sisa", "Torvo", "Ñaco", "Uma", "Krak",
  "Bebo", "Fifa", "Gorgo", "Pipa", "Rula", "Tano", "Yaya", "Zuri", "Moco", "Chumi", "Dante", "Kuka",
];
