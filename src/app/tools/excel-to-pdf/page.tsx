'use client';

import ToolPage from '@/components/ToolPage';
import { htmlToPdfVisual } from '@/lib/pdf-engine';
import type { Cell, Worksheet } from 'exceljs';

const MAX_ROWS_PER_SHEET = 3000;
const MAX_COLS_PER_SHEET = 64;
// Printable widths in CSS px inside htmlToPdfVisual (A4 minus margins @96dpi, minus body padding)
const PORTRAIT_PX = 698;
const LANDSCAPE_PX = 1027;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* eslint-disable @typescript-eslint/no-explicit-any */
function argbToCss(color: any): string | null {
  const argb = color?.argb;
  if (typeof argb === 'string' && /^[0-9A-Fa-f]{8}$/.test(argb)) return '#' + argb.slice(2);
  if (typeof argb === 'string' && /^[0-9A-Fa-f]{6}$/.test(argb)) return '#' + argb;
  return null; // theme/indexed colors fall back to defaults
}

const BORDER_CSS: Record<string, string> = {
  thin: '1px solid', hair: '1px solid', dotted: '1px dotted', dashed: '1px dashed',
  dashDot: '1px dashed', dashDotDot: '1px dotted', medium: '2px solid',
  mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dotted',
  thick: '3px solid', double: '3px double', slantDashDot: '2px dashed',
};

function borderSide(side: any): string | null {
  if (!side?.style) return null;
  const css = BORDER_CSS[side.style] || '1px solid';
  return `${css} ${argbToCss(side.color) || '#000'}`;
}

// Apply the essentials of the cell's number format so values read like Excel shows them.
function formatCellValue(cell: Cell): string {
  const v: any = (cell.value as any)?.result !== undefined ? (cell.value as any).result : cell.value;
  if (v === null || v === undefined) return '';
  const numFmt = cell.numFmt || '';

  if (v instanceof Date) {
    const hasTime = /[hHsS]|AM\/PM/.test(numFmt) || (v.getUTCHours() + v.getUTCMinutes() + v.getUTCSeconds() > 0);
    const d = `${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}/${v.getUTCFullYear()}`;
    if (!hasTime) return d;
    return `${d} ${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`;
  }

  if (typeof v === 'number') {
    if (numFmt.includes('%')) {
      const decMatch = numFmt.match(/0\.(0+)%/);
      return (v * 100).toFixed(decMatch ? decMatch[1].length : 0) + '%';
    }
    const decMatch = numFmt.match(/0\.(0+)/);
    const decimals = decMatch ? decMatch[1].length : (Number.isInteger(v) ? 0 : undefined);
    const useThousands = numFmt.includes(',');
    let out: string;
    if (decimals !== undefined) {
      out = useThousands
        ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : v.toFixed(decimals);
    } else {
      out = useThousands ? v.toLocaleString('en-US') : String(v);
    }
    const cur = numFmt.match(/[$€£¥₹]/);
    if (cur) out = cur[0] + out;
    return out;
  }

  return cell.text ?? String(v);
}

interface MergeInfo { rowSpan: number; colSpan: number }

function getMerges(sheet: Worksheet): { masters: Map<string, MergeInfo>; covered: Set<string> } {
  const masters = new Map<string, MergeInfo>();
  const covered = new Set<string>();
  const merges: string[] = ((sheet as any).model?.merges as string[]) || [];
  const colNum = (letters: string) => letters.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  for (const range of merges) {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) continue;
    const c1 = colNum(m[1]), r1 = parseInt(m[2], 10), c2 = colNum(m[3]), r2 = parseInt(m[4], 10);
    masters.set(`${r1},${c1}`, { rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r !== r1 || c !== c1) covered.add(`${r},${c}`);
      }
    }
  }
  return { masters, covered };
}

/**
 * Reproduce one worksheet as styled HTML: real column widths, row heights,
 * merged cells, fills, fonts, borders, alignment and number formats — then the
 * browser renders it and the visual pipeline turns that into the PDF.
 * `fit` scales everything down uniformly (Excel's "fit to page width").
 */
function sheetToHtml(sheet: Worksheet, fit: number): string {
  const rowCount = Math.min(sheet.rowCount, MAX_ROWS_PER_SHEET);
  const colCount = Math.min(sheet.columnCount || 1, MAX_COLS_PER_SHEET);
  const { masters, covered } = getMerges(sheet);
  const showGrid = sheet.views?.[0]?.showGridLines !== false;
  const px = (n: number) => `${Math.max(1, Math.round(n * fit * 10) / 10)}px`;

  const visibleCols: number[] = [];
  const colWidths: number[] = [];
  for (let c = 1; c <= colCount; c++) {
    const col = sheet.getColumn(c);
    if (col?.hidden) continue;
    visibleCols.push(c);
    colWidths.push(((col?.width ?? 8.43) * 7) + 5); // Excel width units → px
  }
  if (visibleCols.length === 0) return '';

  let html = `<table style="border-collapse:collapse;table-layout:fixed;width:${px(colWidths.reduce((a, b) => a + b, 0))};background:#fff;">`;
  html += '<colgroup>' + colWidths.map(w => `<col style="width:${px(w)}">`).join('') + '</colgroup>';

  for (let r = 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    if (row?.hidden) continue;
    const rowH = (row?.height ?? 15) * (96 / 72); // points → px
    html += `<tr style="height:${px(rowH)};">`;

    for (const c of visibleCols) {
      if (covered.has(`${r},${c}`)) continue;
      const cell = row.getCell(c);
      const merge = masters.get(`${r},${c}`);
      const style = cell.style || {};
      const font: any = style.font || {};
      const fill: any = style.fill || {};
      const border: any = style.border || {};
      const align: any = style.alignment || {};

      // No overflow clipping: the tr height acts as a minimum and rows grow to
      // fit their content, so nothing is ever cut off.
      const css: string[] = ['box-sizing:border-box', `padding:${px(1)} ${px(4)}`];
      const gridColor = showGrid ? '#d8dbe0' : 'transparent';
      css.push(`border-top:${borderSide(border.top) || `1px solid ${gridColor}`}`);
      css.push(`border-left:${borderSide(border.left) || `1px solid ${gridColor}`}`);
      css.push(`border-bottom:${borderSide(border.bottom) || `1px solid ${gridColor}`}`);
      css.push(`border-right:${borderSide(border.right) || `1px solid ${gridColor}`}`);

      if (fill.type === 'pattern' && fill.pattern !== 'none') {
        const bg = argbToCss(fill.fgColor);
        if (bg) css.push(`background:${bg}`);
      }

      css.push(`font-size:${px((font.size ?? 11) * (96 / 72))}`);
      css.push(`font-family:${font.name ? `'${font.name}',` : ''}Calibri,Arial,Helvetica,sans-serif`);
      if (font.bold) css.push('font-weight:bold');
      if (font.italic) css.push('font-style:italic');
      const deco = [font.underline ? 'underline' : '', font.strike ? 'line-through' : ''].filter(Boolean).join(' ');
      if (deco) css.push(`text-decoration:${deco}`);
      const fc = argbToCss(font.color);
      if (fc) css.push(`color:${fc}`);

      const raw = (cell.value as any)?.result !== undefined ? (cell.value as any).result : cell.value;
      const defaultAlign = typeof raw === 'number' || raw instanceof Date ? 'right' : 'left';
      css.push(`text-align:${align.horizontal && align.horizontal !== 'fill' ? align.horizontal : defaultAlign}`);
      // html2canvas draws bottom-aligned table text half a line too low, so the
      // row border strikes through it — middle alignment renders cleanly.
      css.push(`vertical-align:${align.vertical === 'top' ? 'top' : 'middle'}`);
      // Preserve every character: wrap instead of clipping like Excel does on screen.
      css.push('white-space:pre-wrap', 'word-break:break-word', 'line-height:normal');

      const span = merge ? ` rowspan="${merge.rowSpan}" colspan="${merge.colSpan}"` : '';
      html += `<td${span} style="${css.join(';')}">${escapeHtml(formatCellValue(cell))}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';

  const truncated = sheet.rowCount > MAX_ROWS_PER_SHEET
    ? `<p style="font:italic 11px Arial;color:#888;margin:6px 0 0;">Showing first ${MAX_ROWS_PER_SHEET} of ${sheet.rowCount} rows.</p>`
    : '';
  return html + truncated;
}

function sheetNaturalWidth(sheet: Worksheet): number {
  const colCount = Math.min(sheet.columnCount || 1, MAX_COLS_PER_SHEET);
  let total = 0;
  for (let c = 1; c <= colCount; c++) {
    const col = sheet.getColumn(c);
    if (col?.hidden) continue;
    total += ((col?.width ?? 8.43) * 7) + 5;
  }
  return total;
}

// Minimal RFC-4180 CSV parser (quoted fields, embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function csvToHtml(rows: string[][]): string {
  if (rows.length === 0) return '<p style="font:12px Arial;color:#888;">Empty file.</p>';
  const cols = Math.max(...rows.map(r => r.length));
  let html = '<table style="border-collapse:collapse;width:100%;background:#fff;table-layout:fixed;">';
  rows.slice(0, MAX_ROWS_PER_SHEET).forEach((r, ri) => {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const isHeader = ri === 0;
      html += `<td style="border:1px solid #d8dbe0;padding:3px 6px;font:${isHeader ? 'bold ' : ''}11px Calibri,Arial,sans-serif;${isHeader ? 'background:#eef1f6;' : ''}white-space:pre-wrap;word-break:break-word;vertical-align:top;">${escapeHtml(r[c] ?? '')}</td>`;
    }
    html += '</tr>';
  });
  html += '</table>';
  if (rows.length > MAX_ROWS_PER_SHEET) html += `<p style="font:italic 11px Arial;color:#888;">Showing first ${MAX_ROWS_PER_SHEET} of ${rows.length} rows.</p>`;
  return html;
}

export default function ExcelToPdfPage() {
  return (
    <ToolPage
      slug="excel-to-pdf"
      accept=".xlsx,.csv"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const file = files[0];
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'xls') {
          throw new Error('Legacy .xls files are not supported. Save the file as .xlsx in Excel and try again.');
        }

        if (ext === 'csv') {
          const rows = parseCsv(await file.text());
          const html = `<div style="padding:16px;background:#fff;">${csvToHtml(rows)}</div>`;
          return htmlToPdfVisual(html);
        }

        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        try {
          await workbook.xlsx.load(await file.arrayBuffer());
        } catch {
          throw new Error(`"${file.name}" could not be read as an Excel workbook. Make sure it is a valid .xlsx file.`);
        }

        const sheets = workbook.worksheets.filter(s => s.state !== 'hidden' && s.state !== 'veryHidden' && s.rowCount > 0);
        if (sheets.length === 0) throw new Error('No visible data found in this workbook.');

        // Excel-style page setup: widest sheet decides portrait vs landscape,
        // then each sheet is fit-to-width for that orientation.
        const widest = Math.max(...sheets.map(sheetNaturalWidth));
        const orientation: 'portrait' | 'landscape' = widest > PORTRAIT_PX * 1.25 ? 'landscape' : 'portrait';
        const containerPx = (orientation === 'landscape' ? LANDSCAPE_PX : PORTRAIT_PX) - 32;

        const parts: string[] = [];
        for (const sheet of sheets) {
          const natural = sheetNaturalWidth(sheet);
          const fit = Math.min(1, containerPx / Math.max(natural, 1));
          if (parts.length > 0) parts.push('<div style="height:24px;"></div>');
          if (sheets.length > 1) {
            parts.push(`<div style="font:bold 13px Calibri,Arial,sans-serif;color:#333;background:#e9edf3;border:1px solid #cfd6df;border-bottom:0;display:inline-block;padding:5px 14px;border-radius:6px 6px 0 0;">${escapeHtml(sheet.name)}</div>`);
          }
          parts.push(sheetToHtml(sheet, fit));
        }

        const html = `<div style="padding:16px;background:#fff;">${parts.join('')}</div>`;
        return htmlToPdfVisual(html, undefined, { orientation });
      }}
    />
  );
}
