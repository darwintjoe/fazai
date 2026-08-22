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
 * Group text items into visual rows by Y-position and join each row
 * into a single string ordered left-to-right.
 *
 * PDF coordinates have origin at bottom-left, so Y values go
 * from 0 (bottom) to pageHeight (top). We flip to top-left origin
 * for intuitive grouping.
 */
function itemsToRows(items: any[], pageHeight: number): string[] {
  const THRESHOLD = 3; // pixels tolerance for same-row grouping
  const rows = new Map<number, any[]>();

  for (const item of items) {
    if (!item.str || !item.transform) continue;
    const y = pageHeight - item.transform[5]; // flip to top-left origin
    const x = item.transform[4];

    // Find existing row within threshold
    let matchedKey: number | null = null;
    for (const key of rows.keys()) {
      if (Math.abs(key - y) < THRESHOLD) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey !== null) {
      rows.get(matchedKey)!.push({ str: item.str, x });
    } else {
      rows.set(y, [{ str: item.str, x }]);
    }
  }

  // Convert each row to a string: sort items by X (left-to-right), join with space
  const result: string[] = [];
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    // Sort descending Y = top of page first (top-left origin)
    const rowItems = rows.get(y)!;
    rowItems.sort((a: any, b: any) => a.x - b.x);
    const line = rowItems.map((r: any) => r.str).join(' ').trim();
    if (line) result.push(line);
  }

  return result;
}

/**
 * Extract transaction-relevant text from a PDF file.
 *
 * Skips the top 20% of each page (header zone: bank name, logo,
 * statement period, column headers) and the bottom 5% (footer:
 * page numbers, "End of Statement").
 *
 * Groups remaining text items into visual rows using Y-position
 * clustering for clean, minimal output.
 *
 * @param file     — the PDF File or Blob
 * @param password  — optional password for encrypted PDFs
 * @returns cleaned text with one transaction row per line
 */
export async function extractTextFromFile(
  file: File | Blob,
  password?: string,
): Promise<string> {
  const pdfjs = await getPdfjs();

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    password: password || undefined,
  });

  // Support password-protected PDFs via the password callback
  if (!password) {
    loadingTask.onPassword = (callback: (pw: string) => void, _reason: number) => {
      // No password was provided; signal that we cannot decrypt.
      callback('');
    };
  }

  const pdf = await loadingTask.promise;

  const allPages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const topCut = pageHeight * 0.20; // skip top 20%
    const bottomCut = pageHeight * 0.05; // skip bottom 5%

    const content = await page.getTextContent();

    // Filter items to the "body zone" only (skip header/footer)
    const bodyItems = content.items.filter((item: any) => {
      if (typeof item.str !== 'string' || !item.transform) return false;
      const y = pageHeight - item.transform[5]; // top-left origin
      return y > topCut && y < (pageHeight - bottomCut);
    });

    // Group remaining items into visual rows
    const rows = itemsToRows(bodyItems, pageHeight);
    if (rows.length > 0) {
      allPages.push(...rows);
    }
  }

  return allPages.join('\n');
}
