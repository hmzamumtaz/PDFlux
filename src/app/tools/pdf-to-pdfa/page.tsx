'use client';

import ToolPage from '@/components/ToolPage';
import { convertToPdfA } from '@/lib/pdf-engine';

export default function PdfToPdfAPage() {
  return (
    <ToolPage
      slug="pdf-to-pdfa"
      accept=".pdf"
      processLabel="Convert to PDF/A"
      onProcess={async (files) => convertToPdfA(files[0])}
    />
  );
}
