'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, FileDown, Code2, Eye, Palette, Type } from 'lucide-react';
import Link from 'next/link';
import { htmlToPdf, htmlToPdfVisual, downloadBlob, getOutputFilename } from '@/lib/pdf-engine';

const SAMPLE_HTML = `<div style="font-family: Georgia, serif; padding: 24px;">
  <h1 style="color: #4338ca; border-bottom: 3px solid #4338ca; padding-bottom: 8px;">Hello World</h1>
  <p>This HTML is <strong>rendered with its full design</strong> — colors, fonts,
  backgrounds and layout — and then converted to PDF.</p>
  <div style="background: linear-gradient(135deg, #eef2ff, #fdf4ff); border: 1px solid #c7d2fe; border-radius: 12px; padding: 16px; margin: 16px 0;">
    <h2 style="margin: 0 0 8px; color: #6d28d9;">Styled box</h2>
    <p style="margin: 0;">CSS styling is preserved exactly as the browser renders it.</p>
  </div>
  <ul>
    <li>Upload an .html file or paste markup</li>
    <li>Check the live design preview</li>
    <li>Convert to PDF</li>
  </ul>
</div>`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function HtmlToPdfPage() {
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [mode, setMode] = useState<'design' | 'text'>('design');
  const [tab, setTab] = useState<'code' | 'preview'>('preview');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHtml(await file.text());
    setTab('preview');
    setResultSize(null);
    setError(null);
    e.target.value = '';
  }, []);

  // Preview in a fully sandboxed frame (no scripts, no same-origin access).
  const previewDoc = useMemo(() => {
    if (/<html[\s>]/i.test(html)) return html;
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5;color:#111">${html}</body></html>`;
  }, [html]);

  const handleConvert = useCallback(async () => {
    if (!html.trim()) { setError('Paste some HTML or upload an .html file first.'); return; }
    setProcessing(true);
    setError(null);
    setResultSize(null);
    try {
      const blob = mode === 'design'
        ? await htmlToPdfVisual(html, setProgress)
        : await htmlToPdf(html);
      downloadBlob(blob, getOutputFilename('html-to-pdf', '.pdf'));
      setResultSize(blob.size);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed. Please check the HTML and try again.');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  }, [html, mode]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-violet-50"><Code2 className="w-6 h-6 text-violet-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">HTML to PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Render the HTML design first, then convert it to PDF</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm space-y-5">
          {/* Source: upload or paste */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-all">
              <FileDown className="w-4 h-4 rotate-180" /> Upload .html file
              <input type="file" accept=".html,.htm" onChange={handleFileUpload} className="hidden" />
            </label>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setTab('preview')} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${tab === 'preview' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Eye className="w-3.5 h-3.5" /> Design preview
              </button>
              <button onClick={() => setTab('code')} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${tab === 'code' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Code2 className="w-3.5 h-3.5" /> HTML code
              </button>
            </div>
          </div>

          {/* Editor / live design preview */}
          {tab === 'code' ? (
            <textarea
              value={html}
              onChange={(e) => { setHtml(e.target.value); setResultSize(null); }}
              rows={16}
              spellCheck={false}
              className="w-full px-4 py-3 border border-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y bg-gray-50/50"
              placeholder="Paste your HTML here, or upload an .html file above..."
            />
          ) : (
            <div className="border border-border rounded-xl overflow-hidden bg-gray-100">
              <div className="px-4 py-2 bg-gray-50 border-b border-border text-xs font-medium text-muted-foreground">
                Live preview — this is the design that will be converted
              </div>
              <iframe
                sandbox=""
                srcDoc={previewDoc}
                title="HTML design preview"
                className="w-full bg-white"
                style={{ height: 420, border: 0 }}
              />
            </div>
          )}

          {/* Output mode */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">PDF output</label>
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => setMode('design')} className={`text-left p-4 rounded-xl border-2 transition-all ${mode === 'design' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1"><Palette className={`w-4 h-4 ${mode === 'design' ? 'text-primary' : 'text-muted-foreground'}`} /><span className="text-sm font-semibold">Exact design</span></div>
                <p className="text-xs text-muted-foreground">Renders the page with full CSS — colors, fonts, backgrounds, layout — exactly as previewed. Recommended.</p>
              </button>
              <button onClick={() => setMode('text')} className={`text-left p-4 rounded-xl border-2 transition-all ${mode === 'text' ? 'border-primary bg-primary/5' : 'border-border hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1"><Type className={`w-4 h-4 ${mode === 'text' ? 'text-primary' : 'text-muted-foreground'}`} /><span className="text-sm font-semibold">Selectable text</span></div>
                <p className="text-xs text-muted-foreground">Re-typesets the content as real PDF text you can select and search, with simplified styling.</p>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {processing && progress && (
            <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
              <p className="text-sm font-medium text-violet-800">{progress}</p>
            </div>
          )}

          {resultSize !== null && !processing && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800"><span className="font-semibold">PDF downloaded</span> ({formatBytes(resultSize)}).</p>
            </div>
          )}

          <button onClick={handleConvert} disabled={processing || !html.trim()}
            className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting...</> : <><FileDown className="w-4 h-4" /> Convert to PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}
