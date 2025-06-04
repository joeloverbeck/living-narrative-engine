// src/core/interfaces/ITargetResolutionService.js

/**
 * @interface
 */
export class ITargetResolutionService {
  /**
   * @param {ActionDefinition} actionDefinition
   * @param {ActionContext} actionContext
   * @returns {Promise}
   */
  async resolveActionTarget(actionDefinition, actionContext) {
    throw new Error('Not implemented');
  }
}
