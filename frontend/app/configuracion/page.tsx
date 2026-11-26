"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";
import PageHeader from "../../src/src/components/ui/PageHeader";
import Card from "../../src/src/components/ui/Card";
import Badge from "../../src/src/components/ui/Badge";
import Button from "../../src/src/components/ui/Button";
import ConfirmDialog from "../../src/src/components/ui/ConfirmDialog";
import Icon from "../../src/src/components/ui/Icon";
import Stepper from "../../src/src/components/ui/Stepper";
import { useToast } from "../../src/src/components/ui/Toast";
import { useAuth } from "../../lib/auth-context";
import { useNombreNegocio, useTipoNegocio } from "../../lib/negocio";
import { apiUrl } from "../../lib/api";

const CONFIG_URL = apiUrl("/configuracion");

// ── Datos de la pantalla ───────────────────────────────────────────────────────

const CATEGORIAS = ["panadería", "pastelería", "bebidas"] as const;
type Categoria = (typeof CATEGORIAS)[number];

const AVISOS = [
  { key: "precios", label: "Alertas de precio", ayuda: "cuando un producto queda debajo de su margen objetivo" },
  { key: "faltante", label: "Riesgo de faltante", ayuda: "cuando la predicción anticipa que puede faltar un producto" },
  { key: "demanda", label: "Picos de demanda", ayuda: "cuando se espera un día de producción alta" },
] as const;
type Aviso = (typeof AVISOS)[number]["key"];

interface Config {
  nombre: string;
  rubro: string;
  ciudad: string;
  sucursales: number;
  margenes: Record<Categoria, string>;
  avisos: Record<Aviso, boolean>;
}

// Todavía no hay un endpoint que devuelva la configuración guardada: la pantalla
// arranca con estos valores y con el nombre guardado en este navegador.
const INICIAL: Config = {
  nombre: "",
  rubro: "",
  ciudad: "",
  sucursales: 1,
  margenes: {
    panadería: "40",
    pastelería: "45",
    bebidas: "60",
  },
  avisos: {
    precios: true,
    faltante: true,
    demanda: false,
  },
};

function margenValido(valor: string): boolean {
  const n = Number(valor);
  return valor.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
}

// ── Piezas ─────────────────────────────────────────────────────────────────────

/** Fila "etiqueta · control". `htmlFor` conecta la etiqueta con su campo. */
function Fila({ label, htmlFor, primera, children }: { label: string; htmlFor?: string; primera?: boolean; children: React.ReactNode }) {
  const etiqueta: React.CSSProperties = { fontSize: 13, lineHeight: "18px", color: "var(--color-text-secondary)" };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px minmax(0, 1fr)",
        alignItems: "center",
        columnGap: 16,
        padding: primera ? "0 0 12px" : "12px 0",
        borderTop: primera ? "none" : "1px solid var(--color-border-subtle)",
        fontSize: 13,
        lineHeight: "18px",
        color: "var(--color-text-primary)",
      }}
    >
      {htmlFor ? <label htmlFor={htmlFor} style={etiqueta}>{label}</label> : <span style={etiqueta}>{label}</span>}
      <div style={{ justifySelf: "start", maxWidth: "100%" }}>{children}</div>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter();
  const toast = useToast();
  const {
    user,  
  getIdToken,  
  isLoading: authLoading,
  } = useAuth();
  console.log("COGNITO SUB:", user?.sub);

  const [nombreGuardado, guardarNombre] = useNombreNegocio();
  const tipoNegocio = useTipoNegocio();

  // `guardado` es lo último que se guardó; `config`, lo que se ve en pantalla
  const [guardado, setGuardado] = useState<Config>(INICIAL);
  const [config, setConfig] = useState<Config>(INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [salirA, setSalirA] = useState<string | null>(null); // destino pendiente de confirmar
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  // ── Cargar configuración desde AWS ──────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCargando(false);
      return;
    }

    let cancelado = false;

    async function cargarConfiguracion() {
      setCargando(true);
      setErrorCarga("");

      try {
        const token = await getIdToken();

        const response = await fetch(CONFIG_URL, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`No se pudo cargar la configuración (HTTP ${response.status}).`);
        }

        const data = await response.json();

        // Admite tanto una respuesta directa como { configuracion: {...} }.
        const negocio = data.configuracion ?? data;

        const margenesRecibidos = negocio.margenes ?? {};

        const avisosRecibidos =
          negocio.notificaciones ?? negocio.avisos ?? {};

        const ubicacion = negocio.ubicacion ?? {};

        const configuracionCargada: Config = {
          nombre: negocio.nombreNegocio ?? nombreGuardado ?? "",
          rubro:
            negocio.rubro ??
            negocio.tipoLocal ??
            tipoNegocio ??
            "",
          ciudad:
            negocio.ciudad ??
            ubicacion.ciudad ??
            "",
          sucursales: Number(negocio.sucursales ?? 1),
          // Se guardan sin tilde (panaderia, pasteleria), como los mandan el onboarding y el PUT de esta pantalla
          margenes: {
            panadería: String(margenesRecibidos.panaderia ?? margenesRecibidos.panadería ?? 40),
            pastelería: String(margenesRecibidos.pasteleria ?? margenesRecibidos.pastelería ?? 45),
            bebidas: String(margenesRecibidos.bebidas ?? 60),
          },
          avisos: {
            precios: avisosRecibidos.precios ?? true,
            faltante: avisosRecibidos.faltante ?? true,
            demanda: avisosRecibidos.demanda ?? false,
          },
        };

        if (cancelado) return;

        setConfig(configuracionCargada);
        setGuardado(configuracionCargada);

        if (configuracionCargada.nombre) {
          guardarNombre(configuracionCargada.nombre);
        }
      } catch (error) {
        if (cancelado) return;

        console.error("Error al cargar configuración:", error);

        setErrorCarga(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración."
        );
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargarConfiguracion();

    return () => {
      cancelado = true;
    };
  }, [
    authLoading,
    user?.sub,
    getIdToken,
    nombreGuardado,
    tipoNegocio,
    guardarNombre,
  ]);

  const hayCambios = JSON.stringify(config) !== JSON.stringify(guardado);
  const margenesInvalidos = CATEGORIAS.filter((c) => !margenValido(config.margenes[c]));
  const sinNombre = config.nombre.trim() === "";
  const puedeGuardar = !cargando && margenesInvalidos.length === 0 && !sinNombre;

  // ── Salir con cambios sin guardar ──────────────────────────────────────────
  useEffect(() => {
    if (!hayCambios) return;

    // Cerrar o recargar la pestaña: aviso nativo del navegador
    const alCerrar = (e: BeforeUnloadEvent) => e.preventDefault();

    // Links dentro de la app (sidebar incluido): se frena la navegación y se pregunta
    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href");
      if (!link || !href || !href.startsWith("/") || link.getAttribute("target") === "_blank") return;
      if (href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setSalirA(href);
    };

    window.addEventListener("beforeunload", alCerrar);
    document.addEventListener("click", alHacerClic, true);
    return () => {
      window.removeEventListener("beforeunload", alCerrar);
      document.removeEventListener("click", alHacerClic, true);
    };
  }, [hayCambios]);

  // ── Guardar ────────────────────────────────────────────────────────────────
  // ── Guardar configuración en AWS ────────────────────────────────────────

  async function guardar() {
    if (!puedeGuardar || guardando) return;

    setGuardando(true);

    const aGuardar: Config = {
      ...config,
      nombre: config.nombre.trim(),
      rubro: config.rubro.trim(),
      ciudad: config.ciudad.trim(),
    };

    try {
      const token = await getIdToken();

      const response = await fetch(CONFIG_URL, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombreNegocio: aGuardar.nombre,
          rubro: aGuardar.rubro,
          ciudad: aGuardar.ciudad,
          margenes: {
            panaderia: Number(aGuardar.margenes.panadería),
            pasteleria: Number(aGuardar.margenes.pastelería),
            bebidas: Number(aGuardar.margenes.bebidas),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
          errorData.message ||
          errorData.error ||
          `Error HTTP ${response.status}`
        );
      }

      // Sincroniza el nombre con Dashboard y Sidebar.
      guardarNombre(aGuardar.nombre);

      setGuardado(aGuardar);
      setConfig(aGuardar);

      toast({ message: "Cambios guardados" });
    } catch (error) {
      console.error("Error al guardar configuración:", error);

      toast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos guardar los cambios. Probá de nuevo.",
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppLayout activeTab="configuracion">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760, margin: "0 auto", paddingBottom: hayCambios ? 80 : 0 }}>
        <div style={{ marginBottom: -16 }}>
          <PageHeader title="Configuración" subtitle="Datos del negocio, márgenes, equipo y avisos." />
          
          {cargando && (
              <p className="field-help">
                Cargando configuración del negocio...
              </p>
          )}

          {errorCarga && (
            <p className="field-error" role="alert">
              <Icon name="error" size={14} />
              {errorCarga}
            </p>
          )}

        </div>

        {/* ── Datos del negocio ──────────────────────────────────────────── */}
        <Card title="Datos del negocio">
          <Fila label="Nombre del negocio" htmlFor="input-nombre-negocio" primera>
            <input
              id="input-nombre-negocio"
              type="text"
              className="input"
              value={config.nombre}
              placeholder="ej.: Panadería Central"
              autoComplete="organization"
              aria-invalid={sinNombre && hayCambios ? true : undefined}
              aria-describedby={sinNombre && hayCambios ? "error-nombre" : undefined}
              onChange={(e) => setConfig((c) => ({ ...c, nombre: e.target.value }))}
              style={{ width: 320, maxWidth: "100%", padding: "7px 10px" }}
            />
            {sinNombre && hayCambios && (
              <p id="error-nombre" className="field-error">
                <Icon name="error" size={14} />
                escribí el nombre de tu negocio.
              </p>
            )}
          </Fila>
          <Fila label="Rubro" htmlFor="input-rubro">
            <input
              id="input-rubro"
              type="text"
              className="input"
              value={config.rubro}
              placeholder="ej.: Panadería"
              onChange={(e) =>
                setConfig((c) => ({ ...c, rubro: e.target.value }))
              }
              style={{ width: 320, maxWidth: "100%", padding: "7px 10px" }}
            />
          </Fila>

          <Fila label="Ciudad" htmlFor="input-ciudad">
            <input
              id="input-ciudad"
              type="text"
              className="input"
              value={config.ciudad}
              placeholder="ej.: La Plata"
              onChange={(e) =>
                setConfig((c) => ({ ...c, ciudad: e.target.value }))
              }
              style={{ width: 320, maxWidth: "100%", padding: "7px 10px" }}
            />
          </Fila>
          <Fila label="Sucursales">
            <Stepper
              id="input-sucursales"
              label="sucursales"
              value={config.sucursales}
              onChange={(sucursales) => setConfig((c) => ({ ...c, sucursales }))}
            />
          </Fila>
          <div style={{ marginBottom: -12 }}>
            <Fila label="Moneda">
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                $ ARS, peso argentino
                <Badge>predeterminada</Badge>
              </span>
            </Fila>
          </div>
        </Card>

        {/* ── Márgenes objetivo ──────────────────────────────────────────── */}
        <Card title="Márgenes objetivo por categoría">
          <p className="field-help" style={{ margin: "0 0 12px" }}>La IA usa estos márgenes para sugerir tus precios.</p>
          {CATEGORIAS.map((cat, i) => {
            const invalido = !margenValido(config.margenes[cat]);
            const id = `input-margen-${cat}`;
            return (
              <div key={cat} style={{ marginBottom: i === CATEGORIAS.length - 1 ? -12 : 0 }}>
                <Fila label={cat[0].toUpperCase() + cat.slice(1)} htmlFor={id}>
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      className="input num"
                      value={config.margenes[cat]}
                      aria-invalid={invalido || undefined}
                      aria-describedby={invalido ? `${id}-error` : undefined}
                      onChange={(e) => setConfig((c) => ({ ...c, margenes: { ...c.margenes, [cat]: e.target.value } }))}
                      style={{ width: 96, padding: "7px 28px 7px 10px", textAlign: "right" }}
                    />
                    <span
                      aria-hidden="true"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)", pointerEvents: "none" }}
                    >
                      %
                    </span>
                  </span>
                  {invalido && (
                    <p id={`${id}-error`} className="field-error">
                      <Icon name="error" size={14} />
                      poné un porcentaje entre 0 y 100.
                    </p>
                  )}
                </Fila>
              </div>
            );
          })}
        </Card>

        {/* ── Equipo ─────────────────────────────────────────────────────── */}
        <Card title="Equipo">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              aria-hidden="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: 32,
                height: 32,
                border: "1px solid var(--color-border-strong)",
                borderRadius: "50%",
                backgroundColor: "var(--color-accent-tint)",
                color: "var(--color-accent-dark)",
              }}
            >
              <Icon name="person" size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: "18px", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
              {user?.email || "tu cuenta"}
            </span>
            <Badge>vos</Badge>
          </div>
          <p className="field-help" style={{ marginTop: 12 }}>
            Por ahora cada cuenta tiene un solo usuario. Todavía no se puede invitar a otras personas.
          </p>
        </Card>

        {/* ── Notificaciones ─────────────────────────────────────────────── */}
        <Card
          title="Notificaciones"
          action={
            user?.email && (
              <span style={{ fontSize: 12, lineHeight: "16px", color: "var(--color-text-secondary)", overflowWrap: "anywhere", textAlign: "right" }}>
                por email a {user.email}
              </span>
            )
          }
        >
          {AVISOS.map((aviso, i) => (
            <div
              key={aviso.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: i === 0 ? "0 0 12px" : i === AVISOS.length - 1 ? "12px 0 0" : "12px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--color-border-subtle)",
              }}
            >
              <div>
                <p id={`aviso-${aviso.key}`} style={{ margin: 0, fontSize: 13, lineHeight: "18px", color: "var(--color-text-primary)" }}>
                  {aviso.label}
                </p>
                <p id={`aviso-${aviso.key}-ayuda`} className="field-help" style={{ marginTop: 2 }}>
                  {aviso.ayuda}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                className="switch"
                aria-checked={config.avisos[aviso.key]}
                aria-labelledby={`aviso-${aviso.key}`}
                aria-describedby={`aviso-${aviso.key}-ayuda`}
                onClick={() => setConfig((c) => ({ ...c, avisos: { ...c.avisos, [aviso.key]: !c.avisos[aviso.key] } }))}
              />
            </div>
          ))}
        </Card>
      </div>

      {/* ── Barra de guardado ────────────────────────────────────────────── */}
      {hayCambios && (
        <div id="barra-guardado" className="savebar" role="region" aria-label="cambios sin guardar">
          <Icon name="edit" size={18} />
          <span style={{ flex: 1 }}>
            {puedeGuardar ? "Tenés cambios sin guardar" : "Corregí los campos marcados para poder guardar"}
          </span>
          <button type="button" className="savebar-discard" disabled={guardando} onClick={() => setConfig(guardado)}>
            descartar
          </button>
          <Button id="btn-guardar-config" variant="primary" size="sm" disabled={guardando || !puedeGuardar} onClick={() => void guardar()}>
            {guardando ? "guardando…" : "guardar cambios"}
          </Button>
        </div>
      )}

      {/* ── Salir sin guardar ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={salirA != null}
        title="¿Salir sin guardar?"
        description="Vas a perder los cambios que hiciste en esta pantalla."
        confirmLabel="salir sin guardar"
        cancelLabel="seguir editando"
        tone="danger"
        onCancel={() => setSalirA(null)}
        onConfirm={() => {
          const destino = salirA;
          setSalirA(null);
          setConfig(guardado); // sin cambios pendientes, la navegación ya no se frena
          if (destino) router.push(destino);
        }}
      />
    </AppLayout>
  );
}
