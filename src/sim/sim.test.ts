import { describe, expect, it } from "vitest";
import { config } from "../config";
import { BUILDINGS, MATERIALS, ROLES, TECH_INTRO } from "../content";
import { TECHS, TECH_BY_ID, techCost } from "../data/tree";
import {
  changeRoleCount, changeSpecialists, debugAddVillagers, demolish, debugToggleInfinite, place, setRole, study, tapBook, techStatus,
} from "./actions";
import { returnToJefatura, setSpecialtyFull, zipfTargets } from "./jefatura";
import { isTribeLost, pay, staffCount, stageOf } from "./economy";
import { simulateOffline } from "./save";
import { createState, type Building, type GameState } from "./state";
import { step } from "./step";

const run = (s: GameState, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) step(s, 0.1); };
const addBuilding = (s: GameState, type: string, x: number, y: number): Building => {
  const b = { id: s.nextId++, type, x, y, progress: 0, built: true };
  s.buildings.push(b);
  return b;
};

describe("contenido", () => {
  it("todo lo jugable apunta a tecnologías reales de las Eras 1–2", () => {
    for (const r of ROLES) expect(TECH_BY_ID[r.unlockedBy]?.era, r.id).toBeLessThanOrEqual(2);
    for (const m of MATERIALS) expect(TECH_BY_ID[m.tech]?.era, m.res).toBeLessThanOrEqual(2);
    for (const b of BUILDINGS) if (b.unlockedBy) expect(TECH_BY_ID[b.unlockedBy]?.era, b.id).toBeLessThanOrEqual(2);
  });

  it("cada tecnología de las Eras 1–2 tiene tarjeta de novedad", () => {
    for (const t of TECHS.filter((x) => x.era <= 2)) expect(TECH_INTRO[t.id], t.id).toBeTruthy();
  });

  it("los costos crecen de forma exponencial dentro de la era", () => {
    const era1 = TECHS.filter((t) => t.era === 1).sort((a, b) => a.order - b.order).map(techCost);
    for (let i = 1; i < era1.length; i++) expect(era1[i] / era1[i - 1]).toBeCloseTo(config.G, 1);
  });
});

describe("inicio", () => {
  it("empieza con 5 aldeanos, sin ancianos, y es determinista con la misma semilla", () => {
    const a = createState(42), b = createState(42);
    expect(a.villagers).toHaveLength(5);
    expect(a.villagers.some((v) => stageOf(v) === "elder")).toBe(false);
    expect(a.villagers.map((v) => v.name)).toEqual(b.villagers.map((v) => v.name));
  });

  it("tocar el Libro alcanza para estudiar Lenguaje, y aparece su tarjeta", () => {
    const s = createState(1);
    const cost = techCost(TECH_BY_ID.P01);
    for (let i = 0; i < cost; i++) tapBook(s);
    expect(study(s, "P01")).toBe(true);
    expect(s.introQueue).toEqual(["P01"]);
  });

  it("una tecnología con requisitos pendientes no se puede estudiar", () => {
    const s = createState(1);
    s.inv.comprension = 1e6;
    expect(techStatus(s, "P04")).toBe("legible"); // Fuego requiere Herramientas de piedra
    expect(study(s, "P04")).toBe(false);
  });
});

describe("categorías", () => {
  it("la gente de Comida junta comida", () => {
    const s = createState(7);
    s.techs.P01 = true;
    s.inv.comida = 5;
    changeRoleCount(s, "comida", 1);
    changeRoleCount(s, "comida", 1);
    run(s, 60);
    expect(s.inv.comida).toBeGreaterThan(5);
  });

  it("con Agricultura, la gente de Comida ocupa sola las parcelas", () => {
    const s = createState(8);
    s.techs.P01 = s.techs.P02 = s.techs.N01 = true;
    s.debug.infinite.comida = true;
    const p = addBuilding(s, "parcela", 3, 3);
    changeRoleCount(s, "comida", 1);
    changeRoleCount(s, "comida", 1);
    run(s, 20);
    expect(staffCount(s, p)).toBe(2);
  });

  it("la gente de Materiales junta el material que más falta", () => {
    const s = createState(9);
    s.techs.P01 = true;
    s.debug.infinite.comida = true;
    s.inv.ramas = 50; s.inv.piedra = 50; s.inv.fibras = 0;
    changeRoleCount(s, "materiales", 1);
    run(s, 30);
    expect(s.inv.fibras).toBeGreaterThan(0);
  });

  it("los especialistas se asignan desde su edificio", () => {
    const s = createState(10);
    s.techs.P01 = s.techs.P11 = true;
    const c = addBuilding(s, "circulo", 3, 3);
    expect(changeSpecialists(s, c.id, 1)).toBeNull();
    expect(staffCount(s, c)).toBe(1);
    expect(changeSpecialists(s, c.id, 1)).not.toBeNull(); // solo hay 1 puesto
    const before = s.inv.comprension;
    s.debug.infinite.comida = true;
    run(s, 20);
    expect(s.inv.comprension).toBeGreaterThan(before);
  });

  it("los planos se construyen", () => {
    const s = createState(3);
    s.techs.P01 = s.techs.P02 = s.techs.P06 = true;
    s.inv.ramas = 50; s.inv.fibras = 50; s.inv.comida = 60;
    expect(place(s, "choza", 3, 3)).toBeNull();
    run(s, 60);
    expect(s.buildings.find((b) => b.type === "choza")?.built).toBe(true);
  });

  it("demoler libera a los especialistas y devuelve la mitad; cancelar una obra devuelve todo", () => {
    const s = createState(13);
    s.techs.P01 = s.techs.P11 = true;
    const c = addBuilding(s, "circulo", 3, 3);
    changeSpecialists(s, c.id, 1);
    s.inv.piedra = 0;
    expect(demolish(s, c.id)).toBeNull();
    expect(s.buildings.includes(c)).toBe(false);
    expect(s.villagers.some((v) => v.workplace === c.id)).toBe(false);
    expect(s.inv.piedra).toBe(Math.floor(10 * config.DEVOLUCION_DEMOLER));

    s.inv.piedra = 20;
    expect(place(s, "circulo", 4, 4)).toBeNull();
    const obra = s.buildings[s.buildings.length - 1];
    demolish(s, obra.id);
    expect(s.inv.piedra).toBe(20);
    expect(demolish(s, s.buildings.find((b) => b.type === "pila")!.id)).not.toBeNull(); // la pila no se demuele
  });

  it("con ∞ los pagos no descuentan", () => {
    const s = createState(1);
    debugToggleInfinite(s, "piedra");
    expect(pay(s, { piedra: 999 })).toBe(true);
    expect(s.inv.piedra).toBe(0);
  });
});

describe("Jefatura", () => {
  const withJefatura = (seed: number, adults: number) => {
    const s = createState(seed);
    s.techs.P01 = s.techs.P06 = s.techs.N11 = true;
    s.debug.infinite.comida = true;
    debugAddVillagers(s, adults);
    return s;
  };

  it("Zipf: reparte por prioridad y no manda gente a donde no hay trabajo", () => {
    const s = withJefatura(20, 0);
    const t = zipfTargets(s, 6); // sin planos: Construcción no tiene trabajo
    expect(t.get("construccion")).toBe(0);
    expect((t.get("comida") ?? 0) + (t.get("materiales") ?? 0)).toBe(6);
    expect(t.get("comida")!).toBeGreaterThan(t.get("materiales")!);
  });

  it("asigna sola a los libres", () => {
    const s = withJefatura(21, 6);
    run(s, 20);
    const adults = s.villagers.filter((v) => stageOf(v) === "adult");
    expect(adults.every((v) => v.role !== null || v.workplace !== null)).toBe(true);
  });

  it("llena las especialidades que elige el jugador, no todas", () => {
    const s = withJefatura(22, 6);
    s.techs.P11 = true;
    const c = addBuilding(s, "circulo", 3, 3);
    run(s, 5);
    expect(staffCount(s, c)).toBe(0); // no se llena por defecto
    setSpecialtyFull(s, "circulo", true);
    run(s, 5);
    expect(staffCount(s, c)).toBe(1);
  });

  it("un aldeano con tarea manual queda fuera hasta que se lo devuelve", () => {
    const s = withJefatura(23, 6);
    const v = s.villagers.find((x) => stageOf(x) === "adult")!;
    setRole(s, v.id, "construccion");
    expect(v.manual).toBe(true);
    run(s, 10);
    expect(v.role).toBe("construccion"); // la Jefatura no lo toca, aunque no haya planos
    returnToJefatura(s, v.id);
    run(s, 15);
    expect(v.role).not.toBe("construccion");
  });

  it("los ancianos pueden ser chamanes, rinden más y la Jefatura los prefiere", () => {
    const s = withJefatura(25, 4);
    s.techs.P11 = true;
    const elder = s.villagers.find((v) => stageOf(v) === "adult")!;
    elder.age = elder.lifespan * 0.85; // anciano, pero vivo un buen rato
    const c = addBuilding(s, "circulo", 3, 3);
    // Un adulto ocupa el puesto a mano (antes de que la Jefatura actúe).
    const adult = s.villagers.find((v) => stageOf(v) === "adult" && v !== elder)!;
    adult.workplace = c.id;
    setSpecialtyFull(s, "circulo", true);
    run(s, 5);
    expect(elder.workplace).toBe(c.id); // la Jefatura lo cambió por el anciano
    expect(adult.workplace).toBeNull();

    // El anciano chamán produce ×1,5 frente a un adulto chamán.
    const measure = (who: "elder" | "adult") => {
      const t = createState(26);
      t.techs.P01 = t.techs.P11 = true;
      t.debug.infinite.comida = true;
      const circ = addBuilding(t, "circulo", 3, 3);
      const v = t.villagers.find((x) => stageOf(x) === "adult")!;
      if (who === "elder") v.age = v.lifespan * 0.85;
      v.workplace = circ.id;
      for (const x of t.villagers) if (x !== v) x.age = 5; // sin otros ancianos que sumen Comprensión
      run(t, 30);
      return t.inv.comprension;
    };
    expect(measure("elder") / measure("adult")).toBeGreaterThan(1.3);
  });

  it("sin herencia: los niños llegan a adultos libres", () => {
    const s = createState(24);
    s.techs.P01 = true;
    s.debug.infinite.comida = true;
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "comida";
    const child = s.villagers.find((v) => stageOf(v) === "child")!;
    run(s, (config.EDAD_ADULTO - child.age + 1) * config.TIEMPO_POR_AÑO);
    expect(stageOf(child)).toBe("adult");
    expect(child.role).toBeNull();
  });
});

describe("recursos resueltos", () => {
  it("la comida se resuelve con 4 parcelas llenas + granero, y se pierde si faltan", () => {
    const s = createState(4);
    s.techs.P01 = s.techs.P02 = s.techs.N01 = true;
    for (let i = 0; i < 4; i++) addBuilding(s, "parcela", i, 4);
    addBuilding(s, "granero", 4, 4);
    debugAddVillagers(s, 8);
    for (let i = 0; i < 8; i++) changeRoleCount(s, "comida", 1);
    run(s, 15);
    expect(s.resolved.comida).toBe(true);
    expect(pay(s, { comida: 999 })).toBe(true); // no se gasta

    for (let i = 0; i < 8; i++) changeRoleCount(s, "comida", -1);
    run(s, 1);
    expect(s.resolved.comida).toBe(false);
  });
});

describe("población", () => {
  it("con comida y espacio, la tribu crece", () => {
    const s = createState(11);
    s.debug.infinite.comida = true;
    for (let i = 0; i < 6; i++) addBuilding(s, "choza", i, 4);
    run(s, 300);
    expect(s.stats.births).toBeGreaterThan(0);
  });

  it("con un solo aldeano la tribu está perdida", () => {
    const s = createState(2);
    expect(isTribeLost(s)).toBe(false);
    s.villagers.splice(1);
    expect(isTribeLost(s)).toBe(true);
  });

  it("los aldeanos mueren al cumplir su esperanza de vida", () => {
    const s = createState(5);
    s.debug.infinite.comida = true;
    run(s, (config.ESPERANZA_VIDA + config.VARIACION_VIDA + 1) * config.TIEMPO_POR_AÑO);
    expect(s.stats.deaths).toBeGreaterThanOrEqual(5);
  });
});

describe("offline", () => {
  it("rinde según la eficiencia offline", () => {
    const s = createState(9);
    const sum = simulateOffline(s, 600);
    expect(sum.years).toBeCloseTo((600 * config.EFICIENCIA_OFFLINE) / config.TIEMPO_POR_AÑO, 5);
  });

  it("la Comprensión offline rinde mucho menos que jugando", () => {
    const mk = () => {
      const s = createState(12);
      s.techs.P01 = s.techs.P11 = true;
      s.debug.infinite.comida = true;
      const c = addBuilding(s, "circulo", 3, 3);
      changeSpecialists(s, c.id, 1);
      return s;
    };
    const online = mk();
    run(online, 60);
    const offline = mk();
    simulateOffline(offline, 60 / config.EFICIENCIA_OFFLINE); // mismo tiempo de juego simulado
    expect(offline.inv.comprension).toBeLessThan(online.inv.comprension * 0.5);
  });
});
