'use client';

import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, Lock, AlertCircle, Check, Download, Trash2, FileDown, List, LayoutGrid, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { protectPdf, downloadBlob, renderPdfPages } from '@/lib/pdf-engine';

interface FilePassword {
  file: File;
  password: string;
  confirmPassword: string;
}

interface ProcessedResult {
  sourceFile: File;
  result: Blob;
}

function ResultCard({ sourceFile, result, onDownload, onDelete }: {
  sourceFile: File; result: Blob; onDownload: () => void; onDelete: () => void;
}) {
  const name = sourceFile.name.replace(/\.pdf$/i, '_protected.pdf');
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:bg-gray-50 transition-colors group">
      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><Check className="w-5 h-5 text-green-500" /></div>
      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{name}</p><p className="text-xs text-muted-foreground">{(result.size / 1024).toFixed(1)} KB</p></div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        <button onClick={onDownload} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"><Download className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function ResultGridPreview({ results, currentIndex, onPrev, onNext, onDownload, onDelete }: {
  results: ProcessedResult[]; currentIndex: number; onPrev: () => void; onNext: () => void; onDownload: () => void; onDelete: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const r = results[currentIndex];
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPreviewUrl(null);
      try {
        const pages = await renderPdfPages(r.sourceFile, [1]);
        if (!cancelled && pages[0]) setPreviewUrl(pages[0].url);
      } catch {
        const url = URL.createObjectURL(r.result);
        if (!cancelled) setPreviewUrl(url);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentIndex]);
  const name = r.sourceFile.name.replace(/\.pdf$/i, '_protected.pdf');
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full bg-gray-50 rounded-xl border border-border overflow-hidden flex items-center justify-center" style={{ minHeight: 250, maxHeight: 350 }}>
        {previewUrl ? <img src={previewUrl} alt="Preview" className="max-w-full max-h-[350px] object-contain" /> : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-sm font-medium text-foreground truncate max-w-full">{name}</p>
      <div className="flex items-center gap-3">
        <button onClick={onDelete} className="p-2 rounded-xl border border-border hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"><Trash2 className="w-4 h-4" /></button>
        <button onClick={onPrev} disabled={currentIndex === 0} className="p-2 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{currentIndex + 1}/{results.length}</span>
        <button onClick={onNext} disabled={currentIndex === results.length - 1} className="p-2 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={onDownload} className="p-2 rounded-xl bg-primary hover:bg-primary-hover text-white transition-colors"><Download className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function FileGridPreview({ files, currentIndex, onPrev, onNext }: {
  files: File[]; currentIndex: number; onPrev: () => void; onNext: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const file = files[currentIndex];
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPreviewUrl(null);
      try {
        const pages = await renderPdfPages(file, [1]);
        if (!cancelled && pages[0]) setPreviewUrl(pages[0].url);
      } catch { setPreviewUrl(null); }
    };
    load();
    return () => { cancelled = true; };
  }, [currentIndex]);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full bg-gray-50 rounded-xl border border-border overflow-hidden flex items-center justify-center" style={{ minHeight: 250, maxHeight: 350 }}>
        {previewUrl ? <img src={previewUrl} alt="Preview" className="max-w-full max-h-[350px] object-contain" /> : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-sm font-medium text-foreground truncate max-w-full">{file.name}</p>
      <div className="flex items-center gap-3">
        <button onClick={onPrev} disabled={currentIndex === 0} className="p-2 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{currentIndex + 1}/{files.length}</span>
        <button onClick={onNext} disabled={currentIndex === files.length - 1} className="p-2 rounded-xl border border-border hover:bg-gray-50 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function ViewToggle({ mode, onChange }: { mode: 'list' | 'grid'; onChange: (m: 'list' | 'grid') => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      <button onClick={() => onChange('list')} className={`p-1.5 rounded-md transition-colors ${mode === 'list' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><List className="w-4 h-4" /></button>
      <button onClick={() => onChange('grid')} className={`p-1.5 rounded-md transition-colors ${mode === 'grid' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
    </div>
  );
}

export default function ProtectPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [masterPassword, setMasterPassword] = useState('');
  const [masterConfirm, setMasterConfirm] = useState('');
  const [showMaster, setShowMaster] = useState(false);
  const [individualMode, setIndividualMode] = useState(false);
  const [filePasswords, setFilePasswords] = useState<Record<number, { password: string; confirmPassword: string }>>({});
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [allowCopying, setAllowCopying] = useState(false);
  const [allowAnnotating, setAllowAnnotating] = useState(false);
  const [allowFillingForms, setAllowFillingForms] = useState(true);
  const [allowExtraction, setAllowExtraction] = useState(false);
  const [allowAssembly, setAllowAssembly] = useState(false);
  const [leftView, setLeftView] = useState<'list' | 'grid'>('list');
  const [rightView, setRightView] = useState<'list' | 'grid'>('list');
  const [leftGridIdx, setLeftGridIdx] = useState(0);
  const [rightGridIdx, setRightGridIdx] = useState(0);

  const handleFilesSelected = useCallback((selected: File[]) => {
    setFiles(selected);
    setFilePasswords({});
    setResults([]);
    setError(null);
  }, []);

  const getFilePassword = useCallback((idx: number): { password: string; confirmPassword: string } => {
    if (!individualMode) return { password: masterPassword, confirmPassword: masterConfirm };
    return filePasswords[idx] || { password: '', confirmPassword: '' };
  }, [individualMode, masterPassword, masterConfirm, filePasswords]);

  const updateFilePassword = useCallback((idx: number, field: 'password' | 'confirmPassword', value: string) => {
    setFilePasswords(prev => ({
      ...prev,
      [idx]: { ...prev[idx] || { password: '', confirmPassword: '' }, [field]: value },
    }));
  }, []);

  const handleProtectAll = useCallback(async () => {
    if (files.length === 0) return;

    const fps: FilePassword[] = files.map((file, i) => {
      const fp = getFilePassword(i);
      return { file, password: fp.password, confirmPassword: fp.confirmPassword };
    });

    for (const fp of fps) {
      if (!fp.password) { setError(`Please set a password for ${fp.file.name}`); return; }
      if (fp.password !== fp.confirmPassword) { setError(`Passwords don't match for ${fp.file.name}`); return; }
      if (fp.password.length < 3) { setError(`Password for ${fp.file.name} must be at least 3 characters`); return; }
    }

    setProcessing(true);
    setError(null);
    setResults([]);
    const newResults: ProcessedResult[] = [];
    try {
      for (let i = 0; i < fps.length; i++) {
        const fp = fps[i];
        setProgress({ current: i + 1, total: fps.length, currentFile: fp.file.name });
        const blob = await protectPdf(fp.file, fp.password, undefined, {
          allowPrinting, allowModifying, allowCopying, allowAnnotating, allowFillingForms, allowExtraction, allowAssembly,
        });
        newResults.push({ sourceFile: fp.file, result: blob });
        setResults([...newResults]);
      }
      setProgress(null);
    } catch (err: any) {
      setError(err.message || 'Protection failed');
      setProgress(null);
    } finally {
      setProcessing(false);
    }
  }, [files, getFilePassword, allowPrinting, allowModifying, allowCopying, allowAnnotating, allowFillingForms, allowExtraction, allowAssembly]);

  const handleDownloadResult = useCallback((r: ProcessedResult) => {
    downloadBlob(r.result, r.sourceFile.name.replace(/\.pdf$/i, '_protected.pdf'));
  }, []);

  const handleDeleteResult = useCallback((index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDownloadAll = useCallback(() => {
    results.forEach(r => downloadBlob(r.result, r.sourceFile.name.replace(/\.pdf$/i, '_protected.pdf')));
  }, [results]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setMasterPassword('');
    setMasterConfirm('');
    setFilePasswords({});
    setResults([]);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50"><Lock className="w-6 h-6 text-amber-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Lock PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Add password protection to your PDFs</p>
            </div>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <FileUpload accept=".pdf" multiple files={files} onFilesSelected={handleFilesSelected} />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: File preview */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{files.length} file{files.length > 1 ? 's' : ''}</h3>
                {files.length > 1 && <ViewToggle mode={leftView} onChange={setLeftView} />}
              </div>
              {leftView === 'list' ? (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-gray-50/50">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Lock className="w-4 h-4 text-amber-500" /></div>
                      <p className="text-sm text-foreground truncate">{f.name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <FileGridPreview files={files} currentIndex={leftGridIdx} onPrev={() => setLeftGridIdx(i => Math.max(0, i - 1))} onNext={() => setLeftGridIdx(i => Math.min(files.length - 1, i + 1))} />
              )}
            </div>

            {/* Right: Password + Permissions + Actions */}
            <div className="w-full lg:flex-1 shrink-0">
              <div className="lg:sticky lg:top-8 space-y-4">
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-5">
                  {/* Password section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-foreground">Password</label>
                      {files.length > 1 && (
                        <div className="flex items-center gap-2.5">
                          <span className={`text-xs transition-colors ${!individualMode ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>One for all</span>
                          <button onClick={() => setIndividualMode(!individualMode)} className={`relative w-9 h-5 rounded-full transition-colors ${individualMode ? 'bg-primary' : 'bg-gray-300'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${individualMode ? 'translate-x-4' : ''}`} />
                          </button>
                          <span className={`text-xs transition-colors ${individualMode ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Per file</span>
                        </div>
                      )}
                    </div>

                    {!individualMode ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <input type={showMaster ? 'text' : 'password'} value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="Enter password" className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                          <button type="button" onClick={() => setShowMaster(!showMaster)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showMaster ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="relative">
                          <input type={showMaster ? 'text' : 'password'} value={masterConfirm} onChange={(e) => setMasterConfirm(e.target.value)} placeholder="Confirm password" className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                        </div>
                        {masterPassword && masterConfirm && masterPassword !== masterConfirm && (
                          <p className="text-xs text-destructive">Passwords do not match</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {files.map((f, i) => {
                          const fp = filePasswords[i] || { password: '', confirmPassword: '' };
                          return (
                            <div key={i} className="p-3 rounded-lg border border-border bg-gray-50/50 space-y-2">
                              <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                              <div className="flex gap-2">
                                <input type={showMaster ? 'text' : 'password'} value={fp.password} onChange={(e) => updateFilePassword(i, 'password', e.target.value)} placeholder="Password" className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                                <input type={showMaster ? 'text' : 'password'} value={fp.confirmPassword} onChange={(e) => updateFilePassword(i, 'confirmPassword', e.target.value)} placeholder="Confirm" className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                              </div>
                              {fp.password && fp.confirmPassword && fp.password !== fp.confirmPassword && (
                                <p className="text-[10px] text-destructive">Passwords don't match</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={() => setShowMaster(!showMaster)} className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      {showMaster ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showMaster ? 'Hide passwords' : 'Show passwords'}
                    </button>
                  </div>

                  {/* Permissions */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Permissions</label>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowPrinting} onChange={(e) => setAllowPrinting(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow printing</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowModifying} onChange={(e) => setAllowModifying(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow modifying</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowCopying} onChange={(e) => setAllowCopying(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow copying text</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowAnnotating} onChange={(e) => setAllowAnnotating(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow annotating</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowFillingForms} onChange={(e) => setAllowFillingForms(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow filling forms</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowExtraction} onChange={(e) => setAllowExtraction(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow extracting</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={allowAssembly} onChange={(e) => setAllowAssembly(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                        <span className="text-sm text-foreground group-hover:text-primary transition-colors">Allow page assembly</span>
                      </label>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive">{error}</p>
                    </div>
                  )}

                  {progress && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
                      <div className="flex items-center gap-2 mb-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /><p className="text-xs font-medium text-blue-800">{progress.current}/{progress.total}: {progress.currentFile}</p></div>
                      <div className="w-full bg-blue-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div>
                    </div>
                  )}

                  {results.length > 0 && !processing ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />{results.length} ready</h3>
                        <ViewToggle mode={rightView} onChange={setRightView} />
                      </div>
                      {rightView === 'list' ? (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {results.map((r, i) => <ResultCard key={i} sourceFile={r.sourceFile} result={r.result} onDownload={() => handleDownloadResult(r)} onDelete={() => handleDeleteResult(i)} />)}
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
                    <button onClick={handleProtectAll} disabled={processing} className={`w-full px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${!processing ? 'bg-amber-500 hover:bg-amber-600 text-white hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      {processing ? 'Protecting...' : `Protect All (${files.length})`}
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
