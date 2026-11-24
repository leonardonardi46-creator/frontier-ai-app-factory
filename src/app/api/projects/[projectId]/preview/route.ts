import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, unauthorized } from "@/lib/http";
import { compilePreview, PreviewCompileError } from "@/lib/preview";

export const runtime = "nodejs";

const previewSchema = z.object({ code: z.string().max(500_000) });
type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const { code } = previewSchema.parse(await request.json());
    const project = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    try {
      const javascript = await compilePreview(code);
      return NextResponse.json({ javascript });
    } catch (error) {
      if (error instanceof PreviewCompileError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
