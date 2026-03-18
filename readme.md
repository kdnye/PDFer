# PDFer — FSI PDF Utility

A browser-first PDF utility for combining and splitting PDFs with a workflow aligned to FSI design principles (clarity, consistency, and secure-by-default behavior).

## What this app does

- **Combine PDFs at page level** with drag-and-drop reordering.
- **Reorder by file** before fine-grained page ordering.
- **Split one PDF into many** using page numbers and ranges (`1, 3-5, 8`).
- **Generate downloads locally** in the browser using `pdf-lib` and thumbnail rendering via `pdfjs-dist`.

## Security and privacy model

PDFer is intentionally built so that document processing is performed client-side:

- Source PDFs are opened in the browser runtime.
- Merge/split operations are performed in-memory in the browser.
- Output files are generated via download blobs.
- The server only hosts static assets and the Next.js application shell.

> This model minimizes exposure of document data and follows least-privilege design: no backend document processing pipeline is required for core functionality.

## FSI design principles applied

The interface follows a structured FSI design language already present in this project (`fsi.css` + `app-override.css`):

- **Strong visual hierarchy** in hero/title and panel organization.
- **Consistent component styling** via shared FSI class names (`fsi-card`, `fsi-primary-btn`, `fsi-input`).
- **Action clarity** with explicit mode switching (`Combine PDFs` vs `Split Pages`).
- **Feedback loop** with status messages for loading, success, and error states.
- **Safe defaults** (`merged.pdf`, split base name from source file) to reduce user error.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Production build

```bash
npm run build
npm run start
```

## How to use

### Combine PDFs

1. Select **Combine PDFs** mode.
2. Drop one or more PDF files into the drop zone.
3. (Optional) Drag file rows to move full file groups.
4. Drag page thumbnails for final page-level order.
5. Set the merged output filename.
6. Click **Download merged PDF**.

### Split a PDF

1. Select **Split Pages** mode.
2. Upload a single PDF.
3. Enter ranges like `1, 3-5, 8`.
4. Optionally set:
   - base output name
   - custom names (comma-separated, one per range)
5. Click **Download split PDFs**.

## Input rules and validation

- Only `application/pdf` files are accepted.
- Split ranges must be valid, in bounds, and comma-separated.
- Custom output names must match the number of split segments.
- Filenames are sanitized and `.pdf` extension is enforced where needed.

## Tech stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript + React 19
- **PDF operations:** `pdf-lib`
- **Preview rendering:** `pdfjs-dist`
- **Brand/theme assets:** `public/fsi.css`, `public/app-override.css`, `public/theme.js`, `public/navbar.js`

## Email policy

Per project instruction: **all email handling is controlled via Postmark**.

Current state:

- This app currently has no outbound email workflow in the checked-in code.
- If email notifications are added later (e.g., audit notices, support events), they should be routed only through Postmark integration modules.

## Deployment (Cloud Run)

Build and publish:

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/PROJECT_ID/pdfer/pdfer:latest
```

Deploy:

```bash
gcloud run deploy pdfer \
  --image us-central1-docker.pkg.dev/PROJECT_ID/pdfer/pdfer:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Further documentation

- `documentation.md` — detailed product + operational guide
- `architecture.md` — technical architecture, data flow, extension strategy
