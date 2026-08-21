'use client';

import ToolPage from '@/components/ToolPage';

export default function ExcelToPdfPage() {
  return (
    <ToolPage
      slug="excel-to-pdf"
      accept=".xlsx,.xls,.csv"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const file = files[0];
        const ext = file.name.split('.').pop()?.toLowerCase();
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

        if (ext === 'csv') {
          const text = await file.text();
          const lines = text.split('\n');
          const pdf = await PDFDocument.create();
          const font = await pdf.embedFont(StandardFonts.Courier);
          const A4_W = 595.28;
          const A4_H = 841.89;
          const MARGIN = 40;
          const LINE_H = 11;
          const COL_W = 90;

          let page = pdf.addPage([A4_W, A4_H]);
          let cursorY = A4_H - MARGIN;

          for (const line of lines) {
            if (cursorY < MARGIN + LINE_H) {
              page = pdf.addPage([A4_W, A4_H]);
              cursorY = A4_H - MARGIN;
            }
            page.drawText(line.substring(0, 100), {
              x: MARGIN,
              y: cursorY,
              size: 8,
              font,
              color: rgb(0.1, 0.1, 0.1),
            });
            cursorY -= LINE_H;
          }

          const bytes = await pdf.save();
          return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        }

        // Parse XLSX with exceljs
        const ExcelJS = (await import('exceljs')).default;
        const buf = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buf);

        const A4_W = 595.28;
        const A4_H = 841.89;
        const MARGIN_LEFT = 36;
        const MARGIN_RIGHT = 36;
        const MARGIN_TOP = 50;
        const MARGIN_BOTTOM = 40;
        const USABLE_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT;
        const ROW_H = 16;
        const HEADER_H = 20;

        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

        workbook.eachSheet((sheet, sheetId) => {
          const rowCount = sheet.rowCount;
          const colCount = sheet.columnCount;
          if (rowCount === 0 || colCount === 0) return;

          // Calculate column widths based on content
          const colWidths: number[] = [];
          const maxCols = Math.min(colCount, 20); // Cap columns
          for (let c = 1; c <= maxCols; c++) {
            let maxW = 30; // minimum width
            const col = sheet.getColumn(c);
            col.eachCell({ includeEmpty: false }, (cell) => {
              const val = cell.value ? String(cell.value) : '';
              const w = font.widthOfTextAtSize(val.substring(0, 30), 8);
              if (w > maxW) maxW = w;
            });
            colWidths.push(Math.min(maxW + 12, USABLE_W / maxCols));
          }

          // Normalize to fit page
          const totalW = colWidths.reduce((a, b) => a + b, 0);
          if (totalW > USABLE_W) {
            const scale = USABLE_W / totalW;
            for (let i = 0; i < colWidths.length; i++) colWidths[i] *= scale;
          }

          let page = pdf.addPage([A4_W, A4_H]);
          let cursorY = A4_H - MARGIN_TOP;

          // Sheet title
          page.drawText(sheet.name, {
            x: MARGIN_LEFT,
            y: cursorY,
            size: 14,
            font: fontBold,
            color: rgb(0.15, 0.25, 0.5),
          });
          cursorY -= 24;

          // Draw rows
          const maxRows = Math.min(rowCount, 500); // Cap rows
          for (let r = 1; r <= maxRows; r++) {
            const row = sheet.getRow(r);
            const isHeader = r === 1;

            if (cursorY - ROW_H < MARGIN_BOTTOM) {
              page = pdf.addPage([A4_W, A4_H]);
              cursorY = A4_H - MARGIN_TOP;
            }

            let x = MARGIN_LEFT;
            for (let c = 0; c < maxCols; c++) {
              const cell = row.getCell(c + 1);
              let val = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';

              const cellW = colWidths[c];
              const cellFont = isHeader ? fontBold : font;
              const fontSize = 8;

              // Draw cell background
              if (isHeader) {
                page.drawRectangle({
                  x, y: cursorY - 4,
                  width: cellW, height: HEADER_H,
                  color: rgb(0.15, 0.25, 0.5),
                });
              } else if (r % 2 === 0) {
                page.drawRectangle({
                  x, y: cursorY - 4,
                  width: cellW, height: ROW_H,
                  color: rgb(0.96, 0.97, 0.98),
                });
              }

              // Draw cell border
              page.drawRectangle({
                x, y: cursorY - 4,
                width: cellW, height: isHeader ? HEADER_H : ROW_H,
                borderColor: rgb(0.82, 0.84, 0.88),
                borderWidth: 0.4,
              });

              // Truncate text to fit cell, strip newlines and non-Latin chars
              let displayVal = val.replace(/[\r\n]+/g, ' ').replace(/[\u{1F000}-\u{1FFFF}]/gu, '?').replace(/[^\x20-\x7E\xA0-\xFF]/g, c => {
                const code = c.charCodeAt(0);
                if (code >= 0x20 && code <= 0x7E) return c;
                if (code >= 0xA0 && code <= 0xFF) return c;
                if (code === 0x2013 || code === 0x2014) return '-';
                if (code === 0x2026) return '...';
                return '';
              });
              while (displayVal && cellFont.widthOfTextAtSize(displayVal, fontSize) > cellW - 6 && displayVal.length > 1) {
                displayVal = displayVal.slice(0, -1);
              }
              if (displayVal !== val) displayVal += '\u2026';

              const textColor = isHeader ? rgb(1, 1, 1) : rgb(0.1, 0.1, 0.1);
              page.drawText(displayVal, {
                x: x + 3,
                y: cursorY + 1,
                size: fontSize,
                font: cellFont,
                color: textColor,
                maxWidth: cellW - 6,
              });

              x += cellW;
            }

            cursorY -= isHeader ? HEADER_H : ROW_H;
          }

          // Sheet footer
          page.drawText(`Sheet: ${sheet.name} | Rows: ${Math.min(rowCount, maxRows)}${rowCount > maxRows ? ` (showing first ${maxRows})` : ''}`, {
            x: MARGIN_LEFT,
            y: MARGIN_BOTTOM - 10,
            size: 7,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });
        });

        if (pdf.getPageCount() === 0) {
          const page = pdf.addPage([A4_W, A4_H]);
          const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
          page.drawText('No data found in spreadsheet.', {
            x: MARGIN_LEFT,
            y: A4_H - MARGIN_TOP,
            size: 12,
            font: fontRegular,
            color: rgb(0.4, 0.4, 0.4),
          });
        }

        const bytes = await pdf.save();
        return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      }}
    />
  );
}
