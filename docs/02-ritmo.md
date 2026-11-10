# Ritmo — marco inicial

> **Filosofía:** los números de este documento son **puntos de partida**, no un diseño
> afinado. El ritmo real se encuentra iterando:
> **playtest → ajustar precios y costos → playtest → …**
> Por eso lo importante no es acertar ahora, sino que **cambiar un número sea trivial**
> y que **probar sea rápido**.

---

## 1. Duración objetivo por era (provisional)

Cuenta el tiempo real total, incluido el tiempo sin jugar (offline). Cada era dura
aproximadamente entre 1,5 y 2 veces la anterior: al principio se avanza rápido para
enganchar, y después se pasa a sesiones cortas de revisión.

| Era | Duración objetivo | Cómo se juega |
|---|---|---|
| 1 Piedra | 10–15 min | Activa: tocar el Libro, señalar aldeanos |
| 2 Neolítico | 20–30 min | Activa |
| 3 Bronce | ~1 h | Activa / mixta |
| 4 Hierro | ~2 h | Mixta |
| 5 Medieval | ~4 h | Mixta: aparecen los molinos |
| 6 Renacimiento | ~8 h | Idle: volver de vez en cuando |
| 7 Industrial | ~12 h | Idle |
| 8 Eléctrica | ~1 día | Idle |
| 9 Electrónica | ~2 días | Idle |
| 10 Digital | ~3 días | Idle |
| 11 Gamer | < 1 día | Cascada final |
| **Total** | **≈ 1–2 semanas** | |

**Momentos que hay que proteger** (más importantes que las duraciones exactas):

| Momento | Cuándo debería pasar |
|---|---|
| Primer "¡ahh!" (Lenguaje: los aldeanos trabajan solos) | Antes de 2–3 minutos |
| Primera pieza de la silueta (el contorno con Pigmentos) | En la primera sesión |
| Nunca "nada que hacer" con el juego abierto en las Eras 1–3 | Más de 1–2 minutos sin decisiones disponibles es una alerta |
| Al volver de estar offline | Siempre hay algo nuevo que comprar o estudiar |

---

## 2. Fórmula de partida para los costos

Una sola fórmula simple, para tener números desde el primer prototipo:

```
costo_comprension(nodo) = C0 × R^(era - 1) × G^(posición_en_la_era)
```

- `C0`: costo base (hoy 50; antes 10).
- `R`: factor de crecimiento entre eras (4).
- `G`: crecimiento **exponencial** dentro de la era (1,6). Antes era lineal (+15% por
  posición) y las últimas páginas salían casi gratis.
- `posición_en_la_era`: de 0 a ~6, según el orden dentro de la era.

Con estos valores, la Era 1 cuesta en total ≈ 1.000 de Comprensión (de 50 a 525 por
página) y la Era 2 ≈ 4.000 (de 200 a 2.100).

Los costos en recursos de edificios y proyectos siguen la misma idea: un valor base por
era multiplicado por el tamaño del edificio. **Nada de esto se afina en papel**: se
ajusta en los playtests.

---

## 3. Perillas de ajuste (todas en un solo archivo de configuración)

| Perilla | Qué controla |
|---|---|
| `TIEMPO_POR_AÑO` | Segundos reales por año de juego (hoy: 6 s) |
| `C0`, `R`, `G` | Costo de Comprensión (ver la fórmula) |
| `PRODUCCION_BASE[oficio]` | Cuánto produce cada oficio por segundo |
| `BONO_MAESTRIA[nivel]` | Multiplicador de producción por nivel de maestría |
| `TOQUE_BASE` | Comprensión que da cada toque del Libro |
| `NATALIDAD`, `ESPERANZA_VIDA` | Crecimiento de la población |
| `TECHO_NATURAL` | Personas que alimenta la naturaleza sin agricultura (≈ 12–15) |
| `EFICIENCIA_OFFLINE` | 0,5 → 1,0 |
| `COMPRENSION_OFFLINE` | Factor extra para la Comprensión offline (0,2: offline rinde 10% de Comprensión) |
| `EFICIENCIA_TRANSPORTE[medio]` | 0,4 / 0,6 / 1,0 |
| `POBLACION_HITO[era]` | Población requerida para cada hito de era |
| `BONO_PRESTIGIO` | ×1,5 |

**Regla:** ningún número de balance va escrito dentro de la lógica del juego. Todos
viven en la configuración o en los datos del árbol.

---

## 4. Herramientas de playtest (construirlas desde el primer prototipo)

Sin estas herramientas, probar una era tardía toma días. Son tan importantes como el
juego mismo:

| Herramienta | Para qué |
|---|---|
| **Multiplicador de velocidad** (×1, ×10, ×100) | Recorrer eras largas en minutos |
| **Saltar a la era N** con un estado inicial razonable | Probar la Era 8 sin jugar las 7 anteriores |
| **Panel de trucos** | Agregar recursos, Monedas o población; completar nodos |
| **Registro de tiempos** | Cuánto tardó realmente cada era y cada nodo, comparado con el objetivo |
| **Alerta de "nada que hacer"** | Marca los momentos en que el jugador quedó sin decisiones disponibles |
| **Exportar e importar partidas** | Compartir y reproducir situaciones concretas |
| **Simular offline** | Probar qué pasa al volver tras N horas sin esperar N horas |

Todas se esconden en la versión final (menú de desarrollador).

> **Estado (prototipo v0.1):** ya existen la velocidad, el panel de trucos (cantidades fijas o ∞ por recurso, desbloquear tocando el Libro, desbloquear hasta una era, agregar aldeanos), las perillas en vivo, exportar/importar y simular offline. Faltan el salto a una era con estado preparado, el registro de tiempos y la alerta de "nada que hacer". Ver el [README](../README.md).

---

## 5. Qué medir en cada playtest

1. **Tiempo real por era**, comparado con la tabla de la sección 1.
2. **Momentos sin decisiones**: cuándo y cuánto duran.
3. **Recursos que se acumulan sin uso** (sobran) o que **siempre faltan** (cuellos de botella).
4. **Nodos que nadie entiende** o que se compran sin notar su efecto.
5. **Si el primer "¡ahh!" llega a tiempo.**

Después de cada playtest se ajustan las perillas, se anota el cambio en el historial de
abajo y se vuelve a probar.

---

## 6. Historial de ajustes de ritmo

### Playtest 1 (2026-11-08, celular)
- **Se murieron todos los aldeanos.** Perder está bien, pero no había cómo reiniciar → se agregó la pantalla de derrota (1 aldeano o ninguno).
- **Tocar el Libro era demasiado fuerte** comparado con los ancianos (≈ 8 toques por segundo contra 0,15/s por anciano) → `COMPRENSION_ANCIANO` ×10 (0,15 → 1,5). El chamán también ×10 (1 → 10 por ciclo, ≈ 4/s) para que siga por encima del anciano.
- Antes del playtest: `COMIDA_INICIAL` 20 → 40 (sin recolectar, la comida se acababa en ≈ 50 s).

### Playtest 2 (2026-11-09, celular)
- **Demasiadas tecnologías, muy chicas:** se tocaba todo sin leer y no se entendía el camino → Eras 1–2 consolidadas (12 → 6 cada una) y tarjeta de novedad.
- **Demasiados oficios sueltos** → oficios por categoría y especialistas asignados desde su edificio.
- **Al volver de estar offline había Comprensión de sobra para comprar todo** → costos exponenciales dentro de la era (`G` = 1,6), `C0` 10 → 50, y la Comprensión offline rinde solo 20% de lo normal offline (`COMPRENSION_OFFLINE` = 0,2).

### Playtest 3 (2026-11-09)
- **La Era 1 es casi puro tocar el Libro** hasta que aparece el chamán → la Era 1 cuesta **20% menos** (`FACTOR_ERA_1` = 0,8). Costos de la Era 1: 40, 64, 102, 164, 262, 419 (≈ 1.050 en total, antes ≈ 1.310).

### Playtest 4 (2026-11-10)
- **Llegar al chamán costaba ≈ 420 toques** antes de poder automatizar la Comprensión → *Arte y ritos* (P11) pasa a **costo fijo de 200** (`COSTO_ARTE_Y_RITOS`), fuera de la fórmula. El resto de la Era 1 no cambia.

### Playtest 5 (2026-11-10)
- **Los enviados a la Cueva y las Montañas eran los adultos más viejos:** duraban segundos antes de volverse ancianos y volver → ahora se manda a los más jóvenes y se trae de vuelta a los más viejos.
- **El mapa se llenaba de niños** que tapaban los edificios → escuela (N09): los niños quedan adentro y llegan a adultos 10% antes (`BONO_ESCUELA`).
- **Mejoras con descuento** (`DESCUENTO_MEJORA` = 0,4).

### Playtest 6 (2026-11-11)
- **Las muertes por enfermedad al principio eran devastadoras** (una sola muerte en una tribu de 4–5) → no hay muertes por enfermedad con menos de **10 habitantes** (`POBLACION_ENFERMEDAD`).
- **No quedaba claro cómo conseguir cada recurso** → pestaña **📦 Recursos** en el Libro: cada recurso muestra en diagramas de dónde sale (recolección, minas, cadenas de edificios con sus insumos) y para qué sirve.
- **La arcilla siempre en 0** al querer casas de adobe → tocando un recurso de la barra de arriba se puede **concentrar a la gente de Materiales** en él (🎯), mientras no esté lleno.
- **Foco en recursos de edificio:** al concentrarse en algo que sale de un edificio (ladrillo, vidrio, bronce…), Materiales junta lo que se recolecta a mano de su cadena (ladrillo → arcilla y madera para el carbón), empezando por lo más bajo. El menú avisa si la cadena se traba por otra cosa: un edificio sin construir o sin trabajador. Sin foco posible: lana, comida y Comprensión.

### Playtest 7 (2026-11-12)
- **La arcilla siempre en 0 aunque 10 personas la junten:** medido, el Valle da ≈9 de arcilla por minuto (3 depósitos × 0,05/s) una vez gastada la reserva inicial, igual con 1 que con 10 personas. La piedra, ≈5 por minuto. Un ladrillero consume 24 por minuto. → **N12 Técnicas de recolección** (costo fijo `COSTO_TECNICAS_RECOLECCION` = 600): los recursos naturales se mejoran en su lugar (×4 minerales, ×3 plantas, ×2 bayas; reserva ×2).
- **Era 4 consolidada e implementada** (7 tecnologías). A vigilar en el próximo playtest: (1) el hito que abre la Era 4 pide **80 habitantes**; (2) la Era 4 cuesta de ~3.200 a ~54.000 de Comprensión por página (Filosofía va primero, por la Academia); (3) el Mercado a 3 por 1 (`MERCADO_TASA`); (4) el carbón, que ahora piden la Forja y el vidrio soplado.
- **Mapa:** todos los mapas ocupan el ancho de la pantalla, con scroll vertical si no caben (el Valle crece a 8×16 con Geometría).

### Playtest 8 (2026-11-13)
- **Viajes vacíos:** 20 aldeanos iban al mismo árbol y la mayoría volvía con las manos vacías (medido: 18% de los viajes vacíos; 34–39% con 🎯). → **Reservas:** cada aldeano aparta lo que va a cargar; los demás eligen otro lugar u otro material, y si no queda nada esperan junto a la pila. Medido después: 0 viajes vacíos, y 5 aldeanos juntan ≈30% más (menos viajes a medias). Con 20, lo que limita es el techo natural (para eso están las mejoras de N12).
- **El Mercado era demasiado poderoso:** cambiaba 3 de comida por 1 de cualquier cosa (hasta engranajes), solo y cada 5 s. → **Pedido manual** (sin pedido, el mercader no hace nada), **un cambio cada 30 s** (`MERCADO_CICLO`) y **precio según la complejidad** del recurso, calculada de las recetas (natural 1 · carbón, cerámica, tela 2 · cobre, ladrillo, vidrio, hierro 3 · bronce, vidrio claro, engranajes 4): `MERCADO_TASA` (3) por 1 en el mismo nivel, ×2 por cada nivel que sube (comida → ladrillo: 12 por 1).
- **Al crecer el Valle, un árbol nuevo quedaba encima del sendero** (la montañita) → el árbol va en otra casilla, y las partidas guardadas mudan cualquier recurso que esté sobre el sendero o la cueva a la casilla libre más cercana.
- **Los puntos verdes y rojos de los puestos de trabajo se confundían con aldeanos** → ahora son **rombos** (verde lleno = ocupado, rojo hueco = falta gente), y el aviso de falta de gente es un triángulo.
- **El menú Construir era una sola lista larga** → categorías desplegables (Vivienda, Alimento, Minerales, Talleres y comercio, Conocimiento, Ánimo y salud, Almacenamiento, Potenciación), cada una con cuántos tipos hay y cuántos alcanzan; junto al nombre de cada edificio, cuántos hay construidos.
