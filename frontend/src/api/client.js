export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";


async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    let errorMessage = `Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      const text = await response.text();
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response;
}


export function getHealth() {
  return request("/health");
}


export function getModuleHealth(moduleName) {
  return request(`/${moduleName}/health`);
}


export function uploadAudio(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/audio/upload", {
    method: "POST",
    body: formData,
  });
}


export function getSpectrogram(fileId, showPeaks = true, overlayMode = "fingerprint") {
  return request(`/audio/spectrogram?file_id=${encodeURIComponent(fileId)}&show_peaks=${showPeaks}&overlay_mode=${overlayMode}`);
}


export function classifyAudio(fileId) {
  return request(`/classify/predict?file_id=${encodeURIComponent(fileId)}`);
}


export function getClassifierExplanation(fileId) {
  return request(`/classify/explain?file_id=${encodeURIComponent(fileId)}`);
}


export function getTranscriptionWords(fileId) {
  return request(`/transcribe/words?file_id=${encodeURIComponent(fileId)}`);
}


export function translateText(payload) {
  return request("/translate/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}


export async function synthesizeSpeech(payload) {
  const response = await request("/translate/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}


export function mixAudio(payload) {
  return request("/audio/mix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getFeatureEvolution(fileId) {
  return request(`/audio/feature-evolution?file_id=${encodeURIComponent(fileId)}`);
}


export function getDemoSamples() {
  return request("/audio/demo-samples");
}


export function loadDemoSample(path) {
  return request("/audio/load-demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}
export function downloadDemos() {
  return request("/audio/download-demos", {
    method: "POST",
  });
}

export function getAudioPitch(fileId) {
  return request(`/audio/pitch/${encodeURIComponent(fileId)}`);
}