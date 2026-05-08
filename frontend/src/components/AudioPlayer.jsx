import { useEffect, useRef, useState } from "react";

export default function AudioPlayer({ fileId, onTimeUpdate }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioUrl = fileId ? `http://localhost:8000/audio/file/${fileId}` : null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleProgressChange = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  if (!fileId) return null;

  return (
    <div className="card" style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-card)' }}>
      <audio ref={audioRef} src={audioUrl} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button 
          className="btn" 
          onClick={togglePlay}
          style={{ 
            width: '72px', 
            height: '72px', 
            borderRadius: '50%', 
            background: 'var(--primary)', 
            color: 'white', 
            border: 'none', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.5)',
            flexShrink: 0,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" style={{ width: '40px', height: '40px', fill: 'white', display: 'block' }}>
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: '40px', height: '40px', fill: 'white', display: 'block', marginLeft: '6px' }}>
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type="range" 
              min="0" 
              max={duration || 0} 
              step="0.1" 
              value={currentTime} 
              onChange={handleProgressChange}
              style={{ 
                width: '100%', 
                accentColor: 'var(--primary)', 
                height: '6px', 
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
