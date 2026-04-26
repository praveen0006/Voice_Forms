import type { Metadata } from "next";
import Link from 'next/link';
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceForm — Audio-First Form Builder",
  description: "Create forms with voice questions. Respondents listen and answer using voice or text. Like Google Forms, but for audio-first interaction.",
  keywords: ["voice forms", "audio forms", "survey", "form builder", "audio questions"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-dot-grid min-h-screen flex flex-col antialiased" suppressHydrationWarning={true}>
        {/* Background Aurora */}
        <div className="bg-aurora">
          <div className="aurora-glow aurora-1"></div>
          <div className="aurora-glow aurora-2"></div>
        </div>

        <header 
          className="sticky top-0 z-[100] backdrop-blur-2xl border-b border-white/5"
          style={{ background: 'rgba(10, 14, 39, 0.4)' }}
        >
          <div className="app-container h-24 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-4 no-underline group">
              <div 
                className="p-3.5 rounded-[22px] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-[0_10px_30px_rgba(139,92,246,0.5)]"
                style={{ background: 'var(--primary-gradient)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white shadow-lg">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <span className="font-black text-3xl tracking-tighter uppercase italic text-white flex items-center">
                VOICE<span className="italic-gradient-text ml-1.5">FORM</span>
              </span>
            </Link>
            
            <nav className="flex items-center gap-8">
              <Link 
                href="https://nexeraeco.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="hidden sm:inline-flex px-6 py-2.5 bg-white/5 rounded-full border border-white/5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-all shadow-xl active:scale-95"
              >
                Protocol v1.0
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 py-16 px-4">
          <div className="app-container relative z-10 w-full" style={{ maxWidth: '1000px' }}>
            {children}
          </div>
        </main>
        
        <footer className="py-20 border-t border-white/5 bg-black/20">
          <div className="app-container text-center flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 py-3 px-8 bg-white/5 rounded-full border border-white/5 shadow-2xl">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Engineered by</span>
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-violet-500">NexEraEco</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
              Transforming the human voice into actionable intelligence.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
