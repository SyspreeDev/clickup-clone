"use client";

import { use } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { TaskDetailDialog } from "@/components/task/task-detail-dialog";
import { PriorityIcon, priorityLabel } from "@/components/task/priority-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskDetailStore } from "@/stores/task-detail-store";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/lib/queries/projects";
import type { TaskSummary } from "@/lib/queries/tasks";
import { DEFAULT_TASK_FILTERS, TaskFilterBar, filterTasks } from "@/components/views/task-filter-bar";
import { useAuthStore } from "@/stores/auth-store";

const columnHelper = createColumnHelper<TaskSummary>();

export default function TableViewPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId) });
  const { data: tasks, isLoading } = useProjectTasks(projectId);
  const openTask = useTaskDetailStore((s) => s.openTask);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS);
  const userId = useAuthStore((s) => s.user?.id);
  const allTasks = tasks ?? [];
  const filteredTasks = filterTasks(allTasks, filters, userId);

  const columns = [
    columnHelper.accessor((row) => `${project?.key ?? ""}-${row.number}`, {
      id: "id",
      header: "ID",
      cell: (info) => <span className="text-xs font-medium text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor("title", {
      header: "Title",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor((row) => row.workflowState.name, {
      id: "status",
      header: "Status",
      cell: (info) => {
        const row = info.row.original;
        return (
          <span className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.workflowState.color }} />
            {row.workflowState.name}
          </span>
        );
      },
    }),
    columnHelper.accessor("priority", {
      header: "Priority",
      cell: (info) => (
        <span className="flex items-center gap-1.5 text-sm">
          <PriorityIcon priority={info.getValue()} />
          {priorityLabel(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.assignees[0]?.user.name ?? "", {
      id: "assignee",
      header: "Assignee",
      cell: (info) => {
        const row = info.row.original;
        const assignee = row.assignees[0];
        if (!assignee) return <span className="text-xs text-muted-foreground">Unassigned</span>;
        return (
          <span className="flex items-center gap-1.5 text-sm">
            <Avatar className="h-5 w-5">
              <AvatarImage src={assignee.user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[9px]">{assignee.user.name[0]}</AvatarFallback>
            </Avatar>
            {assignee.user.name}
          </span>
        );
      },
    }),
    columnHelper.accessor("dueDate", {
      header: "Due date",
      cell: (info) => {
        const value = info.getValue();
        return value ? <span className="text-sm">{format(new Date(value), "MMM d, yyyy")}</span> : <span className="text-xs text-muted-foreground">—</span>;
      },
    }),
  ];

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <>
        <TopNav />
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <TaskFilterBar filters={filters} onChange={setFilters} totalCount={allTasks.length} filteredCount={filteredTasks.length} />
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    <button
                      className="flex items-center gap-1"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => openTask(row.original.id)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!allTasks.length && <p className="p-6 text-center text-sm text-muted-foreground">No tasks yet.</p>}
        {!!allTasks.length && !filteredTasks.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">No tasks match these filters.</p>
        )}
      </div>
      <TaskDetailDialog />
    </>
  );
}
