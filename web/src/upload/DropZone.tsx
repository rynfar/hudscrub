'use client';
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onFiles: (files: File[]) => void;
}

export function DropZone({ onFiles }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
        ? Array.from(e.target.files).filter((f) => f.type === 'application/pdf')
        : [];
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <motion.div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      animate={{
        borderColor: isDragging ? 'rgba(183, 121, 31, 0.6)' : 'rgba(26, 26, 26, 0.16)',
        backgroundColor: isDragging ? 'rgba(183, 121, 31, 0.04)' : 'rgba(255, 255, 255, 0)',
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="border-2 border-dashed rounded-lg p-16 flex flex-col items-center gap-4 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-[color:var(--color-surface-muted)] flex items-center justify-center">
        <div className="w-5 h-6 border-[1.5px] border-[color:var(--color-ink-muted)] rounded-sm" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--color-ink)]">
          Drop a HUD-1 PDF here
        </p>
        <p className="text-xs text-[color:var(--color-ink-muted)]">
          Or
          <label className="ml-1 underline underline-offset-2 cursor-pointer hover:text-[color:var(--color-accent)] transition-colors">
            choose a file
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="sr-only"
              onChange={handleSelect}
            />
          </label>
        </p>
        <p className="text-[11px] font-mono text-[color:var(--color-ink-subtle)] pt-2">
          Files stay on your device. Nothing is uploaded.
        </p>
      </div>
    </motion.div>
  );
}
