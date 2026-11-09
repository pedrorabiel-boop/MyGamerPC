import { describe, expect, it } from "vitest";
import { config } from "../config";
import { BUILDINGS, MATERIALS, ROLES, TECH_INTRO } from "../content";
import { TECHS, TECH_BY_ID, techCost } from "../data/tree";
import {
  changeRoleCount, changeSpecialists, debugAddVillagers, demolish, debugToggleInfinite, place, setRole, study, tapBook, techStatus,
  transferVillager,
} from "./actions";
import { movePriority, returnToJefatura, setSpecialtyFull, specialtyShortZones, zipfTargets } from "./jefatura";
import { isTribeLost, pay, staffCount, stageOf } from "./economy";
import { parseSave, simulateOffline } from "./save";
import { createState, type Building, type GameState } from "./state";
import { step } from "./step";

const run = (s: GameState, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) step(s, 0.1); };
const addBuilding = (s: GameState, type: string, x: number, y: number): Building => {
  const b: Building = { id: s.nextId++, type, zone: "valle", x, y, progress: 0, built: true };
  s.buildings.push(b);
  return b;
};

describe("contenido", () => {
  it("todo lo jugable apunta a tecnologías reales de las Eras 1–2", () => {
    for (const r of ROLES) expect(TECH_BY_ID[r.unlockedBy]?.era, r.id).toBeLessThanOrEqual(3);
    for (const m of MATERIALS) expect(TECH_BY_ID[m.tech]?.era, m.res).toBeLessThanOrEqual(3);
    for (const b of BUILDINGS) if (b.unlockedBy) expect(TECH_BY_ID[b.unlockedBy]?.era, b.id).toBeLessThanOrEqual(3);
  });

  it("cada tecnología de las Eras 1–2 tiene tarjeta de novedad", () => {
    for (const t of TECHS.filter((x) => x.era <= 3)) expect(TECH_INTRO[t.id], t.id).toBeTruthy();
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

  it("con una obra pendiente, al menos una persona construye aunque haya poca gente", () => {
    const s = withJefatura(27, 0);
    s.inv.ramas = 50; s.inv.fibras = 50;
    expect(place(s, "choza", 3, 3)).toBeNull();
    const t = zipfTargets(s, 1);
    expect(t.get("construccion")).toBe(1);
  });

  it("cada zona tiene sus propias prioridades", () => {
    const s = withJefatura(28, 0);
    s.techs.N10 = s.techs.P11 = true;
    movePriority(s, "materiales", -1, "valle"); // en el Valle, Materiales pasa a ser la 1.ª
    expect(s.jefatura.priorities.valle[0]).toBe("materiales");
    expect(s.jefatura.priorities.cueva[0]).toBe("materiales"); // la Cueva tiene su propio orden
    movePriority(s, "construccion", -1, "cueva");
    expect(s.jefatura.priorities.cueva[0]).toBe("construccion");
    expect(s.jefatura.priorities.valle).toEqual(["materiales", "comida", "construccion"]);
  });

  it("una partida con prioridades globales las pasa al Valle", () => {
    const s = createState(29);
    const old = JSON.parse(JSON.stringify(s));
    old.jefatura.priorities = ["construccion", "comida", "materiales"];
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.jefatura.priorities.valle).toEqual(["construccion", "comida", "materiales"]);
    expect(loaded.jefatura.priorities.cueva[0]).toBe("materiales");
  });

  it("las especialidades se llenan solo con gente de la misma zona", () => {
    const s = withJefatura(30, 6);
    s.techs.P02 = s.techs.N10 = s.techs.B01 = true;
    const veta = s.nodes.find((n) => n.zone === "cueva" && n.type === "veta")!;
    const mina = { id: s.nextId++, type: "mina", zone: "cueva" as const, x: veta.x, y: veta.y, progress: 0, built: true };
    s.buildings.push(mina);
    setSpecialtyFull(s, "mina", true);
    run(s, 10);
    expect(staffCount(s, mina)).toBe(0); // nadie en la Cueva: no se trae a nadie del Valle
    expect(specialtyShortZones(s, "mina")).toEqual(["cueva"]);
    transferVillager(s, "valle", "cueva");
    run(s, 20);
    expect(staffCount(s, mina)).toBe(1);
    expect(s.villagers.filter((v) => v.zone === "cueva").length).toBe(1); // nadie más se movió
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

describe("zonas", () => {
  const withCave = (seed: number, adults: number) => {
    const s = createState(seed);
    s.techs.P01 = s.techs.P02 = s.techs.P04 = s.techs.P11 = s.techs.N10 = true;
    s.debug.infinite.comida = true;
    debugAddVillagers(s, adults);
    return s;
  };

  it("la Cueva existe desde el inicio, con ocre, rocas, vetas y su pila", () => {
    const s = createState(30);
    expect(s.zones.cueva.tiles[9][3]).toBe("salida");
    expect(s.nodes.filter((n) => n.zone === "cueva" && n.type === "ocre").length).toBeGreaterThan(0);
    expect(s.nodes.some((n) => n.zone === "cueva" && n.type === "veta")).toBe(true);
    expect(s.buildings.some((b) => b.zone === "cueva" && b.type === "pila")).toBe(true);
  });

  it("sin Exploración no se puede mandar gente a la Cueva", () => {
    const s = createState(31);
    expect(transferVillager(s, "valle", "cueva")).not.toBeNull();
  });

  it("mandar un aldeano: camina hasta la entrada y aparece adentro", () => {
    const s = withCave(32, 3);
    expect(transferVillager(s, "valle", "cueva")).toBeNull();
    const v = s.villagers.find((x) => x.transit === "cueva")!;
    run(s, 15);
    expect(v.zone).toBe("cueva");
    expect(v.transit).toBeNull();
  });

  it("en la Cueva, la gente de Materiales junta pigmento del ocre", () => {
    const s = withCave(33, 2);
    for (const v of s.villagers) if (stageOf(v) === "adult") v.role = "materiales";
    // Todo lleno salvo el pigmento, para que vayan por él.
    for (const r of ["ramas", "piedra", "fibras", "madera"] as const) s.inv[r] = 59;
    const v = s.villagers.find((x) => stageOf(x) === "adult")!;
    v.zone = "cueva"; v.x = 3.5; v.y = 8.5;
    s.inv.pigmento = 0;
    run(s, 30);
    expect(s.inv.pigmento).toBeGreaterThan(0);
  });

  it("la Jefatura no deja gente en Comida dentro de la Cueva (no hay comida ahí)", () => {
    const s = withCave(34, 4);
    s.techs.N11 = true;
    for (let i = 0; i < 3; i++) transferVillager(s, "valle", "cueva");
    run(s, 30);
    const inCave = s.villagers.filter((v) => v.zone === "cueva" && stageOf(v) === "adult");
    expect(inCave.length).toBeGreaterThan(0);
    expect(inCave.some((v) => v.role === "comida")).toBe(false);
  });

  it("los niños y ancianos vuelven solos al Valle", () => {
    const s = withCave(35, 0);
    const kid = s.villagers.find((v) => stageOf(v) === "child")!;
    kid.zone = "cueva"; kid.x = 3.5; kid.y = 8.5;
    run(s, 15);
    expect(kid.zone).toBe("valle");
  });

  it("una partida guardada antes de las zonas se migra al Valle y gana la Cueva", () => {
    const s = createState(36) as unknown as Record<string, unknown>;
    const old = JSON.parse(JSON.stringify(s));
    old.w = 8; old.h = 12; old.tiles = (s.zones as GameState["zones"]).valle.tiles;
    delete old.zones;
    old.nodes = (old.nodes as { zone?: string }[]).filter((n) => n.zone === "valle").map((n) => { delete n.zone; return n; });
    old.buildings = (old.buildings as { zone?: string }[]).filter((b) => b.zone === "valle").map((b) => { delete b.zone; return b; });
    for (const v of old.villagers as { zone?: string; transit?: unknown }[]) { delete v.zone; delete v.transit; }
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.zones.valle.w).toBe(8);
    expect(loaded.zones.cueva).toBeTruthy();
    expect(loaded.villagers.every((v) => v.zone === "valle")).toBe(true);
    expect(loaded.buildings.filter((b) => b.type === "pila").map((b) => b.zone).sort()).toEqual(["cueva", "montanas", "valle"]);
    expect(loaded.zones.valle.exits.montanas).toBeTruthy();
  });
});

describe("recursos resueltos", () => {
  it("la comida se resuelve con Arado e irrigación: 4 parcelas junto a un canal, llenas, + granero", () => {
    const s = createState(4);
    s.techs.P01 = s.techs.P02 = s.techs.N01 = true;
    for (let i = 0; i < 4; i++) addBuilding(s, "parcela", i, 4);
    addBuilding(s, "granero", 4, 4);
    s.techs.B09 = true;
    for (let i = 0; i < 4; i++) addBuilding(s, "canal", i, 5); // un canal debajo de cada parcela
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

describe("Era 3", () => {
  const era3 = (seed: number) => {
    const s = createState(seed);
    for (const t of ["P01", "P02", "P04", "P05", "P06", "P11", "N01", "N02", "N03", "N09", "N10", "N11", "B01", "B02", "B03", "B04", "B06", "B07", "B09"]) s.techs[t] = true;
    s.debug.infinite.comida = true;
    return s;
  };

  it("las minas solo se construyen sobre su veta", () => {
    const s = era3(40);
    s.inv.madera = 50; s.inv.piedra = 50;
    const veta = s.nodes.find((n) => n.zone === "cueva" && n.type === "veta")!;
    expect(place(s, "mina", 4, 4, "cueva")).not.toBeNull(); // suelo sin veta
    expect(place(s, "mina", veta.x, veta.y, "cueva")).toBeNull();
    const estano = s.nodes.find((n) => n.zone === "montanas" && n.type === "estano")!;
    expect(place(s, "mina", estano.x, estano.y, "montanas")).not.toBeNull(); // la de cobre no va en estaño
    expect(place(s, "mina_estano", estano.x, estano.y, "montanas")).toBeNull();
  });

  it("los canales tienen que tocar el río u otro canal", () => {
    const s = era3(41);
    s.inv.piedra = 50;
    expect(place(s, "canal", 2, 3)).not.toBeNull(); // lejos del agua
    expect(place(s, "canal", 5, 4)).toBeNull(); // junto a la orilla (x = 6)
    expect(place(s, "canal", 4, 4)).toBeNull(); // junto al canal anterior
  });

  it("cadena del cobre: mina → mineral; carbonera → carbón; fundición → cobre", () => {
    const s = era3(42);
    debugAddVillagers(s, 3);
    const veta = s.nodes.find((n) => n.zone === "cueva" && n.type === "veta")!;
    s.buildings.push({ id: s.nextId++, type: "mina", zone: "cueva", x: veta.x, y: veta.y, progress: 0, built: true });
    const carb = addBuilding(s, "carbonera", 2, 3);
    const fund = addBuilding(s, "fundicion", 3, 3);
    const mina = s.buildings[s.buildings.length - 3];
    s.inv.madera = 40;
    // La mina está en la Cueva: hay que mandar a alguien (la Jefatura no mueve gente entre zonas).
    expect(transferVillager(s, "valle", "cueva")).toBeNull();
    run(s, 15);
    for (const b of [mina, carb, fund]) expect(changeSpecialists(s, b.id, 1)).toBeNull();
    run(s, 90);
    expect(s.inv.cobre).toBeGreaterThan(0);
  });

  it("lo que se junta en las Montañas llega al 60%", () => {
    const s = era3(43);
    debugAddVillagers(s, 1);
    const v = s.villagers[s.villagers.length - 1];
    v.zone = "montanas"; v.x = 3.5; v.y = 8.5;
    v.carry = { res: "piedra", amt: 10 };
    s.inv.piedra = 0;
    run(s, 2);
    expect(s.inv.piedra).toBeCloseTo(6, 5);
  });

  it("se puede ir de la Cueva a las Montañas pasando por el Valle", () => {
    const s = era3(44);
    debugAddVillagers(s, 1);
    const v = s.villagers[s.villagers.length - 1];
    v.zone = "cueva"; v.x = 3.5; v.y = 8.5; v.manual = true;
    v.transit = "montanas";
    run(s, 40);
    expect(v.zone).toBe("montanas");
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
