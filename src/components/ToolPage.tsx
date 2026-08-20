'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Download, Loader2, Check, AlertCircle, FileText, Trash2, FileDown, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Link from 'next/link';
import { getToolBySlug } from '@/lib/tools-data';
import FileUpload from './FileUpload';
import { downloadBlob, renderPdfPages } from '@/lib/pdf-engine';

interface ToolPageProps {
  slug: string;
  children?: React.ReactNode;
  options?: React.ReactNode;
  multiple?: boolean;
  accept?: string;
  onProcess: (files: File[], options?: any) => Promise<Blob | Blob[]>;
  processLabel?: string;
  processAllTogether?: boolean;
  onFilesSelected?: (files: File[]) => void;
  minFiles?: number;
  minFilesMessage?: string;
}

interface ProcessedResult {
  sourceFile: File;
  result: Blob;
}

function getOutputName(sourceFile: File, result: Blob) {
  const extMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/markdown': '.md',
    'text/plain': '.txt',
    'text/html': '.html',
  };
  const ext = extMap[result.type] || (result.type.startsWith('image/') ? '.jpg' : '.bin');
  return sourceFile.name.replace(/\.pdf$/i, '') + ext;
}

function ViewToggle({ mode, onChange }: { mode: 'list' | 'grid'; onChange: (m: 'list' | 'grid') => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      <button onClick={() => onChange('list')} className={`p-1.5 rounded-md transition-colors ${mode === 'list' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="List view">
        <List className="w-4 h-4" />
      </button>
      <button onClick={() => onChange('grid')} className={`p-1.5 rounded-md transition-colors ${mode === 'grid' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Grid view">
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}

function FileGridPreview({ files, currentIndex, onPrev, onNext }: { files: File[]; currentIndex: number; onPrev: () => void; onNext: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const file = files[currentIndex];
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

  useEffect(() => {
    setPreviewUrl(null);
    if (isPdf) {
      let cancelled = false;
      renderPdfPages(file, [1]).then(result => {
        if (!cancelled && result[0]) setPreviewUrl(result[0].url);
      });
      return () => { cancelled = true; };
    }
  }, [currentIndex, file, isPdf]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full bg-gray-50 rounded-xl border border-border overflow-hidden flex items-center justify-center" style={{ minHeight: 300, maxHeight: 400 }}>
        {isPdf && previewUrl ? (
          <img src={previewUrl} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <FileText className="w-10 h-10" />
            <p className="text-xs font-medium">{file.name}</p>
            <p className="text-xs">{formatSize(file.size)}</p>
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-foreground truncate max-w-full">{file.name}</p>
      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={currentIndex === 0} className="p-2.5 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Previous">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{currentIndex + 1} / {files.length}</span>
        <button onClick={onNext} disabled={currentIndex === files.length - 1} className="p-2.5 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Next">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ResultGridPreview({ results, currentIndex, onPrev, onNext, onDownload, onDelete }: {
  results: ProcessedResult[]; currentIndex: number; onPrev: () => void; onNext: () => void; onDownload: () => void; onDelete: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const r = results[currentIndex];

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setPreviewUrl(null);
      setTextContent(null);

      const blob = r.result;
      const type = blob.type || '';

      if (type === 'application/pdf') {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPreviewUrl(objectUrl);
      } else if (type.startsWith('image/')) {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPreviewUrl(objectUrl);
      } else if (type.startsWith('text/')) {
        const text = await blob.text();
        if (!cancelled) setTextContent(text.substring(0, 5000));
      } else {
        try {
          const pages = await renderPdfPages(r.sourceFile, [1]);
          if (!cancelled && pages[0]) setPreviewUrl(pages[0].url);
        } catch {
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setPreviewUrl(objectUrl);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentIndex]);

  const hasPreview = previewUrl || textContent;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full bg-gray-50 rounded-xl border border-border overflow-hidden flex items-center justify-center" style={{ minHeight: 300, maxHeight: 400 }}>
        {previewUrl && r.result.type === 'application/pdf' && <iframe src={previewUrl} className="w-full h-[400px]" />}
        {previewUrl && r.result.type.startsWith('image/') && <img src={previewUrl} alt="Preview" className="max-w-full max-h-[400px] object-contain" />}
        {previewUrl && !r.result.type.startsWith('image/') && r.result.type !== 'application/pdf' && (
          <img src={previewUrl} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
        )}
        {textContent && (
          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed p-4 max-h-[400px] overflow-auto w-full">
            {textContent}{textContent.length >= 5000 && '\n\n... (truncated)'}
          </pre>
        )}
        {!hasPreview && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-xs">Loading preview...</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onDelete} className="p-2.5 rounded-xl border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-muted-foreground transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={onPrev} disabled={currentIndex === 0} className="p-2.5 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Previous">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{currentIndex + 1} / {results.length}</span>
        <button onClick={onNext} disabled={currentIndex === results.length - 1} className="p-2.5 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Next">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={onDownload} className="p-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white transition-colors" title="Download">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ResultCard({ sourceFile, result, index, onDownload, onDelete }: { sourceFile: File; result: Blob; index: number; onDownload: () => void; onDelete: () => void }) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };
  return (
    <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors animate-fade-in">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{getOutputName(sourceFile, result)}</p>
        <p className="text-xs text-muted-foreground">{formatSize(result.size)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onDownload} className="p-2 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors" title="Download">
          <Download className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ToolPage({
  slug,
  children,
  options,
  multiple = true,
  accept = '.pdf',
  onProcess,
  processLabel = 'Process PDF',
  processAllTogether = false,
  onFilesSelected,
  minFiles,
  minFilesMessage,
}: ToolPageProps) {
  const tool = getToolBySlug(slug);
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processOptions, setProcessOptions] = useState<any>({});
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [leftView, setLeftView] = useState<'list' | 'grid'>('list');
  const [rightView, setRightView] = useState<'list' | 'grid'>('list');
  const [leftGridIdx, setLeftGridIdx] = useState(0);
  const [rightGridIdx, setRightGridIdx] = useState(0);

  const allSelected = files.length > 0 && selected.size === files.length;
  const someSelected = selected.size > 0 && !allSelected;
  const minFilesMet = !minFiles || files.length >= minFiles;

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    setResults([]);
    setError(null);
    setLeftGridIdx(0);
    onFilesSelected?.(newFiles);
  }, [onFilesSelected]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setSelected(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
    setResults([]);
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(files.map((_, i) => i)));
  }, [allSelected, files]);

  const toggleFile = useCallback((index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    setError(null);
    setResults([]);
    setRightGridIdx(0);
    const indices = Array.from(selected).sort((a, b) => a - b);
    const selectedFiles = indices.map(i => files[i]);
    const newResults: ProcessedResult[] = [];
    try {
      if (processAllTogether) {
        setProgress({ current: 1, total: 1, currentFile: `${selectedFiles.length} files` });
        const result = await onProcess(selectedFiles, processOptions);
        if (Array.isArray(result)) result.forEach(blob => newResults.push({ sourceFile: selectedFiles[0], result: blob }));
        else newResults.push({ sourceFile: selectedFiles[0], result });
        setResults([...newResults]);
      } else {
        for (let idx = 0; idx < selectedFiles.length; idx++) {
          const file = selectedFiles[idx];
          setProgress({ current: idx + 1, total: selectedFiles.length, currentFile: file.name });
          const result = await onProcess([file], processOptions);
          if (Array.isArray(result)) result.forEach(blob => newResults.push({ sourceFile: file, result: blob }));
          else newResults.push({ sourceFile: file, result });
          setResults([...newResults]);
        }
      }
      setProgress(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
      setProgress(null);
    } finally {
      setProcessing(false);
    }
  }, [files, selected, onProcess, processOptions, processAllTogether]);

  const handleDownloadResult = useCallback((result: ProcessedResult) => {
    const extMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/markdown': '.md', 'text/plain': '.txt', 'text/html': '.html',
    };
    const ext = extMap[result.result.type] || (result.result.type.startsWith('image/') ? '.jpg' : '.bin');
    downloadBlob(result.result, `${result.sourceFile.name.replace(/\.pdf$/i, '')}${ext}`);
  }, []);

  const handleDeleteResult = useCallback((index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDownloadAll = useCallback(() => {
    results.forEach(r => handleDownloadResult(r));
  }, [results, handleDownloadResult]);

  const handleReset = useCallback(() => {
    setFiles([]); setSelected(new Set()); setResults([]); setProgress(null); setError(null);
    setLeftGridIdx(0); setRightGridIdx(0); setLeftView('list'); setRightView('list');
  }, []);

  if (!tool) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Tool not found.</p></div>;

  const IconComponent = (LucideIcons as any)[tool.icon] || LucideIcons.FileText;
  const showTwoCol = files.length > 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${tool.color}15` }}>
              <IconComponent className="w-6 h-6" style={{ color: tool.color }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{tool.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">{tool.description}</p>
            </div>
          </div>
        </div>

        {!showTwoCol && (
          <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <FileUpload accept={accept} multiple={multiple} files={files} onFilesSelected={handleFilesSelected} onRemoveFile={results.length === 0 ? handleRemoveFile : undefined} selectable={false} selected={selected} onToggleFile={toggleFile} onToggleAll={toggleSelectAll} allSelected={allSelected} someSelected={someSelected} />
            {error && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in"><AlertCircle className="w-5 h-5 text-destructive shrink-0" /><p className="text-sm text-destructive">{error}</p></div>}
            {progress && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
                <div className="flex items-center gap-3 mb-3"><Loader2 className="w-4 h-4 animate-spin text-blue-600" /><p className="text-sm font-medium text-blue-800">Processing {progress.current} of {progress.total}: {progress.currentFile}</p></div>
                <div className="w-full bg-blue-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
              </div>
            )}
            {results.length > 0 && !processing && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />{results.length} file{results.length > 1 ? 's' : ''} ready</h3>
                  <div className="flex items-center gap-2">
                    {multiple && <ViewToggle mode={rightView} onChange={setRightView} />}
                    {results.length > 1 && <button onClick={handleDownloadAll} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5 whitespace-nowrap"><FileDown className="w-3.5 h-3.5" /> Download All</button>}
                    <button onClick={handleReset} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors whitespace-nowrap">Delete All</button>
                  </div>
                </div>
                {rightView === 'list' || !multiple ? (
                  <div className="space-y-2">{results.map((r, i) => <ResultCard key={i} sourceFile={r.sourceFile} result={r.result} index={i} onDownload={() => handleDownloadResult(r)} onDelete={() => handleDeleteResult(i)} />)}</div>
                ) : (
                  <ResultGridPreview results={results} currentIndex={rightGridIdx} onPrev={() => setRightGridIdx(i => Math.max(0, i - 1))} onNext={() => setRightGridIdx(i => Math.min(results.length - 1, i + 1))} onDownload={() => handleDownloadResult(results[rightGridIdx])} onDelete={() => { handleDeleteResult(rightGridIdx); setRightGridIdx(i => Math.min(i, results.length - 2)); }} />
                )}
              </div>
            )}
          </div>
        )}

        {showTwoCol && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Original files */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{files.length} original file{files.length > 1 ? 's' : ''}</h3>
                {multiple && files.length > 1 && <ViewToggle mode={leftView} onChange={setLeftView} />}
              </div>
              {leftView === 'list' || !multiple ? (
                <FileUpload accept={accept} multiple={multiple} files={files} onFilesSelected={handleFilesSelected} onRemoveFile={results.length === 0 ? handleRemoveFile : undefined} selectable={results.length === 0} selected={selected} onToggleFile={toggleFile} onToggleAll={toggleSelectAll} allSelected={allSelected} someSelected={someSelected} />
              ) : (
                <FileGridPreview files={files} currentIndex={leftGridIdx} onPrev={() => setLeftGridIdx(i => Math.max(0, i - 1))} onNext={() => setLeftGridIdx(i => Math.min(files.length - 1, i + 1))} />
              )}
            </div>

            {/* Right: Action panel + results */}
            <div className="w-full lg:w-96 shrink-0 overflow-hidden">
              <div className="lg:sticky lg:top-8 space-y-4">
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  {options && <div className="mb-4">{options}</div>}
                  {children && <div className="mb-4">{children}</div>}
                  {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in"><AlertCircle className="w-4 h-4 text-destructive shrink-0" /><p className="text-xs text-destructive">{error}</p></div>}
                  {progress && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in overflow-hidden">
                      <div className="flex items-center gap-2 mb-2 min-w-0"><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" /><p className="text-xs font-medium text-blue-800 min-w-0">{progress.current}/{progress.total}: <span className="block truncate">{progress.currentFile}</span></p></div>
                      <div className="w-full bg-blue-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
                    </div>
                  )}

                  {!minFilesMet ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                      <p className="text-sm text-amber-700 font-medium">{minFilesMessage || `Upload at least ${minFiles} files.`}</p>
                    </div>
                  ) : results.length > 0 && !processing ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />{results.length} ready</h3>
                        {multiple && <ViewToggle mode={rightView} onChange={setRightView} />}
                      </div>
                      {rightView === 'list' || !multiple ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {results.map((r, i) => <ResultCard key={i} sourceFile={r.sourceFile} result={r.result} index={i} onDownload={() => handleDownloadResult(r)} onDelete={() => handleDeleteResult(i)} />)}
                        </div>
                      ) : (
                        <ResultGridPreview results={results} currentIndex={rightGridIdx} onPrev={() => setRightGridIdx(i => Math.max(0, i - 1))} onNext={() => setRightGridIdx(i => Math.min(results.length - 1, i + 1))} onDownload={() => handleDownloadResult(results[rightGridIdx])} onDelete={() => { handleDeleteResult(rightGridIdx); setRightGridIdx(i => Math.min(i, results.length - 2)); }} />
                      )}
                      <div className="flex gap-2 mt-4">
                        {results.length > 1 && <button onClick={handleDownloadAll} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5"><FileDown className="w-3.5 h-3.5" /> Download All</button>}
                        <button onClick={handleReset} className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">Delete All</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleProcess} disabled={selected.size === 0 || processing || !minFilesMet} className={`w-full px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${selected.size > 0 && !processing && minFilesMet ? 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {processLabel} {selected.size > 0 && `(${selected.size})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full"></span>100% Private</span>
          <span>No files uploaded to any server</span>
        </div>
      </div>
    </div>
  );
}
