'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { pdfToPowerpointStructured } from '@/lib/pdf-to-pptx';
import { assertExpectedInput } from '@/lib/input-guard';

export default function PdfToPowerPointPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  return (
    <ToolPage
      slug="pdf-to-powerpoint"
      accept=".pdf"
      processLabel="Convert to PowerPoint"
      options={
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Reads the document&apos;s structure — headings become slide titles and
            paragraphs become bullet points — instead of pasting raw text. Long
            pages continue onto extra slides.
          </p>
          {status && <p className="text-xs font-medium text-blue-600">{status}</p>}
          {summary && <p className="text-xs font-medium text-green-600">{summary}</p>}
        </div>
      }
      onProcess={async (files) => {
        assertExpectedInput(files[0], {
          extensions: ['.pdf'],
          label: 'a PDF',
          counterpart: { extensions: ['.pptx', '.ppt'], toolName: 'PowerPoint to PDF', does: 'turn slides into a PDF' },
        });
        setSummary(null);
        const res = await pdfToPowerpointStructured(files[0], (p, t) => setStatus(`Reading page ${p} of ${t}...`));
        setStatus(null);
        setSummary(`Built ${res.slides} slide${res.slides === 1 ? '' : 's'} from ${res.pages} page${res.pages === 1 ? '' : 's'}.`);
        return res.blob;
      }}
    />
  );
}
