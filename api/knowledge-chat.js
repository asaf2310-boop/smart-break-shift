/** Vercel serverless — OpenAI for knowledge chat (OPENAI_API_KEY in process.env only) */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_CONTEXT_CHARS = 2200;
const MAX_SNIPPET_CHARS = 380;

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

function truncateSnippet(text, max = MAX_SNIPPET_CHARS) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function buildContextFromChunks(chunks) {
  const blocks = [];
  let totalChars = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const c = chunks[i];
    const title = String(c.documentTitle || c.title || "מסמך").trim();
    const snippet = truncateSnippet(c.text);
    const block = `[${i + 1}] מסמך: ${title}\n${snippet}`;
    if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
    blocks.push(block);
    totalChars += block.length + 2;
  }
  return blocks.join("\n\n");
}

function buildMessages(query, chunks) {
  const howTo = isHowToQuestion(query);
  const context = buildContextFromChunks(chunks);

  const system = `אתה יועץ ידע מקצועי לנציגי שירות ב-HYP. ענה בעברית בלבד, בטון מקצועי וברור (רמת ChatGPT).
כללים מחייבים:
- השתמש אך ורק במידע מקטעי ההקשר — אין ידע חיצוני, אין השערות.
- משפט ראשון: תשובה ישירה לשאלה (כן/לא, מספר, או העובדה המרכזית).
- ניסוח מחדש; אל תעתיק טקסט גולמי, קישורי markdown, או שברי OCR.
- בלי markdown (ללא #, ללא [], ללא \`\`), בלי אנגלית מיותרת — עברית בלבד למעט מונחים טכניים מהמסמך.
- רווח תקין בין מילים עבריות; תקן רווחים שבורים בתוך מילים.
${
    howTo
      ? `- שאלת "איך": ענה ב-3–5 שלבים ממוספרים (שורה לכל שלב: "1. ...", "2. ..."), כל שלב משפט שלם עם נקודה בסוף.`
      : `- 2–4 משפטים שלמים; כל משפט מסתיים בנקודה.`
  }
- אם אין תשובה בקטעים, ענה במדויק: "לא נמצא מידע רלוונטי בבסיס הידע."
- בסוף שורה נפרדת: "מקורות:" ואז [1], [2] רק למסמכים שבאמת נשעדת עליהם.`;

  const user = `קטעי הקשר (היחידים המותרים לשימוש):\n${context || "(ריק)"}\n\nשאלת הנציג: ${query}${
    howTo ? "\n\nסוג שאלה: הדרכה / תהליך — השב בשלבים ממוספרים." : ""
  }`;

  return { howTo, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
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

  const query = String(body.query || "").trim();
  const chunks = Array.isArray(body.chunks) ? body.chunks : [];
  if (!query || !chunks.length) {
    return json(res, 400, { error: "query_and_chunks_required" }, req);
  }

  const { howTo, messages } = buildMessages(query, chunks);

  const openaiRes = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: howTo ? 420 : 320,
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
  const answer = data.choices?.[0]?.message?.content?.trim() || "לא התקבלה תשובה מהמודל.";

  return json(res, 200, { answer, mode: "openai" }, req);
}
