'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { protectPdf, downloadBlob } from '@/lib/pdf-engine';

export default function ProtectPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [allowCopying, setAllowCopying] = useState(false);
  const fileRef = useRef<File | null>(null);

  const handleFilesSelected = useCallback((selected: File[]) => {
    setFiles(selected);
    setDone(false);
    setError(null);
    fileRef.current = selected[0] || null;
  }, []);

  const handleProtect = useCallback(async () => {
    if (!fileRef.current) return;
    if (!password) { setError('Please enter a password'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 3) { setError('Password must be at least 3 characters'); return; }

    setProcessing(true);
    setError(null);
    try {
      const blob = await protectPdf(fileRef.current, password, undefined, {
        allowPrinting,
        allowModifying,
        allowCopying,
        allowFillingForms: true,
      });
      downloadBlob(blob, fileRef.current.name.replace(/\.pdf$/i, '_protected.pdf'));
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Protection failed');
    } finally {
      setProcessing(false);
    }
  }, [password, confirmPassword, allowPrinting, allowModifying, allowCopying]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setPassword('');
    setConfirmPassword('');
    setDone(false);
    setError(null);
    fileRef.current = null;
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Lock PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Add password protection to your PDF</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple={false}
            files={files}
            onFilesSelected={handleFilesSelected}
            onRemoveFile={handleReset}
          />

          {files.length > 0 && !done && !processing && (
            <div className="mt-6 space-y-5">
              <div className="space-y-3 max-w-sm">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Confirm password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">Permissions</label>
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
                </div>
              </div>

              <button onClick={handleProtect} className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98]">
                <Lock className="w-4 h-4" /> Protect PDF
              </button>
            </div>
          )}

          {processing && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Encrypting PDF with password...</p>
            </div>
          )}

          {done && (
            <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800 mb-1">PDF protected successfully</p>
                  <p className="text-sm text-green-700">The password-protected file has been downloaded. Opening it will require the password you set.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
