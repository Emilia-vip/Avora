import { PublicError } from "./http.ts";

export const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

/** Model list with an optional env override first and duplicates removed. */
export function modelList(override: string | undefined, fallbacks: string[]) {
  return [override, ...fallbacks].filter(
    (model, index, list): model is string => Boolean(model) && list.indexOf(model) === index,
  );
}

export function requireGeminiKey() {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY is missing.");
  return geminiApiKey;
}

export function callGemini(model: string, body: unknown) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requireGeminiKey(),
    },
    body: JSON.stringify(body),
  });
}

/** The text of the first candidate, with any ```json fences removed. */
export function responseText(raw: string) {
  const data = JSON.parse(raw);
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();
  return text ? String(text).replace(/```json|```/g, "").trim() : "";
}

export function errorMessage(raw: string) {
  try {
    return String(JSON.parse(raw)?.error?.message ?? raw).slice(0, 200);
  } catch {
    return raw.slice(0, 200);
  }
}

/** Turns the HTTP statuses seen across all models into a message the user can act on. */
export function unavailableError(statuses: number[], details: string[]) {
  console.error("Gemini failed:", details.join(" | "));
  if (statuses.includes(503)) {
    return new PublicError("The AI is overloaded right now. Please try again in a moment.", 503);
  }
  if (statuses.includes(429)) {
    return new PublicError("The AI quota is used up for now. Please try again later.", 503);
  }
  return new PublicError("The AI couldn't respond right now. Please try again.", 502);
}

/** Tries each model in turn until one returns JSON that parses. */
export async function generateJson(models: string[], body: unknown): Promise<Record<string, unknown>> {
  const statuses: number[] = [];
  const details: string[] = [];

  for (const model of models) {
    const response = await callGemini(model, body);
    const raw = await response.text();
    if (!response.ok) {
      statuses.push(response.status);
      details.push(`${model} (${response.status}): ${errorMessage(raw)}`);
      continue;
    }

    const text = responseText(raw);
    if (!text) {
      details.push(`${model}: empty response`);
      continue;
    }

    try {
      return JSON.parse(text);
    } catch {
      details.push(`${model}: invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  throw unavailableError(statuses, details);
}
