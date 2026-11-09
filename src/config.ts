// Perillas de ritmo y balance (ver docs/02-ritmo.md).
// Ningún número de balance debe ir escrito dentro de la lógica: todo vive aquí.
// El modo debug permite editar estos valores en vivo.

export const config = {
  // Tiempo
  TIEMPO_POR_AÑO: 6, // segundos reales por año de juego
  ESPERANZA_VIDA: 50, // años
  VARIACION_VIDA: 5, // ± años
  EDAD_ADULTO: 12,
  FRACCION_ANCIANO: 0.2, // último 20% de la vida

  // Comprensión
  C0: 50, // Playtest 2: antes 10
  R: 4, // crecimiento entre eras
  G: 1.6, // crecimiento exponencial dentro de la era (Playtest 2: antes era lineal)
  FACTOR_ERA_1: 0.8, // la Era 1 cuesta 20% menos: antes del chamán todo sale de tocar el Libro (Playtest 3)
  COSTO_ARTE_Y_RITOS: 200, // P11 (chamán) con costo fijo: era ~420 toques antes de automatizar la Comprensión (Playtest 4)
  TOQUE_BASE: 1,
  COMPRENSION_ANCIANO: 1.5, // por segundo, por anciano (requiere Lenguaje). Playtest 1: ×10, el toque era demasiado fuerte en comparación

  // Población
  COMIDA_INICIAL: 40,
  COMIDA_POR_AÑO: 0.5, // por aldeano
  NATALIDAD: 0.08, // nacimientos por adulto por año
  CAPACIDAD_BASE: 6, // gente que duerme a la intemperie
  MORTALIDAD_HAMBRE: 0.15, // probabilidad por año
  MORTALIDAD_ENFERMEDAD: 0.01, // probabilidad por año
  POBLACION_ENFERMEDAD: 10, // las enfermedades recién aparecen con esta población (Playtest 6: al inicio era devastador)

  // Trabajo
  VELOCIDAD_CAMINAR: 1.6, // casillas por segundo
  TIEMPO_RECOLECTAR: 2, // segundos por viaje
  CARGA_BASE: 2,
  BONO_HERRAMIENTAS: 1.5, // P02 Piedra tallada
  BONO_CESTA: 2, // P02 Herramientas de piedra (cesta)
  BONO_RUEDA: 1.5, // B04 carretilla: carga por viaje
  BONO_BRONCE: 1.25, // B03 herramientas de bronce: velocidad de trabajo
  BONO_CANAL: 1.5, // parcela junto a un canal
  BONO_ARADO: 1.25, // B09: todas las parcelas
  EFICIENCIA_MONTANAS: 0.6, // lo que se junta en las Montañas llega al 60%
  FACTOR_AYUDA_CONSTRUCCION: 0.5, // aldeano sin oficio que ayuda a construir
  JEFATURA_INTERVALO: 1, // segundos entre cada reasignación de la Jefatura
  DEVOLUCION_DEMOLER: 0.5, // fracción de los materiales que se recupera al demoler (una obra sin terminar devuelve todo)
  DESCUENTO_MEJORA: 0.4, // mejorar un edificio cuesta 40% menos que construir el nuevo (materiales y tiempo)
  BONO_ESCUELA: 0.1, // los niños que van a la escuela llegan a adultos 10% antes

  // Mejoras de recursos naturales (N12 Técnicas de recolección, Playtest 7)
  COSTO_TECNICAS_RECOLECCION: 600, // N12 con costo fijo (por su posición en la tabla saldría carísima)
  MEJORA_REGEN_MINERAL: 4, // barrero, cantera, arenal, cantera de ocre
  MEJORA_REGEN_PLANTA: 3, // arboleda, pastizal
  MEJORA_REGEN_BAYAS: 2, // huerto de bayas (la comida grande viene de la Agricultura)
  MEJORA_RESERVA: 2, // reserva máxima del recurso mejorado

  // Era 4 (Hierro / Clásica)
  BONO_HIERRO: 1.25, // H01 herramientas de hierro: velocidad de trabajo y de recolección
  BONO_GEOMETRIA: 1.3, // H02: los constructores van más rápido
  BONO_GRUA: 1.5, // obras a 2 casillas o menos de una Grúa
  MERCADO_TASA: 3, // el mercader cambia 3 de lo que sobra por 1 de lo que falta
  BONO_NORIA: 1.5, // parcelas junto a una Noria
  VIDA_MEDICINA: 10, // H04: años de vida extra
  MEJORA_PLANTACION: 2, // H01: la Arboleda sube a Plantación (multiplica otra vez la regeneración)

  // Almacenamiento
  ALMACEN_BASE: 60,
  ALMACEN_VASIJAS: 40, // N03 Alfarería
  ALMACEN_GRANERO: 100, // por granero

  // Offline
  EFICIENCIA_OFFLINE: 0.5,
  COMPRENSION_OFFLINE: 0.2, // factor extra para la Comprensión offline (Playtest 2: volvía con Comprensión de sobra)
  OFFLINE_MAX_HORAS: 24,
};

export type ConfigKey = keyof typeof config;
export const DEFAULT_CONFIG = { ...config };
