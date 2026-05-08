import { useEffect, useState } from "react";
import { getHealth } from "./api/client.js";

// Member 1 Components
import AudioUploader from "./components/AudioUploader";
import AudioPlayer from "./components/AudioPlayer";
import SpectrogramViewer from "./components/SpectrogramViewer";


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

  const demoClips = [
    { id: "EGY_spk01", name: "Egyptian", dialect: "EGY" },
    { id: "LAV_spk01", name: "Levantine", dialect: "LAV" },
    { id: "GLF_spk01", name: "Gulf", dialect: "GLF" },
    { id: "MAR_spk01", name: "Moroccan", dialect: "MAR" },
  ];

  const selectDemo = (id) => {
    setActiveFileData({ file_id: id });
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
        {activeTab === "audio" && (
          <section className="member-work-area">
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
              <div className="column">
                <AudioUploader
                  onUploaded={setActiveFileData}
                  onLoading={setLoading}
                />

                <div className="card" style={{ marginTop: '24px' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--accent)' }}>Quick Demo Library</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {demoClips.map(clip => (
                      <button
                        key={clip.id}
                        className="btn"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.8rem', justifyContent: 'flex-start' }}
                        onClick={() => selectDemo(clip.id)}
                      >
                        <span style={{ marginRight: '8px' }}>🎙️</span> {clip.name}
                      </button>
                    ))}
                  </div>
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
        )}

        {activeTab === "classify" && (
          <div className="locked-card">
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>⚖️</div>
            <h2>Member 2: Classic ML Classifier</h2>
            <p className="summary" style={{ margin: '0 auto 24px' }}>Training and serving the dialect identification model using scikit-learn.</p>
            <span className="badge-locked">Status: Waiting for Member 2 Integration</span>
          </div>
        )}

        {activeTab === "transcribe" && (
          <div className="locked-card">
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>✍️</div>
            <h2>Member 3: Real-time STT</h2>
            <p className="summary" style={{ margin: '0 auto 24px' }}>Word-level transcription and real-time synchronization with audio playback.</p>
            <span className="badge-locked">Status: Waiting for Member 3 Integration</span>
          </div>
        )}

        {activeTab === "translate" && (
          <div className="locked-card">
            <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🌍</div>
            <h2>Member 4: Dialect Conversion & TTS</h2>
            <p className="summary" style={{ margin: '0 auto 24px' }}>Text translation and speech synthesis into target dialects (EGY, LAV, GLF, MAR).</p>
            <span className="badge-locked">Status: Waiting for Member 4 Integration</span>
          </div>
        )}

      </div>
    </main>
  );
}

