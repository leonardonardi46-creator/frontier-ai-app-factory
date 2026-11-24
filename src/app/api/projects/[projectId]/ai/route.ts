import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { createAIProvider, isOllamaAvailable } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";
import { compilePreview, PreviewCompileError } from "@/lib/preview";
import { generateSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const input = generateSchema.parse(await readJson(request));
    const project = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
      include: { requirements: { select: { title: true, details: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const providerName = input.provider ?? process.env.AI_PROVIDER ?? "openai";
    if (providerName !== "openai" && providerName !== "anthropic" && providerName !== "ollama") {
      return NextResponse.json({ error: "Unsupported AI provider" }, { status: 400 });
    }
    if (providerName === "ollama" && !(await isOllamaAvailable())) {
      return NextResponse.json(
        { error: "Ollama is not reachable; start the local Ollama server and try again" },
        { status: 503 },
      );
    }
    const key = providerName === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
    if (providerName !== "ollama" && !key) {
      return NextResponse.json(
        { error: `${providerName === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} is not configured` },
        { status: 503 },
      );
    }

    const generationInput = {
      instruction: input.instruction,
      currentCode: input.currentCode ?? project.currentCode,
      requirements: project.requirements,
    };
    const provider = createAIProvider(providerName);
    let code = await provider.generate(generationInput);
    if (code.length > 500_000) {
      return NextResponse.json({ error: "Generated source exceeds the 500 KB project limit" }, { status: 502 });
    }
    try {
      await compilePreview(code);
    } catch (error) {
      if (!(error instanceof PreviewCompileError)) throw error;
      code = await provider.generate({
        ...generationInput,
        instruction: [
          "Repair the complete React component below so it compiles as self-contained TSX.",
          "Preserve the user's requested features. Do not add package imports.",
          `Original request: ${input.instruction}`,
          `Compiler errors:\n${error.message}`,
        ].join("\n\n"),
        currentCode: code,
      });
      if (code.length > 500_000) {
        return NextResponse.json({ error: "Generated source exceeds the 500 KB project limit" }, { status: 502 });
      }
      try {
        await compilePreview(code);
      } catch (repairError) {
        if (repairError instanceof PreviewCompileError) {
          return NextResponse.json(
            { error: `The generated app still has compile errors: ${repairError.message}` },
            { status: 422 },
          );
        }
        throw repairError;
      }
    }
    const updatedProject = await db.$transaction(async (transaction) => {
      const updated = await transaction.project.update({
        where: { id: project.id },
        data: { currentCode: code },
      });
      await transaction.checkpoint.create({
        data: { projectId: project.id, label: `AI update (${providerName})`, code },
      });
      return updated;
    });
    return NextResponse.json({ project: updatedProject, code, provider: providerName });
  } catch (error) {
    return apiError(error);
  }
}
