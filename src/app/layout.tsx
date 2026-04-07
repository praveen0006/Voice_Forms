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
      <body className="bg-mesh min-h-screen flex flex-col">
        {/* Top nav bar */}
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(10, 14, 39, 0.8)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Logo */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-pink))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Voice<span className="gradient-text">Form</span>
              </span>
            </Link>
          </div>
        </nav>

        {/* Main content */}
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', flex: '1 0 auto' }}>
          {children}
        </main>
        
        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          padding: '24px',
          marginTop: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}>
          <p>
            © {new Date().getFullYear()} VoiceForm. All rights reserved. •{' '}
            <Link href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
              Privacy & Terms
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
