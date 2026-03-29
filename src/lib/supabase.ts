import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to get public URL for a storage file
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Upload audio file to storage bucket
export async function uploadAudio(
  bucket: 'voice-questions' | 'voice-answers',
  file: Blob,
  fileName: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      contentType: 'audio/webm',
      upsert: false,
    });

  if (error) throw error;
  return getPublicUrl(bucket, data.path);
}
