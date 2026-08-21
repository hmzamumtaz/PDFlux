'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToWord } from '@/lib/pdf-engine';
import { assertExpectedInput } from '@/lib/input-guard';

export default function PdfToWordPage() {
  return (
    <ToolPage
      slug="pdf-to-word"
      accept=".pdf"
      processLabel="Convert to Word"
      onProcess={async (files) => {
        assertExpectedInput(files[0], { extensions: ['.pdf'], label: 'a PDF', counterpart: { extensions: ['.docx', '.doc'], toolName: 'Word to PDF', does: 'turn a document into a PDF' } });
        return pdfToWord(files[0]);
      }}
    />
  );
}
