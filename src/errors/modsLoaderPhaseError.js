/**
 * Enum of error codes for the different phases of the mods loader.
 *
 * @constant {object}
 */
export const ModsLoaderErrorCode = Object.freeze({
  SCHEMA: 'schema',
  GAME_CONFIG: 'game_config',
  MANIFEST: 'manifest',
  CONTENT: 'content',
  WORLD: 'world',
  SUMMARY: 'summary',
  UNEXPECTED: 'unexpected',
});

/**
 * Error thrown when a specific phase of the mods loader fails.
 *
 * @class ModsLoaderPhaseError
 * @augments Error
 */
export class ModsLoaderPhaseError extends Error {
  /**
   * Creates an error instance for a failed loader phase.
   *
   * @param {string} code - A ModsLoaderErrorCode value identifying the phase.
   * @param {string} message - A human readable error message.
   * @param {string} phase - Name of the loader phase that failed.
   * @param {Error} [cause] - Optional underlying error cause.
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
