# PDFer Documentation

## 1. Product overview

PDFer is a browser-based PDF utility that supports:

- Page-level PDF merging
- Range-based PDF splitting
- Visual drag-and-drop page ordering

The product is designed for a fast, low-friction workflow while preserving document privacy by processing files locally in-browser.

## 2. User journeys

### 2.1 Merge journey

1. User opens app in merge mode (default).
2. User uploads one or more PDFs.
3. App renders thumbnails for each page.
4. User optionally reorders files (bulk move) and pages (fine move).
5. User names output file and exports merged PDF.

### 2.2 Split journey

1. User switches to split mode.
2. User uploads one PDF.
3. User enters page segments (`1`, `3-5`, `8`).
4. User sets base/custom names.
5. App exports one PDF per segment.

## 3. UX and FSI design guidance

To keep the app aligned with FSI design/documentation standards:

- Prefer concise labels and explicit action verbs.
- Keep high-contrast status feedback for success/error states.
- Preserve layout rhythm: hero, controls, preview area, help/documentation.
- Ensure critical actions remain above fold on common laptop viewports.
- Keep interaction patterns consistent between merge and split modes.

### Accessibility recommendations

- Maintain keyboard focus visibility for file inputs/buttons.
- Add keyboard alternatives for drag-and-drop where possible.
- Keep semantic headings and descriptive `aria-label`s.
- Ensure status text changes are readable and unambiguous.

## 4. Functional specification

### 4.1 Supported operations

- Accept only valid PDF uploads.
- Render page thumbnails for visual ordering.
- Merge selected/reordered pages into a single PDF.
- Split one source PDF into multiple outputs by range.
- Download outputs directly to user device.

### 4.2 Split syntax

Accepted examples:

- `1`
- `1,3,5`
- `2-6`
- `1, 3-5, 8, 10-12`

Each comma-separated segment creates an independent output file.

### 4.3 Output naming

- Merge output defaults to `merged.pdf`.
- Split base defaults to source filename stem.
- Custom split names are optional but must match segment count.

## 5. Security and privacy

### 5.1 Core controls

- Client-side processing only for document content.
- No backend upload requirement for merge/split operations.
- Blob URL lifecycle management (`URL.revokeObjectURL`) to reduce memory exposure.
- Input validation for ranges and filenames.

### 5.2 Operational controls

- Keep dependencies patched (`next`, `pdf-lib`, `pdfjs-dist`).
- Avoid logging user document content.
- Serve over HTTPS in production deployment.

### 5.3 Email governance

**All email is controlled via Postmark.**

Guidance for future email features:

- Centralize provider calls in one service/module.
- Use Postmark templates for consistency and auditability.
- Avoid embedding API keys in client bundles; keep credentials server-side.

## 6. Development and operations

### Local development

```bash
npm install
npm run dev
```

### Build and run

```bash
npm run build
npm run start
```

### Deploy target

- Dockerized Next.js app
- Google Cloud Run compatible image and command flow

## 7. Quality checklist

Before release:

- Verify merge flow with multiple multi-page PDFs.
- Verify split flow with mixed single/range segments.
- Confirm invalid range handling and error messaging.
- Confirm generated file names are safe and correct.
- Confirm UI behavior in both dark/light theme if enabled by FSI scripts.

## 8. Roadmap recommendations

- Add keyboard-accessible page reordering controls.
- Add client-side progress indicators per document.
- Add optional zip packaging for many split outputs.
- Add automated tests for range parser and filename sanitizer helpers.
