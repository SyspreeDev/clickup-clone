"use client";

import { use } from "react";
import { ContainerOverview } from "@/components/hierarchy/container-overview";

export default function FolderOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; folderId: string }>;
}) {
  const { workspaceId, folderId } = use(params);
  return <ContainerOverview workspaceId={workspaceId} folderId={folderId} />;
}
