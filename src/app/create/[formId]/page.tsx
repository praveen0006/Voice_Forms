'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase, uploadAudio, uploadFile } from '@/lib/supabase';
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
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCurrentlyRecording, setIsCurrentlyRecording] = useState(false);

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
      setHeaderVideoUrl(data.header_video_url);
      setHeaderImageUrl(data.header_image_url);

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
            is_required: q.is_required ?? true,
            isRecording: false,
            isUploading: false,
            max_duration: q.max_duration || 300,
            is_ai_voice: q.is_ai_voice ?? false,
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
        is_required: true,
        isRecording: false,
        isUploading: false,
        max_duration: 300,
        is_ai_voice: false,
      },
    ]);
  }, []);

  // Update question text
  const updateQuestionText = useCallback((id: string, text: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text } : q))
    );
  }, []);

  const handleRecordingComplete = useCallback((id: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, audioBlob: blob, audioUrl: url } : q))
    );

    // Free transcription for owner
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuestions(prev => prev.map(pq => pq.id === id ? { ...pq, text: transcript } : pq));
        }
      };
      recognition.start();
    }
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
  }, []);

  // Delete question
  const deleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      const updated = prev.filter((q) => q.id !== id);
      return updated.map((q, i) => ({ ...q, order_index: i }));
    });
  }, []);

  // Handle header media upload
  const handleMediaUpload = async (file: File, type: 'video' | 'image') => {
    setIsUploadingMedia(true);
    try {
      const bucket = type === 'video' ? 'voice-questions' : 'voice-questions'; 
      const extension = file.name.split('.').pop();
      const fileName = `headers/${formId}/${type}_${Date.now()}.${extension}`;
      
      const url = await uploadFile(bucket, file, fileName);
      
      if (type === 'video') setHeaderVideoUrl(url);
      else setHeaderImageUrl(url);
    } catch (err) {
      console.error('Media upload error:', err);
      alert('Failed to upload media. Please try again.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Move question up/down
  const moveQuestion = useCallback((index: number, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const arr = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= arr.length) return prev;
      [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
      return arr.map((q, i) => ({ ...q, order_index: i }));
    });
  }, []);


  // Save form
  const saveForm = async () => {
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    // Validate that no question is completely empty
    const emptyQs = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.audioUrl && !q.audioBlob && (!q.text || !q.text.trim())) {
        emptyQs.push(i + 1);
      }
    }

    if (emptyQs.length > 0) {
      alert(`Please provide text or an audio recording for all questions before saving.\n\nMissing content for questions: ${emptyQs.join(', ')}`);
      return;
    }

    setIsSaving(true);

    try {
      // Update form title and media
      const validatedTitle = title.trim() || 'Untitled Form';
      await supabase.from('forms').update({ 
        title: validatedTitle,
        header_video_url: headerVideoUrl,
        header_image_url: headerImageUrl
      }).eq('id', formId);
      setTitle(validatedTitle);

      // Get existing question IDs from DB to figure out what to delete vs update
      const { data: existingQs } = await supabase
        .from('questions')
        .select('id')
        .eq('form_id', formId);
      
      const existingIds = (existingQs || []).map(q => q.id);
      const currentIds = questions.map(q => q.id);
      
      // Delete questions that are no longer in the list
      const idsToDelete = existingIds.filter(id => !currentIds.includes(id));
      if (idsToDelete.length > 0) {
        await supabase.from('questions').delete().in('id', idsToDelete);
      }

      // Process questions (update existing or insert new)
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
            prev.map((pq) => (pq.id === q.id ? { ...pq, isUploading: false, audioUrl, audioBlob: null } : pq))
          );
        }

        const questionData = {
          form_id: formId,
          audio_url: audioUrl,
          text: q.text ? q.text.trim() : null,
          order_index: q.order_index,
          is_required: q.is_required,
          max_duration: q.max_duration || 300,
          is_ai_voice: q.is_ai_voice,
        };

        if (existingIds.includes(q.id)) {
          // Update existing
          await supabase.from('questions').update(questionData).eq('id', q.id);
        } else {
          // Insert new
          await supabase.from('questions').insert(questionData);
        }
      }

      const url = `${window.location.origin}/form/${formId}`;
      setShareUrl(url);
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
    <div className="animate-fade-in w-full pb-20">
      {/* Form Title & Meta */}
      <div className="mb-6 sm:mb-10">
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); }}
            placeholder="Name your VoiceForm..."
            className="input-field"
            style={{ fontSize: '1.75rem', fontWeight: 800, padding: '16px 20px', border: 'none', background: 'transparent', borderBottom: '2px solid var(--border-subtle)', borderRadius: 0 }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} className="px-1">
            Build your form by adding audio questions below.
          </p>
        </div>
      </div>

      {/* Form Header Media Settings */}
      <div className="glass-card mb-10 overflow-hidden border-0 sm:border">
        <div className="p-4 sm:p-6 bg-glass border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
            <span className="text-xl">📺</span> Header Context (Intro Section)
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Show an intro video or image before respondents start the questions.
          </p>
        </div>
        
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Video Upload */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              1. Intro Video
            </label>
            {headerVideoUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                <video src={headerVideoUrl} controls className="w-full h-full" />
                <button 
                  onClick={() => { setHeaderVideoUrl(null); }}
                  className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
                  title="Remove Video"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ) : (
              <div className="relative group">
                <input 
                  type="file" 
                  accept="video/*" 
                  onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'video')}
                  className="hidden" 
                  id="header-video-upload"
                  disabled={isUploadingMedia}
                />
                <label 
                  htmlFor="header-video-upload"
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 sm:p-12 cursor-pointer transition-all hover:bg-glass-strong hover:border-violet-500"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-glass)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span style={{ fontSize: '1.5rem' }}>📹</span>
                  </div>
                  <span className="text-sm font-semibold mb-1">
                    {isUploadingMedia ? 'Uploading...' : 'Add Intro Video'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>MP4, WEBM or MOV</span>
                </label>
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              2. Cover Image
            </label>
            {headerImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border bg-glass-strong aspect-video shadow-2xl" style={{ borderColor: 'var(--border-subtle)' }}>
                <Image src={headerImageUrl} fill className="object-cover" alt="Header" />
                <button 
                  onClick={() => { setHeaderImageUrl(null); }}
                  className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
                  title="Remove Image"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ) : (
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], 'image')}
                  className="hidden" 
                  id="header-image-upload"
                  disabled={isUploadingMedia}
                />
                <label 
                  htmlFor="header-image-upload"
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 sm:p-12 cursor-pointer transition-all hover:bg-glass-strong hover:border-violet-500"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-glass)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span style={{ fontSize: '1.5rem' }}>🖼️</span>
                  </div>
                  <span className="text-sm font-semibold mb-1">
                    {isUploadingMedia ? 'Uploading...' : 'Add Cover Image'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>JPG, PNG or WEBP</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <div className="flex flex-col gap-6 mb-10">
        <h2 className="text-lg font-extrabold flex items-center gap-3 px-1">
          <span className="text-2xl">📝</span> Questions ({questions.length})
        </h2>
        
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="glass-card animate-fade-in group/card relative overflow-hidden"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {/* Side handle/status indicator */}
            <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
              <div className={`flex-1 ${q.audioUrl ? 'bg-emerald-500' : 'bg-amber-500'} transition-colors`} />
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              {/* Question Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-glass-strong flex items-center justify-center font-bold text-sm border border-subtle">
                    {index + 1}
                  </div>
                  <span className="text-sm font-bold uppercase tracking-widest text-[#a78bfa]">
                    Step {index + 1}
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  {/* Settings dropdowns */}
                  <div className="flex items-center gap-2 bg-glass rounded-xl p-1 border" style={{ borderColor: 'var(--border-subtle)' }}>
                     <select
                        value={q.max_duration || 300}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, max_duration: val } : pq));
                        }}
                        className="bg-transparent text-[10px] sm:text-xs font-bold uppercase p-1.5 outline-none cursor-pointer border-none"
                      >
                        <option value={30}>30s Limit</option>
                        <option value={60}>1m Limit</option>
                        <option value={120}>2m Limit</option>
                        <option value={300}>5m Limit</option>
                      </select>

                      <div className="w-[1px] h-4 bg-white/10 mx-1" />

                      <label className="flex items-center gap-2 px-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.is_required}
                          onChange={(e) => {
                            setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, is_required: e.target.checked } : pq));
                          }}
                          className="w-3 h-3 accent-violet-500"
                        />
                        <span className="text-[10px] sm:text-xs font-bold uppercase">Required</span>
                      </label>

                      <div className="w-[1px] h-4 bg-white/10 mx-1" />

                      <label className="flex items-center gap-2 px-2 cursor-pointer group/ai">
                        <input
                          type="checkbox"
                          checked={q.is_ai_voice}
                          onChange={(e) => {
                            setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, is_ai_voice: e.target.checked } : pq));
                          }}
                          className="w-3 h-3 accent-pink-500"
                        />
                        <span className={`text-[10px] sm:text-xs font-bold uppercase ${q.is_ai_voice ? 'text-pink-400' : ''}`}>AI Voice</span>
                      </label>
                  </div>

                  {/* Ordering */}
                  <div className="flex items-center bg-glass rounded-xl p-1 border" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0 || isCurrentlyRecording}
                      className="p-1.5 hover:bg-glass-strong rounded-lg disabled:opacity-20 transition-colors"
                      title="Move Up"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1 || isCurrentlyRecording}
                      className="p-1.5 hover:bg-glass-strong rounded-lg disabled:opacity-20 transition-colors"
                      title="Move Down"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>

                  <button
                    onClick={() => deleteQuestion(q.id)}
                    disabled={isCurrentlyRecording}
                    className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors disabled:opacity-20"
                    title="Delete Question"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Audio Recorder Column */}
                <div className="flex flex-col gap-4 order-2 lg:order-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      🎙️ Audio Prompt
                    </label>
                    {q.isUploading && (
                      <span className="badge badge-uploading border-none bg-blue-500/10 text-blue-400">
                        Uploading...
                      </span>
                    )}
                  </div>
                  
                  <div className="p-4 sm:p-6 bg-glass-strong rounded-2xl border border-subtle min-h-[120px] flex items-center justify-center">
                    {q.audioUrl ? (
                      <div className="w-full space-y-4">
                        <AudioPlayer src={q.audioUrl} compact />
                        <div className="flex justify-center">
                          <button
                            onClick={() => removeAudio(q.id)}
                            className="text-xs font-bold underline underline-offset-4 decoration-white/20 hover:text-white transition-colors"
                          >
                            Redo Recording
                          </button>
                        </div>
                      </div>
                    ) : (
                      <AudioRecorder
                        onRecordingComplete={(blob) => handleRecordingComplete(q.id, blob)}
                        onRecordingStateChange={setIsCurrentlyRecording}
                      />
                    )}
                  </div>
                </div>

                {/* Text Content Column */}
                <div className="flex flex-col gap-4 order-1 lg:order-2">
                  <label className="text-xs font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>
                    ✍️ Question Text
                  </label>
                  <textarea
                    value={q.text}
                    onChange={(e) => updateQuestionText(q.id, e.target.value)}
                    placeholder="Enter the question text here..."
                    className="input-field h-full min-h-[120px]"
                    style={{ background: 'rgba(255,255,255,0.02)', borderStyle: 'dashed' }}
                  />
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Tip: High-quality audio prompts work best, but text helps for accessibility.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Question Button */}
        <button
          onClick={addQuestion}
          disabled={isCurrentlyRecording}
          className="btn-secondary group flex w-full py-8 text-lg font-bold border-2 border-dashed hover:border-violet-500 transition-all active:scale-[0.99] disabled:opacity-30 disabled:scale-100"
          style={{ background: 'var(--bg-glass)', borderRadius: '24px' }}
        >
          <div className="w-10 h-10 rounded-full bg-glass flex items-center justify-center group-hover:bg-violet-500 group-hover:scale-125 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          Add Your Next Question
        </button>
      </div>

      {/* Floating Save Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent">
        <div className="app-container">
          <div className="glass-card p-4 sm:p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t-accent/30 flex flex-col items-center gap-6">
            {!shareUrl ? (
               <button
                onClick={saveForm}
                disabled={isSaving || questions.length === 0 || isCurrentlyRecording}
                className={`btn-primary w-full max-w-lg py-4 text-lg font-bold shadow-2xl transition-all ${isSaving ? 'scale-95' : 'hover:scale-[1.02] active:scale-95'}`}
              >
                {isCurrentlyRecording ? (
                  "Stop Recording First"
                ) : isSaving ? (
                  <>
                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                    </svg>
                    Saving VoiceForm...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                    </svg>
                    Save & Publish Form
                  </>
                )}
              </button>
            ) : (
              <div className="w-full flex flex-col md:flex-row items-center gap-4 animate-fade-in">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 w-full overflow-hidden">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 truncate tracking-tight">{shareUrl}</span>
                  </div>
                  <button
                    onClick={copyShareUrl}
                    className="btn-secondary px-6 shrink-0 bg-transparent hover:bg-emerald-500/20 py-2 border-emerald-500/30"
                  >
                    Copy Link
                  </button>
                </div>
                <Link href={shareUrl} target="_blank" className="btn-primary px-8 py-4 w-full md:w-auto text-nowrap rounded-2xl">
                  Test Live Form
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
