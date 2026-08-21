'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, Check, AlertCircle, PenTool, Type, Upload, AlertTriangle, X, FileImage } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { readFileAsArrayBuffer, loadPdf, downloadBlob, scanPdfForSigning, getOutputFilename, type FooterWhitespaceResult, type SignPageScan } from '@/lib/pdf-engine';

type SigType = 'draw' | 'type' | 'upload';

type PageInfo = SignPageScan;

const MIN_SIGN_WIDTH = 120;
const MIN_SIGN_HEIGHT = 30;

export default function SignPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [sigType, setSigType] = useState<SigType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draw state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Type state
  const [signatureText, setSignatureText] = useState('');

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warning state
  const [whitespaceWarning, setWhitespaceWarning] = useState<FooterWhitespaceResult | null>(null);
  const [forceSign, setForceSign] = useState(false);

  // Scan pages when file is uploaded
  useEffect(() => {
    if (files.length === 0) { setPages([]); setSelectedPage(null); return; }

    let cancelled = false;
    const scan = async () => {
      setScanning(true);
      setScanProgress('Analyzing pages...');
      try {
        const pageInfos = await scanPdfForSigning(
          files[0],
          MIN_SIGN_WIDTH,
          MIN_SIGN_HEIGHT,
          { maxPages: 200 },
          (page, total) => { if (!cancelled) setScanProgress(`Scanning page ${page} of ${total}...`); },
        );
        if (!cancelled) {
          setPages(pageInfos);
          if (pageInfos.length === 1) setSelectedPage(1);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to scan PDF');
      } finally {
        if (!cancelled) setScanning(false);
      }
    };
    scan();
    return () => { cancelled = true; };
  }, [files]);

  // Auto-select page if only 1
  useEffect(() => {
    if (pages.length === 1 && selectedPage === null) {
      setSelectedPage(1);
    }
  }, [pages, selectedPage]);

  // Check whitespace when page is selected
  useEffect(() => {
    if (selectedPage === null) return;
    const info = pages.find(p => p.page === selectedPage);
    if (info && info.whitespace && !info.whitespace.sufficient) {
      setWhitespaceWarning(info.whitespace);
      setForceSign(false);
    } else {
      setWhitespaceWarning(null);
      setForceSign(false);
    }
  }, [selectedPage, pages]);

  // Draw handlers
  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width);
      y = (e.clientY - rect.top) * (canvas.height / rect.height);
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
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width);
      y = (e.clientY - rect.top) * (canvas.height / rect.height);
    }
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }, [isDrawing]);

  const stopDraw = useCallback(() => { setIsDrawing(false); }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  // Upload image handler
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      setError('Please upload a JPEG or PNG image.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const hasSignature = (sigType === 'draw' && hasDrawn) || (sigType === 'type' && signatureText.trim()) || (sigType === 'upload' && uploadedImage);

  const handleSign = useCallback(async () => {
    if (files.length === 0 || selectedPage === null || !hasSignature) return;
    setProcessing(true);
    setError(null);
    try {
      const buf = await readFileAsArrayBuffer(files[0]);
      const src = await loadPdf(buf);
      const { rgb } = await import('pdf-lib');
      const { StandardFonts } = await import('pdf-lib');

      const pageInfo = pages.find(p => p.page === selectedPage);
      const ws = pageInfo?.whitespace;

      // Determine signature image bytes
      let sigImgBytes: ArrayBuffer | null = null;
      let sigTextToDraw: string | null = null;

      if (sigType === 'draw' && canvasRef.current) {
        sigImgBytes = await fetch(canvasRef.current.toDataURL('image/png')).then(r => r.arrayBuffer());
      } else if (sigType === 'upload' && uploadedImage) {
        sigImgBytes = await fetch(uploadedImage).then(r => r.arrayBuffer());
      } else if (sigType === 'type' && signatureText.trim()) {
        // Standard PDF fonts only encode Latin-1 — strip anything else and
        // fail with a helpful message instead of a pdf-lib encoding crash.
        sigTextToDraw = signatureText.trim().replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
        if (!sigTextToDraw.trim()) {
          throw new Error('Typed signatures only support Latin characters. Please draw or upload your signature instead.');
        }
      }

      const pdfPage = src.getPage(selectedPage - 1);
      const { width: pageW, height: pageH } = pdfPage.getSize();

      // The box the signature must fit inside
      const inWhitespace = !!(ws && ws.found && (ws.sufficient || forceSign));
      const boxW = inWhitespace ? Math.max(ws!.width * 0.9, 40) : 150;
      const boxH = inWhitespace ? Math.max(ws!.height * 0.9, 20) : 50;

      // Size the signature preserving its aspect ratio, clamped to the box.
      let img: Awaited<ReturnType<typeof src.embedPng>> | null = null;
      if (sigImgBytes) {
        const isPng = sigType === 'draw' || !!uploadedImage?.startsWith('data:image/png');
        img = isPng ? await src.embedPng(sigImgBytes) : await src.embedJpg(sigImgBytes);
      }
      const aspect = img ? img.width / img.height : 3;
      let sigW = Math.min(boxW, 180);
      let sigH = sigW / aspect;
      if (sigH > boxH) {
        sigH = boxH;
        sigW = sigH * aspect;
      }

      // Right-aligned inside the whitespace, or bottom-right fallback.
      let sigX: number, sigY: number;
      if (inWhitespace) {
        sigX = ws!.x + ws!.width - sigW;
        sigY = ws!.y;
      } else {
        sigX = pageW - sigW - 40;
        sigY = 40;
      }
      sigX = Math.max(20, Math.min(sigX, pageW - sigW - 20));
      sigY = Math.max(20, Math.min(sigY, pageH - sigH - 20));

      if (img) {
        pdfPage.drawImage(img, { x: sigX, y: sigY, width: sigW, height: sigH });
      } else if (sigTextToDraw) {
        const font = await src.embedFont(StandardFonts.HelveticaBold);
        let fontSize = Math.min(sigH * 0.9, 20);
        // Shrink until the name fits the available width.
        while (fontSize > 6 && font.widthOfTextAtSize(sigTextToDraw, fontSize) > sigW) fontSize -= 1;
        pdfPage.drawText(sigTextToDraw, {
          x: sigX,
          y: sigY + sigH / 2 - fontSize / 3,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      const bytes = await src.save();
      downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), getOutputFilename('sign-pdf', '.pdf'));
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Failed to sign PDF');
    } finally {
      setProcessing(false);
    }
  }, [files, selectedPage, sigType, hasSignature, pages, uploadedImage, signatureText, forceSign]);

  const pageInfo = pages.find(p => p.page === selectedPage);

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
            multiple={false}
            files={files}
            onFilesSelected={(f) => { setFiles(f); setDone(false); setError(null); setSelectedPage(null); setSigType(null); setForceSign(false); }}
            onRemoveFile={() => { setFiles([]); setPages([]); setSelectedPage(null); setSigType(null); setDone(false); }}
          />

          {/* Scanning indicator */}
          {scanning && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-blue-800">{scanProgress}</p>
            </div>
          )}

          {/* Scan / global errors (visible even before a page is selected) */}
          {error && selectedPage === null && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success confirmation */}
          {done && (
            <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800 mb-1">PDF signed successfully</p>
                  <p className="text-sm text-green-700">The signed file has been downloaded.</p>
                  <button
                    onClick={() => { setDone(false); setSigType(null); }}
                    className="mt-3 px-4 py-2 rounded-lg text-xs font-medium border border-green-300 text-green-800 hover:bg-green-100 transition-colors"
                  >
                    Sign another page
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Page selector */}
          {pages.length > 0 && !scanning && (
            <div className="mt-6">
              <label className="block text-sm font-semibold text-foreground mb-2">Select page to sign</label>
              <p className="text-xs text-muted-foreground mb-3">
                {pages.length} page{pages.length > 1 ? 's' : ''} found. Whitespace in footer has been scanned.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-1">
                {pages.map((p) => (
                  <button
                    key={p.page}
                    onClick={() => { setSelectedPage(p.page); setDone(false); setError(null); setForceSign(false); }}
                    className={`relative group rounded-xl border-2 overflow-hidden transition-all ${
                      selectedPage === p.page ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <img src={p.url} alt={`Page ${p.page}`} className="w-full object-contain bg-white" />
                    <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-sm px-2 py-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Page {p.page}</span>
                      {p.whitespace && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          p.whitespace.sufficient ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {p.whitespace.sufficient ? 'Good' : 'Tight'}
                        </span>
                      )}
                    </div>
                    {selectedPage === p.page && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Whitespace warning */}
          {whitespaceWarning && !forceSign && selectedPage !== null && (
            <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Limited whitespace detected</p>
                  <p className="text-xs text-amber-700 mt-1">{whitespaceWarning.message}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setFiles([]); setPages([]); setSelectedPage(null); setSigType(null); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  Upload Another Document
                </button>
                <button
                  onClick={() => setForceSign(true)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Continue Signing
                </button>
              </div>
            </div>
          )}

          {/* Signature type selector */}
          {selectedPage !== null && !scanning && (forceSign || !whitespaceWarning || whitespaceWarning.sufficient) && !done && (
            <div className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Choose signature method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => { setSigType('draw'); setDone(false); setError(null); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      sigType === 'draw' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <PenTool className="w-6 h-6" style={{ color: sigType === 'draw' ? 'hsl(var(--primary))' : '#9ca3af' }} />
                    <span className="text-sm font-medium">Draw</span>
                  </button>
                  <button
                    onClick={() => { setSigType('type'); setDone(false); setError(null); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      sigType === 'type' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <Type className="w-6 h-6" style={{ color: sigType === 'type' ? 'hsl(var(--primary))' : '#9ca3af' }} />
                    <span className="text-sm font-medium">Type</span>
                  </button>
                  <button
                    onClick={() => { setSigType('upload'); setDone(false); setError(null); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      sigType === 'upload' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'
                    }`}
                  >
                    <Upload className="w-6 h-6" style={{ color: sigType === 'upload' ? 'hsl(var(--primary))' : '#9ca3af' }} />
                    <span className="text-sm font-medium">Upload</span>
                  </button>
                </div>
              </div>

              {/* Draw signature */}
              {sigType === 'draw' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-foreground mb-2">Draw your signature</label>
                  <div className="border border-border rounded-xl p-2 bg-gray-50 inline-block">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={200}
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
              )}

              {/* Type signature */}
              {sigType === 'type' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-foreground mb-2">Type your name</label>
                  <input
                    type="text"
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    placeholder="Your signature"
                    className="w-full max-w-sm px-4 py-2.5 border border-border rounded-lg text-lg font-serif focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {signatureText && (
                    <div className="mt-3 px-4 py-3 bg-gray-50 rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Preview</p>
                      <p className="text-2xl font-serif text-foreground italic">{signatureText}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload signature image */}
              {sigType === 'upload' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-foreground mb-2">Upload signature image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {!uploadedImage ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-3 px-6 py-4 border-2 border-dashed border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all"
                    >
                      <FileImage className="w-8 h-8 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">Click to upload image</p>
                        <p className="text-xs text-muted-foreground">JPEG or PNG, any size</p>
                      </div>
                    </button>
                  ) : (
                    <div className="relative inline-block">
                      <img src={uploadedImage} alt="Signature" className="max-h-24 rounded-lg border border-border bg-white p-2" />
                      <button
                        onClick={() => setUploadedImage(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Page info + placement preview */}
              {pageInfo && (
                <div className="p-4 bg-gray-50 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Signing Page {selectedPage}</span>
                    {pageInfo.whitespace && (
                      <span className="text-xs text-muted-foreground">
                        Signature area: {Math.round(pageInfo.whitespace.width)}x{Math.round(pageInfo.whitespace.height)}pt
                      </span>
                    )}
                  </div>
                  <div className="relative inline-block">
                    <img src={pageInfo.url} alt={`Page ${selectedPage}`} className="max-h-48 rounded-lg border border-border" />
                    {pageInfo.whitespace && pageInfo.whitespace.found && (
                      <div
                        className="absolute border-2 border-dashed border-primary/50 rounded pointer-events-none"
                        style={{
                          left: `${(pageInfo.whitespace.x / pageInfo.pointWidth) * 100}%`,
                          bottom: `${(pageInfo.whitespace.y / pageInfo.pointHeight) * 100}%`,
                          width: `${(pageInfo.whitespace.width / pageInfo.pointWidth) * 100}%`,
                          height: `${(pageInfo.whitespace.height / pageInfo.pointHeight) * 100}%`,
                          backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                onClick={handleSign}
                disabled={processing || done || !hasSignature}
                className={`px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                  done ? 'bg-green-500 text-white' : 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg active:scale-[0.98]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</> :
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
