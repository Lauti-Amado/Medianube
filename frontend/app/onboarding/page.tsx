export default function OnboardingStub() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-bg)",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <p style={{ color: "var(--color-text-primary)", fontSize: "14px", fontWeight: 500 }}>
        onboarding — próximamente
      </p>
      <a
        href="/login"
        style={{ color: "var(--color-accent)", fontSize: "12px", textDecoration: "none" }}
      >
        ← volver al login
      </a>
    </main>
  );
}
