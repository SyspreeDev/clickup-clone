"use client";

import { use, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listFiles, uploadFile, deleteFile, downloadFile, type FileItem } from "@/lib/queries/files";
import { ApiError } from "@/lib/api-client";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ["files", workspaceId],
    queryFn: () => listFiles(workspaceId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(workspaceId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", workspaceId] });
      toast.success("File uploaded");
    },
    onError: () => toast.error("Upload failed"),
  });

  const downloadMutation = useMutation({
    mutationFn: (file: FileItem) => downloadFile(file.id, file.name),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not download file"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files", workspaceId] }),
  });

  return (
    <>
      <TopNav title="Files" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Files</h2>
              <p className="text-sm text-muted-foreground">Shared files across your workspace.</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? "Uploading…" : "Upload file"}
            </Button>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {!isLoading && !files?.length && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No files yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Upload your first file to share it with the team.</p>
            </div>
          )}

          <div className="divide-y divide-border rounded-2xl border border-border">
            {files?.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)} · Uploaded by {file.uploadedBy.name} · {format(new Date(file.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => downloadMutation.mutate(file)}
                    aria-label={`Download ${file.name}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(file.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
