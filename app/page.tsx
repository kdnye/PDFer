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
  const [mergeFileName, setMergeFileName] = useState("merged.pdf");
  const [splitBaseName, setSplitBaseName] = useState("split");
  const [splitFileNames, setSplitFileNames] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"idle" | "success" | "error">("idle");
  const [working, setWorking] = useState(false);
  const dragPageId = useRef<string | null>(null);
  const dragFileId = useRef<string | null>(null);

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

    if (nextMode === "split") {
      setMergeFileName("merged.pdf");
      setSplitFileNames("");
    }
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

      if (mode === "split" && built[0]) {
        setSplitBaseName(stripPdfExtension(built[0].fileRecord.file.name));
      }

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
    setMergeFileName("merged.pdf");
    setSplitBaseName("split");
    setSplitFileNames("");
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
        await mergeReorderedPages(files, pages, mergeFileName);
        updateStatus("Merged PDF is ready.", "success");
      } else {
        await splitIntoMultiplePdfs(files[0].file, pageRanges, splitBaseName, splitFileNames);
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

  function onDragStartFile(fileId: string) {
    if (mode !== "merge") {
      return;
    }

    dragFileId.current = fileId;
  }

  function onDropFile(targetFileId: string) {
    if (mode !== "merge") {
      return;
    }

    const sourceFileId = dragFileId.current;
    dragFileId.current = null;

    if (!sourceFileId || sourceFileId === targetFileId) {
      return;
    }

    setFiles((currentFiles) => {
      const nextFiles = [...currentFiles];
      const sourceIndex = nextFiles.findIndex((file) => file.id === sourceFileId);
      const targetIndex = nextFiles.findIndex((file) => file.id === targetFileId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return currentFiles;
      }

      const [moved] = nextFiles.splice(sourceIndex, 1);
      nextFiles.splice(targetIndex, 0, moved);

      setPages((currentPages) => {
        const pagesByFile = new Map<string, PageItem[]>();

        currentPages.forEach((page) => {
          if (!pagesByFile.has(page.fileId)) {
            pagesByFile.set(page.fileId, []);
          }

          pagesByFile.get(page.fileId)!.push(page);
        });

        return nextFiles.flatMap((file) => pagesByFile.get(file.id) || []);
      });

      return nextFiles;
    });
  }

  function groupPagesByFile() {
    setPages((currentPages) => {
      const pagesByFile = new Map<string, PageItem[]>();

      currentPages.forEach((page) => {
        if (!pagesByFile.has(page.fileId)) {
          pagesByFile.set(page.fileId, []);
        }

        pagesByFile.get(page.fileId)!.push(page);
      });

      return files.flatMap((file) => pagesByFile.get(file.id) || []);
    });
  }

  return (
    <>
      <header className="fsi-navbar">
        <div className="fsi-container">
          <a className="fsi-brand fsi-display" href="#">PDFer</a>
          <div className="fsi-nav-actions">
            <a className="fsi-help" href="#help" aria-label="Jump to Help Section">?</a>
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
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {mode === "merge" && files.length > 1 && (
                <button type="button" className="fsi-secondary-btn" onClick={groupPagesByFile}>Group by File</button>
              )}
              <button type="button" className="fsi-secondary-btn" onClick={clearAll}>Clear</button>
            </div>
          </div>

          {mode === "merge" && files.length > 1 && (
            <div className="splitControls" style={{ marginBottom: "1.5rem" }}>
              <p className="helperText">Drag files to reorder all associated pages at once.</p>
              <ul className="fileList" style={{ display: "grid", gap: "0.5rem" }}>
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="fileItem is-draggable"
                    style={{ display: "flex", justifyContent: "space-between", background: "var(--color-surface)" }}
                    draggable
                    onDragStart={() => onDragStartFile(file.id)}
                    onDragOver={onDragOver}
                    onDrop={() => onDropFile(file.id)}
                  >
                    <span className="pdf-file-name">{file.file.name}</span>
                    <span className="pdf-file-meta">{file.pageCount} pages</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

              <label htmlFor="splitBaseName">Base output name</label>
              <input id="splitBaseName" className="fsi-input" value={splitBaseName} onChange={(event) => setSplitBaseName(event.target.value)} placeholder="split" />
              <p className="helperText">Default names use this base name, followed by the range label.</p>

              <label htmlFor="splitFileNames">Custom names (optional)</label>
              <input id="splitFileNames" className="fsi-input" value={splitFileNames} onChange={(event) => setSplitFileNames(event.target.value)} placeholder="Comma separated, in range order" />
              <p className="helperText">Set one filename per range in the same order as your ranges. Example: Intro, Section-A, Appendix.</p>
            </div>
          ) : (
            <div className="splitControls">
              <p className="helperText">Drag page cards to change the final merge order.</p>
              <label htmlFor="mergeFileName">Merged file name</label>
              <input id="mergeFileName" className="fsi-input" value={mergeFileName} onChange={(event) => setMergeFileName(event.target.value)} placeholder="merged.pdf" />
            </div>
          )}

          <div className="pdf-toolbar">
            <button type="button" className="fsi-primary-btn" onClick={handleRun} disabled={working}>
              {working ? "Working..." : mode === "split" ? "Download split PDFs" : "Download merged PDF"}
            </button>
            <span className={`status ${statusType}`}>{status}</span>
          </div>
        </section>

        <section id="help" className="fsi-card pdf-card" style={{ marginTop: "2rem" }}>
          <h2>Documentation &amp; Usage</h2>

          <div className="fsi-flash fsi-flash-success" style={{ marginBottom: "1.5rem" }}>
            <strong>Security Note:</strong> All PDF rendering, splitting, and merging occurs entirely within your local browser. No document data is ever uploaded to a remote server.
          </div>

          <div className="fsi-help-card fsi-help-card--origin">
            <h4>Combining PDFs</h4>
            <p>Merge multiple PDF documents or specific pages into a single file.</p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
              <li><strong>File-Level Sorting:</strong> When multiple files are loaded, drag and drop the file names in the list to reorder all associated pages at once.</li>
              <li><strong>Page-Level Sorting:</strong> Drag and drop individual page thumbnails to fine-tune the final document order.</li>
              <li><strong>Group by File:</strong> Use this button to instantly snap scattered pages back into sequential order grouped by their source file, without losing your individual page arrangements.</li>
            </ul>
          </div>

          <div className="fsi-help-card fsi-help-card--delivery">
            <h4>Splitting PDFs</h4>
            <p>Extract specific pages or page ranges from a single source PDF into separate files.</p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
              <li><strong>Syntax:</strong> Enter pages or ranges separated by commas (e.g., <code>1, 3-5, 8, 10-12</code>). Each comma-separated segment will be downloaded as an independent PDF.</li>
              <li><strong>Base Output Name:</strong> Defines the prefix for the exported files. If set to "Invoice", a range of <code>3-5</code> will export as <code>Invoice-3-5.pdf</code>.</li>
              <li><strong>Custom Names:</strong> Provide a comma-separated list of exact file names corresponding to your ranges (e.g., <code>Cover, Main-Report, Appendix</code>). The number of custom names must exactly match the number of segments in your range input.</li>
            </ul>
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

async function mergeReorderedPages(files: PdfFileRecord[], orderedPages: PageItem[], requestedFileName: string) {
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
  downloadPdf(output, ensurePdfExtension(requestedFileName.trim()) || "merged.pdf");
}

async function splitIntoMultiplePdfs(file: File, input: string, baseNameInput: string, customNamesInput: string) {
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const ranges = parseSplitRanges(input, sourcePdf.getPageCount());
  const fallbackBaseName = stripPdfExtension(file.name) || "split";
  const configuredBaseName = sanitizeFileName(baseNameInput.trim()) || fallbackBaseName;
  const customNames = parseCustomFileNames(customNamesInput, ranges.length);

  for (const [index, range] of ranges.entries()) {
    const outputPdf = await PDFDocument.create();
    const indexes = [];

    for (let page = range.start; page <= range.end; page += 1) {
      indexes.push(page - 1);
    }

    const copiedPages = await outputPdf.copyPages(sourcePdf, indexes);
    copiedPages.forEach((page) => outputPdf.addPage(page));

    const output = await outputPdf.save();
    const customFileName = customNames[index];
    const defaultFileName = `${configuredBaseName}-${range.label}`;
    const resolvedName = ensurePdfExtension(customFileName || defaultFileName);
    downloadPdf(output, resolvedName);
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

function stripPdfExtension(value: string) {
  return value.replace(/\.pdf$/i, "");
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").trim();
}

function ensurePdfExtension(value: string) {
  const sanitized = sanitizeFileName(value);
  if (!sanitized) {
    return "";
  }

  return /\.pdf$/i.test(sanitized) ? sanitized : `${sanitized}.pdf`;
}

function parseCustomFileNames(input: string, rangeCount: number) {
  if (!input.trim()) {
    return [];
  }

  const names = input
    .split(",")
    .map((item) => sanitizeFileName(item.trim()))
    .filter((item) => item.length > 0);

  if (names.length !== rangeCount) {
    throw new Error(`Provide exactly ${rangeCount} custom filename${rangeCount === 1 ? "" : "s"}, or leave the field empty.`);
  }

  return names;
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
