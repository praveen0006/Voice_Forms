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
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
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
              isRecordingRef.current = false;
              setIsRecording(false);
              onRecordingStateChange?.(false);
              if (animationRef.current) cancelAnimationFrame(animationRef.current);
              if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                try { audioCtxRef.current.close().catch(() => {}) } catch {}
              }
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
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingStateChange?.(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close() } catch {}
      }
    }
  }, [onRecordingStateChange]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Record Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        className={`record-btn ${isRecording ? 'recording' : ''}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        <div className="inner" />
      </button>

      {/* Timer / Status */}
      <div className="flex flex-col items-center gap-2 w-full mt-2">
        {/* The Waveform Canvas */}
        <div style={{ height: '40px', width: '100%', maxWidth: '200px', opacity: isRecording ? 1 : 0.4, transition: 'opacity 0.3s' }}>
          <canvas ref={canvasRef} width={200} height={40} style={{ width: '100%', height: '100%' }} />
        </div>

        {isRecording ? (
          <div className="flex items-center gap-2">
            <span className="badge badge-recording">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(duration)} / {formatTime(maxDuration)}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Tap to record (max {maxDuration}s)
          </span>
        )}
      </div>

      {/* Permission Error */}
      {permissionDenied && (
        <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', textAlign: 'center' }}>
          Microphone access denied. Please allow microphone access in your browser settings.
        </p>
      )}
    </div>
  );
}
