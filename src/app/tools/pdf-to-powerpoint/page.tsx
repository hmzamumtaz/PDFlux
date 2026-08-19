'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToMarkdown } from '@/lib/pdf-engine';

export default function PdfToPowerpointPage() {
  return (
    <ToolPage
      slug="pdf-to-powerpoint"
      accept=".pdf"
      processLabel="Convert to PowerPoint"
      onProcess={async (files) => {
        const md = await pdfToMarkdown(files[0]);
        return new Blob([md], { type: 'text/markdown' });
      }}
    />
  );
}
