'use client';
import { useParams } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { useDocuments } from '@/src/store/document-store';
import { DocumentView } from '@/src/review/DocumentView';

export default function ReviewPage() {
  const { docId } = useParams<{ docId: string }>();
  const doc = useDocuments((s) => s.documents[docId as string]);

  if (!doc) {
    return (
      <>
        <AppHeader />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center text-[color:var(--color-ink-muted)]">
          Document not found.{' '}
          <a href="/upload" className="text-[color:var(--color-accent)] underline">
            Upload one.
          </a>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <DocumentView doc={doc} />
    </>
  );
}
