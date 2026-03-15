import { NextResponse } from "next/server";

/**
 * Proxies to POST /classify (e.g. api/app.py).
 * Body: Option 1 — { pattern: "P1", sample: { sample_id, entities, transactions, features } }
 *       Option 2 — { P1: { ... }, P2: { ... }, ... }
 * Env: CLASSIFY_API_URL = base URL only (e.g. http://localhost:5002). Path /classify is appended.
 */
const CLASSIFY_BASE = process.env.CLASSIFY_API_URL || "http://localhost:8000";
const CLASSIFY_ENDPOINT = `${CLASSIFY_BASE.replace(/\/$/, "")}/classify`;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(CLASSIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data || text || res.statusText },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Classify API proxy error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Classification request failed",
      },
      { status: 500 }
    );
  }
}
