import React from 'react';
import DialectTranslator from './DialectTranslator';
import MixerPanel from './MixerPanel';

const ConversionPanel = ({ words, currentTime, detectedDialect }) => {
  return (
    <section className="conversion-section" style={{ marginBottom: '60px' }}>
      <div className="section-header" style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', margin: 0 }}>4. Conversion & Synthesis</h2>
        <p style={{ color: 'var(--text-muted)', margin: '8px 0 0' }}>Translate between dialects, generate speech, and experiment with audio mixing.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px' }}>
        <DialectTranslator 
          words={words} 
          currentTime={currentTime} 
          detectedDialect={detectedDialect}
        />
        <MixerPanel />
      </div>
    </section>
  );
};

export default ConversionPanel;
