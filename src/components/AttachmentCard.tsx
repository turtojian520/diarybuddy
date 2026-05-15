'use client'

import { useState } from 'react'
import { File, FileText, FileAudio, ImageIcon, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type Props = {
  url: string
  name: string
  mimeType: string
  /** null = AI summary still pending. Empty string = no summary. */
  summary: string | null
}

function pickIcon(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon
  if (mime === 'application/pdf') return FileText
  if (mime.startsWith('audio/')) return FileAudio
  if (mime.startsWith('text/')) return FileText
  return File
}

export function AttachmentCard({ url, name, mimeType, summary }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isImage = mimeType.startsWith('image/')
  const Icon = pickIcon(mimeType)
  const pending = summary === null

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-[var(--db-border)] bg-[var(--db-surface)]">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-stretch gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--db-card)]"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name}
            className="h-14 w-14 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--db-card)] text-[var(--db-accent)]">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="h5-text-wrap truncate text-sm text-[var(--db-ink-2)]">{name}</p>
          <p className="text-xs italic text-[var(--db-faint)]">{mimeType || '附件'}</p>
        </div>
      </a>

      <div className="border-t border-[var(--db-border)] px-3 py-2">
        {pending ? (
          <div className="flex items-center gap-2 text-xs italic text-[var(--db-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            AI 正在阅读……
          </div>
        ) : summary === '' ? (
          <p className="text-xs italic text-[var(--db-faint)]">（无简介）</p>
        ) : (
          <>
            <p
              className={`whitespace-pre-wrap text-xs leading-relaxed text-[var(--db-muted)] ${
                expanded ? '' : 'line-clamp-2'
              }`}
            >
              {summary}
            </p>
            {summary.length > 80 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--db-accent)] hover:text-[var(--db-accent-deep)]"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    展开 AI 简介
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
