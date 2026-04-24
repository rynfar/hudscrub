import * as mupdf from 'mupdf';

export interface LoadedPdf {
  readonly pageCount: number;
  getPage(index: number): mupdf.PDFPage;
  save(): Uint8Array;
  close(): void;
  raw(): mupdf.PDFDocument;
}

export async function loadPdf(bytes: Uint8Array | Buffer): Promise<LoadedPdf> {
  const input = bytes instanceof Buffer ? new Uint8Array(bytes) : bytes;
  const doc = mupdf.PDFDocument.openDocument(input, 'application/pdf') as mupdf.PDFDocument;
  const pageCount = doc.countPages();
  return {
    pageCount,
    getPage(index: number): mupdf.PDFPage {
      return doc.loadPage(index) as mupdf.PDFPage;
    },
    save(): Uint8Array {
      return doc.saveToBuffer('garbage=4,deflate=true,clean=true').asUint8Array();
    },
    close(): void {
      doc.destroy();
    },
    raw(): mupdf.PDFDocument {
      return doc;
    },
  };
}
