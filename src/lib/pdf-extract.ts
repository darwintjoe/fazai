/**
 * PDF text extraction utility using pdfjs-dist.
 *
 * IMPORTANT: This module is meant to be imported client-side only
 * (dynamic import with `await import()`). It is NOT used server-side.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let _pdfjs: any = null;

async function getPdfjs() {
  if (_pdfjs) return _pdfjs;

  // Use the legacy build for maximum browser compatibility.
  // pdfjs-dist v6: legacy/build/pdf.mjs
  _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Point the worker to a CDN copy matching this major version.
  // This avoids bundling the (large) worker into the Next.js client bundle.
  _pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  return _pdfjs;
}

/**
 * Extract all text from a PDF file.
 *
 * @param file   — the PDF File or Blob
 * @param password — optional password for encrypted PDFs
 * @returns all visible text joined by newlines
 */
export async function extractTextFromFile(
  file: File | Blob,
  password?: string,
): Promise<string> {
  const pdfjs = await getPdfjs();

  const arrayBuffer = await file.arrayBuffer();

  // passwordFn is called when the PDF is encrypted.
  // It receives a callback that must be called with the password string.
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    password: password || undefined,
  });

  // Support password-protected PDFs via the password callback
  if (!password) {
    loadingTask.onPassword = (callback: (pw: string) => void, _reason: number) => {
      // No password was provided; signal that we cannot decrypt.
      // The calling UI should prompt the user and retry.
      callback('');
    };
  }

  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item: any) => typeof item.str === 'string')
      .map((item: any) => item.str);
    pages.push(strings.join(' '));
  }

  return pages.join('\n');
}
