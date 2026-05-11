import { useState, useRef } from "react";
import { uploadAudio } from "../api/client";

export default function AudioUploader({ onUploaded, onLoading }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    onLoading?.(true);
    setError(null);

    try {
      const data = await uploadAudio(file);
      onUploaded(data);
    } catch (err) {
      setError(err.message || "Failed to upload audio");
    } finally {
      setUploading(false);
      onLoading?.(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ marginBottom: '8px' }}>Step 1: Upload Arabic Voice File</h3>
      <p className="summary" style={{ fontSize: '0.875rem' }}>
        Select a WAV or MP3 file (around 30 seconds).
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="file-input-wrapper" style={{ position: 'relative' }}>
          <button
            className="btn"
            onClick={triggerFileSelect}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              border: '1px solid var(--border-card)',
              transition: 'all 0.2s'
            }}
          >
            {file ? "Change File" : "Choose File"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {file && (
          <span style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
            {file.name}
          </span>
        )}

        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{ opacity: (!file || uploading) ? 0.4 : 1, marginLeft: 'auto' }}
        >
          {uploading ? "Processing..." : "Process Fingerprint"}
        </button>
      </div>

      {error && (
        <div style={{
          color: '#ef4444',
          fontSize: '0.85rem',
          background: 'rgba(239, 68, 68, 0.05)',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginTop: '8px',
          animation: 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span style={{ fontWeight: '600' }}>{error}</span>
        </div>
      )}
    </div>
  );
}
