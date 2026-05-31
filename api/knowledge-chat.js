/** Vercel serverless — OpenAI for knowledge chat (OPENAI_API_KEY in process.env only).
 *  Expects pre-built RAG context from the client (retrieved chunk snippets only).
 *  Does NOT accept full documents or raw document bodies.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const KNOWLEDGE_SYSTEM_PROMPT = `You are an AI knowledge-base assistant for a call center management system.
Answer in Hebrew only.
Use only the provided document context.
If the answer does not exist in the provided context, say:
'לא מצאתי תשובה ברורה במסמכים הקיימים.'
Do not invent information.
Do not answer from general knowledge.
Write clearly, with proper Hebrew spacing, punctuation and line breaks.
When relevant, mention which document or section the answer is based on.`;

const KNOWLEDGE_ANSWER_FORMAT_HINT = `Structure every answer as:
תשובה קצרה וברורה
(optional) פירוט לפי סעיפים אם צריך
מקור: שם המסמך / עמוד / כותרת`;

const KNOWLEDGE_NO_CONTEXT_ANSWER = "לא מצאתי תשובה ברורה במסמכים הקיימים.";

function getSiteOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || Array.isArray(host)) return null;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto =
    (typeof protoHeader === "string" ? protoHeader.split(",")[0] : null) ||
    (String(host).includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function isSameOrigin(req) {
  const siteOrigin = getSiteOrigin(req);
  if (!siteOrigin) return false;
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin === siteOrigin) return true;
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.startsWith(siteOrigin)) return true;
  return false;
}

function corsHeaders(req) {
  const siteOrigin = getSiteOrigin(req);
  const origin = req.headers.origin;
  if (siteOrigin && typeof origin === "string" && origin === siteOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }
  return { Vary: "Origin" };
}

function json(res, status, body, req) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function isHowToQuestion(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  return /^(איך|כיצד|מהן?\s+השלבים|מה\s+התהליך|תהליך|הסבר\s+איך)/u.test(q);
}

/** Reject payloads that try to send full documents instead of pre-retrieved context. */
function rejectsFullDocumentPayload(body) {
  if (Array.isArray(body.documents) && body.documents.length) return true;
  if (typeof body.content === "string" && body.content.length > 500) return true;
  const legacyChunks = Array.isArray(body.chunks) ? body.chunks : [];
  if (legacyChunks.some((c) => typeof c?.content === "string" && c.content.length > 600)) {
    return true;
  }
  return false;
}

function buildMessages(query, context) {
  const howTo = isHowToQuestion(query);
  const trimmedContext = String(context || "").trim();

  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${trimmedContext || "(ריק)"}\n\nשאלת הנציג: ${query}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}${
    howTo ? "\n\nסוג שאלה: הדרכה / תהליך — השתמש בפירוט לפי סעיפים." : ""
  }`;

  return {
    howTo,
    messages: [
      {
        role: "system",
        content: `${KNOWLEDGE_SYSTEM_PROMPT}\n\n${KNOWLEDGE_ANSWER_FORMAT_HINT}`,
      },
      { role: "user", content: user },
    ],
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    if (!isSameOrigin(req)) {
      return json(res, 403, { error: "forbidden" }, req);
    }
    res.statusCode = 204;
    Object.entries(corsHeaders(req)).forEach(([k, v]) => res.setHeader(k, v));
    res.end();
    return;
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();

  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.searchParams.get("health") === "1") {
      return json(
        res,
        200,
        { ok: Boolean(apiKey), model: apiKey ? model : null },
        req,
      );
    }
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "method_not_allowed" }, req);
  }

  if (!isSameOrigin(req)) {
    return json(res, 403, { error: "forbidden", message: "CORS: same origin only" }, req);
  }

  if (!apiKey) {
    return json(
      res,
      503,
      {
        code: "openai_not_configured",
        error: "openai_not_configured",
        message: "הגדר OPENAI_API_KEY ב-Vercel (Environment Variables) ופרוס מחדש.",
      },
      req,
    );
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: "invalid_json" }, req);
  }

  if (rejectsFullDocumentPayload(body)) {
    return json(res, 400, { error: "full_documents_not_allowed" }, req);
  }

  const query = String(body.query || "").trim();
  const context = String(body.context || "").trim();

  if (!query || !context) {
    return json(res, 400, { error: "query_and_context_required" }, req);
  }

  const { howTo, messages } = buildMessages(query, context);

  const openaiRes = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: howTo ? 480 : 380,
      messages,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    return json(
      res,
      openaiRes.status,
      {
        error: `openai_error:${openaiRes.status}`,
        detail: errText.slice(0, 200),
      },
      req,
    );
  }

  const data = await openaiRes.json();
  const answer =
    data.choices?.[0]?.message?.content?.trim() || KNOWLEDGE_NO_CONTEXT_ANSWER;

  return json(res, 200, { answer, mode: "openai" }, req);
}
