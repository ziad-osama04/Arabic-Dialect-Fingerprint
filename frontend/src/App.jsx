import { useEffect, useState, useRef, memo } from "react";
import { getHealth, API_BASE_URL } from "./api/client.js";

// Member Components
import AudioPipeline from "./components/AudioPipeline";
import ClassifierResult from "./components/ClassifierResult";
import FeatureExplanation from "./components/FeatureExplanation";
import TranscriptionPanel from "./components/TranscriptionPanel";
import ConversionPanel from "./components/ConversionPanel";

// Use components directly
const MemoizedClassifierResult = ClassifierResult;
const MemoizedFeatureExplanation = FeatureExplanation;
const MemoizedConversionPanel = ConversionPanel;

export default function App() {
  const [apiStatus, setApiStatus] = useState(null);
  const [activeFileData, setActiveFileData] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioTimestamp, setAudioTimestamp] = useState(Date.now());
  const [words, setWords] = useState([]); // Lifted State
  const [detectedDialect, setDetectedDialect] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStatus() {
      try {
        const health = await getHealth();
        if (isMounted) setApiStatus(health);
      } catch (error) {
        if (isMounted) setApiStatus({ status: "offline", error: error.message });
      }
    }
    loadStatus();
    return () => { isMounted = false; };
  }, []);

  const onAudioReady = (data) => {
    setFileId(data.file_id);
    setActiveFileData(data);
    setIsPlaying(false);
    setAudioTimestamp(Date.now());
    setWords([]); // Clear words for new file
    setDetectedDialect(null); // Reset detection for new file
    
    // Auto-trigger transcription in background
    handleTranscribe(data.file_id);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleTranscribe = async (id) => {
    try {
      // Trigger background task
      await fetch(`${API_BASE_URL}/transcribe/demo/${id}`, { method: 'POST' });
      
      // Initial fetch to see if it's already done (for demos)
      const res = await fetch(`${API_BASE_URL}/transcribe/words?file_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setWords(data.words || []);
      }
    } catch (err) {
      console.error("Transcription trigger failed:", err);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = (e) => {
    const t = e.target.currentTime;
    if (t === 0 && currentTime > 0.5) return;
    setCurrentTime(t);
  };

  const handleLoadedMetadata = (e) => {
    setDuration(e.target.duration);
  };

  const seek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Acoustic Fingerprinting</p>
          <h1>Arabic Dialect<br />Fingerprint</h1>
          <p className="summary">
            A state-of-the-art collaborative workstation for Arabic dialect detection,
            visualization, and conversion using classic signal processing.
          </p>
        </div>
      </section>

      {fileId && (
        <audio
          ref={audioRef}
          key={fileId}
          src={`${API_BASE_URL}/audio/file/${fileId}?t=${audioTimestamp}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      <div className="scrolling-content" style={{ display: 'flex', flexDirection: 'column', gap: '80px', paddingBottom: '100px' }}>

        {/* Section 1: Audio Pipeline */}
        <AudioPipeline
          onAudioReady={onAudioReady}
          activeFileData={activeFileData}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onSeek={seek}
        />

        {/* Section 2: ML Classifier */}
        <section className="classifier-section">
          <div className="section-header" style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '2rem', margin: 0 }}>2. ML Classifier</h2>
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 0' }}>Detect dialect probabilities and analyze feature importance (SHAP).</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
            <MemoizedClassifierResult fileId={fileId} onDialectDetected={setDetectedDialect} />
            <MemoizedFeatureExplanation fileId={fileId} />
          </div>
        </section>

        {/* Section 3: Real-time STT */}
        <section className="transcription-section">
          <div className="section-header" style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '2rem', margin: 0 }}>3. Real-time STT</h2>
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 0' }}>Synchronized Arabic speech recognition with word-level timing.</p>
          </div>
          <TranscriptionPanel
            fileId={fileId}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onSeek={seek}
            words={words}
            setWords={setWords}
          />
        </section>

        {/* Section 4: Conversion */}
        <div id="section-conversion">
          <MemoizedConversionPanel 
            words={words} 
            currentTime={currentTime} 
            detectedDialect={detectedDialect}
          />
        </div>

      </div>
    </main>
  );
}
