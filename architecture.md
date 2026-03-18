# PDFer Architecture

## 1. System context

PDFer is a **single-application web frontend** deployed with Next.js.

- **Runtime:** Browser + Next.js server runtime
- **Primary logic location:** `app/page.tsx` (client component)
- **Static assets:** `public/*` for theme/navbar/styles
- **Deployment:** containerized Next.js app (Cloud Run ready)

## 2. High-level architecture

```text
User Browser
  ├─ UI (React client component)
  ├─ PDF thumbnail rendering (pdfjs-dist)
  ├─ PDF manipulation (pdf-lib)
  └─ Blob downloads (merged/split output)

Next.js App Server
  ├─ Serves HTML/CSS/JS assets
  └─ No document-processing backend required
```

## 3. Core modules and responsibilities

### `app/page.tsx`

Primary application controller and UI:

- Mode management (`merge` / `split`)
- File intake and filtering
- Thumbnail generation via PDF.js
- Reordering (file-level and page-level drag/drop)
- Merge and split execution using PDF-Lib
- Status and error messaging

### `app/layout.tsx`

Global document shell:

- Injects FSI stylesheet links
- Loads theme and navbar scripts
- Provides base metadata/title/description

### `app/globals.css`

App-specific style tokens and layout overrides for PDF tool views.

### `public/fsi.css` + `public/app-override.css`

Design system base styles and local overrides.

## 4. Data model (in-memory)

- `PdfFileRecord`
  - `id`
  - `file` (browser `File`)
  - `pageCount`

- `PageItem`
  - `id`
  - `fileId`
  - `fileName`
  - `pageIndex`
  - `pageNumber`
  - `thumbnailUrl`

- `SplitRange`
  - `label`
  - `start`
  - `end`

All objects are transient and kept in client memory for session scope.

## 5. Processing flows

### 5.1 File ingest flow

1. Accept dropped/selected files.
2. Filter to PDF MIME type.
3. Parse PDF and page count.
4. Render each page thumbnail to canvas.
5. Convert canvas to blob URLs.
6. Store page metadata for ordering and export.

### 5.2 Merge flow

1. Build `sourceMap` of loaded PDFs (`PDFDocument.load`).
2. Iterate ordered `PageItem[]`.
3. Copy referenced pages in current order.
4. Save merged PDF bytes.
5. Download as sanitized filename.

### 5.3 Split flow

1. Parse and validate range expression.
2. For each range, build a new PDF.
3. Copy page subset from source.
4. Save and download with base/custom name.

## 6. Error handling strategy

- User-visible status channel with success/error states.
- Guard clauses for no-file and invalid-input conditions.
- Typed error fallback (`error instanceof Error ? error.message : ...`).
- Browser capability check for canvas context.

## 7. Security model

- Document bytes never require server upload for core features.
- Output generated locally through blob downloads.
- Sanitized filenames reduce unsafe path/name patterns.
- Object URLs revoked during cleanup to reduce memory retention.

## 8. Performance characteristics

- Thumbnail rendering is per-page and can be expensive for large PDFs.
- Memory grows with number of rendered page images.
- Merge/split complexity scales with page count and file count.

### Improvement options

- Lazy thumbnail rendering (viewport-only)
- Thumbnail cache + worker offloading
- Batch processing with progress reporting

## 9. Extensibility plan

Recommended refactors as app grows:

- Extract pure helpers into `lib/pdf/*` for testability.
- Separate UI components (`ModeToggle`, `Dropzone`, `PageGrid`, `SplitControls`).
- Add unit tests for parser/sanitizer/reorder utilities.
- Add E2E test path for merge/split happy path.

## 10. Email integration policy

Per project rule: **all email is controlled via Postmark**.

Architecture guidance for future notifications:

- Implement server-side `emailService` abstraction.
- Back implementation with Postmark SDK/API only.
- Keep provider keys in server environment variables.
- Never call provider secrets from client components.
