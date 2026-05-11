import { useEffect, useState } from "react";
import { getHealth, getDemoSamples, loadDemoSample } from "./api/client.js";

// Member 1 Components
import AudioUploader from "./components/AudioUploader";
import AudioPlayer from "./components/AudioPlayer";
import SpectrogramViewer from "./components/SpectrogramViewer";

// Member 2 Components
import ClassifierResult from "./components/ClassifierResult";
import FeatureExplanation from "./components/FeatureExplanation";



const modules = [
  { name: "audio", owner: "Member 1", label: "Audio, spectrogram, features" },
  { name: "classify", owner: "Member 2", label: "Classic ML classifier" },
  { name: "transcribe", owner: "Member 3", label: "Real-time STT" },
  { name: "translate", owner: "Member 4", label: "Dialect conversion and TTS" },
];


function StatusPill({ ok }) {
  return (
    <span className={ok ? "status status-ok" : "status status-waiting"}>
      {ok ? "Ready" : "Waiting"}
    </span>
  );
}


export default function App() {
  const [apiStatus, setApiStatus] = useState(null);

  // Member 1 State
  const [activeFileData, setActiveFileData] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const health = await getHealth();
        if (isMounted) {
          setApiStatus(health);
        }
      } catch (error) {
        if (isMounted) {
          setApiStatus({ status: "offline", error: error.message });
        }
      }
    }

    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const apiReady = apiStatus?.status === "ok";

  const [activeTab, setActiveTab] = useState("audio");

  // Demo samples from Downloaded Test Samples folder
  const [demoSamples, setDemoSamples] = useState([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState(null);

  const DIALECT_META = {
    EGY: { name: "Egyptian", emoji: "🇪🇬", color: "#8b5cf6" },
    GLF: { name: "Gulf", emoji: "🇦🇪", color: "#34d399" },
    LEV: { name: "Levantine", emoji: "🇱🇧", color: "#38bdf8" },
    MAG: { name: "Maghrebi", emoji: "🇲🇦", color: "#fb923c" },
  };

  useEffect(() => {
    if (!apiReady) return;
    getDemoSamples()
      .then((data) => setDemoSamples(data.samples || []))
      .catch(() => setDemoSamples([]));
  }, [apiReady]);

  const selectDemo = async (samplePath) => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const data = await loadDemoSample(samplePath);
      setActiveFileData(data);
    } catch (err) {
      setDemoError(err.message || "Failed to load demo sample");
    } finally {
      setDemoLoading(false);
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
        <StatusPill ok={apiReady} />
      </section>

      {/* Tab Navigation */}
      <nav className="tabs-nav">
        {modules.map((m) => (
          <button
            key={m.name}
            className={`tab-btn ${activeTab === m.name ? "active" : ""}`}
            onClick={() => setActiveTab(m.name)}
          >
            {m.name === "audio" ? "Audio Pipeline" :
              m.name === "classify" ? "ML Classifier" :
                m.name === "transcribe" ? "Real-time STT" :
                  "Conversion"}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Audio Tab */}
        <div style={{ display: activeTab === "audio" ? "block" : "none" }}>
          <section className="member-work-area">
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
              <div className="column">
                <AudioUploader
                  onUploaded={setActiveFileData}
                  onLoading={setLoading}
                />

                <div className="card" style={{ marginTop: '24px' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--accent)' }}>Quick Demo Library</h3>
                  {demoError && (
                    <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>{demoError}</p>
                  )}
                  {demoSamples.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      No demo samples found. Run <code style={{ color: '#94a3b8' }}>python download.py</code> in the "Downloaded Test Samples" folder.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {Object.entries(DIALECT_META).map(([code, meta]) => {
                        const clips = demoSamples.filter(s => s.dialect === code);
                        if (clips.length === 0) return null;
                        return (
                          <div key={code}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '1.1rem' }}>{meta.emoji}</span>
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
                    onTimeUpdate={setCurrentTime}
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
        </div>

        {/* Classify Tab */}
        <div style={{ display: activeTab === "classify" ? "block" : "none" }}>
          <section className="member-work-area">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
              <ClassifierResult fileId={activeFileData?.file_id ?? null} />
              <FeatureExplanation fileId={activeFileData?.file_id ?? null} />
            </div>
          </section>
        </div>

        {/* Transcribe Tab */}
        <div style={{ display: activeTab === "transcribe" ? "block" : "none" }}>
          <div className="locked-card">
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>✍️</div>
            <h2>Member 3: Real-time STT</h2>
            <p className="summary" style={{ margin: '0 auto 24px' }}>Word-level transcription and real-time synchronization with audio playback.</p>
            <span className="badge-locked">Status: Waiting for Member 3 Integration</span>
          </div>
        </div>

        {/* Translate Tab */}
        <div style={{ display: activeTab === "translate" ? "block" : "none" }}>
          <div className="locked-card">
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🌍</div>
            <h2>Member 4: Dialect Conversion & TTS</h2>
            <p className="summary" style={{ margin: '0 auto 24px' }}>Text translation and speech synthesis into target dialects (EGY, GLF, LEV, MAG).</p>
            <span className="badge-locked">Status: Waiting for Member 4 Integration</span>
          </div>
        </div>

      </div>
    </main>
  );
}

