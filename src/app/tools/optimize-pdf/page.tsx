'use client';

import ToolPage from '@/components/ToolPage';
import { compressPdf } from '@/lib/pdf-engine';

export default function OptimizePdfPage() {
  return (
    <ToolPage
      slug="optimize-pdf"
      accept=".pdf"
      processLabel="Optimize PDF"
      onProcess={async (files) => compressPdf(files[0])}
    />
  );
}
