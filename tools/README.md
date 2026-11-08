# Herramientas

## El árbol como datos

| Archivo | Qué es |
|---|---|
| `docs/01-arbol-tecnologico.md` | **Fuente de verdad** del árbol mientras el diseño se itera en documentos |
| `data/tech-tree.json` | El árbol como datos, **generado** desde el documento. No editar a mano |
| `tools/build-tree.mjs` | Script que genera el JSON y **valida** el árbol |
| `tools/tree-viewer.html` | Visor interactivo del árbol |

### Regenerar y validar

Después de cualquier cambio en `docs/01-arbol-tecnologico.md`:

```bash
node tools/build-tree.mjs
```

El script revisa:
- Que todos los prerrequisitos existan.
- Que no haya ciclos.
- Que ninguna tecnología requiera algo de una era posterior.
- Que los hitos de era, las zonas y las piezas del PC apunten a tecnologías reales.
- Que las marcas 🌿 coincidan con lo que de verdad es opcional (lo que no lleva a
  ninguna pieza del PC ni a ningún hito de era).

### Abrir el visor

El visor carga el JSON, así que necesita un servidor local (no funciona abriendo el
archivo con doble clic). Desde la raíz del proyecto:

```bash
python -m http.server 8765
```

Luego abre <http://localhost:8765/tools/tree-viewer.html>.

**Qué permite:**
- Tocar una tecnología para ver lo que la necesita (naranja) y lo que desbloquea (azul).
- Ver el detalle de cada nodo: manifestaciones, efecto, zona que abre y pieza del PC.
- Buscar por nombre, ID o efecto.
- Filtrar por tipo de manifestación o solo opcionales 🌿.
- Elegir una pieza del PC y ver toda su ruta de prerrequisitos.

### Formato del JSON (resumen)

```jsonc
{
  "version": "1.0 (árbol revisado completo)",
  "eras":     [{ "id": 1, "key": "piedra", "name": "Piedra", "milestone": { "name", "requires", "population" } }],
  "zones":    [{ "name": "Cueva", "unlockedBy": "N12", "contents": "…" }],
  "pcPieces": [{ "name": "CPU", "partials": ["B11", "X03", …], "completedBy": "D01", "builtIn": "Fab de chips" }],
  "techs": [{
    "id": "P01", "name": "Lenguaje", "era": 1, "order": 0, "optional": false,
    "requires": [], "requiresPopulation": null,
    "manifestations": [{ "type": "automation|knowledge|building|tool|job|resource|institution|pcPiece", "name": "…" }],
    "effect": "texto (markdown simple)",
    "unlocksZone": "…", "completesPcPiece": "…", "advancesPcPieces": ["…"]
  }]
}
```

Los costos **no** están en el JSON: se calculan con la fórmula y las perillas de
`docs/02-ritmo.md` y se afinan con playtests.
