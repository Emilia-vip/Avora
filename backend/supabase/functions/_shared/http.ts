export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** An error whose message is written for the user and safe to send to the app as-is. */
export class PublicError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Wraps a handler with CORS preflight and error handling. Unexpected errors (Gemini responses,
 * database errors, stack traces) are only logged; the app gets a short generic message.
 */
export function handle(name: string, handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof PublicError) {
        console.warn(`${name} ${error.status}: ${error.message}`);
        return jsonResponse({ error: error.message }, error.status);
      }
      console.error(`${name} error:`, error);
      return jsonResponse({ error: "Something went wrong. Please try again in a moment." }, 500);
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new PublicError("Invalid request.");
  }
}
