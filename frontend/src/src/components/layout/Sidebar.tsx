"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import Icon from "../ui/Icon";

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

const divider: React.CSSProperties = {
  height: "1px",
  backgroundColor: "var(--color-sidebar-divider)",
};

export default function Sidebar({ activeTab }: { activeTab: ActiveTab }) {
  const router = useRouter();
  const { signOut } = useAuth();

  function handleLogout() {
    signOut();
    router.push("/login");
  }

  return (
    <aside
      className="sidebar"
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
      {/* ── Marca ─────────────────────────────────────── */}
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
            fontWeight: 500,
            color: "var(--color-sidebar-text)",
            letterSpacing: "0.01em",
          }}
        >
          medianube
        </span>
      </div>

      {/* ── CTA global: subir factura ─────────────────── */}
      <div style={{ padding: "0 12px", marginBottom: "20px" }}>
        <Link href="/compras/subir" id="sidebar-upload-invoice" className="sb-cta">
          <Icon name="upload_file" size={16} />
          subir factura
        </Link>
      </div>

      <div style={{ ...divider, margin: "0 12px 12px" }} />

      {/* ── Navegación ────────────────────────────────── */}
      <nav
        aria-label="principal"
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", padding: "0 8px" }}
      >
        {NAV_ITEMS.map(({ tab, label, icon, href }) => (
          <Link
            key={tab}
            href={href}
            id={"sidebar-tab-" + tab}
            className="sb-item"
            aria-current={tab === activeTab ? "page" : undefined}
          >
            <Icon name={icon} size={18} />
            {label}
          </Link>
        ))}
      </nav>

      <div style={{ ...divider, margin: "12px 12px 0" }} />

      {/* ── Cuenta ────────────────────────────────────── */}
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
          className="sb-item"
          aria-current={activeTab === "configuracion" ? "page" : undefined}
        >
          <Icon name="settings" size={18} />
          Configuración
        </Link>
        <button type="button" id="sidebar-logout" className="sb-item" onClick={handleLogout}>
          <Icon name="logout" size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
