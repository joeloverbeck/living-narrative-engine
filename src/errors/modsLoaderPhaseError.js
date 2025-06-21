export const ModsLoaderErrorCode = Object.freeze({
  SCHEMA: 'schema',
  MANIFEST: 'manifest',
  CONTENT: 'content',
  WORLD: 'world',
  SUMMARY: 'summary',
  UNEXPECTED: 'unexpected',
});

export class ModsLoaderPhaseError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {string} phase
   * @param {Error} [cause]
   */
  constructor(code, message, phase, cause) {
    super(message);
    this.name = 'ModsLoaderPhaseError';
    this.code = code;
    this.phase = phase;
    if (cause) this.cause = cause;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModsLoaderPhaseError);
    }
  }
} 