'use client';

import { useState, useCallback } from 'react';
import ToolPage from '@/components/ToolPage';
import { pdfToImages, downloadBlob } from '@/lib/pdf-engine';

export default function PdfToJpgPage() {
  return (
    <ToolPage
      slug="pdf-to-jpg"
      accept=".pdf"
      processLabel="Convert to JPG"
      onProcess={async (files) => {
        const images = await pdfToImages(files[0]);
        images.forEach((blob, i) => {
          downloadBlob(blob, `page_${i + 1}.jpg`);
        });
        return images[0];
      }}
    />
  );
}
