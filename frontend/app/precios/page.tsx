
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import { useAuth } from "../../lib/auth-context";
import {
  sugerirPreciosConIA,
  aplicarPrecioIndividual,
  type ResultadoPrecios,
  type SugerenciaPrecio,
  type ResultadoAplicarPrecio,
} from "../../lib/precios";
import EstadoApi from "../../src/src/components/ui/EstadoApi";

// ── Estilos compartidos ──────────────────────────────────────────────────────

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "16px",
  lineHeight: 1,
  userSelect: "none",
};

const badgeStyle = (bg: string, text: string): React.CSSProperties => ({
  backgroundColor: bg,
  color: text,
  fontSize: "11px",
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: "var(--radius-full)",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  whiteSpace: "nowrap",
});

const sectionCard: React.CSSProperties = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "18px 20px",
  boxSizing: "border-box",
};

// ── Funciones auxiliares ─────────────────────────────────────────────────────

function formatARS(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return "-";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return "-";
  }

  const sign = val > 0 ? "+" : "";

  return `${sign}${val.toFixed(1)}%`;
}

function formatFecha(fecha: string): string {
  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return fecha;
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function esAjusteRecomendado(item: SugerenciaPrecio): boolean {
  return (
    Math.abs(item.variacionPrecio) >= 2 ||
    item.superaTopeSuba ||
    item.precioActual < item.costoActual
  );
}

function colorConfianza(confianza: string): {
  background: string;
  text: string;
} {
  switch (confianza) {
    case "alta":
      return {
        background: "var(--color-success-bg)",
        text: "var(--color-success-text)",
      };

    case "media":
      return {
        background: "var(--color-neutral-bg)",
        text: "var(--color-neutral-text)",
      };

    default:
      return {
        background: "var(--color-warning-bg)",
        text: "var(--color-warning-text)",
      };
  }
}

// ── Página de sugerencias de precios ─────────────────────────────────────────

export default function PreciosPage() {
  const { user } = useAuth();

  // Resultado de la Lambda.
  const [resultado, setResultado] = useState<ResultadoPrecios | null>(null);

  // Estados de carga y errores.
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Productos que se están aplicando.
  const [productosAplicando, setProductosAplicando] = useState<Set<string>>(
    new Set()
  );

  // Productos que ya fueron aplicados correctamente.
  const [productosAplicados, setProductosAplicados] = useState<Set<string>>(
    new Set()
  );

  // Mensaje de resultado de la aplicación.
  const [mensajeAplicacion, setMensajeAplicacion] = useState<{
    tipo: "success" | "error";
    texto: string;
  } | null>(null);

  // Filtros y búsqueda.
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "ajustar" | "estable"
  >("todos");

  // ── Consulta a AWS ─────────────────────────────────────────────────────────

  const consultarSugerencias = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await sugerirPreciosConIA(undefined, user?.sub);

      setResultado(res);
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "Error al conectar con el servicio de precios.";

      setError(mensaje);
    } finally {
      setLoading(false);
    }
  }, [user?.sub]);

  // Primera consulta al entrar en la pantalla.
  useEffect(() => {
    void consultarSugerencias();
  }, [consultarSugerencias]);

  const handleAplicarPrecio = async (productoID: string) => {
    if (!resultado?.sugerenciaPrecioID) {
      setMensajeAplicacion({
        tipo: "error",
        texto: "No se encontró el identificador de la sugerencia."
      });
      return;
    }

    if (productosAplicados.has(productoID)) {
      return;
    }

    setProductosAplicando((prev) => {
      const next = new Set(prev);
      next.add(productoID);
      return next;
    });

    setMensajeAplicacion(null);

    try {
      const respuesta = await aplicarPrecioIndividual(
        resultado.sugerenciaPrecioID,
        productoID
      );

      setProductosAplicados((prev) => {
        const next = new Set(prev);
        next.add(productoID);
        return next;
      });

      setMensajeAplicacion({
        tipo: "success",
        texto: `${productoID}: precio actualizado correctamente a ${formatARS(
          respuesta.precioNuevo
        )}.`
      });

    } catch (err: unknown) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "No se pudo aplicar el precio.";

      setMensajeAplicacion({
        tipo: "error",
        texto: mensaje
      });

    } finally {
      setProductosAplicando((prev) => {
        const next = new Set(prev);
        next.delete(productoID);
        return next;
      });
    }
  };

  // ── Datos derivados ────────────────────────────────────────────────────────

  const sugerencias = resultado?.sugerencias ?? [];
  const productosSinCosto = resultado?.productosSinCosto ?? [];

  const totalAjustar = useMemo(
    () => sugerencias.filter(esAjusteRecomendado).length,
    [sugerencias]
  );

  const totalEstable = sugerencias.length - totalAjustar;

  const promedioAumento = useMemo(() => {
    const productosConAumento = sugerencias.filter(
      (item) => item.variacionPrecio > 0
    );

    if (productosConAumento.length === 0) {
      return 0;
    }

    const suma = productosConAumento.reduce(
      (acumulado, item) => acumulado + item.variacionPrecio,
      0
    );

    return suma / productosConAumento.length;
  }, [sugerencias]);

  const sugerenciasFiltradas = useMemo(() => {
    return sugerencias.filter((item) => {
      const requiereAjuste = esAjusteRecomendado(item);

      if (filtroEstado === "ajustar" && !requiereAjuste) {
        return false;
      }

      if (filtroEstado === "estable" && requiereAjuste) {
        return false;
      }

      if (busqueda.trim()) {
        const query = busqueda.trim().toLowerCase();

        const coincideNombre = item.nombre
          .toLowerCase()
          .includes(query);

        const coincideID = item.productoID
          .toLowerCase()
          .includes(query);

        const coincideRazonamiento = item.razonamiento
          .toLowerCase()
          .includes(query);

        if (
          !coincideNombre &&
          !coincideID &&
          !coincideRazonamiento
        ) {
          return false;
        }
      }

      return true;
    });
  }, [sugerencias, filtroEstado, busqueda]);

  // ── Renderizado ────────────────────────────────────────────────────────────

  return (
    <AppLayout activeTab="precios">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "1200px",
        }}
      >
        {/* ── 1. Encabezado ──────────────────────────────────────────────── */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Sugerencias de Precios con IA
              </h1>

              <span
                style={badgeStyle(
                  "var(--color-accent-tint)",
                  "var(--color-accent-dark)"
                )}
              >
                <span style={{ ...iconStyle, fontSize: "13px" }}>
                  auto_awesome
                </span>
                Gemini
              </span>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary)",
                margin: "4px 0 0",
              }}
            >
              Precios sugeridos según recetas, costos de ingredientes y
              márgenes de rentabilidad.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void consultarSugerencias()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              backgroundColor: "var(--color-accent)",
              border: "none",
              borderRadius: "var(--radius-md)",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <span style={{ ...iconStyle, fontSize: "15px" }}>
              refresh
            </span>

            {loading ? "Calculando sugerencias..." : "Recalcular con IA"}
          </button>
        </div>

        {/* ── 2. Información de la última generación ─────────────────────── */}

        {resultado && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              padding: "10px 14px",
              backgroundColor: "var(--color-success-bg)",
              borderLeft: "4px solid var(--color-success-text)",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
              color: "var(--color-success-text)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={iconStyle}>check_circle</span>

              <span>
                <strong>Generación completada:</strong>{" "}
                {resultado.mensaje}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "3px",
              }}
            >
              <span>
                {resultado.fechaGeneracion
                  ? formatFecha(resultado.fechaGeneracion)
                  : "Fecha no disponible"}
              </span>

              {resultado.sugerenciaPrecioID && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.8,
                  }}
                  title={resultado.sugerenciaPrecioID}
                >
                  ID: {resultado.sugerenciaPrecioID.slice(0, 18)}...
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── 3. Indicadores principales ─────────────────────────────────── */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "12px",
          }}
        >
          {/* Productos que requieren revisión */}

          <div style={sectionCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Requieren revisión
              </span>

              <span
                style={{
                  ...iconStyle,
                  color:
                    totalAjustar > 0
                      ? "var(--color-warning-text)"
                      : "var(--color-success-text)",
                }}
              >
                warning
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {loading ? "..." : totalAjustar}
              </span>

              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                }}
              >
                productos
              </span>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                margin: "4px 0 0",
              }}
            >
              Variaciones relevantes o productos con pérdida.
            </p>
          </div>

          {/* Productos estables */}

          <div style={sectionCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Precios estables
              </span>

              <span
                style={{
                  ...iconStyle,
                  color: "var(--color-success-text)",
                }}
              >
                check
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {loading ? "..." : totalEstable}
              </span>

              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                }}
              >
                productos
              </span>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                margin: "4px 0 0",
              }}
            >
              Variación inferior al umbral de revisión.
            </p>
          </div>

          {/* Aumento promedio */}

          <div style={sectionCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Aumento promedio
              </span>

              <span
                style={{
                  ...iconStyle,
                  color: "var(--color-accent)",
                }}
              >
                trending_up
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {loading
                  ? "..."
                  : promedioAumento > 0
                    ? `+${promedioAumento.toFixed(1)}%`
                    : "0%"}
              </span>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                margin: "4px 0 0",
              }}
            >
              Promedio de las variaciones positivas sugeridas.
            </p>
          </div>

          {/* Productos sin costo */}

          <div style={sectionCard}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Sin costo calculable
              </span>

              <span
                style={{
                  ...iconStyle,
                  color:
                    productosSinCosto.length > 0
                      ? "var(--color-warning-text)"
                      : "var(--color-text-muted)",
                }}
              >
                inventory_2
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {loading ? "..." : productosSinCosto.length}
              </span>

              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                }}
              >
                productos
              </span>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                margin: "4px 0 0",
              }}
            >
              No pudieron recibir una sugerencia de precio.
            </p>
          </div>
        </div>

        {/* ── 4. Error de conexión ───────────────────────────────────────── */}

        {error && (
          <div
            style={{
              ...sectionCard,
              backgroundColor: "var(--color-warning-bg)",
              borderColor: "var(--color-warning-text)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <span
                style={{
                  ...iconStyle,
                  color: "var(--color-warning-text)",
                  fontSize: "20px",
                }}
              >
                error
              </span>

              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--color-warning-text)",
                    margin: "0 0 4px",
                  }}
                >
                  Error al obtener las sugerencias
                </h3>

                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--color-warning-text)",
                    margin: 0,
                  }}
                >
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => void consultarSugerencias()}
                  disabled={loading}
                  style={{
                    marginTop: "10px",
                    padding: "6px 12px",
                    backgroundColor: "var(--color-warning-text)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Reintentar consulta
                </button>
              </div>
            </div>
          </div>
        )}

        {mensajeAplicacion && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor:
                mensajeAplicacion.tipo === "success"
                  ? "var(--color-success-bg)"
                  : "var(--color-warning-bg)",
              color:
                mensajeAplicacion.tipo === "success"
                  ? "var(--color-success-text)"
                  : "var(--color-warning-text)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <span style={iconStyle}>
              {mensajeAplicacion.tipo === "success"
                ? "check_circle"
                : "error"}
            </span>

            {mensajeAplicacion.texto}
          </div>
        )}

        {/* ── 5. Filtros y búsqueda ──────────────────────────────────────── */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Filtros de estado */}

          <div
            style={{
              display: "flex",
              gap: "6px",
              backgroundColor: "var(--color-neutral-bg)",
              padding: "3px",
              borderRadius: "var(--radius-md)",
              flexWrap: "wrap",
            }}
          >
            {(
              [
                { value: "todos", label: `Todos (${sugerencias.length})` },
                {
                  value: "ajustar",
                  label: `Requieren revisión (${totalAjustar})`,
                },
                {
                  value: "estable",
                  label: `Estables (${totalEstable})`,
                },
              ] as const
            ).map((filtro) => {
              const activo = filtroEstado === filtro.value;

              return (
                <button
                  key={filtro.value}
                  type="button"
                  onClick={() => setFiltroEstado(filtro.value)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: activo ? 600 : 400,
                    backgroundColor: activo
                      ? "var(--color-surface)"
                      : "transparent",
                    color: activo
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {filtro.label}
                </button>
              );
            })}
          </div>

          {/* Buscador */}

          <div
            style={{
              position: "relative",
              minWidth: "220px",
              maxWidth: "100%",
            }}
          >
            <input
              type="text"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px 7px 30px",
                fontSize: "12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text-primary)",
                boxSizing: "border-box",
              }}
            />

            <span
              style={{
                ...iconStyle,
                position: "absolute",
                left: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
                fontSize: "15px",
              }}
            >
              search
            </span>
          </div>
        </div>

        {/* ── 6. Indicador de carga ──────────────────────────────────────── */}

        {loading && (
          <div
            style={{
              ...sectionCard,
              textAlign: "center",
              padding: "40px",
            }}
          >
            <span
              style={{
                ...iconStyle,
                fontSize: "28px",
                color: "var(--color-accent)",
              }}
            >
              auto_awesome
            </span>

            <p
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                marginTop: "12px",
              }}
            >
              Analizando productos con Gemini...
            </p>

            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                margin: "4px 0 0",
              }}
            >
              Evaluando recetas, gastos registrados y márgenes de
              rentabilidad.
            </p>
          </div>
        )}

        {/* ── 7. Estado vacío ───────────────────────────────────────────── */}

        {!loading && !error && sugerenciasFiltradas.length === 0 && (
          <div
            style={{
              ...sectionCard,
              textAlign: "center",
              padding: "40px",
            }}
          >
            <span
              style={{
                ...iconStyle,
                fontSize: "32px",
                color: "var(--color-text-muted)",
              }}
            >
              sell
            </span>

            <p
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--color-text-primary)",
                marginTop: "8px",
              }}
            >
              No se encontraron sugerencias.
            </p>

            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                margin: "4px 0 12px",
              }}
            >
              Probá restableciendo los filtros o generando un nuevo análisis.
            </p>

            <button
              type="button"
              onClick={() => {
                setFiltroEstado("todos");
                setBusqueda("");
              }}
              style={{
                padding: "6px 14px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                color: "var(--color-text-primary)",
                cursor: "pointer",
              }}
            >
              Restablecer filtros
            </button>
          </div>
        )}

        {/* ── 8. Tarjetas de sugerencias ─────────────────────────────────── */}

        {!loading && sugerenciasFiltradas.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {sugerenciasFiltradas.map((item) => {
              const requiereAjuste = esAjusteRecomendado(item);

              const colorEstado = requiereAjuste
                ? {
                    background: "var(--color-warning-bg)",
                    text: "var(--color-warning-text)",
                  }
                : {
                    background: "var(--color-success-bg)",
                    text: "var(--color-success-text)",
                  };

              const colorNivel = colorConfianza(item.confianza);

              return (
                <div
                  key={item.productoID}
                  style={{
                    ...sectionCard,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    borderLeft: requiereAjuste
                      ? "4px solid var(--color-warning-text)"
                      : "4px solid var(--color-success-text)",
                  }}
                >
                  {/* Encabezado de la tarjeta */}

                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {item.unidadProducto || "Producto"}
                      </span>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                          gap: "5px",
                        }}
                      >
                        <span
                          style={badgeStyle(
                            colorEstado.background,
                            colorEstado.text
                          )}
                        >
                          {requiereAjuste ? "Revisar precio" : "Estable"}
                        </span>

                        <span
                          style={badgeStyle(
                            colorNivel.background,
                            colorNivel.text
                          )}
                          title={`Confianza del análisis: ${item.confianza}`}
                        >
                          Confianza {item.confianza}
                        </span>
                      </div>
                    </div>

                    <h2
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        margin: "0 0 4px",
                      }}
                    >
                      {item.nombre}
                    </h2>

                    <p
                      style={{
                        fontSize: "10px",
                        color: "var(--color-text-muted)",
                        margin: 0,
                      }}
                    >
                      ID: {item.productoID}
                    </p>
                  </div>

                  {/* Comparación de costos y precios */}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "6px",
                      backgroundColor: "var(--color-bg)",
                      padding: "10px 8px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-subtle)",
                      textAlign: "center",
                    }}
                  >
                    {/* Costo actual */}

                    <div>
                      <p
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          margin: "0 0 4px",
                        }}
                      >
                        Costo
                      </p>

                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                          margin: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {formatARS(item.costoActual)}
                      </p>

                      {item.variacionCosto !== null && (
                        <p
                          style={{
                            fontSize: "10px",
                            color:
                              item.variacionCosto > 0
                                ? "var(--color-warning-text)"
                                : "var(--color-text-secondary)",
                            margin: "3px 0 0",
                          }}
                        >
                          {formatPct(item.variacionCosto)}
                        </p>
                      )}
                    </div>

                    {/* Precio actual */}

                    <div>
                      <p
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          margin: "0 0 4px",
                        }}
                      >
                        Actual
                      </p>

                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          margin: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {formatARS(item.precioActual)}
                      </p>

                      <p
                        style={{
                          fontSize: "10px",
                          color: "var(--color-text-muted)",
                          margin: "3px 0 0",
                        }}
                      >
                        Vigente
                      </p>
                    </div>

                    {/* Precio sugerido */}

                    <div>
                      <p
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--color-accent-dark)",
                          textTransform: "uppercase",
                          margin: "0 0 4px",
                        }}
                      >
                        Sugerido
                      </p>

                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: requiereAjuste
                            ? "var(--color-warning-text)"
                            : "var(--color-success-text)",
                          margin: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {formatARS(item.precioSugerido)}
                      </p>

                      <p
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color:
                            item.variacionPrecio > 0
                              ? "var(--color-warning-text)"
                              : "var(--color-text-secondary)",
                          margin: "3px 0 0",
                        }}
                      >
                        {formatPct(item.variacionPrecio)}
                      </p>
                    </div>
                  </div>

                  {/* Margen resultante */}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "9px 11px",
                      backgroundColor: "var(--color-neutral-bg)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Margen resultante
                    </span>

                    <strong
                      style={{
                        fontSize: "14px",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {item.margenResultante.toFixed(1)}%
                    </strong>
                  </div>

                  {/* Razonamiento de Gemini */}

                  <div
                    style={{
                      padding: "10px 12px",
                      backgroundColor: "var(--color-accent-tint)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12px",
                      lineHeight: "1.45",
                      color: "var(--color-text-callout)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        marginBottom: "5px",
                      }}
                    >
                      <span
                        style={{
                          ...iconStyle,
                          fontSize: "14px",
                          color: "var(--color-accent-dark)",
                        }}
                      >
                        auto_awesome
                      </span>

                      <strong
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--color-accent-dark)",
                        }}
                      >
                        Análisis de Gemini
                      </strong>
                    </div>

                    <p style={{ margin: 0 }}>
                      {item.razonamiento ||
                        "No se proporcionó una explicación para esta sugerencia."}
                    </p>

                    {item.superaTopeSuba && (
                      <p
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--color-warning-text)",
                          marginTop: "7px",
                          marginBottom: 0,
                        }}
                      >
                        Atención: la variación supera el tope de aumento de
                        referencia.
                      </p>
                    )}
                  </div>

                  {/* Aplicación del precio */}

                    
                  {/* Aplicación del precio */}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      borderTop: "1px solid var(--color-border-subtle)",
                      paddingTop: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: productosAplicados.has(item.productoID)
                          ? "var(--color-success-text)"
                          : "var(--color-text-muted)",
                      }}
                    >
                      {productosAplicados.has(item.productoID)
                        ? "Precio aplicado"
                        : "Pendiente de aprobación"}
                    </span>

                    <button
                      type="button"
                      disabled={
                        productosAplicados.has(item.productoID) ||
                        productosAplicando.has(item.productoID)
                      }
                      onClick={() => void handleAplicarPrecio(item.productoID)}
                      style={{
                        padding: "7px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: productosAplicados.has(item.productoID)
                          ? "var(--color-success-bg)"
                          : "var(--color-accent)",
                        color: productosAplicados.has(item.productoID)
                          ? "var(--color-success-text)"
                          : "#FFFFFF",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        cursor:
                          productosAplicados.has(item.productoID) ||
                          productosAplicando.has(item.productoID)
                            ? "not-allowed"
                            : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        opacity: productosAplicando.has(item.productoID) ? 0.7 : 1,
                      }}
                    >
                      <span style={{ ...iconStyle, fontSize: "14px" }}>
                        {productosAplicados.has(item.productoID)
                          ? "check_circle"
                          : productosAplicando.has(item.productoID)
                            ? "progress_activity"
                            : "check"}
                      </span>

                      {productosAplicados.has(item.productoID)
                        ? "Aplicado"
                        : productosAplicando.has(item.productoID)
                          ? "Aplicando..."
                          : "Aplicar precio"}
                    </button>
                  </div>

                  
                </div>
              );
            })}
          </div>
        )}

        {/* ── 9. Productos sin costo calculable ──────────────────────────── */}

        {!loading && productosSinCosto.length > 0 && (
          <div
            style={{
              ...sectionCard,
              borderColor: "var(--color-warning-text)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  ...iconStyle,
                  color: "var(--color-warning-text)",
                  fontSize: "20px",
                }}
              >
                warning
              </span>

              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
              >
                Productos sin costo calculable
              </h3>
            </div>

            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                margin: "0 0 12px",
              }}
            >
              Estos productos no recibieron una sugerencia. Revisá los
              motivos y verificá que tengan su correspondiente registro
              en las tablas Producto y Receta-nueva.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {productosSinCosto.map((producto, index) => (
                <div
                  key={`${producto.productoID}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    padding: "10px 12px",
                    backgroundColor: "var(--color-bg)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: "12px",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {producto.productoID}
                    </strong>

                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text-secondary)",
                        margin: "3px 0 0",
                      }}
                    >
                      {producto.motivo}
                    </p>
                  </div>

                  <span
                    style={badgeStyle(
                      "var(--color-warning-bg)",
                      "var(--color-warning-text)"
                    )}
                  >
                    Sin analizar
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 10. Información de la generación ───────────────────────────── */}

        {resultado && !loading && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              textAlign: "right",
              paddingBottom: "8px",
            }}
          >
            {resultado.cantidadProductosAnalizados} productos analizados ·{" "}
            {resultado.cantidadSugerencias} sugerencias generadas · Estado:{" "}
            {resultado.estado}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
