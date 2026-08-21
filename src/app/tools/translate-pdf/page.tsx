'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Languages, AlertCircle, Copy, Check, FileDown, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { extractTextFromPdf, translateText, createPdfFromText, downloadBlob, getOutputFilename } from '@/lib/pdf-engine';

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
  const [sourceLang, setSourceLang] = useState('Auto');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; msg: string } | null>(null);
  const [translated, setTranslated] = useState('');
  const [copied, setCopied] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setTranslated('');
    setCopied(false);
    try {
      setProgress({ current: 0, total: 1, msg: 'Extracting text from PDF...' });
      const pages = await extractTextFromPdf(files[0]);
      const fullText = pages.join('\n\n');

      if (!fullText.trim()) {
        throw new Error('No text found in the PDF. The file may be scanned/image-based.');
      }

      const result = await translateText(fullText, sourceLang, targetLang, (current, total) => {
        setProgress({ current, total, msg: `Translating chunk ${current} of ${total}...` });
      });

      setTranslated(result);
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [files, sourceLang, targetLang]);

  const handleDownloadPdf = useCallback(async () => {
    if (!translated) return;
    const blob = await createPdfFromText(translated, `Translation (${targetLang})`);
    downloadBlob(blob, getOutputFilename('translate-pdf', '.pdf'));
  }, [translated, targetLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(translated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
              <p className="text-muted-foreground text-sm sm:text-base">Extract text from your PDF and translate it to any language</p>
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

          {files.length > 0 && !translated && (
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

              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Source language</label>
                  <div className="relative">
                    <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white cursor-pointer">
                      <option value="Auto">Auto-detect</option>
                      {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Translate to</label>
                  <div className="relative">
                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white cursor-pointer">
                      {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p className="text-xs text-sky-800 leading-relaxed">
                  Unlike the other tools, translation sends the extracted text to a free
                  public translation service (Lingva / LibreTranslate / MyMemory). Do not
                  translate confidential documents.
                </p>
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

          {translated && (
            <div className="mt-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Translated to {targetLang}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleDownloadPdf}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors flex items-center gap-2">
                    <FileDown className="w-4 h-4" /> Download PDF
                  </button>
                  <button onClick={handleCopy}
                    className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors flex items-center gap-2">
                    {copied ? <><Check className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                  </button>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-xl border border-border max-h-[32rem] overflow-y-auto">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{translated}</p>
              </div>

              <button onClick={() => { setTranslated(''); setCopied(false); }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors">
                Translate Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
