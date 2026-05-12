import { useEffect, useState } from "react";
import { classifyAudio } from "../api/client.js";

const DIALECT_COLORS = {
  EGY: "#8b5cf6",
  GLF: "#34d399",
  LEV: "#38bdf8",
  MAG: "#fb923c",
};

const cardStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  padding: "28px",
  color: "#f8fafc",
};

const placeholderStyle = {
  ...cardStyle,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "320px",
  textAlign: "center",
};

export default function ClassifierResult({ fileId, onDialectDetected }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileId) {
      setData(null);
      setError(null);
      if (onDialectDetected) onDialectDetected(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    classifyAudio(fileId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          if (onDialectDetected) onDialectDetected(result.dialect);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          if (onDialectDetected) onDialectDetected(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!fileId) {
    return (
      <div style={placeholderStyle}>
        <div style={{ fontSize: "3rem", marginBottom: "16px", opacity: 0.5 }}>
          ⚖️
        </div>
        <h3 style={{ color: "#94a3b8", margin: "0 0 8px" }}>
          Dialect Classifier
        </h3>
        <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>
          Upload an audio file in the Audio Pipeline tab, then return here.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...placeholderStyle, minHeight: "200px" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>
          <span style={{ display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }}>⚖️</span>
        </div>
        <p style={{ color: "#94a3b8", margin: 0 }}>Analyzing dialect<span className="loading-dots">...</span></p>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
          .loading-dots { animation: dots 1.4s steps(4,end) infinite; display: inline-block; width: 1.5em; text-align: left; }
          @keyframes dots { 0%{content:""} 25%{content:"."} 50%{content:".."} 75%{content:"..."} }
        `}</style>
      </div>
    );
  }

  if (error) {
    const isModelError = error.includes("not trained") || error.includes("503");
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>
            {isModelError ? "🔧" : "❌"}
          </div>
          <p style={{ color: "#f87171", fontSize: "0.95rem", margin: 0, lineHeight: 1.6 }}>
            {isModelError
              ? "Model not trained yet. Run python scripts/train_classifier.py to train the classifier."
              : error}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const dialectColor = DIALECT_COLORS[data.dialect] || "#94a3b8";
  const maxProba = Math.max(...Object.values(data.probabilities));

  return (
    <div style={cardStyle}>
      {/* Predicted Dialect Badge */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "12px 32px",
            borderRadius: "12px",
            background: dialectColor + "22",
            border: `2px solid ${dialectColor}`,
          }}
        >
          <span
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: dialectColor,
              letterSpacing: "2px",
            }}
          >
            {data.dialect}
          </span>
          <div style={{ fontSize: "0.95rem", color: "#f8fafc", marginTop: "4px" }}>
            {data.dialect_name}
          </div>
        </div>

        <div style={{ marginTop: "12px", color: "#94a3b8", fontSize: "1.1rem" }}>
          Confidence:{" "}
          <span style={{ color: "#f8fafc", fontWeight: 600 }}>
            {(data.confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Probability Bars */}
      <div style={{ marginBottom: "28px" }}>
        <h4 style={{ color: "#94a3b8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
          Class Probabilities
        </h4>
        {Object.entries(data.probabilities)
          .sort(([, a], [, b]) => b - a)
          .map(([dialect, prob]) => {
            const isPredicted = dialect === data.dialect;
            const color = DIALECT_COLORS[dialect] || "#94a3b8";
            return (
              <div
                key={dialect}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "8px",
                  opacity: isPredicted ? 1 : 0.5,
                }}
              >
                <span style={{ width: "48px", fontSize: "0.85rem", fontWeight: 600, color }}>
                  {dialect}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "20px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "4px",
                    overflow: "hidden",
                    margin: "0 12px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(prob / maxProba) * 100}%`,
                      background: isPredicted
                        ? `linear-gradient(90deg, ${color}, ${color}cc)`
                        : color,
                      borderRadius: "4px",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <span style={{ width: "52px", textAlign: "right", fontSize: "0.85rem", color: "#94a3b8" }}>
                  {(prob * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
      </div>

      {/* Top Features */}
      <div>
        <h4 style={{ color: "#94a3b8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
          Top Distinguishing Features
        </h4>
        <p style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "14px", lineHeight: 1.5 }}>
          SHAP values show how much each feature pushed the classifier toward or away from the predicted dialect.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {data.top_features.map((feat) => {
            const isPositive = feat.shap_value >= 0;
            const maxShap = Math.max(
              ...data.top_features.map((f) => Math.abs(f.shap_value)),
              0.001
            );
            const barWidth = Math.min((Math.abs(feat.shap_value) / maxShap) * 100, 100);
            const displayName = feat.name.replace(/_/g, " ");

            return (
              <div
                key={feat.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 100px",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                  {displayName}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textAlign: "right" }}>
                  {feat.value.toFixed(2)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div
                    style={{
                      height: "8px",
                      width: `${barWidth}%`,
                      minWidth: "2px",
                      background: isPositive ? "#34d399" : "#f87171",
                      borderRadius: "4px",
                      transition: "width 0.4s ease",
                    }}
                  />
                  <span style={{ fontSize: "0.65rem", color: "#64748b" }}>
                    {feat.shap_value > 0 ? "+" : ""}{feat.shap_value.toFixed(3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model footer */}
      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <span style={{ fontSize: "0.75rem", color: "#475569" }}>
          Model: {data.model_used}
        </span>
      </div>
    </div>
  );
}
