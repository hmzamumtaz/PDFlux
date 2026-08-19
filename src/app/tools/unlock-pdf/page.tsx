'use client';

import ToolPage from '@/components/ToolPage';
import { unlockPdf } from '@/lib/pdf-engine';

export default function UnlockPdfPage() {
  return (
    <ToolPage
      slug="unlock-pdf"
      accept=".pdf"
      processLabel="Unlock PDF"
      onProcess={async (files) => unlockPdf(files[0])}
    />
  );
}
