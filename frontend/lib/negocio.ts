"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Nombre del negocio, compartido entre pantallas (plan 0.14).
 *
 * Todavía no hay un endpoint que devuelva los datos de la cuenta, así que el nombre
 * se guarda en este navegador: lo escriben el onboarding y Configuración, y lo leen
 * el Dashboard y Configuración. Cuando el backend exponga `GET /configuracion`,
 * este es el único lugar que hay que cambiar.
 */
const CLAVE = "medianube:nombreNegocio";
const CLAVE_TIPO = "medianube:tipoNegocio";
const EVENTO = "medianube:negocio";

function leerClave(clave: string): string {
  try {
    return window.localStorage.getItem(clave) ?? "";
  } catch {
    return "";
  }
}

const leer = () => leerClave(CLAVE);
const leerTipo = () => leerClave(CLAVE_TIPO);

/** Tipo de negocio elegido en el onboarding ("panadería", "mixto"). */
export function guardarTipoNegocio(tipo: string) {
  try {
    window.localStorage.setItem(CLAVE_TIPO, tipo);
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // Sin almacenamiento: Configuración lo muestra como "sin definir".
  }
}

/** "" si la cuenta se creó antes de que se guardara el tipo, o en otro navegador. */
export function useTipoNegocio(): string {
  return useSyncExternalStore(suscribir, leerTipo, () => "");
}

export function guardarNombreNegocio(nombre: string) {
  try {
    window.localStorage.setItem(CLAVE, nombre.trim());
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    // Sin almacenamiento (modo privado): las pantallas muestran el saludo sin nombre.
  }
}

function suscribir(onChange: () => void) {
  window.addEventListener(EVENTO, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENTO, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Devuelve `[nombre, guardar]`. `nombre` es "" si todavía no se cargó ninguno. */
export function useNombreNegocio(): [string, (nombre: string) => void] {
  const nombre = useSyncExternalStore(suscribir, leer, () => "");
  const guardar = useCallback((n: string) => guardarNombreNegocio(n), []);
  return [nombre, guardar];
}
