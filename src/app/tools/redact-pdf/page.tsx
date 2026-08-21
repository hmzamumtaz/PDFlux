'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, FileDown, Eraser, Undo2, Trash2, ChevronLeft, ChevronRight, MousePointerSquareDashed } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { renderPdfPreviews, redactPdf, downloadBlob, getOutputFilename, type PagePreview } from '@/lib/pdf-engine';

/** A drawn box, stored in PDF points with a bottom-left origin. */
interface Box { pageIndex: number; x: number; y: number; width: number; height: number }

const MIN_BOX_PX = 4;

export default function RedactPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [current, setCurrent] = useState(0);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneSize, setDoneSize] = useState<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const page = pages[current];
  const pageBoxes = boxes.filter(b => b.pageIndex === current);

  const reset = useCallback(() => {
    setFiles([]); setPages([]); setBoxes([]); setCurrent(0);
    setError(null); setDoneSize(null); setDrag(null);
  }, []);

  const handleFiles = useCallback(async (selected: File[]) => {
    if (selected.length === 0) return;
    setFiles([selected[0]]);
    setBoxes([]); setCurrent(0); setError(null); setDoneSize(null);
    setLoading(true);
    setLoadMsg('Loading pages...');
    try {
      const previews = await renderPdfPreviews(selected[0], { scale: 2 }, (p, t) => setLoadMsg(`Rendering page ${p} of ${t}...`));
      setPages(previews);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open this PDF.');
    } finally {
      setLoading(false);
      setLoadMsg('');
    }
  }, []);

  // Pointer position relative to the page image, clamped inside it.
  const relPos = (e: React.PointerEvent) => {
    const el = surfaceRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!page || doneSize !== null) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = relPos(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = relPos(e);
    setDrag(d => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };

  const onPointerUp = () => {
    if (!drag || !page || !surfaceRef.current) { setDrag(null); return; }
    const r = surfaceRef.current.getBoundingClientRect();
    const left = Math.min(drag.x0, drag.x1);
    const top = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < MIN_BOX_PX || h < MIN_BOX_PX) return; // ignore stray clicks

    // Screen pixels → PDF points. The PDF origin is bottom-left, the DOM's is top-left.
    const sx = page.pointWidth / r.width;
    const sy = page.pointHeight / r.height;
    setBoxes(prev => [...prev, {
      pageIndex: current,
      x: left * sx,
      y: page.pointHeight - (top + h) * sy,
      width: w * sx,
      height: h * sy,
    }]);
  };

  // Keyboard: Ctrl/Cmd+Z undoes the last box on this page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setBoxes(prev => {
          const idx = [...prev].reverse().findIndex(b => b.pageIndex === current);
          if (idx === -1) return prev;
          const realIdx = prev.length - 1 - idx;
          return prev.filter((_, i) => i !== realIdx);
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  const handleRedact = useCallback(async () => {
    if (!files[0] || boxes.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const blob = await redactPdf(files[0], boxes);
      downloadBlob(blob, getOutputFilename('redact-pdf', '.pdf'));
      setDoneSize(blob.size);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Redaction failed.');
    } finally {
      setProcessing(false);
    }
  }, [files, boxes]);

  const dragRect = drag && {
    left: Math.min(drag.x0, drag.x1),
    top: Math.min(drag.y0, drag.y1),
    width: Math.abs(drag.x1 - drag.x0),
    height: Math.abs(drag.y1 - drag.y0),
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-50"><Eraser className="w-6 h-6 text-red-500" /></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Redact PDF</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Drag black boxes over anything you want permanently removed</p>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <FileUpload accept=".pdf" multiple={false} files={files} onFilesSelected={handleFiles} />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Page canvas */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border p-4 sm:p-6 shadow-sm">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{loadMsg}</p>
                </div>
              ) : page ? (
                <>
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <p className="text-sm font-medium text-foreground truncate">{files[0].name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0}
                        className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Previous page">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-muted-foreground font-medium tabular-nums">Page {current + 1} / {pages.length}</span>
                      <button onClick={() => setCurrent(i => Math.min(pages.length - 1, i + 1))} disabled={current === pages.length - 1}
                        className="p-2 rounded-lg border border-border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Next page">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={surfaceRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => setDrag(null)}
                    className={`relative select-none touch-none mx-auto border border-border rounded-lg overflow-hidden shadow-sm ${doneSize === null ? 'cursor-crosshair' : 'cursor-default'}`}
                    style={{ width: 'fit-content', maxWidth: '100%' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.url} alt={`Page ${current + 1}`} draggable={false}
                      className="block max-w-full h-auto pointer-events-none" />

                    {/* Positioned in percentages so the overlay stays aligned
                        at any zoom or window size, with no layout reads. */}
                    {pageBoxes.map((b, i) => (
                      <div key={i} className="absolute bg-black" style={{
                        left: `${(b.x / page.pointWidth) * 100}%`,
                        top: `${((page.pointHeight - b.y - b.height) / page.pointHeight) * 100}%`,
                        width: `${(b.width / page.pointWidth) * 100}%`,
                        height: `${(b.height / page.pointHeight) * 100}%`,
                      }} />
                    ))}

                    {dragRect && (
                      <div className="absolute bg-black/70 border-2 border-dashed border-white/70 pointer-events-none"
                        style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }} />
                    )}
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <MousePointerSquareDashed className="w-3.5 h-3.5" />
                    Click and drag over any text or image to black it out. Press Ctrl/Cmd+Z to undo.
                  </p>
                </>
              ) : null}
            </div>

            {/* Controls */}
            <div className="w-full lg:w-80 shrink-0">
              <div className="lg:sticky lg:top-8 space-y-4">
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      {boxes.length} redaction{boxes.length === 1 ? '' : 's'}
                    </h3>
                    {boxes.length > 0 && doneSize === null && (
                      <button onClick={() => setBoxes([])} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Clear all
                      </button>
                    )}
                  </div>

                  {boxes.length === 0 ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Nothing marked yet. Drag a box over the page to cover sensitive
                      information — names, numbers, signatures, anything.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {boxes.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 border border-border rounded-lg px-3 py-2">
                          <span className="w-3 h-3 bg-black rounded-sm shrink-0" />
                          <span className="flex-1 text-muted-foreground">
                            Page {b.pageIndex + 1} · {Math.round(b.width)}×{Math.round(b.height)} pt
                          </span>
                          {doneSize === null && (
                            <button onClick={() => setBoxes(prev => prev.filter((_, k) => k !== i))}
                              className="text-muted-foreground hover:text-destructive transition-colors" title="Remove">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {boxes.length > 0 && doneSize === null && (
                    <button onClick={() => setBoxes(prev => prev.slice(0, -1))}
                      className="w-full px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
                      <Undo2 className="w-3.5 h-3.5" /> Undo last box
                    </button>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                    Redacted pages are flattened, so the content underneath is
                    permanently destroyed — not just hidden behind a black box.
                  </p>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{error}</p>
                    </div>
                  )}

                  {doneSize !== null ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-green-800"><span className="font-semibold">Redacted PDF downloaded</span> ({(doneSize / 1024).toFixed(1)} KB).</p>
                      </div>
                      <button onClick={reset} className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors">
                        Redact another PDF
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleRedact} disabled={processing || boxes.length === 0}
                      className="w-full px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white hover:shadow-lg hover:shadow-red-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none">
                      {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Redacting...</> : <><FileDown className="w-4 h-4" /> Apply & Download</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
