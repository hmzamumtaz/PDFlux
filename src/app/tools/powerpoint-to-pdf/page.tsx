'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { renderPptxToPdf } from '@/lib/pptx-render';

export default function PowerPointToPdfPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  return (
    <ToolPage
      slug="powerpoint-to-pdf"
      accept=".pptx"
      processLabel="Convert to PDF"
      options={
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Each slide is redrawn on a white page at its original size — text with
            its real position, size and colour, plus pictures, tables and grouped
            shapes.
          </p>
          {status && <p className="text-xs font-medium text-blue-600">{status}</p>}
          {summary && <p className="text-xs font-medium text-green-600">{summary}</p>}
        </div>
      }
      onProcess={async (files) => {
        setSummary(null);
        const res = await renderPptxToPdf(files[0], (s, t) => setStatus(`Rendering slide ${s} of ${t}...`));
        setStatus(null);
        setSummary(`Converted ${res.slides} slide${res.slides === 1 ? '' : 's'}${res.images > 0 ? ` including ${res.images} image${res.images === 1 ? '' : 's'}` : ''}.`);
        return new Blob([res.bytes as unknown as BlobPart], { type: 'application/pdf' });
      }}
    />
  );
}
