# VoiceForm 🎙️

VoiceForm is an audio-first form builder designed to capture responses natively through voice. Create custom forms with audio questions, share unique links, and let respondents reply using their microphone directly from their browser—no accounts required!

## ✨ Features
- **Audio-First Flow:** Record questions with your voice and accept audio answers.
- **Dynamic Real-Time Waveforms:** Built-in WebAudio API canvas visualizer that reacts to your voice.
- **Per-Question Time Limits:** Control answer lengths (e.g., 30s vs 5m) per individual question.
- **Frictionless Experience:** All forms are strictly URL-based. No user logic, authentication walls, or friction—just record and share.
- **Automated Email Notifications:** Supabase Database Webhooks wired to Deno Edge Functions dispatch instant email alerts on new submissions.
- **Mobile Responsive:** Crafted elegantly using Tailwind CSS v4 glassmorphism to look pristine on mobile.
- **Serverless Backend:** Built purely on Supabase Postgres and Storage buckets.

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **Database Backend:** Supabase Postgres
- **Storage:** Supabase Storage (WebM Audio)
- **Edge Functions:** Deno runtime on Supabase (Resend Email API)

## 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/praveen0006/Voice_Forms.git
   cd Voice_Forms/voiceform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file with your Supabase keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔔 Enabling Email Notifications
1. Ensure you have the `notification_email` column configured in your Supabase `forms` table.
2. Deploy the `send-email-alert` Edge Function.
3. Configure your `RESEND_API_KEY` in your Supabase Edge Function Secrets.
