import { NextResponse } from "next/server";
import { SERVER_URL_1 } from "@/utils/commonHelper";

const baseUrl = `${SERVER_URL_1}/api/chat/conversations`;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const backendResponse = await fetch(`${baseUrl}/${params.id}`, {
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
    console.error("Error in conversation proxy:", error);
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const backendResponse = await fetch(`${baseUrl}/${params.id}`, {
      method: "DELETE",
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json(
        { error: errorText },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error("Error in conversation delete proxy:", error);
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
