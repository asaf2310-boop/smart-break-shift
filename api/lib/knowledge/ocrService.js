/** OpenAI Vision OCR — extract Hebrew text + short caption from images. */

import { fetchOpenAiWithRetry, getRetryAfterSec } from "../../openaiRetry.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const VISION_MODEL = "gpt-4o-mini";

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

export function isOcrConfigured() {
  return Boolean(getApiKey());
}

/**
 * @param {string} imageDataUrl — data:image/jpeg;base64,... or https URL
 * @param {{ fileName?: string, pageNumber?: number }} [meta]
 * @returns {Promise<{ ocrText: string, description: string, error?: string, retryAfterSec?: number }>}
 */
export async function ocrImage(imageDataUrl, meta = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ocrText: "", description: "", error: "openai_not_configured" };
  }

  const imageUrl = String(imageDataUrl || "").trim();
  if (!imageUrl) {
    return { ocrText: "", description: "", error: "empty_image" };
  }

  const contextHint = [
    meta.fileName ? `קובץ: ${meta.fileName}` : null,
    meta.pageNumber != null ? `עמוד ${meta.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const openaiRes = await fetchOpenAiWithRetry(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: `אתה מומחה OCR לעברית. חלץ את כל הטקסט מהתמונה בדיוק, עם רווחים נכונים בין מילים עבריות.
החזר JSON בלבד בפורmat: {"ocr_text":"...","description":"..."}
description — כיתוב קצר (עד 120 תווים) שמתאר את תוכן התמונה/העמוד.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `חלץ טקסט ותיאור קצר מהתמונה.${contextHint ? `\n${contextHint}` : ""}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    const retryAfterSec = openaiRes.status === 429 ? getRetryAfterSec(openaiRes) : null;
    return {
      ocrText: "",
      description: "",
      error: `openai_error:${openaiRes.status}:${errText.slice(0, 80)}`,
      retryAfterSec,
    };
  }

  const data = await openaiRes.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "";

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return {
      ocrText: String(parsed.ocr_text || parsed.ocrText || "").trim(),
      description: String(parsed.description || "").trim(),
      error: null,
    };
  } catch {
    return {
      ocrText: raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
      description: meta.fileName ? `תמונה: ${meta.fileName}` : "תמונה ממסמך",
      error: null,
    };
  }
}
