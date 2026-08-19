'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Download, Loader2, Check, AlertCircle, PenTool } from 'lucide-react';
import Link from 'next/link';
import { getToolBySlug } from '@/lib/tools-data';
import FileUpload from '@/components/FileUpload';
import { readFileAsArrayBuffer, loadPdf, downloadBlob } from '@/lib/pdf-engine';

export default function SignPdfPage() {
  const tool = getToolBySlug('sign-pdf');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureText, setSignatureText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const canvas = canvasRef.current;
      const sigDataUrl = hasDrawn && canvas ? canvas.toDataURL('image/png') : null;

      const buf = await readFileAsArrayBuffer(files[0]);
      const src = await loadPdf(buf);
      const { rgb } = await import('pdf-lib');
      const { StandardFonts } = await import('pdf-lib');

      const lastPage = src.getPage(src.getPageCount() - 1);
      const { width, height } = lastPage.getSize();

      if (sigDataUrl) {
        const imgBytes = await fetch(sigDataUrl).then(r => r.arrayBuffer());
        const img = await src.embedPng(imgBytes);
        lastPage.drawImage(img, {
          x: width - 200,
          y: 40,
          width: 150,
          height: 50,
        });
      } else if (signatureText) {
        const font = await src.embedFont(StandardFonts.HelveticaBold);
        lastPage.drawText(signatureText, {
          x: width - 200,
          y: 60,
          size: 16,
          font,
          color: rgb(0, 0, 0),
        });
      }

      const bytes = await src.save();
      downloadBlob(new Blob([bytes as any], { type: 'application/pdf' }), 'signed.pdf');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Failed to sign PDF');
    } finally {
      setProcessing(false);
    }
  }, [files, signatureText, hasDrawn]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to all tools
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Sign PDF</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Add a digital signature to your PDF document</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            files={files}
            onFilesSelected={(f) => { setFiles(f); setDone(false); setError(null); }}
            onRemoveFile={(i) => setFiles(prev => prev.filter((_, idx) => idx !== i))}
          />

          {files.length > 0 && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Draw your signature</label>
                <div className="border border-border rounded-xl p-2 bg-gray-50 inline-block">
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={100}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                    className="bg-white rounded-lg cursor-crosshair touch-none"
                    style={{ width: '300px', height: '100px' }}
                  />
                </div>
                <button onClick={clearCanvas} className="ml-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Clear
                </button>
              </div>

              <div className="text-xs text-muted-foreground">— OR type your name —</div>

              <input
                type="text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Type your name as signature"
                className="w-full max-w-sm px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                onClick={handleProcess}
                disabled={processing || done || (!hasDrawn && !signatureText)}
                className={`px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                  done ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg active:scale-[0.98]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> :
                 done ? <><Check className="w-4 h-4" /> Download Ready</> :
                 <><PenTool className="w-4 h-4" /> Sign & Download</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
