import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const sourcePath = path.resolve(projectRoot, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destinationDir = path.resolve(projectRoot, "public");
const destinationPath = path.resolve(destinationDir, "pdf.worker.min.mjs");

async function copyPdfWorker() {
  await mkdir(destinationDir, { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

copyPdfWorker().catch((error) => {
  console.error("Failed to copy PDF.js worker:", error);
  process.exitCode = 1;
});
