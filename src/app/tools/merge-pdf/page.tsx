'use client';

import ToolPage from '@/components/ToolPage';
import { mergePdfs } from '@/lib/pdf-engine';

export default function MergePdfPage() {
  return (
    <ToolPage
      slug="merge-pdf"
      multiple
      accept=".pdf"
      processLabel="Merge PDFs"
      onProcess={async (files) => mergePdfs(files)}
    />
  );
}
