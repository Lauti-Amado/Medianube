import Sidebar, { ActiveTab } from "./Sidebar";

export default function AppLayout({
  activeTab,
  children,
}: {
  activeTab: ActiveTab;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <Sidebar activeTab={activeTab} />
      <main
        style={{
          flex: 1,
          padding: "28px 32px",
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
