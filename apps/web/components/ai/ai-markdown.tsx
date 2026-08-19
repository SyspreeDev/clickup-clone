import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Minimal, hand-styled markdown rendering for AI replies — no typography plugin dependency. */
export function AiMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">{children}</code>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-black/10 p-2 text-xs dark:bg-white/10">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-current/30 pl-3 italic opacity-90">{children}</blockquote>,
          h1: ({ children }) => <p className="text-base font-semibold">{children}</p>,
          h2: ({ children }) => <p className="text-base font-semibold">{children}</p>,
          h3: ({ children }) => <p className="font-semibold">{children}</p>,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-current/20 px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-current/10 px-2 py-1 align-top">{children}</td>,
          hr: () => <hr className="border-current/20" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
