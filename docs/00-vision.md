# Visión del juego — "Todo por un PC Gamer" (título provisional)

## Premisa

Un niño va con su papá a comprar un PC gamer. Están carísimos y el papá dice que no.
Esa noche, triste, el niño dice que haría *lo que fuera* por tener uno. Aparece un
**diablo de oficina** (corbata, maletín, timbre de goma, Formulario 666-B) que le
pregunta si está seguro. El niño firma sin leer la letra chica.

Despierta como líder o dios de una tribu en la Edad de Piedra. Solo tienen sus manos
y algo de ropa. Lo único que le dan es **el Libro**, un manual corporativo con todo el
conocimiento necesario para fabricar un PC gamer desde cero.

> **Manual de Procedimientos para la Adquisición Autónoma de Hardware Recreativo**
> *Edición Infernal, rev. 6.6.6 — Departamento de Pactos, Sección Caprichos Infantiles*

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Tono | Comedia ligera |
| El ente | Diablo de oficina: burocracia, formularios, letra chica, "tratos" |
| Estructura | Campaña única con final. Después: **modo libre** y **reinicio opcional con prestigio** (todo rinde ×1,5) |
| Final | **Recursivo:** el juego que carga en el PC es su propia civilización. Un niño de la aldea dice *"haría lo que fuera por un PC gamer"* y el diablo le guiña un ojo. Antes, el diablo presenta el **Informe final del pacto** |
| Simulación | Aldeanos individuales con nombre, edad y oficio |
| Duración | Idle clásico (semanas). **Es lo que más vamos a iterar.** |
| Mapa | Edificios y máquinas en una grilla; los aldeanos caminan libremente (sin estar atados a las casillas) |
| Zonas | El mundo son **zonas separadas** (Valle, Cueva, Montañas…), cada una con su propia grilla y desbloqueada por tecnología. Al entrar a una zona solo se ve esa zona. Las zonas que no se miran se simulan con tasas agregadas |
| Plataforma | Mobile first (vertical, una mano), compatible con desktop |
| Mecánica activa | El niño **toca el Libro** para generar Comprensión al inicio. Luego los pensadores lo hacen solos |
| Primera automatización | **Lenguaje**: antes solo se puede *señalar* (una orden = un viaje); después existen los oficios en bucle |
| Tiempo | **1 minuto real ≈ 10 años de juego** (1 año ≈ 6 s). Un aldeano vive **5–8 minutos** (50–80 años; la medicina suma de a 10) |
| Ciclos | **Sin día/noche ni estaciones.** Simplicidad ante todo |
| Ánimo | Un solo valor global de felicidad y orden: multiplica la productividad y la natalidad |
| Grilla | Cadenas de producción con edificios transformadores y **bonos por adyacencia** |
| Aldeanos notables | **La Crónica** (desde la Escritura) registra a los aldeanos memorables |
| El diablo | Aparece con una **evaluación de desempeño** en cada hito de era y ofrece el catálogo de pactos |
| Economía | La **Tienda del diablo** (desde Comercio): se venden excedentes y se compran recursos. Con la Moneda todo pasa a Monedas, y **las Monedas compran pactos** |
| Construcción | Los aldeanos levantan los edificios llevando materiales. El oficio **Constructor** existe desde la Era 1 |
| Conflictos | **Sin guerras ni ejércitos.** Las amenazas son eventos cómicos |
| Energía | Tres saltos: **mecánica por adyacencia** (molinos) → **vapor como recurso** → **red eléctrica** en la grilla |
| Etapas de la vida | Niño 0–12 años → adulto → anciano en el último 20% de la vida (da Comprensión) |
| Población | **Sin cuadrillas**: todos los aldeanos se simulan como datos individuales, y solo se dibuja un máximo por zona (≈ 100). Los obreros trabajan dentro de las fábricas |
| Logística | Inventario único con **eficiencia de transporte** entre zonas: a pie 40%, Rueda 60%, Ferrocarril 100% |
| Industria | Las fábricas son **mejoras en el lugar** de los edificios artesanales. Sin contaminación |
| Red eléctrica | **Postes con radio** que se conectan solos, sin dibujar cables. Con la Corriente alterna, un solo balance de energía para todas las zonas |
| Miniaturización | La computadora se achica en la grilla (4×4 → 2×2 → 1×1). Los fotolitógrafos viven en una zona propia: **La Fab** |
| Progreso offline | Rinde al **50%**, y al **100%** con el Almacenamiento magnético |
| Silueta del PC | Cada pieza **se ilumina por partes** durante toda la partida. El contorno aparece en la Era 1 (pintura rupestre) |
| Piezas del PC | Cada pieza se **fabrica** como un proyecto grande, una sola vez. **Completar una pieza es definitivo**: sin calidades ni rehacerlas |
| Jefatura | Especialidades elegidas (total o cantidad) → reparto **Zipf** por prioridades → nadie donde no hay trabajo. Tareas manuales quedan fuera hasta devolverlas. Sin herencia de categoría |
| Oficios | **Por categoría** (🍖 Comida, 🧱 Materiales, 🔨 Construcción): las tecnologías mejoran el método de cada una. Los **especialistas** se asignan desde su edificio, que muestra en el mapa sus puestos ocupados o vacíos |
| Tecnologías | **Pocas y grandes** (5–7 por era): cada una debe producir un cambio visible. Al estudiarla aparece una tarjeta que explica qué cambió |
| Recursos resueltos | Con **X edificios + Y aldeanos fijos**, un recurso básico queda "✅ resuelto": sin cantidad, nunca falta, sin importar la población. Es su nivel máximo. La Comprensión nunca se resuelve |
| Derrota | Con **1 aldeano o ninguno** la tribu está perdida: se ofrece empezar de nuevo |
| Genios | Mecánica **incidental**: talento al nacer y Eureka. Sin sistemas extra para gestionarlos |
| Interfaz | **Evoluciona con la tecnología**: "pocos/muchos" → números (Conteo) → estadísticas (Calculadora) → predicciones (Computadora) |

## Pilar de diseño #1

**El libro dice QUÉ, la gente aprende CÓMO.**
El niño sabe todo, pero la civilización tiene que entenderlo, construirlo y dominarlo.
El **árbol tecnológico** es la columna vertebral del juego, y todo lo demás (edificios,
herramientas, oficios, recursos, eras) cuelga de él.
Ver [01-arbol-tecnologico.md](01-arbol-tecnologico.md).

## Preguntas abiertas

- **Ritmo y duración:** hay un marco inicial en [02-ritmo.md](02-ritmo.md). Se afina
  con playtests, no en papel.
- **Consecuencias de la escala de tiempo:** una vida laboral dura unos 3–4 minutos y
  8 horas offline equivalen a unos 4.800 años (~80 generaciones). Ya está definido
  cuánto rinde (50% → 100%); falta definir **cómo se
  resumen** esas generaciones al volver.
- **Pactos con el diablo:** el catálogo, sus precios en Monedas, sus cláusulas y cómo escalan.
- **Prestigio:** si el ×1,5 se acumula con cada reinicio, y si el reinicio se cuenta como
  la historia del niño de la aldea.
