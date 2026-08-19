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
        const buf = await files[0].arrayBuffer();
        const text = new TextDecoder().decode(buf);
        return htmlToPdf(`<div style="font-family: Arial, sans-serif; padding: 40px;"><h1>Spreadsheet Content</h1><p>Note: CSV files are converted as text. For full Excel conversion, use a dedicated tool.</p><pre style="white-space: pre-wrap; font-size: 10px; background: #f5f5f5; padding: 20px; border-radius: 8px;">${text.substring(0, 5000)}</pre></div>`);
      }}
    />
  );
}
