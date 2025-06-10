// src/turns/builders/attemptActionBuilder.js
/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {Object} CoreAttemptActionPayload
 * @property {'core:attempt_action'} eventName
 * @property {string} actorId
 * @property {string} actionId
 * @property {Object.<string, any>} params
 */

/**
 * Builder for creating CoreAttemptActionPayloads from ActionComposite-like objects.
 * Pure aside from logging side-effects.
 */
export class AttemptActionBuilder {
  /**
   * @param {ILogger} logger
   */
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Build a core:attempt_action payload from an ActionComposite.
   *
   * @param {string} actorId
   * @param {Object} composite
   * @param {number} composite.index
   * @param {string} composite.actionId
   * @param {Object} composite.params
   * @param {string} composite.description
   * @returns {CoreAttemptActionPayload}
   */
  build(actorId, composite) {
    // Deep-copy params
    const paramsCopy = JSON.parse(JSON.stringify(composite.params));

    // Scoped logger
    const actionLogger = this.logger.child({ idx: composite.index });
    actionLogger.info(
      `actor=${actorId} idx=${composite.index} actionId=${composite.actionId} ` +
        `params=${JSON.stringify(paramsCopy)} description="${composite.description}"`
    );

    return {
      eventName: 'core:attempt_action',
      actorId,
      actionId: composite.actionId,
      params: paramsCopy,
    };
  }
}
