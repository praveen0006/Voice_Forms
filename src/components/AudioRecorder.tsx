'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number; // seconds
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export default function AudioRecorder({
  onRecordingComplete,
  maxDuration = 300, // Increased to 5 minutes
  disabled = false,
  onRecordingStateChange,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Visualization refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close() } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecordingRef.current) {
        // clear it back to empty when stopped
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const percent = dataArray[i] / 255;
        // Add minimum height of 2px
        const barHeight = Math.max(2, percent * canvas.height); 
        
        ctx.fillStyle = '#a78bfa'; // violet-light color
        ctx.beginPath();
        const y = (canvas.height - barHeight) / 2;
        
        ctx.roundRect(x, y, barWidth - 2, barHeight, 4);
        ctx.fill();

        x += barWidth;
      }
    };
    
    draw();
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionDenied(true);
      console.error('Microphone API not available. This might be because the site is not using HTTPS.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionDenied(false);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        isRecordingRef.current = false;
        setIsRecording(false);
        onRecordingStateChange?.(false);
        
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          try { audioCtxRef.current.close().catch(() => {}) } catch {}
        }
      };

      mediaRecorder.start(100); // collect data every 100ms
      isRecordingRef.current = true;
      setIsRecording(true);
      onRecordingStateChange?.(true);
      setDuration(0);

      // Web Audio API for visualization
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // Gives 32 bins (perfect for our canvas)
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
        
        // Start animation loop
        drawWaveform();
      } catch (e) {
        console.warn('Web Audio API visualization failed', e);
      }

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev + 1 >= maxDuration) {
            // Because stopRecording is a useCallback without maxDuration, this is safe to call
              if (mediaRecorderRef.current && isRecordingRef.current) {
              mediaRecorderRef.current.stop();
            }
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setPermissionDenied(true);
    }
  }, [maxDuration, onRecordingComplete, drawWaveform, onRecordingStateChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Record Console */}
      <div className="relative group">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className={`relative z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-[32px] flex items-center justify-center transition-all duration-500 active:scale-95 shadow-premium ${isRecording ? 'bg-red-500 scale-110' : 'bg-violet-600 hover:bg-violet-500 hover:rotate-3'}`}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg animate-pulse" />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="sm:w-12 sm:h-12">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        
        {/* Glowing Backgrounds */}
        <div className={`absolute inset-0 blur-2xl -z-10 transition-all duration-700 ${isRecording ? 'bg-red-500/40 scale-150' : 'bg-violet-600/20 scale-110 opacity-0 group-hover:opacity-100'}`} />
      </div>

      {/* Analytics & Signal Status */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Signal Visualization */}
        <div className={`h-12 w-full max-w-[280px] bg-white/[0.02] rounded-2xl border border-white/5 transition-all duration-500 flex items-center justify-center p-2 ${isRecording ? 'opacity-100' : 'opacity-30'}`}>
          <canvas ref={canvasRef} width={280} height={40} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {isRecording ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Live Transmission</span>
              </div>
              <div className="font-black text-lg tabular-nums tracking-tighter text-white">
                {formatTime(duration)} <span className="text-white/20">/</span> <span className="text-white/40">{formatTime(maxDuration)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Initialize Voice Stream</span>
              <span className="text-[9px] mt-1 font-bold text-slate-600 uppercase tracking-widest">Cap: {formatTime(maxDuration)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Permission Block */}
      {permissionDenied && (
        <div className="animate-fade-in bg-red-500/10 backdrop-blur-md p-6 rounded-[28px] border border-red-500/20 max-w-[320px] shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center text-white font-black text-lg">!</div>
             <h4 className="text-sm font-black uppercase tracking-tight text-red-500">Signal Blocked</h4>
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
            Microphone access is required for transmission. Ensure <strong>HTTPS</strong> is active or check browser permissions.
          </p>
        </div>
      )}
    </div>
  );
}
