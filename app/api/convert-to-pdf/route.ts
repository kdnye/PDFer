import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { degrees, PDFDocument } from "pdf-lib";
import {
  PAGINATION_ORIENTATION_EXTENSION_SET,
  SERVER_CONVERTIBLE_DESCRIPTION,
  SERVER_CONVERTIBLE_EXTENSION_SET,
} from "../../lib/supported-file-types";

const execFileAsync = promisify(execFile);
type PaginationOrientation = "auto" | "portrait" | "landscape";

export async function POST(request: NextRequest) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pdfer-convert-"));

  try {
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
      pdfBuffer = Buffer.from(await applyPaginationOrientation(pdfBuffer, paginationOrientation));
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

async function applyPaginationOrientation(buffer: Buffer, orientation: Exclude<PaginationOrientation, "auto">) {
  const pdfDoc = await PDFDocument.load(buffer);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const shouldRotate = orientation === "landscape" ? width < height : width > height;

    if (shouldRotate) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + 90) % 360));
    }
  }

  return pdfDoc.save();
}
