import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { getSpectrogram, getFeatureEvolution } from "../api/client";

function FeatureCurves({ mfcc, centroid, bbox }) {
  if (!bbox) return null;

  const createPath = (data) => {
    if (!data || data.length === 0) return "";
    return data.map((p, i) => {
      const x = (bbox[0] + p.t * bbox[2]) * 100;
      const y = (1 - (bbox[1] + p.v * bbox[3])) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");
  };

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <path
        d={createPath(mfcc)}
        fill="none"
        stroke="#34d399"
        strokeWidth="0.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "all 0.3s ease" }}
      />
      <path
        d={createPath(centroid)}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="0.3"
        strokeDasharray="0.8,0.8"
        strokeLinecap="round"
        style={{ transition: "all 0.3s ease" }}
      />
    </svg>
  );
}

function FingerprintPeak({ peak, bbox }) {
  const [hovered, setHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const leftPct = (bbox[0] + peak.time_pct * bbox[2]) * 100;
  const topPct = (1 - (bbox[1] + peak.freq_pct * bbox[3])) * 100;

  const handleMouseEnter = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    setHovered(true);
  };

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Figure out if tooltip should go above or below the cursor
  const showAbove = mousePos.y > window.innerHeight / 2;
  const showLeft = mousePos.x > window.innerWidth * 0.7;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: "20px",
        height: "20px",
        cursor: "help",
        transform: "translate(-50%, -50%)",
        zIndex: hovered ? 1000 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          width: "4px",
          height: "4px",
          background: "#fbbf24",
          borderRadius: "50%",
          boxShadow: hovered ? "0 0 15px #fbbf24" : "0 0 4px rgba(251, 191, 36, 0.4)",
          transform: hovered ? "scale(1.8)" : "none",
          transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
        }}
      />

      {hovered && ReactDOM.createPortal(
        <div style={{
          position: "fixed",
          left: showLeft ? "auto" : `${mousePos.x + 16}px`,
          right: showLeft ? `${window.innerWidth - mousePos.x + 16}px` : "auto",
          top: showAbove ? "auto" : `${mousePos.y + 16}px`,
          bottom: showAbove ? `${window.innerHeight - mousePos.y + 16}px` : "auto",
          background: "rgba(15, 23, 42, 0.98)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          padding: "16px",
          width: "220px",
          fontSize: "0.8rem",
          color: "white",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)",
          zIndex: 9999,
          pointerEvents: "none",
          animation: "fadeIn 0.15s ease-out"
        }}>
          <div style={{ fontWeight: "900", color: "#fbbf24", marginBottom: "8px", letterSpacing: "0.02em", textTransform: "uppercase", fontSize: "0.7rem" }}>Acoustic Fingerprint</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            <div style={{ opacity: 0.6 }}>Time:</div> <div style={{ fontWeight: "600" }}>{peak.time.toFixed(2)}s</div>
            <div style={{ opacity: 0.6 }}>Frequency:</div> <div style={{ fontWeight: "600" }}>{Math.round(peak.frequency)} Hz</div>
            <div style={{ opacity: 0.6 }}>Strength:</div> <div style={{ fontWeight: "600" }}>{Math.round(peak.strength * 100)}%</div>
          </div>
          <div style={{ paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", lineHeight: "1.4", fontSize: "0.75rem", color: "#94a3b8" }}>
            This local energy peak represents a <strong>stable dialect feature</strong> used in the fingerprinting algorithm.
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function SpectrogramViewer({ fileId }) {
  const [specData, setSpecData] = useState(null);
  const [evolveData, setEvolveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPeaks, setShowPeaks] = useState(true);
  const [overlayMode, setOverlayMode] = useState("fingerprint");

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [spectroOpacity, setSpectroOpacity] = useState(80);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const specCache = useRef({});
  const evolveCache = useRef({});

  // Clear caches when a completely new file is loaded
  useEffect(() => {
    specCache.current = {};
    evolveCache.current = {};
  }, [fileId]);

  useEffect(() => {
    if (!fileId) return;

    const specKey = `${showPeaks}_${overlayMode}`;
    const needsSpec = !specCache.current[specKey];
    const needsEvolve = !evolveCache.current[fileId];

    if (!needsSpec && !needsEvolve) {
      setSpecData(specCache.current[specKey]);
      setEvolveData(evolveCache.current[fileId]);
      return;
    }

    setLoading(true);
    setError(null);

    const promises = [];
    
    if (needsSpec) {
      promises.push(
        getSpectrogram(fileId, showPeaks, overlayMode).then(res => {
          specCache.current[specKey] = res;
          return res;
        })
      );
    } else {
      promises.push(Promise.resolve(specCache.current[specKey]));
    }

    if (needsEvolve) {
      promises.push(
        getFeatureEvolution(fileId).then(res => {
          evolveCache.current[fileId] = res;
          return res;
        })
      );
    } else {
      promises.push(Promise.resolve(evolveCache.current[fileId]));
    }

    Promise.all(promises)
      .then(([spec, evolve]) => {
        setSpecData(spec);
        setEvolveData(evolve);
      })
      .catch(err => setError(err.message || "Failed to load visualization data"))
      .finally(() => setLoading(false));
  }, [fileId, showPeaks, overlayMode]);

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setSpectroOpacity(80);
  };

  const handleZoomChange = (val) => {
    setZoom(val);
    if (val <= 1) { setPanX(0); setPanY(0); }
  };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { x: panX, y: panY };
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPanX(panStart.current.x + dx);
    setPanY(panStart.current.y + dy);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  if (!fileId) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Acoustic Signature Card */}
      <div className="card">
        {/* Card Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0 }}>Acoustic Fingerprint</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:image/png;base64,${specData.image_b64}`;
                link.download = `spectrogram_${overlayMode}_${fileId.substring(0, 8)}.png`;
                link.click();
              }}
              className="btn"
              style={{ 
                fontSize: "0.7rem", 
                padding: "4px 12px", 
                background: "var(--primary)", 
                color: "white",
                border: "none", 
                display: specData ? 'flex' : 'none', 
                alignItems: 'center', 
                gap: '6px',
                fontWeight: "600",
                boxShadow: "0 4px 12px -2px rgba(139,92,246,0.5)"
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Download Figure
            </button>
            <button
              onClick={handleReset}
              className="btn"
              style={{ 
                fontSize: "0.7rem", 
                padding: "4px 12px", 
                background: "rgba(239, 68, 68, 0.1)", 
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                fontWeight: "500"
              }}
            >
              Reset View
            </button>
          </div>
        </div>

        {/* Display Mode Selector */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", padding: "4px", background: "rgba(0,0,0,0.3)", borderRadius: "12px", border: "1px solid var(--border-card)" }}>
          {[
            { key: "plain", label: "Plain Mel", icon: "▦" },
            { key: "fingerprint", label: "Fingerprint", icon: "◉" },
            { key: "mfcc", label: "MFCC Projection", icon: "~" },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setOverlayMode(key)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "9px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: overlayMode === key ? "700" : "500",
                background: overlayMode === key ? "var(--primary)" : "transparent",
                color: overlayMode === key ? "white" : "var(--text-muted)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: overlayMode === key ? "0 4px 12px -2px rgba(139,92,246,0.5)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <span style={{ fontSize: "1rem" }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Visual Controls Bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "24px",
          padding: "12px 16px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: "12px",
          border: "1px solid var(--border-card)",
          marginBottom: "12px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <span>Brightness</span>
              <span>{brightness}%</span>
            </div>
            <input
              type="range" min="50" max="200" value={brightness}
              onChange={(e) => setBrightness(e.target.value)}
              style={{ accentColor: "var(--primary)", height: "4px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <span>Contrast</span>
              <span>{contrast}%</span>
            </div>
            <input
              type="range" min="50" max="200" value={contrast}
              onChange={(e) => setContrast(e.target.value)}
              style={{ accentColor: "var(--primary)", height: "4px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <span>Zoom Level</span>
              <span>{zoom}x</span>
            </div>
            <input
              type="range" min="1" max="3" step="0.1" value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              style={{ accentColor: "var(--primary)", height: "4px" }}
            />
          </div>
        </div>

        {/* Global Opacity Slider (Row 2) */}
        {overlayMode === "mfcc" && (
          <div style={{
            marginBottom: "20px",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "12px",
            border: "1px solid var(--border-card)"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "500" }}>
                <span>Background Spectrogram Opacity</span>
                <span>{spectroOpacity}%</span>
              </div>
              <input
                type="range" min="0" max="100" value={spectroOpacity}
                onChange={(e) => setSpectroOpacity(e.target.value)}
                style={{ accentColor: "var(--primary)", height: "4px" }}
              />
            </div>
          </div>
        )}

        <div
          className="spectrogram-container"
          style={{
            minHeight: "200px",
            position: "relative",
            overflow: "hidden",
            cursor: zoom > 1 ? (isDragging.current ? "grabbing" : "grab") : "default",
            userSelect: "none"
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.8)", zIndex: 10 }}>
              <div className="status-waiting">
                {overlayMode === "fingerprint" ? "Analyzing Fingerprint..." : overlayMode === "mfcc" ? "Projecting MFCC Curves..." : "Rendering Spectrogram..."}
              </div>
            </div>
          )}

          {error && <div style={{ padding: "60px", textAlign: "center", color: "#f87171" }}>{error}</div>}

          {specData && (
            <div style={{
              position: "relative",
              width: "100%",
              transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
              transformOrigin: "center center",
              transition: isDragging.current ? "none" : "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              filter: `brightness(${brightness}%) contrast(${contrast}%)`
            }}>
              <img
                src={`data:image/png;base64,${specData.image_b64}`}
                className="spectrogram-image"
                alt="Spectrogram"
                draggable={false}
                style={{
                  width: "100%",
                  display: "block",
                  borderRadius: "12px",
                  opacity: spectroOpacity / 100,
                  transition: "opacity 0.2s ease"
                }}
              />
              {overlayMode === "mfcc" && specData.mfcc_curve && specData.bbox && (
                <FeatureCurves
                  mfcc={specData.mfcc_curve}
                  centroid={specData.centroid_curve}
                  bbox={specData.bbox}
                />
              )}
              {overlayMode === "fingerprint" && showPeaks && specData.overlay_points && specData.bbox && (
                <div style={{ position: "absolute", inset: 0 }}>
                  {specData.overlay_points.map((p, i) => (
                    <FingerprintPeak key={i} peak={p} bbox={specData.bbox} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", fontSize: "0.85rem", color: "var(--text-muted)", border: "1px solid var(--border-card)" }}>
          {overlayMode === "plain" && <><strong>Plain Mel Spectrogram:</strong> Shows raw energy intensity across time and frequency (Mel scale). Warmer colors indicate higher energy. No overlays applied.</>}
          {overlayMode === "fingerprint" && <><strong>Acoustic Fingerprint:</strong> Yellow dots mark local energy maxima (peaks) in the time-frequency domain. This "constellation" pattern is unique to individual speakers and dialects — similar to Shazam's approach.</>}
          {overlayMode === "mfcc" && <><strong>MFCC Projection:</strong> <span style={{ color: "#34d399" }}>Green</span> = MFCC 0 curve (timbre/vocal energy), <span style={{ color: "#38bdf8" }}>Blue dashed</span> = Spectral Centroid (brightness). These features are the strongest dialect discriminators used by the classifier.</>}
        </div>
      </div>

      {/* 2. Spectral Dynamics Card */}
      <div className="card">
        <h3 style={{ margin: "0 0 20px" }}>Spectral Dynamics</h3>

        <div className="spectrogram-container" style={{ minHeight: "200px", position: "relative" }}>
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.8)", zIndex: 10 }}>
              <div className="status-waiting">Calculating Dynamics...</div>
            </div>
          )}

          {evolveData && (
            <img
              src={`data:image/png;base64,${evolveData.image_b64}`}
              alt="Feature Evolution"
              style={{ width: "100%", display: "block", borderRadius: "12px" }}
            />
          )}
        </div>

        <div style={{ marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", fontSize: "0.85rem", color: "var(--text-muted)", border: "1px solid var(--border-card)" }}>
          <strong>Feature Evolution:</strong> This graph tracks the <strong>MFCC 0</strong> (tonal energy), <strong>Centroid</strong> (spectral brightness), and <strong>RMS</strong> (loudness envelope) over time.
        </div>
      </div>
    </div>
  );
}
