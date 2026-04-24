'use client';

export interface RenderedPage {
  pageNum: number;
  width: number;
  height: number;
  text: string;
  textItems: Array<{ str: string; transform: number[]; width: number; height: number }>;
  render: (canvas: HTMLCanvasElement) => Promise<void>;
}

export interface LoadedBrowserPdf {
  numPages: number;
  getPage(pageIndex: number): Promise<RenderedPage>;
}

let workerConfigured = false;
async function ensureWorker() {
  if (workerConfigured) return;
  const pdfjsLib = await import('pdfjs-dist');
  // Use the worker URL from the package
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  workerConfigured = true;
}

export async function loadPdfInBrowser(bytes: ArrayBuffer): Promise<LoadedBrowserPdf> {
  await ensureWorker();
  const pdfjsLib = await import('pdfjs-dist');
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  return {
    numPages: doc.numPages,
    async getPage(pageIndex: number) {
      const page = await doc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{
        str: string;
        transform: number[];
        width: number;
        height: number;
      }>;
      const text = items.map((it) => it.str).join(' ');
      return {
        pageNum: pageIndex,
        width: viewport.width,
        height: viewport.height,
        text,
        textItems: items.map((it) => ({
          str: it.str,
          transform: it.transform,
          width: it.width,
          height: it.height,
        })),
        async render(canvas: HTMLCanvasElement) {
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        },
      };
    },
  };
}
