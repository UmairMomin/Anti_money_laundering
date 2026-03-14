// app/graph/page.jsx (App Router)
// If using Pages Router, remove "use client" from NetworkGraph and adjust imports.

import NetworkGraph from "@/components/NetworkGraph";

export const metadata = {
  title: "Network Graph – Live Stream with Neo4j Thinking",
};

export default function GraphPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#020817",
        padding: "40px 24px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Page header */}
      <div style={{ maxWidth: 1100, margin: "0 auto 32px" }}>
        <h1
          style={{
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: 800,
            color: "#f1f5f9",
            letterSpacing: "-0.03em",
            marginBottom: 8,
          }}
        >
          Network Graph{" "}
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#34d399",
              marginLeft: 12,
            }}
          >
            🔴 LIVE (updates every 10s)
          </span>
        </h1>
        <p style={{ color: "#475569", fontSize: 14 }}>
          Data streams via SSE · Watch Neo4j think before each update · Click a
          node to inspect
        </p>
      </div>

      {/* Graph */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <NetworkGraph
          apiUrl={
            process.env.NEXT_PUBLIC_API_URL
              ? `${process.env.NEXT_PUBLIC_API_URL}/api/graph`
              : "http://localhost:5001/api/graph"
          }
          useStreaming={true} // enable SSE
          height={620}
        />
      </div>
    </main>
  );
}
