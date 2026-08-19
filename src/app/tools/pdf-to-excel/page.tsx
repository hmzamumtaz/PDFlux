'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToExcel } from '@/lib/pdf-engine';

export default function PdfToExcelPage() {
  return (
    <ToolPage
      slug="pdf-to-excel"
      accept=".pdf"
      processLabel="Convert to Excel"
      onProcess={async (files) => pdfToExcel(files[0])}
    />
  );
}
