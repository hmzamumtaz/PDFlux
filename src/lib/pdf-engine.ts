/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(data, { ignoreEncryption: true });
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as any], { type: 'application/pdf' });
}

export async function mergePdfs(files: File[]): Promise<Blob> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const buf = await readFileAsArrayBuffer(file);
    const doc = await loadPdf(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return toBlob(await merged.save());
}

export async function splitPdf(file: File, ranges: { start: number; end: number }[]): Promise<Blob[]> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const results: Blob[] = [];
  for (const range of ranges) {
    const newDoc = await PDFDocument.create();
    const indices = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start - 1 + i);
    const pages = await newDoc.copyPages(src, indices);
    pages.forEach(p => newDoc.addPage(p));
    results.push(toBlob(await newDoc.save()));
  }
  return results;
}

export async function removePagesFromFile(file: File, pageNumbers: number[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const newDoc = await PDFDocument.create();
  const total = src.getPageCount();
  const keepIndices = Array.from({ length: total }, (_, i) => i).filter(i => !pageNumbers.includes(i + 1));
  const pages = await newDoc.copyPages(src, keepIndices);
  pages.forEach(p => newDoc.addPage(p));
  return toBlob(await newDoc.save());
}

export async function extractPages(file: File, pageNumbers: number[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const newDoc = await PDFDocument.create();
  const indices = pageNumbers.map(n => n - 1);
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach(p => newDoc.addPage(p));
  return toBlob(await newDoc.save());
}

export async function reorderPages(file: File, newOrder: number[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const newDoc = await PDFDocument.create();
  const indices = newOrder.map(n => n - 1);
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach(p => newDoc.addPage(p));
  return toBlob(await newDoc.save());
}

export async function rotatePages(file: File, pageNumbers: number[], angle: 90 | 180 | 270 | -90 | -180 | -270): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  for (const num of pageNumbers) {
    const page = src.getPage(num - 1);
    const current = page.getRotation().angle;
    page.setRotation(degrees(current + angle));
  }
  return toBlob(await src.save());
}

export async function compressPdf(file: File): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  return toBlob(await src.save({ useObjectStreams: true, addDefaultPage: false }));
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
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

  const originalSize = file.size;
  const buf = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdfDoc.numPages;

  if (targetBytes >= originalSize) {
    return { blob: new Blob([buf], { type: 'application/pdf' }), originalSize, compressedSize: originalSize, targetSize: targetBytes, achieved: true, quality: 1, pages: numPages };
  }

  async function renderAndBuild(scale: number): Promise<Blob> {
    const doc = await PDFDocument.create();
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const imgData = canvas.toDataURL('image/jpeg', qualityForScale(scale));
      const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
      const img = await doc.embedJpg(imgBytes);
      const pdfPage = doc.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
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

export async function addPageNumbersToFile(file: File, position: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right', startNum: number = 1): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);
  const font = await src.embedFont(StandardFonts.Helvetica);
  const total = src.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = src.getPage(i);
    const { width, height } = page.getSize();
    const text = `${startNum + i}`;
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

    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
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
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), password }).promise;
  const unlocked = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const imgData = canvas.toDataURL('image/png');
    const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
    const img = await unlocked.embedPng(imgBytes);

    const pdfPage = unlocked.addPage([viewport.width, viewport.height]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  }

  return toBlob(await unlocked.save());
}

export async function isPdfPasswordProtected(file: File): Promise<boolean> {
  const buf = await readFileAsArrayBuffer(file);
  try {
    await PDFDocument.load(buf);
    return false;
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
  const merged = await PDFDocument.create();
  for (const file of files) {
    const buf = await readFileAsArrayBuffer(file);
    let image;
    if (file.type === 'image/png') {
      image = await merged.embedPng(buf);
    } else {
      image = await merged.embedJpg(buf);
    }
    const page = merged.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return toBlob(await merged.save());
}

export async function pdfToImages(file: File): Promise<Blob[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const results: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
    });
    results.push(blob);
  }
  return results;
}

export async function htmlToPdf(html: string): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  const renderToCanvas = async (content: string) => {
    const container = document.createElement('div');
    container.innerHTML = content;
    container.style.width = '800px';
    container.style.padding = '40px';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.background = 'white';
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      return canvas;
    } finally {
      document.body.removeChild(container);
    }
  };

  let canvas: HTMLCanvasElement;
  try {
    canvas = await renderToCanvas(html);
  } catch {
    const cleaned = html.replace(/\b(lab|lch|oklab|oklch|color-mix|hwb|hsl|rgb)\([^)]*\)/gi, '#888');
    canvas = await renderToCanvas(cleaned);
  }

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = 595.28;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF('p', 'pt', 'a4');
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

  return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
}

export async function wordToPdf(file: File): Promise<Blob> {
  const { default: mammoth } = await import('mammoth');
  const buf = await readFileAsArrayBuffer(file);
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });
  const html = result.value;
  return htmlToPdf(`<div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6;">${html}</div>`);
}

export async function redactPdf(file: File, redactions: { x: number; y: number; width: number; height: number; pageIndex: number }[]): Promise<Blob> {
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);

  for (const r of redactions) {
    const page = src.getPage(r.pageIndex);
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      color: rgb(0, 0, 0),
      opacity: 1,
    });
  }

  return toBlob(await src.save());
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
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

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
  const buf = await readFileAsArrayBuffer(file);
  const src = await loadPdf(buf);

  const newDoc = await PDFDocument.create();
  newDoc.setCreator('PDFlux');
  newDoc.setProducer('PDFlux');
  newDoc.setSubject('Converted to PDF/A');
  newDoc.setTitle(src.getTitle() || 'PDF/A Document');

  const pages = await newDoc.copyPages(src, src.getPageIndices());
  pages.forEach(p => newDoc.addPage(p));

  return toBlob(await newDoc.save());
}

export async function pdfToMarkdown(file: File): Promise<string> {
  const pages = await extractTextFromPdf(file);
  return pages.map((text, i) => `## Page ${i + 1}\n\n${text}\n\n---\n\n`).join('');
}

const LANG_CODES: Record<string, string> = {
  'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Italian': 'it',
  'Portuguese': 'pt', 'Russian': 'ru', 'Chinese': 'zh-CN', 'Japanese': 'ja',
  'Korean': 'ko', 'Arabic': 'ar', 'Hindi': 'hi', 'Dutch': 'nl',
  'Swedish': 'sv', 'Polish': 'pl', 'Turkish': 'tr', 'Vietnamese': 'vi',
  'Thai': 'th', 'Indonesian': 'id', 'English': 'en',
};

async function translateChunk(text: string, from: string, to: string): Promise<string> {
  const langpair = `${from}|${to}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
  const data = await res.json();
  if (data.responseStatus === 200 || data.responseStatus === '200') {
    return data.responseData.translatedText;
  }
  throw new Error(data.responseDetails || 'Translation failed');
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
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

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

export async function extractTextFromPdf(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = 0;
    let pageText = '';

    for (const item of content.items) {
      if ('str' in item) {
        const textItem = item as any;
        if (lastY && textItem.y !== undefined && Math.abs(textItem.y - lastY) > 5) {
          pageText += '\n';
        }
        pageText += item.str;
        if (textItem.y !== undefined) lastY = textItem.y;
      }
    }
    pages.push(pageText);
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
    const lines = pageText.split('\n');
    lines.forEach((line, lineIdx) => {
      if (lineIdx === 0 && line.trim()) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `Page ${i + 1}`, bold: true })],
        }));
      }
      children.push(new Paragraph({
        children: [new TextRun({ text: line })],
      }));
    });
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
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

  pages.forEach((pageText, i) => {
    const sheet = workbook.addWorksheet(`Page ${i + 1}`);
    sheet.columns = [{ header: 'Text Content', key: 'text', width: 80 }];

    const lines = pageText.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      sheet.addRow({ text: line });
    });

    if (lines.length === 0) {
      sheet.addRow({ text: '(empty page)' });
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

  pages.forEach((pageText, i) => {
    const slide = pptx.addSlide();
    slide.addText(`Page ${i + 1}`, {
      x: 0.5,
      y: 0.3,
      w: '90%',
      fontSize: 18,
      bold: true,
      color: '333333',
    });

    slide.addText(pageText || '(empty page)', {
      x: 0.5,
      y: 1.0,
      w: '90%',
      h: '80%',
      fontSize: 11,
      color: '444444',
      valign: 'top',
      wrap: true,
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

export interface OcrResult {
  blob: Blob;
  pages: number;
  totalChars: number;
}

export interface LangVerification {
  matches: boolean;
  detectedScripts: string[];
  detectedLangs: { code: string; name: string; confidence: number }[];
  message: string;
}

function analyzeTextScripts(text: string): { script: string; ratio: number }[] {
  const ranges: Record<string, RegExp> = {
    'Arabic': /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
    'Cyrillic': /[\u0400-\u04FF\u0500-\u052F]/g,
    'CJK': /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
    'Hiragana': /[\u3040-\u309F]/g,
    'Katakana': /[\u30A0-\u30FF]/g,
    'Hangul': /[\uAC00-\uD7AF\u1100-\u11FF]/g,
    'Devanagari': /[\u0900-\u097F]/g,
    'Thai': /[\u0E00-\u0E7F]/g,
    'Hebrew': /[\u0590-\u05FF]/g,
    'Greek': /[\u0370-\u03FF]/g,
    'Armenian': /[\u0530-\u058F]/g,
    'Georgian': /[\u10A0-\u10FF]/g,
    'Tamil': /[\u0B80-\u0BFF]/g,
    'Bengali': /[\u0980-\u09FF]/g,
    'Gurmukhi': /[\u0A00-\u0A7F]/g,
    'Latin': /[a-zA-Z]/g,
  };

  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return [];

  const results: { script: string; ratio: number }[] = [];
  for (const [script, regex] of Object.entries(ranges)) {
    const matches = text.match(regex);
    if (matches) {
      results.push({ script, ratio: matches.length / totalChars });
    }
  }
  return results.filter(r => r.ratio > 0.02).sort((a, b) => b.ratio - a.ratio);
}

const SCRIPT_TO_LANGS: Record<string, { code: string; name: string }[]> = {
  'Arabic': [{ code: 'ara', name: 'Arabic' }, { code: 'fas', name: 'Persian' }, { code: 'urd', name: 'Urdu' }],
  'Cyrillic': [{ code: 'rus', name: 'Russian' }, { code: 'ukr', name: 'Ukrainian' }, { code: 'bul', name: 'Bulgarian' }, { code: 'srp', name: 'Serbian' }],
  'CJK': [{ code: 'chi_sim', name: 'Chinese (Simplified)' }],
  'Hiragana': [{ code: 'jpn', name: 'Japanese' }],
  'Katakana': [{ code: 'jpn', name: 'Japanese' }],
  'Hangul': [{ code: 'kor', name: 'Korean' }],
  'Devanagari': [{ code: 'hin', name: 'Hindi' }, { code: 'ben', name: 'Bengali' }, { code: 'tam', name: 'Tamil' }],
  'Thai': [{ code: 'tha', name: 'Thai' }],
  'Hebrew': [{ code: 'heb', name: 'Hebrew' }],
  'Greek': [{ code: 'ell', name: 'Greek' }],
  'Latin': [{ code: 'eng', name: 'English' }, { code: 'fra', name: 'French' }, { code: 'deu', name: 'German' }, { code: 'spa', name: 'Spanish' }, { code: 'ita', name: 'Italian' }, { code: 'por', name: 'Portuguese' }, { code: 'tur', name: 'Turkish' }, { code: 'vie', name: 'Vietnamese' }],
};

const LANG_NAMES: Record<string, string> = {
  eng: 'English', ara: 'Arabic', ben: 'Bengali', bul: 'Bulgarian', cat: 'Catalan', ces: 'Czech',
  chi_sim: 'Chinese (Simplified)', chi_tra: 'Chinese (Traditional)', hrv: 'Croatian', dan: 'Danish',
  nld: 'Dutch', fin: 'Finnish', fra: 'French', deu: 'German', ell: 'Greek', heb: 'Hebrew',
  hin: 'Hindi', hun: 'Hungarian', isl: 'Icelandic', ind: 'Indonesian', ita: 'Italian',
  jpn: 'Japanese', kor: 'Korean', lav: 'Latvian', lit: 'Lithuanian', mlt: 'Maltese',
  nor: 'Norwegian', fas: 'Persian', pol: 'Polish', por: 'Portuguese', ron: 'Romanian',
  rus: 'Russian', srp: 'Serbian', slk: 'Slovak', slv: 'Slovenian', spa: 'Spanish',
  swe: 'Swedish', tgl: 'Tagalog', tam: 'Tamil', tha: 'Thai', tur: 'Turkish',
  ukr: 'Ukrainian', urd: 'Urdu', vie: 'Vietnamese',
};

export async function verifyOcrLanguages(file: File, selectedLangs: string[]): Promise<LangVerification> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

  const buf = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  let allText = '';
  const pagesToScan = Math.min(pdfDoc.numPages, 3);
  for (let i = 1; i <= pagesToScan; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    allText += content.items.map((item: any) => item.str).join(' ');
  }

  const isScanned = allText.trim().length < 20;

  if (isScanned) {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const Tesseract = await import('tesseract.js');
    try {
      const { data } = await Tesseract.recognize(canvas, 'eng+ara+rus+hin+chi_sim+jpn+kor', {});
      allText = data.text;
    } catch {
      return {
        matches: false,
        detectedScripts: [],
        detectedLangs: [],
        message: 'Could not analyze the scanned document. Please select languages manually.',
      };
    }
  }

  const scripts = analyzeTextScripts(allText);
  const detectedLangs: { code: string; name: string; confidence: number }[] = [];
  const seen = new Set<string>();

  for (const s of scripts) {
    const langs = SCRIPT_TO_LANGS[s.script] || [];
    for (const lang of langs) {
      if (!seen.has(lang.code)) {
        seen.add(lang.code);
        detectedLangs.push({ code: lang.code, name: lang.name, confidence: Math.round(s.ratio * 100) });
      }
    }
  }

  if (detectedLangs.length === 0) {
    return {
      matches: false,
      detectedScripts: [],
      detectedLangs: [],
      message: isScanned
        ? 'Could not detect languages from the scanned image. Please select languages manually.'
        : 'No recognizable text found. Please select languages manually.',
    };
  }

  const selectedSet = new Set(selectedLangs);
  const detectedCodes = detectedLangs.map(l => l.code);
  const matching = detectedCodes.filter(c => selectedSet.has(c));
  const missingDetected = detectedCodes.filter(c => !selectedSet.has(c));
  const unmatchedSelected = selectedLangs.filter(c => !detectedCodes.includes(c));

  if (matching.length > 0 && missingDetected.length === 0) {
    return {
      matches: true,
      detectedScripts: scripts.map(s => s.script),
      detectedLangs,
      message: `Detected: ${detectedLangs.map(l => l.name).join(', ')}. Matches your selection.`,
    };
  }

  if (missingDetected.length > 0) {
    const missingNames = missingDetected.map(c => LANG_NAMES[c] || c);
    return {
      matches: false,
      detectedScripts: scripts.map(s => s.script),
      detectedLangs,
      message: `Detected languages: ${detectedLangs.map(l => l.name).join(', ')}. Missing from your selection: ${missingNames.join(', ')}.`,
    };
  }

  if (unmatchedSelected.length > 0) {
    return {
      matches: false,
      detectedScripts: scripts.map(s => s.script),
      detectedLangs,
      message: `Detected: ${detectedLangs.map(l => l.name).join(', ')}. Your selection includes languages not found in the document.`,
    };
  }

  return {
    matches: true,
    detectedScripts: scripts.map(s => s.script),
    detectedLangs,
    message: `Detected: ${detectedLangs.map(l => l.name).join(', ')}. Matches your selection.`,
  };
}

const LANGUAGES = [
  { code: 'eng', name: 'English' }, { code: 'ara', name: 'Arabic' }, { code: 'ben', name: 'Bengali' },
  { code: 'bul', name: 'Bulgarian' }, { code: 'cat', name: 'Catalan' }, { code: 'ces', name: 'Czech' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' }, { code: 'chi_tra', name: 'Chinese (Traditional)' },
  { code: 'hrv', name: 'Croatian' }, { code: 'dan', name: 'Danish' }, { code: 'nld', name: 'Dutch' },
  { code: 'fin', name: 'Finnish' }, { code: 'fra', name: 'French' }, { code: 'deu', name: 'German' },
  { code: 'ell', name: 'Greek' }, { code: 'heb', name: 'Hebrew' }, { code: 'hin', name: 'Hindi' },
  { code: 'hun', name: 'Hungarian' }, { code: 'isl', name: 'Icelandic' }, { code: 'ind', name: 'Indonesian' },
  { code: 'ita', name: 'Italian' }, { code: 'jpn', name: 'Japanese' }, { code: 'kor', name: 'Korean' },
  { code: 'lav', name: 'Latvian' }, { code: 'lit', name: 'Lithuanian' }, { code: 'mlt', name: 'Maltese' },
  { code: 'nor', name: 'Norwegian' }, { code: 'fas', name: 'Persian' }, { code: 'pol', name: 'Polish' },
  { code: 'por', name: 'Portuguese' }, { code: 'ron', name: 'Romanian' }, { code: 'rus', name: 'Russian' },
  { code: 'srp', name: 'Serbian' }, { code: 'slk', name: 'Slovak' }, { code: 'slv', name: 'Slovenian' },
  { code: 'spa', name: 'Spanish' }, { code: 'swe', name: 'Swedish' }, { code: 'tgl', name: 'Tagalog' },
  { code: 'tam', name: 'Tamil' }, { code: 'tha', name: 'Thai' }, { code: 'tur', name: 'Turkish' },
  { code: 'ukr', name: 'Ukrainian' }, { code: 'urd', name: 'Urdu' }, { code: 'vie', name: 'Vietnamese' },
  { code: 'osd', name: 'Orientation & Script Detection' },
];

export async function ocrPdf(file: File, languages: string[], onProgress?: (page: number, total: number, msg: string) => void): Promise<OcrResult> {
  const Tesseract = await import('tesseract.js');
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/6.2.108/pdf.worker.min.mjs`;

  const langStr = languages.join('+');
  const buf = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdfDoc.numPages;
  const doc = await PDFDocument.create();
  let totalChars = 0;

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(i, numPages, `Scanning page ${i} of ${numPages}...`);

    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const { data } = await Tesseract.recognize(canvas, langStr, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          onProgress?.(i, numPages, `Page ${i}: ${Math.round((m.progress || 0) * 100)}% recognized`);
        }
      },
    });

    totalChars += data.text.length;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
    const img = await doc.embedJpg(imgBytes);

    const pw = viewport.width * 0.75;
    const ph = viewport.height * 0.75;
    const pdfPage = doc.addPage([pw, ph]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: pw, height: ph });

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const blocks = (data as any).blocks || [];
    for (const block of blocks) {
      const lines = block.lines || [];
      for (const line of lines) {
        const words = line.words || [];
        for (const word of words) {
          const text = word.text;
          if (!text.trim()) continue;
          const bx = word.bbox.x0 * 0.75;
          const by = ph - word.bbox.y1 * 0.75;
          const bw = (word.bbox.x1 - word.bbox.x0) * 0.75;
          const bh = (word.bbox.y1 - word.bbox.y0) * 0.75;
          const fontSize = Math.max(6, Math.min(bh * 0.8, 40));
          pdfPage.drawText(text, {
            x: bx,
            y: by,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0.01,
          });
        }
      }
    }
  }

  return { blob: toBlob(await doc.save()), pages: numPages, totalChars };
}
