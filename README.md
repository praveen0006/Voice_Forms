# VoiceForm 🎙️ — Audio-First Form Builder

VoiceForm is a premium, audio-first form builder designed to capture high-fidelity voice responses natively. Create custom forms with audio questions, share unique links, and let respondents listen and reply using their microphone directly from their browser—no accounts required and fully optimized for all devices.

## ✨ Latest Features (V2.0)
- **Premium UX Redesign:** Overhauled UI with glassmorphism, smooth micro-animations, and a "mesh-gradient" aesthetic.
- **Mobile-First Responsive System:** Dedicated sticky navigation for mobile respondents and optimized touch targets for easier one-handed use.
- **Intelligent Save Logic:** Optimized "Upsert" logic in the builder that prevents data loss for existing respondent answers during form edits.
- **Header Context Media:** Support for both intro videos and cover images to provide rich context before questions start.
- **Secure Context Handling:** Graceful fallback and user guidance for microphone access in non-HTTPS environments (mobile safety).
- **Per-Question Precision:** Individual time limits (30s to 5m) and requirement toggles for every question.
- **Real-Time Visualization:** Optimized waveform canvas visualizers for both the builder and the respondent interface.

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS + Vanilla CSS Variables (Custom Mobile-First Design System)
- **Database:** Supabase Postgres
- **Storage:** Supabase Storage (Audio WebM, Media Uploads)
- **Edge Runtime:** Supabase Edge Functions (Resend Email API)

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
   Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Database Setup:**
   Run the SQL provided in `supabase_migration.sql` in your Supabase SQL Editor. This includes:
   - `forms` (title, media_urls, notification_email)
   - `questions` (audio_url, text, order, validation)
   - `responses` & `answers` (mapping audio captures to submissions)

5. **Development:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the builder.

## 🔒 Security & Privacy
- **Secure Recording:** Microphone access requires HTTPS. Ensure your deployment (Vercel/Netlify) is SSL-enabled. For local mobile testing, use `ngrok` or similar secure tunnels.
- **Audio Privacy:** Recordings are stored in private storage buckets, only accessible via unique form IDs.

## 🎨 Design Philosophy
VoiceForm follows an **Audio-First** philosophy. We believe that voice capture shouldn't be a secondary feature—it should be the core interaction. Our design focuses on:
1. **Low Friction:** No login for respondents.
2. **Visual Feedback:** Waveforms that make audio feel "tangible".
3. **Accessibility:** Fallback text for every audio prompt.

---
*Created with ❤️ by the VoiceForm Team (Powered by NexEraEco)*
