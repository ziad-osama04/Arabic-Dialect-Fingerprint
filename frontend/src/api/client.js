const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";


async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
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


export function getSpectrogram(fileId) {
  return request(`/audio/spectrogram?file_id=${encodeURIComponent(fileId)}`);
}


export function classifyAudio(fileId) {
  return request(`/classify/predict?file_id=${encodeURIComponent(fileId)}`);
}


export function getTranscriptionWords(fileId) {
  return request(`/transcribe/words?file_id=${encodeURIComponent(fileId)}`);
}


export function translateText(payload) {
  return request("/translate/text", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
}


export async function synthesizeSpeech(payload) {
  const response = await request("/translate/synthesize", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}


export function mixAudio(payload) {
  return request("/audio/mix", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
}

