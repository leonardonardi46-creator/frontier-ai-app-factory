import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { requirementUpdateSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ requirementId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { requirementId } = await params;
    const data = requirementUpdateSchema.parse(await readJson(request));
    const access = await db.requirement.findFirst({
      where: {
        id: requirementId,
        project: { ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      },
      select: { id: true },
    });
    if (!access) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
    const requirement = await db.requirement.update({ where: { id: requirementId }, data });
    return NextResponse.json({ requirement });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { requirementId } = await params;
  const result = await db.requirement.deleteMany({
    where: {
      id: requirementId,
      project: { ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
    },
  });
  if (!result.count) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
