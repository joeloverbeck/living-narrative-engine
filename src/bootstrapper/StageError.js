export default class StageError extends Error {
  /**
   * Represents an error thrown during a bootstrap stage.
   *
   * @description Error thrown during a bootstrap stage.
   * @param {string} phase - Name of the bootstrap phase.
   * @param {string} message - Error message.
   * @param {Error} [cause] - Underlying error cause.
   */
  constructor(phase, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.phase = phase;
  }
}
