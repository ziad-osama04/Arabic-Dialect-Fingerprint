import React, { useState, useEffect } from 'react';
import { translateText, synthesizeSpeech, getModuleHealth, getAudioPitch } from '../api/client.js';

const DIALECTS = [
  { code: 'EGY', name: 'Egyptian' },
  { code: 'GLF', name: 'Gulf' },
  { code: 'LEV', name: 'Levantine' },
  { code: 'MAG', name: 'Maghrebi' },
  { code: 'MSA', name: 'Standard' },
];

const DialectTranslator = ({ words = [], currentTime = 0, detectedDialect }) => {
  const [text, setText] = useState('');
  const [srcDialect, setSrcDialect] = useState('EGY');
  const [tgtDialect, setTgtDialect] = useState('MSA');
  const [translatedText, setTranslatedText] = useState('');

  const [loading, setLoading] = useState(false);
  const [synthLoading, setSynthLoading] = useState(false);
  const [gender, setGender] = useState('F');
  const [provider, setProvider] = useState('eidos');
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState({ llm: false });

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    if (detectedDialect) {
      setSrcDialect(detectedDialect);
      // If target matches source, switch target to MSA (or LEV if source is already MSA)
      if (tgtDialect === detectedDialect) {
        setTgtDialect(detectedDialect === 'MSA' ? 'LEV' : 'MSA');
      }
    }
  }, [detectedDialect]);

  const checkHealth = async () => {
    try {
      const data = await getModuleHealth('translate');
      setHealth({
        llm: data.llm_available
      });
    } catch (err) {
      console.warn("Health check failed:", err);
    }
  };

  const handleImportTranscript = () => {
    if (words && words.length > 0) {
      // Only take words that have already started relative to currentTime
      const filteredWords = words.filter(w => w.start <= currentTime);

      if (filteredWords.length === 0) {
        setError("Playback hasn't reached any words yet. Play the audio to see results.");
        return;
      }

      const fullText = filteredWords.map(w => w.word).join(' ');
      setText(fullText);
      setTranslatedText('');
    } else {
      setError("No transcript available to import. Please wait for transcription to finish.");
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const res = await translateText({
        text,
        src_dialect: srcDialect,
        tgt_dialect: tgtDialect
      });
      setTranslatedText(res.translated_text);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSynthesize = async () => {
    const toSpeak = translatedText || text;
    if (!toSpeak.trim()) return;
    setSynthLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      // Find fileId for automatic tone/pitch matching
      let reference_file_id = null;
      const audioEl = document.querySelector('audio');
      if (audioEl && audioEl.src) {
        const match = audioEl.src.match(/file\/([^?]+)/);
        if (match) reference_file_id = match[1];
      }

      const url = await synthesizeSpeech({ 
        text: toSpeak, 
        dialect: tgtDialect, 
        gender, 
        provider, 
        pitch: "+0Hz", // Let the backend handle automatic pitch shifting
        reference_file_id
      });
      setAudioUrl(url);
    } catch (err) {
      setError(`TTS Error: ${err.message}`);
    } finally {
      setSynthLoading(false);
    }
  };

  return (
    <div className="card translator-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ fontSize: '1.6rem' }}>🌍</div>
        <div>
          <h3 style={{ margin: 0, color: 'var(--accent)' }}>Dialect Translator</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI-powered conversion with auto tone-matching</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className={`status-pill ${health.llm ? 'ok' : 'err'}`}>
            OpenRouter: {health.llm ? 'CONNECTED' : 'OFFLINE'}
          </div>
        </div>

        <button
          className="btn btn-xs"
          onClick={handleImportTranscript}
          disabled={!words || words.length === 0}
          style={{
            background: 'rgba(56, 189, 248, 0.1)',
            color: 'var(--accent)',
            borderColor: 'rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span className="material-icons" style={{ fontSize: '14px' }}>content_paste</span>
          Import Transcript
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Input area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Direction: Source Dialect to Target
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={srcDialect}
              onChange={e => setSrcDialect(e.target.value)}
              className="input-select"
              style={{ flex: 1, opacity: detectedDialect ? 0.7 : 1 }}
              disabled={!!detectedDialect}
            >
              {DIALECTS.map(d => (
                <option key={d.code} value={d.code}>
                  {d.name} {detectedDialect === d.code ? '(Detected)' : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)', fontSize: '1.2rem' }}>
              <span className="material-icons">arrow_forward</span>
            </div>
            <select
              value={tgtDialect}
              onChange={e => setTgtDialect(e.target.value)}
              className="input-select"
              style={{ flex: 1 }}
            >
              {DIALECTS.filter(d => d.code !== srcDialect).map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <textarea
          placeholder="Enter Arabic text..."
          value={text}
          onChange={e => setText(e.target.value)}
          dir="rtl"
          style={{
            width: '100%',
            height: '100px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-card)',
            borderRadius: '12px',
            padding: '12px',
            color: '#fff',
            fontFamily: 'inherit',
            resize: 'none',
            fontSize: '1.1rem'
          }}
        />

        {/* Voice Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Gender Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voice:</span>
              {[{ val: 'F', label: '♀ Female' }, { val: 'M', label: '♂ Male' }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setGender(val)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: gender === val ? '1px solid #34d399' : '1px solid transparent',
                    background: gender === val ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: gender === val ? '#34d399' : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Provider Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engine:</span>
              {[{ val: 'edge', label: 'Edge TTS' }, { val: 'eidos', label: 'eidosSpeech' }].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setProvider(val)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: provider === val ? '1px solid #8b5cf6' : '1px solid transparent',
                    background: provider === val ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: provider === val ? '#8b5cf6' : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.7rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '14px' }}>auto_fix_high</span>
            Automatic tone & pitch matching enabled
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleTranslate}
            disabled={loading || !text.trim()}
          >
            {loading ? <span className="spinner-sm" /> : '✨ Translate'}
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              background: 'rgba(52, 211, 153, 0.1)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onClick={handleSynthesize}
            disabled={synthLoading || (!text.trim() && !translatedText)}
          >
            {synthLoading
              ? <span className="spinner-sm" />
              : <><span className="material-icons" style={{ fontSize: '16px' }}>volume_up</span> Speak</>}
          </button>
        </div>

        {translatedText && (
          <div style={{
            marginTop: '10px',
            padding: '16px',
            background: 'rgba(139, 92, 246, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
              Translated ({tgtDialect})
            </div>
            <div dir="rtl" style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
              {translatedText}
            </div>
          </div>
        )}

        {audioUrl && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(52, 211, 153, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
              🔊 Speech Output
            </div>
            <audio
              src={audioUrl}
              controls
              autoPlay
              style={{ width: '100%', height: '36px', borderRadius: '8px' }}
            />
          </div>
        )}

        {error && (
          <div style={{
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.05)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            fontSize: '0.85rem'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default DialectTranslator;
