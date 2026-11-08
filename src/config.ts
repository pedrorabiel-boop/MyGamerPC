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
  C0: 10,
  R: 4,
  COSTO_POR_POSICION: 0.15,
  TOQUE_BASE: 1,
  COMPRENSION_ANCIANO: 0.15, // por segundo, por anciano (requiere Lenguaje)

  // Población
  COMIDA_INICIAL: 40,
  COMIDA_POR_AÑO: 0.5, // por aldeano
  NATALIDAD: 0.08, // nacimientos por adulto por año
  CAPACIDAD_BASE: 6, // gente que duerme a la intemperie
  MORTALIDAD_HAMBRE: 0.15, // probabilidad por año
  MORTALIDAD_ENFERMEDAD: 0.01, // probabilidad por año

  // Trabajo
  VELOCIDAD_CAMINAR: 1.6, // casillas por segundo
  TIEMPO_RECOLECTAR: 2, // segundos por viaje
  CARGA_BASE: 2,
  BONO_HERRAMIENTAS: 1.5, // P02 Piedra tallada
  BONO_CESTA: 2, // P08 Cestería
  FACTOR_AYUDA_CONSTRUCCION: 0.5, // aldeano sin oficio que ayuda a construir

  // Almacenamiento
  ALMACEN_BASE: 60,
  ALMACEN_VASIJAS: 40, // N03 Alfarería
  ALMACEN_GRANERO: 100, // por granero

  // Offline
  EFICIENCIA_OFFLINE: 0.5,
  OFFLINE_MAX_HORAS: 24,
};

export type ConfigKey = keyof typeof config;
export const DEFAULT_CONFIG = { ...config };
