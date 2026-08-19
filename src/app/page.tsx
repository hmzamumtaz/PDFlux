'use client';

import { useState } from 'react';
import { Shield, Zap, Lock, ArrowRight, Sparkles, Globe } from 'lucide-react';
import { tools, categories, getToolsByCategory } from '@/lib/tools-data';
import ToolGrid from '@/components/ToolGrid';
import ToolsModal from '@/components/ToolsModal';

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <ToolsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Hero */}
      <section className="pt-20 sm:pt-28 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-border rounded-full text-sm font-medium text-foreground mb-8">
              <Lock className="w-3.5 h-3.5 text-green-500" />
              100% Private &amp; Secure
              <span className="text-muted-foreground">|</span>
              <span>{tools.length}+ Tools</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1] text-foreground">
              Every PDF tool
              <br />
              <span className="text-primary">
                you will ever need
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Merge, split, convert, compress, edit, and secure your PDFs.
              No file size limits. No watermarks. No sign-up required.
            </p>

            <div className="flex items-center justify-center">
              <button
                onClick={() => setModalOpen(true)}
                className="group inline-flex items-center gap-2.5 px-8 py-4 bg-foreground text-white font-bold rounded-2xl transition-all hover:shadow-2xl hover:shadow-foreground/25 active:scale-[0.98] text-base"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tools by Category */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {categories.map((category) => (
          <div key={category} className="mb-14 last:mb-0">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-foreground">{category}</h2>
            </div>
            <ToolGrid tools={getToolsByCategory(category)} />
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="bg-gray-950 text-white py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why PDFlux?</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Built for speed, designed for privacy</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-colors">
              <div className="w-14 h-14 bg-indigo-500/15 rounded-2xl flex items-center justify-center mb-6">
                <Lock className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Your Files Stay Private</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                We never see your files. All processing happens on your device, so your documents never touch our servers. Perfect for confidential and sensitive work.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-colors">
              <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Processing</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                No waiting for uploads. No server queues. Your PDF is processed the moment you hit the button, even large files handle in seconds.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-colors">
              <div className="w-14 h-14 bg-green-500/15 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Limits. No Watermarks.</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Use every tool as many times as you want. No file size restrictions. No watermarks added to your output. Completely free.
              </p>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Works in any modern browser</span>
            <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> No account required</span>
            <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> No data collection</span>
          </div>
        </div>
      </section>
    </div>
  );
}
