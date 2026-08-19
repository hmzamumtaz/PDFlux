'use client';

import ToolPage from '@/components/ToolPage';
import { pdfToImages } from '@/lib/pdf-engine';

export default function PdfToJpgPage() {
  return (
    <ToolPage
      slug="pdf-to-jpg"
      accept=".pdf"
      processLabel="Convert to JPG"
      onProcess={async (files) => {
        const images = await pdfToImages(files[0]);
        return images;
      }}
    />
  );
}
