"use client";

import { use } from "react";
import { ContainerOverview } from "@/components/hierarchy/container-overview";

export default function SpaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; teamId: string }>;
}) {
  const { workspaceId, teamId } = use(params);
  return <ContainerOverview workspaceId={workspaceId} teamId={teamId} />;
}
