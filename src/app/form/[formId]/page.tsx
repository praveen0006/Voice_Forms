'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase, uploadAudio } from '@/lib/supabase';
import { Question } from '@/lib/types';
import AudioRecorder from '@/components/AudioRecorder';
import AudioPlayer from '@/components/AudioPlayer';

interface AnswerDraft {
  questionId: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  text: string;
}

export default function RespondFormPage() {
  const params = useParams();
  const formId = params.formId as string;

  const [formTitle, setFormTitle] = useState('');
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, AnswerDraft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isCurrentlyRecording, setIsCurrentlyRecording] = useState(false);
 
  // Load form and questions
  useEffect(() => {
    async function loadForm() {
      const { data: form, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();
 
      if (error || !form) {
        setNotFound(true);
        setLoading(false);
        return;
      }
 
      setFormTitle(form.title);
      setHeaderVideoUrl(form.header_video_url);
      setHeaderImageUrl(form.header_image_url);

      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .eq('form_id', formId)
        .order('order_index');

      if (qs) {
        setQuestions(qs);
        // Initialize empty answers
        const answerMap = new Map<string, AnswerDraft>();
        qs.forEach((q) => {
          answerMap.set(q.id, {
            questionId: q.id,
            audioBlob: null,
            audioUrl: null,
            text: '',
          });
        });
        setAnswers(answerMap);
      }

      setLoading(false);
    }
    loadForm();
  }, [formId]);

  // Handle answer recording with Auto-Transcription
  const handleAnswerRecording = useCallback((questionId: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, {
        ...next.get(questionId)!,
        audioBlob: blob,
        audioUrl: url,
      });
      return next;
    });
  }, []);

  // Live Auto-Transcription Logic
  useEffect(() => {
    if (!isCurrentlyRecording) return;

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        
        if (transcript) {
          const qId = questions[currentQuestion]?.id;
          if (qId) {
            setAnswers((prev) => {
              const next = new Map(prev);
              const existing = next.get(qId)!;
              next.set(qId, { ...existing, text: transcript });
              return next;
            });
          }
        }
      };

      recognition.start();
      return () => recognition.stop();
    } catch (e) {
      console.error('Speech recognition error:', e);
    }
  }, [isCurrentlyRecording, currentQuestion, questions]);


  // Remove answer audio
  const removeAnswerAudio = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const ans = next.get(questionId)!;
      if (ans.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(ans.audioUrl);
      next.set(questionId, { ...ans, audioBlob: null, audioUrl: null });
      return next;
    });
  }, []);

  // Update answer text
  const updateAnswerText = useCallback((questionId: string, text: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { ...next.get(questionId)!, text });
      return next;
    });
  }, []);

  // Submit form
  const handleSubmit = async () => {
    // Validation: make every question mandatory by default, except if marked is_required=false
    const unansweredQs = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.is_required === false) continue; // Skip validation for optional questions

      const ans = answers.get(q.id);
      if (!ans || (!ans.audioBlob && (!ans.text || !ans.text.trim()))) {
        unansweredQs.push(i + 1);
      }
    }

    if (unansweredQs.length > 0) {
      alert(`Please complete all questions before submitting.\n\nMissing questions: ${unansweredQs.join(', ')}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create response
      const { data: response, error } = await supabase
        .from('responses')
        .insert({ form_id: formId })
        .select()
        .single();

      if (error) throw error;

      // Upload and save each answer
      const answersToInsert = [];
      for (const [questionId, answer] of Array.from(answers.entries())) {
        const q = questions.find(question => question.id === questionId);
        const hasContent = answer.audioBlob || (answer.text && answer.text.trim());
        
        // If it's optional and has no content, skip record creation entirely
        if (!hasContent && q && !q.is_required) {
          continue;
        }

        let audioUrl = null;

        if (answer.audioBlob) {
          const fileName = `${formId}/${response.id}/${questionId}.webm`;
          audioUrl = await uploadAudio('voice-answers', answer.audioBlob, fileName);
        }

        answersToInsert.push({
          response_id: response.id,
          question_id: questionId,
          audio_url: audioUrl,
          text: answer.text ? answer.text.trim() : null,
        });
      }

      if (answersToInsert.length > 0) {
        const { error: insertError } = await supabase.from('answers').insert(answersToInsert);
        if (insertError) throw insertError;
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation helpers
  const goToNext = () => setCurrentQuestion((prev) => Math.min(prev + 1, questions.length - 1));
  const goToPrev = () => setCurrentQuestion((prev) => Math.max(prev - 1, 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="text-center">
          <svg className="animate-spin mx-auto mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>Loading form...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
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

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="glass-card p-8 text-center animate-slide-up" style={{ maxWidth: '400px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid var(--accent-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>Response Submitted!</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Thank you for completing this VoiceForm.
          </p>
          
          {/* NexEraEco link */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Want to see what else we do?
            </p>
            <a 
              href="https://nexeraeco.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary w-full"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
            >
              Explore NexEraEco
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const currentAnswer = answers.get(currentQ?.id);
  const isLastQuestion = currentQuestion === questions.length - 1;

  return (
    <div className="animate-fade-in w-full pb-40">
      {/* Header Info */}
      <div className="text-center mb-12 sm:mb-16">
        <h1 className="text-3xl sm:text-5xl font-black mb-6 tracking-tight text-white uppercase italic">{formTitle}</h1>
        
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2.5">
            {questions.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-700 ${i === currentQuestion ? 'w-10 bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]' : 'w-1.5 bg-white/10'}`} 
              />
            ))}
          </div>
          <div className="px-5 py-2 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
              Question <span className="text-violet-400">{currentQuestion + 1}</span> of {questions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Header Media Section */}
      {(headerVideoUrl || headerImageUrl) && currentQuestion === 0 && (
        <div className="glass-card mb-16 overflow-hidden border border-white/5 animate-fade-in shadow-premium rounded-[40px] group/hero">
          <div className="p-6 sm:p-8 bg-white/5 border-b border-white/5 flex items-center justify-between">
             <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
              Information
            </h2>
          </div>
          <div className="flex flex-col">
            {headerVideoUrl && (
              <div className="aspect-video bg-black flex items-center justify-center">
                <video 
                  src={headerVideoUrl} 
                  controls 
                  className="w-full h-full max-h-[70vh] object-contain"
                  poster={headerImageUrl || undefined}
                />
              </div>
            )}
            {headerImageUrl && (
              <div className={`relative ${headerVideoUrl ? 'aspect-[21/9] border-t border-white/5' : 'aspect-video'}`}>
                <Image 
                  src={headerImageUrl} 
                  alt="Form Reference" 
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Card */}
      {currentQ && (
        <div className="flex flex-col gap-10">
          <div className="glass-card p-10 sm:p-14 lg:p-20 relative overflow-hidden rounded-[50px] border-white/5 hover:border-violet-500/20 transition-all duration-1000 shadow-premium" key={currentQ.id}>
             <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-600/[0.03] to-transparent pointer-events-none"></div>
             
             {/* Question Badge */}
             <div className="mb-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-violet-400">
                    Question
                  </span>
                </div>
                {!currentQ.is_required && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">Optional</span>
                )}
             </div>

            <div className="space-y-10">
              {/* Text question */}
              {currentQ.text && (
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black leading-[1.1] sm:leading-[1.1] text-white tracking-tight text-balance">
                  {currentQ.text}
                </h2>
              )}

              {/* Audio question */}
              {currentQ.audio_url && (
                <div className="pt-4 scale-105 sm:scale-110 origin-left">
                  <AudioPlayer src={currentQ.audio_url} />
                </div>
              )}

              {!currentQ.audio_url && !currentQ.text && (
                <p className="text-slate-500 italic font-medium uppercase tracking-[0.2em] text-sm">No Content Provided</p>
              )}
            </div>
          </div>

          {/* Answer Section */}
          {currentAnswer && (
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between mb-6 px-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Record Your Answer</h3>
                <div className="w-12 h-[1px] bg-white/5"></div>
              </div>
              
              <div className="glass-card overflow-hidden rounded-[40px] border-white/5 shadow-premium">
                 <div className="p-8 sm:p-14 space-y-12">
                    {/* Voice answer */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-center gap-3 text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">
                        <span className="w-1 h-1 rounded-full bg-violet-500"></span>
                        Voice capture mode
                      </div>
                      <div className="flex flex-col items-center">
                        {currentAnswer.audioUrl ? (
                          <div className="w-full space-y-6 animate-fade-in flex flex-col items-center">
                            <div className="w-full max-w-lg">
                              <AudioPlayer src={currentAnswer.audioUrl} compact />
                            </div>
                            <button
                              onClick={() => removeAnswerAudio(currentQ.id)}
                              className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors bg-white/5 px-6 py-2.5 rounded-2xl border border-white/5 hover:bg-white/10"
                            >
                              Try Again
                            </button>
                          </div>
                        ) : (
                          <div className="scale-110">
                            <AudioRecorder
                              maxDuration={currentQ.max_duration || 300}
                              onRecordingComplete={(blob) => handleAnswerRecording(currentQ.id, blob)}
                              onRecordingStateChange={setIsCurrentlyRecording}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Designer Divider */}
                    <div className="relative h-[2px] bg-white/5 w-full flex items-center justify-center">
                      <div className="absolute inset-x-0 h-[10px] bg-[#0a0e27]/80 backdrop-blur-sm -z-10"></div>
                      <span className="bg-[#0a0e27] border border-white/10 px-6 py-1.5 rounded-full text-[11px] font-black text-white/40 tracking-[0.3em] italic uppercase">Hybrid</span>
                    </div>

                    {/* Text answer */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-center gap-3 text-[10px] font-black text-pink-400 uppercase tracking-[0.2em]">
                        <span className="w-1 h-1 rounded-full bg-pink-500"></span>
                        Manual Input (Optional fallback)
                      </div>
                      <textarea
                        value={currentAnswer.text}
                        onChange={(e) => updateAnswerText(currentQ.id, e.target.value)}
                        placeholder="Speak to transcribe or type your response manually..."
                        className="input-field min-h-[160px] sm:min-h-[220px] bg-white/[0.01] border-white/5 hover:bg-white/[0.03] transition-all py-8 px-10 text-lg font-bold leading-relaxed resize-none rounded-[32px] text-center italic tracking-tight"
                      />
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Controls - Sticky on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-6 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent backdrop-blur-sm">
        <div className="app-container max-w-3xl">
          <div className="flex items-center gap-4 glass-card p-4 shadow-[0_-40px_100px_rgba(0,0,0,0.7)] border border-white/10 rounded-[35px] ring-1 ring-white/5">
            {/* Prev Button */}
            <button
              onClick={goToPrev}
              disabled={currentQuestion === 0 || isCurrentlyRecording}
              className="btn-secondary h-16 w-16 sm:h-20 sm:w-20 rounded-[28px] shrink-0 disabled:opacity-20 transition-all group"
              aria-label="Previous"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="group-hover:-translate-x-1 transition-transform">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Next/Submit Button */}
            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isCurrentlyRecording}
                className="btn-primary flex-1 h-16 sm:h-20 rounded-[28px] text-xl font-black uppercase tracking-tighter shadow-[0_10px_40px_rgba(139,92,246,0.3)] disabled:opacity-50 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {isCurrentlyRecording ? (
                  "Finalizing Voice Stream..."
                ) : isSubmitting ? (
                  <div className="flex items-center gap-4">
                    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    Submit Response
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="group-hover:translate-x-1 transition-transform">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ) : (
              <div className="flex-1 flex gap-3">
                <button
                  onClick={goToNext}
                  disabled={isCurrentlyRecording}
                  className="btn-primary flex-1 h-16 sm:h-20 rounded-[28px] text-xl font-black uppercase tracking-tighter shadow-[0_10px_40px_rgba(139,92,246,0.3)] disabled:opacity-50 transition-all relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {isCurrentlyRecording ? 'Processing Voice...' : (
                    <div className="flex items-center gap-3">
                      Next
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="group-hover:translate-x-2 transition-transform">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  )}
                </button>
                
                {/* Skip for optional */}
                {currentQ && !currentQ.is_required && !currentAnswer?.audioBlob && !currentAnswer?.text.trim() && (
                   <button
                    onClick={goToNext}
                    disabled={isCurrentlyRecording}
                    className="btn-secondary px-8 shrink-0 h-16 sm:h-20 rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px]"
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Branded Footer */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-md">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Made by</span>
               <span className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-400 italic">NexEraEco</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
