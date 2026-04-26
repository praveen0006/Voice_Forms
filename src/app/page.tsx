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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this form and all its responses? This cannot be undone.')) return;
    
    try {
      const { error } = await supabase.from('forms').delete().eq('id', id);
      if (error) throw error;
      
      const updated = recentForms.filter(f => f.id !== id);
      setRecentForms(updated);
      localStorage.setItem('voiceform_my_forms', JSON.stringify(updated));
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete form');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-32 relative overflow-hidden" style={{ minHeight: 'min-content' }}>
      {/* Hero Section */}
      <section className="text-center animate-slide-up w-full px-4 sm:px-0" style={{ maxWidth: '900px' }}>
        {/* Animated Brand Node */}
        <div className="relative mx-auto mb-16 group cursor-pointer animate-float">
          <div className="absolute inset-0 bg-violet-600/40 blur-[50px] rounded-full group-hover:bg-violet-600/60 transition-all duration-1000"></div>
          <div className="absolute -inset-4 border border-white/5 rounded-[40px] rotate-6 group-hover:rotate-0 transition-transform duration-700"></div>
          <div className="absolute -inset-8 border border-white/5 rounded-[50px] -rotate-3 group-hover:rotate-0 transition-transform duration-1000 delay-100"></div>
          <div
            className="relative mx-auto w-24 h-24 sm:w-32 sm:h-32 rounded-[35px] bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center shadow-premium group-hover:scale-110 transition-all duration-700"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="white shadow-2xl" className="sm:w-16 sm:h-16">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
        </div>

        <h1 className="text-balance text-4xl sm:text-7xl lg:text-8xl font-black mb-8 leading-[0.95] tracking-tighter text-white uppercase italic">
          Sculpted for<br />
          <span className="italic-gradient-text drop-shadow-[0_0_40px_rgba(139,92,246,0.4)]">the user voice</span>
        </h1>

        <p className="text-xl sm:text-2xl mb-16 leading-relaxed max-w-2xl mx-auto font-black uppercase tracking-widest text-[#64748b] opacity-80">
          Transforming standard surveys into <span className="text-white italic">high-fidelity</span> conversational experiences.
        </p>

        {/* Quick Activation Card */}
        <div className="glass-card p-10 sm:p-14 text-left mx-auto mb-32 relative border-white/5 rounded-[50px] shadow-premium group/create" style={{ maxWidth: '700px', animationDelay: '0.1s' }}>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[11px] font-black px-6 py-2 rounded-2xl shadow-[0_0_20px_rgba(139,92,246,0.6)] tracking-[0.3em] uppercase italic">Deploy New Node</div>
          
          <div className="flex flex-col gap-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label
                  htmlFor="form-title"
                  className="text-[11px] font-black text-violet-400 mb-2 block uppercase tracking-[0.25em]"
                >
                  01. Project Identifier
                </label>
                <input
                  id="form-title"
                  type="text"
                  placeholder="E.g. Product Feedback"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field py-6 px-7 text-lg font-black uppercase tracking-tight bg-white/[0.01] border-white/5 focus:bg-white/[0.03] transition-all rounded-3xl"
                  autoFocus
                />
              </div>

              <div className="space-y-4">
                <label
                  htmlFor="form-email"
                  className="text-[11px] font-black text-pink-400 mb-2 block uppercase tracking-[0.25em]"
                >
                  02. Intelligence Intel
                </label>
                <input
                  id="form-email"
                  type="email"
                  placeholder="alerts@nexera.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="input-field py-6 px-7 text-lg font-black uppercase tracking-tight bg-white/[0.01] border-white/5 focus:bg-white/[0.03] transition-all rounded-3xl"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="btn-primary w-full h-24 text-2xl font-black tracking-tighter group relative overflow-hidden rounded-[32px] shadow-[0_20px_50px_rgba(139,92,246,0.3)] transition-all active:scale-95"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center justify-center gap-5 uppercase italic">
                {isCreating ? (
                  <>
                    <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Synthesizing...
                  </>
                ) : (
                  <>
                    Initialize Stream
                    <svg className="group-hover:translate-x-3 transition-transform duration-700" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Global Registry Section */}
        {recentForms.length > 0 && (
          <div className="mt-16 animate-fade-in text-left w-full border-t border-white/5 pt-24 pb-32">
            <div className="flex items-center justify-between mb-16 px-4">
              <h2 className="text-3xl font-black tracking-tighter text-white flex items-center gap-6 uppercase italic">
                <div className="w-16 h-1.5 bg-violet-600 rounded-full"></div>
                Active Node Registry
              </h2>
              <div className="px-6 py-2 bg-white/5 rounded-full border border-white/5">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">
                  {recentForms.length} Objects Live
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {recentForms.slice(0, 6).map((form, i) => (
                <div 
                  key={form.id} 
                  className="group/project animate-slide-up"
                  style={{ animationDelay: `${0.2 + i * 0.1}s` }}
                >
                  <div className="glass-card p-10 sm:p-12 border-white/5 rounded-[45px] hover:border-violet-500/30 transition-all duration-700 shadow-premium relative overflow-hidden h-full flex flex-col">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-600/[0.03] to-transparent pointer-events-none"></div>
                    
                    <div className="flex flex-col flex-1 gap-10">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 truncate pr-6">
                           <div className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 mb-3 block">Instance // 0{recentForms.length - i}</div>
                           <h3 className="font-black text-2xl sm:text-3xl text-white group-hover/project:italic-gradient-text transition-all truncate tracking-tighter uppercase italic leading-none">
                            {form.title}
                          </h3>
                          <div className="mt-5 flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                            <span className="flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              Synched {new Date(form.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="w-16 h-16 rounded-[24px] bg-white/[0.03] flex items-center justify-center shrink-0 border border-white/10 group-hover/project:bg-violet-600 transition-all duration-700 shadow-xl">
                          <span className="text-2xl">🎙️</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                         <Link href={`/create/${form.id}`} className="btn-primary flex-1 h-14 rounded-2xl shadow-xl">
                          Configure Node
                        </Link>
                        <Link href={`/responses/${form.id}`} className="btn-secondary flex-1 h-14 rounded-2xl shadow-xl">
                          Intelligence
                        </Link>
                        <button 
                          onClick={() => handleDelete(form.id)}
                          className="btn-danger h-14 w-14 rounded-2xl shrink-0"
                          title="Purge Object"
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover/project:rotate-12 group-hover/project:scale-110">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
