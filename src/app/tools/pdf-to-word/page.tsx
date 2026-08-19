'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToMarkdown } from '@/lib/pdf-engine';

export default function PdfToWordPage() {
  return (
    <ToolPage
      slug="pdf-to-word"
      accept=".pdf"
      processLabel="Convert to Word"
      onProcess={async (files) => {
        const md = await pdfToMarkdown(files[0]);
        return new Blob([md], { type: 'text/markdown' });
      }}
    />
  );
}
