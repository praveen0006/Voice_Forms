'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, AnswerDraft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

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

  // Handle answer recording
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
      for (const [questionId, answer] of answers) {
        let audioUrl = null;

        if (answer.audioBlob) {
          const fileName = `${formId}/${response.id}/${questionId}.webm`;
          audioUrl = await uploadAudio('voice-answers', answer.audioBlob, fileName);
        }

        await supabase.from('answers').insert({
          response_id: response.id,
          question_id: questionId,
          audio_url: audioUrl,
          text: answer.text || null,
        });
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit. Please try again.');
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
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const currentAnswer = answers.get(currentQ?.id);
  const hasAnswer = currentAnswer && (currentAnswer.audioBlob || currentAnswer.text.trim());
  const allAnswered = [...answers.values()].every(
    (a) => a.audioBlob || a.text.trim()
  );
  const isLastQuestion = currentQuestion === questions.length - 1;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Form Title */}
      <div className="text-center mb-8">
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>{formTitle}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Question {currentQuestion + 1} of {questions.length}
        </p>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '4px',
            borderRadius: '4px',
            background: 'var(--bg-glass-strong)',
            marginTop: '16px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${((currentQuestion + 1) / questions.length) * 100}%`,
              background: 'linear-gradient(90deg, var(--accent-violet), var(--accent-pink))',
              borderRadius: '4px',
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      {currentQ && (
        <div className="glass-card p-6 mb-6 animate-fade-in" key={currentQ.id}>
          {/* Question Number */}
          <div className="mb-4">
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent-violet-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Question {currentQuestion + 1}
            </span>
          </div>

          {/* Audio question */}
          {currentQ.audio_url && (
            <div className="mb-4">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                🎧 Listen to the question:
              </p>
              <AudioPlayer src={currentQ.audio_url} />
            </div>
          )}

          {/* Text question */}
          {currentQ.text && (
            <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {currentQ.text}
            </p>
          )}

          {!currentQ.audio_url && !currentQ.text && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No question content available.
            </p>
          )}
        </div>
      )}

      {/* Answer Section */}
      {currentQ && currentAnswer && (
        <div className="glass-card p-6 mb-6">
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>
            YOUR ANSWER
          </h3>

          {/* Voice answer */}
          <div className="mb-4">
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              🎙️ Record your answer:
            </p>
            {currentAnswer.audioUrl ? (
              <div className="flex flex-col gap-2">
                <AudioPlayer src={currentAnswer.audioUrl} compact />
                <button
                  onClick={() => removeAnswerAudio(currentQ.id)}
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    alignSelf: 'flex-start',
                  }}
                >
                  Re-record
                </button>
              </div>
            ) : (
              <AudioRecorder
                maxDuration={currentQ.max_duration || 300}
                onRecordingComplete={(blob) => handleAnswerRecording(currentQ.id, blob)}
              />
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1" style={{ height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>OR</span>
            <div className="flex-1" style={{ height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Text answer */}
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              ✍️ Type your answer:
            </p>
            <textarea
              value={currentAnswer.text}
              onChange={(e) => updateAnswerText(currentQ.id, e.target.value)}
              placeholder="Type your response here..."
              className="input-field"
              rows={3}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={goToPrev}
          disabled={currentQuestion === 0}
          className="btn-secondary flex-1"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            opacity: currentQuestion === 0 ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Previous
        </button>

        {isLastQuestion ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex-1"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Submit
              </>
            )}
          </button>
        ) : (
          <button
            onClick={goToNext}
            className="btn-primary flex-1"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Question dot indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {questions.map((q, i) => {
          const ans = answers.get(q.id);
          const answered = ans && (ans.audioBlob || ans.text.trim());
          return (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(i)}
              style={{
                width: i === currentQuestion ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: answered
                  ? 'var(--accent-emerald)'
                  : i === currentQuestion
                  ? 'var(--accent-violet)'
                  : 'var(--bg-glass-strong)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              aria-label={`Go to question ${i + 1}`}
            />
          );
        })}
      </div>

      <div style={{ height: '60px' }} />
    </div>
  );
}
