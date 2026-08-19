'use client';

import { useState, useCallback } from 'react';
import ToolPage from '@/components/ToolPage';
import { htmlToPdf } from '@/lib/pdf-engine';

export default function HtmlToPdfPage() {
  const [html, setHtml] = useState('<h1>Hello World</h1>\n<p>This is a sample HTML document that will be converted to PDF.</p>\n<h2>Features</h2>\n<ul>\n  <li>Supports rich HTML content</li>\n  <li>CSS styling is preserved</li>\n  <li>Images from URLs are included</li>\n</ul>');

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files[0]) {
      const text = await files[0].text();
      setHtml(text);
    }
  }, []);

  return (
    <ToolPage
      slug="html-to-pdf"
      accept=".html,.htm"
      multiple={false}
      processLabel="Convert HTML to PDF"
      onFilesSelected={handleFilesSelected}
      onProcess={async () => htmlToPdf(html)}
    >
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">HTML content</label>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={10}
          className="w-full px-4 py-3 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
          placeholder="Paste your HTML here, or upload an .html file above..."
        />
      </div>
    </ToolPage>
  );
}
