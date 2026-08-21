'use client';

import ToolPage from '@/components/ToolPage';
import { htmlToPdfVisual } from '@/lib/pdf-engine';
import { assertExpectedInput } from '@/lib/input-guard';
import type { Cell, Worksheet } from 'exceljs';

const MAX_ROWS_PER_SHEET = 3000;
const MAX_COLS_PER_SHEET = 128;
// Below this, an 11pt cell becomes unreadable — widths keep scaling, but font
// sizes are floored so the text stays legible (content wraps instead).
const MIN_READABLE_FONT_PX = 6.5;
// A narrow sheet is zoomed UP to fill the page (Excel's "fit to page" zoom),
// so tiny form columns don't render as unreadable vertical towers of letters.
const MAX_UPSCALE = 1.8;
const SPACER_ROW_PX = 8;   // collapsed run of empty rows
// A collapsed run of empty columns keeps (a capped share of) its real width so
// labels in narrow form columns still have room to spill, the way Excel shows
// them, instead of wrapping letter-by-letter into vertical towers.
const SPACER_COL_MAX_PX = 130;
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

function cellDisplayString(cell: Cell): string {
  const v: any = (cell.value as any)?.result !== undefined ? (cell.value as any).result : cell.value;
  if (v === null || v === undefined) return '';
  return String(cell.text ?? v).trim();
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

interface MergeRange { r1: number; c1: number; r2: number; c2: number }

function parseMerges(sheet: Worksheet): MergeRange[] {
  const out: MergeRange[] = [];
  const merges: string[] = ((sheet as any).model?.merges as string[]) || [];
  const colNum = (letters: string) => letters.split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  for (const range of merges) {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) continue;
    out.push({ c1: colNum(m[1]), r1: parseInt(m[2], 10), c2: colNum(m[3]), r2: parseInt(m[4], 10) });
  }
  return out;
}

interface UsedRange { r1: number; r2: number; c1: number; c2: number }

/**
 * The rectangle of cells that actually CONTAIN data. Spreadsheets often carry
 * styling (borders, fills) across thousands of empty cells — Excel's declared
 * dimensions include those, which produced giant empty grids. Only cells with
 * a real value count; merges reaching outside the box are simply clipped
 * (expanding for them dragged in huge empty areas).
 */
function getUsedRange(sheet: Worksheet, merges: MergeRange[]): UsedRange | null {
  // Covered cells of a merge report the MASTER's value in ExcelJS — without
  // excluding them, one banner merged across the sheet marks every column
  // underneath as "data" and drags the crop out to the whole formatted area.
  const coveredAll = new Set<string>();
  for (const m of merges) {
    for (let r = m.r1; r <= m.r2; r++) {
      for (let c = m.c1; c <= m.c2; c++) {
        if (r !== m.r1 || c !== m.c1) coveredAll.add(`${r},${c}`);
      }
    }
  }
  let r1 = Infinity, r2 = 0, c1 = Infinity, c2 = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rn) => {
    row.eachCell({ includeEmpty: false }, (cell, cn) => {
      if (!coveredAll.has(`${rn},${cn}`) && cellDisplayString(cell) !== '') {
        if (rn < r1) r1 = rn;
        if (rn > r2) r2 = rn;
        if (cn < c1) c1 = cn;
        if (cn > c2) c2 = cn;
      }
    });
  });
  if (r2 === 0) return null;
  r2 = Math.min(r2, r1 + MAX_ROWS_PER_SHEET - 1);
  c2 = Math.min(c2, c1 + MAX_COLS_PER_SHEET - 1);
  return { r1, r2, c1, c2 };
}

interface ColEntry { c: number; width: number; spacer: boolean }
interface RowEntry { r: number; empty: boolean; height: number }

interface SheetLayout {
  range: UsedRange;
  cols: ColEntry[];
  rows: RowEntry[];
  masters: Map<string, { r2: number; c2: number }>;
  covered: Set<string>;
  naturalWidth: number;
}

/**
 * Decide which rows/columns actually get rendered:
 * - hidden rows/columns are skipped
 * - columns with no data anywhere collapse (runs become one slim spacer)
 * - runs of empty rows collapse to one slim spacer row
 * Rows/columns inside a merged range that carries a value are protected.
 */
function buildLayout(sheet: Worksheet, range: UsedRange, merges: MergeRange[]): SheetLayout | null {
  const masters = new Map<string, { r2: number; c2: number }>();
  const covered = new Set<string>();
  const rowsInValuedMerges = new Set<number>();

  for (const m of merges) {
    if (m.r1 > range.r2 || m.c1 > range.c2 || m.r2 < range.r1 || m.c2 < range.c1) continue;
    masters.set(`${m.r1},${m.c1}`, { r2: Math.min(m.r2, range.r2), c2: Math.min(m.c2, range.c2) });
    for (let r = m.r1; r <= m.r2; r++) {
      for (let c = m.c1; c <= m.c2; c++) {
        if (r !== m.r1 || c !== m.c1) covered.add(`${r},${c}`);
      }
    }
    // Rows of a valued merge stay rendered (a tall merged cell must not collapse).
    // Columns intentionally do NOT get the same protection: a banner merged
    // across the whole sheet would otherwise force every empty column to
    // render — the merge simply spans whichever columns survive.
    if (cellDisplayString(sheet.getRow(m.r1).getCell(m.c1)) !== '') {
      for (let r = m.r1; r <= m.r2; r++) rowsInValuedMerges.add(r);
    }
  }

  // Column pass: which columns hold any value in the range? (Merge-covered
  // cells echo the master's value, so they must not count.)
  const colHasValue = new Set<number>();
  for (let r = range.r1; r <= range.r2; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, cn) => {
      if (cn >= range.c1 && cn <= range.c2 && !covered.has(`${r},${cn}`) && cellDisplayString(cell) !== '') colHasValue.add(cn);
    });
  }

  const cols: ColEntry[] = [];
  let spacerIdx = -1;
  for (let c = range.c1; c <= range.c2; c++) {
    const col = sheet.getColumn(c);
    if (col?.hidden) continue;
    const width = ((col?.width ?? 8.43) * 7) + 5;
    if (!colHasValue.has(c)) {
      // Collapse the run of dataless columns into ONE column that keeps their
      // combined width (capped), preserving both spacing and spill room.
      if (spacerIdx >= 0) {
        cols[spacerIdx].width = Math.min(cols[spacerIdx].width + width, SPACER_COL_MAX_PX);
        continue;
      }
      spacerIdx = cols.length;
      cols.push({ c, width: Math.min(width, SPACER_COL_MAX_PX), spacer: true });
      continue;
    }
    spacerIdx = -1;
    cols.push({ c, width, spacer: false });
  }
  if (cols.every(e => e.spacer)) return null;

  // Row pass
  const rows: RowEntry[] = [];
  let rowSpacerRun = false;
  for (let r = range.r1; r <= range.r2; r++) {
    const row = sheet.getRow(r);
    if (row?.hidden) continue;
    let hasData = rowsInValuedMerges.has(r);
    if (!hasData) {
      for (const e of cols) {
        if (!e.spacer && !covered.has(`${r},${e.c}`) && cellDisplayString(row.getCell(e.c)) !== '') { hasData = true; break; }
      }
    }
    if (!hasData) {
      if (rowSpacerRun) continue;
      rowSpacerRun = true;
      rows.push({ r, empty: true, height: SPACER_ROW_PX });
      continue;
    }
    rowSpacerRun = false;
    rows.push({ r, empty: false, height: (row?.height ?? 15) * (96 / 72) });
  }

  return {
    range, cols, rows, masters, covered,
    naturalWidth: cols.reduce((a, b) => a + b.width, 0),
  };
}

/**
 * Reproduce the worksheet's DATA AREA as styled HTML. Text in narrow columns
 * spreads across adjacent empty cells — exactly how Excel displays overflow —
 * instead of wrapping letter-by-letter into vertical towers. `fit` scales
 * widths down to the page while font sizes are floored to stay readable.
 */
function sheetToHtml(sheet: Worksheet, layout: SheetLayout, fit: number): string {
  const { cols, rows, masters, covered } = layout;
  const showGrid = sheet.views?.[0]?.showGridLines !== false;
  const px = (n: number) => `${Math.max(1, Math.round(n * fit * 10) / 10)}px`;

  let html = `<table style="border-collapse:collapse;table-layout:fixed;width:${px(layout.naturalWidth)};background:#fff;">`;
  html += '<colgroup>' + cols.map(e => `<col style="width:${px(e.width)}">`).join('') + '</colgroup>';

  const renderedColCount = (cFrom: number, cTo: number) =>
    Math.max(1, cols.filter(e => e.c >= cFrom && e.c <= cTo).length);
  const renderedRowCount = (rFrom: number, rTo: number) =>
    Math.max(1, rows.filter(e => e.r >= rFrom && e.r <= rTo).length);

  for (const rowEntry of rows) {
    const r = rowEntry.r;
    const row = sheet.getRow(r);
    html += `<tr style="height:${px(rowEntry.height)};">`;

    let i = 0;
    while (i < cols.length) {
      const entry = cols[i];
      const c = entry.c;
      if (covered.has(`${r},${c}`)) { i++; continue; }
      const cell = row.getCell(c);
      const merge = masters.get(`${r},${c}`);
      const style = cell.style || {};
      const font: any = style.font || {};
      const fill: any = style.fill || {};
      const border: any = style.border || {};
      const align: any = style.alignment || {};
      const text = rowEntry.empty ? '' : formatCellValue(cell);

      // Widths shrink with `fit`, but the font never drops below a readable floor.
      const fontPx = Math.max((font.size ?? 11) * (96 / 72) * fit, MIN_READABLE_FONT_PX);

      // Excel lets text overflow across empty neighbor cells instead of
      // wrapping. Simulate it: extend this cell (colspan) over following
      // empty, unmerged cells until the text fits.
      let spanCols = merge ? renderedColCount(c, merge.c2) : 1;
      let availW = 0;
      for (let k = i; k < Math.min(i + spanCols, cols.length); k++) availW += cols[k].width * fit;
      // Only left-aligned text spills rightward (Excel spills right-aligned
      // text the other way, so spreading it here would misplace the value).
      const effAlign = align.horizontal && align.horizontal !== 'fill'
        ? align.horizontal
        : (typeof ((cell.value as any)?.result !== undefined ? (cell.value as any).result : cell.value) === 'number' ? 'right' : 'left');
      if (!merge && text && !align.wrapText && effAlign === 'left') {
        const estW = text.length * fontPx * 0.58 + 10;
        let j = i + 1;
        while (availW < estW && j < cols.length && spanCols < 20) {
          const nb = cols[j];
          if (covered.has(`${r},${nb.c}`) || masters.has(`${r},${nb.c}`)) break;
          if (!nb.spacer && cellDisplayString(row.getCell(nb.c)) !== '') break;
          availW += nb.width * fit;
          spanCols++;
          j++;
        }
      }
      const spanRows = merge ? renderedRowCount(r, merge.r2) : 1;

      const css: string[] = ['box-sizing:border-box', `padding:${px(1)} ${px(2)}`];
      const gridColor = showGrid ? '#d8dbe0' : 'transparent';
      css.push(`border-top:${borderSide(border.top) || `1px solid ${gridColor}`}`);
      css.push(`border-left:${borderSide(border.left) || `1px solid ${gridColor}`}`);
      css.push(`border-bottom:${borderSide(border.bottom) || `1px solid ${gridColor}`}`);
      css.push(`border-right:${borderSide(border.right) || `1px solid ${gridColor}`}`);

      if (fill.type === 'pattern' && fill.pattern !== 'none') {
        const bg = argbToCss(fill.fgColor);
        if (bg) css.push(`background:${bg}`);
      }

      css.push(`font-size:${Math.round(fontPx * 10) / 10}px`);
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
      // Wrap at word boundaries only — never letter-by-letter — and keep every character.
      css.push('white-space:pre-wrap', 'overflow-wrap:break-word', 'line-height:normal');

      const spanAttr = `${spanRows > 1 ? ` rowspan="${spanRows}"` : ''}${spanCols > 1 ? ` colspan="${spanCols}"` : ''}`;
      html += `<td${spanAttr} style="${css.join(';')}">${escapeHtml(text)}</td>`;
      i += spanCols;
    }
    html += '</tr>';
  }
  html += '</table>';

  const totalDataRows = layout.range.r2 - layout.range.r1 + 1;
  const truncated = totalDataRows >= MAX_ROWS_PER_SHEET
    ? `<p style="font:italic 11px Arial;color:#888;margin:6px 0 0;">Showing the first ${MAX_ROWS_PER_SHEET} rows of data.</p>`
    : '';
  return html + truncated;
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
  // Drop trailing columns that hold no data in any row.
  let cols = Math.max(...rows.map(r => r.length));
  while (cols > 1 && rows.every(r => !(r[cols - 1] ?? '').trim())) cols--;
  let html = '<table style="border-collapse:collapse;width:100%;background:#fff;table-layout:fixed;">';
  rows.slice(0, MAX_ROWS_PER_SHEET).forEach((r, ri) => {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const isHeader = ri === 0;
      html += `<td style="border:1px solid #d8dbe0;padding:3px 6px;font:${isHeader ? 'bold ' : ''}11px Calibri,Arial,sans-serif;${isHeader ? 'background:#eef1f6;' : ''}white-space:pre-wrap;overflow-wrap:break-word;vertical-align:top;">${escapeHtml(r[c] ?? '')}</td>`;
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
        assertExpectedInput(file, {
          extensions: ['.xlsx', '.csv', '.xls'],
          label: 'a spreadsheet',
          counterpart: { extensions: ['.pdf'], toolName: 'PDF to Excel', does: 'turn PDF tables into a spreadsheet' },
        });
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

        // Only sheets — and within them, only the rows/columns — that actually
        // contain data. Formatting-only cells are excluded.
        const sheetInfos = workbook.worksheets
          .filter(s => s.state !== 'hidden' && s.state !== 'veryHidden')
          .map(sheet => {
            const merges = parseMerges(sheet);
            const range = getUsedRange(sheet, merges);
            if (!range) return null;
            const layout = buildLayout(sheet, range, merges);
            return layout ? { sheet, layout } : null;
          })
          .filter((x): x is { sheet: Worksheet; layout: SheetLayout } => x !== null);

        if (sheetInfos.length === 0) throw new Error('No data found in this workbook.');

        // Excel-style page setup: widest sheet decides portrait vs landscape,
        // then each sheet is fit-to-width for that orientation.
        const widest = Math.max(...sheetInfos.map(i => i.layout.naturalWidth));
        const orientation: 'portrait' | 'landscape' = widest > PORTRAIT_PX * 1.25 ? 'landscape' : 'portrait';
        const containerPx = (orientation === 'landscape' ? LANDSCAPE_PX : PORTRAIT_PX) - 32;

        const parts: string[] = [];
        for (const { sheet, layout } of sheetInfos) {
          const fit = Math.min(MAX_UPSCALE, containerPx / Math.max(layout.naturalWidth, 1));
          if (parts.length > 0) parts.push('<div style="height:24px;"></div>');
          if (sheetInfos.length > 1) {
            parts.push(`<div style="font:bold 13px Calibri,Arial,sans-serif;color:#333;background:#e9edf3;border:1px solid #cfd6df;border-bottom:0;display:inline-block;padding:5px 14px;border-radius:6px 6px 0 0;">${escapeHtml(sheet.name)}</div>`);
          }
          parts.push(sheetToHtml(sheet, layout, fit));
        }

        const html = `<div style="padding:16px;background:#fff;">${parts.join('')}</div>`;
        return htmlToPdfVisual(html, undefined, { orientation });
      }}
    />
  );
}
