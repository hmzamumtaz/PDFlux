'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToMarkdown } from '@/lib/pdf-engine';

export default function PdfToExcelPage() {
  return (
    <ToolPage
      slug="pdf-to-excel"
      accept=".pdf"
      processLabel="Convert to Excel"
      onProcess={async (files) => {
        const md = await pdfToMarkdown(files[0]);
        return new Blob([md], { type: 'text/markdown' });
      }}
    />
  );
}
