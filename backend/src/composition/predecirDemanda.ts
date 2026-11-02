// Composition root de la Lambda `predecirDemanda`: lee variables de entorno y conecta adaptadores.
// Disparador principal: regla de EventBridge diaria a las 05:30 ART (después del refresco de clima).

import { crearHandlerDemanda } from "../adapters/in/lambdaDemanda";
import { crearClimaRepositorioDynamo } from "../adapters/out/climaRepositorioDynamo";
import { crearDemandaRepositorioDynamo } from "../adapters/out/demandaRepositorioDynamo";
import { crearClienteDocumentos } from "../adapters/out/dynamo";
import { crearServicioDemanda } from "../application/demanda/servicioDemanda";
import { CONFIG_MODELO_DEFECTO } from "../domain/demanda/tipos";

const env = process.env;

function requerida(nombre: string): string {
  const valor = env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}

function numero(nombre: string, porDefecto: number): number {
  const valor = Number(env[nombre]);
  return env[nombre] && Number.isFinite(valor) ? valor : porDefecto;
}

// Un solo cliente compartido, creado fuera del handler para reutilizarlo entre invocaciones.
const cliente = crearClienteDocumentos();

const servicio = crearServicioDemanda({
  repositorio: crearDemandaRepositorioDynamo({
    tablaVentas: requerida("TABLA_VENTAS"),
    tablaProductos: requerida("TABLA_PRODUCTOS"),
    tablaPredicciones: requerida("TABLA_PREDICCIONES"),
    cliente,
  }),
  // Se reutiliza el repositorio de clima: lee la cache que dejó el refresco de las 05:00 y lista usuarios.
  clima: crearClimaRepositorioDynamo({
    tablaClima: requerida("TABLA_CLIMA"),
    tablaConfiguracion: requerida("TABLA_CONFIGURACION"),
    cliente,
  }),
  config: {
    zonaHoraria: env.ZONA_HORARIA || "America/Argentina/Buenos_Aires",
    diasPrediccion: numero("DIAS_PREDICCION", 7),
    ttlDias: numero("TTL_PREDICCION_DIAS", 30),
    modelo: {
      ...CONFIG_MODELO_DEFECTO,
      semanas: numero("SEMANAS_HISTORIAL", CONFIG_MODELO_DEFECTO.semanas),
      factorLluvia: numero("FACTOR_LLUVIA", CONFIG_MODELO_DEFECTO.factorLluvia),
    },
  },
});

export const handler = crearHandlerDemanda({ servicio });
