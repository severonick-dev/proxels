import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

interface Props {
  content: string;
  className?: string;
}

/**
 * Общий markdown-рендерер. Использует react-markdown — XSS-безопасно по дизайну
 * (React-элементы, не innerHTML). Tailwind-стили заданы через components prop.
 */
export function Markdown({ content, className }: Props): JSX.Element {
  return (
    <div className={cn('space-y-1 text-foreground/90', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="mb-4 mt-8 font-display text-2xl font-bold" {...props} />,
          h2: (props) => <h2 className="mb-3 mt-7 font-display text-xl font-bold" {...props} />,
          h3: (props) => <h3 className="mb-2 mt-5 text-lg font-semibold" {...props} />,
          p: (props) => <p className="mb-4 leading-relaxed" {...props} />,
          ul: (props) => <ul className="mb-4 list-disc space-y-1 pl-6" {...props} />,
          ol: (props) => <ol className="mb-4 list-decimal space-y-1 pl-6" {...props} />,
          li: (props) => <li className="leading-relaxed" {...props} />,
          a: (props) => (
            <a
              {...props}
              className="text-primary underline-offset-4 hover:underline"
              target={props.href?.startsWith('http') ? '_blank' : undefined}
              rel={props.href?.startsWith('http') ? 'noreferrer noopener' : undefined}
            />
          ),
          strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
          code: (props) => (
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs" {...props} />
          ),
          pre: (props) => (
            <pre
              className="my-4 overflow-x-auto rounded-lg border border-border bg-secondary/40 p-3 text-xs"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-4 border-l-2 border-primary/40 pl-4 italic text-muted-foreground"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b border-border bg-secondary/50 px-3 py-2 text-left font-semibold"
              {...props}
            />
          ),
          td: (props) => <td className="border-b border-border/60 px-3 py-2" {...props} />,
          hr: () => <hr className="my-6 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
