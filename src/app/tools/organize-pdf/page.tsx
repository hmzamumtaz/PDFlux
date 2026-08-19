'use client';

import { useState, useMemo, useCallback } from 'react';
import ToolPage from '@/components/ToolPage';
import PdfPreview from '@/components/PdfPreview';
import { reorderPages, getPdfInfo } from '@/lib/pdf-engine';

export default function OrganizePdfPage() {
  const [order, setOrder] = useState('');
  const [pdfInfo, setPdfInfo] = useState<{ totalPages: number } | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files[0]) {
      setCurrentFile(files[0]);
      try {
        const info = await getPdfInfo(files[0]);
        setPdfInfo({ totalPages: info.pageCount });
        setOrder(Array.from({ length: info.pageCount }, (_, i) => i + 1).join(','));
      } catch {
        setPdfInfo(null);
      }
    }
  }, []);

  const parseOrder = (input: string): number[] => {
    return input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0);
  };

  const previewPages = useMemo(() => {
    if (!pdfInfo) return [];
    return parseOrder(order).filter(p => p <= pdfInfo.totalPages);
  }, [pdfInfo, order]);

  return (
    <ToolPage
      slug="organize-pdf"
      accept=".pdf"
      multiple={false}
      processLabel="Organize PDF"
      onFilesSelected={handleFilesSelected}
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Enter new page order (comma-separated, e.g., 3,1,2,4,5)
          </label>
          <input
            type="text"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="e.g., 3,1,2,4,5"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {pdfInfo && (
            <p className="mt-2 text-xs text-muted-foreground">
              Total pages: {pdfInfo.totalPages} | Reordered: {previewPages.length}
            </p>
          )}
          {currentFile && previewPages.length > 0 && (
            <PdfPreview
              file={currentFile}
              pageNumbers={previewPages}
              label="Preview in new order:"
            />
          )}
        </div>
      }
      onProcess={async (files) => {
        const parsed = parseOrder(order);
        if (parsed.length === 0) throw new Error('Please enter a page order');
        return reorderPages(files[0], parsed);
      }}
    />
  );
}
