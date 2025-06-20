// src/ports/IDefaultComponentPolicy.js
/* eslint-disable no-unused-vars */

/**
 * @interface IDefaultComponentPolicy
 * @description Applies default components to an entity.
 */
export class IDefaultComponentPolicy {
  /**
   * Applies default components to the provided entity.
   *
   * @param {object} entity - The entity to modify.
   * @returns {void}
   */
  apply(entity) {
    throw new Error('Interface method');
  }
}
