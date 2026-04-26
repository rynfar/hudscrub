'use client';
import type { DocumentSession } from '@/src/store/document-store';

interface Props {
  doc: DocumentSession;
  /** When null, the doc is archived (read-only) and cannot be re-opened. */
  onReopen: (() => void) | null;
}

export function ApprovedSummary({ doc, onReopen }: Props) {
  const total = doc.pages.reduce((n, p) => n + p.spans.length, 0);
  const accepted = doc.pages.reduce(
    (n, p) => n + p.spans.filter((s) => s.decision === 'accepted').length,
    0,
  );
  const rejected = doc.pages.reduce(
    (n, p) => n + p.spans.filter((s) => s.decision === 'rejected').length,
    0,
  );
  const approvedDate =
    doc.approvedAt !== null
      ? new Date(doc.approvedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-[rgba(15,95,61,0.1)] flex items-center justify-center mx-auto">
          <span className="text-[#0F5F3D] text-lg">✓</span>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            Approved {approvedDate && `· ${approvedDate}`}
          </p>
          <h2 className="text-lg font-medium text-[color:var(--color-ink)]">
            {doc.filename}
          </h2>
        </div>

        <dl className="grid grid-cols-3 gap-2 pt-3 border-t border-[color:var(--color-border)]">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-ink-subtle)] font-mono">
              Pages
            </dt>
            <dd className="text-sm font-medium text-[color:var(--color-ink)] mt-0.5">
              {doc.pages.length}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-ink-subtle)] font-mono">
              Accepted
            </dt>
            <dd className="text-sm font-medium text-[#0F5F3D] mt-0.5">{accepted}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-ink-subtle)] font-mono">
              Rejected
            </dt>
            <dd className="text-sm font-medium text-[color:var(--color-ink-muted)] mt-0.5">
              {rejected}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed pt-2">
          {accepted} of {total} detected items {onReopen ? 'will be redacted. Re-open if you want to change anything.' : 'were redacted in this archived export.'}
        </p>

        {onReopen && (
          <button
            type="button"
            onClick={onReopen}
            className="text-xs px-3 py-1.5 rounded text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-muted)] transition-colors"
          >
            Re-open for editing
          </button>
        )}
      </div>
    </div>
  );
}
