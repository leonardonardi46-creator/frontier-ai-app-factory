import { NextResponse } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { PROJECT_STARTER_CODE } from "@/lib/project-template";
import { projectCreateSchema } from "@/lib/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { requirements: true, checkpoints: true } } },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const data = projectCreateSchema.parse(await readJson(request));
    const project = await db.project.create({
      data: {
        ...data,
        userId: user.id,
        currentCode: PROJECT_STARTER_CODE,
      },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
