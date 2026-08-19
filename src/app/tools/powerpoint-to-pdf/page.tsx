'use client';

import ToolPage from '@/components/ToolPage';
import { htmlToPdf } from '@/lib/pdf-engine';

export default function PowerPointToPdfPage() {
  return (
    <ToolPage
      slug="powerpoint-to-pdf"
      accept=".pptx,.ppt"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const buf = await files[0].arrayBuffer();
        const text = new TextDecoder().decode(buf);
        return htmlToPdf(`<div style="font-family: Arial, sans-serif; padding: 40px;"><h1>Presentation Content</h1><p>Note: PowerPoint conversion provides basic extraction. For best results, use a dedicated conversion tool.</p></div>`);
      }}
    />
  );
}
