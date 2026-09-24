"use client";

import Link from "next/link";
import { useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";

// ── Types & mock data ──────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  role: string;
  initials: string;
}

const MEMBERS: Member[] = [
  { id: "m1", name: "Rodrigo García",  role: "Dueño",          initials: "RG" },
  { id: "m2", name: "Valentina López", role: "Administración",  initials: "VL" },
  { id: "m3", name: "Marcos Ibáñez",   role: "Producción",      initials: "MI" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const icon: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "14px",
  lineHeight: 1,
  userSelect: "none",
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 10,
        paddingBottom: 10,
        borderBottom: "1px solid #F5EBDF",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)", minWidth: 180 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        backgroundColor: value ? "var(--color-accent)" : "var(--color-border)",
        position: "relative",
        cursor: "pointer",
        transition: "background-color 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: value ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  // Datos del negocio
  const [businessName, setBusinessName] = useState("Panadería Central");
  const [branches, setBranches] = useState("1");

  // Márgenes
  const [margins, setMargins] = useState({
    panadería: "40",
    pastelería: "45",
    bebidas: "60",
  });

  // Notificaciones
  const [notifs, setNotifs] = useState({
    precios: true,
    faltante: true,
    demanda: false,
  });

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-surface-input)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    padding: "6px 10px",
    outline: "none",
    width: 220,
    textAlign: "right" as const,
  };

  return (
    <AppLayout activeTab="configuracion">
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "var(--color-text-muted)",
              textDecoration: "none",
              marginBottom: 12,
            }}
          >
            <span style={{ ...icon, fontSize: 13 }}>arrow_back</span>
            Volver al dashboard
          </Link>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Configuración
          </h1>
        </div>

        {/* ── Datos del negocio ────────────────────────────────────────── */}
        <SectionCard title="Datos del negocio">
          <FieldRow label="Nombre del negocio">
            <input
              id="input-nombre-negocio"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Tipo de negocio">
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Panadería
            </span>
          </FieldRow>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 10,
            }}
          >
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)", minWidth: 180 }}>
              Sucursales
            </span>
            <input
              id="input-sucursales"
              type="number"
              min={1}
              value={branches}
              onChange={(e) => setBranches(e.target.value)}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
        </SectionCard>

        {/* ── Márgenes objetivo ────────────────────────────────────────── */}
        <SectionCard title="Márgenes objetivo por categoría">
          {(Object.keys(margins) as (keyof typeof margins)[]).map((cat, idx, arr) => (
            <div
              key={cat}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom: idx < arr.length - 1 ? "1px solid #F5EBDF" : "none",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)", textTransform: "capitalize" }}>
                {cat}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  id={`input-margen-${cat}`}
                  type="number"
                  min={0}
                  max={100}
                  value={margins[cat]}
                  onChange={(e) =>
                    setMargins((prev) => ({ ...prev, [cat]: e.target.value }))
                  }
                  style={{ ...inputStyle, width: 70 }}
                />
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>%</span>
              </div>
            </div>
          ))}
        </SectionCard>

        {/* ── Equipo ───────────────────────────────────────────────────── */}
        <SectionCard title="Equipo">
          {MEMBERS.map((m, idx) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom: idx < MEMBERS.length - 1 ? "1px solid #F5EBDF" : "none",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "var(--color-tint-accent)",
                  border: "1px solid var(--color-border-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-accent-dark)",
                  flexShrink: 0,
                }}
              >
                {m.initials}
              </div>
              <span style={{ fontSize: 13, color: "var(--color-text-primary)", flex: 1 }}>
                {m.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 6,
                  backgroundColor: "var(--color-neutral-bg)",
                  color: "var(--color-neutral-text)",
                }}
              >
                {m.role}
              </span>
            </div>
          ))}
          <div style={{ paddingTop: 12 }}>
            <button
              id="btn-invitar-miembro"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 13,
                color: "var(--color-accent)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontWeight: 500,
              }}
            >
              <span style={{ ...icon, fontSize: 15 }}>person_add</span>
              Invitar miembro
            </button>
          </div>
        </SectionCard>

        {/* ── Notificaciones ───────────────────────────────────────────── */}
        <SectionCard title="Notificaciones">
          {[
            { key: "precios" as const,  label: "Alertas de precio",             sub: "Cuando un insumo supera el margen objetivo" },
            { key: "faltante" as const, label: "Riesgo de faltante de stock",    sub: "Cuando la predicción detecta posible faltante" },
            { key: "demanda" as const,  label: "Picos de demanda previstos",     sub: "Cuando se proyecta un día de producción alta" },
          ].map((n, idx, arr) => (
            <div
              key={n.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom: idx < arr.length - 1 ? "1px solid #F5EBDF" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginBottom: 2 }}>
                  {n.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{n.sub}</div>
              </div>
              <Toggle
                value={notifs[n.key]}
                onChange={(v) => setNotifs((prev) => ({ ...prev, [n.key]: v })) }
              />
            </div>
          ))}
        </SectionCard>

        {/* ── Guardar ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 32 }}>
          <button
            id="btn-guardar-config"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            Guardar cambios
          </button>
        </div>

      </div>
    </AppLayout>
  );
}