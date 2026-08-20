'use client';

import ToolPage from '@/components/ToolPage';
import { mergePdfs } from '@/lib/pdf-engine';

export default function MergePdfPage() {
  return (
    <ToolPage
      slug="merge-pdf"
      accept=".pdf"
      processLabel="Merge PDFs"
      processAllTogether
      minFiles={2}
      minFilesMessage="Upload at least 2 PDF files to merge them together."
      onProcess={async (files) => mergePdfs(files)}
    />
  );
}
