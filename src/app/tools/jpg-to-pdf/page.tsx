'use client';

import ToolPage from '@/components/ToolPage';
import { jpgToPdf } from '@/lib/pdf-engine';

export default function JpgToPdfPage() {
  return (
    <ToolPage
      slug="jpg-to-pdf"
      multiple
      accept="image/jpeg,image/png,image/webp"
      processLabel="Convert to PDF"
      onProcess={async (files) => jpgToPdf(files)}
    />
  );
}
