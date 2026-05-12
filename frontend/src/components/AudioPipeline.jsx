import React, { useState, useEffect } from "react";
import AudioUploader from "./AudioUploader";
import AudioPlayer from "./AudioPlayer";
import SpectrogramViewer from "./SpectrogramViewer";
import { getDemoSamples, loadDemoSample, downloadDemos } from "../api/client.js";

export default function AudioPipeline({ 
  onAudioReady, 
  activeFileData, 
  currentTime, 
  duration, 
  isPlaying, 
  onTogglePlay, 
  onSeek 
}) {
  const [demoSamples, setDemoSamples] = useState([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const DIALECT_META = {
    EGY: { name: "Egyptian", color: "#8b5cf6" },
    GLF: { name: "Gulf", color: "#34d399" },
    LEV: { name: "Levantine", color: "#38bdf8" },
    MAG: { name: "Maghrebi", color: "#fb923c" },
  };

  useEffect(() => {
    getDemoSamples()
      .then((data) => setDemoSamples(data.samples || []))
      .catch(() => setDemoSamples([]));
  }, []);

  const selectDemo = async (samplePath) => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const data = await loadDemoSample(samplePath);
      onAudioReady(data);
    } catch (err) {
      setDemoError(err.message || "Failed to load demo sample");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <section className="pipeline-section" style={{ marginBottom: '60px' }}>
      <div className="section-header" style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', margin: 0 }}>1. Audio Pipeline</h2>
        <p style={{ color: 'var(--text-muted)', margin: '8px 0 0' }}>Upload, visualize, and analyze acoustic fingerprints.</p>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
        <div className="column">
          <AudioUploader
            onUploaded={onAudioReady}
            onLoading={setLocalLoading}
          />

          <div className="card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--accent)' }}>Quick Demo Library</h3>
              <button 
                className="btn-sm" 
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await downloadDemos();
                    alert("Download started in background! Please wait a few moments and then refresh.");
                  } catch (err) {
                    alert("Failed to start download: " + err.message);
                  } finally {
                    setDownloading(false);
                  }
                }}
                style={{ fontSize: '0.7rem', padding: '4px 8px' }}
              >
                {downloading ? "Starting..." : "📥 Download Demos"}
              </button>
            </div>
            
            {demoError && (
              <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>{demoError}</p>
            )}
            
            {demoSamples.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                No demo samples found. Make sure audio files are in <code style={{ color: '#94a3b8' }}>backend/data/raw</code>.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.entries(DIALECT_META).map(([code, meta]) => {
                  const clips = demoSamples.filter(s => s.dialect === code);
                  if (clips.length === 0) return null;
                  return (
                    <div key={code}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: meta.color }}>{code}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>— {meta.name}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {clips.map(clip => (
                          <button
                            key={clip.path}
                            className="btn"
                            disabled={demoLoading}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              color: 'white',
                              fontSize: '0.75rem',
                              justifyContent: 'flex-start',
                              opacity: demoLoading ? 0.5 : 1,
                              borderLeft: `3px solid ${meta.color}`,
                              padding: '8px 12px',
                            }}
                            onClick={() => selectDemo(clip.path)}
                          >
                            <span style={{ marginRight: '6px' }}>🎙️</span>
                            {clip.filename.length > 20
                              ? clip.filename.slice(0, 18) + '…'
                              : clip.filename}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {activeFileData && (
            <AudioPlayer
              fileId={activeFileData.file_id}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onTogglePlay={onTogglePlay}
              onSeek={onSeek}
            />
          )}
        </div>

        <div className="column">
          {activeFileData ? (
            <SpectrogramViewer
              fileId={activeFileData.file_id}
            />
          ) : (
            <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>📊</div>
              <h3 style={{ color: 'var(--text-muted)' }}>Ready for Input</h3>
              <p className="summary" style={{ fontSize: '0.9rem' }}>Upload a file or select a demo to visualize its acoustic fingerprint.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
