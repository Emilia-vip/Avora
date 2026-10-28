// Backup AI used when Gemini is out of quota. Groq speaks the OpenAI chat format,
// so the Gemini request is translated here and the same prompts and rules are reused.

export const groqApiKey = Deno.env.get("GROQ_API_KEY");

/** Must be a Groq model that accepts images. Override with GROQ_MODEL if Groq renames it. */
const groqModel = Deno.env.get("GROQ_MODEL") ?? "meta-llama/llama-4-scout-17b-16e-instruct";

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiRequest = {
  systemInstruction?: { parts: GeminiPart[] };
  contents: Array<{ parts: GeminiPart[] }>;
  generationConfig?: { temperature?: number; responseSchema?: unknown };
};

/** Returns parsed JSON, or throws with a short reason that ends up in the logs. */
export async function generateJsonWithGroq(body: unknown): Promise<Record<string, unknown>> {
  if (!groqApiKey) throw new Error("GROQ_API_KEY is not set");
  const request = body as GeminiRequest;

  // JSON mode does not enforce a schema, so the schema is spelled out in the instructions instead.
  const system = [
    ...(request.systemInstruction?.parts ?? []).map((part) => part.text ?? ""),
    request.generationConfig?.responseSchema
      ? `Answer with a single JSON object that matches this JSON schema:\n${JSON.stringify(request.generationConfig.responseSchema)}`
      : "Answer with a single JSON object.",
  ].join("\n\n");

  const content = request.contents.flatMap((message) =>
    message.parts.map((part) =>
      part.inlineData
        ? { type: "image_url", image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } }
        : { type: "text", text: part.text ?? "" }
    )
  );

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: request.generationConfig?.temperature ?? 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    let message = raw.slice(0, 200);
    try {
      message = String(JSON.parse(raw)?.error?.message ?? message).slice(0, 200);
    } catch {
      // Keep the raw text.
    }
    throw new Error(`groq ${groqModel} (${response.status}): ${message}`);
  }

  const text = String(JSON.parse(raw)?.choices?.[0]?.message?.content ?? "")
    .replace(/```json|```/g, "")
    .trim();
  if (!text) throw new Error(`groq ${groqModel}: empty response`);
  return JSON.parse(text);
}
