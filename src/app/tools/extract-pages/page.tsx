'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { extractPages } from '@/lib/pdf-engine';

export default function ExtractPagesPage() {
  const [pagesToExtract, setPagesToExtract] = useState<string>('');

  const parsePages = (input: string): number[] => {
    return input.split(',').map(p => parseInt(p.trim())).filter(n => !isNaN(n) && n > 0);
  };

  return (
    <ToolPage
      slug="extract-pages"
      accept=".pdf"
      processLabel="Extract Pages"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Pages to extract (comma-separated, e.g., 1, 3, 5)
          </label>
          <input
            type="text"
            value={pagesToExtract}
            onChange={(e) => setPagesToExtract(e.target.value)}
            placeholder="e.g., 1, 3, 5"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      }
      onProcess={async (files) => {
        const pages = parsePages(pagesToExtract);
        if (pages.length === 0) throw new Error('Please enter pages to extract');
        return extractPages(files[0], pages);
      }}
    />
  );
}
