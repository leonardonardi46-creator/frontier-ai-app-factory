import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson } from "@/lib/http";
import { credentialsSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    const { email, password } = credentialsSchema.parse(await readJson(request));
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is incorrect" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    return apiError(error);
  }
}
