// Genera data/tech-tree.json a partir de docs/01-arbol-tecnologico.md y valida el árbol.
// Uso: node tools/build-tree.mjs
//
// Mientras el diseño se itere en los documentos, el Markdown es la fuente de verdad
// y este script mantiene el JSON sincronizado.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, "docs", "01-arbol-tecnologico.md");
const OUT = join(ROOT, "data", "tech-tree.json");

const md = readFileSync(DOC, "utf8").replace(/\r\n/g, "\n");

// ---------- utilidades ----------

const ID_RE = /\b[PNBHMRIEXDG]\d{2}\b/g;
const ERA_BY_PREFIX = { P: 1, N: 2, B: 3, H: 4, M: 5, R: 6, I: 7, E: 8, X: 9, D: 10, G: 11 };
const ICONS = {
  "📖": "knowledge",
  "🏗": "building",
  "✋": "tool",
  "👤": "job",
  "📦": "resource",
  "⚙": "automation",
  "🏛": "institution",
  "🖥": "pcPiece",
};

const stripMd = (s) => s.replace(/\*\*/g, "").replace(/\uFE0F/g, "").trim();
const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());

function section(headingRe) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start < 0) throw new Error(`No se encontró la sección ${headingRe}`);
  const level = lines[start].match(/^#+/)[0].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out;
}

function parseManifestations(raw) {
  const text = raw.replace(/\uFE0F/g, "");
  return text
    .split(" · ")
    .map((part) => part.trim())
    .filter((part) => part && part !== "—")
    .flatMap((part) => {
      const icon = Object.keys(ICONS).find((k) => part.startsWith(k));
      if (!icon) return [{ type: "other", name: stripMd(part) }];
      const type = ICONS[icon];
      // Partes como "📖 👤 Anciano": varios íconos seguidos.
      let rest = part.slice(icon.length).trim();
      const nested = Object.keys(ICONS).find((k) => rest.startsWith(k));
      if (nested) return [{ type, name: null }, ...parseManifestations(rest)];
      rest = stripMd(rest);
      if (!rest) return [{ type, name: null }];
      if (type === "resource") return rest.split(/,\s*/).map((name) => ({ type, name }));
      return [{ type, name: rest }];
    });
}

// ---------- tecnologías ----------

const techs = [];
const orderInEra = {};
for (const line of md.split("\n")) {
  if (!/^\| [PNBHMRIEXDG]\d{2} \| /.test(line)) continue;
  const [id, rawName, rawReq, rawMan, effect] = cells(line);
  const era = ERA_BY_PREFIX[id[0]];
  orderInEra[era] = (orderInEra[era] ?? -1) + 1;

  const popMatch = rawReq.match(/pob\.\s*(\d+)?/);
  const notes = [...rawReq.matchAll(/\(\+ ([^)]+)\)/g)].map((m) => m[1]);
  const requiresAllPieces = /las 13 piezas/.test(rawReq);

  techs.push({
    id,
    name: stripMd(rawName.replace("🌿", "")),
    era,
    order: orderInEra[era],
    optional: rawName.includes("🌿"),
    requires: [...new Set(rawReq.match(ID_RE) ?? [])],
    requiresPopulation: popMatch ? (popMatch[1] ? Number(popMatch[1]) : "por definir") : null,
    requiresAllPcPieces: requiresAllPieces || undefined,
    requiresNotes: notes.length ? notes : undefined,
    manifestations: parseManifestations(rawMan),
    effect: effect === "—" ? "" : effect,
  });
}
const byId = Object.fromEntries(techs.map((t) => [t.id, t]));

// ---------- eras e hitos ----------

const ERA_KEYS = ["piedra", "neolitico", "bronce", "hierro", "medieval", "renacimiento",
  "industrial", "electrica", "electronica", "digital", "gamer"];
const eras = [];
for (const line of section(/^## 3\. Hitos de era/)) {
  if (!/^\| \d+ \| \*\*/.test(line)) continue;
  const [n, name, milestone, req, pop] = cells(line);
  const id = Number(n);
  eras.push({
    id,
    key: ERA_KEYS[id - 1],
    name: stripMd(name),
    milestone: {
      name: milestone.replace(/[*"()]/g, "").trim() || null,
      requires: req.match(ID_RE) ?? [],
      population: /\d/.test(pop) ? Number(pop.replace(/\./g, "")) : null,
    },
  });
}

// ---------- zonas ----------

const zones = [];
for (const line of section(/^### Zonas del mapa/)) {
  if (!/^\| \*\*/.test(line)) continue;
  const [name, unlock, contents] = cells(line);
  zones.push({
    name: stripMd(name.replace(/\(.*?\)/, "")),
    unlockedBy: unlock.match(ID_RE)?.[0] ?? null,
    contents,
  });
}

// ---------- piezas del PC ----------

const BUILT_IN = {
  CPU: "Fab de chips", RAM: "Fab de chips", GPU: "Fab de chips", Almacenamiento: "Fab de chips",
  "Placa madre": "Planta de electrónica", "Fuente de poder": "Planta de electrónica",
  "Teclado y mouse": "Planta de electrónica", Monitor: "Planta de electrónica",
  Refrigeración: "Planta de electrónica", Gabinete: "Planta de electrónica", RGB: "Planta de electrónica",
  "Sistema operativo": "Oficina de software", Juego: "Oficina de software",
};
const pcPieces = [];
for (const line of section(/^### Avances parciales/)) {
  if (!/^\| \*\*/.test(line)) continue;
  const [name, partials, completed] = cells(line);
  const pieceName = stripMd(name);
  pcPieces.push({
    name: pieceName,
    partials: partials.match(ID_RE) ?? [],
    completedBy: completed.match(ID_RE)?.[0] ?? null,
    builtIn: BUILT_IN[pieceName] ?? null,
  });
}

// ---------- relaciones derivadas ----------

for (const t of techs) {
  // "las 13 piezas" → conexiones reales con las tecnologías que completan cada pieza.
  if (t.requiresAllPcPieces) t.requires = pcPieces.map((p) => p.completedBy).filter(Boolean);
  const zone = zones.find((z) => z.unlockedBy === t.id);
  if (zone) t.unlocksZone = zone.name;
  const completes = pcPieces.find((p) => p.completedBy === t.id);
  if (completes) t.completesPcPiece = completes.name;
  const advances = pcPieces.filter((p) => p.partials.includes(t.id)).map((p) => p.name);
  if (advances.length) t.advancesPcPieces = advances;
}

// ---------- validación ----------

const errors = [];
const warnings = [];

for (const t of techs) {
  for (const r of t.requires) {
    if (!byId[r]) errors.push(`${t.id} requiere ${r}, que no existe`);
    else if (byId[r].era > t.era) errors.push(`${t.id} (era ${t.era}) requiere ${r}, que es de una era posterior (${byId[r].era})`);
  }
}

// Ciclos
const state = {};
function visit(id, path) {
  if (state[id] === "done") return;
  if (state[id] === "visiting") { errors.push(`Ciclo: ${[...path, id].join(" → ")}`); return; }
  state[id] = "visiting";
  for (const r of byId[id]?.requires ?? []) visit(r, [...path, id]);
  state[id] = "done";
}
techs.forEach((t) => visit(t.id, []));

// Hitos de era
for (const e of eras) {
  for (const r of e.milestone.requires) {
    if (!byId[r]) errors.push(`El hito de la era ${e.id} requiere ${r}, que no existe`);
    else if (byId[r].era >= e.id) errors.push(`El hito de la era ${e.id} requiere ${r}, que es de la era ${byId[r].era}`);
  }
}

// Zonas y piezas
for (const z of zones) if (z.unlockedBy && !byId[z.unlockedBy]) errors.push(`La zona ${z.name} se abre con ${z.unlockedBy}, que no existe`);
for (const p of pcPieces) {
  for (const id of [...p.partials, p.completedBy]) if (!byId[id]) errors.push(`La pieza ${p.name} usa ${id}, que no existe`);
}

// Opcionales: lo que NO es prerrequisito (directo o indirecto) de ninguna pieza del PC.
const required = new Set();
const mark = (id) => { if (required.has(id) || !byId[id]) return; required.add(id); byId[id].requires.forEach(mark); };
pcPieces.forEach((p) => mark(p.completedBy));
["G07", "G08"].forEach((id) => required.add(id));
// Las tecnologías de los hitos de era también son obligatorias en la práctica.
eras.forEach((e) => e.milestone.requires.forEach(mark));
for (const t of techs) {
  const isRequired = required.has(t.id);
  if (t.optional && isRequired) warnings.push(`${t.id} ${t.name} está marcada 🌿 pero es obligatoria`);
  if (!t.optional && !isRequired) warnings.push(`${t.id} ${t.name} no está marcada 🌿 pero nada la necesita`);
}

// ---------- salida ----------

const versionMatch = md.match(/^\*\*Versión:\*\* ([^·]+)/m);
const tree = {
  generatedFrom: "docs/01-arbol-tecnologico.md",
  version: versionMatch ? versionMatch[1].trim() : null,
  manifestationTypes: Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [v, k])),
  eras,
  zones,
  pcPieces,
  techs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(tree, null, 2) + "\n", "utf8");

const perEra = eras.map((e) => `${e.name}: ${techs.filter((t) => t.era === e.id).length}`).join(" · ");
console.log(`✔ ${OUT}`);
console.log(`  ${techs.length} tecnologías (${techs.filter((t) => t.optional).length} opcionales) · ${eras.length} eras · ${zones.length} zonas · ${pcPieces.length} piezas`);
console.log(`  ${perEra}`);
if (warnings.length) console.log(`\n⚠ Advertencias (${warnings.length}):\n  - ${warnings.join("\n  - ")}`);
if (errors.length) {
  console.log(`\n✖ Errores (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  process.exitCode = 1;
} else {
  console.log("\n✔ Sin errores estructurales.");
}
