'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  src: string;
  compact?: boolean;
}

export default function AudioPlayer({ src, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Visualization refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Cleanup Web Audio API Context on unmount to prevent 6-context hard limits
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close().catch(() => {}); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const initWebAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      
      const audio = audioRef.current;
      if (!audio) return;
      
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.warn("Web Audio API visualization failed", e);
    }
  }, []);

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const percent = dataArray[i] / 255;
        const barHeight = Math.max(2, percent * canvas.height); 
        
        ctx.fillStyle = isPlaying ? '#10b981' : '#0d9488'; // Emerald when playing, Teal otherwise
        ctx.beginPath();
        const y = (canvas.height - barHeight) / 2;
        ctx.roundRect(x, y, barWidth - 2, barHeight, 4);
        ctx.fill();

        x += barWidth;
      }
    };
    draw();
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      if (!animationRef.current) drawWaveform();
    } else {
      // Force one last draw to settle everything to idle
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
        // draw idle state manually if needed, or just let it freeze
      }
    }
  }, [isPlaying, drawWaveform]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      initWebAudio();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      audio.play().catch(e => console.error(e));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, initWebAudio]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-4 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}
      style={{
        background: 'rgba(2, 6, 23, 0.4)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <audio ref={audioRef} src={src} crossOrigin="anonymous" preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="flex items-center justify-center shrink-0 shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all"
        style={{
          width: compact ? '48px' : '56px',
          height: compact ? '48px' : '56px',
          borderRadius: '18px',
          background: 'var(--primary-gradient)',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="2" />
            <rect x="14" y="4" width="4" height="16" rx="2" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
            <path d="M5 3.847a1 1 0 011.559-.832l14.464 7.933a1 1 0 010 1.664l-14.464 7.933A1 1 0 015 19.153V3.847z" />
          </svg>
        )}
      </button>

      {/* Progress & Waveform */}
      <div className="flex-1 flex flex-col gap-2 w-full min-w-0">
        <div style={{ height: '40px', width: '100%', opacity: isLoaded ? 1 : 0.2 }}>
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={80} 
            style={{ width: '100%', height: '100%', display: 'block' }} 
          />
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            className="audio-progress flex-1"
            style={{
              background: `linear-gradient(to right, var(--emerald-accent) ${progress}%, rgba(255,255,255,0.05) ${progress}%)`,
            }}
          />
          <div className="flex tabular-nums font-black text-[10px] tracking-widest text-slate-500 uppercase font-mono" style={{ minWidth: '70px', justifyContent: 'flex-end' }}>
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{isLoaded ? formatTime(duration) : '0:00'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
