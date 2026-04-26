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
      <body className="bg-mesh min-h-screen flex flex-col" suppressHydrationWarning={true}>
        <header 
          className="sticky top-0 z-50 backdrop-blur-md border-b"
          style={{ 
            background: 'rgba(10, 14, 39, 0.7)', 
            borderColor: 'var(--border-subtle)' 
          }}
        >
          <div className="app-container h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 no-underline group hover:opacity-90 transition-opacity">
              <div 
                className="p-2 rounded-xl group-hover:scale-110 transition-transform"
                style={{ background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-pink))' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <span className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Voice<span className="gradient-text">Form</span>
              </span>
            </Link>
            
            <nav className="flex items-center gap-4">
              <Link 
                href="/privacy" 
                className="text-xs sm:text-sm font-medium no-underline hover:text-white transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Privacy
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 py-8 sm:py-12 px-2 sm:px-4">
          <div className="app-container">
            {children}
          </div>
        </main>
        
        <footer className="py-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="app-container text-center">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              © <span suppressHydrationWarning>{new Date().getFullYear()}</span> Voice<span className="font-bold">Form</span>. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
