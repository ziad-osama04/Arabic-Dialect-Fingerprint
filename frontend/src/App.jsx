import { useEffect, useState } from "react";

import { getHealth, getModuleHealth } from "./api/client.js";


const modules = [
  {name: "audio", owner: "Member 1", label: "Audio, spectrogram, features"},
  {name: "classify", owner: "Member 2", label: "Classic ML classifier"},
  {name: "transcribe", owner: "Member 3", label: "Real-time STT"},
  {name: "translate", owner: "Member 4", label: "Dialect conversion and TTS"},
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
  const [moduleStatuses, setModuleStatuses] = useState({});

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
          setApiStatus({status: "offline", error: error.message});
        }
      }

      const results = {};
      for (const module of modules) {
        try {
          results[module.name] = await getModuleHealth(module.name);
        } catch (error) {
          results[module.name] = {status: "offline", error: error.message};
        }
      }

      if (isMounted) {
        setModuleStatuses(results);
      }
    }

    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const apiReady = apiStatus?.status === "ok";

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Task 5</p>
          <h1>Arabic Dialect Fingerprint</h1>
          <p className="summary">
            Integration shell for upload, spectrograms, classic ML dialect detection,
            real-time transcription, dialect conversion, TTS, and weighted audio mixing.
          </p>
        </div>
        <StatusPill ok={apiReady} />
      </section>

      <section className="workflow">
        <h2>Member Integration Map</h2>
        <div className="module-grid">
          {modules.map((module) => {
            const status = moduleStatuses[module.name];
            const ok = status?.status === "ok";

            return (
              <article className="module-card" key={module.name}>
                <div className="module-heading">
                  <div>
                    <p>{module.owner}</p>
                    <h3>{module.label}</h3>
                  </div>
                  <StatusPill ok={ok} />
                </div>
                <ul>
                  {(status?.todo ?? ["Backend route not reachable yet"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

