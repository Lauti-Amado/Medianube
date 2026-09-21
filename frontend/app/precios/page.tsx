"use client";

import { useState } from "react";
import AppLayout from "../../src/src/components/layout/AppLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "panadería" | "pastelería" | "bebidas";

interface Product {
  id: string;
  name: string;
  category: Category;
  cost: number;
  currentPrice: number;
  suggestedPrice: number;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const PRODUCTS: Product[] = [
  { id: "p1", name: "Medialunas de manteca (u.)", category: "panadería",  cost: 180,  currentPrice: 420,  suggestedPrice: 480  },
  { id: "p2", name: "Pan francés (kg)",           category: "panadería",  cost: 920,  currentPrice: 2100, suggestedPrice: 2300 },
  { id: "p3", name: "Torta de chocolate (porción)",category: "pastelería", cost: 650,  currentPrice: 1800, suggestedPrice: 1800 },
  { id: "p4", name: "Café con leche",              category: "bebidas",    cost: 310,  currentPrice: 1400, suggestedPrice: 1550 },
  { id: "p5", name: "Alfajor de maicena (u.)",     category: "pastelería", cost: 210,  currentPrice: 650,  suggestedPrice: 650  },
  { id: "p6", name: "Croissant de jamón y queso",  category: "panadería",  cost: 290,  currentPrice: 700,  suggestedPrice: 820  },
  { id: "p7", name: "Tarta de ricota (porción)",   category: "pastelería", cost: 480,  currentPrice: 1100, suggestedPrice: 1100 },
  { id: "p8", name: "Té con leche",                category: "bebidas",    cost: 180,  currentPrice: 900,  suggestedPrice: 980  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

const variation = (current: number, suggested: number) => {
  if (suggested === current) return null;
  return Math.round(((suggested - current) / current) * 100);
};

const icon: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "14px",
  lineHeight: 1,
  userSelect: "none",
};

const COL = "1.8fr 1fr 80px 110px 110px 90px 80px";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PreciosPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "todas">("todas");

  const filtered = PRODUCTS.filter((p) => {
    const matchSearch =
      search === "" || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "todas" || p.category === category;
    return matchSearch && matchCat;
  });

  const belowMargin = PRODUCTS.filter(
    (p) => p.suggestedPrice > p.currentPrice
  ).length;

  const savings = PRODUCTS.reduce((acc, p) => {
    const diff = p.suggestedPrice - p.currentPrice;
    return acc + (diff > 0 ? diff : 0);
  }, 0);

  return (
    <AppLayout activeTab="precios">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Precios sugeridos
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                margin: "4px 0 0",
              }}
            >
              Ajustados según costo actual e inflación · actualizado hace 2 horas
            </p>
          </div>

          <button
            id="btn-recalcular-ia"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "var(--color-accent)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ ...icon, fontSize: 15 }}>autorenew</span>
            Recalcular con IA
          </button>
        </div>

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "Margen promedio",
              value: "36%",
              sub: "sobre precio de venta actual",
            },
            {
              label: "Productos bajo margen objetivo",
              value: String(belowMargin),
              sub: "requieren ajuste de precio",
            },
            {
              label: "Ahorro potencial estimado",
              value: fmt(savings) + "/mes",
              sub: "si se aplican todos los sugeridos",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                {kpi.label}
              </span>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  marginBottom: 4,
                }}
              >
                {kpi.value}
              </div>
              <span
                style={{ fontSize: 11, color: "var(--color-text-muted)" }}
              >
                {kpi.sub}
              </span>
            </div>
          ))}
        </div>

        {/* ── Tabla ───────────────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "14px 16px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  ...icon,
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-muted)",
                }}
              >
                search
              </span>
              <input
                id="search-precios"
                type="text"
                placeholder="Buscar producto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: 32,
                  paddingRight: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  fontSize: 13,
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  backgroundColor: "var(--color-surface-input)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <select
              id="filter-categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "todas")}
              style={{
                fontSize: 13,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                backgroundColor: "var(--color-surface-input)",
                color: "var(--color-text-primary)",
                padding: "8px 10px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="todas">Todas las categorías</option>
              <option value="panadería">Panadería</option>
              <option value="pastelería">Pastelería</option>
              <option value="bebidas">Bebidas</option>
            </select>
          </div>

          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COL,
              columnGap: 16,
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {[
              { label: "Producto", align: "left" },
              { label: "Categoría", align: "left" },
              { label: "Costo", align: "right" },
              { label: "Precio actual", align: "right" },
              { label: "Sugerido", align: "right" },
              { label: "Variación", align: "center" },
              { label: "Acción", align: "right" },
            ].map((h) => (
              <span
                key={h.label}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: h.align as React.CSSProperties["textAlign"],
                }}
              >
                {h.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((p, idx) => {
            const pct = variation(p.currentPrice, p.suggestedPrice);
            const isUpToDate = pct === null || pct === 0;

            return (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: COL,
                  columnGap: 16,
                  padding: "12px 16px",
                  alignItems: "center",
                  borderBottom:
                    idx < filtered.length - 1
                      ? "1px solid #F5EBDF"
                      : "none",
                }}
              >
                {/* Producto */}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {p.name}
                </div>

                {/* Categoría */}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {p.category}
                </div>

                {/* Costo */}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    textAlign: "right",
                  }}
                >
                  {fmt(p.cost)}
                </div>

                {/* Precio actual */}
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-primary)",
                    textAlign: "right",
                  }}
                >
                  {fmt(p.currentPrice)}
                </div>

                {/* Sugerido */}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isUpToDate ? 400 : 500,
                    color: isUpToDate
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-primary)",
                    textAlign: "right",
                  }}
                >
                  {fmt(p.suggestedPrice)}
                </div>

                {/* Variación */}
                <div style={{ textAlign: "center" }}>
                  {isUpToDate ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 6,
                        backgroundColor: "var(--color-neutral-bg)",
                        color: "var(--color-neutral-text)",
                      }}
                    >
                      estable
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "3px 8px",
                        borderRadius: 6,
                        backgroundColor: "var(--color-warning-bg)",
                        color: "var(--color-warning-text)",
                      }}
                    >
                      +{pct}%
                    </span>
                  )}
                </div>

                {/* Acción */}
                <div style={{ textAlign: "right" }}>
                  {isUpToDate ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                        padding: "4px 10px",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        cursor: "default",
                      }}
                    >
                      al día
                    </span>
                  ) : (
                    <button
                      id={"btn-aplicar-" + p.id}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                        backgroundColor: "transparent",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        cursor: "pointer",
                      }}
                    >
                      aplicar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}