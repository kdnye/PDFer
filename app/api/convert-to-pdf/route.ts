import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import {
  PAGINATION_ORIENTATION_EXTENSION_SET,
  SERVER_CONVERTIBLE_DESCRIPTION,
  SERVER_CONVERTIBLE_EXTENSION_SET,
} from "../../lib/supported-file-types";

const execFileAsync = promisify(execFile);
const DEFAULT_PAGE_DIMENSIONS = {
  width: 612,
  height: 792,
} as const;

type PaginationOrientation = "auto" | "portrait" | "landscape";

type ConvertToPdfRequestBody = {
  targetWidth?: number;
  targetHeight?: number;
};

type PageDimensions = {
  targetWidth: number;
  targetHeight: number;
};

export async function POST(request: NextRequest) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pdfer-convert-"));

  try {
    const requestBody = await parseConvertToPdfRequestBody(request);
    const { targetWidth, targetHeight } = parsePageDimensions(requestBody);

    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const paginationOrientation = parsePaginationOrientation(formData.get("paginationOrientation"));

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "Attach a file in the 'file' field." }, { status: 400 });
    }

    const extension = getFileExtension(uploadedFile.name);
    if (!SERVER_CONVERTIBLE_EXTENSION_SET.has(extension)) {
      return NextResponse.json({ error: `Only ${SERVER_CONVERTIBLE_DESCRIPTION} are supported for auto-conversion.` }, { status: 400 });
    }

    const safeBaseName = sanitizeName(stripFileExtension(uploadedFile.name)) || "document";
    const sourcePath = path.join(tempRoot, `${safeBaseName}.${extension}`);
    const outputPath = path.join(tempRoot, `${safeBaseName}.pdf`);

    const inputBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    await fs.writeFile(sourcePath, inputBuffer);

    await execFileAsync(
      "soffice",
      ["--headless", "--convert-to", "pdf", "--outdir", tempRoot, sourcePath],
      { timeout: 60_000 },
    );

    let pdfBuffer = await fs.readFile(outputPath);
    const shouldForceOrientation = paginationOrientation !== "auto" && PAGINATION_ORIENTATION_EXTENSION_SET.has(extension);

    if (shouldForceOrientation) {
      pdfBuffer = Buffer.from(
        await applyPaginationOrientation(pdfBuffer, paginationOrientation, {
          targetWidth,
          targetHeight,
        }),
      );
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeBaseName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected conversion error.";
    return NextResponse.json({ error: `Document conversion failed: ${message}` }, { status: 500 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return (parts[parts.length - 1] || "").toLowerCase();
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function sanitizeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").trim();
}

function parsePaginationOrientation(value: FormDataEntryValue | null): PaginationOrientation {
  if (value === "portrait" || value === "landscape" || value === "auto") {
    return value;
  }

  return "auto";
}

async function parseConvertToPdfRequestBody(request: NextRequest): Promise<ConvertToPdfRequestBody> {
  try {
    const body = (await request.clone().json()) as ConvertToPdfRequestBody;
    return typeof body === "object" && body !== null ? body : {};
  } catch {
    return {};
  }
}

function parsePageDimensions(body: ConvertToPdfRequestBody): PageDimensions {
  const targetWidth = Number.isFinite(body.targetWidth) && body.targetWidth! > 0
    ? body.targetWidth!
    : DEFAULT_PAGE_DIMENSIONS.width;
  const targetHeight = Number.isFinite(body.targetHeight) && body.targetHeight! > 0
    ? body.targetHeight!
    : DEFAULT_PAGE_DIMENSIONS.height;

  return { targetWidth, targetHeight };
}

async function applyPaginationOrientation(
  buffer: Buffer,
  orientation: Exclude<PaginationOrientation, "auto">,
  dimensions: PageDimensions,
) {
  const originalPdf = await PDFDocument.load(buffer);
  const newPdf = await PDFDocument.create();

  const targetWidth = orientation === "landscape"
    ? Math.max(dimensions.targetWidth, dimensions.targetHeight)
    : Math.min(dimensions.targetWidth, dimensions.targetHeight);
  const targetHeight = orientation === "landscape"
    ? Math.min(dimensions.targetWidth, dimensions.targetHeight)
    : Math.max(dimensions.targetWidth, dimensions.targetHeight);

  const originalPages = originalPdf.getPages();
  const embeddedPages = await newPdf.embedPdf(buffer);

  for (let i = 0; i < originalPages.length; i++) {
    const page = originalPages[i];
    const embeddedPage = embeddedPages[i];
    const { width, height } = page.getSize();

    const isOriginalLandscape = width > height;
    const isTargetLandscape = targetWidth > targetHeight;

    if (isOriginalLandscape === isTargetLandscape) {
      const newPage = newPdf.addPage([targetWidth, targetHeight]);
      const scale = Math.min(targetWidth / width, targetHeight / height);
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      newPage.drawPage(embeddedPage, {
        x: (targetWidth - scaledWidth) / 2,
        y: (targetHeight - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight,
      });
      continue;
    }

    const scale = targetWidth / width;
    const scaledHeight = height * scale;
    const chunks = Math.ceil(scaledHeight / targetHeight);

    for (let chunk = 0; chunk < chunks; chunk++) {
      const newPage = newPdf.addPage([targetWidth, targetHeight]);
      const yOffset = targetHeight - scaledHeight + chunk * targetHeight;

      newPage.drawPage(embeddedPage, {
        x: 0,
        y: yOffset,
        width: targetWidth,
        height: scaledHeight,
      });
    }
  }

  return newPdf.save();
}
