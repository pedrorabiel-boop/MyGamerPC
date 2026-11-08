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
costo_comprension(nodo) = C0 × R^(era - 1) × (1 + 0,15 × posición_en_la_era)
```

- `C0`: costo base (por ejemplo, 10).
- `R`: factor de crecimiento entre eras (por ejemplo, 4).
- `posición_en_la_era`: de 0 a ~13, según el orden aproximado dentro de la era.

Los costos en recursos de edificios y proyectos siguen la misma idea: un valor base por
era multiplicado por el tamaño del edificio. **Nada de esto se afina en papel**: se
ajusta en los playtests.

---

## 3. Perillas de ajuste (todas en un solo archivo de configuración)

| Perilla | Qué controla |
|---|---|
| `TIEMPO_POR_AÑO` | Segundos reales por año de juego (hoy: 6 s) |
| `C0`, `R` | Costo de Comprensión (ver la fórmula) |
| `PRODUCCION_BASE[oficio]` | Cuánto produce cada oficio por segundo |
| `BONO_MAESTRIA[nivel]` | Multiplicador de producción por nivel de maestría |
| `TOQUE_BASE` | Comprensión que da cada toque del Libro |
| `NATALIDAD`, `ESPERANZA_VIDA` | Crecimiento de la población |
| `TECHO_NATURAL` | Personas que alimenta la naturaleza sin agricultura (≈ 12–15) |
| `EFICIENCIA_OFFLINE` | 0,5 → 1,0 |
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

*(Vacío hasta el primer playtest.)*
