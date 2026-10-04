// metricExplain.js – Generate human‑readable explanations for drill‑down metrics

/**
 * Generate an explanation string for a given metric based on provided data.
 * Currently supports "topic", "type", and "improvement".
 * The data argument should contain whatever is needed for the metric – for the
 * demo implementation we pass a simple object with `summary` and optional
 * `details` fields.
 */
window.explainMetric = function(metric, data) {
  if (!metric) return "";
  switch (metric) {
    case "topic":
      return `Top topics by attempts: ${data.summary}.`; // e.g. "Math (12), Science (8)"
    case "type":
      return `Question-type breakdown: ${data.summary}.`;
    case "improvement":
      return `Overall improvement: ${data.summary}.`;
    default:
      return "No explanation available.";
  }
}
