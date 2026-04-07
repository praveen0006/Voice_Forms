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
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>{form.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {respondents.length} {respondents.length === 1 ? 'Response' : 'Responses'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/create/${form.id}`} className="btn-secondary" style={{ textDecoration: 'none', padding: '8px 16px', fontSize: '0.9rem' }}>
            Edit Form
          </Link>
          <Link href={`/form/${form.id}`} className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', fontSize: '0.9rem' }}>
            Share Link
          </Link>
        </div>
      </div>

      {/* Responses List */}
      {respondents.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>📭</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>No responses yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Share your form link to start collecting voice responses!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {respondents.map((respondent, index) => (
            <div key={respondent.response.id} className="glass-card p-0 overflow-hidden animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
              {/* Respondent Header */}
              <div style={{ background: 'var(--bg-glass-strong)', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                    Respondent #{respondents.length - index}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(respondent.response.created_at).toLocaleString()}
                  </span>
                </div>
                
                <button
                  onClick={() => handleDeleteResponse(respondent.response.id)}
                  disabled={isDeleting === respondent.response.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: isDeleting === respondent.response.id ? 'not-allowed' : 'pointer',
                    color: 'var(--accent-pink)',
                    opacity: isDeleting === respondent.response.id ? 0.5 : 0.8,
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.2s'
                  }}
                  title="Delete Response"
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = isDeleting === respondent.response.id ? '0.5' : '0.8'}
                >
                  {isDeleting === respondent.response.id ? (
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  )}
                </button>
              </div>

              {/* Answers */}
              <div className="p-6 flex flex-col gap-6">
                {questions.map((q, qIndex) => {
                  const answer = respondent.answers[q.id];
                  
                  return (
                    <div key={q.id}>
                      <div className="mb-2">
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-violet)', marginRight: '8px' }}>
                          Q{qIndex + 1}.
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {q.text || "Audio Question"}
                        </span>
                      </div>
                      
                      <div className="pl-6" style={{ borderLeft: '2px solid var(--border-subtle)' }}>
                        {!answer || (!answer.audio_url && !answer.text) ? (
                          <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No answer provided.</p>
                        ) : (
                          <div className="flex flex-col gap-3 mt-3">
                            {answer.audio_url && (
                              <AudioPlayer src={answer.audio_url} compact />
                            )}
                            {answer.text && (
                              <div style={{ background: 'var(--bg-glass-strong)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.95rem' }}>
                                {answer.text}
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
      <div style={{ height: '80px' }} />
    </div>
  );
}
