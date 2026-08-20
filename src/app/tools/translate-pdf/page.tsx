'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Languages, AlertCircle, Download, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { extractTextFromPdf, translateText, downloadBlob } from '@/lib/pdf-engine';

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Dutch',
  'Swedish', 'Polish', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian', 'English',
];

export default function TranslatePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [translated, setTranslated] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setTranslated('');
    setCopied(false);
    try {
      const pages = await extractTextFromPdf(files[0]);
      const fullText = pages.join('\n\n');

      if (!fullText.trim()) {
        throw new Error('No text found in the PDF. The file may be scanned/image-based.');
      }

      const result = await translateText(fullText, 'Auto', targetLang, (current, total) => {
        setProgress({ current, total });
      });

      setTranslated(result);
      const blob = new Blob([result], { type: 'text/plain; charset=utf-8' });
      downloadBlob(blob, `${files[0].name.replace(/\.pdf$/i, '')}_${targetLang.toLowerCase()}.txt`);
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [files, targetLang]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(translated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [translated]);

  const handleDownloadTranslated = useCallback(() => {
    if (!translated) return;
    const blob = new Blob([translated], { type: 'text/plain; charset=utf-8' });
    const name = files[0] ? `${files[0].name.replace(/\.pdf$/i, '')}_${targetLang.toLowerCase()}.txt` : `translated_${targetLang.toLowerCase()}.txt`;
    downloadBlob(blob, name);
  }, [translated, files, targetLang]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-sky-50">
              <Languages className="w-6 h-6 text-sky-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Translate PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Extract text and translate to any language</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple={false}
            files={files}
            onFilesSelected={(f) => { setFiles(f); setTranslated(''); setError(null); setCopied(false); }}
            onRemoveFile={() => { setFiles([]); setTranslated(''); }}
          />

          {files.length > 0 && !translated && !processing && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Translate to</label>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full max-w-sm px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </div>
              <button onClick={handleTranslate} className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white hover:shadow-lg hover:shadow-sky-500/25 active:scale-[0.98]">
                <Languages className="w-4 h-4" /> Translate
              </button>
            </div>
          )}

          {processing && progress && (
            <div className="mt-6 p-4 bg-sky-50 border border-sky-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                <p className="text-sm font-medium text-sky-800">Translating chunk {progress.current} of {progress.total}...</p>
              </div>
              <div className="w-full bg-sky-200 rounded-full h-2">
                <div className="bg-sky-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {translated && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Translated to {targetLang}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                    {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                  <button onClick={handleDownloadTranslated} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-hover transition-colors flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download .txt
                  </button>
                </div>
              </div>
              <div className="p-5 bg-gray-50 rounded-xl border border-border max-h-96 overflow-y-auto">
                <pre className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {translated}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
