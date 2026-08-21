'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, FileText, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { renderPdfPreviews, type PagePreview } from '@/lib/pdf-engine';

type Result = Blob | Blob[];

interface LivePreviewModalProps {
  open: boolean;
  onClose: () => void;
  toolName: string;
  /** Runs the tool exactly as the download button would, with current settings. */
  run: () => Promise<Result>;
  /** Bumped whenever the user changes a setting, so the preview re-runs. */
  version: number;
}

const FRIENDLY: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document (.docx)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel workbook (.xlsx)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint deck (.pptx)',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function LivePreviewModal({ open, onClose, toolName, run, version }: LivePreviewModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [text, setText] = useState<string | null>(null);
  const [info, setInfo] = useState<{ kind: string; size: number } | null>(null);
  const [current, setCurrent] = useState(0);
  const runToken = useRef(0);
  const objectUrls = useRef<string[]>([]);

  const releaseUrls = () => {
    objectUrls.current.forEach(u => URL.revokeObjectURL(u));
    objectUrls.current = [];
  };

  const build = useCallback(async () => {
    const token = ++runToken.current;
    setBusy(true);
    setError(null);
    try {
      const result = await run();
      if (token !== runToken.current) return; // a newer run superseded this one
      const blobs = Array.isArray(result) ? result : [result];
      const first = blobs[0];
      if (!first) throw new Error('Nothing to preview.');

      releaseUrls();
      setPages([]); setImageUrls([]); setText(null); setInfo(null); setCurrent(0);

      const type = first.type || '';
      if (type === 'application/pdf') {
        const file = new File([first], 'preview.pdf', { type: 'application/pdf' });
        const rendered = await renderPdfPreviews(file, { scale: 1.6, maxPages: 25 });
        if (token !== runToken.current) return;
        setPages(rendered);
        setInfo({ kind: `PDF · ${rendered.length} page${rendered.length === 1 ? '' : 's'}`, size: first.size });
      } else if (type.startsWith('image/')) {
        const urls = blobs.slice(0, 25).map(b => {
          const u = URL.createObjectURL(b);
          objectUrls.current.push(u);
          return u;
        });
        setImageUrls(urls);
        setInfo({ kind: `${blobs.length} image${blobs.length === 1 ? '' : 's'}`, size: blobs.reduce((a, b) => a + b.size, 0) });
      } else if (type.startsWith('text/')) {
        const content = await first.text();
        if (token !== runToken.current) return;
        setText(content.slice(0, 20000));
        setInfo({ kind: 'Text', size: first.size });
      } else {
        setInfo({ kind: FRIENDLY[type] || 'File', size: first.size });
      }
    } catch (err: unknown) {
      if (token !== runToken.current) return;
      setError(err instanceof Error ? err.message : 'Could not build a preview with these settings.');
    } finally {
      if (token === runToken.current) setBusy(false);
    }
  }, [run]);

  // Re-run when opened and whenever a setting changes, debounced so dragging a
  // slider doesn't queue a conversion per pixel.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(build, 350);
    return () => clearTimeout(t);
  }, [open, version, build]);

  useEffect(() => {
    if (!open) { runToken.current++; releaseUrls(); }
  }, [open]);

  useEffect(() => () => releaseUrls(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  const total = pages.length || imageUrls.length;
  const hasVisual = total > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose} role="dialog" aria-modal="true" aria-label={`${toolName} live preview`}>
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">Live preview — {toolName}</h2>
            <p className="text-xs text-muted-foreground">
              {busy ? 'Applying your current settings…' : info ? `${info.kind} · ${formatSize(info.size)}` : 'Updates as you change settings'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={build} disabled={busy}
              className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Refresh preview">
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 min-h-[320px] max-h-[70vh] overflow-y-auto bg-gray-50/70 rounded-b-2xl">
          {busy && !hasVisual && !text && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Building preview…</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!error && pages.length > 0 && (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pages[Math.min(current, pages.length - 1)].url} alt={`Page ${current + 1}`}
                className="max-w-full h-auto border border-border rounded-lg shadow-sm bg-white" />
              {pages.length > 1 && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0}
                    className="p-2 rounded-lg border border-border bg-white hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs text-muted-foreground tabular-nums">Page {current + 1} / {pages.length}</span>
                  <button onClick={() => setCurrent(i => Math.min(pages.length - 1, i + 1))} disabled={current === pages.length - 1}
                    className="p-2 rounded-lg border border-border bg-white hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          )}

          {!error && imageUrls.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imageUrls.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt={`Output ${i + 1}`} className="w-full h-auto border border-border rounded-lg bg-white" />
              ))}
            </div>
          )}

          {!error && text !== null && (
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-white border border-border rounded-lg p-4">
              {text}{text.length >= 20000 && '\n\n… (truncated)'}
            </pre>
          )}

          {!error && !busy && !hasVisual && text === null && info && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{info.kind} ready — {formatSize(info.size)}</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                This format can&apos;t be shown in the browser. Close the preview and download it to open in its app.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
