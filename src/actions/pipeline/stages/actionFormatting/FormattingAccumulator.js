/**
 * @file Aggregates statistics and formatted commands for the action formatting stage.
 */

/**
 * @typedef {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */

/**
 * @typedef {object} ActionSummary
 * @property {string} actionId - Identifier of the action.
 * @property {'legacy'|'multi-target'|'per-action'|undefined} [path] - The formatting pathway the action used.
 * @property {number} successes - Number of successful target formatting attempts.
 * @property {number} failures - Number of failed target formatting attempts.
 */

/**
 * @typedef {object} FormattedAction
 * @property {string} id - Action identifier.
 * @property {string} name - Action name.
 * @property {string} command - Resolved command string.
 * @property {string} [description] - Optional description.
 * @property {object} [params] - Parameter payload.
 * @property {object|null} [visual] - Visual payload associated with the action.
 */

/**
 * @class FormattingAccumulator
 * @description Utility that tracks command outputs and lifecycle statistics for action formatting.
 */
export class FormattingAccumulator {
  #statistics;

  #formattedActions;

  #errors;

  #actionSummaries;

  constructor() {
    this.#statistics = {
      total: 0,
      successful: 0,
      failed: 0,
      perActionMetadata: 0,
      multiTarget: 0,
      legacy: 0,
    };
    this.#formattedActions = [];
    this.#errors = [];
    this.#actionSummaries = new Map();
  }

  /**
   * Registers a new action to be tracked by the accumulator.
   *
   * @param {string} actionId - Unique identifier for the action.
   * @param {'legacy'|'multi-target'|'per-action'} [path] - Formatting pathway being used.
   * @returns {void}
   */
  registerAction(actionId, path) {
    this.#statistics.total += 1;
    if (path === 'legacy') {
      this.#statistics.legacy += 1;
    } else if (path === 'multi-target') {
      this.#statistics.multiTarget += 1;
    } else if (path === 'per-action') {
      this.#statistics.perActionMetadata += 1;
    }

    this.#actionSummaries.set(actionId, {
      actionId,
      path,
      successes: 0,
      failures: 0,
    });
  }

  /**
   * Marks an action as processed successfully for the first time.
   *
   * @param {string} actionId - Identifier of the action being updated.
   * @returns {void}
   */
  recordSuccess(actionId) {
    const summary = this.#actionSummaries.get(actionId);
    if (!summary) {
      return;
    }

    summary.successes += 1;
    if (summary.successes === 1) {
      this.#statistics.successful += 1;
    }
  }

  /**
   * Marks an action as having a failure.
   *
   * @param {string} actionId - Identifier of the action being updated.
   * @returns {void}
   */
  recordFailure(actionId) {
    const summary = this.#actionSummaries.get(actionId);
    if (!summary) {
      return;
    }

    summary.failures += 1;
    if (summary.failures === 1) {
      this.#statistics.failed += 1;
    }
  }

  /**
   * Stores a formatted action command.
   *
   * @param {FormattedAction} action - The formatted action payload.
   * @returns {void}
   */
  addFormattedAction(action) {
    this.#formattedActions.push(action);
  }

  /**
   * Stores a formatting error payload.
   *
   * @param {unknown} error - Error payload.
   * @returns {void}
   */
  addError(error) {
    this.#errors.push(error);
  }

  /**
   * Calculates the derived statistics required for stage completion summaries.
   *
   * @returns {{total:number,successful:number,failed:number,perActionMetadata:number,multiTarget:number,legacy:number}}
   */
  getStatistics() {
    const statistics = { ...this.#statistics };

    const derivedPerActionCount = statistics.multiTarget + statistics.legacy;
    if (derivedPerActionCount > statistics.perActionMetadata) {
      statistics.perActionMetadata = derivedPerActionCount;
    }

    return statistics;
  }

  /**
   * @returns {FormattedAction[]} Copy of the formatted actions collected so far.
   */
  getFormattedActions() {
    return [...this.#formattedActions];
  }

  /**
   * @returns {unknown[]} Copy of the recorded errors.
   */
  getErrors() {
    return [...this.#errors];
  }

  /**
   * @param {string} actionId - Identifier of the action summary to inspect.
   * @returns {ActionSummary|undefined} Action summary for the provided identifier.
   */
  getActionSummary(actionId) {
    const summary = this.#actionSummaries.get(actionId);
    return summary ? { ...summary } : undefined;
  }
}

export default FormattingAccumulator;
