'use client';

import { useState } from 'react';
import { Shield, Zap, Lock, ArrowRight, Sparkles, Globe, ChevronRight } from 'lucide-react';
import { tools, categories, getToolsByCategory } from '@/lib/tools-data';
import ToolGrid from '@/components/ToolGrid';
import ToolsModal from '@/components/ToolsModal';

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <ToolsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 text-white pt-20 sm:pt-28 pb-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/15 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px]" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-sm font-medium text-white/80 mb-8">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-green-400" />
                100% Private & Secure
              </span>
              <span className="text-white/30">|</span>
              <span>{tools.length}+ Tools</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Every PDF tool
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                you will ever need
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              Merge, split, convert, compress, edit, and secure your PDFs.
              No file size limits. No watermarks. No sign-up required.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setModalOpen(true)}
                className="group inline-flex items-center gap-2.5 px-8 py-4 bg-white text-gray-950 font-bold rounded-2xl transition-all hover:shadow-2xl hover:shadow-white/10 active:scale-[0.98] text-base"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <div className="flex items-center gap-6 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-400" />
                  Zero uploads
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Lightning fast
                </span>
              </div>
            </div>

            {/* Floating tool icons */}
            <div className="mt-16 flex items-center justify-center gap-4 opacity-40">
              {tools.slice(0, 8).map((tool, i) => (
                <div
                  key={tool.slug}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm" style={{ backgroundColor: tool.color }} />
                </div>
              ))}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                <span className="text-xs font-bold text-white/50">+{tools.length - 8}</span>
              </div>
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
                We never see your files. All processing happens on your device — your documents never touch our servers. Perfect for confidential and sensitive work.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-colors">
              <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Processing</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                No waiting for uploads. No server queues. Your PDF is processed the moment you hit the button — even large files handle in seconds.
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
