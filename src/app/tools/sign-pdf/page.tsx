'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, Check, AlertCircle, PenTool, Type, Upload, AlertTriangle, X, FileImage, Eye, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Dancing_Script } from 'next/font/google';
import FileUpload from '@/components/FileUpload';
import { readFileAsArrayBuffer, loadPdf, downloadBlob, scanPdfForSigning, getOutputFilename, getPdfJs, type FooterWhitespaceResult, type SignPageScan } from '@/lib/pdf-engine';
import { renderTextSignature, trimCanvas, canvasToPngBytes } from '@/lib/signature-render';

/** The handwriting face a typed name is turned into when the user asks for it. */
const handwriting = Dancing_Script({ weight: '600', subsets: ['latin'], display: 'swap' });

const TYPED_FONT = "Georgia, 'Times New Roman', serif";
const INK = '#111827';

type SigType = 'draw' | 'type' | 'upload';

type PageInfo = SignPageScan;

const MIN_SIGN_WIDTH = 120;
const MIN_SIGN_HEIGHT = 30;

const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

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
  /** null until the user answers the handwritten question. */
  const [handwritten, setHandwritten] = useState<boolean | null>(null);
  const [typedPreview, setTypedPreview] = useState<string | null>(null);

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warning state
  const [whitespaceWarning, setWhitespaceWarning] = useState<FooterWhitespaceResult | null>(null);
  const [forceSign, setForceSign] = useState(false);

  // Preview-before-download state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const signedBytes = useRef<Uint8Array | null>(null);
  const previewToken = useRef(0);

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
    ctx.strokeStyle = INK;
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

  // Render the typed name exactly as it will be stamped, so the preview on the
  // page and the ink in the PDF can never disagree.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sigType !== 'type' || !signatureText.trim() || handwritten === null) {
        if (!cancelled) setTypedPreview(null);
        return;
      }
      try {
        const canvas = await renderTextSignature(signatureText, {
          fontFamily: handwritten ? handwriting.style.fontFamily : TYPED_FONT,
          color: INK,
        });
        if (!cancelled) setTypedPreview(canvas ? canvas.toDataURL('image/png') : null);
      } catch {
        if (!cancelled) setTypedPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [sigType, signatureText, handwritten]);

  const hasSignature = !!(
    (sigType === 'draw' && hasDrawn) ||
    (sigType === 'type' && signatureText.trim() && handwritten !== null) ||
    (sigType === 'upload' && uploadedImage)
  );

  /** Produce the signed PDF. Shared by the preview and the download button. */
  const buildSignedPdf = useCallback(async (): Promise<Uint8Array> => {
    if (files.length === 0 || selectedPage === null) throw new Error('Select a page to sign first.');

    const buf = await readFileAsArrayBuffer(files[0]);
    const src = await loadPdf(buf);

    const pageInfo = pages.find(p => p.page === selectedPage);
    const ws = pageInfo?.whitespace;

    // Draw, type and upload all end up as a transparent PNG, so the stamped
    // signature is the same pixels the user approved in the preview.
    let sigBytes: ArrayBuffer;
    let isPng = true;

    if (sigType === 'draw') {
      if (!canvasRef.current || !hasDrawn) throw new Error('Draw your signature first.');
      sigBytes = await canvasToPngBytes(trimCanvas(canvasRef.current, 6));
    } else if (sigType === 'type') {
      if (handwritten === null) throw new Error('Choose whether your signature should be handwritten.');
      const canvas = await renderTextSignature(signatureText, {
        fontFamily: handwritten ? handwriting.style.fontFamily : TYPED_FONT,
        color: INK,
      });
      if (!canvas) throw new Error('Type your name first.');
      sigBytes = await canvasToPngBytes(canvas);
    } else if (sigType === 'upload' && uploadedImage) {
      sigBytes = await fetch(uploadedImage).then(r => r.arrayBuffer());
      isPng = uploadedImage.startsWith('data:image/png');
    } else {
      throw new Error('Add a signature first.');
    }

    const pdfPage = src.getPage(selectedPage - 1);
    const { width: pageW, height: pageH } = pdfPage.getSize();

    // The box the signature must fit inside
    const inWhitespace = !!(ws && ws.found && (ws.sufficient || forceSign));
    const boxW = inWhitespace ? Math.max(ws!.width * 0.9, 40) : 150;
    const boxH = inWhitespace ? Math.max(ws!.height * 0.9, 20) : 50;

    // Size the signature preserving its aspect ratio, clamped to the box.
    const img = isPng ? await src.embedPng(sigBytes) : await src.embedJpg(sigBytes);
    const aspect = img.width / img.height;
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

    pdfPage.drawImage(img, { x: sigX, y: sigY, width: sigW, height: sigH });

    return src.save();
  }, [files, selectedPage, pages, sigType, hasDrawn, handwritten, signatureText, uploadedImage, forceSign]);

  /** Sign, render the signed page to an image, and show it before downloading. */
  const runPreview = useCallback(async () => {
    const token = ++previewToken.current;
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      const bytes = await buildSignedPdf();
      if (token !== previewToken.current) return;
      signedBytes.current = bytes;

      const pdfjsLib = await getPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const page = await pdf.getPage(selectedPage!);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1400 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
      if (token !== previewToken.current) return;
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
    } catch (err) {
      if (token === previewToken.current) setPreviewError(messageOf(err, 'Could not build the preview.'));
    } finally {
      if (token === previewToken.current) setPreviewBusy(false);
    }
  }, [buildSignedPdf, selectedPage]);

  // Keep an open preview in step with the signature as it is edited.
  useEffect(() => {
    if (!previewOpen) return;
    const timer = setTimeout(() => { runPreview(); }, 350);
    return () => clearTimeout(timer);
  }, [previewOpen, runPreview]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  const saveSigned = useCallback((bytes: Uint8Array) => {
    downloadBlob(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), getOutputFilename('sign-pdf', '.pdf'));
    setDone(true);
  }, []);

  const handleSign = useCallback(async () => {
    if (!hasSignature) return;
    setProcessing(true);
    setError(null);
    try {
      saveSigned(await buildSignedPdf());
    } catch (err) {
      setError(messageOf(err, 'Failed to sign PDF'));
    } finally {
      setProcessing(false);
    }
  }, [hasSignature, buildSignedPdf, saveSigned]);

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
                <div className="animate-fade-in space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Type your name</label>
                    <input
                      type="text"
                      value={signatureText}
                      onChange={(e) => setSignatureText(e.target.value)}
                      placeholder="Your signature"
                      className="w-full max-w-sm px-4 py-2.5 border border-border rounded-lg text-lg font-serif focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  {/* The one question: should the typed name become handwriting? */}
                  {signatureText.trim() && (
                    <div className="p-4 rounded-xl border border-border bg-gray-50 animate-fade-in">
                      <p className="text-sm font-semibold text-foreground">Would you like your signature handwritten?</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">
                        We&apos;ll turn what you typed into a handwritten signature and place it on the document.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setHandwritten(true)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                            handwritten === true ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-gray-300'
                          }`}
                        >
                          Yes, make it handwritten
                        </button>
                        <button
                          onClick={() => setHandwritten(false)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                            handwritten === false ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-gray-300'
                          }`}
                        >
                          No, keep it typed
                        </button>
                      </div>
                    </div>
                  )}

                  {typedPreview && (
                    <div className="px-4 py-3 bg-white rounded-xl border border-border">
                      <p className="text-xs text-muted-foreground mb-2">
                        {handwritten ? 'Your handwritten signature' : 'Your typed signature'}
                      </p>
                      <img src={typedPreview} alt="Signature preview" className="max-h-16" />
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

              <div className="flex flex-wrap items-center gap-3">
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

                <button
                  onClick={() => { setPreviewUrl(null); setPreviewOpen(true); }}
                  disabled={!hasSignature}
                  className="px-6 py-3.5 rounded-xl font-semibold text-sm border border-border text-foreground hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="w-4 h-4" />
                  Preview before download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signed-page preview */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Preview — signed page {selectedPage}</h2>
                <p className="text-xs text-muted-foreground">This is exactly what will be downloaded.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runPreview()}
                  disabled={previewBusy}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors disabled:opacity-50"
                  aria-label="Refresh preview"
                >
                  <RefreshCw className={`w-4 h-4 ${previewBusy ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 min-h-[240px] flex items-center justify-center bg-gray-50">
              {previewBusy && !previewUrl && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Placing your signature...
                </div>
              )}
              {previewError && (
                <div className="flex items-center gap-3 text-sm text-destructive">
                  <AlertCircle className="w-5 h-5 shrink-0" /> {previewError}
                </div>
              )}
              {previewUrl && !previewError && (
                <img src={previewUrl} alt={`Signed page ${selectedPage}`} className="max-w-full rounded-lg border border-border shadow-sm bg-white" />
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-gray-50 transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => { if (signedBytes.current) { saveSigned(signedBytes.current); setPreviewOpen(false); } }}
                disabled={previewBusy || !previewUrl}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary-hover text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Download signed PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
