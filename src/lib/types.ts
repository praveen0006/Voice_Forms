// TypeScript types for VoiceForm

export interface Form {
  id: string;
  title: string;
  header_video_url?: string | null;
  header_image_url?: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  form_id: string;
  audio_url: string | null;
  text: string | null;
  order_index: number;
  is_required: boolean;
  max_duration?: number;
  created_at: string;
}

export interface Response {
  id: string;
  form_id: string;
  created_at: string;
}

export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  audio_url: string | null;
  text: string | null;
  created_at: string;
}

// Client-side question state during form creation
export interface QuestionDraft {
  id: string; // temp client-side ID
  audioBlob: Blob | null;
  audioUrl: string | null; // object URL for preview
  text: string;
  order_index: number;
  is_required: boolean;
  isRecording: boolean;
  isUploading: boolean;
  max_duration?: number;
}
