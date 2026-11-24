import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { codeUpdateSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const { code, label } = codeUpdateSchema.parse(await readJson(request));
    const access = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      select: { id: true },
    });
    if (!access) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const project = await db.$transaction(async (transaction) => {
      const updated = await transaction.project.update({
        where: { id: projectId },
        data: { currentCode: code },
      });
      await transaction.checkpoint.create({ data: { projectId, label, code } });
      return updated;
    });
    return NextResponse.json({ project });
  } catch (error) {
    return apiError(error);
  }
}
