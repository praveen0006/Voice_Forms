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
      } catch { }
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
    <div className="w-full relative overflow-hidden flex flex-col items-center">
      {/* Background Atmosphere Shim for Page-Specific Layering if needed */}
      
      <section className="w-full animate-fade-in max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-20 lg:py-32">
        <div className="text-center mb-16 sm:mb-24 flex flex-col items-center">
          <div className="relative mb-12 group cursor-pointer animate-float">
            <div className="absolute inset-0 bg-cyan-600/20 blur-[60px] rounded-full"></div>
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[35px] bg-gradient-to-br from-cyan-600 to-sky-500 flex items-center justify-center shadow-premium group-hover:scale-105 transition-all duration-700">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="white shadow-2xl">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
          </div>

          <h1 className="text-balance text-6xl sm:text-8xl lg:text-9xl font-black mb-6 sm:mb-8 leading-[0.85] sm:leading-[0.8] tracking-tighter text-primary uppercase italic">
            Voice<br />
            <span className="text-tech-glow drop-shadow-[0_0_80px_rgba(6,182,212,0.5)]">Feedback</span>
          </h1>

          <p className="text-base sm:text-lg lg:text-xl mb-12 sm:mb-16 leading-relaxed max-w-xl mx-auto font-black uppercase tracking-[0.3em] text-slate-500/60 px-4">
            Easy Voice Forms
          </p>
        </div>

        {/* Focused Creation Hub */}
        <div className="glass-card mb-20 sm:mb-40 p-6 sm:p-12 lg:p-20 border-white/5 shadow-premium relative overflow-hidden rounded-[40px] sm:rounded-[60px] mx-auto max-w-4xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-600/5 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col gap-8 sm:gap-14">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-14">
                <div className="space-y-4 sm:space-y-6">
                  <label className="text-[9px] font-black text-cyan-400 mb-2 block uppercase tracking-[0.5em] font-mono">01. Form Title</label>
                  <input
                    type="text"
                    placeholder="E.g. Product Feedback"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field py-4 sm:py-7 px-6 sm:px-8 text-lg sm:text-2xl font-black uppercase tracking-tight bg-white/[0.01] border-white/5 focus:bg-white/[0.03] transition-all rounded-[20px] sm:rounded-[32px] placeholder:text-slate-800"
                  />
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <label className="text-[9px] font-black text-sky-400 mb-2 block uppercase tracking-[0.5em] font-mono">02. Alert Email</label>
                  <input
                    type="email"
                    placeholder="alerts@nexera.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="input-field py-4 sm:py-7 px-6 sm:px-8 text-lg sm:text-2xl font-black uppercase tracking-tight bg-white/[0.01] border-white/5 focus:bg-white/[0.03] transition-all rounded-[20px] sm:rounded-[32px] placeholder:text-slate-800"
                  />
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="btn-primary w-full h-20 sm:h-24 text-xl sm:text-2xl group active:scale-[0.98] transition-all shadow-premium"
              >
                <span className="flex items-center justify-center gap-4 sm:gap-5 uppercase italic tracking-tight">
                  {isCreating ? "Making..." : "Make Form"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Projects List */}
        {recentForms.length > 0 && (
          <div className="animate-fade-in w-full pb-32">
            <div className="flex items-center justify-between mb-10 px-4">
               <h2 className="text-2xl font-black tracking-tighter text-primary uppercase italic">
                 My Forms
               </h2>
               <span className="tech-label">
                 {recentForms.length} Done
               </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 px-4 sm:px-0">
              {recentForms.slice(0, 6).map((form, i) => (
                <div key={form.id} className="group/project animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="glass-card p-6 sm:p-10 border-white/5 rounded-[32px] sm:rounded-[40px] hover:border-cyan-500/20 transition-all duration-700 shadow-premium relative overflow-hidden">
                    <div className="flex flex-col gap-6 sm:gap-10">
                      <div className="flex flex-col gap-2">
                        <div className="text-[9px] font-black font-mono text-cyan-600 uppercase tracking-[0.2em] mb-2 opacity-80">ID: {form.id.slice(0, 8)}</div>
                        <h3 className="font-black text-2xl sm:text-3xl text-primary group-hover/project:text-cyan-400 transition-all truncate tracking-tighter uppercase italic leading-none">
                          {form.title}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full">
                        <Link href={`/create/${form.id}`} className="btn-primary flex-1 h-12 rounded-2xl text-[10px] shadow-premium font-black uppercase text-center flex items-center justify-center">
                          Settings
                        </Link>
                        <Link href={`/responses/${form.id}`} className="btn-secondary flex-1 h-12 rounded-2xl text-[10px] shadow-xl font-black uppercase text-center flex items-center justify-center">
                          Check
                        </Link>
                        <button 
                          onClick={() => handleDelete(form.id)}
                          className="h-12 w-12 rounded-2xl border border-white/5 flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all shrink-0 bg-white/5"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
