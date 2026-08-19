'use client';

import ToolPage from '@/components/ToolPage';
import { wordToPdf } from '@/lib/pdf-engine';

export default function WordToPdfPage() {
  return (
    <ToolPage
      slug="word-to-pdf"
      accept=".doc,.docx"
      processLabel="Convert to PDF"
      onProcess={async (files) => wordToPdf(files[0])}
    />
  );
}
