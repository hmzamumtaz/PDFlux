'use client';

import { useEffect, useState, useRef } from 'react';
import { renderPdfPages } from '@/lib/pdf-engine';
import { Loader2 } from 'lucide-react';

interface PdfPreviewProps {
  file: File;
  pageNumbers: number[];
  label?: string;
}

export default function PdfPreview({ file, pageNumbers, label }: PdfPreviewProps) {
  const [pages, setPages] = useState<{ page: number; url: string; width: number; height: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const prevKey = useRef('');

  useEffect(() => {
    const key = `${file.name}-${file.size}-${pageNumbers.join(',')}`;
    if (key === prevKey.current || pageNumbers.length === 0) return;
    prevKey.current = key;

    let cancelled = false;
    setLoading(true);
    renderPdfPages(file, pageNumbers).then(result => {
      if (!cancelled) {
        setPages(result);
        setLoading(false);
      }
    }).catch(() => {
      // Allow a retry on the next render instead of permanently blanking out.
      prevKey.current = '';
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [file, pageNumbers]);

  if (pageNumbers.length === 0) return null;

  return (
    <div className="mt-4">
      {label && (
        <p className="text-xs font-medium text-muted-foreground mb-3">{label}</p>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Rendering preview...</span>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pages.map(p => (
            <div key={p.page} className="shrink-0 text-center">
              <div className="border border-border rounded-lg overflow-hidden shadow-sm bg-white">
                <img
                  src={p.url}
                  alt={`Page ${p.page}`}
                  className="block"
                  style={{ width: 120, height: 160, objectFit: 'contain' }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">Page {p.page}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
