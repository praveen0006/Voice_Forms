import type { Metadata } from "next";
import Link from 'next/link';
import "./globals.css";
import ThemeToggle from '@/components/ThemeToggle';

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
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('voiceform_theme');
                  var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) { }
              })()
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased" suppressHydrationWarning={true}>
        {/* Background Mesh & Glows */}
        <div className="bg-tech-core">
          <div className="tech-grid-bg"></div>
          <div className="aurora-glow aurora-1"></div>
          <div className="aurora-glow aurora-2"></div>
          <div className="aurora-glow top-center-glow"></div>
          
          {/* Atmosphere Particles */}
          <div className="particle-node p1"></div>
          <div className="particle-node p2"></div>
          <div className="particle-node p3"></div>

          {/* Neural Waveform Horizon */}
          <div className="absolute bottom-0 left-0 w-full h-[30vh] opacity-20 pointer-events-none z-[-1] overflow-hidden">
            <svg viewBox="0 0 1440 320" className="w-full h-full preserve-3d">
              <path 
                className="neural-wave-path"
                fill="none" 
                stroke="var(--accent-primary)" 
                strokeWidth="2"
                d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192"
                style={{ filter: 'drop-shadow(0 0 20px var(--accent-glow))' }}
              />
            </svg>
          </div>
        </div>

        <header
          className="sticky top-0 z-[100] backdrop-blur-3xl border-b border-white/5"
          style={{ background: 'var(--bg-glass)' }}
        >
          <div className="app-container h-20 sm:h-24 flex items-center justify-between px-6 sm:px-10">
            <Link href="/" className="flex items-center gap-3 sm:gap-4 no-underline group">
              <div
                className="p-3 sm:p-3.5 rounded-[18px] sm:rounded-[22px] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-[0_10px_35px_rgba(6,182,212,0.4)]"
                style={{ background: 'var(--primary-gradient)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="sm:w-6 sm:h-6">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <span className="font-black text-2xl sm:text-3xl tracking-tighter uppercase italic text-primary flex items-center">
                VOICE<span className="text-tech-glow ml-1">FORM</span>
              </span>
            </Link>

            <nav className="flex items-center gap-4 sm:gap-6">
              <ThemeToggle />
              <Link
                href="https://nexeraeco.vercel.app/" target="_blank" rel="noopener noreferrer"
                className="hidden md:inline-flex px-6 py-2.5 bg-white/5 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-cyan-400 transition-all shadow-xl active:scale-95"
              >
                Cyber-Link v2.0
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 py-16 px-4">
          <div className="app-container relative z-10 w-full" style={{ maxWidth: '1000px' }}>
            {children}
          </div>
        </main>

        <footer className="py-20 border-t border-white/5 bg-black/40">
          <div className="app-container text-center flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 py-3 px-8 bg-white/5 rounded-full border border-white/5 shadow-2xl">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Engineered by</span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500">NexEraEco</span>
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
