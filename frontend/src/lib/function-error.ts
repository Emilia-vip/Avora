export async function functionErrorMessage(error: unknown) {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: Response }).context
    : undefined;

  if (context) {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      try {
        const text = await context.text();
        if (text) return text;
      } catch {
        // Fall back to the generic FunctionsHttpError message.
      }
    }
  }

  return error instanceof Error ? error.message : 'Edge Function returned a non-2xx status code';
}
