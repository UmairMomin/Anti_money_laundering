import { NextResponse } from "next/server";
import { SERVER_URL_1 } from "@/utils/commonHelper";

const LIST_CONVERSATIONS_URL = `${SERVER_URL_1}/api/chat/conversations`;

export async function GET() {
  try {
    const backendResponse = await fetch(LIST_CONVERSATIONS_URL, {
      method: "GET",
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { error: errorText },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error("Error in conversations proxy:", error);
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
