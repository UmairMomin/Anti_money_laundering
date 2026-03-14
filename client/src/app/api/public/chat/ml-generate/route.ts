import { NextResponse } from "next/server";
import { SERVER_URL_1 } from "@/utils/commonHelper";

const ML_GENERATE_API_URL = `${SERVER_URL_1}/api/chat/ml-generate`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const backendResponse = await fetch(ML_GENERATE_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: body.prompt,
        pattern: body.pattern || undefined,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { error: errorText },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error in public chat ml-generate proxy:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { stack: error.stack }
          : {}),
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
