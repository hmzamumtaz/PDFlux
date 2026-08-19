'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { protectPdf } from '@/lib/pdf-engine';

export default function ProtectPdfPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <ToolPage
      slug="protect-pdf"
      accept=".pdf"
      processLabel="Protect PDF"
      options={
        <div className="space-y-3 max-w-sm">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              Note: Password encryption requires server-side processing. This tool currently re-saves your PDF with protection metadata. For true password protection, a server-side solution is needed.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {password && confirm && password !== confirm && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>
      }
      onProcess={async (files) => {
        if (!password) throw new Error('Please enter a password');
        if (password !== confirm) throw new Error('Passwords do not match');
        return protectPdf(files[0], password);
      }}
    />
  );
}
