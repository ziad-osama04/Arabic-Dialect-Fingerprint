const API_BASE_URL = "http://localhost:8000";

const modules = [
  {name: "audio", owner: "Member 1", label: "Audio, spectrogram, features"},
  {name: "classify", owner: "Member 2", label: "Classic ML classifier"},
  {name: "transcribe", owner: "Member 3", label: "Real-time STT"},
  {name: "translate", owner: "Member 4", label: "Dialect conversion and TTS"},
];


function setStatus(element, ok, label) {
  element.textContent = label ?? (ok ? "Ready" : "Waiting");
  element.className = ok ? "status status-ok" : "status status-waiting";
}


async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}


function renderModule(module, status) {
  const ok = status?.status === "ok";
  const todo = status?.todo ?? ["Backend route not reachable yet"];

  return `
    <article class="module-card">
      <div class="module-heading">
        <div>
          <p>${module.owner}</p>
          <h3>${module.label}</h3>
        </div>
        <span class="${ok ? "status status-ok" : "status status-waiting"}">
          ${ok ? "Ready" : "Waiting"}
        </span>
      </div>
      <ul>
        ${todo.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </article>
  `;
}


async function main() {
  const apiStatus = document.getElementById("api-status");
  const moduleGrid = document.getElementById("module-grid");

  try {
    const health = await request("/health");
    setStatus(apiStatus, health.status === "ok");
  } catch (error) {
    setStatus(apiStatus, false, "Backend Offline");
  }

  const statuses = {};
  for (const module of modules) {
    try {
      statuses[module.name] = await request(`/${module.name}/health`);
    } catch (error) {
      statuses[module.name] = {status: "offline"};
    }
  }

  moduleGrid.innerHTML = modules
    .map((module) => renderModule(module, statuses[module.name]))
    .join("");
}


main();

