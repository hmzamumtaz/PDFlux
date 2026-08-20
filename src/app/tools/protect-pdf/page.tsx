'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { protectPdf } from '@/lib/pdf-engine';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function ProtectPdfPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [allowCopying, setAllowCopying] = useState(false);

  return (
    <ToolPage
      slug="protect-pdf"
      accept=".pdf"
      processLabel="Protect PDF"
      options={
        <div className="space-y-4 max-w-sm">
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
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Permissions</label>
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
        </div>
      }
      onProcess={async (files) => {
        if (!password) throw new Error('Please enter a password');
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        if (password.length < 3) throw new Error('Password must be at least 3 characters');
        const results: Blob[] = [];
        for (const file of files) {
          const blob = await protectPdf(file, password, undefined, {
            allowPrinting,
            allowModifying,
            allowCopying,
            allowFillingForms: true,
          });
          results.push(blob);
        }
        return results;
      }}
    />
  );
}
