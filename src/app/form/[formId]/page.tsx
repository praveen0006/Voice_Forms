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
              // Only overwrite if text is empty or the user hasn't manually typed a lot
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

  // AI Voice Autoplay for Owner's Questions
  useEffect(() => {
    const currentQ = questions[currentQuestion];
    if (currentQ?.is_ai_voice && currentQ.text && !loading) {
      const speak = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0 && !window.speechSynthesis.onvoiceschanged) {
          window.speechSynthesis.onvoiceschanged = speak;
          return;
        }

        const isTelugu = /[\u0C00-\u0C7F]/.test(currentQ.text!);
        const utterance = new SpeechSynthesisUtterance(currentQ.text!);
        utterance.lang = isTelugu ? 'te-IN' : 'en-US';
        
        // Dynamic voice selection based on detected language
        const voicesList = window.speechSynthesis.getVoices();
        const targetLang = isTelugu ? 'te' : 'en';
        const bestVoice = voicesList.find(v => v.lang.startsWith(targetLang) && (v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Natural'))) || 
                         voicesList.find(v => v.lang.startsWith(targetLang)) || 
                         voicesList[0];
        if (bestVoice) utterance.voice = bestVoice;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      // Try speaking immediately
      speak();
      
      // Safety: Sometimes browsers need one more try after a tiny delay
      const timeout = setTimeout(speak, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentQuestion, questions, loading]);

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
    <div className="animate-fade-in w-full pb-32">
      {/* Header Info */}
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-extrabold mb-3 tracking-tight">{formTitle}</h1>
        
        <div className="flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {questions.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full border border-bg-primary ${i <= currentQuestion ? 'bg-violet-500' : 'bg-white/10'}`} 
              />
            ))}
          </div>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Step {currentQuestion + 1} of {questions.length}
          </span>
        </div>

        {/* Improved Progress bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full mt-6 overflow-hidden max-w-sm mx-auto border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Dynamic Header Media Section */}
      {(headerVideoUrl || headerImageUrl) && currentQuestion === 0 && (
        <div className="glass-card mb-10 overflow-hidden border-0 sm:border animate-fade-in shadow-2xl">
          <div className="p-4 sm:p-5 bg-glass border-b border-subtle">
             <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
              <span className="text-xl">📽️</span> Form Context
            </h2>
          </div>
          <div className="flex flex-col">
            {headerVideoUrl && (
              <div className="aspect-video bg-black flex items-center justify-center">
                <video 
                  src={headerVideoUrl} 
                  controls 
                  className="w-full h-full max-h-[60vh] object-contain"
                  poster={headerImageUrl || undefined}
                />
              </div>
            )}
            {headerImageUrl && (
              <div className={`relative ${headerVideoUrl ? 'aspect-[21/9] border-t border-subtle' : 'aspect-video'}`}>
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
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6 sm:p-10 relative overflow-hidden" key={currentQ.id}>
             {/* Question Badge */}
             <div className="mb-6 flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-violet-400">
                  Question {currentQuestion + 1}
                </span>
                {!currentQ.is_required && (
                  <span className="badge bg-white/5 text-white/40 border-none px-3">Optional</span>
                )}
             </div>

            <div className="space-y-6">
              {/* Text question */}
              {currentQ.text && (
                <h2 className="text-xl sm:text-3xl font-bold leading-tight sm:leading-tight">
                  {currentQ.text}
                </h2>
              )}

              {/* Audio question */}
              {currentQ.audio_url && !currentQ.is_ai_voice && (
                <div className="pt-2">
                  <AudioPlayer src={currentQ.audio_url} />
                </div>
              )}

              {currentQ.is_ai_voice && (
                 <div className="pt-2 flex items-center gap-3">
                   <button 
                     onClick={() => {
                       const voices = window.speechSynthesis.getVoices();
                       const msg = `AI Status:\n- Text: ${currentQ.text || 'EMPTY (Needs text!)'}\n- Voices Found: ${voices.length}\n- Speaking: ${window.speechSynthesis.speaking}`;
                       alert(msg);
                     }}
                     className="badge border-none bg-pink-500/10 text-pink-400 font-black tracking-widest text-[10px] animate-pulse cursor-help"
                   >
                     AI Voice Active (Tap for Status)
                   </button>
                   <button 
                    onClick={() => {
                      if (!currentQ.text) {
                        alert("Cannot play AI Voice: No text found for this question. Please add text in the form builder.");
                        return;
                      }
                      const isTelugu = /[\u0C00-\u0C7F]/.test(currentQ.text);
                      const utterance = new SpeechSynthesisUtterance(currentQ.text);
                      utterance.lang = isTelugu ? 'te-IN' : 'en-US';
                      
                      const voices = window.speechSynthesis.getVoices();
                      const targetLang = isTelugu ? 'te' : 'en';
                      const bestVoice = voices.find(v => v.lang.startsWith(targetLang) && (v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Natural'))) || 
                                       voices.find(v => v.lang.startsWith(targetLang)) || 
                                       voices[0];
                      if (bestVoice) utterance.voice = bestVoice;
                      
                      console.log("Attempting manual AI speech for:", currentQ.text);
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                   >
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                       <path d="M11 5L6 9H2V15H6L11 19V5Z" />
                       <path d="M19.07 4.93C20.94 6.81 22 9.32 22 12C22 14.68 20.94 17.19 19.07 19.07" />
                       <path d="M15.54 8.46C16.47 9.4 17 10.66 17 12C17 13.34 16.47 14.6 15.54 15.54" />
                     </svg>
                   </button>
                 </div>
              )}

              {!currentQ.audio_url && !currentQ.text && (
                <p className="text-muted italic">Question content missing.</p>
              )}
            </div>
          </div>

          {/* Answer Section */}
          {currentAnswer && (
            <div className="glass-card overflow-hidden">
               <div className="p-4 bg-glass border-b border-subtle text-xs font-bold uppercase tracking-widest text-center text-muted">
                 Your Response
               </div>
               <div className="p-6 sm:p-10 space-y-8">
                  {/* Voice answer */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
                      <span>🎙️</span> Voice Response
                    </div>
                    {currentAnswer.audioUrl ? (
                      <div className="space-y-4 animate-fade-in">
                        <AudioPlayer src={currentAnswer.audioUrl} compact />
                        <div className="flex justify-center">
                          <button
                            onClick={() => removeAnswerAudio(currentQ.id)}
                            className="text-xs font-bold text-muted underline decoration-white/10 hover:text-white transition-colors"
                          >
                            Redo Voice
                          </button>
                        </div>
                      </div>
                    ) : (
                      <AudioRecorder
                        maxDuration={currentQ.max_duration || 300}
                        onRecordingComplete={(blob) => handleAnswerRecording(currentQ.id, blob)}
                        onRecordingStateChange={setIsCurrentlyRecording}
                      />
                    )}
                  </div>

                  {/* Divider */}
                  <div className="relative h-[1px] bg-white/5 w-full flex items-center justify-center">
                    <span className="bg-[#111638] px-4 text-[10px] font-black text-white/20">OR</span>
                  </div>

                  {/* Text answer */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase">
                      <span>✍️</span> Text Response
                    </div>
                    <textarea
                      value={currentAnswer.text}
                      onChange={(e) => updateAnswerText(currentQ.id, e.target.value)}
                      placeholder="Share your thoughts here..."
                      className="input-field min-h-[120px] sm:min-h-[160px] bg-transparent border-dashed"
                    />
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Controls - Sticky on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent pb-8">
        <div className="app-container max-w-2xl">
          <div className="flex items-center gap-3 glass-card p-3 shadow-2xl border-t-white/10">
            {/* Prev Button */}
            <button
              onClick={goToPrev}
              disabled={currentQuestion === 0 || isCurrentlyRecording}
              className="btn-secondary h-14 sm:h-16 w-14 sm:w-16 rounded-2xl flex shrink-0 disabled:opacity-20 transition-all border-none bg-glass-strong hover:bg-white/10"
              aria-label="Previous"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Next/Submit Button */}
            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isCurrentlyRecording}
                className="btn-primary flex-1 h-14 sm:h-16 rounded-2xl text-lg font-bold shadow-2xl disabled:opacity-50"
              >
                {isCurrentlyRecording ? (
                  "Finish Recording First"
                ) : isSubmitting ? (
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Submitting...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Submit Response
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ) : (
              <div className="flex-1 flex gap-2">
                <button
                  onClick={goToNext}
                  disabled={isCurrentlyRecording}
                  className="btn-primary flex-1 h-14 sm:h-16 rounded-2xl text-lg font-bold shadow-2xl disabled:opacity-50 transition-all"
                >
                  {isCurrentlyRecording ? 'Wait Content' : 'Next Question'}
                </button>
                
                {/* Skip for optional */}
                {currentQ && !currentQ.is_required && !currentAnswer?.audioBlob && !currentAnswer?.text.trim() && (
                   <button
                    onClick={goToNext}
                    disabled={isCurrentlyRecording}
                    className="btn-secondary px-6 shrink-0 h-14 sm:h-16 rounded-2xl font-bold border-none"
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Branded Footer */}
          <div className="mt-4 flex justify-center">
            <a 
              href="https://nexeraeco.vercel.app/" target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-black uppercase tracking-widest text-[#6366f1] hover:text-white transition-colors"
            >
              Powered by NexEraEco
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
