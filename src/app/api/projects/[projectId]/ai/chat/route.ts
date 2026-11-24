import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { loadAttachments } from "@/lib/ai/attachments";
import { AIProviderError, NvidiaProvider, type NvidiaMessage } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { aiChatSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const input = aiChatSchema.parse(await readJson(request));
    const project = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!process.env.NVIDIA_API_KEY) {
      return NextResponse.json({ error: "NVIDIA_API_KEY is not configured" }, { status: 503 });
    }
    if (input.messages.at(-1)?.role !== "user") {
      return NextResponse.json({ error: "The latest chat message must be from the user" }, { status: 400 });
    }

    const attachments = await loadAttachments(projectId, input.attachments);
    const messages: NvidiaMessage[] = [
      {
        role: "system",
        content: "You are a helpful general-purpose AI assistant. Answer clearly and accurately in the user's language. Use the conversation history. Be honest about uncertainty and about any attached files that could not be read.",
      },
      ...input.messages.slice(0, -1),
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              input.messages.at(-1)?.content ?? "",
              attachments.context ? `Attached-file context:\n${attachments.context}` : "",
            ].filter(Boolean).join("\n\n"),
          },
          ...attachments.images.map(({ mimeType, base64 }) => ({
            type: "image_url" as const,
            image_url: { url: `data:${mimeType};base64,${base64}` },
          })),
        ],
      },
    ];
    const message = await new NvidiaProvider().chat(messages);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
