'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { removePagesFromFile, getPdfInfo } from '@/lib/pdf-engine';

export default function RemovePagesPage() {
  const [pagesToRemove, setPagesToRemove] = useState<string>('');
  const [pdfInfo, setPdfInfo] = useState<{ totalPages: number } | null>(null);

  const parsePages = (input: string): number[] => {
    return input.split(',').map(p => parseInt(p.trim())).filter(n => !isNaN(n) && n > 0);
  };

  return (
    <ToolPage
      slug="remove-pages"
      accept=".pdf"
      processLabel="Remove Pages"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Pages to remove (comma-separated, e.g., 1, 3, 5-8)
          </label>
          <input
            type="text"
            value={pagesToRemove}
            onChange={(e) => setPagesToRemove(e.target.value)}
            placeholder="e.g., 1, 3, 5, 7"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {pdfInfo && (
            <p className="mt-2 text-xs text-muted-foreground">
              Total pages: {pdfInfo.totalPages}
            </p>
          )}
        </div>
      }
      onProcess={async (files) => {
        const pages = parsePages(pagesToRemove);
        if (pages.length === 0) throw new Error('Please enter pages to remove');
        return removePagesFromFile(files[0], pages);
      }}
    />
  );
}
