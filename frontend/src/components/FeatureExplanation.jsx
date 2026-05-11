import { useEffect, useState } from "react";
import { getClassifierExplanation } from "../api/client.js";

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

export default function FeatureExplanation({ fileId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  useEffect(() => {
    if (!fileId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setShowAllFeatures(false);

    getClassifierExplanation(fileId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!fileId) return null;

  if (loading) {
    return (
      <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "12px" }}>
          <span style={{ display: "inline-block", animation: "pulse-expl 1.5s ease-in-out infinite" }}>📊</span>
        </div>
        <p style={{ color: "#94a3b8", margin: 0 }}>Generating feature explanation...</p>
        <style>{`@keyframes pulse-expl { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
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

  // Sort feature values by |value| descending for the table
  const sortedFeatures = Object.entries(data.feature_values)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

  return (
    <div style={cardStyle}>
      {/* Section Header */}
      <h3 style={{ color: "#f8fafc", fontSize: "1.1rem", marginBottom: "20px", fontWeight: 600 }}>
        Feature Comparison vs. Dialect Averages
      </h3>

      {/* Chart Image */}
      {data.plot_b64 && (
        <div style={{ marginBottom: "24px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
          <img
            src={"data:image/png;base64," + data.plot_b64}
            alt="Top 10 distinguishing features comparison chart"
            style={{ width: "100%", display: "block" }}
          />
        </div>
      )}

      {/* Nearest Dialects */}
      <div style={{ marginBottom: "24px" }}>
        <h4 style={{ color: "#94a3b8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
          Dialect Similarity
        </h4>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {data.nearest_dialects.map((nd, idx) => {
            const color = DIALECT_COLORS[nd.dialect] || "#94a3b8";
            return (
              <div
                key={nd.dialect}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: color + (idx === 0 ? "22" : "11"),
                  border: `1px solid ${color}${idx === 0 ? "88" : "33"}`,
                  opacity: idx === 0 ? 1 : 0.7,
                }}
              >
                <span style={{ fontWeight: 700, color, fontSize: "0.9rem" }}>
                  {nd.dialect}
                </span>
                <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                  {nd.dialect_name}
                </span>
                <span style={{ color: "#f8fafc", fontWeight: 600, fontSize: "0.85rem" }}>
                  {(nd.probability * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Values Toggle */}
      <div>
        <button
          onClick={() => setShowAllFeatures((v) => !v)}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#94a3b8",
            padding: "10px 20px",
            cursor: "pointer",
            fontSize: "0.85rem",
            width: "100%",
            textAlign: "center",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => { e.target.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={(e) => { e.target.style.background = "rgba(255,255,255,0.06)"; }}
        >
          {showAllFeatures ? "▲ Hide all feature values" : "▼ Show all feature values"}
        </button>

        {showAllFeatures && (
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              marginTop: "12px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, position: "sticky", top: 0, background: "#0f172a" }}>
                    Feature Name
                  </th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "#94a3b8", fontWeight: 600, position: "sticky", top: 0, background: "#0f172a" }}>
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFeatures.map(([name, value]) => (
                  <tr
                    key={name}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <td style={{ padding: "6px 12px", color: "#cbd5e1" }}>
                      {name.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "6px 12px", color: "#64748b", textAlign: "right", fontFamily: "monospace" }}>
                      {Number(value).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
