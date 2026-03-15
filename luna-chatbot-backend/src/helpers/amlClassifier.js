// helpers/amlClassifier.js
import fetch from "node-fetch";
import env from "../config/env.js";
import { CLASSIFIER_SYSTEM_PROMPT } from "../prompts/classifierPrompt.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";
const THRESHOLD = 0.75;

function extractJsonString(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = codeBlock ? codeBlock[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "{") depth++;
    if (candidate[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  return candidate.slice(start, end + 1);
}

function clampScore(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n >= 10) return 9.99;
  return Math.round(n * 100) / 100;
}

function normalizeDecision(score) {
  if (score < THRESHOLD) return "not_suspicious";
  if (score >= 3) return "highly_suspicious";
  return "likely_suspicious";
}

/**
 * Classify an AML sample against P1–P6 patterns. Returns scores 0.0–9.99 (never 10), threshold 0.75.
 * @param {object} sample - ML schema payload (entities, transactions, invoices, features, etc.)
 * @returns {Promise<{ best_pattern, best_risk_score, best_threshold, best_above_threshold, best_decision, all_results }>}
 */
export async function classifyAmlSample(sample) {
  if (!sample || typeof sample !== "object") {
    throw new Error("Sample payload is required");
  }

  if (!env.GROQ_KEY) {
    throw new Error("GROQ_KEY is not set; cannot run classifier");
  }

  const userMessage = `Classify this AML/fraud sample. Output only valid JSON with best_pattern, best_risk_score (0–9.99, never 10), best_threshold: 0.75, best_above_threshold, best_decision, and all_results (all 6 patterns with pattern, risk_score, threshold, above_threshold, decision, top_features).\n\nSample:\n${JSON.stringify(sample, null, 0).slice(0, 12000)}`;

  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  };

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${text || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty classifier response from Groq");
  }

  const jsonStr = extractJsonString(content) || content.trim();
  let out;
  try {
    out = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Invalid JSON from classifier: ${e.message}. Raw: ${jsonStr.slice(0, 400)}`);
  }

  const best_risk_score = clampScore(out.best_risk_score ?? 0);
  const best_threshold = THRESHOLD;
  const best_above_threshold = best_risk_score >= best_threshold;
  const best_decision = out.best_decision || normalizeDecision(best_risk_score);

  const rawResults = Array.isArray(out.all_results) ? out.all_results : [];
  const all_results = rawResults.slice(0, 6).map((r, i) => {
    const score = clampScore(r.risk_score ?? 0);
    return {
      pattern: typeof r.pattern === "string" ? r.pattern : `P${i + 1}`,
      risk_score: score,
      threshold: THRESHOLD,
      above_threshold: score >= THRESHOLD,
      decision: r.decision || normalizeDecision(score),
      top_features: Array.isArray(r.top_features) ? r.top_features.slice(0, 5) : [],
    };
  });

  return {
    best_pattern: typeof out.best_pattern === "string" ? out.best_pattern : (all_results[0]?.pattern ?? "Unknown"),
    best_risk_score,
    best_threshold,
    best_above_threshold,
    best_decision,
    all_results,
  };
}

export default classifyAmlSample;
