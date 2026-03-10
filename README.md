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
