import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { requirementCreateSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const data = requirementCreateSchema.parse(await readJson(request));
    const project = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const requirement = await db.requirement.create({ data: { ...data, projectId } });
    return NextResponse.json({ requirement }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
