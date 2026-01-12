/**
 * @file Resolve the report worker URL across module and non-module environments.
 */

const MODULE_WORKER_PATH = '../../expressionDiagnostics/workers/MonteCarloReportWorker.js';
const DOCUMENT_WORKER_PATHS = [
  'expressionDiagnostics/workers/MonteCarloReportWorker.js',
  'src/expressionDiagnostics/workers/MonteCarloReportWorker.js',
];

function resolveUrl(candidate, baseUrl) {
  if (!candidate) {
    return null;
  }

  try {
    return baseUrl ? new URL(candidate, baseUrl).toString() : new URL(candidate).toString();
  } catch {
    return null;
  }
}

function normalizeUrl(candidate) {
  return resolveUrl(candidate, undefined);
}

export function resolveReportWorkerUrl({ moduleUrl, documentBaseUrl } = {}) {
  const normalizedDocumentBase = normalizeUrl(documentBaseUrl);
  const resolvedModuleBase = moduleUrl
    ? resolveUrl(moduleUrl, normalizedDocumentBase || undefined)
    : null;

  if (resolvedModuleBase) {
    const url = resolveUrl(MODULE_WORKER_PATH, resolvedModuleBase);
    return url ? { url, type: 'module' } : null;
  }

  if (normalizedDocumentBase) {
    for (const candidatePath of DOCUMENT_WORKER_PATHS) {
      const url = resolveUrl(candidatePath, normalizedDocumentBase);
      if (url) {
        const type = candidatePath.startsWith('src/') ? 'module' : 'classic';
        return { url, type };
      }
    }
  }

  return null;
}
