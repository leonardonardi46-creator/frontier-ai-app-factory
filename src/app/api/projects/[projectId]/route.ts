import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { projectUpdateSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { projectId } = await params;
  const project = await db.project.findFirst({
    where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
    include: {
      requirements: { orderBy: { createdAt: "asc" } },
      checkpoints: {
        orderBy: { createdAt: "desc" },
        select: { id: true, label: true, createdAt: true },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const data = projectUpdateSchema.parse(await readJson(request));
    const access = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      select: { id: true },
    });
    if (!access) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const project = await db.project.update({ where: { id: projectId }, data });
    return NextResponse.json({ project });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { projectId } = await params;
  const result = await db.project.deleteMany({
    where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
  });
  if (!result.count) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
