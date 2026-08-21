'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { redactPdf } from '@/lib/pdf-engine';

export default function RedactPdfPage() {
  const [redactions, setRedactions] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  return (
    <ToolPage
      slug="redact-pdf"
      accept=".pdf"
      processLabel="Redact PDF"
      options={
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Page index (0-based)</label>
            <input
              type="number"
              min="0"
              value={pageIndex}
              onChange={(e) => setPageIndex(parseInt(e.target.value) || 0)}
              className="w-full max-w-xs px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Redaction areas (x,y,width,height per line)
            </label>
            <textarea
              value={redactions}
              onChange={(e) => setRedactions(e.target.value)}
              rows={4}
              placeholder="50,100,200,30&#10;50,200,200,30"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
            />
            <p className="mt-1 text-xs text-muted-foreground">Format: x,y,width,height (one per line, in points; origin is the bottom-left corner)</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Redacted pages are flattened so the content underneath is permanently
              destroyed — not just covered by a black box.
            </p>
          </div>
        </div>
      }
      onProcess={async (files) => {
        const lines = redactions.trim().split('\n').filter(Boolean);
        const rects = lines.map(line => {
          const [x, y, width, height] = line.split(',').map(Number);
          return { x, y, width, height, pageIndex };
        });
        if (rects.length === 0) throw new Error('Please enter at least one redaction area');
        return redactPdf(files[0], rects);
      }}
    />
  );
}
