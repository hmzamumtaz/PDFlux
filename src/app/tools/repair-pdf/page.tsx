'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { repairPdf } from '@/lib/pdf-engine';

export default function RepairPdfPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  return (
    <ToolPage
      slug="repair-pdf"
      accept=".pdf"
      processLabel="Repair PDF"
      options={
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Rebuilds the PDF&apos;s internal structure (cross-reference table, object
            numbering, trailer) to fix truncated or corrupted files. If the structure
            is unrecoverable, pages are re-rendered into a fresh PDF with a searchable
            text layer.
          </p>
          {status && <p className="text-xs font-medium text-blue-600">{status}</p>}
          {outcome && <p className="text-xs font-medium text-green-600">{outcome}</p>}
        </div>
      }
      onProcess={async (files) => {
        setOutcome(null);
        const res = await repairPdf(files[0], (msg) => setStatus(msg));
        setStatus(null);
        setOutcome(res.message);
        return res.blob;
      }}
    />
  );
}
