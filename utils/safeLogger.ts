const MAX_LOG_TEXT_LENGTH = 240;
const SAFE_OBJECT_KEYS = new Set(['name', 'message', 'code', 'status']);

const redactText = (value: string): string => value
  .replace(/https?:\/\/\S+/gi, '[URL]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[ID]')
  .replace(/\b\d{8,}\b/g, '[ID]')
  .slice(0, MAX_LOG_TEXT_LENGTH);

export const sanitizeLogValue = (value: unknown): unknown => {
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return value;

  if (value instanceof Error) {
    const errorWithCode = value as Error & { code?: unknown; status?: unknown };
    return {
      name: redactText(value.name),
      message: redactText(value.message),
      ...(errorWithCode.code != null ? { code: redactText(String(errorWithCode.code)) } : {}),
      ...(errorWithCode.status != null ? { status: redactText(String(errorWithCode.status)) } : {}),
    };
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => SAFE_OBJECT_KEYS.has(key))
        .map(([key, entry]) => [key, sanitizeLogValue(entry)]),
    );
  }

  return redactText(String(value));
};

let loggingInstalled = false;

export const installSafeConsoleLogging = (): void => {
  if (loggingInstalled || typeof console === 'undefined') return;
  loggingInstalled = true;

  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...values: unknown[]) => original(...values.map(sanitizeLogValue));
  });
};
