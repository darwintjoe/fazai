## Problem

Two related issues with Receipt OCR (`src/components/fazai/receipt-ocr.tsx`):
1. **Mapping quality** — OCR sometimes recognizes no fields, or AI maps text to the wrong field (amount picks a transaction ID, counterparty picks a header, etc.). Root causes found in code: the AI only receives the top-30 blocks sorted by font size (so small-font totals get dropped before the AI sees them), and when AI fails the form goes empty with no recourse.
2. **No transparency/correction** — when recognition is wrong, the user must retype fields manually. The raw OCR blocks (`{ text, fontSize, y }`) are extracted but never stored in component state or shown to the user.

The fix makes mapping **transparent and user-correctable** so that when AI is wrong the user can fix it in two taps instead of retyping.

## Approach

- **Tap-block-then-pick-field UX** (confirmed): user taps a recognized text block → inline buttons appear (Amount / Date / Counterparty / Description) → tapping one parses that block and fills the field.
- **Targeted accuracy fixes** (confirmed): surface per-block OCR confidence, send the full block list to the AI in reading order (instead of top-30 by font), and show the recognized-text panel even when AI fails.

## File changes

### 1. `src/lib/ocr-engine.ts` — expose confidence per block
- Add `confidence: number` (0–100) to the `OcrBlock` interface.
- In `groupWordsIntoBlocks`, average `word.confidence` across the line's words and store it on each block (Tesseract.js v7 already returns `confidence` per word).

### 2. `src/app/api/ai/parse-receipt/route.ts` — give the AI the full picture
- Add `confidence?: number` to the `blocks` param type.
- Replace the "top 30 by font size" slicing (`route.ts:186-196`) with the **full block list sorted by Y (reading order)**, and include each block's confidence in the summary line, e.g. `1. "TOTAL BAYAR Rp 25.000" (font: 28, conf: 92, pos: 780)`. This stops small-font totals from being dropped and presents the receipt to the LLM the way a human reads it.

### 3. `src/lib/keyword-map.ts` — one new pure helper
- Export `extractFirstAmount(text): number | null` — a thin wrapper over the existing (private) `extractAmountsFromLine` returning the top amount or null. Used by the client when the user taps a block → "Amount". Reuses the already-correct `parseSmartAmount` (handles `Rp 50.000`, `1,000.00`, `1.000,00`, trailing `,-`, etc.). `extractDate` is already exported and will be reused for the Date button.

### 4. `src/components/fazai/receipt-ocr.tsx` — the recognized-text panel + tap-to-map
- **Import**: `type OcrBlock` from `@/lib/ocr-engine`; `extractFirstAmount`, `extractDate` from `@/lib/keyword-map`; `formatNumber`/`parseFormattedNumber` already imported.
- **New state**: `ocrText: string`, `ocrBlocks: OcrBlock[]`, `panelOpen: boolean`, `activeBlockIdx: number | null`.
- **Populate state** in `processReceipt` right after `recognizeReceiptWithBlocks` returns (`receipt-ocr.tsx:116`): store `rawText` → `ocrText`, `blocks` → `ocrBlocks`. Set `panelOpen` based on outcome: open when the result comes back as `local`/empty (AI failed), collapsed when `ai`. Clear `ocrText`/`ocrBlocks` in `handleRetry` and `handleGalleryChange`. Also populate them in the empty-fallback branch (`receipt-ocr.tsx:172-186`).
- **`assignBlock(field, block)` callback**:
  - `amount` → `extractFirstAmount(block.text)`; if >0, `setAmount(formatNumber(amt))`.
  - `date` → `extractDate(block.text)`; if non-empty, `setDateStr(d)`.
  - `counterparty` / `description` → set to a cleaned version of `block.text` (trim, collapse whitespace, cap ~60 chars).
- **Panel UI** (rendered inside the `status === 'success'` block, between the AI/LOCAL badge and the form card): a collapsible card titled "Recognized text (N)". When expanded, a scrollable list (`max-h-80 overflow-y-auto`) of blocks in reading order. Each row: monospace block text + a small confidence badge (green ≥80, amber 60–79, gray <60). Tapping a row reveals inline buttons: Amount / Date / Counterparty / Description. Tapping a button calls `assignBlock`, closes the row, and leaves the panel open so the user can map more fields. Fields filled this way overwrite the AI suggestion.

### 5. `src/lib/i18n.ts` — new strings (en / id / zh)
Add keys: `receipt.recognizedText` ("Recognized text"), `receipt.tapHint` ("Tap a line, then choose a field"), `receipt.fieldAmount`, `receipt.fieldDate`, `receipt.fieldCounterparty`, `receipt.fieldDescription`. Added to the `TranslationKeys` type and all three locale objects.

## Out of scope (deliberately)
- No rewrite of image preprocessing (binarization/deskew) or the AI prompt body — the tap-to-map UI is the robust answer to mapping errors regardless of OCR quality.
- No change to the `'failed'` auto-reject path (a "Transaction Failed" receipt shouldn't be recorded).
- No shared client/server schema refactor for `OcrParseResult` — unrelated drift, keeping blast radius small.

## Risk / rollback
- Adding `confidence` to `OcrBlock` is additive; `recognizeReceiptWithBlocks` is only called from `receipt-ocr.tsx`, so no other call sites break.
- Sending all blocks to the AI slightly increases prompt size; receipts have ~20–80 blocks, well within the 1024-token response cap (the cap is on the response, not the prompt). If a provider errors on input size, the existing try/catch falls back to local extraction unchanged.
- All changes are confined to the OCR pipeline; transaction recording, accounts, and the rest of the app are untouched.