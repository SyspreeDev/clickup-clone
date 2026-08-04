"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold as BoldIcon,
  Code as CodeIcon,
  Italic as ItalicIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tiptap document JSON. Task.description and Comment.content are `Json?` columns,
 * so rich text is stored structurally rather than as an HTML string.
 */
export type RichDoc = { type: "doc"; content: JSONContent[] };

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] } as const;

/**
 * Normalises whatever is in the database into a Tiptap doc.
 *
 * Descriptions and comments written before the editor existed are plain strings
 * in those same Json columns, and the team's client briefs rely on their line
 * breaks ("Client Name -" / "Package -" / …). Each line therefore becomes its own
 * paragraph so an old brief keeps the shape it was typed in. Blank lines collapse
 * into paragraph spacing, which is what they were standing in for.
 */
export function toDoc(value: unknown): RichDoc {
  if (typeof value === "string") {
    const paragraphs = value
      .split("\n")
      .map((line) => line.trim())
      .filter((line, i, all) => line !== "" || all[i - 1] !== "")
      .map<JSONContent>((line) =>
        line === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text: line }] },
      );
    return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
  }
  if (value && typeof value === "object" && (value as JSONContent).type === "doc") {
    const doc = value as JSONContent;
    return { type: "doc", content: doc.content?.length ? doc.content : [{ type: "paragraph" }] };
  }
  return { ...EMPTY_DOC, content: [...EMPTY_DOC.content] };
}

/** True when a doc holds nothing but empty paragraphs — used to gate "save" and empty states. */
export function isDocEmpty(value: unknown): boolean {
  const doc = toDoc(value);
  return !doc.content.some((node) => {
    if (node.type === "paragraph") return !!node.content?.length;
    return true;
  });
}

/** Flattens a doc to plain text, for previews and list rows that have no room for markup. */
export function docToPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.text) parts.push(node.text);
    node.content?.forEach(walk);
    if (node.type === "paragraph" || node.type === "heading") parts.push("\n");
  };
  toDoc(value).content.forEach(walk);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

const EXTENSIONS = [
  StarterKit.configure({
    // A task description is not the place for a top-level H1 — it would compete
    // with the task title right above it.
    heading: { levels: [2, 3] },
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
  }),
];

/**
 * Shared prose styling. Tailwind's typography plugin isn't installed, so the few
 * marks StarterKit can produce are styled explicitly here and reused by both the
 * editor and the read-only renderer so saved text looks identical to what was typed.
 */
const PROSE = cn(
  "text-sm leading-relaxed",
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5 [&_li>p]:my-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-3 [&_hr]:border-border",
  "[&_strong]:font-semibold",
);

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Keep focus in the document so the command applies to the current
      // selection rather than collapsing it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <CodeIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <ToolbarButton
        label={editor.isActive("link") ? "Remove link" : "Add link"}
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt("Link URL");
          if (!url) return;
          // A bare "syspree.com" would otherwise resolve relative to the app.
          const href = /^https?:\/\/|^mailto:/i.test(url) ? url : `https://${url}`;
          editor.chain().focus().setLink({ href }).run();
        }}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

/**
 * Read-only renderer for stored rich text. Deliberately does not mount an editor
 * instance — comment lists and previews can hold dozens of these.
 */
export function RichTextContent({ value, className }: { value: unknown; className?: string }) {
  const doc = toDoc(value);
  return <StaticDoc doc={doc} className={cn(PROSE, className)} />;
}

/**
 * Renders doc JSON directly to React elements. Only the nodes and marks the
 * editor above can produce are handled; anything unrecognised falls through to
 * its text content so nothing silently disappears.
 */
function StaticDoc({ doc, className }: { doc: RichDoc; className?: string }) {
  return <div className={className}>{doc.content.map((node, i) => renderNode(node, i))}</div>;
}

function renderNode(node: JSONContent, key: number): React.ReactNode {
  const n = node;
  if (!n || typeof n !== "object") return null;

  if (n.type === "text") {
    let el: React.ReactNode = n.text ?? "";
    for (const mark of n.marks ?? []) {
      if (mark.type === "bold") el = <strong key={key}>{el}</strong>;
      else if (mark.type === "italic") el = <em key={key}>{el}</em>;
      else if (mark.type === "strike") el = <s key={key}>{el}</s>;
      else if (mark.type === "code") el = <code key={key}>{el}</code>;
      else if (mark.type === "link")
        el = (
          <a key={key} href={String(mark.attrs?.href ?? "#")} target="_blank" rel="noopener noreferrer nofollow">
            {el}
          </a>
        );
    }
    return <span key={key}>{el}</span>;
  }

  const children = n.content?.map((child, i) => renderNode(child, i));

  switch (n.type) {
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading":
      return n.attrs?.level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    default:
      return children ? <div key={key}>{children}</div> : null;
  }
}

export function RichTextEditor({
  value,
  onSave,
  placeholder,
  className,
  minHeight = 120,
  autoFocus = false,
  /** Renders the toolbar only while the editor has focus or content — keeps read-heavy views calm. */
  toolbarWhenFocused = false,
}: {
  value: unknown;
  /** Called on blur, only when the document actually changed. */
  onSave: (doc: RichDoc) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  autoFocus?: boolean;
  toolbarWhenFocused?: boolean;
}) {
  const editor = useEditor({
    // Required under Next's App Router: rendering the editor during SSR causes a
    // hydration mismatch.
    immediatelyRender: false,
    autofocus: autoFocus,
    extensions: EXTENSIONS,
    content: toDoc(value),
    editorProps: {
      attributes: {
        class: cn(PROSE, "outline-none"),
        style: `min-height:${minHeight}px`,
      },
    },
    onBlur: ({ editor: e }) => {
      const next = e.getJSON() as RichDoc;
      if (JSON.stringify(next) !== JSON.stringify(toDoc(value))) onSave(next);
    },
  });

  /**
   * Re-seed the document when the caller switches to a different record (opening
   * another client in the same dialog). Guarded on a real difference so a refetch
   * that returns identical content doesn't wipe the caret mid-edit.
   */
  useEffect(() => {
    if (!editor) return;
    const incoming = toDoc(value);
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(incoming)) return;
    if (editor.isFocused) return;
    editor.commands.setContent(incoming, false);
  }, [editor, value]);

  if (!editor) {
    // Reserve the same space the editor will take so the dialog doesn't jump.
    return <div className={className} style={{ minHeight: minHeight + 34 }} />;
  }

  const showToolbar = !toolbarWhenFocused || editor.isFocused || !editor.isEmpty;

  return (
    <div
      className={cn(
        "rounded-lg border border-transparent transition-colors focus-within:border-border hover:border-border",
        className,
      )}
    >
      {showToolbar && <Toolbar editor={editor} />}
      <Surface editor={editor} placeholder={placeholder} />
    </div>
  );
}

/**
 * The editable area plus its placeholder.
 *
 * The placeholder is an overlay rather than Tiptap's Placeholder extension for two
 * reasons: the extension only ships classes and needs global CSS this project
 * doesn't carry, and the client-brief hint is multi-line — which a
 * `content: attr(data-placeholder)` pseudo-element renders unreliably. Staying
 * visible while an empty editor is focused also matches the textarea this replaced.
 */
function Surface({ editor, placeholder }: { editor: Editor; placeholder?: string }) {
  return (
    <div className="relative">
      {placeholder && editor.isEmpty && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 whitespace-pre-line px-2 py-1.5 text-sm leading-relaxed text-muted-foreground"
        >
          {placeholder}
        </div>
      )}
      <EditorContent editor={editor} className="px-2 py-1.5" />
    </div>
  );
}

/**
 * Composer variant: a bordered box with an explicit submit, for comments. Unlike
 * the description editor it clears itself after a successful send.
 */
export function RichTextComposer({
  placeholder,
  submitLabel,
  disabled,
  onSubmit,
}: {
  placeholder?: string;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (doc: RichDoc) => Promise<void> | void;
}) {
  /**
   * `editorProps` is captured when the editor is created, so a handler defined
   * inline there would keep calling the first render's `onSubmit`. Routing the
   * shortcut through a ref keeps it pointed at the current one.
   */
  const submitRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: EXTENSIONS,
    content: { ...EMPTY_DOC, content: [...EMPTY_DOC.content] },
    editorProps: {
      attributes: { class: cn(PROSE, "outline-none"), style: "min-height:54px" },
      handleKeyDown: (_view, event) => {
        // Cmd/Ctrl+Enter sends, matching the chat composer. Plain Enter is a newline.
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          submitRef.current();
          return true;
        }
        return false;
      },
    },
  });

  const submit = async () => {
    if (!editor || editor.isEmpty || disabled) return;
    const doc = editor.getJSON() as RichDoc;
    await onSubmit(doc);
    editor.commands.clearContent();
  };
  submitRef.current = submit;

  if (!editor) return <div className="min-h-[136px]" />;

  return (
    <div className="rounded-lg border border-border focus-within:ring-2 focus-within:ring-ring">
      <Toolbar editor={editor} />
      <Surface editor={editor} placeholder={placeholder} />
      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
        <span className="text-xs text-muted-foreground">⌘↵ to send</span>
        <button
          type="button"
          disabled={disabled || editor.isEmpty}
          onClick={submit}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
