import { NextResponse } from "next/server";
import { destroySession, isSameOrigin } from "@/lib/auth";
import { apiError, forbidden } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
