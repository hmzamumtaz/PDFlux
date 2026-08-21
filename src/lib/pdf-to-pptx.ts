/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/**
 * PDF → PowerPoint.
 *
 * Rather than dumping raw page text onto slides, this reads the document's
 * layout: text items are grouped into lines, lines into paragraphs, and the
 * dominant heading of each page becomes the slide title. Long pages are split
 * across continuation slides so nothing overflows.
 */
import { getPdfJs, readFileAsArrayBuffer } from './pdf-engine';

export interface PdfToPptxResult {
  blob: Blob;
  slides: number;
  pages: number;
}

interface Line { text: string; size: number; x: number; y: number; bold: boolean }
interface Block { text: string; bullet: boolean; size: number; x: number }

const MAX_BULLETS_PER_SLIDE = 9;
const MAX_CHARS_PER_SLIDE = 900;

/** Group a page's text items into visual lines, ordered top to bottom. */
function buildLines(items: any[]): Line[] {
  const raw = items
    .filter(it => 'str' in it && it.str.trim() !== '')
    .map(it => ({
      text: it.str as string,
      x: it.transform[4] as number,
      y: it.transform[5] as number,
      size: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10,
      font: String(it.fontName || ''),
    }));
  if (raw.length === 0) return [];

  raw.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));

  const lines: Line[] = [];
  let bucket: typeof raw = [];
  const flush = () => {
    if (bucket.length === 0) return;
    bucket.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd: number | null = null;
    for (const it of bucket) {
      // Insert a space when there is a visible gap between runs.
      if (prevEnd !== null && it.x - prevEnd > it.size * 0.18 && !/\s$/.test(text)) text += ' ';
      text += it.text;
      prevEnd = it.x + it.text.length * it.size * 0.5;
    }
    const size = Math.max(...bucket.map(b => b.size));
    const bold = bucket.some(b => /bold|black|heavy|semibold/i.test(b.font));
    lines.push({ text: text.replace(/\s+/g, ' ').trim(), size, x: Math.min(...bucket.map(b => b.x)), y: bucket[0].y, bold });
    bucket = [];
  };

  for (const it of raw) {
    if (bucket.length === 0 || Math.abs(it.y - bucket[0].y) <= Math.max(2, it.size * 0.4)) bucket.push(it);
    else { flush(); bucket.push(it); }
  }
  flush();
  return lines.filter(l => l.text !== '');
}

const BULLET_RE = /^([•·▪◦‣o]|[-–—*]|\(?\d{1,2}[.)]|[a-z][.)])\s+/i;

/** Merge wrapped lines into paragraphs and mark bullet items. */
function buildBlocks(lines: Line[], bodySize: number): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const isBullet = BULLET_RE.test(line.text);
    const text = isBullet ? line.text.replace(BULLET_RE, '') : line.text;
    const prev = blocks[blocks.length - 1];

    // A wrapped line sits at the same left edge as its paragraph, and a bullet's
    // wrapped lines sit further right than the bullet marker. Anything starting
    // back at (or left of) the previous block's edge begins a new block — that
    // is what keeps a paragraph from being swallowed by the bullet above it.
    const alignsAsContinuation = prev
      ? (prev.bullet ? line.x > prev.x + 1 : Math.abs(line.x - prev.x) <= 2)
      : false;

    const continues =
      prev &&
      !isBullet &&
      alignsAsContinuation &&
      Math.abs(line.size - prev.size) < 1.5 &&
      !/[.!?:;]$/.test(prev.text) &&
      !/^[A-Z][A-Z\s]{4,}$/.test(text) &&
      line.size <= bodySize + 1;

    if (continues) prev.text = `${prev.text} ${text}`.replace(/\s+/g, ' ');
    else blocks.push({ text, bullet: isBullet, size: line.size, x: line.x });
  }
  return blocks.filter(b => b.text.trim() !== '');
}

function median(values: number[]): number {
  if (values.length === 0) return 10;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Split blocks into slide-sized chunks. */
function chunkBlocks(blocks: Block[]): Block[][] {
  const chunks: Block[][] = [];
  let cur: Block[] = [];
  let chars = 0;
  for (const b of blocks) {
    if (cur.length >= MAX_BULLETS_PER_SLIDE || (chars + b.text.length > MAX_CHARS_PER_SLIDE && cur.length > 0)) {
      chunks.push(cur); cur = []; chars = 0;
    }
    cur.push(b);
    chars += b.text.length;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks.length > 0 ? chunks : [[]];
}

export async function pdfToPowerpointStructured(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<PdfToPptxResult> {
  const pdfjsLib = await getPdfJs();
  const PptxGenJS = (await import('pptxgenjs')).default;

  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Folio';
  pptx.title = file.name.replace(/\.pdf$/i, '');

  const ACCENT = '1F4E79';
  const BODY = '333333';
  let slideCount = 0;
  let anyText = false;

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = buildLines(content.items as any[]);
    if (lines.length === 0) continue;
    anyText = true;

    const sizes = lines.map(l => l.size);
    const bodySize = median(sizes);
    const maxSize = Math.max(...sizes);

    // The page's heading: the largest line in the top third, clearly bigger
    // than body text. Otherwise the slide just gets the document's name.
    const pageTop = Math.max(...lines.map(l => l.y));
    const pageBottom = Math.min(...lines.map(l => l.y));
    const span = Math.max(pageTop - pageBottom, 1);
    const headingCandidates = lines.filter(
      l => l.size >= maxSize - 0.5 && l.size > bodySize * 1.15 && (pageTop - l.y) / span < 0.35 && l.text.length <= 120,
    );
    const heading = headingCandidates[0] ?? null;

    const bodyLines = heading ? lines.filter(l => l !== heading) : lines;
    const blocks = buildBlocks(bodyLines, bodySize);
    const chunks = chunkBlocks(blocks);

    chunks.forEach((chunk, ci) => {
      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      const titleText = heading ? heading.text : `${pptx.title} — page ${p}`;
      slide.addText(ci === 0 ? titleText : `${titleText} (cont.)`, {
        x: 0.5, y: 0.32, w: 9.0, h: 0.85,
        fontSize: 26, bold: true, color: ACCENT, valign: 'middle',
        shrinkText: true,
      } as any);
      slide.addShape('line' as any, { x: 0.5, y: 1.16, w: 9.0, h: 0, line: { color: ACCENT, width: 1.5 } } as any);

      if (chunk.length > 0) {
        slide.addText(
          chunk.map(b => ({
            text: b.text,
            options: {
              bullet: b.bullet || chunk.length > 1 ? { code: '2022' } : false,
              fontSize: b.size > bodySize * 1.1 ? 16 : 14,
              bold: b.size > bodySize * 1.1,
              color: BODY,
              breakLine: true,
              paraSpaceAfter: 6,
            },
          })) as any,
          { x: 0.7, y: 1.45, w: 8.6, h: 3.6, valign: 'top', shrinkText: true } as any,
        );
      }

      slide.addText(`Page ${p} of ${pdf.numPages}`, {
        x: 0.5, y: 5.05, w: 9.0, h: 0.3, fontSize: 9, color: '999999', align: 'right',
      });
      slideCount++;
    });
  }

  if (!anyText) {
    throw new Error('No selectable text found in this PDF — it looks like a scan. Run it through the OCR PDF tool first, then convert.');
  }

  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  return {
    blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
    slides: slideCount,
    pages: pdf.numPages,
  };
}
