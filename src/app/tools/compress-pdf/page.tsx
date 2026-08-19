'use client';

import ToolPage from '@/components/ToolPage';
import { compressPdf } from '@/lib/pdf-engine';

export default function CompressPdfPage() {
  return (
    <ToolPage
      slug="compress-pdf"
      accept=".pdf"
      processLabel="Compress PDF"
      onProcess={async (files) => compressPdf(files[0])}
    />
  );
}
