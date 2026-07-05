/**
 * Verify Gemini 429 / RESOURCE_EXHAUSTED classification (RPM vs daily).
 * Run: node scripts/test-gemini-error-classification.mjs
 */

import {
  classifyGeminiResourceExhausted,
  mapGeminiHttpError,
  parseGeminiErrorBody,
  parseGeminiErrorDetails,
} from "../server/ai/geminiErrors.js";

const SAMPLES = [
  {
    name: "RPM 429 generic quota message (no details)",
    status: 429,
    body: JSON.stringify({
      error: {
        code: 429,
        message:
          "You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.",
        status: "RESOURCE_EXHAUSTED",
      },
    }),
    expect: "rate",
  },
  {
    name: "RPM 429 with QuotaFailure PerMinute",
    status: 429,
    body: JSON.stringify({
      error: {
        code: 429,
        message: "Resource has been exhausted (e.g. check quota).",
        status: "RESOURCE_EXHAUSTED",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [
              {
                quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
              },
            ],
          },
          {
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            retryDelay: "32s",
          },
        ],
      },
    }),
    expect: "rate",
  },
  {
    name: "Daily quota with QuotaFailure PerDay",
    status: 429,
    body: JSON.stringify({
      error: {
        code: 429,
        message: "Resource has been exhausted (e.g. check quota).",
        status: "RESOURCE_EXHAUSTED",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.QuotaFailure",
            violations: [
              {
                quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
                quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
              },
            ],
          },
        ],
      },
    }),
    expect: "daily",
  },
  {
    name: "503 high demand (not quota)",
    status: 503,
    body: JSON.stringify({
      error: {
        code: 503,
        message: "The model is overloaded. Please try again later.",
        status: "UNAVAILABLE",
      },
    }),
    expect: null,
  },
];

let passed = 0;
let failed = 0;

for (const sample of SAMPLES) {
  const apiError = parseGeminiErrorBody(sample.body);
  const details = parseGeminiErrorDetails(apiError);
  const got = classifyGeminiResourceExhausted(
    sample.status,
    String(apiError?.message || "").toLowerCase(),
    String(apiError?.status || "").toUpperCase(),
    details,
  );
  const mapped = mapGeminiHttpError(sample.status, sample.body);
  const ok = got === sample.expect;
  if (ok) {
    passed += 1;
    console.log(`✓ ${sample.name} → ${got} (${mapped.error})`);
  } else {
    failed += 1;
    console.error(`✗ ${sample.name}: expected ${sample.expect}, got ${got} (${mapped.error})`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
