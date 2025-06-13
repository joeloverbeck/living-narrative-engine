/**
 * @file This interface provides the summary data of a location.
 * @see src/interfaces/ILocationSummaryProvider.js
 */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AILocationSummaryDTO} AILocationSummaryDTO */

/**
 * @interface ILocationSummaryProvider
 * @description Defines the contract for a service that builds the AILocationSummaryDTO.
 */
export class ILocationSummaryProvider {
  /**
   * Asynchronously builds a summary of the actor's current location.
   *
   * @param {Entity} actor - The AI-controlled entity.
   * @param {ILogger} logger - An instance of the logger.
   * @returns {Promise<AILocationSummaryDTO | null>} A promise that resolves to the location summary or null.
   */
  async build(actor, logger) {
    throw new Error("Method 'build(actor, logger)' must be implemented.");
  }
}
