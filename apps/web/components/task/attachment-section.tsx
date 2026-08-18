"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteAttachment, uploadAttachment } from "@/lib/queries/tasks";
import { downloadFile } from "@/lib/queries/files";
import { ApiError } from "@/lib/api-client";
import type { Attachment, TaskDetail } from "@/lib/queries/tasks";

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({
  attachment,
  onDownload,
  onDelete,
}: {
  attachment: Attachment;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border p-2 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
        {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {humanSize(attachment.fileSize)} · {attachment.uploadedBy.name} ·{" "}
          {format(new Date(attachment.createdAt), "d MMM yy")}
        </p>
      </div>
      <button
        onClick={onDownload}
        className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Download"
        aria-label={`Download ${attachment.fileName}`}
      >
        <Download className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        title="Remove"
        aria-label={`Remove ${attachment.fileName}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Files for one client, dropped straight onto their task. Each upload is also
 * filed under this list in the workspace Files area, so a client's documents
 * stay together whether you look for them on the task or in Files.
 */
export function AttachmentSection({ task, onChange }: { task: TaskDetail; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      // Sequential, not Promise.all: parallel multipart uploads through the
      // production Vercel proxy are far likelier to be throttled or truncated.
      for (const file of files) await uploadAttachment(task.id, file);
    },
    onSuccess: (_data, files) => {
      onChange();
      toast.success(files.length === 1 ? "File uploaded" : `${files.length} files uploaded`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Upload failed"),
  });

  const download = useMutation({
    mutationFn: (attachment: Attachment) => {
      if (!attachment.fileId) throw new Error("This file is no longer stored");
      return downloadFile(attachment.fileId, attachment.fileName);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not download file"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: () => {
      onChange();
      toast.success("File removed");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not remove file"),
  });

  const pick = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length) upload.mutate(files);
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        Files &amp; documents
        {task.attachments.length > 0 && (
          <span className="text-xs font-normal text-muted-foreground">{task.attachments.length}</span>
        )}
      </div>

      <div className="space-y-1.5">
        {task.attachments.map((a) => (
          <AttachmentRow
            key={a.id}
            attachment={a}
            onDownload={() => download.mutate(a)}
            onDelete={() => remove.mutate(a.id)}
          />
        ))}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "mt-2 rounded-lg border border-dashed p-4 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {upload.isPending ? "Uploading…" : "Upload files"}
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">or drag them here</p>
      </div>
    </section>
  );
}
