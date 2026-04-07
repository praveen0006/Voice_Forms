import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', minHeight: '60vh' }}>
      <h1 className="text-3xl font-bold mb-8 gradient-text">Privacy Policy & Terms of Service</h1>
      
      <div className="glass-card p-8 text-left space-y-8" style={{ color: 'var(--text-secondary)' }}>
        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>1. What Information We Collect</h2>
          <p className="mb-4">
            When you use VoiceForm, we collect the following types of information:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Audio Recordings:</strong> When you record a question or provide an audio response, those audio files are uploaded to our secure cloud storage.</li>
            <li><strong>Text Responses:</strong> Any form titles, email addresses (optional for notifications), or text-based answers you provide.</li>
            <li><strong>Usage Data:</strong> Basic interaction data to ensure the platform functions smoothly.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>2. How We Store Your Data</h2>
          <p className="mb-4">
            We prioritize the security of your data. VoiceForm uses <strong>Supabase</strong> (a secure, open-source backend) to store your information:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Database Storage:</strong> Form configurations and textual answers are stored securely in a relational database.</li>
            <li><strong>Media Storage:</strong> Audio recordings are stored in secure, cloud-based object storage buckets.</li>
            <li><strong>Local Storage:</strong> We only use your browser&apos;s local storage to remember which forms you&apos;ve created so you can easily access them again.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>3. No AI Training or Processing</h2>
          <p>
            Your voice is your own. We do <strong>not</strong> process your audio through any artificial intelligence models for transcription unless explicitly stated on a specific feature, and we <strong>never</strong> use your audio files to train AI models. Audio recordings are solely used for playback by the form creator.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>4. Terms of Service</h2>
          <p className="mb-4">By using VoiceForm, you agree to the following basic terms:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You will not use VoiceForm to collect highly sensitive personal data (such as SSNs or personal health information) as this is a basic tool.</li>
            <li>You will respect the privacy of your respondents and only use their data for the purposes you communicate to them.</li>
            <li>You understand that while we implement standard security measures, no system is completely immune to breaches.</li>
            <li>We reserve the right to remove forms or restrict access if the platform is being abused.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>5. Deleting Your Data</h2>
          <p>
            If you need a form and its associated responses completely deleted from our servers, please contact us (assuming you provided the notification email) or delete the form directly if the feature is available.
          </p>
        </section>
      </div>
    </div>
  );
}
