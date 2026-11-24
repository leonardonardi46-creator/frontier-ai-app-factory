import { del, issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { attachmentReferenceSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ projectId: string }> };
const MAX_BLOB_SIZE = 5 * 1024 ** 4;

async function getOwnedProject(projectId: string, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return db.project.findFirst({
    where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
    select: { id: true },
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { projectId } = await params;
  if (!(await getOwnedProject(projectId, user))) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!process.env.BLOB_WEBHOOK_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Connect a private Vercel Blob store to enable file uploads" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json() as HandleUploadPresignedBody;
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        let payload: { projectId?: string };
        try {
          payload = JSON.parse(clientPayload ?? "") as { projectId?: string };
        } catch {
          throw new Error("Invalid upload request");
        }
        if (payload.projectId !== projectId || !pathname.startsWith(`chat/${projectId}/`)) {
          throw new Error("Upload is not authorized for this project");
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          maximumSizeInBytes: MAX_BLOB_SIZE,
        });
        return {
          token,
          urlOptions: {
            maximumSizeInBytes: MAX_BLOB_SIZE,
            ttlDays: 30,
          },
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    if (!(await getOwnedProject(projectId, user))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const attachment = attachmentReferenceSchema.parse(await readJson(request));
    if (!attachment.pathname.startsWith(`chat/${projectId}/`)) {
      return forbidden();
    }
    await del(attachment.pathname);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
