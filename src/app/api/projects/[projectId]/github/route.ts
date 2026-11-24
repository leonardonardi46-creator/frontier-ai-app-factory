import { z } from "zod";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole, isSameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, forbidden, readJson, unauthorized } from "@/lib/http";

const publishSchema = z.object({
  token: z.string().min(1).max(500),
  repository: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/),
  isPrivate: z.boolean().default(true),
});

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request)) return forbidden();
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const { projectId } = await params;
    const { token, repository, isPrivate } = publishSchema.parse(await readJson(request));
    const project = await db.project.findFirst({
      where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const created = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repository,
        description: project.description || project.name,
        private: isPrivate,
        auto_init: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!created.ok) {
      const response = await created.json().catch(() => ({})) as { message?: string };
      return NextResponse.json(
        { error: response.message || `GitHub repository creation failed (${created.status})` },
        { status: created.status === 401 ? 401 : created.status === 403 ? 403 : created.status === 422 ? 409 : 502 },
      );
    }
    const repoData = await created.json() as { full_name: string; default_branch: string; html_url: string };
    const repositoryPath = repoData.full_name.split("/").map(encodeURIComponent).join("/");
    const content = Buffer.from(project.currentCode, "utf8").toString("base64");
    const uploaded = await fetch(
      `https://api.github.com/repos/${repositoryPath}/contents/App.tsx`,
      {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Add app source from Frontier AI App Factory",
          content,
          branch: repoData.default_branch,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!uploaded.ok) {
      const response = await uploaded.json().catch(() => ({})) as { message?: string };
      return NextResponse.json({
        error: `Repository created, but source upload failed: ${response.message || uploaded.status}`,
        repositoryUrl: repoData.html_url,
      }, { status: 502 });
    }
    return NextResponse.json({ repositoryUrl: repoData.html_url }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
