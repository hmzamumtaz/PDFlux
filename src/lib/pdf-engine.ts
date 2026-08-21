/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(data, { ignoreEncryption: true });
  } catch (err: any) {
    throw new Error(`Could not read this PDF: ${err?.message || 'the file appears to be corrupted or is not a PDF.'}`);
  }
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as any], { type: 'application/pdf' });
}

// Single shared pdf.js loader. The worker ships bundled with the app (no CDN),
// so every tool works offline, in Electron, and can never hit an API/worker
// version mismatch. The legacy build is used because the modern one requires
// bleeding-edge JS features (e.g. Map.getOrInsertComputed) that many otherwise
// current browsers don't have yet.
export async function getPdfJs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc && !pdfjsLib.GlobalWorkerOptions.workerPort) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjsLib;
}

// Browsers cap canvas dimensions (~16k px) and large canvases exhaust memory.
// Clamp the render scale so no side exceeds maxDim.
function safeScale(baseWidth: number, baseHeight: number, desiredScale: number, maxDim = 8000): number {
  const largest = Math.max(baseWidth, baseHeight) * desiredScale;
  return largest > maxDim ? desiredScale * (maxDim / largest) : desiredScale;
}

function canvasToJpgBytes(canvas: HTMLCanvasElement, quality: number): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
}

/**
 * Parse a user-facing page spec like "1, 3, 5-8" into a sorted, deduplicated
 * list of page numbers. Throws a clear error when the spec references pages
 * outside 1..totalPages, so tools fail with a readable message instead of a
 * cryptic pdf-lib index error.
 */
export function parsePageSpec(input: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const invalid: string[] = [];
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (start < 1 || end > totalPages || start > end) { invalid.push(part); continue; }
      for (let p = start; p <= end; p++) pages.add(p);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 1 || n > totalPages) { invalid.push(part); continue; }
      pages.add(n);
    } else {
      invalid.push(part);
    }
  }
  if (invalid.length > 0) {
    throw new Error(`Invalid page reference${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. This document has ${totalPages} page${totalPages === 1 ? '' : 's'}.`);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

function assertValidPageNumbers(pageNumbers: number[], totalPages: number, what = 'page') {
  const bad = pageNumbers.filter(n => !Number.isInteger(n) || n < 1 || n > totalPages);
  if (bad.length > 0) {
    throw new Error(`Invalid ${what} number${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}. This document has ${totalPages} page${totalPages === 1 ? '' : 's'}.`);
  }
}

export async function mergePdfs(files: File[]): Promise<Blob> {
  if (files.length < 2) throw new Error('Select at least 2 PDF files to merge.');
  const merged = await PDFDocument.create();
  for (const file of files) {
    const buf = await readFileAsArrayBuffer(file);
    let doc: PDFDocument;
    try {
      doc = await loadPdf(buf);
    } catch {
      throw new Error(`"${file.name}" could not be read. It may be corrupted or not a valid PDF.`);
    }
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return toBlob(await merged.save({ useObjectStreams: true }));
}

export async function splitPdf(file: File, ranges: { start: number; end: number }[]): Promise<Blob[]> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const total = src.getPageCount();
  for (const range of ranges) {
    if (range.start < 1 || range.end > total || range.start > range.end) {
      throw new Error(`Invalid range ${range.start}-${range.end}. This document has ${total} page${total === 1 ? '' : 's'}.`);
    }
  }
  const results: Blob[] = [];
  for (const range of ranges) {
    const newDoc = await PDFDocument.create();
    const indices = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start - 1 + i);
    const pages = await newDoc.copyPages(src, indices);
    pages.forEach(p => newDoc.addPage(p));
    results.push(toBlob(await newDoc.save({ useObjectStreams: true })));
  }
  return results;
}

export async function removePagesFromFile(file: File, pageNumbers: number[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const total = src.getPageCount();
  assertValidPageNumbers(pageNumbers, total);
  const keepIndices = Array.from({ length: total }, (_, i) => i).filter(i => !pageNumbers.includes(i + 1));
  if (keepIndices.length === 0) throw new Error('Cannot remove every page — the PDF would be empty.');
  const newDoc = await PDFDocument.create();
  const pages = await newDoc.copyPages(src, keepIndices);
  pages.forEach(p => newDoc.addPage(p));
  return toBlob(await newDoc.save({ useObjectStreams: true }));
}

export async function extractPages(file: File, pageNumbers: number[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  assertValidPageNumbers(pageNumbers, src.getPageCount());
  const newDoc = await PDFDocument.create();
  const indices = pageNumbers.map(n => n - 1);
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach(p => newDoc.addPage(p));
  return toBlob(await newDoc.save({ useObjectStreams: true }));
}

export async function reorderPages(file: File, newOrder: number[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  assertValidPageNumbers(newOrder, src.getPageCount());
  const newDoc = await PDFDocument.create();
  const indices = newOrder.map(n => n - 1);
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach(p => newDoc.addPage(p));
  return toBlob(await newDoc.save({ useObjectStreams: true }));
}

export async function rotatePages(file: File, pageNumbers: number[], angle: 90 | 180 | 270 | -90 | -180 | -270): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  assertValidPageNumbers(pageNumbers, src.getPageCount());
  for (const num of pageNumbers) {
    const page = src.getPage(num - 1);
    const current = page.getRotation().angle;
    // PDF viewers only accept rotations of 0/90/180/270 — normalize.
    const normalized = ((current + angle) % 360 + 360) % 360;
    page.setRotation(degrees(normalized));
  }
  return toBlob(await src.save({ useObjectStreams: true }));
}

export interface OptimizeResult {
  blob: Blob;
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercent: number;
  metadataStripped: boolean;
}

/**
 * Lossless optimization: rebuilds the file with compressed object streams
 * (also discarding orphaned objects, old incremental-save revisions and, when
 * requested, document metadata). Text stays selectable and images untouched.
 * If the rebuilt file is not smaller, the original is returned unchanged.
 */
export async function optimizePdf(file: File, options?: { stripMetadata?: boolean }): Promise<OptimizeResult> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);

  const stripMetadata = options?.stripMetadata ?? false;
  if (stripMetadata) {
    src.setTitle('');
    src.setAuthor('');
    src.setSubject('');
    src.setKeywords([]);
    src.setCreator('');
    src.setProducer('');
  }

  const optimized = await src.save({ useObjectStreams: true, addDefaultPage: false });
  const useOptimized = optimized.byteLength < file.size;
  const blob = useOptimized ? toBlob(optimized) : new Blob([buf], { type: 'application/pdf' });

  return {
    blob,
    originalSize: file.size,
    optimizedSize: blob.size,
    savedBytes: Math.max(0, file.size - blob.size),
    savedPercent: file.size > 0 ? Math.max(0, Math.round((1 - blob.size / file.size) * 100)) : 0,
    metadataStripped: stripMetadata,
  };
}

export async function compressPdf(file: File): Promise<Blob> {
  return (await optimizePdf(file)).blob;
}

export interface RepairResult {
  blob: Blob;
  pages: number;
  mode: 'structure' | 'rebuild';
  message: string;
}

/**
 * Repair a damaged PDF. First tries a structural repair: pdf-lib re-parses the
 * document and writes a brand-new file with a fresh cross-reference table,
 * object numbering and trailer — this fixes the most common corruption
 * (truncated xref, broken offsets, bad incremental saves) while keeping all
 * content intact. If parsing fails entirely, falls back to pdf.js (which has a
 * far more tolerant parser), re-rendering each page and rebuilding the PDF
 * with an invisible text layer so text stays selectable.
 */
export async function repairPdf(file: File, onProgress?: (msg: string) => void): Promise<RepairResult> {
  const buf = await readFileAsArrayBuffer(file);

  try {
    onProgress?.('Attempting structural repair...');
    const src = await PDFDocument.load(buf, { ignoreEncryption: true, throwOnInvalidObject: false });
    const pageCount = src.getPageCount();
    if (pageCount === 0) throw new Error('no pages');
    const bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
    return {
      blob: toBlob(bytes),
      pages: pageCount,
      mode: 'structure',
      message: 'Rebuilt the PDF structure (cross-reference table, object numbering and trailer). All content preserved.',
    };
  } catch {
    // fall through to full rebuild
  }

  onProgress?.('Structure unreadable — rebuilding page by page...');
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), stopAtErrors: false }).promise;
  const rebuilt = await PDFDocument.create();
  const font = await rebuilt.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Recovering page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = safeScale(baseVp.width, baseVp.height, 2);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const img = await rebuilt.embedJpg(canvasToJpgBytes(canvas, 0.92));
    const pdfPage = rebuilt.addPage([baseVp.width, baseVp.height]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: baseVp.width, height: baseVp.height });
    await drawInvisibleTextLayer(pdfPage, page, baseVp, font);
  }

  return {
    blob: toBlob(await rebuilt.save()),
    pages: pdf.numPages,
    mode: 'rebuild',
    message: `The file was too damaged for structural repair, so all ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} were recovered and rebuilt into a fresh PDF with a searchable text layer.`,
  };
}

// Overlay the page's real text (from pdf.js) as invisible glyphs so
// rasterized pages stay selectable and searchable.
async function drawInvisibleTextLayer(pdfPage: any, pdfjsPage: any, baseVp: any, font: any) {
  try {
    const content = await pdfjsPage.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = (item as any).transform;
      const fontSize = Math.abs(tx[3]) || Math.abs(tx[0]) || 10;
      const x = tx[4];
      const y = tx[5];
      const clean = item.str.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
      if (!clean.trim()) continue;
      try {
        pdfPage.drawText(clean, { x, y, size: fontSize, font, opacity: 0 });
      } catch { /* skip glyphs the fallback font can't encode */ }
    }
  } catch { /* text layer is best-effort */ }
}

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  targetSize: number;
  achieved: boolean;
  quality: number;
  pages: number;
}

export async function compressToTargetSize(file: File, targetBytes: number, onProgress?: (msg: string) => void): Promise<CompressResult> {
  const pdfjsLib = await getPdfJs();

  const originalSize = file.size;
  const buf = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdfDoc.numPages;

  if (targetBytes >= originalSize) {
    return { blob: new Blob([buf], { type: 'application/pdf' }), originalSize, compressedSize: originalSize, targetSize: targetBytes, achieved: true, quality: 1, pages: numPages };
  }

  // Pass 1 — lossless: rebuild with compressed object streams. If this alone
  // hits the target the text stays fully selectable and nothing is rasterized.
  try {
    onProgress?.('Trying lossless compression...');
    const lossless = await optimizePdf(file);
    if (lossless.blob.size <= targetBytes) {
      return { blob: lossless.blob, originalSize, compressedSize: lossless.blob.size, targetSize: targetBytes, achieved: true, quality: 1, pages: numPages };
    }
  } catch { /* corrupted structure — continue with raster pipeline */ }

  async function renderAndBuild(scale: number): Promise<Blob> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const baseVp = page.getViewport({ scale: 1 });
      const clamped = safeScale(baseVp.width, baseVp.height, scale, 4000);
      const viewport = page.getViewport({ scale: clamped });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const img = await doc.embedJpg(canvasToJpgBytes(canvas, qualityForScale(scale)));
      // Page keeps its original size in points — only the raster resolution changes.
      const pdfPage = doc.addPage([baseVp.width, baseVp.height]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: baseVp.width, height: baseVp.height });
      await drawInvisibleTextLayer(pdfPage, page, baseVp, font);
    }
    return toBlob(await doc.save());
  }

  function qualityForScale(scale: number): number {
    if (scale >= 2) return 0.92;
    if (scale >= 1.5) return 0.85;
    if (scale >= 1.2) return 0.75;
    if (scale >= 1) return 0.65;
    if (scale >= 0.8) return 0.55;
    if (scale >= 0.6) return 0.45;
    return 0.35;
  }

  const scales = [2, 1.8, 1.6, 1.4, 1.2, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

  for (const scale of scales) {
    onProgress?.(`Trying quality level ${Math.round(qualityForScale(scale) * 100)}%...`);
    const blob = await renderAndBuild(scale);
    if (blob.size <= targetBytes) {
      return { blob, originalSize, compressedSize: blob.size, targetSize: targetBytes, achieved: true, quality: qualityForScale(scale), pages: numPages };
    }
  }

  const finalBlob = await renderAndBuild(0.4);
  return { blob: finalBlob, originalSize, compressedSize: finalBlob.size, targetSize: targetBytes, achieved: finalBlob.size <= targetBytes, quality: 0.35, pages: numPages };
}

export type PageNumberFormat = 'n' | 'page-n' | 'n-of-m';

export async function addPageNumbersToFile(
  file: File,
  position: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right',
  startNum: number = 1,
  format: PageNumberFormat = 'n',
): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const font = await src.embedFont(StandardFonts.Helvetica);
  const total = src.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = src.getPage(i);
    const { width, height } = page.getSize();
    const n = startNum + i;
    const text = format === 'page-n' ? `Page ${n}` : format === 'n-of-m' ? `${n} of ${startNum + total - 1}` : `${n}`;
    const fontSize = 12;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    let x: number, y: number;
    if (position.includes('left')) x = 40;
    else if (position.includes('right')) x = width - textWidth - 40;
    else x = (width - textWidth) / 2;

    if (position.includes('top')) y = height - 40;
    else y = 30;

    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
  }

  return toBlob(await src.save());
}

export async function addWatermarkToFile(file: File, text: string, options?: { fontSize?: number; opacity?: number; rotation?: number }): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const font = await src.embedFont(StandardFonts.HelveticaBold);

  const fontSize = options?.fontSize || 50;
  const opacity = options?.opacity || 0.3;
  const rotation = options?.rotation || -45;

  for (let i = 0; i < src.getPageCount(); i++) {
    const page = src.getPage(i);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // pdf-lib rotates around the text origin (baseline start), so compute the
    // origin that puts the rotated text's center at the page center.
    const rad = (rotation * Math.PI) / 180;
    const x = width / 2 - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad);
    const y = height / 2 - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad);

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(rotation),
    });
  }

  return toBlob(await src.save());
}

export async function cropPdf(file: File, margins: { top: number; bottom: number; left: number; right: number }): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);

  for (let i = 0; i < src.getPageCount(); i++) {
    const page = src.getPage(i);
    const { width, height } = page.getSize();
    page.setMediaBox(margins.left, margins.bottom, width - margins.left - margins.right, height - margins.top - margins.bottom);
    page.setCropBox(margins.left, margins.bottom, width - margins.left - margins.right, height - margins.top - margins.bottom);
  }

  return toBlob(await src.save());
}

export async function unlockPdf(file: File, password: string): Promise<Blob> {
  const pdfjsLib = await getPdfJs();

  const buf = await readFileAsArrayBuffer(file);
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), password }).promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException' || /password/i.test(err?.message || '')) {
      throw new Error('Incorrect password. Please try again.');
    }
    throw err;
  }
  const unlocked = await PDFDocument.create();
  const font = await unlocked.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = safeScale(baseVp.width, baseVp.height, 2, 4000);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const img = await unlocked.embedJpg(canvasToJpgBytes(canvas, 0.92));
    // Keep the page at its original size in points (not the render-pixel size).
    const pdfPage = unlocked.addPage([baseVp.width, baseVp.height]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: baseVp.width, height: baseVp.height });
    // Preserve the document's real text so the unlocked copy stays searchable.
    await drawInvisibleTextLayer(pdfPage, page, baseVp, font);
  }

  return toBlob(await unlocked.save());
}

export async function isPdfPasswordProtected(file: File): Promise<boolean> {
  const buf = await readFileAsArrayBuffer(file);
  // A PDF is encrypted iff its trailer carries an /Encrypt dictionary. Checking
  // the raw bytes avoids misreporting merely-corrupted files as "protected".
  const bytes = new Uint8Array(buf);
  const marker = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74]; // "/Encrypt"
  let hasEncryptMarker = false;
  outer: for (let i = bytes.length - 1; i >= marker.length - 1; i--) {
    if (bytes[i] !== marker[marker.length - 1]) continue;
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i - marker.length + 1 + j] !== marker[j]) continue outer;
    }
    hasEncryptMarker = true;
    break;
  }
  if (!hasEncryptMarker) return false;

  // /Encrypt found — confirm a password is actually required to open it
  // (owner-password-only files open without one).
  try {
    const pdfjsLib = await getPdfJs();
    await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    return true; // opens without a password, but is still encrypted — unlock is meaningful
  } catch {
    return true;
  }
}

export async function protectPdf(file: File, userPassword: string, ownerPassword?: string, permissions?: { allowPrinting?: boolean; allowModifying?: boolean; allowCopying?: boolean; allowAnnotating?: boolean; allowFillingForms?: boolean; allowExtraction?: boolean; allowAssembly?: boolean }): Promise<Blob> {
  const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
  const buf = await readFileAsArrayBuffer(file);
  const pdfBytes = new Uint8Array(buf);
  const autoOwner = ownerPassword || userPassword + '_owner';
  const options: any = {
    ownerPassword: autoOwner,
  };
  if (permissions) {
    if (permissions.allowPrinting !== undefined) options.allowPrinting = permissions.allowPrinting;
    if (permissions.allowModifying !== undefined) options.allowModifying = permissions.allowModifying;
    if (permissions.allowCopying !== undefined) options.allowCopying = permissions.allowCopying;
    if (permissions.allowAnnotating !== undefined) options.allowAnnotating = permissions.allowAnnotating;
    if (permissions.allowFillingForms !== undefined) options.allowFillingForms = permissions.allowFillingForms;
    if (permissions.allowExtraction !== undefined) options.allowExtraction = permissions.allowExtraction;
    if (permissions.allowAssembly !== undefined) options.allowAssembly = permissions.allowAssembly;
  }
  const encrypted = await encryptPDF(pdfBytes, userPassword, options);
  return new Blob([new Uint8Array(encrypted)], { type: 'application/pdf' });
}

export async function jpgToPdf(files: File[]): Promise<Blob> {
  if (files.length === 0) throw new Error('Select at least one image.');
  const merged = await PDFDocument.create();
  for (const file of files) {
    const buf = await readFileAsArrayBuffer(file);
    let image;
    try {
      if (file.type === 'image/png') {
        image = await merged.embedPng(buf);
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        image = await merged.embedJpg(buf);
      } else {
        // WebP/GIF/BMP/etc. — pdf-lib only embeds PNG and JPEG, so transcode
        // via the browser decoder (which also applies EXIF orientation).
        image = await merged.embedPng(await transcodeImageToPng(file));
      }
    } catch {
      throw new Error(`"${file.name}" could not be read as an image.`);
    }
    const page = merged.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return toBlob(await merged.save());
}

async function transcodeImageToPng(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/png');
  return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
}

export async function pdfToImages(
  file: File,
  options?: { format?: 'jpeg' | 'png'; quality?: number; scale?: number },
): Promise<Blob[]> {
  const pdfjsLib = await getPdfJs();
  const format = options?.format ?? 'jpeg';
  const quality = options?.quality ?? 0.95;
  const desiredScale = options?.scale ?? 2;

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const results: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = safeScale(baseVp.width, baseVp.height, desiredScale);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error(`Failed to render page ${i} as an image.`)), `image/${format}`, quality);
    });
    results.push(blob);
  }
  return results;
}

export async function htmlToPdf(html: string): Promise<Blob> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const A4_W = 595.28;
  const A4_H = 841.89;
  const ML = 54, MR = 54, MT = 60, MB = 60;
  const USABLE_W = A4_W - ML - MR;
  const LH = 14;

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([A4_W, A4_H]);
  let cursorY = A4_H - MT;

  const fRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const fBoldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const fCourier = await pdf.embedFont(StandardFonts.Courier);

  // WinAnsi sanitize
  function san(text: string): string {
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '?')
      .replace(/[\u{2600}-\u{27BF}]/gu, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, c => {
        const code = c.charCodeAt(0);
        if (code === 0x2013 || code === 0x2014) return '-';
        if (code === 0x2018 || code === 0x2019) return "'";
        if (code === 0x201C || code === 0x201D) return '"';
        if (code === 0x2026) return '...';
        if (code === 0x2022 || code === 0x2023) return '\u2022';
        return '';
      });
  }

  function checkPage(needed: number) {
    if (cursorY - needed < MB) {
      page = pdf.addPage([A4_W, A4_H]);
      cursorY = A4_H - MT;
    }
  }

  function wrapText(text: string, f: any, size: number, maxW: number): string[] {
    if (!text) return [''];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (f.widthOfTextAtSize(test, size) > maxW && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function drawLine(text: string, fontSize: number, isBold: boolean, isItalic: boolean, indent: number = 0, useCourier: boolean = false) {
    const clean = san(text);
    const f = useCourier ? fCourier : isBold && isItalic ? fBoldItalic : isBold ? fBold : isItalic ? fItalic : fRegular;
    // Scale line height with the font so wrapped headings don't overlap.
    const lh = Math.max(LH, fontSize * 1.25);
    const lines = wrapText(clean, f, fontSize, USABLE_W - indent);
    for (const line of lines) {
      checkPage(lh);
      page.drawText(line, { x: ML + indent, y: cursorY, size: fontSize, font: f, color: rgb(0.1, 0.1, 0.1) });
      cursorY -= lh;
    }
  }

  function processTable(tableEl: HTMLElement) {
    const rows = tableEl.querySelectorAll(':scope > tbody > tr, :scope > tr, :scope > thead > tr');
    if (rows.length === 0) return;

    const allRows: string[][] = [];
    rows.forEach(tr => {
      const cells = tr.querySelectorAll(':scope > td, :scope > th');
      const row: string[] = [];
      cells.forEach(td => row.push(san(td.textContent?.trim() || '')));
      allRows.push(row);
    });

    const maxCols = Math.max(...allRows.map(r => r.length));
    const colW = USABLE_W / maxCols;
    const cellLineH = 11;
    const MAX_CELL_LINES = 6;

    for (let ri = 0; ri < allRows.length; ri++) {
      const row = allRows[ri];
      const isHeader = ri === 0;
      const cellFont = isHeader ? fBold : fRegular;

      // Wrap every cell first so the row grows to fit its tallest cell —
      // multi-line content must not be silently truncated.
      const wrapped: string[][] = [];
      let maxLines = 1;
      for (let c = 0; c < maxCols; c++) {
        let lines = wrapText(row[c] || '', cellFont, 9, colW - 6);
        if (lines.length > MAX_CELL_LINES) {
          lines = lines.slice(0, MAX_CELL_LINES);
          lines[MAX_CELL_LINES - 1] += ' ...';
        }
        wrapped.push(lines);
        maxLines = Math.max(maxLines, lines.length);
      }
      const rowH = maxLines * cellLineH + 7;
      checkPage(rowH);

      for (let c = 0; c < maxCols; c++) {
        const x = ML + c * colW;

        if (isHeader) {
          page.drawRectangle({ x, y: cursorY - (rowH - 15), width: colW, height: rowH, color: rgb(0.9, 0.92, 0.96) });
        } else if (ri % 2 === 0) {
          page.drawRectangle({ x, y: cursorY - (rowH - 15), width: colW, height: rowH, color: rgb(0.97, 0.97, 0.97) });
        }
        page.drawRectangle({ x, y: cursorY - (rowH - 15), width: colW, height: rowH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });

        const lines = wrapped[c];
        for (let li = 0; li < lines.length; li++) {
          page.drawText(lines[li], { x: x + 3, y: cursorY + 2 - li * cellLineH, size: 9, font: cellFont, color: isHeader ? rgb(0.15, 0.25, 0.5) : rgb(0.1, 0.1, 0.1) });
        }
      }
      cursorY -= rowH;
    }
  }

  function getInlineText(el: HTMLElement, forceBold = false, forceItalic = false): { text: string; bold: boolean; italic: boolean }[] {
    const frags: { text: string; bold: boolean; italic: boolean }[] = [];
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent || '';
        if (t) frags.push({ text: t, bold: forceBold, italic: forceItalic });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as HTMLElement;
        const tag = childEl.tagName.toLowerCase();
        const b = forceBold || tag === 'strong' || tag === 'b';
        const it = forceItalic || tag === 'em' || tag === 'i';
        if (tag === 'br') {
          frags.push({ text: '\n', bold: false, italic: false });
        } else {
          frags.push(...getInlineText(childEl, b, it));
        }
      }
    }
    return frags;
  }

  // Draw mixed-style inline content word by word, so each word keeps its own
  // bold/italic font instead of the whole line inheriting the last fragment's style.
  function drawInline(el: HTMLElement, indent: number = 0) {
    const frags = getInlineText(el);
    const size = 11;
    const maxW = USABLE_W - indent;

    type Token = { text: string; f: any };
    const fontFor = (bold: boolean, italic: boolean) =>
      bold && italic ? fBoldItalic : bold ? fBold : italic ? fItalic : fRegular;

    let line: Token[] = [];
    let lineW = 0;

    const flushLine = () => {
      if (line.length === 0) return;
      checkPage(LH);
      let x = ML + indent;
      for (const tok of line) {
        page.drawText(tok.text, { x, y: cursorY, size, font: tok.f, color: rgb(0.1, 0.1, 0.1) });
        x += tok.f.widthOfTextAtSize(tok.text + ' ', size);
      }
      cursorY -= LH;
      line = [];
      lineW = 0;
    };

    for (const frag of frags) {
      const f = fontFor(frag.bold, frag.italic);
      const parts = san(frag.text).split('\n');
      for (let pi = 0; pi < parts.length; pi++) {
        if (pi > 0) flushLine();
        for (const word of parts[pi].split(/\s+/)) {
          if (!word) continue;
          const w = f.widthOfTextAtSize(word + ' ', size);
          if (lineW + w > maxW && line.length > 0) flushLine();
          line.push({ text: word, f });
          lineW += w;
        }
      }
    }
    flushLine();
  }

  async function processNode(node: HTMLElement | ChildNode, indent: number = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) drawLine(text, 11, false, false, indent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1': checkPage(28); cursorY -= 8; drawLine(el.textContent || '', 22, true, false, indent); cursorY -= 4; break;
      case 'h2': checkPage(24); cursorY -= 6; drawLine(el.textContent || '', 18, true, false, indent); cursorY -= 3; break;
      case 'h3': checkPage(20); cursorY -= 4; drawLine(el.textContent || '', 15, true, false, indent); cursorY -= 2; break;
      case 'h4': case 'h5': case 'h6': checkPage(18); cursorY -= 3; drawLine(el.textContent || '', 13, true, false, indent); cursorY -= 2; break;
      case 'p': case 'div': checkPage(LH); cursorY -= 4; drawInline(el, indent); cursorY -= 2; break;
      case 'strong': case 'b': drawInline(el, indent); break;
      case 'em': case 'i': drawInline(el, indent); break;
      case 'br': checkPage(LH); cursorY -= LH; break;
      case 'ul': case 'ol':
        cursorY -= 3;
        const items = el.querySelectorAll(':scope > li');
        items.forEach((li, idx) => {
          const bullet = tag === 'ol' ? `${idx + 1}. ` : '\u2022 ';
          checkPage(LH);
          const liText = san(li.textContent || '');
          const f = fRegular;
          page.drawText(bullet, { x: ML + indent, y: cursorY, size: 11, font: f, color: rgb(0.1, 0.1, 0.1) });
          const lines = wrapText(liText, f, 11, USABLE_W - indent - 16);
          for (const line of lines) {
            checkPage(LH);
            page.drawText(line, { x: ML + indent + 16, y: cursorY, size: 11, font: f, color: rgb(0.1, 0.1, 0.1) });
            cursorY -= LH;
          }
        });
        cursorY -= 2;
        break;
      case 'table': cursorY -= 4; processTable(el); cursorY -= 4; break;
      case 'blockquote': cursorY -= 3; drawInline(el, indent + 20); cursorY -= 3; break;
      case 'pre': case 'code':
        cursorY -= 3;
        const codeText = san(el.textContent || '');
        const codeLines = codeText.split('\n');
        for (const cl of codeLines) {
          checkPage(LH);
          page.drawText(cl.substring(0, 90), { x: ML + indent + 10, y: cursorY, size: 9, font: fCourier, color: rgb(0.15, 0.15, 0.15) });
          cursorY -= LH;
        }
        cursorY -= 3;
        break;
      case 'hr':
        checkPage(10); cursorY -= 5;
        page.drawLine({ start: { x: ML + indent, y: cursorY }, end: { x: A4_W - MR, y: cursorY }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
        cursorY -= 8;
        break;
      case 'img': {
        const src = el.getAttribute('src');
        if (src && src.startsWith('data:image/')) {
          try {
            const [header, data] = src.split(',');
            const mime = header.match(/data:(image\/\w+)/)?.[1];
            const imgBytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
            let img;
            if (mime === 'image/png') img = await pdf.embedPng(imgBytes);
            else if (mime === 'image/jpeg' || mime === 'image/jpg') img = await pdf.embedJpg(imgBytes);
            if (img) {
              const scale = Math.min(USABLE_W / img.width, 200 / img.height, 1);
              const w = img.width * scale;
              const h = img.height * scale;
              checkPage(h);
              page.drawImage(img, { x: ML + indent, y: cursorY - h, width: w, height: h });
              cursorY -= h + 4;
            }
          } catch { /* skip broken images */ }
        }
        break;
      }
      default:
        // Process children for unknown tags
        for (const child of el.childNodes) await processNode(child, indent);
    }
  }

  // Parse and process
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLElement;
  for (const child of container.childNodes) await processNode(child);

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

export async function wordToPdf(file: File): Promise<Blob> {
  const { default: mammoth } = await import('mammoth');
  const buf = await readFileAsArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });
  const html = result.value;
  return htmlToPdf(`<div style="font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #222; max-width: 700px; margin: 0 auto;">${html}</div>`);
}

/**
 * True redaction. Simply drawing a black rectangle leaves the original text in
 * the file (selectable, copyable — a classic redaction failure). Instead, each
 * page that has redactions is re-rendered with the black boxes burned in and
 * replaced by that raster, so the content underneath is permanently destroyed.
 * Pages without redactions are kept untouched (vector text intact).
 */
export async function redactPdf(file: File, redactions: { x: number; y: number; width: number; height: number; pageIndex: number }[]): Promise<Blob> {
  if (redactions.length === 0) throw new Error('No redaction areas specified.');
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const total = src.getPageCount();
  const bad = redactions.filter(r => r.pageIndex < 0 || r.pageIndex >= total);
  if (bad.length > 0) {
    throw new Error(`Invalid page index ${bad[0].pageIndex}. This document has ${total} page${total === 1 ? '' : 's'} (indices 0-${total - 1}).`);
  }

  const byPage = new Map<number, typeof redactions>();
  for (const r of redactions) {
    const list = byPage.get(r.pageIndex) || [];
    list.push(r);
    byPage.set(r.pageIndex, list);
  }

  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const out = await PDFDocument.create();

  for (let i = 0; i < total; i++) {
    const rects = byPage.get(i);
    if (!rects) {
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      continue;
    }

    const page = await pdf.getPage(i + 1);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = safeScale(baseVp.width, baseVp.height, 2, 4000);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    // Burn the black boxes into the raster. Redaction coords are in PDF points
    // (origin bottom-left); the canvas origin is top-left, so flip Y.
    ctx.fillStyle = '#000000';
    for (const r of rects) {
      ctx.fillRect(r.x * scale, (baseVp.height - r.y - r.height) * scale, r.width * scale, r.height * scale);
    }

    const img = await out.embedJpg(canvasToJpgBytes(canvas, 0.92));
    const newPage = out.addPage([baseVp.width, baseVp.height]);
    newPage.drawImage(img, { x: 0, y: 0, width: baseVp.width, height: baseVp.height });
  }

  return toBlob(await out.save({ useObjectStreams: true }));
}

export interface CompareResult {
  file1: { name: string; pages: number; fileSize: number; title: string; author: string; creator: string; producer: string; creationDate: string; pageWidths: number[]; pageHeights: number[]; textByPage: string[] };
  file2: { name: string; pages: number; fileSize: number; title: string; author: string; creator: string; producer: string; creationDate: string; pageWidths: number[]; pageHeights: number[]; textByPage: string[] };
  identical: boolean;
  pagesSame: boolean;
  textSimilarity: number;
  differingPages: number[];
}

export async function comparePdfs(file1: File, file2: File): Promise<CompareResult> {
  const pdfjsLib = await getPdfJs();

  async function extractInfo(file: File) {
    const buf = await readFileAsArrayBuffer(file);
    const doc = await loadPdf(buf);
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const meta = await pdfDoc.getMetadata();
    const info = (meta.info || {}) as Record<string, string>;

    const title = info['Title'] || '';
    const author = info['Author'] || '';
    const creator = info['Creator'] || '';
    const producer = info['Producer'] || '';
    const creationDate = info['CreationDate'] || info['ModDate'] || '';

    const pageWidths: number[] = [];
    const pageHeights: number[] = [];
    const textByPage: string[] = [];

    for (let i = 0; i < doc.getPageCount(); i++) {
      const pg = doc.getPage(i);
      const { width, height } = pg.getSize();
      pageWidths.push(Math.round(width * 100) / 100);
      pageHeights.push(Math.round(height * 100) / 100);

      const pdfPage = await pdfDoc.getPage(i + 1);
      const content = await pdfPage.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
      textByPage.push(text);
    }

    return {
      name: file.name,
      pages: doc.getPageCount(),
      fileSize: file.size,
      title,
      author,
      creator,
      producer,
      creationDate,
      pageWidths,
      pageHeights,
      textByPage,
    };
  }

  const [info1, info2] = await Promise.all([extractInfo(file1), extractInfo(file2)]);

  const identical = JSON.stringify(info1) === JSON.stringify(info2);
  const pagesSame = info1.pages === info2.pages && info1.pageWidths.join(',') === info2.pageWidths.join(',') && info1.pageHeights.join(',') === info2.pageHeights.join(',');

  const maxPages = Math.max(info1.textByPage.length, info2.textByPage.length);
  const differingPages: number[] = [];
  let totalSimilarity = 0;

  for (let i = 0; i < maxPages; i++) {
    const t1 = info1.textByPage[i] || '';
    const t2 = info2.textByPage[i] || '';
    if (t1 === t2) {
      totalSimilarity += 100;
    } else {
      differingPages.push(i + 1);
      const words1 = t1.split(/\s+/).filter(Boolean);
      const words2 = t2.split(/\s+/).filter(Boolean);
      const set = new Set([...words1, ...words2]);
      const overlap = words1.filter(w => words2.includes(w)).length;
      totalSimilarity += set.size > 0 ? Math.round((overlap / set.size) * 100) : 0;
    }
  }
  const textSimilarity = maxPages > 0 ? Math.round(totalSimilarity / maxPages) : 100;

  return { file1: info1, file2: info2, identical, pagesSame, textSimilarity, differingPages };
}

export async function getPdfInfo(file: File) {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  return {
    pageCount: src.getPageCount(),
    title: src.getTitle() || '',
    author: src.getAuthor() || '',
    subject: src.getSubject() || '',
    creator: src.getCreator() || '',
    producer: src.getProducer() || '',
    creationDate: src.getCreationDate()?.toISOString() || '',
    modificationDate: src.getModificationDate()?.toISOString() || '',
    fileSize: file.size,
  };
}

export async function convertToPdfA(file: File): Promise<Blob> {
  const { PDFName } = await import('pdf-lib');
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);

  const newDoc = await PDFDocument.create();
  const title = src.getTitle() || file.name.replace(/\.pdf$/i, '');
  const author = src.getAuthor() || '';
  newDoc.setTitle(title);
  if (author) newDoc.setAuthor(author);
  newDoc.setCreator(src.getCreator() || 'PDFlux');
  newDoc.setProducer('PDFlux');
  const now = new Date();
  newDoc.setCreationDate(src.getCreationDate() || now);
  newDoc.setModificationDate(now);

  const pages = await newDoc.copyPages(src, src.getPageIndices());
  pages.forEach(p => newDoc.addPage(p));

  // PDF/A identification requires an XMP metadata stream in the catalog with
  // the pdfaid schema. Dates use ISO-8601; XML-escape user-supplied strings.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const iso = now.toISOString();
  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>2</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(title)}</rdf:li></rdf:Alt></dc:title>
   ${author ? `<dc:creator><rdf:Seq><rdf:li>${esc(author)}</rdf:li></rdf:Seq></dc:creator>` : ''}
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreateDate>${iso}</xmp:CreateDate>
   <xmp:ModifyDate>${iso}</xmp:ModifyDate>
   <xmp:CreatorTool>PDFlux</xmp:CreatorTool>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>PDFlux</pdf:Producer>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const metadataStream = newDoc.context.stream(xmp, {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: xmp.length,
  });
  newDoc.catalog.set(PDFName.of('Metadata'), newDoc.context.register(metadataStream));

  // PDF/A forbids encryption and relies on a clean structure — save without
  // object streams for maximum archival-reader compatibility.
  return toBlob(await newDoc.save({ useObjectStreams: false }));
}

export async function pdfToMarkdown(file: File): Promise<string> {
  const pages = await extractTextFromPdf(file);
  return pages.map((text, i) => `## Page ${i + 1}\n\n${text}\n\n---\n\n`).join('');
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

const LANG_CODES: Record<string, string> = {
  'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Italian': 'it',
  'Portuguese': 'pt', 'Russian': 'ru', 'Chinese (Simplified)': 'zh-CN', 'Chinese (Traditional)': 'zh-TW',
  'Japanese': 'ja', 'Korean': 'ko', 'Arabic': 'ar', 'Hindi': 'hi', 'Dutch': 'nl',
  'Swedish': 'sv', 'Polish': 'pl', 'Turkish': 'tr', 'Vietnamese': 'vi',
  'Thai': 'th', 'Indonesian': 'id', 'Bengali': 'bn', 'Bulgarian': 'bg',
  'Czech': 'cs', 'Danish': 'da', 'Finnish': 'fi', 'Greek': 'el',
  'Hebrew': 'he', 'Hungarian': 'hu', 'Icelandic': 'is', 'Latvian': 'lv',
  'Lithuanian': 'lt', 'Norwegian': 'no', 'Persian': 'fa', 'Romanian': 'ro',
  'Serbian': 'sr', 'Slovak': 'sk', 'Slovenian': 'sl', 'Croatian': 'hr',
  'Ukrainian': 'uk', 'Tagalog': 'tl', 'Tamil': 'ta', 'Urdu': 'ur',
};

export async function createPdfFromText(text: string, title?: string): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Replace characters that WinAnsi can't encode
  const sanitize = (s: string) => s
    .replace(/[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2B50-\u2B55\u2300-\u23FF\u2190-\u21FF\u2000-\u206F]/g, '-')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '-');

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 14;
  const maxLineWidth = pageWidth - margin * 2;

  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  if (title) {
    doc.setTitle(title);
    page.drawText(sanitize(title).slice(0, 80), { x: margin, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= 28;
  }

  for (const para of paragraphs) {
    const words = sanitize(para).split(/\s+/);
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, 10);
      if (width > maxLineWidth && line) {
        if (y - lineHeight < margin) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.12, 0.12, 0.12) });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      if (y - lineHeight < margin) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.12, 0.12, 0.12) });
      y -= lineHeight;
    }
    y -= lineHeight * 0.5;
  }

  return toBlob(await doc.save());
}

async function translateChunk(text: string, from: string, to: string): Promise<string> {
  const fromLang = from === 'autodetect' ? 'auto' : from;

  // 1. Try Lingva Translate (free, unlimited, all languages)
  const lingvaInstances = [
    'https://lingva.ml',
    'https://lingva.thedaviddelta.com',
    'https://lingva.lunar.icu',
  ];
  for (const base of lingvaInstances) {
    try {
      const url = `${base}/api/v1/${fromLang}/${to}/${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data?.translation) return data.translation;
      }
    } catch { /* try next */ }
  }

  // 2. Try LibreTranslate public instances (free, open-source)
  const libreInstances = [
    'https://libretranslate.com',
    'https://translate.fortytwo-it.com',
    'https://lt.vern.cc',
  ];
  for (const base of libreInstances) {
    try {
      const url = `${base}/translate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: fromLang === 'auto' ? 'auto' : fromLang, target: to, format: 'text' }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.translatedText) return data.translatedText;
      }
    } catch { /* try next */ }
  }

  // 3. MyMemory fallback with safe chunking (MyMemory spells auto-detection "Autodetect")
  const memSource = fromLang === 'auto' ? 'Autodetect' : fromLang;
  const langpair = `${memSource}|${to}`;
  const memUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=${encodeURIComponent(langpair)}`;
  const res = await fetch(memUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Translation service unavailable (HTTP ${res.status}). Please try again later.`);
  const data = await res.json();
  if (data.responseStatus === 200 || data.responseStatus === '200') {
    return data.responseData.translatedText;
  }
  if (fromLang === 'auto') {
    throw new Error('Automatic language detection is unavailable right now. Select the document\'s source language and try again.');
  }
  throw new Error(data.responseDetails || 'Translation failed. Please try again later.');
}

export async function translateText(text: string, fromLang: string, toLang: string, onProgress?: (current: number, total: number) => void): Promise<string> {
  const from = fromLang === 'Auto' ? 'autodetect' : (LANG_CODES[fromLang] || fromLang);
  const to = LANG_CODES[toLang] || toLang;
  const chunkSize = 450;
  const sentences = text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > chunkSize && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    const translated = await translateChunk(chunks[i], from, to);
    results.push(translated);
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 250));
  }

  return results.join(' ');
}

export async function renderPdfPages(file: File, pageNumbers: number[]): Promise<{ page: number; url: string; width: number; height: number }[]> {
  const pdfjsLib = await getPdfJs();

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const results: { page: number; url: string; width: number; height: number }[] = [];

  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > pdf.numPages) continue;
    const page = await pdf.getPage(pageNum);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const url = canvas.toDataURL('image/jpeg', 0.8);
    results.push({ page: pageNum, url, width: viewport.width, height: viewport.height });
  }
  return results;
}

export interface FooterWhitespaceResult {
  page: number;
  found: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  sufficient: boolean;
  message: string;
}

export interface SignPageScan {
  page: number;
  url: string;
  pointWidth: number;
  pointHeight: number;
  whitespace: FooterWhitespaceResult;
}

/**
 * One-pass scan for the Sign tool: parses the PDF once and renders each page
 * once, producing both the thumbnail and the footer-whitespace analysis.
 * (The previous flow re-parsed the file and re-rendered every page twice.)
 */
export async function scanPdfForSigning(
  file: File,
  minSignWidth: number,
  minSignHeight: number,
  options?: { maxPages?: number },
  onProgress?: (page: number, total: number) => void,
): Promise<SignPageScan[]> {
  const pdfjsLib = await getPdfJs();
  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const total = Math.min(pdf.numPages, options?.maxPages ?? 200);
  const results: SignPageScan[] = [];

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    onProgress?.(pageNum, total);
    const page = await pdf.getPage(pageNum);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = safeScale(baseVp.width, baseVp.height, 2, 4000);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const whitespace = analyzeFooterWhitespace(ctx, canvas, baseVp.width, baseVp.height, pageNum, minSignWidth, minSignHeight);
    results.push({
      page: pageNum,
      url: canvas.toDataURL('image/jpeg', 0.8),
      pointWidth: baseVp.width,
      pointHeight: baseVp.height,
      whitespace,
    });
  }
  return results;
}

function analyzeFooterWhitespace(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  pageNum: number,
  minSignWidth: number,
  minSignHeight: number,
): FooterWhitespaceResult {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Analyze bottom 25% of page for whitespace
  const footerStartY = Math.floor(canvas.height * 0.75);

  // Build a binary grid: 1 = white/near-white pixel, 0 = content
  const grid: number[][] = [];
  const step = 2; // sample every 2px for performance
  for (let y = footerStartY; y < canvas.height; y += step) {
    const row: number[] = [];
    for (let x = 0; x < canvas.width; x += step) {
      const idx = (y * canvas.width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      // Consider pixel "white" if all channels > 230
      row.push(r > 230 && g > 230 && b > 230 ? 1 : 0);
    }
    grid.push(row);
  }

  // Find largest rectangle in footer whitespace using brute force scan
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  let bestArea = 0;
  let bestRect = { x: 0, y: 0, w: 0, h: 0 };

  // For each row, find consecutive white runs
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) continue;
      // Expand right
      let maxW = 0;
      while (c + maxW < cols && grid[r][c + maxW] === 1) maxW++;
      // Expand down
      let maxH = 1;
      while (r + maxH < rows) {
        let allWhite = true;
        for (let cc = c; cc < c + maxW; cc++) {
          if (grid[r + maxH][cc] === 0) { allWhite = false; break; }
        }
        if (!allWhite) break;
        maxH++;
      }
      const area = maxW * maxH;
      if (area > bestArea) {
        bestArea = area;
        bestRect = { x: c * step, y: footerStartY + r * step, w: maxW * step, h: maxH * step };
      }
    }
  }

  // Convert from canvas pixels to PDF points
  const scaleX = pageWidth / canvas.width;
  const scaleY = pageHeight / canvas.height;
  const pdfX = bestRect.x * scaleX;
  const pdfY = pageHeight - (bestRect.y * scaleY) - (bestRect.h * scaleY); // pdf-lib y is bottom-up
  const pdfW = bestRect.w * scaleX;
  const pdfH = bestRect.h * scaleY;

  const hasWhitespace = bestArea > 0;
  const sufficient = pdfW >= minSignWidth && pdfH >= minSignHeight;

  let message = '';
  if (!hasWhitespace) {
    message = 'No clear whitespace found in the footer area of this page. The bottom of the document may contain text or graphics.';
  } else if (!sufficient) {
    message = `Found a ${Math.round(pdfW)}x${Math.round(pdfH)}pt whitespace area, but need at least ${Math.round(minSignWidth)}x${Math.round(minSignHeight)}pt for a readable signature.`;
  }

  return {
    page: pageNum,
    found: hasWhitespace,
    x: pdfX,
    y: pdfY,
    width: pdfW,
    height: pdfH,
    sufficient,
    message,
  };
}

export async function extractTextFromPdf(file: File): Promise<string[]> {
  const pdfjsLib = await getPdfJs();

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const ti = item as any;
      // pdf.js TextItem coordinates: transform[5] is the Y position (top-down in canvas coords)
      const y = ti.transform?.[5] ?? ti.y ?? null;

      if (y !== null && lastY !== null) {
        const deltaY = Math.abs(y - lastY);
        if (deltaY > 5) {
          pageText += '\n';
        } else if (deltaY < 1 && pageText.length > 0 && pageText.slice(-1) !== '\n' && pageText.slice(-1) !== ' ') {
          // Same line, no space between items — add a space separator
          const prevChar = pageText.slice(-1);
          const nextChar = (item.str || '')[0];
          if (prevChar !== ' ' && nextChar !== ' ' && prevChar !== '\n') {
            pageText += ' ';
          }
        }
      }

      pageText += item.str || '';
      if (y !== null) lastY = y;
    }

    pages.push(pageText.trim());
  }
  return pages;
}

export async function pdfToWord(file: File): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import('docx');
  const pages = await extractTextFromPdf(file);

  const children: any[] = [];
  pages.forEach((pageText, i) => {
    if (i > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Page heading
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Page ${i + 1}`, bold: true, size: 28 })],
    }));

    if (!pageText.trim()) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '(empty page)', italics: true, color: '999999' })],
      }));
      return;
    }

    const lines = pageText.split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Detect if line looks like a heading (short, no period, capitalized)
      const isHeading = trimmed.length < 80
        && !trimmed.endsWith('.')
        && /^[A-Z]/.test(trimmed)
        && !trimmed.includes('  ');

      if (isHeading) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: trimmed, bold: true, size: 24 })],
        }));
      } else {
        children.push(new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: trimmed, size: 22 })],
        }));
      }
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export async function pdfToExcel(file: File): Promise<Blob> {
  const ExcelJS = await import('exceljs');
  const pages = await extractTextFromPdf(file);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PDFlux';
  workbook.created = new Date();

  // Summary sheet
  const summary = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: '4472C4' } } });
  summary.columns = [
    { header: 'Page', key: 'page', width: 10 },
    { header: 'Lines', key: 'lines', width: 10 },
    { header: 'Characters', key: 'chars', width: 15 },
  ];
  summary.getRow(1).font = { bold: true, size: 11 };
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D6E4F0' } };

  pages.forEach((pageText, i) => {
    const lines = pageText.split('\n').filter(l => l.trim());
    summary.addRow({ page: i + 1, lines: lines.length, chars: pageText.length });
  });

  // One sheet per page
  pages.forEach((pageText, i) => {
    const sheet = workbook.addWorksheet(`Page ${i + 1}`);
    sheet.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'Content', key: 'content', width: 90 },
    ];
    sheet.getRow(1).font = { bold: true, size: 11 };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D6E4F0' } };

    const lines = pageText.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      sheet.addRow({ num: 1, content: '(empty page)' });
    } else {
      lines.forEach((line, idx) => {
        sheet.addRow({ num: idx + 1, content: line.trim() });
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function pdfToPowerpoint(file: File): Promise<Blob> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pages = await extractTextFromPdf(file);

  const pptx = new PptxGenJS();
  pptx.author = 'PDFlux';
  pptx.title = file.name.replace(/\.pdf$/i, '');

  const MAX_CHARS_PER_SLIDE = 1800;

  pages.forEach((pageText, i) => {
    if (!pageText.trim()) {
      const slide = pptx.addSlide();
      slide.addText(`Page ${i + 1}`, { x: 0.5, y: 0.3, w: '90%', fontSize: 18, bold: true, color: '333333' });
      slide.addText('(empty page)', { x: 0.5, y: 1.0, w: '90%', h: '70%', fontSize: 11, color: '999999', valign: 'top', italic: true });
      return;
    }

    // Split long pages into multiple slides
    const chunks: string[] = [];
    if (pageText.length <= MAX_CHARS_PER_SLIDE) {
      chunks.push(pageText);
    } else {
      const lines = pageText.split('\n');
      let current = '';
      for (const line of lines) {
        if ((current + '\n' + line).length > MAX_CHARS_PER_SLIDE && current) {
          chunks.push(current);
          current = line;
        } else {
          current = current ? current + '\n' + line : line;
        }
      }
      if (current) chunks.push(current);
    }

    chunks.forEach((chunk, ci) => {
      const slide = pptx.addSlide();
      const label = chunks.length > 1 ? `Page ${i + 1} (${ci + 1}/${chunks.length})` : `Page ${i + 1}`;
      slide.addText(label, { x: 0.5, y: 0.2, w: '90%', fontSize: 16, bold: true, color: '333333' });
      slide.addText(chunk, {
        x: 0.5, y: 0.8, w: '90%', h: '85%',
        fontSize: 10, color: '444444', valign: 'top', wrap: true,
        fontFace: 'Consolas',
        lineSpacingMultiple: 1.1,
      });
    });
  });

  const buffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename);
}

export function downloadBlobs(blobs: Blob[], baseFilename: string) {
  blobs.forEach((blob, i) => {
    saveAs(blob, `${baseFilename}_${i + 1}.pdf`);
  });
}

/**
 * Bundle multiple output files into a single ZIP download. Browsers throttle
 * or block a burst of separate downloads, so "Download All" uses this instead.
 */
export async function downloadBlobsAsZip(entries: { blob: Blob; name: string }[], zipName: string) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const { blob, name } of entries) {
    let unique = name;
    let n = 1;
    while (used.has(unique)) {
      const dot = name.lastIndexOf('.');
      unique = dot > 0 ? `${name.slice(0, dot)}_${++n}${name.slice(dot)}` : `${name}_${++n}`;
    }
    used.add(unique);
    zip.file(unique, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  saveAs(zipBlob, zipName);
}

export interface OcrResult {
  blob: Blob;
  pages: number;
  totalChars: number;
}

export async function ocrPdf(file: File, languages: string[], onProgress?: (page: number, total: number, msg: string) => void): Promise<OcrResult> {
  const Tesseract = await import('tesseract.js');
  const pdfjsLib = await getPdfJs();

  const langStr = languages.join('+');
  const buf = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdfDoc.numPages;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let totalChars = 0;

  // One worker for the whole document — reloading the language model per page
  // is by far the slowest part of OCR.
  let currentPage = 1;
  const worker = await Tesseract.createWorker(langStr, undefined, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        onProgress?.(currentPage, numPages, `Page ${currentPage}: ${Math.round((m.progress || 0) * 100)}% recognized`);
      }
    },
  });

  try {
    for (let i = 1; i <= numPages; i++) {
      currentPage = i;
      onProgress?.(i, numPages, `Scanning page ${i} of ${numPages}...`);

      const page = await pdfDoc.getPage(i);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = safeScale(baseVp.width, baseVp.height, 3, 6000);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      totalChars += (data.text || '').length;

      const img = await doc.embedJpg(canvasToJpgBytes(canvas, 0.95));

      // Page keeps its true size in points; OCR pixel coords convert by 1/scale.
      const pw = baseVp.width;
      const ph = baseVp.height;
      const px2pt = 1 / scale;
      const pdfPage = doc.addPage([pw, ph]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: pw, height: ph });

      const blocks = (data as any).blocks || [];
      for (const block of blocks) {
        for (const paragraph of block.paragraphs || []) {
          for (const line of paragraph.lines || []) {
            for (const word of line.words || []) {
              const text = (word.text || '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
              if (!text.trim()) continue;
              const bx = word.bbox.x0 * px2pt;
              const by = ph - word.bbox.y1 * px2pt;
              const bh = (word.bbox.y1 - word.bbox.y0) * px2pt;
              const fontSize = Math.max(4, Math.min(bh * 0.9, 60));
              try {
                pdfPage.drawText(text, {
                  x: bx,
                  y: by,
                  size: fontSize,
                  font,
                  color: rgb(0, 0, 0),
                  opacity: 0.01,
                });
              } catch { /* skip words the fallback font can't encode */ }
            }
          }
        }
      }
    }
  } finally {
    await worker.terminate();
  }

  return { blob: toBlob(await doc.save()), pages: numPages, totalChars };
}
