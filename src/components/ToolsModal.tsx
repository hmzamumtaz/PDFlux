'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { tools, categories, getToolsByCategory } from '@/lib/tools-data';

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ToolsModal({ isOpen, onClose }: ToolsModalProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = search
    ? tools.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[75vh] flex flex-col animate-slide-up">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="flex-1 text-lg outline-none placeholder:text-muted-foreground/50"
          />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.length === 0 && (
                <p className="col-span-2 text-center text-muted-foreground py-8">No tools found</p>
              )}
              {filtered.map((tool) => {
                const IconComp = (LucideIcons as any)[tool.icon] || LucideIcons.FileText;
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tool.color}12` }}>
                      <IconComp className="w-5 h-5" style={{ color: tool.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map((category) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getToolsByCategory(category).map((tool) => {
                      const IconComp = (LucideIcons as any)[tool.icon] || LucideIcons.FileText;
                      return (
                        <Link
                          key={tool.slug}
                          href={`/tools/${tool.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tool.color}12` }}>
                            <IconComp className="w-5 h-5" style={{ color: tool.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{tool.name}</p>
                            <p className="text-xs text-muted-foreground">{tool.description}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
