# PDFer

Browser-based PDF utility built with Next.js.

## Features

- Combine PDFs at page level
- Drag page thumbnails to reorder merge output
- Split one PDF into multiple output PDFs by page or range
- All PDF processing stays in the browser

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Google Cloud Run

### 1) Build container image

This repo includes a production Dockerfile (multi-stage) and `.dockerignore`.

Build and push with Cloud Build:

```bash
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/PROJECT_ID/pdfer/pdfer:latest
```

### 2) Deploy image to Cloud Run

```bash
gcloud run deploy pdfer \
  --image us-central1-docker.pkg.dev/PROJECT_ID/pdfer/pdfer:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Operational notes

- PDF processing (`pdf-lib`, `pdfjs-dist`) stays in the browser.
- Cloud Run serves only the Next.js app/runtime assets.
- This preserves the privacy model: source PDFs are not uploaded for processing.

## Split input examples

- `1`
- `1,3,5`
- `2-6`
- `1, 3-5, 8, 10-12`

Each page or range is downloaded as a separate PDF file.

## Notes

- Browsers may ask permission for multiple downloads in split mode.
- Thumbnail generation uses `pdfjs-dist`.
- Merge ordering is currently mouse drag-and-drop only.
