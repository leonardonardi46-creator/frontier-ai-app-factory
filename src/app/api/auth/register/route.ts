import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson } from "@/lib/http";
import { credentialsSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    const { email, password } = credentialsSchema.parse(await readJson(request));
    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, role: true },
    });
    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    return apiError(error);
  }
}
