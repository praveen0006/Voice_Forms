'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Form, Question, Response as DbResponse, Answer } from '@/lib/types';
import AudioPlayer from '@/components/AudioPlayer';
import Link from 'next/link';

interface RespondentData {
  response: DbResponse;
  answers: Record<string, Answer>; // Keyed by question_id
}

export default function ResponsesDashboard() {
  const params = useParams();
  const formId = params.formId as string;

  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [respondents, setRespondents] = useState<RespondentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      // Fetch Form
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (formError || !formData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setForm(formData);

      // Fetch Questions
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('form_id', formId)
        .order('order_index');

      if (qData) setQuestions(qData);

      // Fetch Responses
      const { data: rData } = await supabase
        .from('responses')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (rData && rData.length > 0) {
        // Fetch Answers for these responses
        const { data: aData } = await supabase
          .from('answers')
          .select('*')
          .in('response_id', rData.map(r => r.id));

        const formattedRespondents = rData.map((response) => {
          const answersMap: Record<string, Answer> = {};
          if (aData) {
            aData.filter(a => a.response_id === response.id).forEach(a => {
              answersMap[a.question_id] = a;
            });
          }
          return { response, answers: answersMap };
        });

        setRespondents(formattedRespondents);
      }

      setLoading(false);
    }

    loadData();
  }, [formId]);

  const handleDeleteResponse = async (responseId: string) => {
    if (!window.confirm('Are you sure you want to delete this response? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(responseId);
    try {
      // Find files to delete from storage optionally
      const respondent = respondents.find(r => r.response.id === responseId);
      if (respondent) {
        const audioUrls = Object.values(respondent.answers)
          .map(a => a.audio_url)
          .filter(Boolean) as string[];
        
        // Convert full URLs to storage paths (e.g., formId/responseId/questionId.webm)
        if (audioUrls.length > 0) {
          const filesToRemove = audioUrls.map(url => {
            const urlParts = url.split('/voice-answers/');
            return urlParts.length > 1 ? urlParts[1] : null;
          }).filter(Boolean) as string[];

          if (filesToRemove.length > 0) {
            await supabase.storage.from('voice-answers').remove(filesToRemove);
          }
        }
      }

      // Delete from DB (cascades to answers)
      const { error } = await supabase.from('responses').delete().eq('id', responseId);
      
      if (error) throw error;
      
      // Update UI
      setRespondents(prev => prev.filter(r => r.response.id !== responseId));
    } catch (err) {
      console.error('Error deleting response:', err);
      alert('Failed to delete response. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="text-center">
          <svg className="animate-spin mx-auto mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>Loading responses...</p>
        </div>
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="glass-card p-8 text-center" style={{ maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>Form Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            This form doesn&apos;t exist or has been removed.
          </p>
          <Link href="/" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in w-full">
      {/* Header Info */}
      <div className="mb-12 sm:mb-16">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 px-2">
          <div className="space-y-6">
            <Link 
              href="/" 
              className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.25em] text-violet-400 hover:text-white transition-all group shadow-xl"
            >
              <svg className="group-hover:-translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Global Dashboard
            </Link>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white uppercase italic italic-gradient-text">{form.title}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-black tracking-[0.1em] text-emerald-500 uppercase">
                  {respondents.length} ACTIVE {respondents.length === 1 ? 'Submission' : 'Submissions'}
                </span>
              </div>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">
                 Dashboard v1.4
               </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <Link 
               href={`/create/${form.id}`} 
               className="btn-secondary h-16 px-10 rounded-2xl"
             >
               Edit Form
             </Link>
             <Link 
               href={`/form/${form.id}`} 
               className="btn-primary px-10 h-16 flex items-center justify-center rounded-2xl font-black uppercase tracking-tighter shadow-[0_10px_40px_rgba(139,92,246,0.3)] active:scale-95"
             >
               View Form
             </Link>
          </div>
        </div>
      </div>

      {/* Responses List */}
      {respondents.length === 0 ? (
        <div className="glass-card p-20 sm:p-32 text-center shadow-premium border-white/5 rounded-[60px] animate-fade-in relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.03] to-transparent pointer-events-none"></div>
          <div className="w-24 h-24 rounded-[32px] bg-white/5 mx-auto flex items-center justify-center mb-10 border border-white/5 shadow-inner">
            <span className="text-5xl">📡</span>
          </div>
           <h3 className="text-2xl sm:text-3xl font-black mb-4 uppercase tracking-tighter italic text-white">No Responses Yet</h3>
           <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px] max-w-sm mx-auto mb-12 leading-relaxed">
             Share your link to start receiving voice messages from your audience.
           </p>
           <div className="p-5 bg-violet-500/5 rounded-[28px] border border-violet-500/10 inline-flex items-center gap-4 text-xs font-black text-violet-400 tracking-tighter group hover:border-violet-500/30 transition-all cursor-pointer">
              <span className="text-slate-600 uppercase tracking-[0.2em] font-medium mr-2">Link //</span>
              voiceform.app/form/{formId}
           </div>
        </div>
      ) : (
        <div className="space-y-16">
          {respondents.map((respondent, index) => (
            <div 
              key={respondent.response.id} 
              className="group/card animate-slide-up relative" 
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="glass-card overflow-hidden border-0 sm:border border-white/5 shadow-premium rounded-[50px] transition-all duration-700 hover:border-violet-500/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-600/[0.02] to-transparent pointer-events-none"></div>
                
                {/* Respondent Header */}
                <div className="p-8 sm:p-10 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-3xl bg-violet-600 flex items-center justify-center text-white font-black text-2xl shadow-[0_0_30px_rgba(139,92,246,0.3)] group-hover/card:scale-110 group-hover/card:-rotate-3 transition-all duration-700">
                        {respondents.length - index}
                      </div>
                      <div className="absolute -inset-2 bg-violet-500/10 blur-xl rounded-full -z-10 group-hover/card:opacity-100 opacity-0 transition-opacity"></div>
                    </div>
                     <div>
                       <div className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-400 mb-1">Response Data</div>
                       <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                         Response #{respondents.length - index}
                       </h3>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{new Date(respondent.response.created_at).toLocaleString([], { dateStyle: 'medium' })}</span>
                        <div className="w-1 h-1 rounded-full bg-white/10"></div>
                        <span className="text-[11px] font-black text-violet-500/80 uppercase tracking-widest leading-none">{new Date(respondent.response.created_at).toLocaleTimeString([], { timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                     onClick={() => handleDeleteResponse(respondent.response.id)}
                     disabled={isDeleting === respondent.response.id}
                     className="btn-danger h-16 w-16 rounded-2xl group/del transition-all"
                     title="Delete Response"
                   >
                     {isDeleting === respondent.response.id ? (
                       <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                         <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                       </svg>
                     ) : (
                       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover/del:scale-110 group-hover/del:rotate-12 transition-transform">
                         <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                       </svg>
                     )}
                   </button>
                </div>

                {/* Answers Grid */}
                <div className="p-8 sm:p-14 lg:p-20 space-y-20">
                  {questions.map((q, qIndex) => {
                    const answer = respondent.answers[q.id];
                    
                    return (
                      <div key={q.id} className="relative group/node animate-fade-in">
                        <div className="flex flex-col gap-6">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-4">
                               <div className="text-[11px] font-black w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 text-slate-400 group-hover/node:bg-violet-600 transition-colors">
                                  {qIndex + 1}
                               </div>
                                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-violet-400/80">
                                 Question
                               </span>
                            </div>
                            <h4 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white/95 leading-tight italic">
                               {q.text || "Voice Question"}
                            </h4>
                          </div>
                          
                          <div className="p-8 sm:p-12 bg-white/[0.01] rounded-[40px] border border-white/5 shadow-inner hover:bg-white/[0.02] transition-colors relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-pink-600/[0.01] to-transparent pointer-events-none"></div>
                            {!answer || (!answer.audio_url && !answer.text) ? (
                              <div className="flex items-center gap-4 text-slate-500 font-bold uppercase tracking-[0.1em] text-xs">
                                 <div className="w-2 h-2 rounded-full bg-amber-500/40"></div>
                                 No Answer Recorded
                               </div>
                            ) : (
                              <div className="space-y-12">
                                {answer.audio_url && (
                                  <div className="space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400 flex items-center gap-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Voice Recording
                                     </div>
                                    <div className="scale-105 origin-left">
                                      <AudioPlayer src={answer.audio_url} compact />
                                    </div>
                                  </div>
                                )}
                                
                                {answer.text && (
                                  <div className="space-y-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-400 flex items-center gap-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                        Converted Text
                                     </div>
                                    <div className="text-lg sm:text-2xl leading-relaxed font-black tracking-tight text-white/90 italic">
                                      "{answer.text}"
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Footer Buffer */}
      <div className="h-40" />
    </div>
  );
}
