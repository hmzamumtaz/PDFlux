'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToMarkdown, downloadBlob } from '@/lib/pdf-engine';

export default function PdfToExcelPage() {
  return (
    <ToolPage
      slug="pdf-to-excel"
      accept=".pdf"
      processLabel="Extract Tables"
      onProcess={async (files) => {
        const md = await pdfToMarkdown(files[0]);
        const blob = new Blob([md], { type: 'text/markdown' });
        downloadBlob(blob, 'extracted_tables.md');
        return blob;
      }}
    />
  );
}
