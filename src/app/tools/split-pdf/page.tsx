'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { splitPdf } from '@/lib/pdf-engine';
import { getPdfInfo } from '@/lib/pdf-engine';

export default function SplitPdfPage() {
  const [pdfInfo, setPdfInfo] = useState<{ totalPages: number } | null>(null);
  const [ranges, setRanges] = useState<string>('1-1');
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (files[0]) {
      setCurrentFile(files[0]);
      try {
        const info = await getPdfInfo(files[0]);
        setPdfInfo({ totalPages: info.pageCount });
        setRanges(`1-${info.pageCount}`);
      } catch {
        setPdfInfo(null);
      }
    }
  };

  const parseRanges = (input: string): { start: number; end: number }[] => {
    return input.split(',').map(part => {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        return { start, end };
      }
      const num = Number(trimmed);
      return { start: num, end: num };
    }).filter(r => !isNaN(r.start) && !isNaN(r.end));
  };

  return (
    <ToolPage
      slug="split-pdf"
      accept=".pdf"
      processLabel="Split PDF"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Page ranges (e.g., 1-3, 5, 7-10)
          </label>
          <input
            type="text"
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="1-3, 5, 7-10"
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
        const parsed = parseRanges(ranges);
        if (parsed.length === 0) throw new Error('Please enter valid page ranges');
        const results = await splitPdf(files[0], parsed);
        return results;
      }}
    />
  );
}
