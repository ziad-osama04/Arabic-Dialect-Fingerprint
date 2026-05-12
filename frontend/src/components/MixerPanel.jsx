import React, { useState, useRef } from 'react';
import { mixAudio, classifyAudio, uploadAudio } from '../api/client.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const DIALECT_COLORS = {
  EGY: '#8b5cf6',
  GLF: '#34d399',
  LEV: '#38bdf8',
  MAG: '#fb923c',
};

const PRESETS = [
  { label: '0%', value: 0 },
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
];

const MixerPanel = () => {
  const [fileA, setFileA] = useState(null);
  const [fileAName, setFileAName] = useState('');
  const [uploadingA, setUploadingA] = useState(false);

  const [fileB, setFileB] = useState(null);
  const [fileBName, setFileBName] = useState('');
  const [uploadingB, setUploadingB] = useState(false);

  const [weight, setWeight] = useState(0.5);
  const [mixing, setMixing] = useState(false);
  const [mixedFileId, setMixedFileId] = useState(null);
  const [mixDuration, setMixDuration] = useState(null);

  const [classifying, setClassifying] = useState(false);
  const [classResult, setClassResult] = useState(null);
  const [error, setError] = useState(null);

  const fileInputA = useRef(null);
  const fileInputB = useRef(null);

  const handleUpload = async (file, slot) => {
    if (!file) return;
    const isA = slot === 'A';
    isA ? setUploadingA(true) : setUploadingB(true);
    setError(null);
    try {
      const data = await uploadAudio(file);
      if (isA) {
        setFileA(data.file_id);
        setFileAName(file.name);
      } else {
        setFileB(data.file_id);
        setFileBName(file.name);
      }
      setMixedFileId(null);
      setClassResult(null);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      isA ? setUploadingA(false) : setUploadingB(false);
    }
  };

  const handleMix = async () => {
    if (!fileA || !fileB) return;
    setMixing(true);
    setError(null);
    try {
      const result = await mixAudio({
        file_id_a: fileA,
        file_id_b: fileB,
        weight: weight,
      });
      setMixedFileId(result.file_id);
      setMixDuration(result.duration);
    } catch (err) {
      setError(`Mix failed: ${err.message}`);
    } finally {
      setMixing(false);
    }
  };

  const handleClassify = async () => {
    if (!mixedFileId) return;
    setClassifying(true);
    setError(null);
    try {
      const result = await classifyAudio(mixedFileId);
      setClassResult(result);
    } catch (err) {
      setError(`Classification failed: ${err.message}`);
    } finally {
      setClassifying(false);
    }
  };

  const pctA = Math.round((1 - weight) * 100);
  const pctB = Math.round(weight * 100);

  return (
    <div className="card mixer-panel" style={{ height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ fontSize: '1.6rem' }}>🎛️</div>
        <div>
          <h3 style={{ margin: 0, color: 'var(--accent)' }}>Audio Mixer</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Blend dialects and test classification</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="mixer-file-slot">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '8px', textTransform: 'uppercase' }}>File A</div>
          <input ref={fileInputA} type="file" accept=".wav,.mp3,.m4a" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0], 'A')} />
          <button className="btn btn-sm" onClick={() => fileInputA.current?.click()} disabled={uploadingA} style={{ width: '100%' }}>
            {uploadingA ? '...' : fileA ? '✅ Re-upload' : '📁 Upload A'}
          </button>
          {fileAName && <div className="file-name-tag">{fileAName}</div>}
        </div>

        <div className="mixer-file-slot">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#34d399', marginBottom: '8px', textTransform: 'uppercase' }}>File B</div>
          <input ref={fileInputB} type="file" accept=".wav,.mp3,.m4a" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0], 'B')} />
          <button className="btn btn-sm" onClick={() => fileInputB.current?.click()} disabled={uploadingB} style={{ width: '100%' }}>
            {uploadingB ? '...' : fileB ? '✅ Re-upload' : '📁 Upload B'}
          </button>
          {fileBName && <div className="file-name-tag">{fileBName}</div>}
        </div>
      </div>

      <div className="mixer-slider-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem' }}>
          <span style={{ color: '#8b5cf6' }}>A: {pctA}%</span>
          <span style={{ color: '#34d399' }}>B: {pctB}%</span>
        </div>
        <input 
          type="range" min="0" max="100" value={weight * 100} 
          onChange={e => { setWeight(e.target.value / 100); setMixedFileId(null); setClassResult(null); }}
          className="mixer-range"
        />
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
          {PRESETS.map(p => (
            <button key={p.value} className={`btn btn-xs ${Math.abs(weight - p.value) < 0.01 ? 'active' : ''}`} onClick={() => { setWeight(p.value); setMixedFileId(null); }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={!fileA || !fileB || mixing} onClick={handleMix}>
        {mixing ? <span className="spinner-sm" /> : `🎛️ Mix Audio`}
      </button>

      {mixedFileId && (
        <div style={{ marginTop: '20px', animation: 'slideUp 0.4s ease' }}>
          <audio controls src={`${API_BASE}/audio/file/${mixedFileId}`} style={{ width: '100%', borderRadius: '12px' }} />
          <button className="btn btn-synth" style={{ width: '100%', marginTop: '10px' }} disabled={classifying} onClick={handleClassify}>
            {classifying ? <span className="spinner-sm" /> : '🧪 Classify Mixed'}
          </button>

          {classResult && (
            <div className="mixer-class-result" style={{ marginTop: '16px' }}>
              {/* Winner Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    background: DIALECT_COLORS[classResult.dialect] || '#64748b',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}>
                    {classResult.dialect}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Best Match</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: DIALECT_COLORS[classResult.dialect] || '#fff' }}>
                  {(classResult.confidence * 100).toFixed(1)}%
                </span>
              </div>

              {/* Class Probabilities Bars */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Class Probabilities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {classResult.probabilities && Object.entries(classResult.probabilities)
                  .sort(([, a], [, b]) => b - a)
                  .map(([dialect, prob]) => (
                    <div key={dialect}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: DIALECT_COLORS[dialect] || '#94a3b8' }}>{dialect}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{(prob * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${prob * 100}%`,
                            background: DIALECT_COLORS[dialect] || '#64748b',
                            borderRadius: '6px',
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: dialect === classResult.dialect ? `0 0 8px ${DIALECT_COLORS[dialect]}66` : 'none',
                          }}
                        />
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="error-tag">⚠️ {error}</div>}
    </div>
  );
};

export default MixerPanel;
