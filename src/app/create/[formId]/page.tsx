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
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          console.warn('Microphone permission denied for transcription');
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

  const handleDeleteForm = async () => {
    if (!confirm('Are you sure you want to delete this entire form? All questions and responses will be permanently removed.')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('forms').delete().eq('id', formId);
      if (error) throw error;

      // Update local storage
      const saved = localStorage.getItem('voiceform_my_forms');
      if (saved) {
        const parsed = JSON.parse(saved) as any[];
        const updated = parsed.filter(f => f.id !== formId);
        localStorage.setItem('voiceform_my_forms', JSON.stringify(updated));
      }

      router.push('/');
    } catch (e) {
      console.error('Delete error:', e);
      alert('Failed to delete form');
      setIsSaving(false);
    }
  };

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
          <svg className="animate-spin mx-auto mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in w-full pb-32">
      {/* Form Title & Meta */}
      <div className="mb-10 sm:mb-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); }}
            placeholder="Untitled VoiceForm"
            className="w-full text-center bg-transparent text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight outline-none border-b-2 border-dashed border-white/5 focus:border-cyan-500/50 transition-all py-4 uppercase"
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 rounded-full border border-cyan-500/20">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">System Link Active</span>
          </div>
        </div>
      </div>

      {/* Form Header Media Settings */}
      <div className="glass-card mb-12 overflow-hidden border-0 sm:border relative group/settings">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-transparent pointer-events-none"></div>
        <div className="p-6 sm:p-8 bg-white/5 border-b border-white/5 backdrop-blur-md relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black flex items-center gap-3 text-white uppercase tracking-tight">
                <span className="bg-glass-strong p-2 rounded-xl text-xl">📺</span> Media Intro Context
              </h3>
              <p className="text-xs mt-1.5 font-medium text-slate-400">
                Enhance your form with an introductory video or splash image.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* Video Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400">
                01. Tech Intro (Video)
              </label>
              {headerVideoUrl && <span className="badge badge-success text-[9px]">Active</span>}
            </div>

            {headerVideoUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-premium border border-white/5 group/media">
                <video src={headerVideoUrl} controls className="w-full h-full" />
                <button
                  onClick={() => { setHeaderVideoUrl(null); }}
                  className="absolute top-4 right-4 bg-red-500/80 backdrop-blur-md hover:bg-red-600 text-white p-2.5 rounded-2xl shadow-xl transition-all scale-0 group-hover/media:scale-100 active:scale-95"
                  title="Remove Video"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ) : (
              <div className="relative group/btn">
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
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 sm:p-14 cursor-pointer transition-all bg-white/[0.02] border-white/10 hover:bg-violet-600/5 hover:border-violet-500/50"
                >
                  <div className="w-16 h-16 rounded-3xl bg-violet-600/10 flex items-center justify-center mb-5 group-hover/btn:scale-110 group-hover/btn:-rotate-3 transition-all duration-500">
                    <span className="text-3xl">📹</span>
                  </div>
                  <span className="text-base font-black text-white uppercase tracking-tight">
                    {isUploadingMedia ? 'Uploading...' : 'Drop Video Here'}
                  </span>
                  <span className="text-[10px] mt-2 font-bold text-slate-500 uppercase tracking-widest">Supports 4K • WEBM • MP4</span>
                </label>
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-400">
                02. High-Res Cover (Image)
              </label>
              {headerImageUrl && <span className="badge badge-success text-[9px]">Active</span>}
            </div>

            {headerImageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-glass-strong aspect-video shadow-premium group/media">
                <Image src={headerImageUrl} fill className="object-cover" alt="Header" />
                <button
                  onClick={() => { setHeaderImageUrl(null); }}
                  className="absolute top-4 right-4 bg-red-500/80 backdrop-blur-md hover:bg-red-600 text-white p-2.5 rounded-2xl shadow-xl transition-all scale-0 group-hover/media:scale-100 active:scale-95"
                  title="Remove Image"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ) : (
              <div className="relative group/btn">
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
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 sm:p-14 cursor-pointer transition-all bg-white/[0.02] border-white/10 hover:bg-pink-600/5 hover:border-pink-500/50"
                >
                  <div className="w-16 h-16 rounded-3xl bg-pink-600/10 flex items-center justify-center mb-5 group-hover/btn:scale-110 group-hover/btn:rotate-3 transition-all duration-500">
                    <span className="text-3xl">🖼️</span>
                  </div>
                  <span className="text-base font-black text-white uppercase tracking-tight">
                    {isUploadingMedia ? 'Uploading...' : 'Drop Cover Here'}
                  </span>
                  <span className="text-[10px] mt-2 font-bold text-slate-500 uppercase tracking-widest">Optimal aspect 16:9 • WEBP</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <div className="flex flex-col gap-10 mb-16">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tighter italic">
            <div className="w-10 h-1 bg-cyan-500 rounded-full"></div>
            Digital Pipeline
          </h2>
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {questions.length} Nodes
          </div>
        </div>

        {questions.map((q, index) => (
          <div
            key={q.id}
            className="group/card animate-fade-in relative"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="glass-card relative overflow-hidden border-0 sm:border border-white/5 transition-all duration-500 hover:border-cyan-500/30 shadow-premium">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-600/5 to-transparent pointer-events-none"></div>

              <div className="p-6 sm:p-10 lg:p-12">
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center font-black text-xl text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                        {index + 1}
                      </div>
                      <div className="absolute -inset-2 bg-cyan-500/20 blur-xl rounded-full -z-10"></div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400 block mb-0.5">Step Sequence</span>
                      <h3 className="text-lg font-black text-white uppercase italic tracking-tight leading-none">Voice Prompt Node</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
                    <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-[18px] border border-white/10">
                      <select
                        value={q.max_duration || 300}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, max_duration: val } : pq));
                        }}
                        className="bg-transparent text-[11px] font-black uppercase px-3 py-2 outline-none cursor-pointer border-none text-cyan-300"
                      >
                        <option value={30}>30s TimeOut</option>
                        <option value={60}>1m TimeOut</option>
                        <option value={120}>2m TimeOut</option>
                        <option value={300}>5m TimeOut</option>
                      </select>

                      <div className="w-[1px] h-4 bg-white/10 mx-1" />

                      <label className="flex items-center gap-3 px-3 cursor-pointer group/toggle">
                        <input
                          type="checkbox"
                          checked={q.is_required}
                          onChange={(e) => {
                            setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, is_required: e.target.checked } : pq));
                          }}
                          className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                        />
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 group-hover/toggle:text-white transition-colors">Mandatory</span>
                      </label>
                    </div>

                    <div className="flex items-center bg-white/5 p-1.5 rounded-[18px] border border-white/10">
                      <button
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0 || isCurrentlyRecording}
                        className="p-2 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all active:scale-90"
                        title="Move Up"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1 || isCurrentlyRecording}
                        className="p-2 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all active:scale-90"
                        title="Move Down"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                    </div>

                    <button
                      onClick={() => deleteQuestion(q.id)}
                      disabled={isCurrentlyRecording}
                      className="btn-danger p-3.5 rounded-2xl group transition-all"
                      title="Destroy Node"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-12 transition-transform">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
                  {/* Audio Recorder Column */}
                  <div className="flex flex-col gap-5 order-2 lg:order-1">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                        Signal Capture
                      </label>
                      {q.isUploading && (
                        <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">
                          <span className="animate-pulse">Syncing to cloud</span>
                        </div>
                      )}
                    </div>

                    <div className="p-8 sm:p-10 bg-white/[0.03] rounded-[32px] border border-white/5 min-h-[160px] flex items-center justify-center relative overflow-hidden group/recorder">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/[0.03] to-transparent pointer-events-none"></div>
                      {q.audioUrl ? (
                        <div className="w-full space-y-6 relative z-10">
                          <AudioPlayer src={q.audioUrl} compact />
                          <div className="flex justify-center">
                            <button
                              onClick={() => removeAudio(q.id)}
                              className="btn-secondary h-10 px-8 rounded-full border-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              Redo Capture
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 scale-110">
                          <AudioRecorder
                            onRecordingComplete={(blob) => handleRecordingComplete(q.id, blob)}
                            onRecordingStateChange={setIsCurrentlyRecording}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Text Content Column */}
                  <div className="flex flex-col gap-5 order-1 lg:order-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                      Data Transcript
                    </label>
                    <textarea
                      value={q.text}
                      onChange={(e) => updateQuestionText(q.id, e.target.value)}
                      placeholder="Type the question content here as a fallback..."
                      className="input-field py-6 px-7 text-lg font-bold leading-relaxed border-white/5 bg-white/[0.01] hover:bg-white/[0.03] focus:bg-white/[0.03] h-full min-h-[180px] rounded-[32px] shadow-inner resize-none transition-all"
                    />
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2">
                      💡 Use clear, concise text for optimal accessibility.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Question Button */}
        <button
          onClick={addQuestion}
          disabled={isCurrentlyRecording}
          className="group flex flex-col items-center justify-center w-full py-16 text-xl font-black border-2 border-dashed rounded-[40px] transition-all bg-white/[0.02] border-white/5 hover:border-cyan-500/50 hover:bg-cyan-500/[0.03] active:scale-[0.99] disabled:opacity-20"
        >
          <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center mb-6 group-hover:bg-cyan-600 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-xl border border-white/5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span className="uppercase tracking-[0.15em] text-white/50 group-hover:text-white transition-colors">Insert Next Step</span>
        </button>
      </div>

      {/* Floating Save Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-6 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent backdrop-blur-sm">
        <div className="app-container" style={{ maxWidth: '900px' }}>
          <div className="glass-card p-4 sm:p-5 shadow-[0_-40px_100px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-white/5 flex flex-col items-center gap-6 rounded-[32px]">
            {!shareUrl ? (
              <div className="flex w-full gap-4">
                <button
                  onClick={saveForm}
                  disabled={isSaving || questions.length === 0 || isCurrentlyRecording}
                  className={`btn-primary flex-1 py-5 text-xl font-black tracking-tighter uppercase shadow-[0_10px_45px_rgba(6,182,212,0.3)] rounded-2xl group transition-all duration-500 ${isSaving ? 'scale-95' : 'hover:scale-[1.01] active:scale-95'}`}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {isCurrentlyRecording ? (
                    "End Capture Sequence First"
                  ) : isSaving ? (
                    <div className="flex items-center gap-4">
                      <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                        <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                      </svg>
                      Deploying...
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                      </svg>
                      Finalize & Deploy Form
                    </div>
                  )}
                </button>
                <button
                  onClick={handleDeleteForm}
                  disabled={isSaving}
                  className="btn-danger w-20 h-[72px] rounded-[24px] group/del transition-all"
                  title="Purge VoiceForm"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover/del:scale-125 group-hover/del:rotate-12 transition-all duration-500">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col md:flex-row items-center gap-4 animate-fade-in">
                <div className="flex-1 bg-emerald-500/5 border border-emerald-500/20 rounded-[28px] py-4 px-8 flex items-center justify-between gap-6 w-full group/link shadow-xl">
                  <div className="flex items-center gap-4 truncate">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live Access Instance</span>
                      <span className="text-base font-black text-emerald-400 truncate tracking-tight">{shareUrl}</span>
                    </div>
                  </div>
                  <button
                    onClick={copyShareUrl}
                    className="btn-secondary h-12 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest border-emerald-500/30 hover:border-emerald-500 transition-all shadow-xl shadow-emerald-500/5"
                  >
                    Copy Link
                  </button>
                </div>
                <Link href={shareUrl} target="_blank" className="btn-primary px-12 py-5 w-full md:w-auto text-nowrap rounded-[28px] font-black uppercase tracking-tighter shadow-[0_10px_40px_rgba(139,92,246,0.3)]">
                  Test Live Flow
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
