'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToWord } from '@/lib/pdf-engine';

export default function PdfToWordPage() {
  return (
    <ToolPage
      slug="pdf-to-word"
      accept=".pdf"
      processLabel="Convert to Word"
      onProcess={async (files) => pdfToWord(files[0])}
    />
  );
}
