import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, unauthorized } from "@/lib/http";

type RouteContext = { params: Promise<{ checkpointId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { checkpointId } = await params;
    const checkpoint = await db.checkpoint.findFirst({
      where: {
        id: checkpointId,
        project: { ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      },
    });
    if (!checkpoint) return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    await db.$transaction(async (transaction) => {
      const currentProject = await transaction.project.findUniqueOrThrow({
        where: { id: checkpoint.projectId },
        select: { currentCode: true },
      });
      await transaction.checkpoint.create({
        data: {
          projectId: checkpoint.projectId,
          label: `Before restoring: ${checkpoint.label}`,
          code: currentProject.currentCode,
        },
      });
      await transaction.project.update({
        where: { id: checkpoint.projectId },
        data: { currentCode: checkpoint.code },
      });
      await transaction.checkpoint.create({
        data: {
          projectId: checkpoint.projectId,
          label: `Restored: ${checkpoint.label}`,
          code: checkpoint.code,
        },
      });
    });
    return NextResponse.json({ success: true, code: checkpoint.code });
  } catch (error) {
    return apiError(error);
  }
}
