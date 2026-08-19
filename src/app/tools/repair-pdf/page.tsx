'use client';

import ToolPage from '@/components/ToolPage';
import { compressPdf } from '@/lib/pdf-engine';

export default function RepairPdfPage() {
  return (
    <ToolPage
      slug="repair-pdf"
      accept=".pdf"
      processLabel="Repair PDF"
      onProcess={async (files) => compressPdf(files[0])}
    />
  );
}
