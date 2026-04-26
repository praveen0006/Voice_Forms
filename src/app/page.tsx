'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface SavedForm {
  id: string;
  title: string;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [recentForms, setRecentForms] = useState<SavedForm[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('voiceform_my_forms');
    if (saved) {
      try {
        setRecentForms(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const handleCreate = async () => {
    const formTitle = title.trim() || 'Untitled Form';
    const formEmail = email.trim() || null;
    setIsCreating(true);

    try {
      const { data, error } = await supabase
        .from('forms')
        .insert({ title: formTitle, notification_email: formEmail })
        .select()
        .single();

      if (error) throw error;
      
      const newForm = { id: data.id, title: data.title, created_at: data.created_at };
      const updatedForms = [newForm, ...recentForms];
      localStorage.setItem('voiceform_my_forms', JSON.stringify(updatedForms));

      router.push(`/create/${data.id}`);
    } catch (err) {
      console.error('Error creating form:', err);
      alert('Failed to create form. Make sure Supabase is configured correctly.');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-12" style={{ minHeight: 'min-content' }}>
      {/* Hero Section */}
      <section className="text-center animate-slide-up w-full px-2 sm:px-0" style={{ maxWidth: '800px' }}>
        {/* Icon */}
        <div
          className="mx-auto mb-6 sm:mb-8"
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-pink))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 50px var(--accent-violet-glow)',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </div>

        <h1 className="text-balance text-3xl sm:text-5xl md:text-6xl font-extrabold mb-4 sm:mb-6 leading-[1.1] tracking-tight">
          Create forms with{' '}
          <span className="gradient-text">your voice</span>
        </h1>

        <p className="text-sm sm:text-xl mb-8 sm:mb-10 leading-relaxed max-w-2xl mx-auto" style={{ color: '#cbd5e1' }}>
          Record audio questions, share a link, and collect responses. 
          Respondents listen and reply with voice or text — no login required.
        </p>

        {/* Create Form Card */}
        <div className="glass-card p-5 sm:p-8 text-left mx-auto mb-10 overflow-hidden" style={{ maxWidth: '580px', animationDelay: '0.1s' }}>
          <div className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="form-title"
                style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-violet-light)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Form Name
              </label>
              <input
                id="form-title"
                type="text"
                placeholder="e.g. Weekly Feedback, Quick Quiz..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="form-email"
                style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-violet-light)', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Email Notifications (Optional)
              </label>
              <input
                id="form-email"
                type="email"
                placeholder="Your email for alerts"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="input-field"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="btn-primary w-full group"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                  Initializing...
                </>
              ) : (
                <>
                  <svg className="group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Get Started for Free
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-16">
          {[
            { icon: '🎙️', label: 'Audio First', desc: 'True voice interaction' },
            { icon: '🔗', label: 'Instant Share', desc: 'Magic link enabled' },
            { icon: '🛡️', label: 'Private', desc: 'Secure voice data' },
          ].map((f, i) => (
            <div
              key={i}
              className="animate-fade-in group p-4 sm:p-6"
              style={{
                background: 'var(--bg-glass)',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
                animationDelay: `${0.2 + i * 0.1}s`,
                animationFillMode: 'backwards',
              }}
            >
              <div className="text-2xl sm:text-3xl mb-3 group-hover:scale-110 transition-transform cursor-default">{f.icon}</div>
              <div className="font-bold text-xs sm:text-sm mb-1">{f.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', sm: '0.75rem' }}>{f.desc}</div>
            </div>
          ))}
        </div>
        
        {/* Recent Forms Section */}
        {recentForms.length > 0 && (
          <div className="mt-8 border-t pt-12 animate-fade-in text-left">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: 'var(--text-primary)' }}>
              Recent Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentForms.slice(0, 4).map((form) => (
                <div key={form.id} className="glass-card p-5 group">
                  <div className="flex flex-col h-full gap-4">
                    <div>
                      <div className="font-bold text-lg mb-1 group-hover:text-violet-400 transition-colors truncate">{form.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Created {new Date(form.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      <Link href={`/form/${form.id}`} className="btn-secondary flex-1 py-2 text-xs">
                        View
                      </Link>
                      <Link href={`/create/${form.id}`} className="btn-secondary flex-1 py-2 text-xs">
                        Edit
                      </Link>
                      <Link href={`/responses/${form.id}`} className="btn-primary flex-1 py-2 text-xs text-nowrap">
                        Responses
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {recentForms.length > 4 && (
              <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                And {recentForms.length - 4} other forms saved locally.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
