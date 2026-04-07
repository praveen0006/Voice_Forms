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
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {/* Hero Section */}
      <div className="text-center animate-slide-up w-full px-4 sm:px-0" style={{ maxWidth: '640px' }}>
        {/* Icon */}
        <div
          className="mx-auto mb-6"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-pink))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 60px var(--accent-violet-glow)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </div>

        <h1 className="text-balance text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 leading-tight">
          Create forms with{' '}
          <span className="gradient-text">your voice</span>
        </h1>

        <p className="text-base sm:text-lg mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Record audio questions, share a link, and collect voice or text responses.
          No accounts needed — just record and share.
        </p>

        {/* Create Form Card */}
        <div className="glass-card p-6 text-left" style={{ animationDelay: '0.1s' }}>
          <label
            htmlFor="form-title"
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}
          >
            FORM TITLE
          </label>
          <input
            id="form-title"
            type="text"
            placeholder="e.g. Interview Questions, Class Survey..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field mb-4"
            autoFocus
          />

          <label
            htmlFor="form-email"
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}
          >
            NOTIFICATION EMAIL (OPTIONAL)
          </label>
          <input
            id="form-email"
            type="email"
            placeholder="Where should we send alert emails?"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="input-field mb-6"
          />

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="btn-primary w-full"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isCreating ? (
              <>
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create VoiceForm
              </>
            )}
          </button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {[
            { icon: '🎙️', label: 'Record Questions', desc: 'Use your voice' },
            { icon: '🔗', label: 'Share a Link', desc: 'No login needed' },
            { icon: '🎧', label: 'Collect Answers', desc: 'Voice or text' },
          ].map((f, i) => (
            <div
              key={i}
              className="animate-fade-in"
              style={{
                padding: '20px',
                background: 'var(--bg-glass)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
                animationDelay: `${0.2 + i * 0.1}s`,
                animationFillMode: 'backwards',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{f.label}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Data Security Info */}
        <div className="mt-12 animate-fade-in text-left p-6 glass-card" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            What happens to your data?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1">💾</div>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Storage:</strong>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Audio and form data securely saved in a scalable cloud Postgres DB.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1">🤖</div>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Processing:</strong>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>No hidden AI training or processing on your voice.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Forms Section */}
        {recentForms.length > 0 && (
          <div className="mt-16 w-full text-left mx-auto animate-fade-in px-4 sm:px-0" style={{ maxWidth: '640px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-secondary)' }}>
              Your Recent Forms
            </h2>
            <div className="flex flex-col gap-3">
              {recentForms.map((form) => (
                <div key={form.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '4px' }}>{form.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(form.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                    <Link href={`/form/${form.id}`} className="btn-secondary text-center" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', background: 'var(--bg-glass-strong)' }}>
                      Share
                    </Link>
                    <Link href={`/create/${form.id}`} className="btn-secondary text-center" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', background: 'var(--bg-glass-strong)' }}>
                      Edit
                    </Link>
                    <Link href={`/responses/${form.id}`} className="btn-primary text-center col-span-2 sm:col-span-1" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}>
                      Responses
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
