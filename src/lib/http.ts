import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", details: error.issues },
      { status: 400 },
    );
  }
  console.error("API request failed", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function readJson(request: Request) {
  return request.json() as Promise<unknown>;
}
