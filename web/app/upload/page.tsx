'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { DropZone } from '@/src/upload/DropZone';
import { PillBadge } from '@/src/ui/PillBadge';
import { useDocuments } from '@/src/store/document-store';
import { useSessions } from '@/src/store/session-store';
import { useSettings, MODELS } from '@/src/store/settings-store';
import { cancelProcessing, resetProcessing } from '@/src/processing/runner';

function autoLabel(files: File[]): string {
  const baseFirst = files[0].name.replace(/\.pdf$/i, '');
  const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (files.length === 1) return `${baseFirst} — ${stamp}`;
  return `${baseFirst} +${files.length - 1} — ${stamp}`;
}

export default function UploadPage() {
  const router = useRouter();
  const addWithId = useDocuments((s) => s.addWithId);
  const clearAll = useDocuments((s) => s.clearAll);
  const createNewSession = useSessions((s) => s.createNew);
  const setActiveSession = useSessions((s) => s.setActive);
  const selectedModel = useSettings((s) => s.selectedModel);
  const installedModels = useSettings((s) => s.installedModels);
  const meta = MODELS.find((m) => m.id === selectedModel);
  const isInstalled = installedModels.includes(selectedModel) || selectedModel === 'regex-only';

  const handleFiles = async (files: File[]) => {
    // Each upload = a brand-new session in history. Cancel anything in
    // flight and unload the prior active session from memory; persisted
    // sessions remain in IndexedDB for the user to revisit.
    cancelProcessing();
    resetProcessing();
    clearAll();
    setActiveSession(null);

    // Pre-create doc IDs so the session row references them on disk.
    const fileEntries = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        filename: file.name,
        bytes: await file.arrayBuffer(),
      })),
    );

    const sessionId = await createNewSession(
      autoLabel(files),
      fileEntries.map((f) => f.id),
    );

    for (const entry of fileEntries) {
      addWithId({
        id: entry.id,
        sessionId,
        filename: entry.filename,
        fileBytes: entry.bytes,
        pages: [],
        status: 'uploading',
        createdAt: Date.now(),
        approvedAt: null,
        detectionProgress: { currentPage: 0, totalPages: 0 },
      });
    }
    router.push('/processing');
  };

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
              Step 1
            </p>
            <h2 className="text-2xl tracking-tight font-medium">Upload a document</h2>
          </div>

          {/* Active model status — confirms what will run when you upload */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)] font-mono shrink-0">
                Active model
              </p>
              <p className="text-sm text-[color:var(--color-ink)] truncate">
                {meta?.name ?? selectedModel}
              </p>
              {isInstalled ? (
                <PillBadge tone="regex">Installed</PillBadge>
              ) : (
                <PillBadge tone="llm-low">Not installed</PillBadge>
              )}
            </div>
            <Link
              href="/settings"
              className="text-xs text-[color:var(--color-accent)] hover:underline shrink-0"
            >
              Change
            </Link>
          </div>

          {!isInstalled && (
            <div className="text-xs text-[color:var(--color-ink-muted)] leading-relaxed -mt-4">
              This model isn&apos;t downloaded yet. Detection will run with regex only until you
              install it from{' '}
              <Link href="/settings" className="text-[color:var(--color-accent)] underline">
                Settings
              </Link>
              .
            </div>
          )}

          <DropZone onFiles={handleFiles} />

          <p className="text-xs text-[color:var(--color-ink-subtle)] leading-relaxed -mt-4">
            Each upload starts a new session. Past sessions stay in your
            history for 30 days.
          </p>
        </div>
      </main>
    </>
  );
}
