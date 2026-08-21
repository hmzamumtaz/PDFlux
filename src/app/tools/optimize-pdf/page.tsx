'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { optimizePdf } from '@/lib/pdf-engine';

export default function OptimizePdfPage() {
  const [stripMetadata, setStripMetadata] = useState(false);
  const [lastSaving, setLastSaving] = useState<string | null>(null);

  return (
    <ToolPage
      slug="optimize-pdf"
      accept=".pdf"
      processLabel="Optimize PDF"
      options={
        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={stripMetadata}
              onChange={(e) => setStripMetadata(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-foreground">Remove document metadata (title, author, etc.)</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Losslessly rebuilds the PDF with compressed object streams and discards
            unused objects and old revisions. Text stays selectable and images untouched.
          </p>
          {lastSaving && (
            <p className="text-xs font-medium text-green-600">{lastSaving}</p>
          )}
        </div>
      }
      onProcess={async (files) => {
        const res = await optimizePdf(files[0], { stripMetadata });
        setLastSaving(
          res.savedBytes > 0
            ? `Saved ${(res.savedBytes / 1024).toFixed(1)} KB (${res.savedPercent}% smaller).`
            : 'This PDF is already optimally packed — returned unchanged. For bigger reductions try the Compress PDF tool.'
        );
        return res.blob;
      }}
    />
  );
}
