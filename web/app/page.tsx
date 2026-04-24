export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-10">
        <div className="space-y-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-subtle)] font-mono">
            On-device PII redaction
          </p>
          <h1 className="text-4xl md:text-5xl tracking-tight text-[color:var(--color-ink)] font-medium leading-[1.1]">
            Review and redact HUD-1 closing documents
            <span className="text-[color:var(--color-ink-subtle)]"> without uploading them.</span>
          </h1>
          <p className="text-base text-[color:var(--color-ink-muted)] leading-relaxed max-w-md mx-auto">
            Detection runs on your device. Your PDFs never leave your browser.
          </p>
        </div>

        <a
          href="/upload"
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium
                     bg-[color:var(--color-ink)] text-[color:var(--color-bg)]
                     hover:bg-[#2a2a2a] transition-colors"
        >
          Get started
        </a>
      </div>
    </main>
  );
}
