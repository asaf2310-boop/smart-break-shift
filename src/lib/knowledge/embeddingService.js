/** Client embedding API — delegates to /api/knowledge-embed (batch). */

import { getAgentBearerHeaders } from "@/lib/agentAuthClient";

const EMBED_BATCH_SIZE = 48;

export async function embedTextsClient(inputs) {
  const texts = (inputs || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!texts.length) return { embeddings: [], error: null };

  const allEmbeddings = [];
  for (let offset = 0; offset < texts.length; offset += EMBED_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBED_BATCH_SIZE);
    const headers = await getAgentBearerHeaders({ "Content-Type": "application/json" });
    const res = await fetch("/api/knowledge-embed", {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: batch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { embeddings: null, error: data.error || `http_${res.status}`, retryAfterSec: data.retryAfterSec };
    }
    allEmbeddings.push(...(data.embeddings || []));
  }

  return { embeddings: allEmbeddings, error: null };
}

export async function embedQueryClient(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  if (!q) return { embedding: null, error: "empty_query" };
  const { embeddings, error, retryAfterSec } = await embedTextsClient([`שאלה: ${q}`]);
  return { embedding: embeddings?.[0] ?? null, error, retryAfterSec };
}
