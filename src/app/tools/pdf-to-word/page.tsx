'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToMarkdown, downloadBlob } from '@/lib/pdf-engine';

export default function PdfToWordPage() {
  return (
    <ToolPage
      slug="pdf-to-word"
      accept=".pdf"
      processLabel="Convert to Text"
      onProcess={async (files) => {
        const md = await pdfToMarkdown(files[0]);
        const blob = new Blob([md], { type: 'text/markdown' });
        downloadBlob(blob, 'converted.md');
        return blob;
      }}
    />
  );
}
