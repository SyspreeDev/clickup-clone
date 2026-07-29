import { redirect } from "next/navigation";

/** A bare list URL opens the List view, which is the default. */
export default async function ProjectIndexPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  redirect(`/workspace/${workspaceId}/projects/${projectId}/list`);
}
