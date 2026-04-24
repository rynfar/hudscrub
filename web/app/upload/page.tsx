'use client';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/src/ui/AppHeader';
import { DropZone } from '@/src/upload/DropZone';
import { useDocuments } from '@/src/store/document-store';

export default function UploadPage() {
  const router = useRouter();
  const addDoc = useDocuments((s) => s.add);

  const handleFiles = async (files: File[]) => {
    let firstId: string | null = null;
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const id = addDoc({
        filename: file.name,
        fileBytes: bytes,
        pages: [],
        status: 'uploading',
        detectionProgress: { currentPage: 0, totalPages: 0 },
      });
      if (!firstId) firstId = id;
    }
    if (firstId) router.push(`/review/${firstId}`);
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
          <DropZone onFiles={handleFiles} />
        </div>
      </main>
    </>
  );
}
