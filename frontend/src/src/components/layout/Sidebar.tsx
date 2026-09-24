"use client";

import Link from "next/link";
import Image from "next/image";

export type ActiveTab = "dashboard" | "compras" | "precios" | "demanda" | "configuracion";

const NAV_ITEMS: {
  tab: ActiveTab;
  label: string;
  icon: string;
  href: string;
}[] = [
    { tab: "dashboard", label: "Dashboard", icon: "grid_view", href: "/dashboard" },
    { tab: "compras", label: "Compras", icon: "receipt_long", href: "/compras" },
    { tab: "precios", label: "Precios", icon: "sell", href: "/precios" },
    { tab: "demanda", label: "Demanda", icon: "trending_up", href: "/demanda" },
  ];

const iconStyle: React.CSSProperties = {
  fontFamily: "Material Symbols Outlined",
  fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20",
  fontSize: "18px",
  lineHeight: 1,
  userSelect: "none",
  flexShrink: 0,
};

export default function Sidebar({ activeTab }: { activeTab: ActiveTab }) {
  return (
    <aside
      style={{
        width: "224px",
        minWidth: "224px",
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-sidebar-bg)",
        borderRight: "1px solid var(--color-sidebar-border)",
        padding: "20px 0",
        boxSizing: "border-box",
      }}
    >
      {/* ── Brand Mark ───────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "9999px",
            border: "1.5px solid rgba(255,255,255,0.18)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Image
            src="/medianube-logo.jpeg"
            alt="medianube logo"
            width={34}
            height={34}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
            priority
          />
        </div>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--color-sidebar-text)",
            letterSpacing: "0.01em",
          }}
        >
          medianube
        </span>
      </div>

      {/* ── CTA: Subir Factura ────────────────────────── */}
      <div style={{ padding: "0 12px", marginBottom: "20px" }}>
        <Link
          href="/compras/subir"
          id="sidebar-upload-invoice"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "9px 12px",
            backgroundColor: "var(--color-sidebar-upload-bg)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "var(--radius-md)",
            color: "#FFFFFF",
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-sidebar-upload-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-sidebar-upload-bg)";
          }}
        >
          <span style={{ ...iconStyle, color: "#FFFFFF", fontSize: "16px" }}>upload_file</span>
          subir factura
        </Link>
      </div>

      {/* ── Divider ───────────────────────────────────── */}
      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-sidebar-divider)",
          margin: "0 12px 14px",
        }}
      />

      {/* ── Navigation Items ─────────────────────────── */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", padding: "0 8px" }}>
        <p
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--color-sidebar-text-label)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            margin: "0 0 8px 10px",
          }}
        >
          Navegación
        </p>
        {NAV_ITEMS.map(({ tab, label, icon, href }) => {
          const isActive = tab === activeTab;
          return (
            <Link
              key={tab}
              href={href}
              id={"sidebar-tab-" + tab}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 10px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isActive ? "var(--color-sidebar-active-bg)" : "transparent",
                color: isActive ? "var(--color-sidebar-active-text)" : "var(--color-sidebar-text)",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                transition: "background-color 0.15s",
                borderLeft: isActive ? "2px solid var(--color-sidebar-active-border)" : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = "var(--color-sidebar-hover-bg)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span
                style={{
                  ...iconStyle,
                  color: isActive ? "var(--color-sidebar-active-text)" : "var(--color-sidebar-text)",
                }}
              >
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Divider bottom ────────────────────────────── */}
      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-sidebar-divider)",
          margin: "12px 12px 0",
        }}
      />

      {/* ── Bottom Actions ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "10px 8px 0",
        }}
      >
        <Link
          href="/configuracion"
          id="sidebar-settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 10px",
            borderRadius: "var(--radius-md)",
            color: "var(--color-sidebar-text)",
            fontSize: "14px",
            textDecoration: "none",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-sidebar-hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span style={{ ...iconStyle, color: "var(--color-sidebar-text)" }}>settings</span>
          Configuración
        </Link>
        <Link
          href="/login"
          id="sidebar-logout"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 10px",
            borderRadius: "var(--radius-md)",
            color: "var(--color-sidebar-text)",
            fontSize: "14px",
            textDecoration: "none",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--color-sidebar-hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span style={{ ...iconStyle, color: "var(--color-sidebar-text)" }}>logout</span>
          Cerrar sesión
        </Link>
      </div>
    </aside>
  );
}
