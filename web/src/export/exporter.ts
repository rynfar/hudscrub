'use client';
import { redactDocument } from '@/src/output/redactor';
import { verifyDollarPreservation } from '@/src/output/dollar-verifier';
import { loadPdfInBrowser } from '@/src/pdf/browser-renderer';
import { getSandboxMapper } from '@/src/processing/sandbox-mapper';
import type { DocumentSession } from '@/src/store/document-store';
import type { Mode, Span } from '@/src/types';

export interface ExportResult {
  bytes: Uint8Array;
  mappings?: Record<string, Record<string, string>>;
  spanCount: number;
  warning?: string;
}

export async function exportDocument(
  doc: DocumentSession,
  mode: Mode,
  seed?: number,
): Promise<ExportResult> {
  const acceptedSpans: Span[] = [];
  // Use the same singleton mapper that processing populated. If we're in
  // sandbox mode but the span doesn't already have a replacement (edge case:
  // mode toggled after processing), fill it now from the same mapper.
  const mapper = mode === 'sandbox' ? getSandboxMapper(seed) : null;
  for (const page of doc.pages) {
    for (const s of page.spans) {
      if (s.decision !== 'accepted') continue;
      const span = { ...s };
      if (mapper && !span.replacement && s.label !== 'DOLLAR') {
        try {
          span.replacement = mapper.mapValue(s.label, s.text);
        } catch {
          /* skip */
        }
      }
      acceptedSpans.push(span);
    }
  }

  const out = await redactDocument(new Uint8Array(doc.fileBytes), acceptedSpans, { mode });

  // Re-extract via PDF.js for the dollar-preservation check
  let warning: string | undefined;
  try {
    const inputPdf = await loadPdfInBrowser(doc.fileBytes);
    const inputPages: string[] = [];
    for (let i = 0; i < inputPdf.numPages; i++) {
      inputPages.push((await inputPdf.getPage(i)).text);
    }
    const outBuf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    const outputPdf = await loadPdfInBrowser(outBuf);
    const outputPages: string[] = [];
    for (let i = 0; i < outputPdf.numPages; i++) {
      outputPages.push((await outputPdf.getPage(i)).text);
    }
    const verification = verifyDollarPreservation(inputPages, outputPages);
    if (!verification.ok) {
      warning = `Dollar verification failed on ${verification.diffs.length} page(s).`;
      console.warn('Dollar diffs', verification.diffs);
    }
  } catch (e) {
    warning = `Could not verify dollar preservation: ${e instanceof Error ? e.message : String(e)}`;
  }

  return {
    bytes: out,
    mappings: mapper ? mapper.getMappingReport() : undefined,
    spanCount: acceptedSpans.length,
    warning,
  };
}

export function triggerDownload(bytes: Uint8Array, filename: string, contentType = 'application/pdf') {
  // Cast through unknown to satisfy TS's strict ArrayBufferLike vs ArrayBuffer typing.
  const blob = new Blob([bytes as unknown as BlobPart], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function triggerJsonDownload(obj: unknown, filename: string) {
  const text = JSON.stringify(obj, null, 2);
  const bytes = new TextEncoder().encode(text);
  triggerDownload(bytes, filename, 'application/json');
}

/**
 * Bundle multiple exported documents (and their mappings, if any) into one ZIP
 * download. Used by the "Export all" action when a batch contains multiple docs.
 */
export async function exportBatchAsZip(
  docs: DocumentSession[],
  mode: Mode,
  seed?: number,
): Promise<{ filename: string; bytes: Uint8Array; warnings: string[] }> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const warnings: string[] = [];
  for (const doc of docs) {
    try {
      const result = await exportDocument(doc, mode, seed);
      const baseName = doc.filename.replace(/\.pdf$/, '');
      const suffix = mode === 'redact' ? '.redacted.pdf' : '.sandboxed.pdf';
      zip.file(`${baseName}${suffix}`, result.bytes);
      if (result.mappings) {
        zip.file(`${baseName}.mappings.json`, JSON.stringify(result.mappings, null, 2));
      }
      if (result.warning) {
        warnings.push(`${doc.filename}: ${result.warning}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`${doc.filename}: export failed — ${msg}`);
    }
  }
  const blob = await zip.generateAsync({ type: 'uint8array' });
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `hudscrub-${mode}-${stamp}.zip`,
    bytes: blob,
    warnings,
  };
}
