'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, Unlock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { isPdfPasswordProtected, unlockPdf, downloadBlob } from '@/lib/pdf-engine';

export default function UnlockPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [checking, setChecking] = useState(false);
  const [isProtected, setIsProtected] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const handleFilesSelected = useCallback(async (selected: File[]) => {
    if (selected.length === 0) return;
    const file = selected[0];
    setFiles([file]);
    fileRef.current = file;
    setIsProtected(null);
    setDone(false);
    setError(null);
    setPassword('');
    setChecking(true);
    try {
      const protected_ = await isPdfPasswordProtected(file);
      setIsProtected(protected_);
    } catch {
      setIsProtected(null);
      setError('Could not analyze the PDF. Please try another file.');
    } finally {
      setChecking(false);
    }
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!fileRef.current) return;
    if (!password) { setError('Please enter the current password'); return; }
    setUnlocking(true);
    setError(null);
    try {
      const blob = await unlockPdf(fileRef.current, password);
      downloadBlob(blob, fileRef.current.name.replace(/\.pdf$/i, '_unlocked.pdf'));
      setDone(true);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('password') || msg.includes('Invalid')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(msg || 'Unlock failed. Please check the password and try again.');
      }
    } finally {
      setUnlocking(false);
    }
  }, [password]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setIsProtected(null);
    setPassword('');
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
              <Unlock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Unlock PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Remove password protection from a PDF</p>
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

          {checking && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Checking if PDF is password protected...</p>
            </div>
          )}

          {!checking && isProtected === false && !done && (
            <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800 mb-1">This PDF is not password protected</p>
                  <p className="text-sm text-green-700">No unlock is needed. You can open and edit this file directly.</p>
                </div>
              </div>
            </div>
          )}

          {!checking && isProtected === true && !done && (
            <div className="mt-6 space-y-4 max-w-sm">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-medium text-amber-800">This PDF is password protected. Enter the current password to remove protection.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    placeholder="Enter the PDF password"
                    className="w-full px-4 py-2.5 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={handleUnlock} disabled={unlocking || !password} className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white hover:shadow-lg hover:shadow-amber-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {unlocking ? <><Loader2 className="w-4 h-4 animate-spin" /> Unlocking...</> : <><Unlock className="w-4 h-4" /> Unlock PDF</>}
              </button>
            </div>
          )}

          {done && (
            <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800 mb-1">PDF unlocked successfully</p>
                  <p className="text-sm text-green-700">The unlocked file has been downloaded. It will open without requiring a password.</p>
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
