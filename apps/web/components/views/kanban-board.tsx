"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTasks, moveTask, type TaskSummary } from "@/lib/queries/tasks";
import type { WorkflowState } from "@/lib/queries/projects";
import { TaskCard } from "@/components/task/task-card";
import { CreateTaskDialog } from "@/components/task/create-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";

function Column({
  state,
  tasks,
  projectId,
  projectKey,
}: {
  state: WorkflowState;
  tasks: TaskSummary[];
  projectId: string;
  projectKey: string;
}) {
  const { setNodeRef } = useDroppable({ id: state.id });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: state.color }} />
          <span className="text-sm font-medium">{state.name}</span>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto scrollbar-thin px-2 pb-2" style={{ minHeight: 40 }}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} projectKey={projectKey} />
          ))}
        </div>
      </SortableContext>
      <div className="p-2 pt-0">
        <CreateTaskDialog projectId={projectId} workflowStateId={state.id} />
      </div>
    </div>
  );
}

export function KanbanBoard({
  projectId,
  projectKey,
  workflowStates,
}: {
  projectId: string;
  projectKey: string;
  workflowStates: WorkflowState[];
}) {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => listTasks(projectId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const [columns, setColumns] = useState<Record<string, TaskSummary[]>>({});
  const [activeTask, setActiveTask] = useState<TaskSummary | null>(null);

  useEffect(() => {
    if (!tasks) return;
    const grouped: Record<string, TaskSummary[]> = {};
    for (const state of workflowStates) grouped[state.id] = [];
    for (const task of tasks) {
      (grouped[task.workflowStateId] ??= []).push(task);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.position - b.position);
    }
    setColumns(grouped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, workflowStates.length]);

  const moveMutation = useMutation({
    mutationFn: ({ taskId, workflowStateId, position }: { taskId: string; workflowStateId: string; position: number }) =>
      moveTask(taskId, { workflowStateId, position }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const taskLookup = useMemo(() => {
    const map = new Map<string, { task: TaskSummary; columnId: string }>();
    for (const [columnId, list] of Object.entries(columns)) {
      for (const task of list) map.set(task.id, { task, columnId });
    }
    return map;
  }, [columns]);

  function findColumnId(id: string): string | null {
    if (columns[id]) return id;
    return taskLookup.get(id)?.columnId ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    const entry = taskLookup.get(event.active.id as string);
    setActiveTask(entry?.task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeColumn = findColumnId(activeId);
    const overColumn = findColumnId(overId);
    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    setColumns((prev) => {
      const activeItems = prev[activeColumn];
      const activeIndex = activeItems.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prev;
      const moved = activeItems[activeIndex];
      const newActiveItems = activeItems.filter((t) => t.id !== activeId);
      const overItems = [...prev[overColumn]];
      const overIndex = overItems.findIndex((t) => t.id === overId);
      const insertAt = overIndex === -1 ? overItems.length : overIndex;
      overItems.splice(insertAt, 0, { ...moved, workflowStateId: overColumn });

      return { ...prev, [activeColumn]: newActiveItems, [overColumn]: overItems };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const columnId = findColumnId(activeId);
    if (!columnId) return;

    const items = columns[columnId];
    const index = items.findIndex((t) => t.id === activeId);
    if (index === -1) return;

    const prevPos = index > 0 ? items[index - 1].position : null;
    const nextPos = index < items.length - 1 ? items[index + 1].position : null;
    let position: number;
    if (prevPos === null && nextPos === null) position = 1000;
    else if (prevPos === null) position = nextPos! - 500;
    else if (nextPos === null) position = prevPos + 1000;
    else position = (prevPos + nextPos) / 2;

    moveMutation.mutate({ taskId: activeId, workflowStateId: columnId, position });
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {workflowStates.map((s) => (
          <Skeleton key={s.id} className="h-full w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {workflowStates.map((state) => (
          <Column key={state.id} state={state} tasks={columns[state.id] ?? []} projectId={projectId} projectKey={projectKey} />
        ))}
      </div>
      <DragOverlay>{activeTask && <TaskCard task={activeTask} projectKey={projectKey} />}</DragOverlay>
    </DndContext>
  );
}
