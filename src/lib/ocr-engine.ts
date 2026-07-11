/**
 * Local OCR engine using Tesseract.js.
 *
 * IMPORTANT: This module is meant to be imported client-side only
 * (dynamic import with `await import()`). It is NOT used server-side.
 *
 * Follows the same lazy-loading singleton pattern as pdf-extract.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface OcrBlock {
  text: string;
  fontSize: number; // estimated from bounding box height
  y: number;        // vertical position from top (pixels)
  x: number;        // horizontal position from left (pixels)
}

type TesseractWorker = any;
let _worker: TesseractWorker | null = null;
let _currentLangs: string[] = [];
let _initializing: Promise<TesseractWorker> | null = null;

/**
 * Get the Tesseract language array for a given user language code.
 * Always includes 'eng' as a base, plus the user's language if applicable.
 */
export function getOcrLanguages(userLang: string): string[] {
  switch (userLang) {
    case 'id':
      return ['eng', 'ind'];
    case 'zh':
      return ['eng', 'chi_sim'];
    default:
      return ['eng'];
  }
}

/**
 * Lazy-load and cache a Tesseract.js worker.
 * Reuses the existing worker if languages match; reinitializes if not.
 */
async function getWorker(langs: string[]): Promise<TesseractWorker> {
  // If already initializing, wait for that
  if (_initializing) return _initializing;

  // Reuse existing worker if languages match
  if (_worker && _currentLangs.length === langs.length && _currentLangs.every((l, i) => l === langs[i])) {
    return _worker;
  }

  // Terminate old worker if exists
  if (_worker) {
    try { await _worker.terminate(); } catch { /* ignore */ }
    _worker = null;
  }

  _initializing = _initWorker(langs);
  try {
    _worker = await _initializing;
    _currentLangs = langs;
    return _worker;
  } finally {
    _initializing = null;
  }
}

async function _initWorker(langs: string[]): Promise<TesseractWorker> {
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker(langs, undefined, {
    logger: (m: any) => {
      // Only log significant status changes
      if (m.status === 'recognizing text') {
        console.log(`[OCR] Recognizing: ${Math.round((m.progress || 0) * 100)}%`);
      }
    },
  });

  console.log(`[OCR] Worker initialized with languages: ${langs.join(', ')}`);
  return worker;
}

/**
 * Preprocess an image for better OCR quality.
 * Applies grayscale, contrast boost, and resize via Canvas.
 */
function preprocessImage(source: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Target max width of 2000px (receipts are usually portrait)
      const MAX_WIDTH = 2000;
      let { width, height } = img;

      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // If no canvas context, return original blob
        resolve(source);
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Apply grayscale + contrast boost
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const contrast = 1.3; // 30% contrast boost
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Apply contrast
        const adjusted = factor * (gray - 128) + 128;
        const clamped = Math.max(0, Math.min(255, adjusted));
        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          resolve(source); // fallback to original
        }
      }, 'image/jpeg', 0.92);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(source); // fallback to original on error
    };

    img.src = url;
  });
}

/**
 * Recognize text from a receipt image with block-level data (font size, position).
 * Uses Tesseract word-level bounding boxes grouped into lines.
 *
 * @param image - The image file or blob
 * @param lang  - User language code ('en', 'id', 'zh')
 * @returns Raw text and array of text blocks with estimated font sizes and positions
 */
export async function recognizeReceiptWithBlocks(
  image: File | Blob,
  lang: string = 'en',
): Promise<{ text: string; blocks: OcrBlock[] }> {
  const langs = getOcrLanguages(lang);
  const worker = await getWorker(langs);

  const preprocessed = await preprocessImage(image);

  const { data } = await worker.recognize(preprocessed);
  const text = (data?.text || '').trim();
  const blocks = groupWordsIntoBlocks(data?.words || [], data?.blocks || []);

  console.log(`[OCR] Extracted ${text.length} characters, ${blocks.length} blocks`);
  return { text, blocks };
}

/**
 * Group Tesseract word-level data into lines (blocks) with estimated font sizes.
 */
function groupWordsIntoBlocks(words: any[], blocks: any[]): OcrBlock[] {
  if (!words || words.length === 0) return [];

  // Group words by baseline (words on the same line have similar baseline Y)
  const LINES_TOLERANCE = 5; // pixels tolerance for same-line grouping
  const lines = new Map<number, any[]>();

  for (const word of words) {
    if (!word.text || !word.bbox) continue;
    const baseline = word.bbox.y1; // bottom of word bounding box
    let matchedKey: number | null = null;

    for (const key of lines.keys()) {
      if (Math.abs(key - baseline) < LINES_TOLERANCE) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey !== null) {
      lines.get(matchedKey)!.push(word);
    } else {
      lines.set(baseline, [word]);
    }
  }

  // Convert grouped words into OcrBlocks
  const result: OcrBlock[] = [];
  for (const [baseline, lineWords] of lines) {
    // Sort words left-to-right by x position
    lineWords.sort((a: any, b: any) => a.bbox.x0 - b.bbox.x0);

    const lineText = lineWords.map((w: any) => w.text).join(' ').trim();
    if (!lineText) continue;

    // Font size = height of the tallest word in the line
    const maxWordHeight = lineWords.reduce((max: number, w: any) => {
      const h = w.bbox.y1 - w.bbox.y0;
      return Math.max(max, h);
    }, 0);

    // Position = average x of first word, y = baseline
    const avgX = lineWords[0].bbox.x0;

    result.push({
      text: lineText,
      fontSize: maxWordHeight,
      y: baseline,
      x: avgX,
    });
  }

  // Sort by Y position (top to bottom)
  result.sort((a, b) => a.y - b.y);
  return result;
}

/**
 * Recognize text from a receipt image using Tesseract.js.
 *
 * @param image - The image file or blob
 * @param lang  - User language code ('en', 'id', 'zh')
 * @returns Raw extracted text from the receipt
 */
export async function recognizeReceipt(image: File | Blob, lang: string = 'en'): Promise<string> {
  const langs = getOcrLanguages(lang);
  const worker = await getWorker(langs);

  // Preprocess for better accuracy
  const preprocessed = await preprocessImage(image);

  const { data } = await worker.recognize(preprocessed);
  const text = (data?.text || '').trim();

  console.log(`[OCR] Extracted ${text.length} characters`);
  return text;
}

/**
 * Terminate the OCR worker and release resources.
 * Call this when the component unmounts if you want to free memory.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    try { await _worker.terminate(); } catch { /* ignore */ }
    _worker = null;
    _currentLangs = [];
  }
}
