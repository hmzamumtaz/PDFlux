'use client';

import ToolPage from '@/components/ToolPage';
import { wordToPdf } from '@/lib/pdf-engine';
import { assertExpectedInput } from '@/lib/input-guard';

export default function WordToPdfPage() {
  return (
    <ToolPage
      slug="word-to-pdf"
      accept=".docx"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        assertExpectedInput(files[0], { extensions: ['.docx'], label: 'a Word document', counterpart: { extensions: ['.pdf'], toolName: 'PDF to Word', does: 'turn a PDF into an editable document' } });
        return wordToPdf(files[0]);
      }}
    />
  );
}
