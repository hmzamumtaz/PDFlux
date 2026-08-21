'use client';

import ToolPage from '@/components/ToolPage';
import { htmlToPdf } from '@/lib/pdf-engine';

export default function ExcelToPdfPage() {
  return (
    <ToolPage
      slug="excel-to-pdf"
      accept=".xlsx,.xls,.csv"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const file = files[0];
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'csv') {
          const text = await file.text();
          const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return htmlToPdf(`<div style="font-family: 'Courier New', monospace; font-size: 10pt; padding: 30px 40px; white-space: pre-wrap; line-height: 1.4;">${escaped}</div>`);
        }

        // Parse XLSX/XLS with exceljs
        const ExcelJS = (await import('exceljs')).default;
        const buf = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buf);

        const sheetsHtml: string[] = [];

        workbook.eachSheet((sheet, sheetId) => {
          const rows: string[][] = [];
          const colCount = sheet.columnCount;
          const rowCount = sheet.rowCount;

          for (let r = 1; r <= Math.min(rowCount, 200); r++) {
            const row = sheet.getRow(r);
            const cells: string[] = [];
            for (let c = 1; c <= colCount; c++) {
              const cell = row.getCell(c);
              let val = '';
              if (cell.value !== null && cell.value !== undefined) {
                val = String(cell.value);
              }
              cells.push(val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
            }
            rows.push(cells);
          }

          if (rows.length === 0) {
            sheetsHtml.push(`<div style="margin-bottom: 30px;"><h3 style="font-family: Arial; font-size: 14pt; margin-bottom: 8px;">${sheet.name}</h3><p style="color: #999; font-family: Arial;">(empty sheet)</p></div>`);
            return;
          }

          const tableRows = rows.map((cells, ri) => {
            const isHeader = ri === 0;
            const tag = isHeader ? 'th' : 'td';
            const style = isHeader
              ? 'background: #2563eb; color: white; font-weight: bold; padding: 8px 12px; text-align: left; font-size: 10pt; border: 1px solid #ddd;'
              : 'padding: 6px 12px; font-size: 10pt; border: 1px solid #ddd; font-family: Arial;';
            const rowBg = !isHeader && ri % 2 === 0 ? ' background: #f8fafc;' : '';
            return `<tr>${cells.map(c => `<${tag} style="${style}${rowBg}">${c || '&nbsp;'}</${tag}>`).join('')}</tr>`;
          }).join('');

          sheetsHtml.push(`
            <div style="margin-bottom: 30px;">
              <h3 style="font-family: Arial; font-size: 14pt; margin-bottom: 8px; color: #1e40af;">${sheet.name}</h3>
              <table style="border-collapse: collapse; width: 100%; font-family: Arial;">${tableRows}</table>
            </div>
          `);
        });

        if (sheetsHtml.length === 0) {
          throw new Error('No sheets found in the spreadsheet.');
        }

        return htmlToPdf(`<div style="padding: 30px 40px;">${sheetsHtml.join('')}</div>`);
      }}
    />
  );
}
