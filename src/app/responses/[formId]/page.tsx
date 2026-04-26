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
      <div className="mb-10 sm:mb-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
          <div className="space-y-2">
            <Link 
              href="/" 
              className="text-xs font-black uppercase tracking-widest text-violet-500 hover:text-violet-400 flex items-center gap-2 mb-4 group"
            >
              <svg className="group-hover:-translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              All projects
            </Link>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{form.title}</h1>
            <div className="flex items-center gap-3">
              <span className="badge badge-success border-none bg-emerald-500/10 text-emerald-500 font-bold px-3 py-1">
                {respondents.length} {respondents.length === 1 ? 'Response' : 'Responses'}
              </span>
              <span className="text-xs font-bold text-muted uppercase tracking-widest">
                Analytics Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              href={`/create/${form.id}`} 
              className="btn-secondary px-6 h-12 flex items-center justify-center rounded-xl font-bold bg-glass-strong border-none hover:bg-white/10"
            >
              Edit Setup
            </Link>
            <Link 
              href={`/form/${form.id}`} 
              className="btn-primary px-6 h-12 flex items-center justify-center rounded-xl font-bold"
            >
              Share Live
            </Link>
          </div>
        </div>
      </div>

      {/* Responses List */}
      {respondents.length === 0 ? (
        <div className="glass-card p-16 text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-glass mx-auto flex items-center justify-center mb-6">
            <span className="text-4xl">📬</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Awaiting your first response</h3>
          <p className="text-muted text-sm max-w-xs mx-auto mb-8">
            Once people starts sharing their voice, their recorded responses will appear here instantly.
          </p>
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 inline-block text-xs font-bold text-emerald-400 tracking-tight">
             Link: voiceform.app/form/{formId}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {respondents.map((respondent, index) => (
            <div 
              key={respondent.response.id} 
              className="glass-card p-0 overflow-hidden animate-slide-up shadow-2xl border-0 sm:border" 
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Respondent Header */}
              <div className="p-4 sm:p-6 bg-glass border-b border-subtle flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                    {respondents.length - index}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                      Respondent #{respondents.length - index}
                    </h3>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted mt-0.5">
                      Completed {new Date(respondent.response.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDeleteResponse(respondent.response.id)}
                  disabled={isDeleting === respondent.response.id}
                  className={`p-3 rounded-xl transition-all group ${isDeleting === respondent.response.id ? 'opacity-20' : 'hover:bg-red-500/10 text-muted hover:text-red-500'}`}
                  title="Purge Response"
                >
                  {isDeleting === respondent.response.id ? (
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                  ) : (
                    <svg className="group-hover:scale-110 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  )}
                </button>
              </div>

              {/* Answers Grid */}
              <div className="p-6 sm:p-10 divide-y divide-white/5 space-y-10">
                {questions.map((q, qIndex) => {
                  const answer = respondent.answers[q.id];
                  
                  return (
                    <div key={q.id} className="pt-10 first:pt-0 space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                           <div className="text-[10px] font-black w-5 h-5 rounded-md bg-white/5 flex items-center justify-center shrink-0 border border-white/5 text-muted">
                              {qIndex + 1}
                           </div>
                           <span className="text-xs font-black uppercase tracking-[0.2em] text-[#a78bfa]">
                            Question
                           </span>
                        </div>
                        <h4 className="text-lg sm:text-xl font-bold tracking-tight text-white/90">
                          {q.text || "Audio question prompt"}
                        </h4>
                      </div>
                      
                      <div className="p-6 bg-glass-strong rounded-3xl border border-white/5 shadow-inner">
                        {!answer || (!answer.audio_url && !answer.text) ? (
                          <div className="flex items-center gap-2 text-muted italic text-sm">
                            <span className="text-xl">🚫</span> No response provided.
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {answer.audio_url && (
                              <div className="space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                   Voice Recorded
                                </div>
                                <AudioPlayer src={answer.audio_url} compact />
                              </div>
                            )}
                            
                            {answer.text && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                                     Text Response
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!answer.text) return;
                                      const utterance = new SpeechSynthesisUtterance(answer.text);
                                      utterance.lang = 'en-US';
                                      // Premium feel: select a nice voice if available
                                      const voices = window.speechSynthesis.getVoices();
                                      const premiumVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Premium'))) || voices[0];
                                      if (premiumVoice) utterance.voice = premiumVoice;
                                      
                                      utterance.rate = 0.95; // Slightly slower for clarity
                                      utterance.pitch = 1;
                                      window.speechSynthesis.cancel(); // Stop any current speaking
                                      window.speechSynthesis.speak(utterance);
                                    }}
                                    className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors border border-violet-500/20"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    </svg>
                                    Play AI Voice
                                  </button>
                                </div>
                                <div className="text-base sm:text-lg leading-relaxed font-medium text-white/80">
                                  {answer.text}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Bottom padding */}
      <div className="h-32" />
    </div>
  );
}
