'use client';

import { useState, useMemo, useCallback } from 'react';
import ToolPage from '@/components/ToolPage';
import PdfPreview from '@/components/PdfPreview';
import { removePagesFromFile, getPdfInfo, parsePageSpec } from '@/lib/pdf-engine';

export default function RemovePagesPage() {
  const [pagesToRemove, setPagesToRemove] = useState('');
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

  const remainingPages = useMemo(() => {
    if (!pdfInfo) return [];
    let remove: number[] = [];
    try {
      remove = parsePageSpec(pagesToRemove, pdfInfo.totalPages);
    } catch {
      // ignore while the user is still typing; onProcess reports real errors
    }
    return Array.from({ length: pdfInfo.totalPages }, (_, i) => i + 1).filter(p => !remove.includes(p));
  }, [pdfInfo, pagesToRemove]);

  return (
    <ToolPage
      slug="remove-pages"
      accept=".pdf"
      multiple={false}
      processLabel="Remove Pages"
      onFilesSelected={handleFilesSelected}
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
              Total pages: {pdfInfo.totalPages} | Remaining: {remainingPages.length}
            </p>
          )}
          {currentFile && remainingPages.length > 0 && remainingPages.length < (pdfInfo?.totalPages ?? 0) && (
            <PdfPreview
              file={currentFile}
              pageNumbers={remainingPages}
              label="Preview after removal:"
            />
          )}
        </div>
      }
      onProcess={async (files) => {
        const info = await getPdfInfo(files[0]);
        const pages = parsePageSpec(pagesToRemove, info.pageCount);
        if (pages.length === 0) throw new Error('Please enter pages to remove (e.g., 1, 3, 5-8)');
        return removePagesFromFile(files[0], pages);
      }}
    />
  );
}
