'use client';

import { useState, useMemo, useCallback } from 'react';
import ToolPage from '@/components/ToolPage';
import PdfPreview from '@/components/PdfPreview';
import { extractPages, getPdfInfo } from '@/lib/pdf-engine';

export default function ExtractPagesPage() {
  const [pagesToExtract, setPagesToExtract] = useState('');
  const [pdfInfo, setPdfInfo] = useState<{ totalPages: number } | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files[0]) {
      setCurrentFile(files[0]);
      try {
        const info = await getPdfInfo(files[0]);
        setPdfInfo({ totalPages: info.pageCount });
      } catch {
        setPdfInfo(null);
      }
    }
  }, []);

  const parsePages = (input: string): number[] => {
    return input.split(',').map(p => parseInt(p.trim())).filter(n => !isNaN(n) && n > 0);
  };

  const extractedPages = useMemo(() => {
    if (!pdfInfo) return [];
    return parsePages(pagesToExtract).filter(p => p <= pdfInfo.totalPages);
  }, [pdfInfo, pagesToExtract]);

  return (
    <ToolPage
      slug="extract-pages"
      accept=".pdf"
      multiple={false}
      processLabel="Extract Pages"
      onFilesSelected={handleFilesSelected}
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
          {pdfInfo && (
            <p className="mt-2 text-xs text-muted-foreground">
              Total pages: {pdfInfo.totalPages} | Extracting: {extractedPages.length}
            </p>
          )}
          {currentFile && extractedPages.length > 0 && (
            <PdfPreview
              file={currentFile}
              pageNumbers={extractedPages}
              label="Preview of extracted pages:"
            />
          )}
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
