'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { addPageNumbersToFile, PageNumberFormat } from '@/lib/pdf-engine';

export default function AddPageNumbersPage() {
  const [position, setPosition] = useState<'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'>('bottom-center');
  const [format, setFormat] = useState<PageNumberFormat>('n');
  const [startAt, setStartAt] = useState(1);

  return (
    <ToolPage
      slug="add-page-numbers"
      accept=".pdf"
      processLabel="Add Page Numbers"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Position</label>
          <div className="grid grid-cols-3 gap-2 max-w-xs">
            {(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  position === pos ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {pos.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-2">Format</label>
            <div className="flex flex-wrap gap-2">
              {([['n', '1'], ['page-n', 'Page 1'], ['n-of-m', '1 of N']] as [PageNumberFormat, string][]).map(([fmt, label]) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    format === fmt ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-2">Start numbering at</label>
            <input
              type="number"
              min="1"
              value={startAt}
              onChange={(e) => setStartAt(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      }
      onProcess={async (files) => addPageNumbersToFile(files[0], position, startAt, format)}
    />
  );
}
