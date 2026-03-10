"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

type Mode = "merge" | "split";

type PdfFileRecord = {
  id: string;
  file: File;
  pageCount: number;
};

type PageItem = {
  id: string;
  fileId: string;
  fileName: string;
  pageIndex: number;
  pageNumber: number;
  thumbnailUrl: string;
};

type SplitRange = {
  label: string;
  start: number;
  end: number;
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("merge");
  const [files, setFiles] = useState<PdfFileRecord[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [pageRanges, setPageRanges] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "success" | "error">("idle");
  const [working, setWorking] = useState(false);
  const dragPageId = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      pages.forEach((page) => URL.revokeObjectURL(page.thumbnailUrl));
    };
  }, [pages]);

  function updateStatus(message: string, type: "idle" | "success" | "error" = "idle") {
    setStatus(message);
    setStatusType(type);
  }

  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    setFiles((current) => (nextMode === "split" ? current.slice(0, 1) : current));
    setPages((current) => {
      if (nextMode !== "split" || !current.length) {
        return current;
      }

      const firstFileId = current[0].fileId;
      const removed = current.filter((page) => page.fileId !== firstFileId);
      removed.forEach((page) => URL.revokeObjectURL(page.thumbnailUrl));
      return current.filter((page) => page.fileId === firstFileId);
    });
    updateStatus("");
  }

  async function addFiles(incoming: FileList | null) {
    if (!incoming) {
      return;
    }

    const pdfFiles = Array.from(incoming).filter((file) => file.type === "application/pdf");
    if (!pdfFiles.length) {
      updateStatus("Only PDF files are supported.", "error");
      return;
    }

    setWorking(true);
    updateStatus("Reading PDFs...");

    try {
      const selectedFiles = mode === "split" ? [pdfFiles[0]] : pdfFiles;
      const built = await Promise.all(selectedFiles.map(buildPdfState));

      setFiles((current) => (mode === "split" ? [built[0].fileRecord] : [...current, ...built.map((entry) => entry.fileRecord)]));

      setPages((current) => {
        if (mode === "split") {
          current.forEach((page) => URL.revokeObjectURL(page.thumbnailUrl));
          return built[0].pages;
        }

        return [...current, ...built.flatMap((entry) => entry.pages)];
      });

      updateStatus(`${built.length} PDF file${built.length === 1 ? "" : "s"} loaded.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load PDFs.";
      updateStatus(message, "error");
    } finally {
      setWorking(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void addFiles(event.dataTransfer.files);
  }

  function clearAll() {
    pages.forEach((page) => URL.revokeObjectURL(page.thumbnailUrl));
    setFiles([]);
    setPages([]);
    setPageRanges("");
    updateStatus("");
  }

  async function handleRun() {
    if (!files.length) {
      updateStatus("Select at least one PDF first.", "error");
      return;
    }

    setWorking(true);
    updateStatus("Processing PDF...");

    try {
      if (mode === "merge") {
        await mergeReorderedPages(files, pages);
        updateStatus("Merged PDF is ready.", "success");
      } else {
        await splitIntoMultiplePdfs(files[0].file, pageRanges);
        updateStatus("Split PDFs were downloaded.", "success");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF processing failed.";
      updateStatus(message, "error");
    } finally {
      setWorking(false);
    }
  }

  function onDragStart(pageId: string) {
    if (mode !== "merge") {
      return;
    }

    dragPageId.current = pageId;
  }

  function onDragOver(event: DragEvent<HTMLLIElement>) {
    if (mode !== "merge") {
      return;
    }

    event.preventDefault();
  }

  function onDropPage(targetPageId: string) {
    if (mode !== "merge") {
      return;
    }

    const sourcePageId = dragPageId.current;
    dragPageId.current = null;

    if (!sourcePageId || sourcePageId === targetPageId) {
      return;
    }

    setPages((current) => reorderPages(current, sourcePageId, targetPageId));
  }

  return (
    <>
      <header className="fsi-navbar">
        <div className="fsi-container">
          <a className="fsi-brand fsi-display" href="#">PDFer</a>
          <div className="fsi-nav-actions">
            <a className="fsi-help" href="#tool" aria-label="Jump to PDF tool">?</a>
            <div className="fsi-account-menu" data-account-menu>
              <button className="fsi-secondary-btn" type="button" data-account-menu-toggle aria-expanded="false" aria-haspopup="true">
                Tool Menu
              </button>
              <ul className="fsi-account-menu-list" data-account-menu-list hidden>
                <li><a href="#tool" data-account-menu-item>PDF Tool</a></li>
                <li><a href="#" data-account-menu-item>Brand Guide</a></li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <main id="tool" className="fsi-container pdf-shell">
        <section className="pdf-hero">
          <p className="pdf-eyebrow">FSI PDF utility</p>
          <h1 className="fsi-display">Split or combine PDF pages in the browser</h1>
          <p>Merge at page level with drag reordering, or split into multiple output PDFs by page or range.</p>
        </section>

        <section className="fsi-card pdf-card">
          <div className="pdf-toolbar">
            <button type="button" className={mode === "merge" ? "fsi-primary-btn" : "fsi-secondary-btn"} onClick={() => handleModeChange("merge")}>
              Combine PDFs
            </button>
            <button type="button" className={mode === "split" ? "fsi-primary-btn" : "fsi-secondary-btn"} onClick={() => handleModeChange("split")}>
              Split Pages
            </button>
          </div>

          <div className="pdf-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <input type="file" accept="application/pdf" multiple onChange={onFileChange} />
            <div>
              <strong>Drop PDF files here</strong>
              <p>or click to browse</p>
            </div>
          </div>

          <div className="pdf-toolbar">
            <h2>{mode === "merge" ? "Page order" : "Source PDF"}</h2>
            <button type="button" className="fsi-secondary-btn" onClick={clearAll}>Clear</button>
          </div>

          {pages.length ? (
            <ul className="pdf-page-grid">
              {pages.map((page) => (
                <li
                  key={page.id}
                  className={mode === "merge" ? "pdf-page-card is-draggable" : "pdf-page-card"}
                  draggable={mode === "merge"}
                  onDragStart={() => onDragStart(page.id)}
                  onDragOver={onDragOver}
                  onDrop={() => onDropPage(page.id)}
                >
                  <img src={page.thumbnailUrl} alt={`${page.fileName} page ${page.pageNumber}`} className="pdf-thumb" />
                  <div>
                    <div className="pdf-file-name">{page.fileName}</div>
                    <div className="pdf-file-meta">Page {page.pageNumber}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="fileList"><li className="fileItem">No pages loaded.</li></ul>
          )}

          {mode === "split" ? (
            <div className="splitControls">
              <label htmlFor="pageRanges">Pages or ranges</label>
              <input id="pageRanges" className="fsi-input" value={pageRanges} onChange={(event) => setPageRanges(event.target.value)} placeholder="Examples: 1, 3-5, 8, 10-12" />
              <p className="helperText">Each page or range becomes its own output PDF. Example: 1, 3-5, 8.</p>
            </div>
          ) : (
            <p className="helperText">Drag page cards to change the final merge order.</p>
          )}

          <div className="pdf-toolbar">
            <button type="button" className="fsi-primary-btn" onClick={handleRun} disabled={working}>
              {working ? "Working..." : mode === "split" ? "Download split PDFs" : "Download merged PDF"}
            </button>
            <span className={`status ${statusType}`}>{status}</span>
          </div>
        </section>
      </main>
    </>
  );
}

async function buildPdfState(file: File) {
  const bytes = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const fileId = crypto.randomUUID();
  const pages: PageItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas rendering is not available in this browser.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await canvasToBlob(canvas);
    const thumbnailUrl = URL.createObjectURL(blob);

    pages.push({
      id: crypto.randomUUID(),
      fileId,
      fileName: file.name,
      pageIndex: pageNumber - 1,
      pageNumber,
      thumbnailUrl,
    });
  }

  return {
    fileRecord: {
      id: fileId,
      file,
      pageCount: pdfDoc.numPages,
    },
    pages,
  };
}

async function mergeReorderedPages(files: PdfFileRecord[], orderedPages: PageItem[]) {
  const mergedPdf = await PDFDocument.create();
  const sourceMap = new Map<string, PDFDocument>();

  for (const fileRecord of files) {
    const bytes = await fileRecord.file.arrayBuffer();
    sourceMap.set(fileRecord.id, await PDFDocument.load(bytes));
  }

  for (const page of orderedPages) {
    const source = sourceMap.get(page.fileId);
    if (!source) {
      throw new Error(`Missing source PDF for ${page.fileName}.`);
    }

    const [copiedPage] = await mergedPdf.copyPages(source, [page.pageIndex]);
    mergedPdf.addPage(copiedPage);
  }

  const output = await mergedPdf.save();
  downloadPdf(output, "merged.pdf");
}

async function splitIntoMultiplePdfs(file: File, input: string) {
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const ranges = parseSplitRanges(input, sourcePdf.getPageCount());
  const baseName = file.name.replace(/\.pdf$/i, "");

  for (const range of ranges) {
    const outputPdf = await PDFDocument.create();
    const indexes = [];

    for (let page = range.start; page <= range.end; page += 1) {
      indexes.push(page - 1);
    }

    const copiedPages = await outputPdf.copyPages(sourcePdf, indexes);
    copiedPages.forEach((page) => outputPdf.addPage(page));

    const output = await outputPdf.save();
    downloadPdf(output, `${baseName}-${range.label}.pdf`);
  }
}

function parseSplitRanges(input: string, pageCount: number): SplitRange[] {
  if (!input.trim()) {
    throw new Error("Enter one or more pages or ranges.");
  }

  return input.split(",").map((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) {
      throw new Error("Empty range value detected.");
    }

    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);

      if (start > end) {
        throw new Error(`Invalid range "${trimmed}".`);
      }

      validatePageNumber(start, pageCount);
      validatePageNumber(end, pageCount);

      return {
        label: `${start}-${end}`,
        start,
        end,
      };
    }

    const page = Number(trimmed);
    if (!Number.isInteger(page)) {
      throw new Error(`Invalid page value "${trimmed}".`);
    }

    validatePageNumber(page, pageCount);

    return {
      label: `${page}`,
      start: page,
      end: page,
    };
  });
}

function validatePageNumber(page: number, pageCount: number) {
  if (page < 1 || page > pageCount) {
    throw new Error(`Page ${page} is outside the document range of 1-${pageCount}.`);
  }
}

function reorderPages(items: PageItem[], sourceId: string, targetId: string) {
  const next = [...items];
  const sourceIndex = next.findIndex((item) => item.id === sourceId);
  const targetIndex = next.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return items;
  }

  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to render page thumbnail."));
    }, "image/png");
  });
}
