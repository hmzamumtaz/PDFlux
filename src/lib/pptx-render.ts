/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

/**
 * PowerPoint (.pptx) → PDF renderer.
 *
 * Parses the OOXML presentation with DOMParser (not regex) and repaints each
 * slide onto a white, slide-sized PDF page: text with its real position, size,
 * weight, colour, alignment and bullets; pictures; tables; grouped shapes; and
 * shape fills. Placeholder geometry missing from a slide is inherited from its
 * layout and then the master, the way PowerPoint resolves it.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

const EMU_PER_PT = 12700;
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface PptxRenderResult {
  bytes: Uint8Array;
  slides: number;
  images: number;
}

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }

interface Rect { x: number; y: number; w: number; h: number }

interface Ctx {
  zip: any;
  pdf: PDFDocument;
  fonts: Fonts;
  slideH: number;
  imageCache: Map<string, any>;
  imageCount: { n: number };
}

/** Standard PDF fonts only encode Latin-1; drop what they cannot draw. */
function sanitize(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, '...')
    .replace(/[•●▪◦]/g, '•')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

const emuToPt = (v: string | null): number => (v ? parseInt(v, 10) / EMU_PER_PT : 0);

function getXfrm(el: Element): Rect | null {
  // Shapes carry <a:xfrm>, graphic frames carry <p:xfrm> — accept either.
  const xfrm = el.getElementsByTagNameNS('*', 'xfrm')[0];
  if (!xfrm) return null;
  const off = xfrm.getElementsByTagNameNS(A, 'off')[0];
  const ext = xfrm.getElementsByTagNameNS(A, 'ext')[0];
  if (!off || !ext) return null;
  return {
    x: emuToPt(off.getAttribute('x')),
    y: emuToPt(off.getAttribute('y')),
    w: emuToPt(ext.getAttribute('cx')),
    h: emuToPt(ext.getAttribute('cy')),
  };
}

function directChild(parent: Element, name: string): Element | null {
  for (const c of Array.from(parent.children)) if (c.localName === name) return c;
  return null;
}

/**
 * The element's own solid fill. Only DIRECT children count: a <a:tcPr> nests a
 * <a:solidFill> inside each border definition (<a:lnL> …), so a descendant
 * search would return the border colour instead of the cell's fill.
 */
function solidFillColor(parent: Element | null): RGB | null {
  if (!parent) return null;
  const fill = directChild(parent, 'solidFill');
  if (!fill) return null;
  const srgb = directChild(fill, 'srgbClr');
  const hex = srgb?.getAttribute('val');
  if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

/** Border colour for one side of a table cell, e.g. lnB. */
function cellBorderColor(tcPr: Element | null, side: string): RGB | null {
  if (!tcPr) return null;
  const ln = directChild(tcPr, side);
  return ln ? solidFillColor(ln) : null;
}

/** Placeholder identity of a shape, e.g. "title" or "body:1". */
function placeholderKey(sp: Element): string | null {
  const ph = sp.getElementsByTagName('p:ph')[0] || sp.getElementsByTagNameNS('*', 'ph')[0];
  if (!ph) return null;
  const type = ph.getAttribute('type') || 'body';
  const idx = ph.getAttribute('idx') || '';
  return `${type}:${idx}`;
}

/** Map placeholder key → geometry, from a layout or master part. */
function collectPlaceholders(doc: Document | null): Map<string, Rect> {
  const map = new Map<string, Rect>();
  if (!doc) return map;
  const shapes = Array.from(doc.getElementsByTagName('p:sp'));
  for (const sp of shapes) {
    const key = placeholderKey(sp);
    const rect = getXfrm(sp);
    if (key && rect) {
      map.set(key, rect);
      const [type] = key.split(':');
      if (!map.has(type)) map.set(type, rect); // fall back on type alone
    }
  }
  return map;
}

interface Run { text: string; size: number; bold: boolean; italic: boolean; color: RGB }
interface Para { runs: Run[]; align: string; bullet: string | null; level: number }

function parseParagraphs(txBody: Element, defaultSize: number): Para[] {
  const paras: Para[] = [];
  for (const p of Array.from(txBody.getElementsByTagNameNS(A, 'p'))) {
    const pPr = p.getElementsByTagNameNS(A, 'pPr')[0];
    const align = pPr?.getAttribute('algn') || 'l';
    const level = parseInt(pPr?.getAttribute('lvl') || '0', 10);
    const hasNoBullet = !!pPr?.getElementsByTagNameNS(A, 'buNone')[0];
    const buChar = pPr?.getElementsByTagNameNS(A, 'buChar')[0]?.getAttribute('char');
    const buAuto = pPr?.getElementsByTagNameNS(A, 'buAutoNum')[0];

    const runs: Run[] = [];
    // Walk children in document order so <a:br> line breaks stay in place.
    for (const child of Array.from(p.children)) {
      const tag = child.localName;
      if (tag === 'br') {
        runs.push({ text: '\n', size: defaultSize, bold: false, italic: false, color: rgb(0.1, 0.1, 0.1) });
        continue;
      }
      if (tag !== 'r' && tag !== 'fld') continue;
      const rPr = child.getElementsByTagNameNS(A, 'rPr')[0];
      const t = child.getElementsByTagNameNS(A, 't')[0];
      const text = sanitize(t?.textContent || '');
      if (!text) continue;
      const szAttr = rPr?.getAttribute('sz');
      runs.push({
        text,
        size: szAttr ? parseInt(szAttr, 10) / 100 : defaultSize,
        bold: rPr?.getAttribute('b') === '1',
        italic: rPr?.getAttribute('i') === '1',
        color: solidFillColor(rPr) || rgb(0.1, 0.1, 0.1),
      });
    }
    if (runs.length === 0) { paras.push({ runs: [], align, bullet: null, level }); continue; }
    const bullet = hasNoBullet ? null : (buChar ? sanitize(buChar) || '•' : (buAuto ? '•' : (level > 0 ? '•' : null)));
    paras.push({ runs, align, bullet, level });
  }
  return paras;
}

function fontFor(fonts: Fonts, bold: boolean, italic: boolean): PDFFont {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

/**
 * Draw a text body inside `rect`, wrapping on word boundaries and shrinking
 * uniformly if the text would overflow the shape (PowerPoint's autofit).
 */
function drawTextBody(page: PDFPage, ctx: Ctx, paras: Para[], rect: Rect, anchor: string) {
  if (paras.length === 0) return;
  const padX = 7.2, padY = 3.6;
  const maxW = Math.max(rect.w - padX * 2, 12);
  const maxH = Math.max(rect.h - padY * 2, 10);

  type Line = { tokens: { text: string; run: Run }[]; align: string; indent: number; height: number };

  const layout = (scale: number): Line[] => {
    const lines: Line[] = [];
    for (const para of paras) {
      if (para.runs.length === 0) { lines.push({ tokens: [], align: para.align, indent: 0, height: 8 * scale }); continue; }
      const indent = para.level * 16 + (para.bullet ? 12 : 0);
      const avail = Math.max(maxW - indent, 20);
      let line: Line = { tokens: [], align: para.align, indent, height: 0 };
      let lineW = 0;
      let firstLineOfPara = true;

      const pushLine = () => {
        if (line.tokens.length === 0 && !firstLineOfPara) return;
        const maxSize = line.tokens.length ? Math.max(...line.tokens.map(t => t.run.size * scale)) : para.runs[0].size * scale;
        line.height = maxSize * 1.22;
        if (firstLineOfPara && para.bullet) {
          line.tokens.unshift({ text: para.bullet + ' ', run: { ...para.runs[0], bold: false, italic: false } });
        }
        lines.push(line);
        firstLineOfPara = false;
        line = { tokens: [], align: para.align, indent: indent, height: 0 };
        lineW = 0;
      };

      for (const run of para.runs) {
        for (const chunk of run.text.split('\n')) {
          if (chunk !== run.text.split('\n')[0]) pushLine();
          for (const word of chunk.split(/(\s+)/)) {
            if (!word) continue;
            if (/^\s+$/.test(word)) {
              if (line.tokens.length) { line.tokens.push({ text: ' ', run }); lineW += fontFor(ctx.fonts, run.bold, run.italic).widthOfTextAtSize(' ', run.size * scale); }
              continue;
            }
            const f = fontFor(ctx.fonts, run.bold, run.italic);
            const w = f.widthOfTextAtSize(word, run.size * scale);
            if (lineW + w > avail && line.tokens.length > 0) pushLine();
            line.tokens.push({ text: word, run });
            lineW += w;
          }
        }
      }
      if (line.tokens.length > 0 || firstLineOfPara) pushLine();
    }
    return lines;
  };

  let scale = 1;
  let lines = layout(scale);
  let total = lines.reduce((a, l) => a + l.height, 0);
  // Shrink-to-fit, like PowerPoint's normAutofit, down to a readable floor.
  while (total > maxH && scale > 0.45) {
    scale -= 0.07;
    lines = layout(scale);
    total = lines.reduce((a, l) => a + l.height, 0);
  }

  // Vertical anchor within the shape (PDF y grows upward).
  const topY = ctx.slideH - rect.y - padY;
  let y = topY;
  if (anchor === 'ctr') y = topY - Math.max(0, (maxH - total) / 2);
  else if (anchor === 'b') y = topY - Math.max(0, maxH - total);

  for (const line of lines) {
    y -= line.height;
    if (y < ctx.slideH - rect.y - rect.h - line.height) break; // overflowed the shape
    const lineW = line.tokens.reduce((a, t) => a + fontFor(ctx.fonts, t.run.bold, t.run.italic).widthOfTextAtSize(t.text, t.run.size * scale), 0);
    let x = rect.x + padX + line.indent;
    if (line.align === 'ctr') x = rect.x + (rect.w - lineW) / 2;
    else if (line.align === 'r') x = rect.x + rect.w - padX - lineW;

    for (const tok of line.tokens) {
      const f = fontFor(ctx.fonts, tok.run.bold, tok.run.italic);
      const size = tok.run.size * scale;
      try {
        page.drawText(tok.text, { x, y: y + line.height * 0.22, size, font: f, color: tok.run.color });
      } catch { /* skip glyphs the standard font cannot encode */ }
      x += f.widthOfTextAtSize(tok.text, size);
    }
  }
}

/**
 * Embed a picture without trusting the raw bytes. pdf-lib's PNG decoder can
 * spin forever on a malformed file, so anything that is not a plainly valid
 * JPEG is first decoded by the browser (which rejects bad data cleanly) and
 * re-encoded from a canvas.
 */
async function embedImageSafely(pdf: PDFDocument, data: Uint8Array, path: string): Promise<any | null> {
  const isJpeg = /\.(jpe?g)$/i.test(path) && data[0] === 0xff && data[1] === 0xd8;
  if (isJpeg) {
    try { return await pdf.embedJpg(data); } catch { /* fall through to re-encode */ }
  }
  try {
    const bitmap = await createImageBitmap(new Blob([data as unknown as BlobPart]));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const dataUrl = canvas.toDataURL('image/png');
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    return await pdf.embedPng(bytes);
  } catch {
    return null; // unsupported (emf/wmf/svg) or corrupt — skip the picture
  }
}

async function drawPicture(page: PDFPage, ctx: Ctx, pic: Element, rels: Map<string, string>, rect: Rect | null) {
  const blip = pic.getElementsByTagNameNS(A, 'blip')[0];
  const embed = blip?.getAttributeNS(R_NS, 'embed') || blip?.getAttribute('r:embed');
  if (!embed || !rect) return;
  const target = rels.get(embed);
  if (!target) return;

  const path = target.replace(/^\.\.\//, 'ppt/').replace(/^\//, '');
  const cacheKey = path;
  let img = ctx.imageCache.get(cacheKey);
  if (!img) {
    const entry = ctx.zip.file(path) || ctx.zip.file(`ppt/${target.replace(/^\.\.\//, '')}`);
    if (!entry) return;
    const data = await entry.async('uint8array');
    img = await embedImageSafely(ctx.pdf, data, path);
    if (!img) return;
    ctx.imageCache.set(cacheKey, img);
  }
  ctx.imageCount.n++;
  page.drawImage(img, { x: rect.x, y: ctx.slideH - rect.y - rect.h, width: rect.w, height: rect.h });
}

function drawTable(page: PDFPage, ctx: Ctx, frame: Element, rect: Rect | null) {
  const tbl = frame.getElementsByTagNameNS(A, 'tbl')[0];
  if (!tbl || !rect) return;
  const gridCols = Array.from(tbl.getElementsByTagNameNS(A, 'gridCol'));
  const colW = gridCols.map(c => emuToPt(c.getAttribute('w')));
  const totalW = colW.reduce((a, b) => a + b, 0) || rect.w;
  const scaleX = rect.w / totalW;

  let y = ctx.slideH - rect.y;
  for (const tr of Array.from(tbl.getElementsByTagNameNS(A, 'tr'))) {
    const rowH = emuToPt(tr.getAttribute('h')) || 20;
    let x = rect.x;
    const cells = Array.from(tr.getElementsByTagNameNS(A, 'tc'));
    cells.forEach((tc, ci) => {
      const w = (colW[ci] ?? totalW / cells.length) * scaleX;
      const tcPr = directChild(tc, 'tcPr');
      const fill = solidFillColor(tcPr);
      if (fill) page.drawRectangle({ x, y: y - rowH, width: w, height: rowH, color: fill });
      const border = cellBorderColor(tcPr, 'lnB') || cellBorderColor(tcPr, 'lnT') || rgb(0.72, 0.75, 0.8);
      page.drawRectangle({ x, y: y - rowH, width: w, height: rowH, borderColor: border, borderWidth: 0.6 });
      const txBody = tc.getElementsByTagNameNS(A, 'txBody')[0];
      if (txBody) {
        const paras = parseParagraphs(txBody, 11);
        drawTextBody(page, ctx, paras, { x, y: ctx.slideH - y, w, h: rowH }, 'ctr');
      }
      x += w;
    });
    y -= rowH;
  }
}

async function drawShapeTree(
  page: PDFPage,
  ctx: Ctx,
  container: Element,
  rels: Map<string, string>,
  placeholders: Map<string, Rect>,
) {
  for (const el of Array.from(container.children)) {
    const tag = el.localName;

    if (tag === 'grpSp') {
      await drawShapeTree(page, ctx, el, rels, placeholders);
      continue;
    }

    if (tag === 'pic') {
      await drawPicture(page, ctx, el, rels, getXfrm(el));
      continue;
    }

    if (tag === 'graphicFrame') {
      drawTable(page, ctx, el, getXfrm(el));
      continue;
    }

    if (tag !== 'sp') continue;

    // Geometry: the shape's own, else inherited from layout/master by placeholder.
    let rect = getXfrm(el);
    if (!rect) {
      const key = placeholderKey(el);
      if (key) rect = placeholders.get(key) || placeholders.get(key.split(':')[0]) || null;
    }
    if (!rect) continue;

    const spPr = directChild(el, 'spPr');
    const fill = solidFillColor(spPr);
    if (fill) page.drawRectangle({ x: rect.x, y: ctx.slideH - rect.y - rect.h, width: rect.w, height: rect.h, color: fill });

    const txBody = el.getElementsByTagName('p:txBody')[0];
    if (!txBody) continue;
    const bodyPr = txBody.getElementsByTagNameNS(A, 'bodyPr')[0];
    const anchor = bodyPr?.getAttribute('anchor') || 't';
    const isTitle = (placeholderKey(el) || '').startsWith('title') || (placeholderKey(el) || '').startsWith('ctrTitle');
    const paras = parseParagraphs(txBody, isTitle ? 32 : 18);
    if (paras.some(p => p.runs.length > 0)) drawTextBody(page, ctx, paras, rect, anchor);
  }
}

function relsFor(zip: any, partPath: string): Promise<Map<string, string>> {
  const dir = partPath.replace(/\/[^/]+$/, '');
  const name = partPath.split('/').pop();
  const relPath = `${dir}/_rels/${name}.rels`;
  const entry = zip.file(relPath);
  if (!entry) return Promise.resolve(new Map());
  return entry.async('text').then((xml: string) => {
    const map = new Map<string, string>();
    for (const rel of Array.from(parseXml(xml).getElementsByTagName('Relationship'))) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) map.set(id, target);
    }
    return map;
  });
}

export async function renderPptxToPdf(
  file: File,
  onProgress?: (slide: number, total: number) => void,
): Promise<PptxRenderResult> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const presEntry = zip.file('ppt/presentation.xml');
  if (!presEntry) throw new Error('This file does not look like a PowerPoint presentation (.pptx).');
  const presDoc = parseXml(await presEntry.async('text'));

  const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
  const slideW = emuToPt(sldSz?.getAttribute('cx')) || 720;
  const slideH = emuToPt(sldSz?.getAttribute('cy')) || 540;

  // Slide order comes from the presentation's relationship ids.
  const presRels = await relsFor(zip, 'ppt/presentation.xml');
  const idList = presDoc.getElementsByTagName('p:sldIdLst')[0];
  let slidePaths: string[] = [];
  if (idList) {
    for (const sldId of Array.from(idList.getElementsByTagName('p:sldId'))) {
      const rid = sldId.getAttributeNS(R_NS, 'id') || sldId.getAttribute('r:id');
      const target = rid ? presRels.get(rid) : null;
      if (target) slidePaths.push(`ppt/${target.replace(/^\.\.\//, '').replace(/^\//, '')}`);
    }
  }
  if (slidePaths.length === 0) {
    slidePaths = Object.keys(zip.files)
      .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => parseInt(a.match(/(\d+)/)![1], 10) - parseInt(b.match(/(\d+)/)![1], 10));
  }
  if (slidePaths.length === 0) throw new Error('No slides found in this presentation.');

  const pdf = await PDFDocument.create();
  pdf.setTitle(file.name.replace(/\.pptx$/i, ''));
  pdf.setProducer('Folio');
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const ctx: Ctx = { zip, pdf, fonts, slideH, imageCache: new Map(), imageCount: { n: 0 } };

  const layoutCache = new Map<string, Map<string, Rect>>();

  for (let i = 0; i < slidePaths.length; i++) {
    onProgress?.(i + 1, slidePaths.length);
    const slidePath = slidePaths[i];
    const entry = zip.file(slidePath);
    if (!entry) continue;
    const slideDoc = parseXml(await entry.async('text'));
    const rels = await relsFor(zip, slidePath);

    // Every slide starts as a clean white page of the deck's size.
    const page = pdf.addPage([slideW, slideH]);
    page.drawRectangle({ x: 0, y: 0, width: slideW, height: slideH, color: rgb(1, 1, 1) });

    // Inherit placeholder geometry: layout first, then its master.
    let placeholders = new Map<string, Rect>();
    const layoutTarget = Array.from(rels.entries()).find(([, t]) => /slideLayouts?\//.test(t))?.[1];
    if (layoutTarget) {
      const layoutPath = `ppt/${layoutTarget.replace(/^\.\.\//, '').replace(/^\//, '')}`;
      if (layoutCache.has(layoutPath)) {
        placeholders = layoutCache.get(layoutPath)!;
      } else {
        const lEntry = zip.file(layoutPath);
        if (lEntry) {
          const lDoc = parseXml(await lEntry.async('text'));
          placeholders = collectPlaceholders(lDoc);
          const lRels = await relsFor(zip, layoutPath);
          const masterTarget = Array.from(lRels.entries()).find(([, t]) => /slideMasters?\//.test(t))?.[1];
          if (masterTarget) {
            const mEntry = zip.file(`ppt/${masterTarget.replace(/^\.\.\//, '').replace(/^\//, '')}`);
            if (mEntry) {
              const masterPh = collectPlaceholders(parseXml(await mEntry.async('text')));
              for (const [k, v] of masterPh) if (!placeholders.has(k)) placeholders.set(k, v);
            }
          }
        }
        layoutCache.set(layoutPath, placeholders);
      }
    }

    const tree = slideDoc.getElementsByTagName('p:spTree')[0];
    if (tree) await drawShapeTree(page, ctx, tree, rels, placeholders);
  }

  return { bytes: await pdf.save(), slides: slidePaths.length, images: ctx.imageCount.n };
}
