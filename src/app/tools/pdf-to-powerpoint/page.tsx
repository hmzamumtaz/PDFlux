'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToPowerpoint } from '@/lib/pdf-engine';

export default function PdfToPowerpointPage() {
  return (
    <ToolPage
      slug="pdf-to-powerpoint"
      accept=".pdf"
      processLabel="Convert to PowerPoint"
      onProcess={async (files) => pdfToPowerpoint(files[0])}
    />
  );
}
