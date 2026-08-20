'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Languages, AlertCircle, FileDown, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { extractTextFromPdf, translateText, createPdfFromText, downloadBlob } from '@/lib/pdf-engine';

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
  'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean', 'Arabic',
  'Hindi', 'Dutch', 'Swedish', 'Polish', 'Turkish', 'Vietnamese', 'Thai',
  'Indonesian', 'Bengali', 'Bulgarian', 'Czech', 'Danish', 'Finnish', 'Greek',
  'Hebrew', 'Hungarian', 'Icelandic', 'Latvian', 'Lithuanian', 'Norwegian',
  'Persian', 'Romanian', 'Serbian', 'Slovak', 'Slovenian', 'Croatian',
  'Ukrainian', 'Tagalog', 'Tamil', 'Urdu',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function TranslatePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; msg: string } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const handleTranslate = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      setProgress({ current: 0, total: 1, msg: 'Extracting text from PDF...' });
      const pages = await extractTextFromPdf(files[0]);
      const fullText = pages.join('\n\n');

      if (!fullText.trim()) {
        throw new Error('No text found in the PDF. The file may be scanned/image-based.');
      }

      const result = await translateText(fullText, 'Auto', targetLang, (current, total) => {
        setProgress({ current, total, msg: `Translating chunk ${current} of ${total}...` });
      });

      setProgress({ current: 1, total: 1, msg: 'Creating translated PDF...' });
      const blob = await createPdfFromText(result);
      const name = files[0].name.replace(/\.pdf$/i, `_translated_${targetLang.toLowerCase()}.pdf`);
      setResult({ blob, name });
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [files, targetLang]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.name);
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-sky-50"><Languages className="w-6 h-6 text-sky-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Translate PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Translate your PDF into any language and download as a new PDF</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple={false}
            files={files}
            onFilesSelected={(f) => { setFiles(f); setResult(null); setError(null); }}
            onRemoveFile={() => { setFiles([]); setResult(null); }}
          />

          {files.length > 0 && !result && (
            <div className="mt-6 space-y-5">
              <div className="p-4 bg-gray-50 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">File</span>
                  <span className="text-sm font-medium text-foreground">{files[0].name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Size</span>
                  <span className="text-sm font-medium text-foreground">{formatBytes(files[0].size)}</span>
                </div>
              </div>

              {/* Language selector */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Translate to</label>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full max-w-sm px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {processing && progress && (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <p className="text-sm font-medium text-sky-800">{progress.msg}</p>
                  </div>
                  {progress.total > 1 && (
                    <div className="w-full bg-sky-200 rounded-full h-2">
                      <div className="bg-sky-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                    </div>
                  )}
                </div>
              )}

              {!processing && (
                <button onClick={handleTranslate}
                  className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white hover:shadow-lg hover:shadow-sky-500/25 active:scale-[0.98]">
                  <Languages className="w-4 h-4" /> Translate to {targetLang}
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4 animate-fade-in">
              <div className="p-5 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Translation complete</p>
                  <p className="text-sm text-green-700">Translated to {targetLang} and created as a new PDF.</p>
                </div>
              </div>

              <div className="p-5 bg-gray-50 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Output file</span>
                  <span className="text-sm font-medium text-foreground">{result.name}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">File size</span>
                  <span className="text-lg font-bold text-foreground">{formatBytes(result.blob.size)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleDownload}
                  className="px-6 py-3 rounded-xl font-semibold text-sm bg-primary hover:bg-primary-hover text-white transition-all flex items-center gap-2">
                  <FileDown className="w-4 h-4" /> Download Translated PDF
                </button>
                <button onClick={() => { setResult(null); }}
                  className="px-6 py-3 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors">
                  Translate Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
