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
          className="circle" 
          onClick={togglePlay}
          style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: '#333', 
            color: '#eee', 
            border: 'none', 
            display: 'grid', 
            placeContent: 'center',
            cursor: 'pointer',
            animation: 'grow 1s infinite',
            flexShrink: 0,
            transition: '0.5s ease-in'
          }}
        >
          <span className="material-icons" style={{ fontSize: '40px' }}>
            {isPlaying ? "pause_circle" : "play_circle"}
          </span>
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
