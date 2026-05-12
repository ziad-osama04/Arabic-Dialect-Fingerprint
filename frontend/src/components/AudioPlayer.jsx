import React from "react";

export default function AudioPlayer({ 
  fileId, 
  currentTime, 
  duration, 
  isPlaying, 
  onTogglePlay, 
  onSeek 
}) {
  if (!fileId) return null;

  const [localTime, setLocalTime] = React.useState(currentTime);
  const [isDragging, setIsDragging] = React.useState(false);

  // Sync local time with global time when not dragging
  React.useEffect(() => {
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = (e) => {
    const val = parseFloat(e.target.value);
    setIsDragging(false);
    onSeek(val);
  };

  const handleInputChange = (e) => {
    setLocalTime(parseFloat(e.target.value));
  };

  return (
    <div className="card" style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-card)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button 
          className="circle" 
          onClick={onTogglePlay}
          style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: '50%', 
            background: '#333', 
            color: '#eee', 
            border: 'none', 
            display: 'grid', 
            placeContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: '0.5s ease-in'
          }}
        >
          <span className="material-icons" style={{ fontSize: '32px' }}>
            {isPlaying ? "pause_circle" : "play_circle"}
          </span>
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            <span>{formatTime(localTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type="range" 
              min="0" 
              max={duration || 0} 
              step="0.1" 
              value={localTime} 
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              onMouseUp={handleMouseUp}
              onTouchEnd={handleMouseUp}
              onChange={handleInputChange}
              style={{ 
                width: '100%', 
                accentColor: 'var(--primary)', 
                height: '4px', 
                borderRadius: '2px',
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
