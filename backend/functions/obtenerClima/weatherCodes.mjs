// Mapeo de códigos meteorológicos WMO (los que devuelve Open-Meteo en `weather_code`)
// a descripciones en español legibles para el usuario y para el modelo de IA.
// Referencia: https://open-meteo.com/en/docs (sección "WMO Weather interpretation codes").

const DESCRIPCIONES_WMO = Object.freeze({
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna leve",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  56: "Llovizna helada leve",
  57: "Llovizna helada intensa",
  61: "Lluvia leve",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  66: "Lluvia helada leve",
  67: "Lluvia helada intensa",
  71: "Nevada leve",
  73: "Nevada moderada",
  75: "Nevada intensa",
  77: "Granizo fino",
  80: "Chaparrones leves",
  81: "Chaparrones moderados",
  82: "Chaparrones violentos",
  85: "Chaparrones de nieve leves",
  86: "Chaparrones de nieve intensos",
  95: "Tormenta",
  96: "Tormenta con granizo leve",
  99: "Tormenta con granizo intenso",
});

/** Devuelve la descripción en español de un código WMO, o "Desconocido". */
export function describirCodigoClima(codigo) {
  return DESCRIPCIONES_WMO[codigo] ?? "Desconocido";
}
