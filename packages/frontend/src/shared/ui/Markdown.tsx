import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/cn';

// Renders trainer-authored markdown. Raw HTML is not rendered (react-markdown default).
export const Markdown: React.FC<{ children: string; className?: string }> = ({
  children,
  className
}) => (
  <div
    className={cn(
      'max-w-none break-words text-[15px] leading-7 text-zinc-700',
      '[&_h1]:mb-4 [&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-zinc-900',
      '[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-zinc-900',
      '[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900',
      '[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
      '[&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-4',
      '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-300 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-500',
      '[&_code]:rounded-md [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-zinc-800',
      '[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-zinc-950 [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-6',
      '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-100',
      '[&_table]:my-5 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-sm [&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left',
      '[&_hr]:my-8 [&_hr]:border-zinc-200 [&_img]:my-5 [&_img]:rounded-2xl',
      className
    )}
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);
