import ProjectEditor from "@/components/ProjectEditor";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  return <ProjectEditor projectId={projectId} />;
}
