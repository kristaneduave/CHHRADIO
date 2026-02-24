import type { generateCasePDF } from './pdfService';

type GenerateCasePdfFn = typeof generateCasePDF;

let cachedGenerateCasePdf: GenerateCasePdfFn | null = null;
let pendingGenerateCasePdf: Promise<GenerateCasePdfFn> | null = null;

export const loadGenerateCasePDF = async (): Promise<GenerateCasePdfFn> => {
  if (cachedGenerateCasePdf) {
    return cachedGenerateCasePdf;
  }

  if (!pendingGenerateCasePdf) {
    pendingGenerateCasePdf = import('./pdfService')
      .then((mod) => {
        cachedGenerateCasePdf = mod.generateCasePDF;
        return cachedGenerateCasePdf;
      })
      .finally(() => {
        pendingGenerateCasePdf = null;
      });
  }

  return pendingGenerateCasePdf;
};

export const prefetchGenerateCasePDF = async (): Promise<void> => {
  try {
    await loadGenerateCasePDF();
  } catch {
    // Best-effort prefetch: ignore background failures.
  }
};
