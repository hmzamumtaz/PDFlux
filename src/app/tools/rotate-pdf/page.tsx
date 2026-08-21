'use client';

import ToolPage from '@/components/ToolPage';
import { rotatePages, getPdfInfo, parsePageSpec } from '@/lib/pdf-engine';
import { useState } from 'react';

export default function RotatePdfPage() {
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [allPages, setAllPages] = useState(true);
  const [pageInput, setPageInput] = useState('');

  return (
    <ToolPage
      slug="rotate-pdf"
      accept=".pdf"
      processLabel="Rotate PDF"
      options={
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Rotation angle</label>
            <div className="flex gap-2">
              {[90, 180, 270].map((a) => (
                <button
                  key={a}
                  onClick={() => setAngle(a as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    angle === a ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Apply to</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAllPages(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  allPages ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All pages
              </button>
              <button
                onClick={() => setAllPages(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !allPages ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Specific pages
              </button>
            </div>
          </div>
          {!allPages && (
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="e.g., 1, 3, 5-8"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          )}
        </div>
      }
      onProcess={async (files) => {
        const info = await getPdfInfo(files[0]);
        const totalPages = info.pageCount;
        const pages = allPages
          ? Array.from({ length: totalPages }, (_, i) => i + 1)
          : parsePageSpec(pageInput, totalPages);
        if (pages.length === 0) throw new Error('No valid pages selected (e.g., 1, 3, 5-8)');
        return rotatePages(files[0], pages, angle);
      }}
    />
  );
}
