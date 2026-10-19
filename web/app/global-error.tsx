"use client";

// Replaces the root layout when it fails, so global CSS and the theme class are not available here (Next 16 docs).
// Styles are inline and follow the OS color scheme.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          colorScheme: "light dark",
          background: "Canvas",
          color: "CanvasText",
        }}
      >
        <title>OrderFit is unavailable</title>
        <main role="alert" style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>OrderFit couldn&apos;t load</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 16px", opacity: 0.8 }}>
            The application failed to start this page. Nothing was saved or sent because of it. Try again in a moment.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, margin: "0 0 16px", opacity: 0.7 }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "#004D3B",
              color: "#FFFAEC",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
