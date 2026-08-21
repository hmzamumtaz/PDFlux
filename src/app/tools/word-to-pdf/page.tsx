'use client';

import ToolPage from '@/components/ToolPage';
import { readFileAsArrayBuffer } from '@/lib/pdf-engine';

export default function WordToPdfPage() {
  return (
    <ToolPage
      slug="word-to-pdf"
      accept=".docx"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const { default: mammoth } = await import('mammoth');
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

        const buf = await readFileAsArrayBuffer(files[0]);
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        const html = result.value;

        // Parse HTML into structured blocks
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const container = doc.body.firstChild as HTMLElement;

        const A4_W = 595.28;
        const A4_H = 841.89;
        const MARGIN_LEFT = 54;
        const MARGIN_RIGHT = 54;
        const MARGIN_TOP = 60;
        const MARGIN_BOTTOM = 60;
        const USABLE_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT;
        const LINE_HEIGHT = 14;

        const pdf = await PDFDocument.create();
        let page = pdf.addPage([A4_W, A4_H]);
        let cursorY = A4_H - MARGIN_TOP;

        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
        const fontBoldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

        // WinAnsi only supports Latin-1. Strip emoji, CJK, symbols, etc.
        function sanitize(text: string): string {
          return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '\u2022') // emoji ranges → bullet
            .replace(/[\u{2600}-\u{27BF}]/gu, '-') // misc symbols → dash
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // variation selectors
            .replace(/[\u{200D}]/gu, '') // zero-width joiner
            .replace(/[^\x20-\x7E\xA0-\xFF]/g, c => {
              // Keep basic Latin + Latin-1 Supplement, replace everything else
              const code = c.charCodeAt(0);
              if (code >= 0x20 && code <= 0x7E) return c; // basic ASCII
              if (code >= 0xA0 && code <= 0xFF) return c; // Latin-1 Supplement
              // Common Unicode dashes/bullets
              if (code === 0x2013 || code === 0x2014) return '-';
              if (code === 0x2018 || code === 0x2019 || code === 0x201C || code === 0x201D) return '"';
              if (code === 0x2022 || code === 0x2023) return '\u2022';
              if (code === 0x2026) return '...';
              return '?';
            });
        }

        function checkPage(needed: number) {
          if (cursorY - needed < MARGIN_BOTTOM) {
            page = pdf.addPage([A4_W, A4_H]);
            cursorY = A4_H - MARGIN_TOP;
          }
        }

        function drawText(text: string, fontSize: number, isBold: boolean, isItalic: boolean, indent: number = 0) {
          const f = isBold && isItalic ? fontBoldItalic : isBold ? fontBold : isItalic ? fontItalic : font;
          const clean = sanitize(text);
          const lines = wrapText(clean, f, fontSize, USABLE_W - indent);
          for (const line of lines) {
            checkPage(LINE_HEIGHT);
            page.drawText(line, {
              x: MARGIN_LEFT + indent,
              y: cursorY,
              size: fontSize,
              font: f,
              color: rgb(0.1, 0.1, 0.1),
              maxWidth: USABLE_W - indent,
            });
            cursorY -= LINE_HEIGHT;
          }
        }

        function wrapText(text: string, f: any, size: number, maxWidth: number): string[] {
          if (!text) return [''];
          const words = text.split(/\s+/);
          const lines: string[] = [];
          let current = '';
          for (const word of words) {
            const test = current ? current + ' ' + word : word;
            const w = f.widthOfTextAtSize(test, size);
            if (w > maxWidth && current) {
              lines.push(current);
              current = word;
            } else {
              current = test;
            }
          }
          if (current) lines.push(current);
          return lines.length ? lines : [''];
        }

        function processNode(node: HTMLElement | ChildNode, indent: number = 0) {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim()) drawText(text, 11, false, false, indent);
            return;
          }

          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();

          switch (tag) {
            case 'h1':
              checkPage(30);
              cursorY -= 8;
              drawText(el.textContent || '', 22, true, false, indent);
              cursorY -= 4;
              break;
            case 'h2':
              checkPage(26);
              cursorY -= 6;
              drawText(el.textContent || '', 18, true, false, indent);
              cursorY -= 3;
              break;
            case 'h3':
              checkPage(22);
              cursorY -= 4;
              drawText(el.textContent || '', 15, true, false, indent);
              cursorY -= 2;
              break;
            case 'h4': case 'h5': case 'h6':
              checkPage(20);
              cursorY -= 3;
              drawText(el.textContent || '', 13, true, false, indent);
              cursorY -= 2;
              break;
            case 'p':
            case 'div':
              checkPage(LINE_HEIGHT);
              cursorY -= 4;
              if (el.childNodes.length === 0) {
                drawText('', 11, false, false, indent);
              } else {
                processChildren(el, indent);
              }
              cursorY -= 2;
              break;
            case 'strong':
            case 'b':
              processChildren(el, indent, true, false);
              break;
            case 'em':
            case 'i':
              processChildren(el, indent, false, true);
              break;
            case 'u':
              processChildren(el, indent, false, false);
              break;
            case 'br':
              checkPage(LINE_HEIGHT);
              cursorY -= LINE_HEIGHT;
              break;
            case 'ul':
            case 'ol':
              cursorY -= 3;
              const listItems = el.querySelectorAll(':scope > li');
              listItems.forEach((li, idx) => {
                const bullet = tag === 'ol' ? `${idx + 1}. ` : '\u2022 ';
                checkPage(LINE_HEIGHT);
                const liText = li.textContent || '';
                drawText(bullet + liText, 11, false, false, indent + 16);
                cursorY -= 2;
              });
              cursorY -= 2;
              break;
            case 'table':
              cursorY -= 4;
              processTable(el, indent);
              cursorY -= 4;
              break;
            case 'blockquote':
              cursorY -= 3;
              const bqText = el.textContent || '';
              drawText(bqText, 11, false, true, indent + 20);
              cursorY -= 3;
              break;
            case 'pre':
            case 'code':
              cursorY -= 3;
              const codeText = el.textContent || '';
              drawText(codeText, 9, false, false, indent + 10);
              cursorY -= 3;
              break;
            case 'hr':
              checkPage(10);
              cursorY -= 5;
              page.drawLine({
                start: { x: MARGIN_LEFT + indent, y: cursorY },
                end: { x: A4_W - MARGIN_RIGHT, y: cursorY },
                thickness: 1,
                color: rgb(0.7, 0.7, 0.7),
              });
              cursorY -= 8;
              break;
            case 'img':
              break;
            default:
              processChildren(el, indent);
          }
        }

        function processChildren(el: HTMLElement, indent: number, forceBold: boolean = false, forceItalic: boolean = false) {
          // Collect all text content with formatting
          let text = '';
          const fragments: { text: string; bold: boolean; italic: boolean }[] = [];

          function collectText(node: ChildNode) {
            if (node.nodeType === Node.TEXT_NODE) {
              const t = node.textContent || '';
              if (t) fragments.push({ text: t, bold: forceBold, italic: forceItalic });
              return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const child = node as HTMLElement;
            const ctag = child.tagName.toLowerCase();
            const isBold = forceBold || ctag === 'strong' || ctag === 'b';
            const isItalic = forceItalic || ctag === 'em' || ctag === 'i';

            if (ctag === 'br') {
              fragments.push({ text: '\n', bold: false, italic: false });
              return;
            }
            if (ctag === 'strong' || ctag === 'b' || ctag === 'em' || ctag === 'i') {
              collectChildrenWithFormat(child, isBold, isItalic);
              return;
            }
            collectChildrenWithFormat(child, forceBold, forceItalic);
          }

          function collectChildrenWithFormat(node: HTMLElement, b: boolean, it: boolean) {
            for (const c of node.childNodes) {
              if (c.nodeType === Node.TEXT_NODE) {
                const t = c.textContent || '';
                if (t) fragments.push({ text: t, bold: b, italic: it });
              } else if (c.nodeType === Node.ELEMENT_NODE) {
                const child = c as HTMLElement;
                const ctag = child.tagName.toLowerCase();
                const nb = b || ctag === 'strong' || ctag === 'b';
                const nit = it || ctag === 'em' || ctag === 'i';
                if (ctag === 'br') {
                  fragments.push({ text: '\n', bold: false, italic: false });
                } else {
                  collectChildrenWithFormat(child, nb, nit);
                }
              }
            }
          }

          for (const c of el.childNodes) collectText(c);

          if (fragments.length === 0) return;

          // Group into lines and draw
          let currentLine = '';
          let lineBold = false;
          let lineItalic = false;

          for (const frag of fragments) {
            if (frag.text.includes('\n')) {
              const parts = frag.text.split('\n');
              for (let i = 0; i < parts.length; i++) {
                if (parts[i]) {
                  currentLine += parts[i];
                  lineBold = frag.bold;
                  lineItalic = frag.italic;
                }
                if (i < parts.length - 1) {
                  if (currentLine.trim()) drawText(currentLine, 11, lineBold, lineItalic, indent);
                  currentLine = '';
                  checkPage(LINE_HEIGHT);
                }
              }
            } else {
              currentLine += frag.text;
              lineBold = frag.bold;
              lineItalic = frag.italic;
            }
          }

          if (currentLine.trim()) {
            drawText(currentLine, 11, lineBold, lineItalic, indent);
          }
        }

        function processTable(table: HTMLElement, indent: number) {
          const rows = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
          if (rows.length === 0) return;

          const allRows: string[][] = [];
          rows.forEach(tr => {
            const cells = tr.querySelectorAll(':scope > td, :scope > th');
            const rowData: string[] = [];
            cells.forEach(td => rowData.push(td.textContent?.trim() || ''));
            allRows.push(rowData);
          });

          if (allRows.length === 0) return;

          const maxCols = Math.max(...allRows.map(r => r.length));
          const colWidth = (USABLE_W - indent) / maxCols;
          const rowHeight = 18;

          for (const row of allRows) {
            checkPage(rowHeight);
            for (let c = 0; c < maxCols; c++) {
              const cellText = row[c] || '';
              const x = MARGIN_LEFT + indent + c * colWidth;
              // Draw cell background for header row
              if (allRows.indexOf(row) === 0) {
                page.drawRectangle({
                  x, y: cursorY - 3,
                  width: colWidth, height: rowHeight,
                  color: rgb(0.9, 0.92, 0.96),
                });
              }
              // Draw cell border
              page.drawRectangle({
                x, y: cursorY - 3,
                width: colWidth, height: rowHeight,
                borderColor: rgb(0.8, 0.8, 0.8),
                borderWidth: 0.5,
              });
              const cellFont = allRows.indexOf(row) === 0 ? fontBold : font;
              const lines = wrapText(cellText, cellFont, 9, colWidth - 6);
              page.drawText(lines[0] || '', {
                x: x + 3,
                y: cursorY + 2,
                size: 9,
                font: cellFont,
                color: rgb(0.1, 0.1, 0.1),
                maxWidth: colWidth - 6,
              });
            }
            cursorY -= rowHeight;
          }
        }

        // Process all children of the container
        for (const child of container.childNodes) {
          processNode(child);
        }

        const bytes = await pdf.save();
        return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      }}
    />
  );
}
