'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { compressPdf } from '@/lib/pdf-engine';

export default function OcrPdfPage() {
  return (
    <ToolPage
      slug="ocr-pdf"
      accept=".pdf"
      processLabel="Process OCR"
      onProcess={async (files) => {
        return compressPdf(files[0]);
      }}
    />
  );
}
