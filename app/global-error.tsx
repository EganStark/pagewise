"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#151514",
            color: "#ededed",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <section
            style={{
              width: "min(100%, 520px)",
              padding: 32,
              border: "1px solid #34312d",
              borderRadius: 14,
              background: "#211f1c",
            }}
          >
            <p
              style={{
                color: "#e0995e",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: ".08em",
              }}
            >
              Pagewise recovery
            </p>
            <h1 style={{ margin: "10px 0", fontSize: 30 }}>
              Pagewise needs a fresh start
            </h1>
            <p style={{ color: "#aaa49c", lineHeight: 1.6 }}>
              Your saved library remains untouched. Reload the application to
              reconnect the interface.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 14,
                padding: "11px 16px",
                color: "#181512",
                background: "#e0995e",
                border: 0,
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload Pagewise
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
