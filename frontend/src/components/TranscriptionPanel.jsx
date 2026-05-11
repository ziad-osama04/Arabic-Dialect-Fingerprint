import React, { useEffect, useState, useRef } from 'react';

const TranscriptionPanel = ({ fileId, currentTime, onTranscriptReady }) => {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!fileId) return;
    setWords([]);
    setError(null);
    fetchWords();
  }, [fileId]);

  const fetchWords = async () => {
    setLoading(true);
    try {
      // Direct fetch to backend - consistent with project's simple API usage
      const res = await fetch(`http://localhost:8000/transcribe/words?file_id=${fileId}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const fetchedWords = data.words || [];
      setWords(fetchedWords);

      if (onTranscriptReady) {
        const transcriptText = fetchedWords.map(w => w.word).join(' ');
        onTranscriptReady(transcriptText);
      }
    } catch (err) {
      setError('Failed to load transcription. Ensure the model is loaded on the backend.');
      console.error('Failed to fetch words:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const activeEl = containerRef.current?.querySelector('.active-word');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);

  const handleCopy = () => {
    const text = words.map(w => w.word).join(' ');
    navigator.clipboard.writeText(text).then(() => {
      // We can use a custom toast here if available, or just alert
      alert('Transcript copied to clipboard!');
    });
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
    <div className="card transcription-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Arabic Transcription</h3>
        {words.length > 0 && (
          <button className="btn btn-sm" onClick={handleCopy}>
            📋 Copy Text
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '16px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ marginRight: '10px' }} />
          <span>Analyzing speech...</span>
        </div>
      ) : words.length > 0 ? (
        <div 
          ref={containerRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            direction: 'rtl', 
            padding: '16px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '16px',
            lineHeight: '2',
            fontSize: '1.2rem'
          }}
        >
          {words.map((w, i) => {
            const isActive = currentTime >= w.start && currentTime < w.end;
            return (
              <span
                key={i}
                className={`transcript-word${isActive ? ' active-word' : ''}`}
                style={{
                  display: 'inline-block',
                  margin: '0 4px',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  boxShadow: isActive ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
                  fontWeight: isActive ? '700' : '400'
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No speech detected in this segment.
        </div>
      )}
    </div>
  );
};

export default TranscriptionPanel;
