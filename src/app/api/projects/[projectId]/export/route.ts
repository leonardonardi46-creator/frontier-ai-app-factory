import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { unauthorized } from "@/lib/http";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { projectId } = await params;
  const project = await db.project.findFirst({
    where: { id: projectId, ...(hasRole(user.role, "ADMIN") ? {} : { userId: user.id }) },
    include: { requirements: { orderBy: { createdAt: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const zip = new JSZip();
  zip.file("App.tsx", project.currentCode);
  zip.file(
    "README.md",
    `# ${project.name}\n\n${project.description}\n\n## Requirements\n\n${project.requirements
      .map((item) => `- [${item.completed ? "x" : " "}] ${item.title}${item.details ? ` — ${item.details}` : ""}`)
      .join("\n")}\n\n## Development\n\nCopy \`App.tsx\` into a React project and install its dependencies.\n`,
  );
  const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const safeName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return new NextResponse(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
