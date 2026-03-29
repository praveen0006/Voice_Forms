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
        try { audioCtxRef.current.close().catch(() => {}); } catch(e) {}
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
        
        ctx.fillStyle = isPlaying ? '#ec4899' : '#a78bfa'; // pink when playing, violet otherwise
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
      className={`flex items-center gap-3 ${compact ? 'p-2' : 'p-3'}`}
      style={{
        background: 'var(--bg-glass)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <audio ref={audioRef} src={src} crossOrigin="anonymous" preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="flex items-center justify-center shrink-0"
        style={{
          width: compact ? '36px' : '40px',
          height: compact ? '36px' : '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-violet), #6d28d9)',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: 'white',
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </button>

      {/* Progress, Form & Time */}
      <div className="flex-1 flex flex-col gap-1 w-full min-w-0">
        <div style={{ height: '30px', width: '100%', opacity: isLoaded ? 1 : 0.4 }}>
          <canvas ref={canvasRef} width={200} height={30} style={{ width: '100%', height: '100%' }} />
        </div>
        
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="audio-progress"
          style={{
            background: `linear-gradient(to right, var(--accent-violet) ${progress}%, var(--bg-glass-strong) ${progress}%)`,
          }}
        />
        <div className="flex justify-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>{formatTime(currentTime)}</span>
          <span>{isLoaded ? formatTime(duration) : '...'}</span>
        </div>
      </div>
    </div>
  );
}
