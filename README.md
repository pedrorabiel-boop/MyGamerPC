# Todo por un PC Gamer (prototipo)

Juego incremental mobile first: un niño pacta con un diablo de oficina y tiene que
llevar a una tribu de la Edad de Piedra hasta fabricar un PC gamer.

**Jugar:** <https://pedrorabiel-boop.github.io/MyGamerPC/> · **con modo debug:** <https://pedrorabiel-boop.github.io/MyGamerPC/?debug>
(se publica sola con cada push a `main`)

- Diseño: [docs/00-vision.md](docs/00-vision.md) · [docs/01-arbol-tecnologico.md](docs/01-arbol-tecnologico.md) · [docs/02-ritmo.md](docs/02-ritmo.md)
- Árbol como datos y visor: [tools/README.md](tools/README.md)

## Correr el juego

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>.

**En el celular (playtests):** con el computador y el celular en la misma red wifi,
abre en el celular la dirección **Network** que muestra `npm run dev` (por ejemplo
`http://192.168.1.20:5173`).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (se recarga solo al cambiar el código) |
| `npm test` | Pruebas de la simulación |
| `npm run build` | Chequeo de tipos + build de producción en `dist/` |
| `npm run tree` | Regenera `data/tech-tree.json` desde el documento del árbol y lo valida |

## Modo debug (🐞)

Aparece como pestaña en desarrollo, o en cualquier build agregando `?debug` a la URL.

- **Velocidad:** pausa, ×1, ×10, ×100.
- **Tecnologías:** desbloquear tocando una página del Libro (ignora costos, requisitos y
  eras; tocar de nuevo la bloquea), desbloquear todo hasta una era, reiniciar.
- **Recursos:** fijar cualquier cantidad o activar **∞** (no se gasta ni tiene límite),
  por recurso o todos a la vez.
- **Población:** agregar adultos.
- **Perillas de ritmo en vivo:** todas las de `src/config.ts`. Las cambiadas se marcan en
  amarillo; vuelven a su valor al recargar.
- **Partida:** simular N horas offline, exportar/importar (copiar y pegar), nueva partida.

En desarrollo, el motor también queda en la consola del navegador como `window.engine`.

## Qué incluye este prototipo (Eras 1 a 3)

- El Valle (8×12) con río, cueva, arbustos, árboles, rocas, pasto, una manada y arcilla.
  Los recursos silvestres se agotan y se regeneran (techo natural).
- Aldeanos individuales que caminan libremente, envejecen (1 año = 6 s), nacen y mueren.
  Niños, adultos y ancianos (último 20% de la vida).
- Tocar el Libro (📖) para generar Comprensión; estudiar páginas del árbol real.
- Antes de **Lenguaje** solo se puede **señalar** (tocar un aldeano y luego un recurso:
  un viaje). Después los aldeanos se asignan a **categorías** (🍖 Comida, 🧱 Materiales,
  🔨 Construcción) que mejoran solas con cada tecnología.
- **Especialistas** (chamán, alfarero, tejedor, pastor, curandero) se asignan tocando su
  edificio; el mapa muestra los puestos ocupados (verde) y vacíos (rojo, con "!").
- **Jefatura** (Aldea organizada): eliges qué especialidades llenar (total o una cantidad)
  y el orden de prioridad de las categorías; el resto se reparte solo con la regla de
  Zipf (1, ½, ⅓…), sin mandar gente a donde no hay trabajo. Un aldeano con tarea manual
  queda fuera de la Jefatura hasta que lo devuelves. Los niños llegan a adultos libres.
  Cada zona tiene sus propias prioridades, y la Jefatura nunca mueve gente entre zonas.
- **Zonas:** con Exploración se abre la **Cueva** (ocre, rocas y vetas de cobre) y con la
  Rueda las **Montañas** (vetas de estaño, piedra, madera; lo de ahí llega al 60%).
  Tocando la entrada o el sendero se abre una ventana para **enviar o traer aldeanos**
  (− / +) y entrar a mirar; arriba del mapa hay pestañas por zona.
- **Edad de Bronce (Era 3, 7 tecnologías):** **minas sobre las vetas** (minero), carbonera,
  horno de fundición, herrería (cobre + estaño → bronce), ladrillos y vidrio (arena de la
  orilla), Archivo con escribas, Piedras alineadas y **canales** desde el río (parcelas
  junto a un canal ×1,5).
- Construcción con planos: los aldeanos libres ayudan; los constructores van más rápido.
  Tocando un edificio se puede **demoler** (recuperas 50% de los materiales) o cancelar
  una obra (se devuelve todo).
- 19 tecnologías (6 + 6 + 7, consolidadas tras los playtests) con **tarjeta de novedad**
  al estudiarlas, costos exponenciales, almacenamiento con límite, Ánimo, la interfaz
  "pocos/muchos" antes del Conteo y la comida **resuelta** (Arado e irrigación: 4 parcelas
  junto a un canal, llenas, + granero).
- Guardado automático y progreso offline al 50% (la Comprensión offline, al 10%).
- Al abrir la Era 4 (Hierro) aparece "Fin del prototipo".

### Simplificaciones (a propósito, por ahora)

- Los materiales de construcción se descuentan al colocar el plano; los aldeanos no
  los acarrean.
- No hay maestría (Nv1–5), ni Costa, ni diablo, ni Tienda (pospuesta), ni Crónica.
- El cobre, el bronce y el vidrio todavía no tienen usos más allá de la herrería: los usará la Era 4.
- Herramientas como Piedra tallada o Cestería son bonos directos, sin recurso ni sprite.
- Cerámica y tela se producen, pero todavía no se usan en nada.
- Arte provisorio: figuras simples dibujadas por código.
