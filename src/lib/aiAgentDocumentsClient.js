import { getAgentBearerHeaders } from "@/lib/agentAuthClient";

const API = "/api/ai-agent-documents";
const UPLOAD_TIMEOUT_MS = 120_000;

async function postJson(body, timeoutMs = UPLOAD_TIMEOUT_MS) {
  const headers = await getAgentBearerHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || `http_${res.status}`);
      err.httpStatus = res.status;
      err.code = data.error;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAiAgentDocuments() {
  const headers = await getAgentBearerHeaders();
  const res = await fetch(API, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `http_${res.status}`);
    err.httpStatus = res.status;
    err.code = data.error;
    throw err;
  }
  return data.documents || [];
}

export async function ingestAiAgentDocument({ title, content, fileName, mimeType }) {
  return postJson({
    action: "ingest",
    title,
    content,
    fileName,
    mimeType,
  });
}

export async function deleteAiAgentDocument(documentId) {
  return postJson({ action: "delete", documentId });
}
