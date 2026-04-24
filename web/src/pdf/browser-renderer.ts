'use client';

export interface RenderedPage {
  pageNum: number;
  width: number;
  height: number;
  text: string;
  textItems: Array<{ str: string; transform: number[]; width: number; height: number }>;
  /** Returns a cancel function to abort the render in flight. */
  render: (canvas: HTMLCanvasElement) => { promise: Promise<void>; cancel: () => void };
  renderTextLayer: (container: HTMLDivElement) => Promise<void>;
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
  // PDF.js transfers the ArrayBuffer to its worker (detaching the original).
  // Clone so React StrictMode double-effect or repeat opens stay safe.
  const cloned = bytes.slice(0);
  const doc = await pdfjsLib.getDocument({ data: cloned }).promise;
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
        render(canvas: HTMLCanvasElement) {
          const ctx = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const task = page.render({ canvasContext: ctx, viewport, canvas });
          return {
            promise: task.promise.catch((e: unknown) => {
              // RenderingCancelledException is expected when StrictMode re-runs the effect.
              if (e instanceof Error && e.name === 'RenderingCancelledException') return;
              throw e;
            }),
            cancel: () => {
              try {
                task.cancel();
              } catch {
                // already finished — ignore
              }
            },
          };
        },
        async renderTextLayer(container: HTMLDivElement) {
          const lib = await import('pdfjs-dist');
          // pdfjs-dist >= 4 exposes a TextLayer class
          const TextLayer = (lib as unknown as { TextLayer: new (opts: object) => { render(): Promise<void> } })
            .TextLayer;
          if (!TextLayer) {
            throw new Error('pdfjs-dist TextLayer not found — version mismatch');
          }
          container.innerHTML = '';
          const tl = new TextLayer({
            textContentSource: textContent,
            container,
            viewport,
          });
          await tl.render();
        },
      };
    },
  };
}
