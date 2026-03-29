'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, uploadAudio } from '@/lib/supabase';
import { QuestionDraft } from '@/lib/types';
import AudioRecorder from '@/components/AudioRecorder';
import AudioPlayer from '@/components/AudioPlayer';

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export default function CreateFormPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Load existing form
  useEffect(() => {
    async function loadForm() {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (error || !data) {
        alert('Form not found');
        router.push('/');
        return;
      }

      setTitle(data.title);

      // Load existing questions
      const { data: existingQuestions } = await supabase
        .from('questions')
        .select('*')
        .eq('form_id', formId)
        .order('order_index');

      if (existingQuestions && existingQuestions.length > 0) {
        setQuestions(
          existingQuestions.map((q) => ({
            id: q.id,
            audioBlob: null,
            audioUrl: q.audio_url,
            text: q.text || '',
            order_index: q.order_index,
            isRecording: false,
            isUploading: false,
            max_duration: q.max_duration || 300,
          }))
        );
      }

      setLoading(false);
    }
    loadForm();
  }, [formId, router]);

  // Add new question
  const addQuestion = useCallback(() => {
    setQuestions((prev) => [
      ...prev,
      {
        id: generateId(),
        audioBlob: null,
        audioUrl: null,
        text: '',
        order_index: prev.length,
        isRecording: false,
        isUploading: false,
        max_duration: 300,
      },
    ]);
    setIsSaved(false);
  }, []);

  // Update question text
  const updateQuestionText = useCallback((id: string, text: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text } : q))
    );
    setIsSaved(false);
  }, []);

  // Handle recording complete for a question
  const handleRecordingComplete = useCallback((id: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, audioBlob: blob, audioUrl: url } : q))
    );
    setIsSaved(false);
  }, []);

  // Remove audio from question
  const removeAudio = useCallback((id: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          if (q.audioUrl && q.audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(q.audioUrl);
          }
          return { ...q, audioBlob: null, audioUrl: null };
        }
        return q;
      })
    );
    setIsSaved(false);
  }, []);

  // Delete question
  const deleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      const updated = prev.filter((q) => q.id !== id);
      return updated.map((q, i) => ({ ...q, order_index: i }));
    });
    setIsSaved(false);
  }, []);

  // Move question up/down
  const moveQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const arr = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return prev;
      [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
      return arr.map((q, i) => ({ ...q, order_index: i }));
    });
    setIsSaved(false);
  }, []);

  // Save form
  const saveForm = async () => {
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    setIsSaving(true);

    try {
      // Update form title
      await supabase.from('forms').update({ title }).eq('id', formId);

      // Delete existing questions (will re-insert)
      await supabase.from('questions').delete().eq('form_id', formId);

      // Upload audio and save questions
      for (const q of questions) {
        let audioUrl = q.audioUrl;

        // Upload new audio blob if it exists
        if (q.audioBlob) {
          const fileName = `${formId}/${generateId()}.webm`;
          setQuestions((prev) =>
            prev.map((pq) => (pq.id === q.id ? { ...pq, isUploading: true } : pq))
          );

          audioUrl = await uploadAudio('voice-questions', q.audioBlob, fileName);

          setQuestions((prev) =>
            prev.map((pq) => (pq.id === q.id ? { ...pq, isUploading: false, audioUrl } : pq))
          );
        }

        // Insert question
        await supabase.from('questions').insert({
          form_id: formId,
          audio_url: audioUrl,
          text: q.text || null,
          order_index: q.order_index,
          max_duration: q.max_duration || 300,
        });
      }

      const url = `${window.location.origin}/form/${formId}`;
      setShareUrl(url);
      setIsSaved(true);
    } catch (err) {
      console.error('Error saving form:', err);
      alert('Failed to save form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy share URL
  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
  };

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

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Form Title */}
      <div className="mb-8">
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setIsSaved(false); }}
          placeholder="Form Title"
          className="input-field"
          style={{ fontSize: '1.5rem', fontWeight: 700, padding: '16px 20px' }}
        />
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-4 mb-6">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="glass-card p-5 animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {/* Question Header */}
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Question {index + 1}
              </span>

              <div className="flex items-center gap-2">
                {/* Max Time Dropdown */}
                <select
                  value={q.max_duration || 300}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, max_duration: val } : pq));
                    setIsSaved(false);
                  }}
                  className="input-field"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto', minWidth: '95px', backgroundColor: 'var(--bg-glass-strong)', cursor: 'pointer' }}
                >
                  <option value={10}>10s Limit</option>
                  <option value={30}>30s Limit</option>
                  <option value={60}>1m Limit</option>
                  <option value={120}>2m Limit</option>
                  <option value={180}>3m Limit</option>
                  <option value={300}>5m Limit</option>
                </select>

                {/* Upload status */}
                {q.isUploading && (
                  <span className="badge badge-uploading">
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Uploading
                  </span>
                )}

                {/* Audio recorded badge */}
                {q.audioUrl && !q.isUploading && (
                  <span className="badge badge-success">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    Audio
                  </span>
                )}

                {/* Move buttons */}
                <button
                  onClick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  style={{ opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px' }}
                  aria-label="Move up"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button
                  onClick={() => moveQuestion(index, 'down')}
                  disabled={index === questions.length - 1}
                  style={{ opacity: index === questions.length - 1 ? 0.3 : 1, cursor: index === questions.length - 1 ? 'default' : 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)', padding: '4px' }}
                  aria-label="Move down"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteQuestion(q.id)}
                  className="btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Audio Section */}
            <div className="mb-4">
              {q.audioUrl ? (
                <div className="flex flex-col gap-2">
                  <AudioPlayer src={q.audioUrl} compact />
                  <button
                    onClick={() => removeAudio(q.id)}
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
                  onRecordingComplete={(blob) => handleRecordingComplete(q.id, blob)}
                />
              )}
            </div>

            {/* Text (optional) */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Text version (optional)
              </label>
              <textarea
                value={q.text}
                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                placeholder="Type the question text here..."
                className="input-field"
                rows={2}
                style={{ resize: 'vertical', minHeight: '60px' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Question Button */}
      <button
        onClick={addQuestion}
        className="btn-secondary w-full mb-6"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderStyle: 'dashed' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Question
      </button>

      {/* Save & Share */}
      <div className="glass-card p-5">
        <button
          onClick={saveForm}
          disabled={isSaving || questions.length === 0}
          className="btn-primary w-full mb-3"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
              Saving & Uploading...
            </>
          ) : isSaved ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved!
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save & Get Share Link
            </>
          )}
        </button>

        {/* Share URL */}
        {shareUrl && (
          <div
            className="animate-fade-in"
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div className="flex-1 truncate" style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)' }}>
              {shareUrl}
            </div>
            <button
              onClick={copyShareUrl}
              className="btn-secondary shrink-0"
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              Copy
            </button>
          </div>
        )}
      </div>

      {/* Bottom padding for mobile */}
      <div style={{ height: '60px' }} />
    </div>
  );
}
