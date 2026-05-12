import { useEffect, useState, memo } from 'react';
import { API_BASE_URL } from '../api/client.js';
import AudioPlayer from './AudioPlayer';

const TranscriptionPanel = ({ 
  fileId, 
  currentTime, 
  duration, 
  isPlaying, 
  onTogglePlay, 
  onSeek,
  words,
  setWords
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  useEffect(() => {
    if (!fileId) return;
    setError(null);
    setActiveWordIndex(-1);
    startTranscription();
  }, [fileId]);

  const startTranscription = async () => {
    setLoading(true);
    setError(null);
    try {
      // Background processing is already triggered by App.jsx
      // We just poll for results
      let retry = 0;
      let data = null;
      
      while (retry < 5) {
        const res = await fetch(`${API_BASE_URL}/transcribe/words?file_id=${fileId}`);
        if (res.ok) {
          data = await res.json();
          if (data.words && data.words.length > 0) break;
        }
        await new Promise(r => setTimeout(r, 2000));
        retry++;
      }
      
      if (data && data.words) {
        setWords(data.words);
      }
    } catch (err) {
      setError('Transcription failed. Ensure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const index = words.findIndex(w => currentTime >= w.start && currentTime < w.end);
    if (index !== -1 && index !== activeWordIndex) {
      setActiveWordIndex(index);
    }
  }, [currentTime, words, activeWordIndex]);

  const handleCopy = () => {
    const text = words.map(w => w.word).join(' ');
    navigator.clipboard.writeText(text).then(() => alert('Transcript copied to clipboard!'));
  };

  if (!fileId) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px', opacity: 0.6 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎙️</div>
        <p>Upload or select an audio file to see the transcription.</p>
      </div>
    );
  }

  return (
    <div className="card transcription-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <AudioPlayer 
        fileId={fileId} 
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Arabic Transcription</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {words.length > 0 && (
            <button className="btn btn-sm" onClick={handleCopy}>
              📋 Copy Text
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
        {loading && words.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ marginRight: '10px' }} />
            <span>AI is listening...</span>
          </div>
        ) : (
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '20px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '16px',
              lineHeight: '2',
              fontSize: '1.2rem',
              direction: 'rtl',
              textAlign: 'right'
            }}
          >
            {words.map((w, i) => {
              if (w.start > currentTime) return null;
              const isActive = currentTime >= w.start && currentTime < w.end;
              return (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    margin: '0 4px',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    boxShadow: isActive ? '0 4px 15px rgba(139, 92, 246, 0.4)' : 'none',
                    fontWeight: isActive ? '700' : '400',
                    animation: isActive ? 'fadeInScale 0.3s ease-out' : 'none'
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptionPanel;
