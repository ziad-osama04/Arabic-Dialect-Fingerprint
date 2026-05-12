import { useState, useRef } from "react";
import { uploadAudio } from "../api/client";

export default function AudioUploader({ onUploaded, onLoading }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const recordingFile = new File([audioBlob], `recording_${Date.now()}.wav`, { type: 'audio/wav' });
        setFile(recordingFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

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
      <h3 style={{ marginBottom: '8px' }}>Step 1: Input Arabic Voice</h3>
      <p className="summary" style={{ fontSize: '0.875rem' }}>
        Record your voice or upload a WAV/MP3 file.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
        <button
          className={`btn ${isRecording ? 'btn-danger' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            background: isRecording ? '#ef4444' : 'rgba(255,255,255,0.05)',
            color: 'white',
            border: '1px solid var(--border-card)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '140px'
          }}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>
            {isRecording ? "stop" : "mic"}
          </span>
          {isRecording ? `Stop (${recordingTime}s)` : "Record Voice"}
        </button>

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
          disabled={!file || uploading || isRecording}
          style={{ opacity: (!file || uploading || isRecording) ? 0.4 : 1, marginLeft: 'auto' }}
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
          <span className="material-icons" style={{ fontSize: '18px' }}>error</span>
          <span style={{ fontWeight: '600' }}>{error}</span>
        </div>
      )}
    </div>
  );
}
