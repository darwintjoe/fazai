# FAZAI POS Integration Guide

This guide is for developers building an export/integration from a Point-of-Sale
(POS) system into **FAZAI**, a local-first double-entry accounting app.

With this integration, every sale recorded in your POS is posted into FAZAI's
general ledger as balanced income — `Dr Cash/Bank/QRIS, Cr Sales` — so the
merchant's books stay correct automatically.

---

## 1. How the integration works (important)

FAZAI is **local-first**: all financial data lives in the merchant's browser
(IndexedDB). There is no server-side database and no REST endpoint that writes
transactions. Instead, integration works by **file export + in-browser import**:

```
┌──────────┐   export JSON file    ┌─────────────────────┐
│  Your POS │ ───────────────────▶ │  Merchant (human)   │
└──────────┘                       │  downloads the file │
                                   └─────────┬───────────┘
                                             │  imports in FAZAI
                                             ▼
                                   ┌─────────────────────┐
                                   │   FAZAI (PWA)        │
                                   │  posts to ledger     │
                                   └─────────────────────┘
```

- **You (the POS)** produce a JSON file containing the sales to record.
- **The merchant** imports that file in FAZAI (Admin Panel → POS → Import).
- FAZAI validates, de-duplicates, and posts each sale to the ledger.

> A real-time push endpoint is on the roadmap. The API key documented below is
> already shaped to become the bearer credential for that future endpoint, so
> building to this contract now is forward-compatible.

---

## 2. Get connected

The merchant creates a **POS connection** in FAZAI (Admin Panel → POS → Add POS).
This produces two things you need:

1. **An API key** — a string like `faz_pos_3f9a...`. You must include it in
   every export file so FAZAI can route the file to the correct merchant book.
2. **A payment-method map** — the set of payment-method *keys* FAZAI expects,
   each mapped to a Cash/Bank account. You must use exactly these keys in your
   `paymentMethod` field, or those sales will be rejected (see §6).

Ask the merchant to share:
- their API key, and
- the list of accepted `paymentMethod` keys (e.g. `cash`, `qris`,
  `bank_transfer`, `card`).

FAZAI also offers a **"Sample"** button on each connection that downloads a
valid example file you can use as a reference template.

---

## 3. File format

The export is a single JSON file. The top-level structure:

```json
{
  "format": "fazai-pos-import",
  "version": 1,
  "apiKey": "faz_pos_3f9a1c2b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a",
  "connectionId": "pos-optional-hint",
  "posProvider": "Moka",
  "exportedAt": "2026-06-29T12:00:00.000Z",
  "currency": "IDR",
  "sales": [
    {
      "saleId": "POS-0001",
      "datetime": "2026-06-29T10:15:30.000Z",
      "amount": 25000,
      "paymentMethod": "cash",
      "counterparty": "Table 5",
      "description": "2 × Es Kopi Susu"
    }
  ]
}
```

### Top-level fields

| Field           | Required | Type     | Description |
|-----------------|----------|----------|-------------|
| `format`        | ✅ yes   | string   | Must be exactly `"fazai-pos-import"`. |
| `version`       | ✅ yes   | number   | Must be `1`. |
| `apiKey`        | ✅ yes   | string   | The merchant's API key. Used to route the file to the right book. |
| `connectionId`  | no       | string   | Optional hint; FAZAI resolves by `apiKey` anyway. |
| `posProvider`   | no       | string   | Your POS name, for display (e.g. `"Moka"`). |
| `exportedAt`    | no       | string   | ISO 8601 timestamp of when you generated the file. |
| `currency`      | no       | string   | Informational only. FAZAI is single-currency (assumed IDR); no conversion is performed. |
| `sales`         | ✅ yes   | array    | The sales to post. May be empty. |

### Per-sale fields (`sales[]`)

| Field           | Required | Type     | Description |
|-----------------|----------|----------|-------------|
| `saleId`        | ✅ yes   | string   | Your unique sale identifier. **This is the de-duplication key** (see §5). Must be unique within a connection. |
| `datetime`      | ✅ yes   | string   | ISO 8601 timestamp of the sale. Determines the transaction date. |
| `amount`        | ✅ yes   | number   | Sale total. Must be a finite, **positive** number. |
| `paymentMethod` | ✅ yes   | string   | Must match one of the merchant's mapped payment-method keys (see §2). |
| `counterparty`  | no       | string   | Customer/table/channel name. Falls back to the connection name if omitted. |
| `description`   | no       | string   | Line-item note or order summary. |

### Type coercion

FAZAI is lenient about *types* but strict about *values*:
- `amount` given as a numeric string (`"25000"`) is coerced to a number.
- `saleId` / `paymentMethod` are stringified if given as numbers.
- Unknown extra fields are ignored.

---

## 4. Merchant report method

The **merchant** chooses how sales are reported and rolled into ledger
transactions. This is configured per connection in FAZAI — you do not control it
from the file. The three report methods:

| Report method       | What the POS sends | What FAZAI posts |
|---------------------|--------------------|------------------|
| `immediate`         | A file **every time a sale closes**. | One ledger transaction **per sale** (2 legs: Dr cash/bank, Cr sales). |
| `daily-individual`  | The day's **detailed log** (each transaction). | One ledger transaction **per sale** — same output as `immediate`; the difference is only your reporting cadence. |
| `daily-total`       | The day **summed** into a single transaction. | **One multi-row ledger transaction** per day: a debit leg per payment method and a single credit to sales. Example: `Dr Cash 50000, Dr QRIS 30000, Cr Sales 80000`. |

Your export format (§3) is identical regardless of report method — just send
each sale as an individual row and FAZAI groups them. For `daily-total`, you may
either (a) send the day's itemized rows and let FAZAI sum them, or (b) send the
summed totals yourself — FAZAI's idempotency is by **day** in `daily-total`
(see §5), so a re-export of the same day is skipped.

---

## 5. Idempotency (de-duplication)

The de-duplication key depends on the report method:

- **`immediate` and `daily-individual`** — keyed by **`saleId`** within a
  connection. Re-importing a file (or importing an overlapping one) **skips** any
  `saleId` already imported. No double-posting.
- **`daily-total`** — keyed by **calendar day** within a connection. Re-importing
  a day that has already been summed is skipped as a whole.

Best practices:
- Always include a **stable, unique `saleId`** (your receipt/invoice number). It
  is required even in `daily-total`, where it lets the merchant cross-reference a
  summed day back to its underlying sales.
- If a file contains the same `saleId` more than once, only the first occurrence
  is processed; the rest are skipped.

---

## 6. Error handling

FAZAI never silently drops or alters a sale. Each file import returns counts of
`created`, `skipped`, and `errors`, plus per-sale error reasons.

**Whole-file rejection** (nothing is imported) happens when:
- the file is not valid JSON,
- `format` is not `"fazai-pos-import"`,
- `version` is not `1`,
- `apiKey` is missing or matches no connection,
- the matched connection is inactive,
- `sales` is missing or not an array.

**Per-sale rejection** (other sales in the file still import) happens when a sale:
- is missing `saleId`,
- has a non-positive / non-finite `amount`,
- has a `paymentMethod` that is **not in the merchant's map**,
- has an unparseable `datetime`.

> Unknown payment methods are **rejected, not defaulted**. This is intentional:
  silently routing a QRIS sale to Cash would corrupt the merchant's books. Make
  sure you use exactly the keys the merchant mapped (§2).

---

## 7. How sales map to the ledger

**`immediate` and `daily-individual`** — each accepted sale becomes a balanced
2-leg income transaction:

| Account leg              | Debit / Credit |
|--------------------------|----------------|
| Cash/Bank/QRIS account   | **Debit** (increases the asset) |
| Sales (income) account   | **Credit** (increases income)   |

**`daily-total`** — each day becomes a single balanced multi-row transaction
(one debit leg per payment method present that day, one combined credit to
sales). Example for a day with Cash 50000 and QRIS 30000:

| Account leg            | Debit  | Credit |
|------------------------|-------:|-------:|
| Cash                   | 50000  |        |
| QRIS                   | 30000  |        |
| Sales                  |        | 80000  |

- The Cash/Bank/QRIS account is chosen by the `paymentMethod` → account map.
- The income account defaults to **Sales**; the merchant can change it per
  connection.
- Backdated sales older than ~6 months may be auto-archived by FAZAI's
  maintenance routine; this is transparent and does not affect reports.

---

## 8. Testing checklist

1. Ask the merchant to create a POS connection and share the **API key** and the
   accepted **payment-method keys**.
2. Download the merchant's **Sample** file from FAZAI as a template.
3. Build your export. Start with a **single sale** using a known `saleId`.
4. Have the merchant import it. Confirm:
   - 1 transaction created, dated correctly,
   - the correct Cash/Bank account was debited,
   - Sales was credited.
5. **Re-import the same file.** Confirm the sale is now `skipped` (idempotency).
6. Test an **unknown payment method**. Confirm that sale is reported as an error
   and the others still import.
7. Send a multi-day export and confirm grouping matches the chosen posting mode.
8. Ship it. 🎉

---

## 9. Minimal example (copy-paste template)

```json
{
  "format": "fazai-pos-import",
  "version": 1,
  "apiKey": "REPLACE_WITH_MERCHANT_API_KEY",
  "posProvider": "Your POS",
  "exportedAt": "2026-06-29T12:00:00.000Z",
  "currency": "IDR",
  "sales": [
    {
      "saleId": "INV-1001",
      "datetime": "2026-06-29T09:30:00.000Z",
      "amount": 25000,
      "paymentMethod": "cash",
      "counterparty": "Walk-in",
      "description": "Breakfast combo"
    },
    {
      "saleId": "INV-1002",
      "datetime": "2026-06-29T11:05:00.000Z",
      "amount": 18000,
      "paymentMethod": "qris",
      "counterparty": "Go-Food",
      "description": "Nasi Goreng"
    }
  ]
}
```

---

## 10. Support & versioning

- **Current format version:** `1`.
- FAZAI checks `format` and `version` on import and rejects mismatches, so you
  will always know if a breaking change is introduced.
- This contract is forward-compatible with a planned real-time push endpoint:
  the same JSON `sales[]` payload and the same `apiKey` (as a bearer token) are
  expected to carry over.
